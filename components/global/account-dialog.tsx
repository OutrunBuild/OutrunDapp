'use client'

import { X } from 'lucide-react'
import { useState } from 'react'
import { useExportWallet } from '@privy-io/react-auth'

import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import type { Locale } from '@/lib/data/fixture-repository'
import type { LoginIdentity } from '@/lib/web3/login-identity'

import { CopyAddress } from './copy-address'
import { getCopy } from './copy'

/**
 * Account dialog (grouped): identity header (name + email/handle) + Wallet
 * group (address + copy) + Backup group (export note + button, embedded only).
 * The export entry renders only when an embedded wallet is present — MetaMask
 * (or any injected) logins have nothing to export and the SDK call would
 * throw. Export opens Privy's own iframe modal; the app never touches the
 * private key.
 */
export function AccountDialog({
  locale,
  open,
  onOpenChange,
  identity,
  address,
  hasEmbedded,
}: {
  locale: Locale
  open: boolean
  onOpenChange: (open: boolean) => void
  identity: LoginIdentity | null
  address: string | null
  hasEmbedded: boolean
}) {
  const copy = getCopy(locale)
  const selectCopy = copy.wallet.select
  const { exportWallet } = useExportWallet()
  const [exportError, setExportError] = useState<string | null>(null)

  const exportKey = (): void => {
    if (!address) return
    setExportError(null)
    void exportWallet({ address }).catch(() => setExportError(selectCopy.exportWalletError))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="chain-dialog__panel account-dialog">
        <div className="account-dialog__head">
          <DialogTitle className="account-dialog__title">{selectCopy.accountTitle}</DialogTitle>
          <DialogClose className="account-dialog__close" aria-label={copy.common.close}>
            <X aria-hidden="true" className="size-4" />
          </DialogClose>
        </div>
        {identity?.name ? (
          <div className="account-dialog__identity">
            <h3 className="account-dialog__label">{selectCopy.usernameGroup}</h3>
            <p className="wallet-select__note">
              <span data-numeric>{identity.name.replace(/^@/, '')}</span>
            </p>
          </div>
        ) : null}
        {address ? (
          <section
            className="account-dialog__group"
            data-testid="account-dialog-group"
            data-group="wallet"
          >
            <h3 className="account-dialog__label">{selectCopy.walletGroup}</h3>
            <CopyAddress locale={locale} value={address} full />
          </section>
        ) : null}
        {hasEmbedded && address ? (
          <section
            className="account-dialog__group"
            data-testid="account-dialog-group"
            data-group="backup"
          >
            <Button
              type="button"
              variant="default"
              className="ax-ghost-cta"
              onClick={exportKey}
            >
              {selectCopy.exportWallet}
            </Button>
            {exportError ? (
              <p className="wallet-select__note" role="alert">
                {exportError}
              </p>
            ) : null}
          </section>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

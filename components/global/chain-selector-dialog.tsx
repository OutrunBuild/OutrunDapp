'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

import { ChainLogoMark } from './chain-icons'

import type { Locale, ChainInfo } from '@/lib/data/fixture-repository'

import { getCopy } from './copy'
import { useAccountCenter } from './use-account-center'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

/**
 * Header wallet-chain selector: the trigger shows the wallet's current chain;
 * the dialog lists the chains passed in (the shell passes only the 3 testnets).
 * Selection switches the wallet only — it never writes URL state. The discovery
 * page's `?chain` governance filter is owned by that page's own dropdown and is
 * independent of this selector.
 * This selector is the single entry point for wallet chain switching — the
 * current-chain state lives in the account center (consumed by Yield Vault chain
 * awareness). Esc/focus trapping/focus restore to the trigger are built into the
 * ui/dialog primitive; backdrop blur uses the global [data-slot='dialog-backdrop']
 * skin.
 */
export function ChainSelectorDialog({ locale, chains }: { locale: Locale; chains: ChainInfo[] }) {
  const copy = getCopy(locale)
  const [open, setOpen] = useState(false)
  const {
    chainId: centerChainId,
    switchChainAction,
    switchChainError,
    clearSwitchChainError,
  } = useAccountCenter()
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    if (!open) clearSwitchChainError()
  }, [open, clearSwitchChainError])

  const activeId = centerChainId ?? chains[0]?.chainId
  const active = chains.find((c) => c.chainId === activeId) ?? chains[0]

  // Wallet-only switch: success closes the dialog, failures keep it open with
  // retry copy — never a silent no-op, never a URL write.
  const select = (chainId: number) => {
    if (switching) return
    setSwitching(true)
    void switchChainAction(chainId).then((ok) => {
      setSwitching(false)
      if (!ok) return
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="chain-dialog__trigger" render={<button type="button" />}>
        <ChainLogoMark chainId={activeId} />
        <span className="chain-dialog__trigger-current">{active?.name ?? '—'}</span>
        <ChevronDown aria-hidden="true" className="size-3.5" />
      </DialogTrigger>
      <DialogContent className="chain-dialog__panel">
        <DialogTitle className="sr-only">{copy.common.viewChain}</DialogTitle>
        {switchChainError ? (
          <p className="wallet-select__note" role="alert">
            {copy.common.switchChainFailed}
          </p>
        ) : null}
        <ul className="chain-dialog__list">
          {chains.map((c) => (
            <li key={c.chainId}>
              <button
                type="button"
                className="chain-dialog__option"
                data-active={c.chainId === activeId ? 'true' : undefined}
                onClick={() => select(c.chainId)}
              >
                <span className="chain-dialog__option-name">
                  <ChainLogoMark chainId={c.chainId} size={18} />
                  {c.name}
                </span>
                {c.chainId === activeId ? <Check aria-hidden="true" className="size-3.5" /> : null}
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}

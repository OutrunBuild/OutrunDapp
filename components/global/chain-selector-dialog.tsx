'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

import { ChainLogoMark } from './chain-icons'

import type { Locale, ChainInfo } from '@/lib/data/fixture-repository'

import { getCopy } from './copy'
import { useAccountCenter } from './use-account-center'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { getClientChainConfig } from '@/lib/web3/chains'

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
    source,
    connected,
    connectAction,
    sessionRestoring,
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
  const listed = chains.find((c) => c.chainId === activeId)
  // A8 wrong network: only a REAL wallet parked outside the offered set (undeployed
  // mainnets, unknown chains) warns. The harness id sits outside the set on purpose
  // (fixture pixel contract: the shell falls back to chains[0] for display), so the
  // warning must be gated on the real source.
  const clientChain =
    source === 'real' && centerChainId !== null && !listed
      ? getClientChainConfig(centerChainId)
      : null
  const wrongNetwork = clientChain !== null
  const activeName = listed
    ? listed.name
    : clientChain
      ? clientChain.status === 'ok'
        ? clientChain.config.viemChain.name
        : copy.wallet.account.wrongNetworkTitle
      : (chains[0]?.name ?? '—')

  // Wallet-only switch: success closes the dialog, failures keep it open with
  // retry copy — never a silent no-op, never a URL write.
  // Disconnected: wagmi resolves `switchChain` without any wallet RPC (it only
  // rewrites its own chain state, which no view reads), so switching here would
  // close on a success that changed nothing — open the connect entry instead.
  // The restore window is excluded: a session that is still landing must not get
  // a login dialog over it, so the click stays in the list instead. The harness
  // is excluded because its switch really does move the chain.
  const select = (chainId: number) => {
    if (switching) return
    if (source === 'real' && !connected) {
      if (sessionRestoring) return
      setOpen(false)
      connectAction()
      return
    }
    setSwitching(true)
    void switchChainAction(chainId).then((ok) => {
      setSwitching(false)
      if (!ok) return
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="chain-dialog__trigger"
        data-warning={wrongNetwork ? 'true' : undefined}
        render={<button type="button" />}
      >
        <ChainLogoMark chainId={activeId} />
        <span className="chain-dialog__trigger-current">{activeName}</span>
        <ChevronDown aria-hidden="true" className="size-3.5" />
      </DialogTrigger>
      <DialogContent className="chain-dialog__panel">
        <DialogTitle className="sr-only">{copy.common.switchChain}</DialogTitle>
        {wrongNetwork ? (
          <div className="chain-dialog__notice">
            <p className="chain-dialog__notice-title">{copy.wallet.account.wrongNetworkTitle}</p>
            <p className="chain-dialog__notice-body">{copy.wallet.account.wrongNetworkBody}</p>
          </div>
        ) : null}
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

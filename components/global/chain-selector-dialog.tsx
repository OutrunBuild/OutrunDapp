'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown } from 'lucide-react'

import { ChainLogoMark } from './chain-icons'

import type { Locale, FixtureChain } from '@/lib/data/fixture-repository'

import { getCopy } from './copy'
import { useMockWallet } from './mock-wallet'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

/**
 * Header view-chain selector: the trigger shows the current chain;
 * the dialog lists the chains passed in (the shell passes only the 3 testnets).
 * Selection writes URL ?chain={chainId} — the discovery page reads that param to
 * filter data (real linkage); other pages merely remember the view chain.
 * This selector is the single entry point for chain switching — the current-chain
 * state lives in the mock wallet's chainId (consumed by Yield Vault chain awareness),
 * and opening the dialog still syncs from the URL deep link.
 * Esc/focus trapping/focus restore to the trigger are built into the ui/dialog
 * primitive; backdrop blur uses the global [data-slot='dialog-backdrop'] skin.
 */
export function ChainSelectorDialog({ locale, chains }: { locale: Locale; chains: FixtureChain[] }) {
  const copy = getCopy(locale)
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const { chainId: activeId, switchChain } = useMockWallet()

  useEffect(() => {
    if (!open) return
    const params = new URLSearchParams(window.location.search)
    const fromUrl = Number(params.get('chain'))
    if (chains.some((c) => c.chainId === fromUrl)) switchChain(fromUrl)
  }, [open, chains, switchChain])

  const active = chains.find((c) => c.chainId === activeId) ?? chains[0]

  const select = (chainId: number) => {
    switchChain(chainId)
    setOpen(false)
    const params = new URLSearchParams(window.location.search)
    if (chainId === chains[0]?.chainId) params.delete('chain')
    else params.set('chain', String(chainId))
    const qs = params.toString()
    router.replace(qs ? `${window.location.pathname}?${qs}` : window.location.pathname, { scroll: false })
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

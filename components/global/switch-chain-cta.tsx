'use client'

import { Button } from '@/components/ui/button'
import type { Locale } from '@/lib/data/fixture-repository'

import { ChainLogoMark } from './chain-icons'
import { getCopy } from './copy'
import { useAccountCenter } from './use-account-center'
import { switchProviderChain } from '@/lib/web3/active-provider'
import { executionChainId } from '@/lib/web3/chains'

/** Verse execution chain + wrong-chain verdict for the trading-desk panels: a wallet on
 * another chain must never fire the desk's on-chain reads (same-address deployments on the
 * other chains revert InvalidVerseId); the panel CTA becomes the network switch instead. */
export function useVerseExecChain(governanceChain: number) {
  const center = useAccountCenter()
  // Fixture governance ids are mainnet; the wallet executes on the testnet twin.
  const execChain = executionChainId(governanceChain)
  const wrongChain = center.source === 'real' && center.connected && center.chainId !== execChain
  return { execChain, wrongChain, switchChain: center.switchChainAction }
}

/** Switch-network CTA: the target chain's icon rides before its name.
 *  The switch goes provider-direct first (resolves on the wallet's answer, no event
 *  wait); anything short of `switched` that is not a refusal still falls through to
 *  the wagmi connector path, which confirms via chainChanged + eth_chainId re-read. */
export function SwitchChainCta({
  locale,
  execChain,
  chainName,
  onSwitch,
  onSwitched,
  className,
  variant,
  size,
}: {
  locale: Locale
  execChain: number
  chainName: string
  onSwitch: (chainId: number) => void
  onSwitched?: () => void
  className?: string
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}) {
  const copy = getCopy(locale)
  // The chain icon rides immediately before the chain NAME inside the label, not at the
  // button start.
  const [labelHead, labelTail = ''] = copy.verseDesk.switchChainCta.split('{chain}')
  return (
    <Button
      type="button"
      className={className}
      variant={variant}
      size={size}
      onClick={() => {
        void switchProviderChain(execChain).then((result) => {
          // `rejected` stops here: the wallet answered no, and a connector retry would
          // just pop the same prompt again. Anything else still gets the wagmi fallback.
          if (result === 'rejected') return
          if (result !== 'switched') onSwitch(execChain)
          onSwitched?.()
        })
      }}
    >
      {labelHead}
      <span className="inline-flex items-center" aria-hidden="true">
        <ChainLogoMark chainId={execChain} size={16} />
      </span>
      {' '}
      {chainName}
      {labelTail}
    </Button>
  )
}

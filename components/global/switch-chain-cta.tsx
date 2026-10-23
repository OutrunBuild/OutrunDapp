'use client'

import { Button } from '@/components/ui/button'
import type { Locale } from '@/lib/data/fixture-repository'

import { ChainLogoMark } from './chain-icons'
import { getCopy } from './copy'
import { useAccountCenter } from './use-account-center'
import { switchProviderChain } from '@/lib/web3/active-provider'

/** Fixture governance ids are mainnet; the current chainset runs the testnet twin. */
const MAINNET_TO_TESTNET: Record<number, number> = { 1: 421614, 8453: 84532, 56: 97 }

/** Verse execution chain + wrong-chain verdict for the trading-desk panels: a wallet on
 * another chain must never fire the desk's on-chain reads (same-address deployments on the
 * other chains revert InvalidVerseId); the panel CTA becomes the network switch instead
 * (user ruling 2026-10-22). */
export function useVerseExecChain(governanceChain: number) {
  const center = useAccountCenter()
  const execChain = MAINNET_TO_TESTNET[governanceChain] ?? governanceChain
  const wrongChain = center.source === 'real' && center.connected && center.chainId !== execChain
  return { execChain, wrongChain, switchChain: center.switchChainAction }
}

/** Switch-network CTA: the target chain's icon rides before its name (user ruling 2026-10-23).
 *  The switch itself goes provider-direct first (wallet_switchEthereumChain — the connector
 *  path can be stale); the wagmi fallback only fires when the direct call cannot run. */
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
  // The chain icon rides immediately before the chain NAME inside the label
  // (user ruling 2026-10-23), not at the button start.
  const [labelHead, labelTail = ''] = copy.verseDesk.switchChainCta.split('{chain}')
  return (
    <Button
      type="button"
      className={className}
      variant={variant}
      size={size}
      onClick={() => {
        void switchProviderChain(execChain).then((ok) => {
          if (!ok) onSwitch(execChain)
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

'use client'

import { WalletCards } from 'lucide-react'
import { useAccount } from 'wagmi'
import { usePrivy } from '@privy-io/react-auth'

import { Button } from '@/components/ui/button'
import type { Locale } from '@/lib/data/fixture-repository'
import { isWeb3Configured } from '@/lib/web3/active-provider'
import { readLastLogin, resolveLoginIdentity } from '@/lib/web3/login-identity'

import { AccountMenu, AccountPlaceholder } from './account-menu'
import { getCopy } from './copy'
import { useAccountCenter } from './use-account-center'
import { WalletSelectorHost } from './wallet-selector-dialog'
import { formatHex } from './signal-ui'

/**
 * Connected onchain identity label: Google name (else email), X @username
 * (else name), MetaMask falls back to the address. Mounted only on onchain
 * builds (fixture/e2e shells have no PrivyProvider, so useUser must never run
 * there) and only when connected. The aria-label carries the same string as
 * the visible text (WCAG 2.5.3: accessible name contains visible label).
 */
function useIdentityLabel(fallbackAddress: string): string {
  const { user, authenticated } = usePrivy()
  const { address: activeAddress } = useAccount()
  // A user object can outlive the session for a beat after logout; only an
  // authenticated Privy session may name the active wallet (otherwise a MetaMask
  // login right after logout showed the previous social handle).
  const identity = resolveLoginIdentity(
    authenticated ? user : null,
    activeAddress ?? fallbackAddress,
    readLastLogin(),
  )
  return identity?.name ?? formatHex(fallbackAddress)
}

export function WalletControl({ locale, address }: { locale: Locale; address: string }) {
  const { connected, connectAction, sessionRestoring } = useAccountCenter()
  const { ready } = usePrivy()
  const display = useIdentityLabel(address)
  const copy = getCopy(locale)
  const showIdentity = connected && isWeb3Configured()

  if (showIdentity) {
    return (
      <>
        <AccountMenu locale={locale} display={display} />
        <WalletSelectorHost locale={locale} />
      </>
    )
  }

  // Session still restoring: placeholder spans the whole restore window, not just
  // Privy boot — ready flips true before the wallet link reaches wagmi
  // (setActiveWallet retries) and before a persisted MetaMask connection reconnects
  // (no Privy auth on that path), so releasing at ready alone flashed Login between
  // the skeleton and the restored label. The window is the full 7s link budget.
  if (isWeb3Configured() && (!ready || sessionRestoring)) {
    return (
      <>
        <AccountPlaceholder label={copy.common.connect} />
        <WalletSelectorHost locale={locale} />
      </>
    )
  }

  return (
    <>
      <Button
        type="button"
        size="default"
        /* Skin = yellow ghost primary CTA — the same ax-ghost-cta
           as the home page's Explore Communities; the variant follows the site-wide
           pattern's default tier */
        className="wallet-control ax-ghost-cta"
        aria-pressed={connected}
        /* At the ultra-narrow tier (≤18.75rem) the label span is CSS-hidden into a pure
           icon — the aria-label carries the accessible name
           (display:none text does not enter the acc name; same string as the visible
           text, so zero behavior difference in the normal tier) */
        aria-label={connected ? formatHex(address) : copy.common.connect}
        onClick={connectAction}
      >
        <WalletCards data-icon="inline-start" aria-hidden="true" />
        {connected ? (
          <span className="wallet-control__connected">
            <span>{formatHex(address)}</span>
          </span>
        ) : (
          <>
            <span className="wallet-control__label-full">{copy.common.connect}</span>
            <span className="wallet-control__label-short">{copy.common.connectShort}</span>
          </>
        )}
      </Button>
      <WalletSelectorHost locale={locale} />
    </>
  )
}

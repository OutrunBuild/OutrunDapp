'use client'

import { CircleUserRound, LogOut, PieChart, User } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import { useAccount, useConnections, useDisconnect } from 'wagmi'
import { useLogout, usePrivy, useWallets } from '@privy-io/react-auth'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import type { Locale } from '@/lib/data/fixture-repository'
import { isWeb3Configured } from '@/lib/web3/active-provider'
import { readLastLogin, forgetLastLogin, resolveLoginIdentity } from '@/lib/web3/login-identity'
import { beginDisconnect, endDisconnect } from '@/lib/web3/disconnect-guard'
import { forgetWalletLink } from '@/lib/web3/session-hint'

import { AccountDialog } from './account-dialog'
import { getCopy } from './copy'
import { localePath } from './routes'
import { formatHex } from './signal-ui'

/**
 * Connected account menu: the top-bar identity button opens a dropdown
 * (Account / Portfolio / Disconnect) instead of the old Login dialog.
 * Trigger skin matches the Login button (wallet-control ax-ghost-cta);
 * menu skin follows the locale-menu dropdown anatomy.
 * Mounted only on onchain builds when connected (same gate as the old
 * IdentityButton — useUser must never run in fixture/e2e shells).
 */
export function AccountMenu({
  locale,
  display,
}: {
  locale: Locale
  display: string
}) {
  const { user, authenticated } = usePrivy()
  const { address: activeAddress } = useAccount()
  const { wallets } = useWallets()
  const { disconnectAsync } = useDisconnect()
  const connections = useConnections()
  const { logout } = useLogout()
  const [accountOpen, setAccountOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const copy = getCopy(locale)
  // Ignore a user object left over after logout: it must not name a wallet that
  // is now connected through MetaMask.
  const identity = resolveLoginIdentity(
    authenticated ? user : null,
    activeAddress ?? null,
    readLastLogin(),
  )
  // Live-first label: the parent display prop lags one render behind the
  // disconnect, so prefer live identity/address to avoid a stale-username flash.
  const rawLabel =
    identity?.name ??
    (activeAddress ? formatHex(activeAddress) : display || copy.common.connect)
  // X handles render without the @ prefix, top bar and dialog alike.
  const label = rawLabel.replace(/^@/, '')

  const leave = (): void => {
    setMenuOpen(false)
    // Guard against the session-restore link effect: wagmi disconnect lands
    // synchronously while Privy logout is still in flight (authenticated is
    // still true), so the link effect would immediately re-attach the embedded
    // wallet and the disconnect would appear to "bounce back". Both link effects
    // skip while it is set. It clears on logout success; on failure it stays so
    // the stale session cannot re-link, and an explicit login action releases it
    // (startOAuth / connectMetamask call endDisconnect).
    beginDisconnect()
    // The injected link must not be restored on the next load after an explicit exit.
    forgetWalletLink()
    // Clear the last-used badge first: display-layer hygiene so the logged-out
    // header falls back to the address path. (What actually blocks the social
    // path is the disconnect-all below emptying the address plus the dialog
    // guards — the badge alone never could, the resolver falls back to the
    // live user object when the badge is absent.)
    forgetLastLogin()
    // Best-effort disconnect-all (wagmi disconnect() with no args only drops
    // the current one; a lingering second connection keeps isConnected true and
    // the header re-renders as a fake-connected address label), then logout.
    // allSettled: a failing connector must not wedge the leave into a
    // half-logged-out state — logout always runs. Flag cleanup waits on the
    // full leave so the link guards never read a cleared window while logout
    // is still resolving.
    const targets = connections.map((connection) => connection.connector)
    void Promise.allSettled(targets.map((connector) => disconnectAsync({ connector })))
      // Privy logout only when a Privy session exists: a MetaMask-only session has
      // nothing to revoke, and calling it anyways hits /sessions/logout with no
      // session and returns 400 (Bad Request) in the console.
      .then(() => (authenticated ? logout() : undefined))
      .then(
        () => endDisconnect(),
        () => {
          // Logout failed: keep the guard up. The Privy session is still live, so
          // clearing it here would let the auto-link effects attach the old wallet
          // again and the user's "disconnect" would silently bounce back.
        },
      )
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          className="wallet-control ax-ghost-cta"
          aria-label={label}
        >
          <CircleUserRound data-icon="inline-start" aria-hidden="true" />
          <span
            className="wallet-control__connected"
            data-label={identity?.name ? 'name' : undefined}
            data-script={/[\u3400-\u9FFF\uF900-\uFAFF]/.test(label) ? 'cjk' : undefined}
          >
            <span>{label}</span>
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="locale-menu__content" data-testid="account-menu">
          <DropdownMenuItem
            className="locale-menu__item account-menu__item"
            onClick={() => setAccountOpen(true)}
          >
            <User data-icon="inline-start" aria-hidden="true" className="size-4" />
            <span>{copy.wallet.select.account}</span>
          </DropdownMenuItem>
          <DropdownMenuLinkItem
            className="locale-menu__item account-menu__item"
            render={<Link href={localePath(locale, '/portfolio')} />}
          >
            <PieChart data-icon="inline-start" aria-hidden="true" className="size-4" />
            <span>{copy.portfolio.title}</span>
          </DropdownMenuLinkItem>
          <Separator />
          <DropdownMenuItem
            className="locale-menu__item account-menu__item"
            data-tone="danger"
            onClick={leave}
          >
            <LogOut data-icon="inline-start" aria-hidden="true" className="size-4" />
            <span>{copy.wallet.select.disconnect}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AccountDialog
        locale={locale}
        open={accountOpen}
        onOpenChange={setAccountOpen}
        identity={identity}
        address={activeAddress ?? null}
        /* useWallets() lists externally connected wallets too (MetaMask etc.);
         * only Privy's embedded wallet ('privy' client type) can be exported —
         * length > 0 wrongly showed the export entry on direct connections */
        hasEmbedded={wallets.some((wallet) => wallet.walletClientType === 'privy')}
      />
    </>
  )
}

/** Hydrating placeholder: same footprint as the connected button, structure-
 * faithful skeleton (state-matrix D1) with the accent chrome dropped while
 * Privy restores — `data-restoring` pins border/content to the gray degrade
 * family (a yellow action light on a control that cannot act yet is false
 * signaling); icon + word-scale label-slot bar breathe as one cluster, so the
 * restore window reads as loading, not a broken render. The bar is decorative
 * (aria-hidden); the accessible name stays on the button's aria-label. */
export function AccountPlaceholder({ label }: { label: string }) {
  return (
    <Button
      type="button"
      size="default"
      className="wallet-control ax-ghost-cta"
      data-restoring
      disabled
      aria-label={label}
    >
      <CircleUserRound data-icon="inline-start" aria-hidden="true" />
      <span className="wallet-control__placeholder-bar" aria-hidden="true" />
    </Button>
  )
}

export function isAccountHydrating(ready: boolean): boolean {
  return isWeb3Configured() && !ready
}

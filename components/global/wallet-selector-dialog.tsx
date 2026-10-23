'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

import { injected, useAccount, useConnect } from 'wagmi';
import {
  getEmbeddedConnectedWallet,
  useLoginWithOAuth,
  usePrivy,
  useUser,
  useWallets,
  type ConnectedWallet,
} from '@privy-io/react-auth';
import { useSetActiveWallet } from '@privy-io/wagmi';

import type { Locale } from '@/lib/data/fixture-repository';
import { isWeb3Configured } from '@/lib/web3/active-provider';
import {
  forgetLastLogin,
  rememberLastLogin,
  type LoginProvider,
} from '@/lib/web3/login-identity';
import {
  forgetWalletLink,
  readWalletLink,
  rememberWalletLink,
} from '@/lib/web3/session-hint';
import { isDisconnecting, releaseDisconnectStorage } from '@/lib/web3/disconnect-guard';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { getCopy } from './copy';

type AnnouncedProvider = {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: { request: (args: { method: string; params?: unknown }) => Promise<unknown> };
};

/** Global selector open-state: every Connect entry point opens the same dialog. */
let selectorOpen = false;
const selectorListeners = new Set<() => void>();

function emitSelector(): void {
  selectorListeners.forEach((listener) => listener());
}

export function openWalletSelector(): void {
  selectorOpen = true;
  emitSelector();
}

function subscribeSelector(listener: () => void): () => void {
  selectorListeners.add(listener);
  return () => {
    selectorListeners.delete(listener);
  };
}

export function useWalletSelectorOpen(): [boolean, (open: boolean) => void] {
  const open = useSyncExternalStore(
    subscribeSelector,
    () => selectorOpen,
    () => false,
  );
  return [
    open,
    (next: boolean) => {
      selectorOpen = next;
      emitSelector();
    },
  ];
}

/** Dialog host: mount once per page (inside WalletControl); null on non-onchain builds. */
export function WalletSelectorHost({ locale }: { locale: Locale }) {
  const [open, setOpen] = useWalletSelectorOpen();
  return <WalletSelectorDialog locale={locale} open={open} onOpenChange={setOpen} />;
}

/** Live EIP-6963 discovery, filtered to MetaMask (announcement order preserved). */
function useMetamaskProvider(): AnnouncedProvider['provider'] | null {
  const [provider, setProvider] = useState<AnnouncedProvider['provider'] | null>(null);
  useEffect(() => {
    const onAnnounce = (event: Event): void => {
      const detail = (event as CustomEvent<AnnouncedProvider>).detail;
      const rdns = detail?.info?.rdns?.toLowerCase() ?? '';
      const name = detail?.info?.name?.toLowerCase() ?? '';
      if (!detail?.info?.uuid) return;
      if (rdns === 'io.metamask' || name === 'metamask') setProvider(detail.provider);
    };
    window.addEventListener('eip6963:announceProvider', onAnnounce);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    return () => window.removeEventListener('eip6963:announceProvider', onAnnounce);
  }, []);
  return provider;
}

/** True on touch-first devices: MetaMask row deeplinks into the in-app browser. */
function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function metamaskMissingTarget(): { href: string; labelKey: 'mmOpenApp' | 'mmInstall' } {
  if (isMobileDevice()) {
    const host = typeof window === 'undefined' ? '' : window.location.host;
    const path = typeof window === 'undefined' ? '' : window.location.pathname;
    return { href: `https://metamask.app.link/dapp/${host}${path}`, labelKey: 'mmOpenApp' };
  }
  return { href: 'https://metamask.io/download/', labelKey: 'mmInstall' };
}

/**
 * Product Login dialog (architecture.md §7 — never a third-party default modal).
 * The guard runs before any wallet hook: fixture/e2e builds return null without touching
 * Privy/wagmi hooks (no QueryClient dependency at SSR), keeping the harness toggle path
 * and the recorded baselines untouched.
 */
export function WalletSelectorDialog({
  locale,
  open,
  onOpenChange,
}: {
  locale: Locale;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!isWeb3Configured()) return null;
  return <ConfiguredSelectorDialog locale={locale} open={open} onOpenChange={onOpenChange} />;
}

function ConfiguredSelectorDialog({
  locale,
  open,
  onOpenChange,
}: {
  locale: Locale;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const copy = getCopy(locale).wallet;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="chain-dialog__panel login-dialog">
        <div className="login__head">
          <img
            className="login__wordmark"
            src="/brand/BRAND-01-wordmark-transparent-480.png"
            width={160}
            height={41}
            alt="Outrun"
          />
          <DialogTitle className="login__tagline">{copy.select.tagline}</DialogTitle>
        </div>
        {/* Connected state lives in the AccountMenu dropdown now; the dialog
            only serves the Login flow. */}
        <LoginView locale={locale} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

type ProviderRow = { key: LoginProvider; icon: string; label: string };

function LoginView({ locale, onDone }: { locale: Locale; onDone: () => void }) {
  const copy = getCopy(locale).wallet;
  const { authenticated } = usePrivy();
  const { connect } = useConnect();
  const { initOAuth, loading: oauthLoading } = useLoginWithOAuth();
  const { user } = useUser();
  const { address } = useAccount();
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const [connectError, setConnectError] = useState<string | null>(null);
  const [probed, setProbed] = useState(false);
  const [linkPending, setLinkPending] = useState<LoginProvider | null>(null);
  const metamaskProvider = useMetamaskProvider();

  // Presence probe (tri-state): EIP-6963 announcement wins; after a grace window
  // fall back to window.ethereum so desktop extension installs without 6963 are
  // still detected. Before the probe resolves, render the MetaMask row (never the
  // install fallback) to avoid flashing the wrong entry on open.
  useEffect(() => {
    if (metamaskProvider) return;
    const fallback = window.setTimeout(() => setProbed(true), 900);
    return () => window.clearTimeout(fallback);
  }, [metamaskProvider]);
  const hasEthereum =
    typeof window !== 'undefined' && Boolean((window as { ethereum?: unknown }).ethereum);
  const metamaskResolved = metamaskProvider !== null || probed;
  const metamaskInstalled = metamaskProvider !== null || (probed && hasEthereum);

  // MetaMask path: close on address, not on the connect callback. The callback
  // only fires when wagmi runs the full handshake — a queued -32002 retry can
  // land connected through the connector cache without firing onSuccess, which
  // used to leave the dialog open over a logged-in page.
  useEffect(() => {
    if (address) onDone();
  }, [address, onDone]);

  // OAuth redirects away and back: when the session lands with an embedded wallet
  // but wagmi is still disconnected, link it via setActiveWallet (same link
  // semantics as the retired email flow — the sync runtime only auto-reconnects
  // useLogin/useConnectWallet paths, not headless initOAuth).
  // Same two guards as the returning-session effect below: a stale session must
  // never auto-link mid-logout or after logout (open dialog, link in flight).
  useEffect(() => {
    if (!linkPending || !authenticated || address) return;
    if (isDisconnecting()) return;
    const embedded: ConnectedWallet | null = getEmbeddedConnectedWallet(wallets);
    if (!embedded) return;
    let cancelled = false;
    void (async () => {
      try {
        await setActiveWallet(embedded);
        if (cancelled) return;
        // Social login owns the wallet now; drop any injected restore marker.
        forgetWalletLink();
        rememberLastLogin(linkPending);
        setLinkPending(null);
        onDone();
      } catch {
        if (cancelled) return;
        setLinkPending(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [linkPending, authenticated, address, wallets, setActiveWallet, onDone]);

  // Already authenticated (returning session): close into the connected view.
  // Last-used preference refreshes from whichever provider row the session lands
  // on: a stored OAuth login plus an active MetaMask connection resolves to the
  // address path, so record 'metamask' to keep the badge truthful.
  // Guards: the same intentional-disconnect window as LoginSessionRestore
  // (leave() flags it before wagmi disconnect + Privy logout resolve, so a stale
  // user + embedded wallet must not auto-link mid-logout), and the Privy
  // authenticated flag — a user object lingering after logout (or a dialog left
  // open across logout) must never drive a link or a close.
  useEffect(() => {
    if (linkPending || !authenticated || !user || address) return;
    // The injected wallet owns the session while its durable marker exists: do
    // not re-attach the embedded wallet behind the user's back. A fresh social
    // login clears the marker in startOAuth, so it is never mistaken for this
    // lingering-session case.
    if (readWalletLink() !== null) return;
    // Intentional disconnect in flight (leave() flags it before wagmi
    // disconnect + Privy logout resolve): the stale user + embedded wallet
    // still read live for a beat — do not auto-link them back.
    if (isDisconnecting()) return;
    const embedded: ConnectedWallet | null = getEmbeddedConnectedWallet(wallets);
    if (!embedded) return;
    let cancelled = false;
    void (async () => {
      try {
        await setActiveWallet(embedded);
        if (cancelled) return;
        forgetWalletLink();
        if (user.google) rememberLastLogin('google');
        else if (user.twitter) rememberLastLogin('x');
        else rememberLastLogin('metamask');
        onDone();
      } catch {
        if (cancelled) return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [linkPending, authenticated, user, address, wallets, setActiveWallet, onDone]);

  const startOAuth = (provider: 'google' | 'twitter', row: LoginProvider): void => {
    // Explicit login intent: clear the cross-reload stamp so the OAuth return can
    // link again, and drop the previous session's ownership hints. The in-page
    // memory guard stays: navigation reloads the document, and keeping it blocks
    // any bounce-back from the old session before the redirect.
    releaseDisconnectStorage();
    forgetLastLogin();
    forgetWalletLink();
    setLinkPending(row);
    try {
      // Persist the headless marker the SDK's return effect gates on
      // (withPrivyUi = !storage['privy:headless_oauth']): initOAuth navigates
      // away without writing it, so on return Ia() would read withPrivyUi=true
      // and the SDK would never consume the ?privy_oauth_* callback (params
      // stuck in URL, still logged out).
      window.localStorage.setItem('privy:headless_oauth', 'true');
    } catch {
      // Storage unavailable (private mode): the return cannot complete. Surface
      // it instead of leaving the row silently dead.
      setLinkPending(null);
      setConnectError(copy.select.storageBlocked);
      return;
    }
    void initOAuth({ provider }).catch(() => {
      setLinkPending(null);
    });
  };

  const connectMetamask = (): void => {
    setConnectError(null);
    const discovered = metamaskProvider;
    const injectedTarget =
      discovered ?? (window as { ethereum?: { request: unknown } }).ethereum;
    if (!injectedTarget) {
      setConnectError(copy.select.mmMissing);
      return;
    }
    connect(
      {
        connector: injected({
          target: () => ({ id: 'io.metamask', name: 'MetaMask', provider: injectedTarget as never }),
        }),
      },
      {
        onSuccess: () => {
          rememberWalletLink('metamask');
          rememberLastLogin('metamask');
          onDone();
        },
      },
    );
  };

  const rows: ProviderRow[] = [
    { key: 'x', icon: '/login/x.svg', label: copy.select.x },
    { key: 'google', icon: '/login/google.svg', label: copy.select.google },
    { key: 'metamask', icon: '/login/metamask.svg', label: copy.select.metamask },
  ];
  const missing = metamaskResolved && !metamaskInstalled;
  const mmTarget = metamaskMissingTarget();
  const busy = oauthLoading || linkPending !== null;

  return (
    <div>
      <ul className="chain-dialog__list login__list">
        {rows.map((row) =>
          row.key === 'metamask' && missing ? (
            <li key={row.key}>
              <p className="wallet-select__note">{copy.select.mmMissing}</p>
              <a className="login__link" href={mmTarget.href} target="_blank" rel="noreferrer">
                {copy.select[mmTarget.labelKey]}
              </a>
            </li>
          ) : (
            <li key={row.key}>
              <button
                type="button"
                className="chain-dialog__option login__option"
                disabled={busy}
                onClick={() => {
                  if (row.key === 'google') startOAuth('google', 'google');
                  else if (row.key === 'x') startOAuth('twitter', 'x');
                  else connectMetamask();
                }}
              >
                <span className="chain-dialog__option-name">
                  <img src={row.icon} alt="" aria-hidden="true" width={18} height={18} />
                  {row.label}
                </span>
              </button>
            </li>
          ),
        )}
      </ul>
      {connectError ? (
        <p className="wallet-select__note" role="alert">
          {connectError}
        </p>
      ) : null}
    </div>
  );
}

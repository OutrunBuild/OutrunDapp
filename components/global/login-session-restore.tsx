'use client';

import { useEffect, useRef, useState } from 'react';
import { useAccount } from 'wagmi';
import {
  getEmbeddedConnectedWallet,
  useCreateWallet,
  useLoginWithOAuth,
  usePrivy,
  useWallets,
} from '@privy-io/react-auth';
import { useSetActiveWallet } from '@privy-io/wagmi';

import { rememberLastLogin } from '@/lib/web3/login-identity';
import { forgetWalletLink, readWalletLink } from '@/lib/web3/session-hint';
import { isDisconnecting } from '@/lib/web3/disconnect-guard';

/**
 * Completes OAuth logins across the redirect and links them into wagmi.
 *
 * Root cause of the stuck `?privy_oauth_*` callback (params in URL, top bar
 * still Log in): Privy's headless OAuth completion lives in the
 * `useLoginWithOAuth` mount effect, but we only mounted that hook inside the
 * dialog's LoginView — which unmounts when `initOAuth` navigates away and is
 * still closed on return. So the callback was never consumed. Mounting the
 * hook here (always on, inside PrivyProvider) lets the SDK exchange the code,
 * set authenticated/user and clear the params on every return.
 *
 * Second half: link the embedded wallet into wagmi via setActiveWallet
 * (embedded only — injected wallets are never auto-touched, so no popup can
 * fire). Retries briefly because the Privy connector may not be registered yet
 * when the wallets first appear. Session restore on load is explicitly allowed
 * (§7: page load may restore a previously authorized session).
 */
export function LoginSessionRestore() {
  // Mount the SDK's own OAuth-return consumer. Return value unused on purpose:
  // the hook's mount effect is what exchanges `privy_oauth_*` params.
  useLoginWithOAuth();
  const { ready, authenticated, user } = usePrivy();
  const { address } = useAccount();
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const { createWallet } = useCreateWallet();

  // One-time rescue for callbacks stranded without the headless marker
  // (flows started before the marker fix): plant the marker the SDK gates on
  // and reload once so its return effect consumes the params. Guarded by a
  // session flag so a persistently-unconsumable callback can't loop — after
  // the reload the SDK clears the params in `finally` either way.
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const hasCallback =
      search.has('privy_oauth_code') &&
      search.has('privy_oauth_state') &&
      search.has('privy_oauth_provider');
    if (!hasCallback) return;
    try {
      if (window.localStorage.getItem('privy:headless_oauth')) return;
      if (window.sessionStorage.getItem('privy:oauth-rescue') === '1') return;
      window.sessionStorage.setItem('privy:oauth-rescue', '1');
      window.localStorage.setItem('privy:headless_oauth', 'true');
      window.location.reload();
    } catch {
      // Storage unavailable: leave the params untouched.
    }
  }, []);

  // Authenticated but wallet-less (the `already logged in` early-return path:
  // the SDK skips both the exchange and the embedded-wallet creation that only
  // runs on a fresh login). Mint one explicitly so the link effect below has
  // something to attach. The per-user marker is set only after success, so a
  // transient failure can retry instead of wedging this page; two retries, then
  // the next session. Failures stay silent — a missing wallet must never surface
  // as a login error.
  const createdFor = useRef<string | null>(null);
  const creatingFor = useRef<string | null>(null);
  const mintTries = useRef(0);
  const [mintTick, setMintTick] = useState(0);
  useEffect(() => {
    if (!ready || !authenticated || !user || address) return;
    if (getEmbeddedConnectedWallet(wallets)) return;
    if (createdFor.current === user.id || creatingFor.current === user.id) return;
    creatingFor.current = user.id;
    void createWallet()
      .then(() => {
        createdFor.current = user.id;
        mintTries.current = 0;
      })
      .catch(() => {
        mintTries.current += 1;
        if (mintTries.current <= 2) {
          window.setTimeout(() => setMintTick((tick) => tick + 1), 800);
        }
      })
      .finally(() => {
        if (creatingFor.current === user.id) creatingFor.current = null;
      });
  }, [ready, authenticated, user, address, wallets, createWallet, mintTick]);

  // The SDK clears `privy_oauth_*` only inside the exchange's `finally` — the
  // early-return path above never runs it, so the stale params sit in the URL
  // forever. Once a session is held they are spent: strip them (same three keys
  // the SDK removes). Unauthenticated callbacks are left untouched for the SDK.
  useEffect(() => {
    if (!ready || !authenticated || !user) return;
    const url = new URL(window.location.href);
    if (
      !url.searchParams.has('privy_oauth_code') &&
      !url.searchParams.has('privy_oauth_state') &&
      !url.searchParams.has('privy_oauth_provider')
    ) {
      return;
    }
    url.searchParams.delete('privy_oauth_code');
    url.searchParams.delete('privy_oauth_provider');
    url.searchParams.delete('privy_oauth_state');
    window.history.replaceState({}, '', url);
  }, [ready, authenticated, user]);

  useEffect(() => {
    if (!ready || !authenticated || !user || address) return;
    // The injected wallet owns the session while its durable marker exists: a
    // lingering Privy session must not override it. A fresh social login clears
    // the marker in startOAuth, so it is never mistaken for this case.
    if (readWalletLink() !== null) return;
    // Intentional disconnect in flight (leave() flags it before wagmi
    // disconnect + Privy logout resolve): do not re-attach the wallet.
    if (isDisconnecting()) return;
    const embedded = getEmbeddedConnectedWallet(wallets);
    if (!embedded) return;
    let cancelled = false;
    const link = (): void => {
      void setActiveWallet(embedded)
        .then(() => {
          if (cancelled) return;
          // A social session now owns the wallet; drop any injected restore marker.
          forgetWalletLink();
          if (user.google) rememberLastLogin('google');
          else if (user.twitter) rememberLastLogin('x');
          else rememberLastLogin('metamask');
        })
        .catch(() => undefined);
    };
    link();
    // setActiveWallet is a silent no-op when the Privy connector is not
    // registered yet — retry briefly until the address lands or we give up.
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      if (tries > 12) {
        window.clearInterval(timer);
        return;
      }
      link();
    }, 500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [ready, authenticated, user, address, wallets, setActiveWallet]);

  return null;
}

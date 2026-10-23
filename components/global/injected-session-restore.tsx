'use client';

import { useEffect, useRef } from 'react';
import { useAccount, useConfig, useReconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { usePrivy } from '@privy-io/react-auth';

import { readWalletLink } from '@/lib/web3/session-hint';
import { isDisconnecting } from '@/lib/web3/disconnect-guard';

const METAMASK_ID = 'io.metamask';
const DISCOVERY_MS = 2500;
const FALLBACK_MS = 900;
const RETRY_MS = 300;
const RETRIES = 3;

type AnnouncedProvider = {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: { request: (args: { method: string; params?: unknown }) => Promise<unknown> };
};

/** EIP-6963 first (same announcement contract as the login dialog), with a
 * MetaMask-identified `window.ethereum` fallback for extensions that never
 * announce. The identity check matters: a blind fallback could connect a
 * different injected wallet. */
function discoverMetaMask(timeoutMs: number): Promise<AnnouncedProvider['provider'] | null> {
  return new Promise((resolve) => {
    let settled = false;
    let timer = 0;
    let fallback = 0;
    const finish = (provider: AnnouncedProvider['provider'] | null): void => {
      if (settled) return;
      settled = true;
      window.removeEventListener('eip6963:announceProvider', onAnnounce);
      window.clearTimeout(timer);
      window.clearTimeout(fallback);
      resolve(provider);
    };
    const onAnnounce = (event: Event): void => {
      const detail = (event as CustomEvent<AnnouncedProvider>).detail;
      const rdns = detail?.info?.rdns?.toLowerCase() ?? '';
      const name = detail?.info?.name?.toLowerCase() ?? '';
      if (rdns === METAMASK_ID || name === 'metamask') finish(detail.provider);
    };
    fallback = window.setTimeout(
      () => {
        const ethereum = (window as { ethereum?: { isMetaMask?: boolean } }).ethereum;
        if (ethereum?.isMetaMask) finish(ethereum as unknown as AnnouncedProvider['provider']);
      },
      Math.min(FALLBACK_MS, timeoutMs),
    );
    timer = window.setTimeout(() => finish(null), timeoutMs);
    window.addEventListener('eip6963:announceProvider', onAnnounce);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
  });
}

type PersistLike = { hasHydrated?: () => boolean };

function isHydrated(config: unknown): boolean {
  const persist = (config as { _internal?: { store?: { persist?: PersistLike } } })._internal?.store
    ?.persist;
  return persist?.hasHydrated ? persist.hasHydrated() : true;
}

/**
 * Restores an authorized MetaMask (injected) connection on page load.
 *
 * Two independent reasons make the native path useless here: the Privy wagmi wrapper
 * builds its config with multiInjectedProviderDiscovery off and strips non-mock
 * connectors, and createConfig overwrites the persisted wagmi store with an empty
 * state before any effect (see lib/web3/session-hint.ts) — so neither a connector nor
 * a persisted connection survives the load. The first-party wallet-link marker is the
 * durable signal; this component rebuilds the injected connector and reconnects.
 * Only runs when that marker says MetaMask, only after wagmi has hydrated its own
 * state, and reconnect() re-checks isAuthorized() first, so an unauthorized or locked
 * wallet is never prompted (page-load restore of an authorized session, §7).
 */
export function InjectedSessionRestore() {
  const config = useConfig();
  const { ready } = usePrivy();
  const { status } = useAccount();
  const { reconnectAsync } = useReconnect();
  const attempted = useRef(false);
  // Read through a ref: `status` changes while the restore is in flight (our own
  // reconnect flips it), and a dep-list entry would cancel the very work it watches.
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    if (!ready || attempted.current) return;
    if (readWalletLink() !== 'metamask') return;
    attempted.current = true;
    let cancelled = false;

    void (async () => {
      // Wait for wagmi's own hydration/reconnect to settle. 'reconnecting' here is
      // that no-op mount reconnect (this config has no connectors), not another
      // restore path; only 'connected' (Privy already restored) means skip.
      for (let wait = 0; wait < 20 && !isHydrated(config) && !cancelled; wait += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 50));
      }
      if (cancelled || isDisconnecting()) return;
      if (statusRef.current === 'connected') return;

      const provider = await discoverMetaMask(DISCOVERY_MS);
      if (!provider || cancelled || isDisconnecting()) return;

      const connector = injected({
        target: { id: METAMASK_ID, name: 'MetaMask', provider: provider as never },
      });
      for (let attempt = 0; attempt < RETRIES && !cancelled; attempt += 1) {
        // An explicit Disconnect during the retry window must win; the loop is not
        // tied to component unmount, so cancelled alone never fires here.
        if (isDisconnecting()) return;
        try {
          // Empty result: wagmi's guard swallowed the call or the wallet is not
          // authorized yet — retry briefly, then leave the header on Login.
          const connections = await reconnectAsync({ connectors: [connector] });
          if (connections.length > 0) return;
        } catch {
          // No authorized session to restore.
        }
        await new Promise((resolve) => window.setTimeout(resolve, RETRY_MS));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, config]);

  return null;
}

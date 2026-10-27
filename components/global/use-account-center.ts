'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useBytecode, useSwitchChain } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';

import { CHAIN_IDS, getClientChainConfig } from '@/lib/web3/chains';
import {
  advanceAccount,
  detectCodeCapability,
  resolveWriteCapability,
  type AccountEvent,
  type AccountState,
  type ProviderCapability,
  type WriteCapabilityResolution,
} from '@/lib/web3/account';
import { setActiveEip1193Provider, type Eip1193ProviderLike } from '@/lib/web3/active-provider';
import { readWalletLink, rememberWalletLink } from '@/lib/web3/session-hint';
import { rememberLastLogin } from '@/lib/web3/login-identity';

import { useHarnessWallet } from './web3-harness';
import { openWalletSelector } from './wallet-selector-dialog';

// NEXT_PUBLIC_ mirror is the client-inlinable projection; the server var covers SSR.
const ONCHAIN_BUILD =
  process.env.NEXT_PUBLIC_OUTRUN_DATA_SOURCE !== 'fixture' &&
  process.env.OUTRUN_DATA_SOURCE !== 'fixture';

const CAPABLE_PROVIDER: ProviderCapability = { canSignAuthorization: true, canSendType4: true };
const LIMITED_PROVIDER: ProviderCapability = { canSignAuthorization: false, canSendType4: false };

export type AccountCenter = {
  source: 'real' | 'harness';
  connected: boolean;
  address: string | null;
  /** Wallet chain id (view chain stays independent, §5). */
  chainId: number | null;
  /** False for off-chainset networks (AC-2: writes disabled + switch guidance, never a popup). */
  chainSupported: boolean;
  accountState: AccountState;
  write: WriteCapabilityResolution;
  /** True after the provider refused an authorization/type-4 RPC (per-brand fallback, §16). */
  providerLimited: boolean;
  reportProviderLimitation: () => void;
  dispatchAccount: (event: AccountEvent) => void;
  /** Harness-only connect toggle (e2e click path; onchain builds open the selector instead). */
  toggleHarness: (() => void) | null;
  /** Harness-only chain switch (e2e chain dialog path). */
  switchHarnessChain: ((chainId: number) => void) | null;
  /** Connect entry point for every CTA: selector onchain, harness toggle otherwise. */
  connectAction: () => void;
  /**
   * Wallet chain switch (user-confirmed click; rejections keep the current chain).
   * Resolves true on success, false on failure — callers write URL state only on true.
   */
  switchChainAction: (chainId: number) => Promise<boolean>;
  /** Last wallet chain-switch failure (null when idle/success); selector surfaces it. */
  switchChainError: string | null;
  clearSwitchChainError: () => void;
  /** True while a stored session may still land as a connection: Privy authenticated
   * but the wallet link (setActiveWallet retries) has not reached wagmi yet, wagmi
   * auto-reconnecting an injected wallet, an OAuth landing whose `?privy_oauth_*`
   * callback Privy has not consumed yet, or the MetaMask path waiting for its
   * persisted wagmi connection to reconnect (no Privy auth there at all). The wallet
   * button keeps its placeholder through this window — releasing at Privy `ready`
   * alone flashes Login between the skeleton and the restored label. Bounded by the
   * 7s link budget; false in the harness. */
  sessionRestoring: boolean;
};

/** True while the URL still carries Privy OAuth callback params (`?privy_oauth_*`):
 * the SDK flips `ready` before consuming them, so in that gap `authenticated` is
 * still false and the button would drop to Login for a beat before the skeleton
 * resumes (OAuth-return flash). */
export function isPrivyOAuthLanding(search: string): boolean {
  if (!search) return false;
  for (const key of new URLSearchParams(search).keys()) {
    if (key.startsWith('privy_oauth')) return true;
  }
  return false;
}

export type SessionRestoreSignals = {
  authenticated: boolean;
  isConnected: boolean;
  status: string;
  oauthLanding: boolean;
  /** First-party wallet-link marker survives refresh (MetaMask path: plain wagmi,
   * no Privy auth, so `authenticated` stays false). */
  storedSession: boolean;
  /** The 7s restore budget has elapsed (setActiveWallet retries 12 × 500ms). */
  restoreWindowClosed: boolean;
};

/**
 * Whether the wallet button must keep its placeholder instead of releasing it.
 *
 * Privy boot is covered by `!ready`. Two restore windows remain: the wallet link
 * after Privy auth (setActiveWallet retries, or wagmi reconnecting an injected
 * wallet), and the MetaMask path, which has no Privy auth — its persisted wagmi
 * connection is restored asynchronously after hydration, so `storedSession` holds
 * the skeleton until it lands. A visitor with neither releases immediately; the 7s
 * link budget caps every window so a wedged restore degrades to the Login button.
 */
export function resolveSessionRestoring(signals: SessionRestoreSignals): boolean {
  if (signals.isConnected || signals.restoreWindowClosed) return false;
  return (
    signals.authenticated ||
    signals.status === 'reconnecting' ||
    signals.oauthLanding ||
    signals.storedSession
  );
}

function useRealAccountCenter(): AccountCenter {
  const { address, chainId: walletChainId, connector, isConnected, status } = useAccount();
  const { authenticated } = usePrivy();
  const { switchChainAsync } = useSwitchChain();
  const { data: code } = useBytecode({
    address,
    chainId: walletChainId,
    query: { enabled: isConnected && !!address },
  });
  const [accountState, setAccountState] = useState<AccountState>('Disconnected');
  const [providerLimited, setProviderLimited] = useState(false);
  // Restore-window deadline: the link effect retries setActiveWallet every 500ms up
  // to 12 tries (login-session-restore.ts), so 7s covers the full retry budget plus
  // slack. Past it, a session that never lands degrades to the Login button instead
  // of holding the skeleton forever.
  const [restoreWindowClosed, setRestoreWindowClosed] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setRestoreWindowClosed(true), 7000);
    return () => window.clearTimeout(timer);
  }, []);
  // Captured once at first client render: after the callback lands, Privy strips
  // the params and the (authenticated && !isConnected) disjunct carries the window.
  const [oauthLanding] = useState(() =>
    typeof window === 'undefined' ? false : isPrivyOAuthLanding(window.location.search),
  );
  // Read live (not captured): Privy clears its credentials and Disconnect clears the
  // badge synchronously, so an intentional logout cannot keep the skeleton up.
  const sessionRestoring = resolveSessionRestoring({
    authenticated,
    isConnected,
    status,
    oauthLanding,
    storedSession: readWalletLink() !== null,
    restoreWindowClosed,
  });

  // Account propagation to the server: the onchain adapter's account-scoped reads (wallet
  // balances, faucet my-balances, referral) follow this cookie; router.refresh() re-renders
  // the RSC data so the connected wallet's values replace the accountless view.
  const router = useRouter();
  useEffect(() => {
    const cookieName = 'outrun_account=';
    const current =
      document.cookie
        .split(/;\s*/)
        .find((entry) => entry.startsWith(cookieName))
        ?.slice(cookieName.length) ?? '';
    if (current === (address ?? '')) return;
    if (address) {
      document.cookie = `${cookieName}${address}; path=/; samesite=lax`;
    } else {
      document.cookie = `${cookieName}; path=/; max-age=0; samesite=lax`;
    }
    router.refresh();
  }, [address, router]);

  const dispatchAccount = useCallback((event: AccountEvent) => {
    setAccountState((state) => advanceAccount(state, event));
  }, []);

  const connectAction = useCallback(() => openWalletSelector(), []);
  // Wallet chain switch: resolves true on success, false on failure (user refusal,
  // unconfigured chain). Callers write URL state only on true; failures surface as
  // switchChainError with retry copy. Rejections keep the current chain.
  const [switchChainError, setSwitchChainError] = useState<string | null>(null);
  const clearSwitchChainError = useCallback(() => setSwitchChainError(null), []);
  const switchChainAction = useCallback(
    async (chainId: number): Promise<boolean> => {
      try {
        await switchChainAsync({ chainId });
        setSwitchChainError(null);
        return true;
      } catch {
        setSwitchChainError('switch-failed');
        return false;
      }
    },
    [switchChainAsync],
  );

  // Back the provider registry from the active connector (drives capability reads).
  useEffect(() => {
    let cancelled = false;
    if (!connector) {
      setActiveEip1193Provider(null);
      return;
    }
    connector
      .getProvider()
      .then((provider) => {
        if (cancelled) return;
        setActiveEip1193Provider(
          provider !== null &&
            typeof provider === 'object' &&
            typeof (provider as { request?: unknown }).request === 'function'
            ? (provider as Eip1193ProviderLike)
            : null,
        );
      })
      .catch(() => {
        if (!cancelled) setActiveEip1193Provider(null);
      });
    return () => {
      cancelled = true;
    };
  }, [connector]);

  // Record the injected link as soon as it is live. wagmi's persisted connection is
  // wiped at config creation (see lib/web3/session-hint.ts), so this marker is what
  // the next load restores from; it also pins the identity label to the address.
  useEffect(() => {
    if (!isConnected || !address || connector?.id !== 'io.metamask') return;
    rememberWalletLink('metamask');
    rememberLastLogin('metamask');
  }, [isConnected, address, connector]);

  const wasConnected = useRef(false);
  useEffect(() => {
    if (isConnected && !wasConnected.current) {
      wasConnected.current = true;
      setProviderLimited(false);
      dispatchAccount({ type: 'connect' });
    } else if (!isConnected && wasConnected.current) {
      wasConnected.current = false;
      setProviderLimited(false);
      dispatchAccount({ type: 'disconnect' });
    }
  }, [isConnected, dispatchAccount]);

  const seenChain = useRef<number | null>(null);
  useEffect(() => {
    if (!isConnected || walletChainId === undefined) return;
    if (seenChain.current === null) {
      seenChain.current = walletChainId;
      return;
    }
    if (seenChain.current !== walletChainId) {
      seenChain.current = walletChainId;
      setProviderLimited(false);
      dispatchAccount({ type: 'chain-changed' });
    }
  }, [isConnected, walletChainId, dispatchAccount]);

  useEffect(() => {
    if (!isConnected || code === undefined || walletChainId === undefined) return;
    const manifest = getClientChainConfig(walletChainId);
    const implementation =
      manifest.status === 'ok' ? manifest.config.kernel7702Implementation : '';
    dispatchAccount({
      type: 'delegation-observed',
      supported: detectCodeCapability(code, implementation) === 'kernel-delegated',
    });
  }, [isConnected, code, walletChainId, dispatchAccount]);

  const chainSupported =
    walletChainId !== undefined && (CHAIN_IDS as readonly number[]).includes(walletChainId);
  const resolved = walletChainId !== undefined ? getClientChainConfig(walletChainId) : null;
  const manifestImplementation =
    resolved !== null && resolved.status === 'ok' ? resolved.config.kernel7702Implementation : '';
  const capability = detectCodeCapability(code ?? '0x', manifestImplementation);
  const write = chainSupported
    ? resolveWriteCapability(capability, providerLimited ? LIMITED_PROVIDER : CAPABLE_PROVIDER)
    : { capability: 'blocked-readonly' as const, upgradeHint: false };

  return {
    source: 'real',
    connected: isConnected && !!address,
    address: address ?? null,
    chainId: walletChainId ?? null,
    chainSupported,
    accountState,
    write,
    providerLimited,
    reportProviderLimitation: () => setProviderLimited(true),
    dispatchAccount,
    toggleHarness: null,
    switchHarnessChain: null,
    connectAction,
    switchChainAction,
    switchChainError,
    clearSwitchChainError,
    sessionRestoring,
  };
}

function useHarnessAccountCenter(): AccountCenter {
  const harness = useHarnessWallet();
  const dispatchAccount = useCallback(() => undefined, []);
  const switchChainAction = useCallback(
    async (chainId: number): Promise<boolean> => {
      harness.switchChain(chainId);
      return true;
    },
    [harness],
  );
  const clearSwitchChainError = useCallback(() => undefined, []);
  return {
    source: 'harness',
    connected: harness.connected,
    address: null,
    chainId: harness.chainId,
    chainSupported: true,
    accountState: harness.connected ? 'Connected EOA' : 'Disconnected',
    write: harness.connected
      ? { capability: 'needs-delegation', upgradeHint: false }
      : { capability: 'blocked-readonly', upgradeHint: false },
    providerLimited: false,
    reportProviderLimitation: () => undefined,
    dispatchAccount,
    toggleHarness: harness.toggle,
    switchHarnessChain: harness.switchChain,
    connectAction: harness.toggle,
    switchChainAction,
    switchChainError: null,
    clearSwitchChainError,
    sessionRestoring: false,
  };
}

const useAccountCenterImpl = ONCHAIN_BUILD ? useRealAccountCenter : useHarnessAccountCenter;

/** Unified account view: real hooks on onchain builds, the test harness otherwise. */
export function useAccountCenter(): AccountCenter {
  return useAccountCenterImpl();
}

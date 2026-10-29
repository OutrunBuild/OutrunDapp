// @vitest-environment jsdom
import { createElement, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';

import { AccountCenterProvider } from '../../../components/global/account-center-provider';
import {
  useAccountCenter,
  type AccountCenter,
} from '../../../components/global/use-account-center';
import {
  setActiveEip1193Provider,
  type Eip1193ProviderLike,
} from '../../../lib/web3/active-provider';

// Controllable wagmi state for the connected effect under test. Only the fields
// the account center reads are exposed; the connector stub carries getProvider
// because the provider-registry effect consumes it on every connect.
const wagmiState = vi.hoisted(() => {
  // Stable connector identity: the registry effect keys on `connector`, so a fresh
  // literal per render would re-run it (getProvider → null) and clobber a provider
  // a deadline test injected into the registry.
  const connectors = new Map<string, { id: string; getProvider: () => Promise<null> }>();
  return {
    address: undefined as string | undefined,
    chainId: undefined as number | undefined,
    connectorId: undefined as string | undefined,
    isConnected: false,
    status: 'disconnected' as string,
    connectorFor: (id: string) => {
      let connector = connectors.get(id);
      if (!connector) {
        connector = { id, getProvider: async () => null };
        connectors.set(id, connector);
      }
      return connector;
    },
  };
});

// Controllable wagmi switch seam: the deadline race under test wraps switchChainAsync,
// so each test swaps the settle behavior (never / resolve / reject / late reject).
const switchControl = vi.hoisted(() => ({
  impl: (_chainId: number) => Promise.resolve(undefined) as Promise<unknown>,
}));

vi.mock('@/lib/data/source-flag', () => ({ ONCHAIN_BUILD: true }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('wagmi', () => ({
  useAccount: () => ({
    address: wagmiState.address,
    chainId: wagmiState.chainId,
    connector: wagmiState.connectorId ? wagmiState.connectorFor(wagmiState.connectorId) : undefined,
    isConnected: wagmiState.isConnected,
    status: wagmiState.status,
  }),
  useBytecode: () => ({ data: undefined }),
  useSwitchChain: () => ({
    switchChainAsync: (args: { chainId: number }) => switchControl.impl(args.chainId),
  }),
}));
vi.mock('@privy-io/react-auth', () => ({ usePrivy: () => ({ authenticated: false }) }));
vi.mock('@/components/global/web3-harness', () => ({ useHarnessWallet: () => ({}) }));
vi.mock('@/components/global/wallet-selector-dialog', () => ({
  openWalletSelector: vi.fn(),
}));

const WALLET_LINK_KEY = 'outrun:wallet-link';
const LAST_LOGIN_KEY = 'outrun:last-login';
const ADDRESS = '0x1234abcd5678ef9012345678ef9012345678ef90';

function Probe(): null {
  useAccountCenter();
  return null;
}

/** Real-hook mounts go through the shell provider: useAccountCenter is context-backed. */
function withProvider(node: ReactElement) {
  return createElement(AccountCenterProvider, null, node);
}

function connectMetamask(): void {
  wagmiState.address = ADDRESS;
  wagmiState.chainId = 97;
  wagmiState.connectorId = 'io.metamask';
  wagmiState.isConnected = true;
  wagmiState.status = 'connected';
}

beforeEach(() => {
  wagmiState.address = undefined;
  wagmiState.chainId = undefined;
  wagmiState.connectorId = undefined;
  wagmiState.isConnected = false;
  wagmiState.status = 'disconnected';
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('useAccountCenter injected-link persistence effect', () => {
  it('records the link and last-used badge once a MetaMask connection is live', () => {
    connectMetamask();
    render(withProvider(createElement(Probe)));
    expect(window.localStorage.getItem(WALLET_LINK_KEY)).toBe('metamask');
    expect(window.localStorage.getItem(LAST_LOGIN_KEY)).toBe('metamask');
  });

  it('does not record for a non-MetaMask connector', () => {
    connectMetamask();
    wagmiState.connectorId = 'io.privy';
    render(withProvider(createElement(Probe)));
    expect(window.localStorage.getItem(WALLET_LINK_KEY)).toBeNull();
    expect(window.localStorage.getItem(LAST_LOGIN_KEY)).toBeNull();
  });

  it('leaves an existing marker untouched when the connection drops', () => {
    connectMetamask();
    const { rerender } = render(withProvider(createElement(Probe)));
    expect(window.localStorage.getItem(WALLET_LINK_KEY)).toBe('metamask');
    wagmiState.address = undefined;
    wagmiState.connectorId = undefined;
    wagmiState.isConnected = false;
    wagmiState.status = 'disconnected';
    rerender(withProvider(createElement(Probe)));
    // Involuntary disconnects must not clear: only the explicit-exit call
    // sites (account-menu leave, OAuth link flows) own forgetWalletLink.
    expect(window.localStorage.getItem(WALLET_LINK_KEY)).toBe('metamask');
    expect(window.localStorage.getItem(LAST_LOGIN_KEY)).toBe('metamask');
  });
});

// Captures the live hook value so tests drive the real switchChainAction, not a mock.
let latest: AccountCenter | undefined;
function Capture(): null {
  latest = useAccountCenter();
  return null;
}

/** EIP-1193 fake whose eth_chainId readback is the deadline's classification source. */
function providerReportingChain(chainId: number | null): Eip1193ProviderLike {
  return {
    request: async ({ method }) => {
      if (method !== 'eth_chainId') throw new Error(`unexpected ${method}`);
      if (chainId === null) throw new Error('readback refused');
      return `0x${chainId.toString(16)}`;
    },
  };
}

describe('useAccountCenter switchChainAction deadline race', () => {
  const DEADLINE_MS = 15_000;

  beforeEach(() => {
    switchControl.impl = (_chainId: number) => Promise.resolve(undefined);
    setActiveEip1193Provider(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    setActiveEip1193Provider(null);
  });

  it('resolves true when the deadline readback confirms the target chain', async () => {
    vi.useFakeTimers();
    connectMetamask();
    render(withProvider(createElement(Capture)));
    await act(async () => {}); // flush the provider-registry effect before injecting
    setActiveEip1193Provider(providerReportingChain(84532));
    switchControl.impl = () => new Promise(() => {}); // the connector never settles
    let outcome: boolean | undefined;
    await act(async () => {
      const settled = latest!.switchChainAction(84532).then((value) => {
        outcome = value;
      });
      await vi.advanceTimersByTimeAsync(DEADLINE_MS);
      await settled;
    });
    expect(outcome).toBe(true);
    expect(latest!.switchChainError).toBeNull();
    // The deadline timer fired; nothing may leak past the finally-cleanup.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('resolves false with switch-failed when the deadline readback sees another chain', async () => {
    vi.useFakeTimers();
    connectMetamask();
    render(withProvider(createElement(Capture)));
    await act(async () => {});
    setActiveEip1193Provider(providerReportingChain(97)); // the wallet never moved
    switchControl.impl = () => new Promise(() => {});
    let outcome: boolean | undefined;
    await act(async () => {
      const settled = latest!.switchChainAction(84532).then((value) => {
        outcome = value;
      });
      await vi.advanceTimersByTimeAsync(DEADLINE_MS);
      await settled;
    });
    expect(outcome).toBe(false);
    expect(latest!.switchChainError).toBe('switch-failed');
  });

  it('treats an unreadable readback as a failure, not a success', async () => {
    vi.useFakeTimers();
    connectMetamask();
    render(withProvider(createElement(Capture)));
    await act(async () => {});
    setActiveEip1193Provider(providerReportingChain(null));
    switchControl.impl = () => new Promise(() => {});
    let outcome: boolean | undefined;
    await act(async () => {
      const settled = latest!.switchChainAction(84532).then((value) => {
        outcome = value;
      });
      await vi.advanceTimersByTimeAsync(DEADLINE_MS);
      await settled;
    });
    expect(outcome).toBe(false);
    expect(latest!.switchChainError).toBe('switch-failed');
  });

  it('clears the deadline timer when the switch settles on its own', async () => {
    vi.useFakeTimers();
    connectMetamask();
    render(withProvider(createElement(Capture)));
    await act(async () => {});
    const pendingBefore = vi.getTimerCount(); // the 7s restore-window timer
    expect(pendingBefore).toBeGreaterThan(0);
    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await latest!.switchChainAction(84532);
    });
    expect(outcome).toBe(true);
    expect(latest!.switchChainError).toBeNull();
    // Delta assertion: the switch may only leave the pre-existing timers behind.
    expect(vi.getTimerCount()).toBe(pendingBefore);
  });

  it('maps an immediate rejection to false with switch-failed', async () => {
    vi.useFakeTimers();
    connectMetamask();
    render(withProvider(createElement(Capture)));
    await act(async () => {});
    switchControl.impl = () => Promise.reject(new Error('user refused'));
    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await latest!.switchChainAction(84532);
    });
    expect(outcome).toBe(false);
    expect(latest!.switchChainError).toBe('switch-failed');
  });

  it('keeps a late rejection handled after the deadline already settled', async () => {
    vi.useFakeTimers();
    connectMetamask();
    render(withProvider(createElement(Capture)));
    await act(async () => {});
    setActiveEip1193Provider(providerReportingChain(84532));
    switchControl.impl = () =>
      new Promise((_resolve, reject) => {
        setTimeout(() => reject(new Error('late wallet answer')), DEADLINE_MS + 1_000);
      });
    let outcome: boolean | undefined;
    await act(async () => {
      const settled = latest!.switchChainAction(84532).then((value) => {
        outcome = value;
      });
      await vi.advanceTimersByTimeAsync(DEADLINE_MS); // the deadline classifies via readback
      await settled;
      await vi.advanceTimersByTimeAsync(1_000); // the late rejection fires; the race keeps it handled
    });
    expect(outcome).toBe(true);
  });
});

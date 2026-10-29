// @vitest-environment jsdom
// FaucetClaims probe-failure degrade branches (component level): the degraded cooldown slot
// + retry render only when a probe failed AND no value ever landed; a retry after the
// provider recovers falls back to the normal slot; and a failed re-probe never overwrites a
// landed value — the flag must stay invisible while a value exists ("Unreadable row keeps
// its previous value").
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { Faucet, Locale } from '../../lib/data/fixture-repository';
import { FaucetClaims } from '../../components/faucet/faucet-claims';

const EOA = '0x00000000000000000000000000000000000000cc';
const ZERO_SLOT = '0x0000000000000000000000000000000000000000000000000000000000000000';

const state = vi.hoisted(() => ({
  storageFails: false,
  lastClaimedSec: 0n,
  probeReads: 0,
  tx: {
    active: false,
    display: 'idle' as string,
    reviewing: false,
    running: false,
    context: { txHash: null, review: null, errorKind: undefined as string | undefined },
    reset: () => undefined,
    executeDirect: vi.fn(),
  },
}));

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>();
  return {
    ...actual,
    // FaucetClaims probes lastClaimed via client.getStorageAt (pure storage reads, no
    // wallet simulation). The mounted swap dialog's readContract reads are irrelevant here
    // and fail into its own silent degrade.
    createPublicClient: (() => ({
      getStorageAt: async () => {
        state.probeReads += 1;
        if (state.storageFails) throw new Error('storage read failed');
        return state.lastClaimedSec === 0n ? ZERO_SLOT : `0x${state.lastClaimedSec.toString(16)}`;
      },
    })) as unknown as typeof actual.createPublicClient,
  };
});

vi.mock('@/components/global/use-account-center', () => ({
  useAccountCenter: () => ({
    source: 'real',
    connected: true,
    address: EOA,
    chainId: 97,
    chainSupported: true,
    connectAction: () => undefined,
  }),
}));

vi.mock('@/components/global/use-tx-center', () => ({
  useTxCenter: () => state.tx,
  useClearOnConfirmed: () => undefined,
}));

vi.mock('@/components/global/use-psm-swap', () => ({
  usePsmSwap: () => ({
    center: { source: 'real', connected: true, address: EOA, chainId: 97, chainSupported: true },
    connected: true,
    toggle: () => undefined,
    tx: state.tx,
    executionReady: true,
    start: vi.fn(),
    resolving: false,
    resolveFailed: false,
    walletUnsupported: false,
    executionFailed: false,
  }),
}));

vi.mock('@/lib/web3/active-provider', () => ({
  getActiveEip1193Provider: () => ({ request: async () => undefined }),
  useActiveEip1193Provider: () => null,
}));

vi.mock('@/components/global/use-tx-success', () => ({
  useTxSuccessGate: () => ({ successOpen: false, setSuccessOpen: () => undefined, receipt: null }),
}));

const FAUCET: Faucet = {
  chainId: 97,
  chainName: 'BSC Testnet',
  tokens: [
    { symbol: 'USDC', name: 'Mock USDC', dailyLimit: 1_000_000, cooldownRemainingMs: null },
    { symbol: 'sUSDS', name: 'Mock sUSDS', dailyLimit: 1_000_000, cooldownRemainingMs: null },
    { symbol: 'aUSDC', name: 'Mock aUSDC', dailyLimit: 1_000_000, cooldownRemainingMs: null },
  ],
  swap: {
    uAssetSymbol: 'UUSD',
    reserveSymbol: 'USDC',
    feeIn: 0.001,
    feeOut: 0.001,
    feeInWad: '1000000000000000',
    feeOutWad: '1000000000000000',
    headroom: 999,
    myUAsset: 50,
    myReserve: 120,
  },
};

function renderClaims() {
  render(createElement(FaucetClaims, { locale: 'en' as Locale, faucet: FAUCET }));
}

const degradeRows = () => screen.getAllByText('Failed to read claim status.');
const retryButton = () => screen.getAllByRole('button', { name: 'Retry' })[0]!;
const claimButtons = () => screen.getAllByRole('button', { name: 'Claim' }) as HTMLButtonElement[];

beforeEach(() => {
  state.storageFails = false;
  state.lastClaimedSec = 0n;
  state.probeReads = 0;
});

afterEach(() => {
  cleanup();
});

describe('FaucetClaims probe-failure degrade', () => {
  it('a failed first probe renders the degraded slot with retry and keeps Claim disabled', async () => {
    state.storageFails = true;
    renderClaims();

    // The probe must actually reach the storage read (not the missing-address shortcut).
    await waitFor(() => expect(state.probeReads).toBeGreaterThan(0));
    await waitFor(() => expect(degradeRows()).toHaveLength(3));
    expect(retryButton()).toBeDefined();
    for (const claim of claimButtons()) expect(claim.disabled).toBe(true);
  });

  it('retry after the provider recovers falls back to the normal slot', async () => {
    state.storageFails = true;
    renderClaims();
    await waitFor(() => expect(degradeRows()).toHaveLength(3));

    state.storageFails = false;
    fireEvent.click(retryButton());
    // The retried symbol falls back to the never-claimed Ready slot; the untouched rows
    // stay degraded.
    await waitFor(() => expect(screen.getByText('Ready')).toBeDefined());
    expect(degradeRows()).toHaveLength(2);
  });

  it('a failed re-probe never overwrites a landed value (flag stays invisible)', async () => {
    renderClaims(); // never claimed → every row lands on the Ready slot
    await waitFor(() => expect(screen.getAllByText('Ready')).toHaveLength(3));

    state.storageFails = true;
    fireEvent.click(claimButtons()[0]!);
    // The post-claim re-probe fails: the row keeps its landed value and the degrade flag
    // must not surface over it.
    await waitFor(() => expect(state.probeReads).toBeGreaterThan(3));
    expect(screen.getAllByText('Ready')).toHaveLength(3);
    expect(screen.queryByText('Failed to read claim status.')).toBeNull();
  });
});

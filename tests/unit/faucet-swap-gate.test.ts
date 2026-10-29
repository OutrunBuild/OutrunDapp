// @vitest-environment jsdom
// Faucet Get-UUSD submit gate wiring: the CTA must refuse an over-balance amount (the shared
// evaluateAmountBalance predicate) and a mint whose fee-net uAsset output exceeds the
// EXECUTION chain's stockCap headroom (read from the wallet chain's PSM, never borrowed from
// the faucet config chain's SSR number).
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { Faucet, Locale } from '../../lib/data/fixture-repository';
import { FaucetSwapDialog } from '../../components/faucet/faucet-swap-dialog';

const E18 = 10n ** 18n;
const UASSET = '0x00000000000000000000000000000000000000aa';
const RESERVE = '0x00000000000000000000000000000000000000bb';
const EOA = '0x00000000000000000000000000000000000000cc';

const state = vi.hoisted(() => ({
  stockCap: 1000n * 10n ** 18n,
  netMinted: 0n,
  reserveBalance: 120_000_000n, // 120 USDC (6 decimals)
  reserveReads: 0,
  reserveFailed: false,
  start: vi.fn(),
  tx: {
    active: false,
    display: 'idle' as string,
    reviewing: false,
    running: false,
    context: { txHash: null, review: null },
    reset: () => undefined,
  },
}));

type ReadParams = { address?: string; functionName: string; args?: readonly unknown[] };

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>();
  const readContract = async ({ address, functionName }: ReadParams): Promise<unknown> => {
    switch (functionName) {
      case 'uAsset':
        return UASSET;
      case 'reserveToken':
        return RESERVE;
      case 'stockCap':
        return state.stockCap;
      case 'netUAssetMinted':
        return state.netMinted;
      case 'decimals':
        return address === RESERVE ? 6 : 18;
      case 'balanceOf':
        if (address === RESERVE) {
          state.reserveReads += 1;
          if (state.reserveFailed) throw new Error('balance read failed');
          return state.reserveBalance;
        }
        return 50n * E18;
      default:
        throw new Error(`unexpected read ${functionName}`);
    }
  };
  return {
    ...actual,
    createPublicClient: (() => ({ readContract })) as unknown as typeof actual.createPublicClient,
  };
});

vi.mock('@/components/global/use-psm-swap', () => ({
  usePsmSwap: () => ({
    center: { source: 'real', connected: true, address: EOA, chainId: 97, chainSupported: true },
    connected: true,
    toggle: () => undefined,
    tx: state.tx,
    executionReady: true,
    start: state.start,
    resolving: false,
    resolveFailed: false,
    walletUnsupported: false,
    executionFailed: false,
  }),
}));

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

vi.mock('@/lib/web3/active-provider', () => ({
  getActiveEip1193Provider: () => ({ request: async () => undefined }),
  useActiveEip1193Provider: () => null,
}));

// 0.1% tin/tout wads: the cap gate compares the fee-net mint output with the headroom.
const SWAP: Faucet['swap'] = {
  uAssetSymbol: 'UUSD',
  reserveSymbol: 'USDC',
  feeIn: 0.001,
  feeOut: 0.001,
  feeInWad: '1000000000000000',
  feeOutWad: '1000000000000000',
  // Display-only SSR sample deliberately different from the chain headroom in the cap test:
  // a gate that borrowed this number would let the 2 USDC mint through.
  headroom: 999,
  myUAsset: 50,
  myReserve: 120,
};

function openDialog() {
  render(createElement(FaucetSwapDialog, { locale: 'en' as Locale, swap: SWAP }));
  fireEvent.click(screen.getByText('Get UUSD'));
  const input = screen.getByLabelText('Amount (USDC)');
  const cta = () => document.querySelector<HTMLButtonElement>('.swap-panel__cta');
  return { input, cta };
}

beforeEach(() => {
  state.stockCap = 1000n * E18;
  state.netMinted = 0n;
  state.reserveBalance = 120_000_000n;
  state.reserveReads = 0;
  state.reserveFailed = false;
});

afterEach(() => {
  cleanup();
});

describe('FaucetSwapDialog mint cap gate', () => {
  it('blocks a mint whose fee-net output exceeds the execution-chain headroom', async () => {
    state.stockCap = 2n * E18;
    state.netMinted = 1n * E18; // 1 UUSD headroom
    const { input, cta } = openDialog();

    fireEvent.change(input, { target: { value: '1' } });
    await waitFor(() => expect(cta()?.disabled).toBe(false)); // 1 × (1−tin) = 0.999 ≤ 1

    fireEvent.change(input, { target: { value: '2' } });
    await waitFor(() => expect(cta()?.disabled).toBe(true)); // 2 × (1−tin) = 1.998 > 1
  });

  it('keeps a plentitude of headroom from masking the over-balance gate', async () => {
    state.stockCap = 1000n * E18;
    state.netMinted = 0n;
    const { input, cta } = openDialog();

    fireEvent.change(input, { target: { value: '1' } });
    await waitFor(() => expect(cta()?.disabled).toBe(false));

    fireEvent.change(input, { target: { value: '121' } }); // balance is 120 USDC
    await waitFor(() => expect(cta()?.disabled).toBe(true));
  });

  it('keeps the CTA disabled while the execution-chain balance is unknown', async () => {
    state.reserveFailed = true;
    const { input, cta } = openDialog();

    fireEvent.change(input, { target: { value: '1' } });
    await waitFor(() => expect(state.reserveReads).toBeGreaterThan(0));
    // The balance read rejected; nothing unread may arm the wallet write.
    await waitFor(() => expect(cta()?.disabled).toBe(true));
  });

  it('keeps a sub-unit dust amount from arming the CTA', async () => {
    const { input, cta } = openDialog();

    // 0.0000001 USDC parses to 0n base units (6 decimals): it passes the float-validity
    // half and the balance gate, and must still not arm the wallet write.
    fireEvent.change(input, { target: { value: '0.0000001' } });
    await waitFor(() => expect(state.reserveReads).toBeGreaterThan(0));
    await waitFor(() => expect(cta()?.disabled).toBe(true));
  });
});

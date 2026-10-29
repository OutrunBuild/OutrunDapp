// @vitest-environment jsdom
// SwapPanel sell-leg balance gate wiring: the CTA must fail closed while the wallet balance
// probe has not landed (in flight or retries exhausted) — the shared evaluateAmountBalance
// predicate's balanceUnknown leg — and arm only against a landed balance.
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { Locale } from '../../lib/data/fixture-repository';
import { SwapPanel } from '../../components/verse/swap-panel';
import type { VerseBalances } from '../../components/verse/trade-balances';

const EOA = '0x000000000000000000000000000000000000000cc';
const E18 = 10n ** 18n;

const state = vi.hoisted(() => ({
  // null = probe not landed (in flight or retries exhausted) — every sell-leg slot reads '--'
  balances: null as unknown,
  // The quote hook echoes the typed amount so liveUsable holds and the CTA chain runs past
  // its quotePending branch.
  amount: '',
  tx: {
    active: false,
    display: 'idle' as string,
    reviewing: false,
    running: false,
    context: { txHash: null, review: null },
    reset: () => undefined,
  },
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

// The SwapPanel tree reaches Privy's useWallets through the unmocked modules it keeps
// (gas quote etc.); without a provider the real hook warns on every call. Return the
// provider-less shape it degrades to (empty wallet list) so no other privy export
// changes behavior.
vi.mock('@privy-io/react-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@privy-io/react-auth')>();
  return { ...actual, useWallets: () => ({ wallets: [] }) };
});

vi.mock('next/navigation', () => ({
  useParams: () => ({ verseId: '1' }),
}));

vi.mock('../../components/verse/trade-balances', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../components/verse/trade-balances')>();
  return { ...actual, useTradeBalances: () => state.balances as VerseBalances | null };
});

vi.mock('../../components/verse/swap-live-quote', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../components/verse/swap-live-quote')>();
  return {
    ...actual,
    useSwapLiveQuote: () => ({
      ready: state.amount !== '',
      loading: false,
      failed: false,
      value:
        state.amount === ''
          ? null
          : {
              // 1 UUSD in buys 0.01 MEME at the same spot the impact row measures against,
              // so impact reads 0 and the CTA chain reaches its armed terminal branch.
              feeBps: 0n,
              spotOutPerIn: 0.01,
              decimalsIn: 18,
              decimalsOut: 18,
              cardDecimalsIn: 18,
              cardDecimalsOut: 18,
              amount: state.amount,
              key: 'test',
              at: Date.now(),
              out: 10n ** 16n,
            },
    }),
  };
});

vi.mock('@/components/global/switch-chain-cta', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/global/switch-chain-cta')>();
  return {
    ...actual,
    useVerseExecChain: () => ({ execChain: 97, wrongChain: false, switchChain: () => undefined }),
  };
});

// The probe's landed shape for the uAsset sell leg (default direction): exact read 100 UUSD.
const LANDED: VerseBalances = {
  memecoin: 0,
  uAsset: 100,
  pol: 0,
  pt: 0,
  yt: 0,
  lp: { main: null, 'pol-uasset': null, 'pt-uasset': null, 'pt-pol': null },
  vault: null,
  exact: {
    memecoin: null,
    uAsset: { base: 100n * E18, decimals: 18 },
    pol: null,
    pt: null,
    yt: null,
    lp: { main: null, 'pol-uasset': null, 'pt-uasset': null, 'pt-pol': null },
    vault: null,
  },
};

function renderPanel() {
  render(
    createElement(SwapPanel, {
      locale: 'en' as Locale,
      memecoinSymbol: 'MEME',
      memecoinName: 'Meme',
      uAssetSymbol: 'UUSD',
      price: 0.01,
      uAssetUsd: 1,
      memecoinBalance: null,
      uAssetBalance: null,
      reserves: [],
      reserveBalance: null,
      pol: null,
      governanceChain: 97,
      governanceChainName: 'BSC Testnet',
    }),
  );
  const input = screen.getByLabelText('Sell UUSD');
  const cta = () => document.querySelector<HTMLButtonElement>('.swap-panel__cta');
  return { input, cta };
}

beforeEach(() => {
  state.balances = null;
  state.amount = '';
});

afterEach(() => {
  cleanup();
});

describe('SwapPanel sell-leg balance gate', () => {
  it('fails the CTA closed while the sell-leg balance is unknown (probe not landed)', async () => {
    state.amount = '1';
    const { input, cta } = renderPanel();

    fireEvent.change(input, { target: { value: '1' } });
    await waitFor(() => {
      expect(cta()?.disabled).toBe(true);
      expect(cta()?.textContent).toBe('Balance unavailable');
    });
  });

  it('arms the CTA once the exact probe lands with a sufficient balance', async () => {
    state.balances = LANDED;
    state.amount = '1';
    const { input, cta } = renderPanel();

    fireEvent.change(input, { target: { value: '1' } });
    await waitFor(() => {
      expect(cta()?.disabled).toBe(false);
      expect(cta()?.textContent).toBe('Swap');
    });
  });

  it('keeps the over-balance branch on the landed exact read', async () => {
    state.balances = LANDED;
    state.amount = '200';
    const { input, cta } = renderPanel();

    fireEvent.change(input, { target: { value: '200' } });
    await waitFor(() => {
      expect(cta()?.disabled).toBe(true);
      expect(cta()?.textContent).toBe('Insufficient UUSD balance');
    });
  });
});

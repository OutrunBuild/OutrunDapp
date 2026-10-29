// @vitest-environment jsdom
// Identity regression: switching the stable side (uAsset ↔ PSM reserve) must re-quote even when the
// typed amount is unchanged. The identity resync only rewrites the debounced amount — a same-value
// state update React bails out of — so the selected stable token must itself be a load-effect
// dependency; without it the old pair's quote stays on screen and keeps polling.
import { render, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import type { Hex } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  quoteForContext,
  useSwapLiveQuote,
  type SwapLiveQuoteInput,
  type SwapQuoteContext,
} from '../../components/verse/swap-live-quote';

const mocks = vi.hoisted(() => ({
  readSwapQuote: vi.fn(
    async (
      _reader: unknown,
      _router: string,
      _key: unknown,
      _params: { amountSpecified: bigint },
    ) => ({
      estimatedUserOutputAmount: 1_000n,
      estimatedLpFeeAmount: 3n,
      estimatedProtocolFeeAmount: 0n,
      protocolFeeOnInput: true,
      feeBps: 30n,
    }),
  ),
  readPsmQuote: vi.fn(async () => 990n),
  readSwapSpotOutPerIn: vi.fn(async () => 10),
  readPoolKey: vi.fn(async () => ({
    currency0: '0x00000000000000000000000000000000000000a1',
    currency1: '0x00000000000000000000000000000000000000b2',
    fee: 3000,
    tickSpacing: 60,
    hooks: '0x00000000000000000000000000000000000000c3',
  })),
  readPTToken: vi.fn(async () => '0x0000000000000000000000000000000000000000'),
  getTokenDecimals: vi.fn(async (_reader: unknown, _chainId: number, address: string) =>
    address.toLowerCase() === '0x00000000000000000000000000000000000000d4' ? 6 : 18,
  ),
  getVerseSession: vi.fn(async () => ({
    reader: {
      read: async ({ functionName }: { functionName: string }) =>
        functionName === 'uAsset'
          ? '0x00000000000000000000000000000000000000a1'
          : '0x00000000000000000000000000000000000000d4',
    },
    verse: {
      memecoin: '0x00000000000000000000000000000000000000b2',
      pol: '0x00000000000000000000000000000000000000e5',
      uAsset: '0x00000000000000000000000000000000000000a1',
    },
    contracts: { MemeverseSwapRouter: '0x00000000000000000000000000000000000000f1' },
  })),
}));

vi.mock('../../lib/web3/chains', () => ({
  getClientChainConfig: () => ({
    status: 'ok',
    config: {
      contracts: {
        status: 'deployed',
        abiVersion: 'test',
        addresses: {
          MemeverseSwapRouter: '0x00000000000000000000000000000000000000f1',
          MemeverseUniswapHook: '0x00000000000000000000000000000000000000c3',
          'OutrunPSM.UUSD': '0x00000000000000000000000000000000000000f2',
        },
      },
      kernel7702Implementation: '0x00000000000000000000000000000000000000f3',
    },
  }),
}));
vi.mock('../../lib/web3/active-provider', () => ({ getActiveEip1193Provider: () => ({}) }));
vi.mock('../../lib/web3/abis', () => ({ psmAbi: [] }));
vi.mock('../../lib/web3/session-actions', () => ({ limitForDirection: () => 0n }));
vi.mock('../../components/global/execution-reads', () => ({
  readPoolKey: mocks.readPoolKey,
  readSwapQuote: mocks.readSwapQuote,
  readPsmQuote: mocks.readPsmQuote,
  readSwapSpotOutPerIn: mocks.readSwapSpotOutPerIn,
  readPTToken: mocks.readPTToken,
}));
vi.mock('../../components/global/write-session', () => ({
  getTokenDecimals: mocks.getTokenDecimals,
  getVerseSession: mocks.getVerseSession,
}));

const UASSET_STABLE: SwapLiveQuoteInput['stableToken'] = { kind: 'uasset' };
const RESERVE_STABLE: SwapLiveQuoteInput['stableToken'] = {
  kind: 'reserve',
  address: '0x00000000000000000000000000000000000000d4',
};
const BASE: SwapLiveQuoteInput = {
  active: true,
  eoa: '0x00000000000000000000000000000000000000aa',
  chainId: 8453,
  verseId: '1',
  direction: 'stable-to-meme',
  memeTokenId: 'meme',
  uAssetSymbol: 'UUSD',
  stableToken: UASSET_STABLE,
  amount: '100',
};

function Harness(input: SwapLiveQuoteInput) {
  const quote = useSwapLiveQuote(input);
  return createElement(
    'div',
    { 'data-testid': 'state' },
    quote.value == null ? 'null' : `${quote.value.key}|${quote.value.out}`,
  );
}

describe('useSwapLiveQuote stable-side identity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('re-quotes when the stable side switches while the amount stays the same', async () => {
    const view = render(createElement(Harness, BASE));
    await waitFor(() => expect(view.getByTestId('state').textContent).not.toBe('null'));
    expect(mocks.readSwapQuote).toHaveBeenCalledTimes(1);
    const uAssetQuote = view.getByTestId('state').textContent;
    expect(mocks.readSwapQuote.mock.calls[0][3].amountSpecified).toBe(
      -100_000_000_000_000_000_000n,
    );

    view.rerender(createElement(Harness, { ...BASE, stableToken: RESERVE_STABLE }));
    // The reserve leg must be fetched through the PSM mint input, not kept from the uAsset leg.
    await waitFor(() => expect(mocks.readSwapQuote).toHaveBeenCalledTimes(2));
    expect(view.getByTestId('state').textContent).not.toBe(uAssetQuote);
    expect(mocks.readSwapQuote.mock.calls[1][3].amountSpecified).toBe(-990n);
    view.unmount();
  });

  it('renders pending, never the previous pair, while a switched request is in flight', async () => {
    const view = render(createElement(Harness, BASE));
    await waitFor(() => expect(view.getByTestId('state').textContent).not.toBe('null'));

    let resolveGate!: () => void;
    const gate = new Promise<void>((resolve) => {
      resolveGate = resolve;
    });
    mocks.readSwapQuote.mockImplementationOnce(async () => {
      await gate;
      return {
        estimatedUserOutputAmount: 1_000n,
        estimatedLpFeeAmount: 3n,
        estimatedProtocolFeeAmount: 0n,
        protocolFeeOnInput: true,
        feeBps: 30n,
      };
    });

    view.rerender(createElement(Harness, { ...BASE, stableToken: RESERVE_STABLE }));
    // First frame after the switch: the stored quote belongs to the uAsset identity, so the
    // card gets no value (pending) — never the previous pair's settled numbers.
    expect(view.getByTestId('state').textContent).toBe('null');
    await waitFor(() => expect(mocks.readSwapQuote).toHaveBeenCalledTimes(2));
    expect(view.getByTestId('state').textContent).toBe('null');

    resolveGate();
    await waitFor(() => expect(view.getByTestId('state').textContent).not.toBe('null'));
    view.unmount();
  });

  it('drops the stored quote when returning to a previously quoted identity', async () => {
    const view = render(createElement(Harness, BASE));
    await waitFor(() => expect(view.getByTestId('state').textContent).not.toBe('null'));

    view.rerender(createElement(Harness, { ...BASE, stableToken: RESERVE_STABLE }));
    view.rerender(createElement(Harness, BASE));
    // A→B→A without a settling quote: the old uAsset value must not resurrect as settled.
    expect(view.getByTestId('state').textContent).toBe('null');
    await waitFor(() => expect(view.getByTestId('state').textContent).not.toBe('null'));
    view.unmount();
  });

  it('keeps the settled quote while the same request refreshes', async () => {
    const view = render(createElement(Harness, BASE));
    await waitFor(() => expect(view.getByTestId('state').textContent).not.toBe('null'));
    const settled = view.getByTestId('state').textContent;

    let resolveRefresh!: () => void;
    const refreshGate = new Promise<void>((resolve) => {
      resolveRefresh = resolve;
    });
    mocks.readSwapQuote.mockImplementationOnce(async () => {
      await refreshGate;
      return {
        estimatedUserOutputAmount: 1_000n,
        estimatedLpFeeAmount: 3n,
        estimatedProtocolFeeAmount: 0n,
        protocolFeeOnInput: true,
        feeBps: 30n,
      };
    });
    // The 10s tick re-fetches the SAME request: the settled value must stay on screen (the
    // identity clear must never run on a refresh — that would blank the slot every interval).
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => expect(mocks.readSwapQuote).toHaveBeenCalledTimes(2));
    expect(view.getByTestId('state').textContent).toBe(settled);

    resolveRefresh();
    await waitFor(() => expect(view.getByTestId('state').textContent).not.toBe('null'));
    view.unmount();
  });

  it('disarms the pipeline while the card cannot quote (no resolvable request)', async () => {
    const view = render(createElement(Harness, { ...BASE, active: false }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    // The card passes `executionReady && valid`: a disarmed request must not read the session
    // or the quote — that is what stops the permanent pending spinner for dust amounts.
    expect(mocks.getVerseSession).not.toHaveBeenCalled();
    expect(mocks.readSwapQuote).not.toHaveBeenCalled();
    view.unmount();
  });
});

const POOL_KEY: SwapQuoteContext['key'] = {
  currency0: '0x00000000000000000000000000000000000000a1',
  currency1: '0x00000000000000000000000000000000000000b2',
  fee: 3_000,
  tickSpacing: 60,
  hooks: '0x00000000000000000000000000000000000000c3',
};

/** Memecoin → uAsset sell context; the card's stable leg is the only varying axis. */
function sellContext(overrides: Partial<SwapQuoteContext> = {}): SwapQuoteContext {
  return {
    chainId: 8453,
    verseId: '1',
    reader: {} as SwapQuoteContext['reader'],
    router: '0x00000000000000000000000000000000000000f1',
    hook: '0x00000000000000000000000000000000000000c3',
    kernel: '0x00000000000000000000000000000000000000f3',
    manifestVersion: 'test',
    tokenIn: '0x00000000000000000000000000000000000000b2',
    tokenOut: '0x00000000000000000000000000000000000000a1',
    key: POOL_KEY,
    zeroForOne: false,
    decimalsIn: 18,
    decimalsOut: 18,
    cardDecimalsIn: 18,
    cardDecimalsOut: 18,
    amountIn: 12_345n,
    amount: '0.000000000000012345',
    ...overrides,
  };
}

describe('superseded quote requests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('never lets a superseded fetch seed the shared cache', async () => {
    const amount = '7';
    let resolveFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    mocks.readSwapQuote.mockImplementationOnce(async () => {
      await firstGate;
      return {
        estimatedUserOutputAmount: 1_000n,
        estimatedLpFeeAmount: 3n,
        estimatedProtocolFeeAmount: 0n,
        protocolFeeOnInput: true,
        feeBps: 30n,
      };
    });

    const view = render(createElement(Harness, { ...BASE, amount }));
    await waitFor(() => expect(mocks.readSwapQuote).toHaveBeenCalledTimes(1));
    // Supersede the gated request, then let it land: its quote belongs to the old identity.
    view.rerender(createElement(Harness, { ...BASE, amount, stableToken: RESERVE_STABLE }));
    await waitFor(() => expect(mocks.readSwapQuote).toHaveBeenCalledTimes(2));
    resolveFirst();
    await waitFor(() => expect(view.getByTestId('state').textContent).not.toBe('null'));

    // The click path for the superseded identity must not find that quote in the shared cache.
    const buySide = sellContext({
      tokenIn: '0x00000000000000000000000000000000000000a1',
      tokenOut: '0x00000000000000000000000000000000000000b2',
      amountIn: 7_000_000_000_000_000_000n,
      amount,
    });
    const callsBefore = mocks.readSwapQuote.mock.calls.length;
    await quoteForContext(buySide, BASE.eoa as Hex);
    expect(mocks.readSwapQuote.mock.calls.length).toBe(callsBefore + 1);
    view.unmount();
  });
});

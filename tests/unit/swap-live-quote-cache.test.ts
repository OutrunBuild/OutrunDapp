// Cache identity of the live quote. `quoteCache` is module state, so these cases live in their
// own module graph (vitest isolates per file): sharing the hook tests' cache would let a stale
// entry decide the result instead of the key under test.
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { quoteForContext, type SwapQuoteContext } from '../../components/verse/swap-live-quote';

const mocks = vi.hoisted(() => ({
  readSwapQuote: vi.fn(async () => ({
    estimatedUserOutputAmount: 1_000n,
    estimatedLpFeeAmount: 3n,
    estimatedProtocolFeeAmount: 0n,
    protocolFeeOnInput: true,
    feeBps: 30n,
  })),
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
}));

vi.mock('../../lib/web3/chains', () => ({ getClientChainConfig: () => ({ status: 'error' }) }));
vi.mock('../../lib/web3/active-provider', () => ({ getActiveEip1193Provider: () => null }));
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
  getTokenDecimals: vi.fn(),
  getVerseSession: vi.fn(),
}));

const EOA = '0x00000000000000000000000000000000000000aa' as const;
const OTHER_EOA = '0x00000000000000000000000000000000000000ab' as const;

const POOL_KEY: SwapQuoteContext['key'] = {
  currency0: '0x00000000000000000000000000000000000000a1',
  currency1: '0x00000000000000000000000000000000000000b2',
  fee: 3_000,
  tickSpacing: 60,
  hooks: '0x00000000000000000000000000000000000000c3',
};

/** Memecoin → uAsset sell context; the card stable leg is the only varying axis. */
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

describe('quoteForContext cache identity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('never reuses a quote across the card stable leg', async () => {
    const uAssetSide = sellContext();
    const reserveSide = sellContext({
      reserve: {
        psm: '0x00000000000000000000000000000000000000f2',
        reserveToken: '0x00000000000000000000000000000000000000d4',
        reserveDecimals: 6,
        uAsset: '0x00000000000000000000000000000000000000a1',
      },
    });

    const first = await quoteForContext(uAssetSide, EOA);
    expect(mocks.readSwapQuote).toHaveBeenCalledTimes(1);
    // Same request → the young quote is reused (the click path's documented behavior).
    const replayed = await quoteForContext(uAssetSide, EOA);
    expect(replayed).toBe(first);
    expect(mocks.readSwapQuote).toHaveBeenCalledTimes(1);

    // Only the card stable leg differs: the key must not collapse these two requests.
    const reserveQuote = await quoteForContext(reserveSide, EOA);
    expect(mocks.readSwapQuote).toHaveBeenCalledTimes(2);
    expect(reserveQuote.key).not.toBe(first.key);
  });

  it('keys the trader — another EOA prices another dynamic-fee batch state', async () => {
    const ctx = sellContext({ amountIn: 777n, amount: '0.000000000000000777' });

    const first = await quoteForContext(ctx, EOA);
    const replayed = await quoteForContext(ctx, EOA);
    expect(replayed).toBe(first);
    expect(mocks.readSwapQuote).toHaveBeenCalledTimes(1);

    const other = await quoteForContext(ctx, OTHER_EOA);
    expect(mocks.readSwapQuote).toHaveBeenCalledTimes(2);
    expect(other.key).not.toBe(first.key);
  });
});

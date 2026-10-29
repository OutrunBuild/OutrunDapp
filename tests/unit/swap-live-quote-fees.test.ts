// Reserve-leg fee assembly: the quote runs on 18-dec pool legs while the card may pay a 6-dec
// reserve, so every fee is first expressed in its own currency and only then converted into the
// card's input token. These are the numbers the fee row shows — a mixed-decimals slip renders a
// plausible but wrong cost, which is why the assembly is asserted exactly.
import { describe, expect, it } from 'vitest';
import type { Hex } from 'viem';

import type { ContractReader } from '../../components/global/execution-reads';
import {
  faceOf,
  fetchSwapQuote,
  unfaceOf,
  type SwapQuoteContext,
} from '../../components/verse/swap-live-quote';

const UASSET = '0x00000000000000000000000000000000000000aa' as Hex;
const MEME = '0x00000000000000000000000000000000000000bb' as Hex;
const PSM = '0x00000000000000000000000000000000000000cc' as Hex;
const USDC = '0x00000000000000000000000000000000000000dd' as Hex;
const ROUTER = '0x00000000000000000000000000000000000000ee' as Hex;
const HOOK = '0x00000000000000000000000000000000000000ff' as Hex;
const KERNEL = '0x0000000000000000000000000000000000000011' as Hex;
const EOA = '0x0000000000000000000000000000000000000022' as Hex;

type QuoteSwapTuple = [bigint, bigint, bigint, bigint, bigint, boolean];

const readerOf = (quote: QuoteSwapTuple, psmQuotes: bigint[]): ContractReader => ({
  read: async ({ functionName }) => {
    if (functionName === 'quoteSwap') return quote;
    if (functionName === 'cachedLpTotalSupply') return 10n ** 21n;
    if (functionName === 'quoteAmountsForLiquidity') return [10n ** 21n, 10n ** 21n];
    if (functionName === 'quoteMint' || functionName === 'quoteRedeem') {
      const next = psmQuotes.shift();
      if (next == null) throw new Error(`no PSM quote queued for ${functionName}`);
      return next;
    }
    throw new Error(`unexpected read ${functionName}`);
  },
});

const baseCtx = (
  reader: ContractReader,
  overrides: Partial<SwapQuoteContext>,
): SwapQuoteContext => ({
  chainId: 97,
  verseId: '7',
  reader,
  router: ROUTER,
  hook: HOOK,
  kernel: KERNEL,
  manifestVersion: 'v1-rc2',
  tokenIn: UASSET,
  tokenOut: MEME,
  key: { currency0: UASSET, currency1: MEME, fee: 3000, tickSpacing: 60, hooks: HOOK },
  zeroForOne: true,
  decimalsIn: 18,
  decimalsOut: 18,
  cardDecimalsIn: 18,
  cardDecimalsOut: 18,
  amountIn: 1000n * 10n ** 18n,
  amount: '1000',
  ...overrides,
});

describe('faceOf / unfaceOf (PSM par math)', () => {
  it('scales a 6-dec reserve to 18-dec face value and back', () => {
    expect(faceOf(1_000_000n, 6)).toBe(10n ** 18n);
    expect(unfaceOf(10n ** 18n, 6)).toBe(1_000_000n);
  });

  it('keeps 18-dec values untouched', () => {
    expect(faceOf(5n, 18)).toBe(5n);
    expect(unfaceOf(5n, 18)).toBe(5n);
  });

  it('truncates only on the down-scale leg (24-dec reserve)', () => {
    expect(faceOf(1_000_001n, 24)).toBe(1n);
    expect(unfaceOf(1n, 24)).toBe(1_000_000n);
  });
});

describe('fetchSwapQuote reserve-leg fee assembly', () => {
  it('prices a buy (reserve in) in the 6-dec card token, not in uAsset', async () => {
    // 100 USDC → PSM mints 99.5 U; the pool spends that U for 5,000 meme.
    const reader = readerOf(
      // feeBps, userIn, userOut, protocolFee, lpFee, protocolFeeOnInput
      [
        3000n,
        99_500_000_000_000_000_000n,
        5_000n * 10n ** 18n,
        2_000_000_000_000_000n,
        1_000_000_000_000_000n,
        true,
      ],
      [99_500_000_000_000_000_000n],
    );
    const ctx = baseCtx(reader, {
      tokenIn: UASSET,
      cardDecimalsIn: 6,
      amountIn: 100_000_000n,
      amount: '100',
      reserve: { psm: PSM, reserveToken: USDC, reserveDecimals: 6, uAsset: UASSET },
    });

    const quote = await fetchSwapQuote(ctx, EOA);

    expect(quote.out).toBe(5_000n * 10n ** 18n);
    // PSM fee: 1 U of face value (100 − 99.5) expressed back in 6-dec USDC.
    // Router fee: 3e15 U converted into USDC at this quote's own rate → 3015 (floor).
    expect(quote.psm).toEqual({
      address: PSM,
      reserveToken: USDC,
      uAssetAmount: 99_500_000_000_000_000_000n,
      psmAmountIn: 100_000_000n,
      psmAmountOut: 99_500_000_000_000_000_000n,
      feeInInput: 503_015n,
    });
  });

  it('converts an output-side protocol fee back into the memecoin input on a sell', async () => {
    // 1,000 meme → 100 U out; the PSM redeems those U for 99 USDC.
    const reader = readerOf(
      [3000n, 1_000n * 10n ** 18n, 100n * 10n ** 18n, 10n ** 18n, 2n * 10n ** 18n, false],
      [99_000_000n],
    );
    const ctx = baseCtx(reader, {
      tokenIn: MEME,
      tokenOut: UASSET,
      zeroForOne: false,
      cardDecimalsIn: 18,
      cardDecimalsOut: 6,
      amountIn: 1_000n * 10n ** 18n,
      amount: '1000',
      reserve: { psm: PSM, reserveToken: USDC, reserveDecimals: 6, uAsset: UASSET },
    });

    const quote = await fetchSwapQuote(ctx, EOA);

    expect(quote.out).toBe(99_000_000n);
    // Router fee (output-side protocol leg): 2 + 1·(1000/100) = 12 meme.
    // PSM fee: (100 − 99) U face → 1·(1000/100) = 10 meme.
    expect(quote.psm?.feeInInput).toBe(22n * 10n ** 18n);
    expect(quote.psm?.uAssetAmount).toBe(100n * 10n ** 18n);
    expect(quote.psm?.psmAmountOut).toBe(99_000_000n);
  });

  it('reports no PSM leg when the pair is quoted against uAsset directly', async () => {
    const reader = readerOf([3000n, 100n * 10n ** 18n, 5_000n * 10n ** 18n, 0n, 0n, true], []);
    const ctx = baseCtx(reader, { amountIn: 100n * 10n ** 18n, amount: '100' });

    const quote = await fetchSwapQuote(ctx, EOA);

    expect(quote.out).toBe(5_000n * 10n ** 18n);
    expect(quote.psm).toBeUndefined();
  });
});

// Reserve-leg swap planning: the three batch shapes the swap card can produce, and the fee
// conversion that folds the PSM par fee into the card's single fee row. Pure functions only —
// no wallet, no chain.
import { describe, expect, it } from 'vitest';
import { decodeFunctionData, type Hex } from 'viem';

import { swapRouterAbi } from '../../../lib/web3/abis';
import { buildSwapPlan, swapApprovalLegs, swapFeeBps } from '../../../components/verse/swap-plan';
import type { SwapQuoteContext, SwapQuoteValue } from '../../../components/verse/swap-live-quote';

/** Decoded swap arguments, typed as the positional tuple the ABI declares. */
function decodeSwap(callData: Hex) {
  const { functionName, args } = decodeFunctionData({ abi: swapRouterAbi, data: callData });
  return {
    functionName,
    args: args as readonly [unknown, { amountSpecified: bigint }, unknown, unknown, unknown],
  };
}

const ROUTER = '0x4444444444444444444444444444444444444444' as Hex;
const HOOK = '0x5555555555555555555555555555555555555555' as Hex;
const KERNEL = '0x6666666666666666666666666666666666666666' as Hex;
const EOA = '0x7777777777777777777777777777777777777777' as Hex;
const MEMECOIN = '0xaaaa000000000000000000000000000000000001' as Hex;
const UASSET = '0xaaaa000000000000000000000000000000000002' as Hex;
const PSM = '0xbbbb000000000000000000000000000000000003' as Hex;
const USDC = '0xcccc000000000000000000000000000000000004' as Hex;

const KEY = {
  currency0: MEMECOIN,
  currency1: UASSET,
  fee: 3000,
  tickSpacing: 60,
  hooks: HOOK,
};

function ctxOf(overrides: Partial<SwapQuoteContext> = {}): SwapQuoteContext {
  return {
    chainId: 97,
    verseId: '21',
    reader: { read: async () => 0n },
    router: ROUTER,
    hook: HOOK,
    kernel: KERNEL,
    manifestVersion: 'v1-rc2',
    tokenIn: MEMECOIN,
    tokenOut: UASSET,
    key: KEY,
    zeroForOne: true,
    decimalsIn: 18,
    decimalsOut: 18,
    cardDecimalsIn: 18,
    cardDecimalsOut: 18,
    amountIn: 1000n,
    amount: '1000',
    ...overrides,
  };
}

function quoteOf(overrides: Partial<SwapQuoteValue> = {}): SwapQuoteValue {
  return {
    out: 990n,
    feeBps: 30n,
    spotOutPerIn: null,
    decimalsIn: 18,
    decimalsOut: 18,
    cardDecimalsIn: 18,
    cardDecimalsOut: 18,
    amount: '1000',
    key: 'k',
    at: 0,
    ...overrides,
  };
}

const reserveLeg = { psm: PSM, reserveToken: USDC, reserveDecimals: 6, uAsset: UASSET };

describe('swapApprovalLegs', () => {
  it('approves the pool input only on a uAsset leg', () => {
    expect(swapApprovalLegs(ctxOf())).toEqual([{ token: MEMECOIN, spender: ROUTER }]);
  });

  it('approves the reserve to the PSM and the minted uAsset to the router on a buy', () => {
    const ctx = ctxOf({
      tokenIn: UASSET,
      tokenOut: MEMECOIN,
      cardDecimalsIn: 6,
      reserve: reserveLeg,
    });
    expect(swapApprovalLegs(ctx)).toEqual([
      { token: USDC, spender: PSM },
      { token: UASSET, spender: ROUTER },
    ]);
  });

  it('approves only the memecoin on a sell (the router redeems internally)', () => {
    expect(swapApprovalLegs(ctxOf({ reserve: reserveLeg }))).toEqual([
      { token: MEMECOIN, spender: ROUTER },
    ]);
  });
});

describe('buildSwapPlan', () => {
  it('plans a plain exact-in swap when the stable side is uAsset', () => {
    const plan = buildSwapPlan({
      ctx: ctxOf(),
      minOut: 980n,
      minUAssetOut: 0n,
      amountIn: 1000n,
      uAssetIn: 0n,
      deadline: 1n,
      eoa: EOA,
      allowances: [0n],
    });
    expect(plan.target).toBe(ROUTER);
    expect(plan.functionName).toBe('swap');
    expect(plan.preActions).toHaveLength(0);
    expect(plan.approvals).toHaveLength(1);
    const { functionName, args } = decodeSwap(plan.action.callData);
    expect(functionName).toBe('swap');
    expect(args[1].amountSpecified).toBe(-1000n);
    expect(args[4]).toBe(980n);
  });

  it('skips the approval when the allowance already covers the input', () => {
    const plan = buildSwapPlan({
      ctx: ctxOf(),
      minOut: 980n,
      minUAssetOut: 0n,
      amountIn: 1000n,
      uAssetIn: 0n,
      deadline: 1n,
      eoa: EOA,
      allowances: [1000n],
    });
    expect(plan.approvals).toHaveLength(0);
  });

  it('plans mint-then-swap for a reserve buy, with the mint as a preAction', () => {
    const ctx = ctxOf({
      tokenIn: UASSET,
      tokenOut: MEMECOIN,
      cardDecimalsIn: 6,
      amountIn: 1_000_000n,
      reserve: reserveLeg,
    });
    const plan = buildSwapPlan({
      ctx,
      minOut: 495n,
      minUAssetOut: 0n,
      amountIn: 1_000_000n,
      uAssetIn: 999_000n,
      deadline: 1n,
      eoa: EOA,
      allowances: [0n, 0n],
    });
    expect(plan.functionName).toBe('swap');
    expect(plan.preActions).toHaveLength(1);
    expect(plan.preActions[0].target).toBe(PSM);
    // Two approvals, in batch order: reserve→PSM, then minted uAsset→router.
    expect(plan.approvals).toHaveLength(2);
    expect(plan.approvals[0].target).toBe(USDC);
    expect(plan.approvals[1].target).toBe(UASSET);
    const { args } = decodeSwap(plan.action.callData);
    // The swap spends exactly what the mint produces — a static value in the signed batch.
    expect(args[1].amountSpecified).toBe(-999_000n);
  });

  it('plans one combined router call for a reserve sell with both floors', () => {
    const plan = buildSwapPlan({
      ctx: ctxOf({ reserve: reserveLeg }),
      minOut: 990n,
      minUAssetOut: 985n,
      amountIn: 1000n,
      uAssetIn: 0n,
      deadline: 1n,
      eoa: EOA,
      allowances: [0n],
    });
    expect(plan.functionName).toBe('swapExactInToReserve');
    expect(plan.preActions).toHaveLength(0);
    expect(plan.approvals).toHaveLength(1);
    const { functionName, args } = decodeFunctionData({
      abi: swapRouterAbi,
      data: plan.action.callData,
    }) as { functionName: string; args: readonly unknown[] };
    expect(functionName).toBe('swapExactInToReserve');
    // (key, amountIn, minUAssetOut, psm, reserveToken, minReserveOut, recipient, deadline, hookData)
    expect(args[1]).toBe(1000n);
    expect(args[2]).toBe(985n);
    // viem decodes addresses checksummed; compare case-insensitively.
    expect(String(args[3]).toLowerCase()).toBe(PSM.toLowerCase());
    expect(String(args[4]).toLowerCase()).toBe(USDC.toLowerCase());
    expect(args[5]).toBe(990n);
    expect(String(args[6]).toLowerCase()).toBe(EOA.toLowerCase());
  });
});

describe('swapFeeBps', () => {
  it('reports the pool fee alone when no PSM leg is involved', () => {
    expect(swapFeeBps({ quote: quoteOf({ feeBps: 30n }), cardInBase: 1000n })).toBe(30);
  });

  it('folds the PSM fee in, as basis points of the card input', () => {
    // 10,000 USDC in, 4.84% total cost → 484 bps.
    const quote = quoteOf({
      feeBps: 30n,
      psm: {
        address: PSM,
        reserveToken: USDC,
        uAssetAmount: 9_950_000n,
        psmAmountIn: 10_000_000n,
        psmAmountOut: 9_950_000n,
        feeInInput: 484_000n,
      },
    });
    expect(swapFeeBps({ quote, cardInBase: 10_000_000n })).toBe(484);
  });

  it('never reports a PSM figure at zero input', () => {
    const quote = quoteOf({
      feeBps: 30n,
      psm: {
        address: PSM,
        reserveToken: USDC,
        uAssetAmount: 0n,
        psmAmountIn: 0n,
        psmAmountOut: 0n,
        feeInInput: 0n,
      },
    });
    expect(swapFeeBps({ quote, cardInBase: 0n })).toBe(30);
  });
});

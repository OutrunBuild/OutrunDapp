// Swap execution planning: every selectable pair maps to one batch shape. Kept separate from
// the panel so the shapes stay unit-testable without a wallet — the panel only reads
// allowances for `swapApprovalLegs` and assembles what this module returns.
//
// Three shapes:
//   uAsset leg          approve pool input            → swapExactInput
//   reserve buy         approve reserve → PSM, mint   → approve uAsset → swapExactInput
//   reserve sell        approve memecoin → router     → swapExactInToReserve (swap + redeem)
//
// The reserve buy cannot use the router's combined entry: that entry redeems uAsset into a
// reserve, and the buy direction goes the other way. Its mint output is deterministic par math
// (quoteMint), so the follow-on swap amount is a static value the batch can carry.
import type { Hex } from 'viem'

import {
  approvalCall,
  psmMintCall,
  swapExactInToReserveCall,
  swapExactInputCall,
  type BatchExecution,
} from '@/lib/web3/session-actions'

import type { SwapQuoteContext, SwapQuoteValue } from './swap-live-quote'

export type SwapApprovalLeg = { token: Hex; spender: Hex }

/** The allowance legs a batch will consume, in batch order (mint first, then the swap). The
 *  PSM-minted uAsset approval is sized by the quote already on screen, so this runs after a
 *  quote exists. */
export function swapApprovalLegs(ctx: SwapQuoteContext): SwapApprovalLeg[] {
  const reserve = ctx.reserve
  if (reserve == null) return [{ token: ctx.tokenIn, spender: ctx.router }]
  const isBuy = ctx.tokenIn === reserve.uAsset
  if (!isBuy) return [{ token: ctx.tokenIn, spender: ctx.router }]
  return [
    { token: reserve.reserveToken, spender: reserve.psm },
    { token: reserve.uAsset, spender: ctx.router },
  ]
}

export type SwapPlanInput = {
  ctx: SwapQuoteContext
  /** Card-output floor (already slippage-adjusted) */
  minOut: bigint
  /** Swap-leg uAsset floor for the sell direction (same slippage, applied to the swap leg) */
  minUAssetOut: bigint
  /** Card-input amount in card decimals */
  amountIn: bigint
  /** PSM mint output (uAsset base units) — the buy leg's swap amount */
  uAssetIn: bigint
  deadline: bigint
  eoa: Hex
  /** Allowance values for `swapApprovalLegs(ctx)`, same order */
  allowances: readonly bigint[]
}

export type SwapPlan = {
  target: Hex
  functionName: 'swap' | 'swapExactInToReserve' | 'mint'
  action: BatchExecution
  preActions: BatchExecution[]
  approvals: BatchExecution[]
}

/** Total transaction cost as basis points of the card input, for the single fee row.
 *
 *  Two different bases, both converted to the token the user actually typed:
 *   - the pool's own fee comes from the same `quoteSwap` preview execution runs, and is
 *     charged on the pool input;
 *   - the PSM charges a face-value fee on top, which the quote layer already folded into
 *     `psm.feeInInput` in card-input units.
 *
 *  A uAsset leg has no PSM portion, so the row degenerates to the pool fee alone. */
export function swapFeeBps(input: {
  quote: SwapQuoteValue
  /** Card-input amount in card base units */
  cardInBase: bigint
}): number {
  const { quote, cardInBase } = input
  if (quote.psm == null) return Number(quote.feeBps)
  if (cardInBase <= 0n) return Number(quote.feeBps)
  // feeInInput is card-input base units; scale it to bps over the typed amount. Integer
  // division keeps the row from printing precision the quote never had.
  return Number((quote.psm.feeInInput * 10_000n) / cardInBase)
}

/** Build the batch for the selected pair. Floors: the sell leg floors the swap on uAsset and
 *  the redemption on the reserve output, both derived from the same slippage setting; the buy
 *  leg floors only the swap, because the mint output is exact. */
export function buildSwapPlan(input: SwapPlanInput): SwapPlan {
  const { ctx, minOut, minUAssetOut, amountIn, uAssetIn, deadline, eoa } = input
  const reserve = ctx.reserve
  if (reserve == null) {
    return {
      target: ctx.router,
      functionName: 'swap',
      action: swapExactInputCall(ctx.router, {
        key: ctx.key,
        zeroForOne: ctx.zeroForOne,
        amountIn,
        amountOutMinimum: minOut,
        recipient: eoa,
        deadline,
      }),
      preActions: [],
      approvals:
        (input.allowances[0] ?? 0n) < amountIn
          ? [approvalCall(ctx.tokenIn, ctx.router, amountIn)]
          : [],
    }
  }
  const isBuy = ctx.tokenIn === reserve.uAsset
  if (isBuy) {
    // Reserve in → mint uAsset → swap uAsset for memecoin. The mint's output is deterministic,
    // so the swap amount and its floor are static; the mint allowance is the typed reserve
    // amount, the uAsset allowance is exactly what the mint will produce.
    return {
      target: ctx.router,
      functionName: 'swap',
      action: swapExactInputCall(ctx.router, {
        key: ctx.key,
        zeroForOne: ctx.zeroForOne,
        amountIn: uAssetIn,
        amountOutMinimum: minOut,
        recipient: eoa,
        deadline,
      }),
      preActions: [psmMintCall(reserve.psm, eoa, amountIn)],
      approvals: [
        ...((input.allowances[0] ?? 0n) < amountIn
          ? [approvalCall(reserve.reserveToken, reserve.psm, amountIn)]
          : []),
        ...((input.allowances[1] ?? 0n) < uAssetIn
          ? [approvalCall(reserve.uAsset, ctx.router, uAssetIn)]
          : []),
      ],
    }
  }
  // Memecoin in → swap to uAsset → redeem to reserve, one router call. Both floors ride the
  // one slippage setting: the uAsset floor is the swap leg's own output floor, and the reserve
  // floor is what the PSM must then pay out.
  return {
    target: ctx.router,
    functionName: 'swapExactInToReserve',
    action: swapExactInToReserveCall(ctx.router, {
      key: ctx.key,
      zeroForOne: ctx.zeroForOne,
      amountIn,
      minUAssetOut,
      psm: reserve.psm,
      reserveToken: reserve.reserveToken,
      minReserveOut: minOut,
      recipient: eoa,
      deadline,
    }),
    preActions: [],
    approvals:
      (input.allowances[0] ?? 0n) < amountIn
        ? [approvalCall(ctx.tokenIn, ctx.router, amountIn)]
        : [],
  }
}

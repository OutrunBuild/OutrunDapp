// Memeverse hook pool key + full-range derivation math for the trade desk reads.
// Every Memeverse pool binds one canonical key shape: addresses sorted, dynamic-fee flag,
// tick spacing 200 (MemeversePoolKeyLib.hookPoolKey — same for all four verse pools), so the
// key and its v4 PoolId can be computed locally instead of costing a round trip per pool.
// poolId = keccak256(abi.encode(PoolKey)) (v4 PoolId.toId).
import { encodeAbiParameters, keccak256, type Hex } from 'viem';

import type { PoolKey } from './session-actions';

/** v4 LPFeeLibrary.DYNAMIC_FEE_FLAG — every hook pool prices through the dynamic-fee facet. */
export const DYNAMIC_FEE_FLAG = 0x800000;
/** MemeversePoolKeyLib.DEFAULT_TICK_SPACING */
export const HOOK_TICK_SPACING = 200;

export function hookPoolKey(tokenA: Hex, tokenB: Hex, hook: Hex): PoolKey {
  // Solidity compares raw address bytes; lowercase hex comparison matches it exactly.
  const tokenAIsCurrency0 = tokenA.toLowerCase() < tokenB.toLowerCase();
  const currency0 = tokenAIsCurrency0 ? tokenA : tokenB;
  const currency1 = tokenAIsCurrency0 ? tokenB : tokenA;
  return {
    currency0,
    currency1,
    fee: DYNAMIC_FEE_FLAG,
    tickSpacing: HOOK_TICK_SPACING,
    hooks: hook,
  };
}

export function poolIdOf(key: PoolKey): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { name: 'currency0', type: 'address' },
        { name: 'currency1', type: 'address' },
        { name: 'fee', type: 'uint24' },
        { name: 'tickSpacing', type: 'int24' },
        { name: 'hooks', type: 'address' },
      ],
      [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks],
    ),
  );
}

/** Display-units price of one base token in quote tokens, from raw reserve amounts.
 *  A pool with an empty base side has nothing to price — null, never 0 (0 would read as
 *  "worthless" instead of "unknown"). */
export function priceQuotePerBase(
  amountBase: bigint,
  decBase: number,
  amountQuote: bigint,
  decQuote: number,
): number | null {
  if (amountBase <= 0n || amountQuote <= 0n) return null;
  const value = Number(amountQuote) / 10 ** decQuote / (Number(amountBase) / 10 ** decBase);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** LP minted per one quote-side token (raw ratio — both legs are per-pool units, so decimals
 *  cancel; matches the hook minting LP 1:1 with liquidity). null = no quote-side reserve. */
export function lpPerQuoteUnit(lpSupply: bigint, amountQuote: bigint): number | null {
  if (amountQuote <= 0n) return null;
  const value = Number(lpSupply) / Number(amountQuote);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** amountMin floors for a full-range LP burn, from the router's burn quote in (base, quote)
 *  order. The quote rounds each leg up (mint shape) while the burn settles round-down, so the
 *  slippage-trimmed floor sits at/below the payout for any slippageBps >= 1 (the UI enforces
 *  >= 0.01% before submit); at 0 the floor would equal the round-up quote and could exceed it.
 *  Output follows pool currency order (currency0 = lower address). */
export function burnFloorsFromQuote(input: {
  quotedBase: bigint;
  quotedQuote: bigint;
  baseIsCurrency0: boolean;
  slippageBps: number;
}): { amount0Min: bigint; amount1Min: bigint } {
  const scale = BigInt(10_000 - input.slippageBps);
  const minBase = (input.quotedBase * scale) / 10_000n;
  const minQuote = (input.quotedQuote * scale) / 10_000n;
  return input.baseIsCurrency0
    ? { amount0Min: minBase, amount1Min: minQuote }
    : { amount0Min: minQuote, amount1Min: minBase };
}

/** Sorted remove-liquidity legs for a full-range LP burn, from semantic (base, quote)
 *  tokens plus the router's burn quote in the same (base, quote) order.
 *  Sort and floor mapping stay in one place so a caller cannot sort the tokens
 *  one way and map the floors the other. Output follows pool currency order
 *  (currency0 = lower address). */
export function buildRemoveLiquidityLegs(input: {
  base: Hex;
  quote: Hex;
  quotedBase: bigint;
  quotedQuote: bigint;
  slippageBps: number;
}): { currency0: Hex; currency1: Hex; amount0Min: bigint; amount1Min: bigint } {
  const baseIsCurrency0 = input.base.toLowerCase() < input.quote.toLowerCase();
  const { amount0Min, amount1Min } = burnFloorsFromQuote({
    quotedBase: input.quotedBase,
    quotedQuote: input.quotedQuote,
    baseIsCurrency0,
    slippageBps: input.slippageBps,
  });
  return {
    currency0: baseIsCurrency0 ? input.base : input.quote,
    currency1: baseIsCurrency0 ? input.quote : input.base,
    amount0Min,
    amount1Min,
  };
}

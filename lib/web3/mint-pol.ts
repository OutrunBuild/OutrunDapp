// Mint POL (launcher.mintPOLToken) output derivation.
//
// The launcher's exact mode (`amountOutDesired != 0`) re-quotes the router for the requested
// LP and reverts `InputAmountExceedsMaximum` when either quoted budget exceeds the caller's
// desired amount, so the target must come from the pool's *current* per-LP composition.
// `uAssetPerPol` is the PT backing ratio recorded once at settlement — it equals the current
// conversion only while the main-pool price stays at its settlement level, and overstates the
// mint (prompting the revert above) as soon as the price rises.

/** Human uAsset per 1 POL at main-pool price `price` (uAsset per memecoin), for a full-range
 *  LP: the uAsset leg per raw LP unit is sqrt(price) once both tokens share decimals, scaled
 *  to POL's 18-decimal base. POL is minted 1:1 with raw LP. */
export function uAssetPerPolAtPrice(input: {
  price: number;
  uAssetDecimals: number;
  memecoinDecimals: number;
}): number | null {
  if (!Number.isFinite(input.price) || input.price <= 0) return null;
  const sqrtRaw = Math.sqrt(input.price * 10 ** (input.uAssetDecimals - input.memecoinDecimals));
  return sqrtRaw * 10 ** (18 - input.uAssetDecimals);
}

/** Human POL minted for `uAssetAmount` uAsset at the given main-pool price. */
export function mintPolEstimateFromPrice(input: {
  uAssetAmount: number;
  price: number;
  uAssetDecimals: number;
  memecoinDecimals: number;
}): number | null {
  const perPol = uAssetPerPolAtPrice(input);
  if (perPol == null || !Number.isFinite(input.uAssetAmount) || input.uAssetAmount <= 0)
    return null;
  return input.uAssetAmount / perPol;
}

/**
 * Exact-mode target from a router quote of `referenceLiquidity` LP: the LP both typed budgets
 * can actually fund at the quoted composition, floored, minus the slippage allowance.
 * `quoted*` are the router's (rounded-up) required amounts for one reference LP.
 */
export function mintPolTargetFromQuote(input: {
  uAssetDesired: bigint;
  memecoinDesired: bigint;
  referenceLiquidity: bigint;
  quotedUAsset: bigint;
  quotedMemecoin: bigint;
  slippageBps: number;
}): bigint {
  if (input.referenceLiquidity <= 0n) return 0n;
  const lpFromUAsset =
    input.quotedUAsset > 0n
      ? (input.uAssetDesired * input.referenceLiquidity) / input.quotedUAsset
      : 0n;
  const lpFromMemecoin =
    input.quotedMemecoin > 0n
      ? (input.memecoinDesired * input.referenceLiquidity) / input.quotedMemecoin
      : 0n;
  const achievable = lpFromUAsset < lpFromMemecoin ? lpFromUAsset : lpFromMemecoin;
  const bps = Math.min(10_000, Math.max(0, Math.trunc(input.slippageBps)));
  return (achievable * BigInt(10_000 - bps)) / 10_000n;
}

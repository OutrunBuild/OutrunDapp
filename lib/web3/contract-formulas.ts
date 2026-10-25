// Contract formulas — integer mirrors of the on-chain math every feature quotes and gates
// against (PSM mint/redeem, preorder capacity, POLend leverage debt, SP stake mint). Kept in
// base units end to end; display formatting lives in ./base-units (never round a quote up).
//
// Contract sources (OutStake):
// - PSM mint      OutrunPSMUpgradeable.sol mint(): faceValue = amountIn rescaled to 18 dec,
//                 amountOut = faceValue * (1e18 - tin) / 1e18 (floor); feeIn = faceValue - amountOut.
// - PSM redeem    OutrunPSMUpgradeable.sol _redeemOutput: payout floored twice (fee, then the
//                 reserve-decimals rescale); the rescale dust counts into the fee.
// - Preorder cap  MemeverseLauncherLib.preorderMaxCapacity: base * 70% * ratio, floors.
// - Leverage debt POLend: borrowed = interest / rate (rate is the 1e18-scaled one-off ratio).
// - Stake mint    OutrunRouter.previewStakeFromToken = SY.previewDeposit -> SP.previewStake
//                 (both linear for the deployed SY/SP pair; the per-unit preview read from the
//                 chain is the authoritative ratio, flooring once loses at most wei dust).
import { BPS, WAD, floorDiv } from './base-units';

/** Product rule shared with the UI copy: preorder cap = genesis funds × 70% × capacity ratio. */
export const PREORDER_CAP_RATE_BPS = 7_000n;

/** Reserve base units -> 18-dec face value (reserves above 18 decimals are outside the PSM
 * domain; the contract's rescale reverts, so callers must not quote them). */
export function faceValue18(amountIn: bigint, reserveDecimals: number): bigint {
  if (reserveDecimals > 18) return 0n;
  return amountIn * 10n ** BigInt(18 - reserveDecimals);
}

export type PsmMintQuote = { faceValue: bigint; amountOut: bigint; feeIn: bigint };

/** Exact PSM mint quote: `amountOut = faceValue * (1e18 - tin) / 1e18` (floor). */
export function psmMintQuote(
  amountIn: bigint,
  reserveDecimals: number,
  tinWad: bigint,
): PsmMintQuote {
  const faceValue = faceValue18(amountIn, reserveDecimals);
  const fee = tinWad > WAD ? WAD : tinWad; // defensive: the chain cannot exceed 100%
  const amountOut = floorDiv(faceValue * (WAD - fee), WAD);
  return { faceValue, amountOut, feeIn: faceValue - amountOut };
}

export type PsmRedeemQuote = { faceValue: bigint; amountOut: bigint; feeOut: bigint };

/** Exact PSM redeem quote: burn (18-dec) -> `(1e18 - tout)` fee floor -> reserve rescale floor,
 * with the rescale dust counted into the fee. */
export function psmRedeemQuote(
  amountIn: bigint,
  reserveDecimals: number,
  toutWad: bigint,
): PsmRedeemQuote {
  if (reserveDecimals > 18) return { faceValue: 0n, amountOut: 0n, feeOut: 0n };
  const fee = toutWad > WAD ? WAD : toutWad;
  const faceValue = floorDiv(amountIn * (WAD - fee), WAD);
  const scale = 10n ** BigInt(18 - reserveDecimals);
  const amountOut = floorDiv(faceValue, scale);
  const feeOut = amountIn - faceValue + (faceValue % scale);
  return { faceValue, amountOut, feeOut };
}

/** Per-user preorder cap in uAsset base units: funds * 70% * ratio, both floors. */
export function preorderCapBase(genesisFundsBase: bigint, ratioBps: bigint): bigint {
  const base = floorDiv(genesisFundsBase * PREORDER_CAP_RATE_BPS, BPS);
  return floorDiv(base * ratioBps, BPS);
}

/** Verse-level preorder capacity ceiling, byte-exact with the chain: the launcher computes it
 *  as ONE `mulDiv(totalBaseFunds, 7 * ratio, 10 * BPS)` (MemeverseLauncherLib.preorderMaxCapacity),
 *  which can sit one wei above `preorderCapBase`'s two-step floor. State reconstruction
 *  (`previewPreorderCapacity` remaining → used) must use this variant — a wei-low ceiling would
 *  leak the rounding gap into the derived used amount. */
export function preorderCapacityCeilingBase(totalBaseFunds: bigint, ratioBps: bigint): bigint {
  return floorDiv(totalBaseFunds * 7n * ratioBps, 10n * BPS);
}

/** Leverage debt principal in uAsset base units: interest / rate (floor). */
export function leverageDebtBase(interestBase: bigint, rateWad: bigint): bigint {
  if (rateWad <= 0n) return 0n;
  return floorDiv(interestBase * WAD, rateWad);
}

/** Stake leg mint estimate from the chain's per-whole-token preview (uAsset base per 1 token
 * unit of `tokenDecimals`): floor once. */
export function stakeMintBase(
  amountIn: bigint,
  tokenDecimals: number,
  previewBasePerWholeToken: bigint,
): bigint {
  return floorDiv(amountIn * previewBasePerWholeToken, 10n ** BigInt(tokenDecimals));
}

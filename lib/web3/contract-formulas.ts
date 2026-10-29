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

/** Leverage debt-cap comparison, integer-exact with the chain pre-check: POLend borrows only
 * while mulDiv(totalInterest + newInterest, 1e18, rate) stays within the verse debt cap
 * (POLendUpgradeable._checkLeverageCaps). The comparison itself; probe-presence dispatch
 * lives in leverageGateExceeded. */
export function leverageCapExceeded(
  totalInterestBase: bigint,
  newInterestBase: bigint,
  rateWad: bigint,
  debtCapBase: bigint,
): boolean {
  return leverageDebtBase(totalInterestBase + newInterestBase, rateWad) > debtCapBase;
}

/** Leverage exact-gate dispatch, same shape as preorderRemainingExceeded: a landed probe is
 * the gate on its own because it carries the wallet chain's own rate (the SSR overlay only
 * ever carries the canonical copy). null — probe not landed, mint unread or zero, or a
 * zero-rate probe — hands the decision to the caller's float fallback. */
export function leverageGateExceeded(
  mainMintBase: bigint | null,
  probe: { interestBase: bigint; interestRateBase: bigint; debtCapBase: bigint } | null,
): boolean | null {
  if (mainMintBase == null || mainMintBase <= 0n) return null;
  if (probe == null || probe.interestRateBase <= 0n) return null;
  return leverageCapExceeded(
    probe.interestBase,
    mainMintBase,
    probe.interestRateBase,
    probe.debtCapBase,
  );
}

/** Rate-operand resolution, probe-first: a landed probe's rate is the wallet chain's own
 * one-off ratio while the SSR wad is the canonical chain's copy, so every wallet-chain
 * conversion reads this one resolution. A landed zero rate (unseeded verse) still hands the
 * decision to the SSR copy, mirroring leverageGateExceeded's zero-rate dispatch. */
export function resolveLeverageRateWad(
  probeRateBase: bigint | null,
  ssrWad: string | null,
): bigint | null {
  if (probeRateBase != null && probeRateBase > 0n) return probeRateBase;
  if (ssrWad != null) return BigInt(ssrWad);
  return null;
}

/** Exact debt-cap headroom from the landed probe: remaining borrowable = cap − the chain's
 * own total debt, floor-clamped. null while the probe has not landed — the float layer
 * covers that window. */
export function debtHeadroomBase(
  probe: { debtCapBase: bigint; debtBase: bigint } | null,
): bigint | null {
  if (probe == null) return null;
  return probe.debtCapBase > probe.debtBase ? probe.debtCapBase - probe.debtBase : 0n;
}

/** Preorder remaining-capacity gate shared by the preorder tab and the one-click combo,
 * exact-first per the money-precision contract: integer comparison while the probe remaining
 * and the mint quote have both landed, float fallback while either has not (no readable
 * remaining on any layer → no gate). */
export function preorderRemainingExceeded(
  exactRemainingBase: bigint | null,
  mintBase: bigint | null,
  floatRemaining: number | null,
  floatMint: number,
): boolean {
  if (exactRemainingBase != null && mintBase != null) return mintBase > exactRemainingBase;
  return floatRemaining != null && floatMint > floatRemaining;
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

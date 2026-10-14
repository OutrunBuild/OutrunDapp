/**
 * Slippage setting validation for the shared settings layer:
 * the industry-convention accepted range is 0.01%–50% — the lower bound blocks zero
 * tolerance (at 0, any tiny price move reverts) and the upper bound keeps the derived
 * value non-negative (minReceived = quote×(1−s/100); s>100 yields negative tokens).
 * Out-of-range values are not silently clamped: the returned category is mapped by the
 * component layer to a FieldError that reports in place, and the derived row falls back
 * to the '--' slot.
 */
export const SLIPPAGE_MIN = 0.01
export const SLIPPAGE_MAX = 50

export type SlippageIssue = 'below-min' | 'above-max'

export function getSlippageIssue(value: number): SlippageIssue | null {
  if (!Number.isFinite(value) || value < SLIPPAGE_MIN) return 'below-min'
  if (value > SLIPPAGE_MAX) return 'above-max'
  return null
}

/** Out-of-range category → copy.verseDesk copy key (the sole implementation of the
 * category-to-copy mapping, unit-tested with this module) */
export function slippageErrorCopyKey(issue: SlippageIssue): 'slippageTooLow' | 'slippageTooHigh' {
  return issue === 'below-min' ? 'slippageTooLow' : 'slippageTooHigh'
}

/** Slippage/deadline preset tiers (normal default 0.5%);
 * consumer = the shared settings layer swap-settings.tsx */
export const SLIPPAGE_PRESETS = [0.1, 0.5, 1] as const
export const DEADLINE_PRESETS = [10, 20, 30] as const

/** Whole-minute validation for the transaction deadline (custom input keeps the
 * decimal point so errors report in place — stripping the dot would silently turn
 * 1.5 into 15) */
export function isWholeMinutes(value: number) {
  return Number.isInteger(value) && value > 0
}

/** Settings-layer controlled convention: the controlled
 * state stores the string as typed — typing intermediate states such as a trailing dot
 * or an empty string never pass through Number() into storage (a number state swallows
 * the dot: "0." becomes 0 once typed, "0.25" silently becomes 25); values go through
 * this conversion only at derivation points. Empty/invalid fallbacks keep the existing
 * behavior: slippage → 0 (zero-tolerance error), deadline → 1 minute */
export function slippageToNumber(value: string) {
  const next = Number(value)
  return Number.isFinite(next) && next >= 0 ? next : 0
}

/** Empty/non-positive input falls back to 1 minute (the default deadline) */
export function deadlineToNumber(value: string) {
  const next = Number(value)
  return Number.isFinite(next) && next > 0 ? next : 1
}

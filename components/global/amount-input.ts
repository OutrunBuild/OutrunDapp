/**
 * Amount input sanitization — the sole shared implementation:
 * strips everything outside the [0-9.] whitelist and collapses multiple decimal points
 * into the first one ("1.2.3" → "1.23"), so downstream Number() never receives NaN and
 * silently becomes 0.00.
 * Slippage/deadline settings use the settings-layer validation convention: deadline is
 * in whole minutes, and input keeps its dots through sanitizeAmount so non-whole minutes
 * error in place — slippage-input's isWholeMinutes validates instead of stripping dots
 * and silently rewriting.
 */
export function sanitizeAmount(value: string) {
  const cleaned = value.replace(/[^\d.]/g, '')
  const [whole, ...fraction] = cleaned.split('.')
  return fraction.length ? `${whole}.${fraction.join('')}` : whole
}

/** 40-character cap on amount input (large-number boundary: float64's ~17 significant
 * digits are already covered; longer raw digit strings overflow card faces) */
export const AMOUNT_MAX_CHARS = 40

/** Convention for balance prefill/Max fill: a plain decimal string at 6-digit precision
 * (bare String() emits scientific notation for values < 1e-6; e.g. '1e-7' would be
 * mis-truncated to '17' by sanitization); returns an empty string for
 * non-positive/non-finite values. */
export function amountToInputString(value: number) {
  return Number.isFinite(value) && value > 0 ? String(Number(value.toFixed(6))) : ''
}

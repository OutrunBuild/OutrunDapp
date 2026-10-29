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
import { toBaseUnits } from '@/lib/web3/base-units'

export function sanitizeAmount(value: string) {
  const cleaned = value.replace(/[^\d.]/g, '')
  const [whole, ...fraction] = cleaned.split('.')
  return fraction.length ? `${whole}.${fraction.join('')}` : whole
}

/** 40-character cap on amount input (large-number boundary: float64's ~17 significant
 * digits are already covered; longer raw digit strings overflow card faces) */
export const AMOUNT_MAX_CHARS = 40

/** Convention for balance prefill/Max fill: a plain decimal string floored (string-level,
 * never rounded up) at 6-digit precision — a Max fill above the true balance would trip the
 * insufficient-balance gate on the very value it prefilled, so the 7th+ fraction digits are
 * cut, not carried. Bare String() emits scientific notation outside the plain-decimal range
 * (e.g. '1e-7' would be mis-truncated to '17' by sanitization); sub-1e-6 values floor to
 * zero at 6 decimals and huge ones (≥1e21) only ever ride the exact base-units prefill path
 * (trimFractionZeros + formatUnits) — this helper returns an empty string for both, and for
 * non-positive/non-finite values. */
export function amountToInputString(value: number) {
  if (!Number.isFinite(value) || value <= 0) return ''
  const text = String(value)
  if (text.includes('e') || text.includes('E')) return ''
  const dot = text.indexOf('.')
  if (dot < 0) return text
  const cut = text.slice(0, dot + 7)
  return cut.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
}

/** Full-precision decimal string with trailing fraction zeros trimmed ("1000" stays
 * "1000", never "1"); the exact base-units prefill convention (formatUnits → here). */
export function trimFractionZeros(value: string): string {
  return value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value
}

/** Typed-amount validity at the exact layer's decimals. Float positivity is only the
 * coarse half of the gate: once the on-chain decimals are known (exact probe landed) the
 * typed string must also parse to a nonzero base-units integer — dust below one base
 * unit (0.0000005 on a 6-dec token) parses to 0n and must not arm the CTA (the call
 * could only revert on-chain). A missing exact read (probe failed, fixture sample)
 * leaves the float half deciding; execution re-checks against the freshly resolved
 * decimals. */
export function typedAmountPositive(amount: string, exact: { decimals: number } | null): boolean {
  const parsed = Number(amount)
  if (!Number.isFinite(parsed) || parsed <= 0) return false
  return exact == null || toBaseUnits(amount, exact.decimals) > 0n
}

/**
 * Balance gate shared by AmountField's error row and every executable CTA's disabled
 * predicate — one implementation so the field and the button cannot drift. The exact
 * wallet read (raw base units) wins when it landed; the float sample is only the fallback.
 * `balanceUnknown` (live read in flight or failed) blocks submission: an unread balance
 * must never arm a CTA that could only revert on-chain.
 */
export type AmountBalanceGate = {
  overBalance: boolean
  balanceUnknown: boolean
  blocked: boolean
}

export function evaluateAmountBalance(
  amount: string,
  balance: number | null,
  exactBalance?: { base: bigint; decimals: number } | null,
): AmountBalanceGate {
  const parsed = Number(amount)
  const overBalance =
    exactBalance != null
      ? toBaseUnits(amount, exactBalance.decimals) > exactBalance.base
      : balance != null && Number.isFinite(parsed) && parsed > balance
  const balanceUnknown = balance == null && exactBalance == null
  return { overBalance, balanceUnknown, blocked: overBalance || balanceUnknown }
}

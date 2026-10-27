/**
 * Tiered display for derived trade amounts (the single convention for the verse trading
 * desk; input-side sanitization lives in amount-input.ts in this directory), modeled on
 * the Uniswap interface number standards:
 * - 0 renders `0`; (0, 1e-5) renders `<0.00001` (below the display floor the digits are noise);
 * - < 1e4: six significant digits with a two-decimal minimum, grouped;
 * - < 1e15: grouped two decimals — trade amounts never compact below the layout guard;
 * - >= 1e15: compact notation with the international K/M/B/T symbols (the compact tier is
 *   pinned to en-US so zh never swaps in CJK large-number units — same convention as
 *   signal-ui's formatMarketCap);
 * - >= 1e21: scientific notation (`4.36E40`) as the overflow guard.
 * Fully expanded long strings and bare toFixed scientific notation are barred from card
 * faces (a 180-digit input overflows the Swap card); the CSS truncation/ellipsis
 * fallback lives in globals.css.
 */
import { formatUnits } from 'viem'
import type { Locale } from '@/lib/data/fixture-repository'

export const COMPACT_AMOUNT_THRESHOLD = 1e15
export const SCIENTIFIC_AMOUNT_THRESHOLD = 1e21
/** Token amounts below this render `<0.00001` — the display floor of the same name in the Uniswap interface. */
export const TOKEN_AMOUNT_DISPLAY_FLOOR = 1e-5

const localeTagOf = (locale: Locale) => (locale === 'zh' ? 'zh-CN' : 'en-US')

export function fmtTiered(
  value: number,
  locale: Locale,
  compactDigits: number,
  normal: (v: number) => string,
) {
  const abs = Math.abs(value)
  // The guard tiers are pinned to en-US: zh-CN compact emits CJK units (万亿) and its
  // scientific casing differs — guard-tier values keep one international rendering in
  // both locales.
  if (abs >= SCIENTIFIC_AMOUNT_THRESHOLD)
    return value.toLocaleString('en-US', { notation: 'scientific', maximumFractionDigits: compactDigits })
  if (abs >= COMPACT_AMOUNT_THRESHOLD)
    return value.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: compactDigits })
  return normal(value)
}

/** ≈$ and USD pricing: at most 2 decimal places in the normal case */
export function fmtUsd(value: number, locale: Locale) {
  return fmtTiered(value, locale, 2, (v) =>
    v.toLocaleString(localeTagOf(locale), { maximumFractionDigits: 2 }),
  )
}

/** Received-amount/protection-price/exchange-rate display: six significant digits
 * (trailing zeros trimmed) below 1e4, grouped two decimals below the compact guard,
 * then the shared upper tiers */
export function fmtTokenAmount(value: number, locale: Locale) {
  if (value === 0) return '0'
  if (value > 0 && value < TOKEN_AMOUNT_DISPLAY_FLOOR) return '<0.00001'
  const localeTag = localeTagOf(locale)
  // NB: Intl ignores fraction-digit options once significant-digit options are set, so
  // the sub-1e4 tier is significant-digits only — do not add minimumFractionDigits here.
  return fmtTiered(value, locale, 2, (v) =>
    Math.abs(v) < 1e4
      ? v.toLocaleString(localeTag, { maximumSignificantDigits: 6 })
      : v.toLocaleString(localeTag, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  )
}

/** Exact wallet balance (raw base units + decimals) through the same tiered display.
 * Display-only: gates compare the bigint directly and Max prefills the full-precision
 * string (Uniswap's toExact convention); Number(formatUnits) cannot represent 18-dec
 * balances exactly, but every tier renders at most six digits — far inside float64's
 * ~17-digit envelope, so the rounding never reaches a displayed digit. */
export function fmtTokenAmountExact(base: bigint, decimals: number, locale: Locale) {
  return fmtTokenAmount(Number(formatUnits(base, decimals)), locale)
}

/** Unit-price subscript-zero switch threshold: once leading zeros after the decimal
 * point reach this count (price < 10^-N), switch to subscript zeros */
export const PRICE_SUBSCRIPT_ZERO_THRESHOLD = 4

/** Token unit price (single convention for prices in token-strip and the candlestick
 * chart legend; market toFixed(2) fiat convention ($1.20));
 * for < 1, six significant digits with trailing zeros trimmed (0.004200→0.0042);
 * leading zeros >= PRICE_SUBSCRIPT_ZERO_THRESHOLD switch to subscript zeros
 * (0.0000042→0.0₅42, subscript = total leading-zero count, after Binance/Capital.com).
 * Fixed decimal places eat significant digits at very small prices
 * (0.0000421.toFixed(6) = $0.000042 — the last significant digit is gone), so format by
 * significant digits, not decimal places.
 * Digits render identically in en/zh; no locale argument. */
export function fmtPrice(value: number): string {
  if (value >= 1 || value <= 0)
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const prec = value.toPrecision(6)
  const exp = prec.lastIndexOf('e')
  let zeros: number
  let digits: string
  if (exp >= 0) {
    zeros = -Number(prec.slice(exp + 1)) - 1
    digits = prec.slice(0, exp).replace('.', '')
  } else {
    const m = /^0\.(0*)(\d+)$/.exec(prec)
    if (!m)
      // Six significant digits rounded up to 1 (0.9999999→"1.00000"): fall back to the
      // fiat tier
      return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    zeros = m[1].length
    digits = m[2]
  }
  digits = digits.replace(/0+$/, '')
  if (zeros >= PRICE_SUBSCRIPT_ZERO_THRESHOLD) return `0.0${toSubscriptZeros(zeros)}${digits}`
  return `0.${'0'.repeat(zeros)}${digits}`
}

const toSubscriptZeros = (n: number) =>
  String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'.charAt(Number(d)))

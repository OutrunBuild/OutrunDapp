/**
 * Tiered display for large numbers (the single convention for derived amounts on the
 * verse trading desk; input-side sanitization lives in amount-input.ts in this directory):
 * >= 1e15 uses Intl compact notation (en `39,226T` / zh `39,226` + CJK "trillion" unit;
 * compact does not elide on huge values and degrades to the full digit string + unit
 * suffix), >= 1e21 uses scientific notation (`4.3585E40`), and the normal case uses the
 * normal format.
 * Fully expanded long strings and toFixed scientific notation are barred from card
 * faces (a 180-digit input overflows the Swap card); the CSS truncation/ellipsis
 * fallback lives in globals.css.
 */
import type { Locale } from '@/lib/data/fixture-repository'

export const COMPACT_AMOUNT_THRESHOLD = 1e15
export const SCIENTIFIC_AMOUNT_THRESHOLD = 1e21

const localeTagOf = (locale: Locale) => (locale === 'zh' ? 'zh-CN' : 'en-US')

export function fmtTiered(
  value: number,
  locale: Locale,
  compactDigits: number,
  normal: (v: number) => string,
) {
  const localeTag = localeTagOf(locale)
  const abs = Math.abs(value)
  if (abs >= SCIENTIFIC_AMOUNT_THRESHOLD)
    return value.toLocaleString(localeTag, { notation: 'scientific', maximumFractionDigits: compactDigits })
  if (abs >= COMPACT_AMOUNT_THRESHOLD)
    return value.toLocaleString(localeTag, { notation: 'compact', maximumFractionDigits: compactDigits })
  return normal(value)
}

/** ≈$ and USD pricing: at most 2 decimal places in the normal case */
export function fmtUsd(value: number, locale: Locale) {
  return fmtTiered(value, locale, 2, (v) =>
    v.toLocaleString(localeTagOf(locale), { maximumFractionDigits: 2 }),
  )
}

/** Received-amount/protection-price/exchange-rate display: toFixed(6) in the normal case
 * (bare toFixed emits a long `2.74e+109` scientific-notation string for >= 1e21) */
export function fmtTokenAmount(value: number, locale: Locale) {
  return fmtTiered(value, locale, 4, (v) => v.toFixed(6))
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

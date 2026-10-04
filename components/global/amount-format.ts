/**
 * 大数分层展示（verse 交易台派生金额的唯一口径；输入侧清洗见同目录 amount-input.ts）：
 * ≥1e15 Intl 紧凑记法（`39,226T`/`39,226万亿`；compact 在超大值不省略，会退化为
 * 全量数字+单位后缀）、≥1e21 科学记法（`4.3585E40`）、常态走 normal 格式。
 * 全展开长串与 toFixed 科学计数法禁止进卡面；CSS 截断省略兜底见 globals.css。
 * 起源=swap-panel（demo 参照页输入 180 位数字撑破 Swap 卡的教训，2026-09-23），
 * 2026-10-03 由五处逐份复制收敛为唯一实现。
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

/** ≈$ 与美元计价：常态最多 2 位小数 */
export function fmtUsd(value: number, locale: Locale) {
  return fmtTiered(value, locale, 2, (v) =>
    v.toLocaleString(localeTagOf(locale), { maximumFractionDigits: 2 }),
  )
}

/** 到账/保护价/汇率展示：常态 toFixed(6)（裸 toFixed 对 ≥1e21 会吐 `2.74e+109` 科学计数法长串） */
export function fmtTokenAmount(value: number, locale: Locale) {
  return fmtTiered(value, locale, 4, (v) => v.toFixed(6))
}

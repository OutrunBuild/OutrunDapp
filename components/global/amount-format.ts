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

/** 单价下标切换阈值：小数点后前导零达到该数（价格 <10^-(N-1)）即切下标记零 */
export const PRICE_SUBSCRIPT_ZERO_THRESHOLD = 4

/** 代币单价（token-strip 与蜡烛图图例价格唯一口径——决议 019，2026-10-08 扩域图例 OHLC/MA；市场.toFixed(2) 法币惯例（$1.20）；
 * <1 六位有效数字并裁尾随零（0.004200→0.0042）；
 * 前导零 ≥PRICE_SUBSCRIPT_ZERO_THRESHOLD 下标记零（0.0000042→0.0₅42，下标=前导零总数，学币安/Capital.com）。
 * 固定小数位在极小价会吃有效位（0.0000421.toFixed(6)=$0.000004），故按有效位而非小数位取数。
 * 中英数字同形，无 locale 参。取代 2026-09-23「固定 6 位小数+尾零灰显」。 */
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
      // 六位有效数字四舍五入进位到 1（0.9999999→"1.00000"）：回落法币档
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

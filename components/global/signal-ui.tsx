import type { Locale, VerseStage } from '@/lib/data/fixture-repository'

import { getCopy } from './copy'

export function formatAmount(value: number, locale: Locale, compact = false) {
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    maximumFractionDigits: value < 1 ? 6 : 2,
    notation: compact ? 'compact' : 'standard',
  }).format(value)
}

export function formatPercent(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    maximumFractionDigits: 1,
  }).format(value)
}

/** 市值紧凑格式：固定 B/M/K 缩写 + 两位小数（用户裁定 2026-09-23：不随 locale 换算为亿/万） */
export function formatMarketCap(value: number) {
  const tiers: Array<[suffix: string, scale: number]> = [
    ['B', 1_000_000_000],
    ['M', 1_000_000],
    ['K', 1_000],
  ]
  const tier = tiers.find(([, scale]) => value >= scale)
  return tier ? `${(value / tier[1]).toFixed(2)}${tier[0]}` : value.toFixed(2)
}

export function formatDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value))
}

/** 卡片用紧凑时间戳：fixture 时刻为固定 UTC，展示统一转 UTC+8（YYYY-MM-DD HH:mm） */
export function formatStamp(value: string) {
  const shifted = new Date(new Date(value).getTime() + 8 * 3_600_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())} ${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`
}

/** 赎回列表用纯日期（2026-09-26 用户裁定：参照 demo 的 Dec 25, 2024 形态）；同 formatStamp 的 UTC+8 口径 */
export function formatDay(value: string, locale: Locale) {
  const shifted = new Date(new Date(value).getTime() + 8 * 3_600_000)
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(shifted)
}

export function formatDuration(from: string, to: string, locale: Locale) {
  const minutes = Math.max(0, Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 60_000))
  const days = Math.floor(minutes / 1_440)
  const hours = Math.floor((minutes % 1_440) / 60)
  const remainingMinutes = minutes % 60

  if (locale === 'zh') {
    if (days > 0) return `${days} 天 ${hours} 小时`
    return `${hours} 小时 ${remainingMinutes} 分钟`
  }

  if (days > 0) return `${days}d ${hours}h`
  return `${hours}h ${remainingMinutes}m`
}

export function SourceRef(_: { value: string; id?: string }) {
  // Provenance stays attached to fixture data for internal review, never in the public interface.
  return null
}

export function StageBadge({ stage, locale }: { stage: VerseStage; locale: Locale }) {
  const copy = getCopy(locale)
  return (
    <span className="stage-badge" data-stage={stage}>
      <span className="stage-badge__mark" aria-hidden="true" />
      {copy.common.stages[stage]}
    </span>
  )
}

/** Fast Genesis 徽章：青色功能信号，仅创世期且 fixture 标记 fastGenesis 时展示 */
export function FastBadge({ label }: { label: string }) {
  return (
    <span className="fast-badge">
      <span className="fast-badge__mark" aria-hidden="true" />
      {label}
    </span>
  )
}

export function SectionHeading({
  title,
  description,
  aside,
}: {
  title: string
  description?: string
  aside?: React.ReactNode
}) {
  return (
    <header className="section-heading ax-echo-bar">
      <div className="section-heading__row">
        <h2>{title}</h2>
        {aside ? <div className="section-heading__aside">{aside}</div> : null}
      </div>
      {description ? <p>{description}</p> : null}
    </header>
  )
}

export function ProgressMeter({
  label,
  value,
  amount,
  threshold,
  unit,
  locale,
}: {
  label: string
  value: number
  amount: number
  threshold: number
  /** 计价符号：显示具体 uAsset 符号（如 UETH），不写统称（用户裁定 2026-09-22）；缺省=统称（仅 design-system showcase 用） */
  unit?: string
  locale: Locale
}) {
  const bounded = Math.min(value, 100)
  const unitLabel = unit ?? 'uAsset'

  return (
    <div className="progress-meter">
      <div className="progress-meter__label">
        <span>{label}</span>
        <span data-numeric>{formatPercent(value, locale)}%</span>
      </div>
      <div
        className="progress-meter__track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(bounded)}
      >
        <span style={{ inlineSize: `${bounded}%` }} />
      </div>
      <div className="progress-meter__values" data-numeric>
        <span>{formatAmount(amount, locale)}</span>
        <span>/ {formatAmount(threshold, locale)} {unitLabel}</span>
      </div>
    </div>
  )
}

export function LayoutNotes(_: { locale: Locale; items: readonly string[] }) {
  // Cross-page layout notes are prototype documentation, not product content.
  return null
}

export function SlashMark() {
  return <span className="slash-mark" aria-hidden="true" />
}

import type { Locale, VerseStage } from '@/lib/data/fixture-repository'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

import { getCopy } from './copy'

export function formatAmount(value: number, locale: Locale, compact = false) {
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    maximumFractionDigits: value < 1 ? 6 : 2,
    // compact always uses two decimals — avoids mixing 45K/122.83K/2.1K
    // in one column (min=max=2)
    ...(compact ? { notation: 'compact' as const, minimumFractionDigits: 2 } : {}),
  }).format(value)
}

export function formatPercent(value: number, locale: Locale, fractionDigits?: number) {
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    maximumFractionDigits: fractionDigits ?? 1,
    // Callers that need a fixed precision (price impact) get padded trailing zeros too;
    // the default one-decimal callers keep dropping them.
    ...(fractionDigits == null ? {} : { minimumFractionDigits: fractionDigits }),
  }).format(value)
}

/** Address/tx-hash truncation: site-wide `0x1234…abcd` (first 6 + … + last 4);
 * pass head/tail to widen (e.g. roomy dialog rows) — defaults keep every
 * existing call site unchanged */
export function formatHex(value: string, head = 6, tail = 4) {
  return `${value.slice(0, head)}…${value.slice(-tail)}`
}

/** Compact market-cap format: fixed B/M/K abbreviations + two decimals; no locale-based
 *  conversion to zh-style large-number units */
export function formatMarketCap(value: number) {
  const tiers: Array<[suffix: string, scale: number]> = [
    ['B', 1_000_000_000],
    ['M', 1_000_000],
    ['K', 1_000],
  ]
  const tier = tiers.find(([, scale]) => value >= scale)
  return tier ? `${(value / tier[1]).toFixed(2)}${tier[0]}` : value.toFixed(2)
}

/** Count formatting: counts such as participant numbers are
 *  naturally integers — a decimal point below the unit tier defies common sense, so
 *  decimals are only allowed alongside K/M/B; at tier, same behavior as formatMarketCap
 *  (K/M/B with two decimals, no locale-based conversion, unified stat-bar units) */
export function formatCount(value: number) {
  if (value < 1_000) {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
  }
  return formatMarketCap(value)
}

export function formatDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value))
}

/** Compact timestamp for cards: fixture moments are fixed UTC; display uniformly shifts
 * to UTC+8 (YYYY-MM-DD HH:mm) */
export function formatStamp(value: string) {
  const shifted = new Date(new Date(value).getTime() + 8 * 3_600_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())} ${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`
}

/** Date-only form for redemption lists (e.g. Dec 25, 2024); same UTC+8 convention as
 * formatStamp */
export function formatDay(value: string, locale: Locale) {
  const shifted = new Date(new Date(value).getTime() + 8 * 3_600_000)
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(shifted)
}

export function SourceRef(_: { value: string; id?: string }) {
  // Provenance stays attached to fixture data for internal review, never in the public interface.
  return null
}

/** Genesis countdown text shared by the stage-advance CTA and any future deadline
 * readouts: wall-clock remaining until endsAt as day/hour/minute words — the finest
 * tier is minutes (no seconds readout; the caller's unlock tick stays per-second).
 * A pending span never displays zero minutes. */
export function formatCountdown(remainingMs: number, locale: Locale): string {
  const t = getCopy(locale).common
  const left = Math.max(0, remainingMs)
  const days = Math.floor(left / 86_400_000)
  const hours = Math.floor((left % 86_400_000) / 3_600_000)
  const minutes = Math.floor((left % 3_600_000) / 60_000)
  if (days > 0) {
    return t.countdownDh.replace('{days}', String(days)).replace('{hours}', String(hours))
  }
  if (hours > 0) {
    return t.countdownHm.replace('{hours}', String(hours)).replace('{minutes}', String(minutes))
  }
  const minutesLeft = left <= 0 ? 0 : Math.max(1, minutes)
  return t.countdownM.replace('{minutes}', String(minutesLeft))
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

/** Fast Genesis badge: cyan functional signal; call sites gate on the fixture's
    fastGenesis flag (in practice genesis-stage snapshots only);
    when note is passed, the whole badge = hover bubble trigger (button semantics,
    keyboard reachable, same pattern as term-gloss) */
export function FastBadge({ label, note }: { label: string; note?: string }) {
  if (!note) {
    return (
      <span className="fast-badge">
        <span className="fast-badge__mark" aria-hidden="true" />
        {label}
      </span>
    )
  }
  return (
    <Tooltip>
      <TooltipTrigger className="fast-badge">
        <span className="fast-badge__mark" aria-hidden="true" />
        {label}
      </TooltipTrigger>
      <TooltipContent>{note}</TooltipContent>
    </Tooltip>
  )
}

export function SectionHeading({
  title,
  description,
  aside,
  id,
}: {
  title: string
  description?: string
  aside?: React.ReactNode
  id?: string
}) {
  return (
    <header className="section-heading ax-echo-bar">
      <div className="section-heading__row">
        <h2 id={id}>{title}</h2>
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
  /** Quote unit: display the specific uAsset symbol (e.g. UETH), not the generic name;
   * null = raise asset unresolved (deployment-table miss) → the generic name; default =
   * the generic name (used only by the design-system showcase) */
  unit?: string | null
  locale: Locale
}) {
  const bounded = Math.min(Math.max(value, 0), 100)
  const unitLabel = unit ?? 'uAsset'

  return (
    <div className="progress-meter">
      <div className="progress-meter__label">
        <span>{label}</span>
        <span data-numeric>{formatPercent(value, locale)}%</span>
      </div>
      {/* aria-valuenow is clamped to [0,100] per spec; the true overflowing value is
          announced via aria-valuetext (same convention as the visual number) */}
      <div
        className="progress-meter__track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(bounded)}
        aria-valuetext={`${formatPercent(value, locale)}%`}
      >
        <span data-reached={value >= 100 ? 'true' : undefined} style={{ inlineSize: `${bounded}%` }} />
      </div>
      <div className="progress-meter__values" data-numeric>
        <span>{formatAmount(amount, locale)}</span>
        <span>/ {formatAmount(threshold, locale)} {unitLabel}</span>
      </div>
    </div>
  )
}

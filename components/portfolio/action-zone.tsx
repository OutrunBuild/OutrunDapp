'use client'

/**
 * (1) To-do zone: the zone's shape follows where navigation
 * lands — card layer = in-page anchors / time-limited alerts (protection-window card countdown
 * hero + vault-withdrawal card in-page signpost); claim layer = two independent Data surface
 * panels (periodic incentives, one row per verse, ascending by window remaining / genesis refund
 * rows, descending by amount); all row actions jump to the verse page — the two groups stay in
 * separate panels because a single mixed panel lacked readability and each row's semantics are
 * homogeneous after the split. Card grammar = kind nameplate / hero number / KV+CTA footer
 * (hairline, equal-height pinned bottom); one yellow primary button per screen.
 */
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import type { PortfolioAction, Locale } from '@/lib/data/fixture-repository'
import { PROTECTION_WINDOW_MS } from '@/lib/data/types'

import { getCopy } from '../global/copy'
import { verseHref } from '../global/routes'
import { formatAmount, SectionHeading } from '../global/signal-ui'
import { Button } from '@/components/ui/button'
import { ProtectionExitDialog, type ProtectionExitContext } from './protection-exit-dialog'

const HOUR_MS = 3_600_000

/** Per-second countdown (for <24h cases): the timeline origin freezes exactly once (deadline −
 *  snapshot remaining at first render), so a post-write refresh delivering a freshly dated
 *  remainingMs cannot move a countdown already on screen (performance.md: display countdowns
 *  store the deadline, not "remaining + probe time") */
function DeadlineClock({
  deadline,
  remainingMs,
  template,
}: {
  /** Absolute window end (ISO); rows without one fall back to the snapshot-relative tick */
  deadline: string | null
  remainingMs: number
  template: string
}) {
  const deadlineMs = deadline == null ? null : Date.parse(deadline)
  const originRef = useRef(
    deadlineMs != null && Number.isFinite(deadlineMs) ? deadlineMs - remainingMs : null,
  )
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const id = setInterval(() => setElapsed(Date.now() - start), 1000)
    return () => clearInterval(id)
  }, [])
  const origin = originRef.current
  const left =
    origin == null || deadlineMs == null
      ? Math.max(0, remainingMs - elapsed)
      : Math.max(0, deadlineMs - origin - elapsed)
  const pad = (n: number) => String(n).padStart(2, '0')
  const time = `${pad(Math.floor(left / HOUR_MS))}:${pad(Math.floor((left % HOUR_MS) / 60_000))}:${pad(Math.floor((left % 60_000) / 1000))}`
  return <span data-numeric>{template.replace('{t}', time)}</span>
}

/** Badge duration for ≥24h: day/hour tier of the shared countdown template */
function staticDuration(remainingMs: number, locale: Locale) {
  const days = Math.floor(remainingMs / (24 * HOUR_MS))
  const hours = Math.floor((remainingMs % (24 * HOUR_MS)) / HOUR_MS)
  return getCopy(locale)
    .common.countdownDh.replace('{days}', String(days))
    .replace('{hours}', String(hours))
}

type Tone = 'danger' | 'warning' | 'normal'

function deadlineTone(remainingMs: number | null): Tone {
  if (remainingMs == null) return 'normal'
  if (remainingMs < 24 * HOUR_MS) return 'danger'
  if (remainingMs < 72 * HOUR_MS) return 'warning'
  return 'normal'
}

export function ActionZone({
  locale,
  actions,
  protectionExits,
}: {
  locale: Locale
  actions: PortfolioAction[]
  /** Protection-window card Exit context (keyed by verseId; missing row = Exit falls back to
   *  jumping to the verse page) */
  protectionExits?: Record<string, ProtectionExitContext>
}) {
  const copy = getCopy(locale).portfolio.action
  if (actions.length === 0) return null

  const cards = actions.filter(
    (action) => action.kind === 'protection' || action.kind === 'vault-ready',
  )
  // Dual claim tables: incentives = ascending by
  // window remaining; refunds = descending by amount
  const incentiveRows = actions
    .filter((action) => action.kind === 'incentive')
    .sort((a, b) => (a.remainingMs ?? 0) - (b.remainingMs ?? 0))
  const refundRows = actions
    .filter((action) => action.kind === 'refund')
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))

  return (
    <section className="pf-actions" id="pf-actions">
      <SectionHeading title={copy.title} description={copy.sub} />

      {cards.length > 0 ? (
        <ul className="pf-actions__list">
          {cards.map((action) => {
            if (action.kind === 'vault-ready') {
              // Vault withdrawal card: in-page signpost (CTA anchors #pf-vault), hero = total USD
              // pending withdrawal
              return (
                <li key="vault-ready">
                  <article className="pf-action" data-kind="vault">
                    <div className="pf-action__head">
                      <h3 className="pf-action__kind">{copy.vaultReadyTitle}</h3>
                    </div>
                    <div className="pf-action__hero">
                      {action.amountUsd != null ? (
                        <strong data-numeric>≈ ${formatAmount(action.amountUsd, locale)}</strong>
                      ) : null}
                    </div>
                    <div className="pf-action__foot">
                      <p className="pf-action__hint">{copy.vaultReadyHint}</p>
                      <Button
                        variant="outline"
                        nativeButton={false}
                        render={<a href="#pf-vault" />}
                      >
                        {copy.ctaVault}
                      </Button>
                    </div>
                  </article>
                </li>
              )
            }

            // Protection-window card: countdown hero + window-remaining bar + genesis principal KV
            const tone = deadlineTone(action.remainingMs)
            const exitContext = action.verse ? protectionExits?.[action.verse.id] : undefined
            const remainingMs = action.remainingMs ?? 0
            const windowLeft = Math.min(100, Math.round((remainingMs / PROTECTION_WINDOW_MS) * 100))
            const clock =
              remainingMs < PROTECTION_WINDOW_MS ? (
                <DeadlineClock
                  deadline={action.deadline}
                  remainingMs={remainingMs}
                  template={copy.deadlineWithin}
                />
              ) : (
                <span data-numeric>
                  {copy.deadlineWithin.replace('{t}', staticDuration(remainingMs, locale))}
                </span>
              )
            return (
              <li key={action.verse?.id}>
                <article className="pf-action" data-tone={tone}>
                  <div className="pf-action__head">
                    <h3 className="pf-action__kind">{copy.protectionTitle}</h3>
                    <span className="pf-action__clock">{clock}</span>
                  </div>
                  <p className="pf-action__who">
                    <Link href={verseHref(locale, action.verse?.id ?? '')}>
                      <strong>{action.verse?.symbol}</strong>
                    </Link>
                    <span>{action.verse?.name}</span>
                  </p>
                  <div className="pf-action__meter" aria-hidden="true">
                    <span style={{ inlineSize: `${windowLeft}%` }} />
                  </div>
                  <div className="pf-action__foot">
                    {action.amount != null ? (
                      <div className="pf-action__kv">
                        <span className="pf-action__kv-label">{copy.principalLabel}</span>
                        <strong className="pf-action__kv-value" data-numeric>
                          {formatAmount(action.amount, locale)}
                          <em> {action.verse?.raiseAsset}</em>
                        </strong>
                      </div>
                    ) : null}
                    {/* Exit button: with a POL position sample = in-page dialog (LP
                        direct conversion / splitting into two tokens on the spot, the two
                        redeemMemecoinLiquidity overloads); fixture row missing = keep jumping to
                        the verse page */}
                    {protectionExits && exitContext ? (
                      <ProtectionExitDialog
                        locale={locale}
                        context={exitContext}
                        triggerLabel={copy.ctaProtection}
                      />
                    ) : (
                      <Button
                        variant="outline"
                        nativeButton={false}
                        render={<Link href={verseHref(locale, action.verse?.id ?? '')} />}
                      >
                        {copy.ctaProtection}
                      </Button>
                    )}
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      ) : null}

      {incentiveRows.length > 0 || refundRows.length > 0 ? (
        <div className="pf-claims">
          {incentiveRows.length > 0 ? (
            <div className="pf-panel">
              <header className="pf-panel__bar">
                <span>{copy.incentiveTitle}</span>
                <span data-numeric>{incentiveRows.length}</span>
              </header>
              <ul className="pf-claim__list">
                {incentiveRows.map((action) => (
                  <li key={action.verse?.id} className="pf-claim-row">
                    <div className="pf-claim-row__id">
                      <strong>{action.verse?.symbol}</strong>
                      {action.remainingMs != null ? (
                        <span>
                          {copy.deadlineWithin.replace('{t}', staticDuration(action.remainingMs, locale))}
                        </span>
                      ) : null}
                    </div>
                    <div className="pf-claim-row__amount">
                      {action.amountUsd != null ? (
                        <strong data-numeric>≈ ${formatAmount(action.amountUsd, locale)}</strong>
                      ) : action.amount != null ? (
                        <strong data-numeric>{formatAmount(action.amount, locale)}</strong>
                      ) : null}
                      {action.amountUsd == null && action.verse != null ? (
                        <span data-numeric>{action.verse.symbol}</span>
                      ) : null}
                    </div>
                    <div className="pf-claim-row__actions">
                      <Link
                        className="pf-action__link"
                        href={verseHref(locale, action.verse?.id ?? '')}
                      >
                        {copy.ctaIncentive}
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {refundRows.length > 0 ? (
            <div className="pf-panel">
              <header className="pf-panel__bar">
                <span>{copy.refundTitle}</span>
                <span data-numeric>{refundRows.length}</span>
              </header>
              <ul className="pf-claim__list">
                {refundRows.map((action) => (
                  <li key={action.verse?.id} className="pf-claim-row">
                    <div className="pf-claim-row__id">
                      <strong>{action.verse?.symbol}</strong>
                      <span>{copy.refundSub}</span>
                    </div>
                    <div className="pf-claim-row__amount">
                      {action.amount != null ? (
                        <strong data-numeric>{formatAmount(action.amount, locale)}</strong>
                      ) : null}
                      <span data-numeric>{action.verse?.raiseAsset}</span>
                    </div>
                    <div className="pf-claim-row__actions">
                      <Link
                        className="pf-action__link"
                        href={verseHref(locale, action.verse?.id ?? '')}
                      >
                        {copy.ctaRefund}
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

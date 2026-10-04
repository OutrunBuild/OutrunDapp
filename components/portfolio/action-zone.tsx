'use client'

/**
 * ①待办区（2026-10-02 裁定）：只收「逾期有后果」项，按截止时间排序、最紧急置顶；
 * 同类跨 Verse 聚合（聚合卡显示最近截止）。截止色阶 normal→warning→danger 走数据
 * 语义层（左缘 3px 色条）；黄主 CTA 仅第一张卡（一屏一个主行动），其余 outline。
 * 倒计时锚定快照 remainingMs 走秒（RedeemCountdown 同款），fixedAnchor 披露示例时钟。
 */
import Link from 'next/link'
import { useEffect, useState } from 'react'

import type {
  FixtureBridgeMessageView,
  FixturePortfolioAction,
  Locale,
} from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { verseHref } from '../global/routes'
import { formatAmount, formatDay, SectionHeading } from '../global/signal-ui'
import { Button } from '@/components/ui/button'
import { StrandedDialog } from './portfolio-dialogs'

const HOUR_MS = 3_600_000

/** 走秒倒计时（<24h 场景；锚定快照剩余毫秒，纯展示层 tick） */
function DeadlineClock({ remainingMs, template }: { remainingMs: number; template: string }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const id = setInterval(() => setElapsed(Date.now() - start), 1000)
    return () => clearInterval(id)
  }, [])
  const left = Math.max(0, remainingMs - elapsed)
  const pad = (n: number) => String(n).padStart(2, '0')
  const time = `${pad(Math.floor(left / HOUR_MS))}:${pad(Math.floor((left % HOUR_MS) / 60_000))}:${pad(Math.floor((left % 60_000) / 1000))}`
  return <span data-numeric>{template.replace('{t}', time)}</span>
}

function staticDeadline(remainingMs: number, template: string) {
  const days = Math.floor(remainingMs / (24 * HOUR_MS))
  const hours = Math.floor((remainingMs % (24 * HOUR_MS)) / HOUR_MS)
  return template.replace('{t}', `${days}d ${hours}h`)
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
  strandedMessages,
}: {
  locale: Locale
  actions: FixturePortfolioAction[]
  strandedMessages: FixtureBridgeMessageView[]
}) {
  const copy = getCopy(locale).portfolio.action
  if (actions.length === 0) return null

  return (
    <section className="pf-actions" id="pf-actions">
      <SectionHeading title={copy.title} description={copy.sub} />
      <ul className="pf-actions__list">
        {actions.map((action, index) => {
          const tone = deadlineTone(action.remainingMs)
          const primary = index === 0
          const title =
            action.kind === 'protection'
              ? copy.protectionTitle
              : action.kind === 'incentive'
                ? copy.incentiveTitle
                : action.kind === 'vault-ready'
                  ? copy.vaultReadyTitle
                  : action.kind === 'refund'
                    ? copy.refundTitle
                    : copy.strandedTitle
          let body: string
          if (action.kind === 'protection') {
            body = copy.protectionBody.replace('{symbol}', action.verse?.symbol ?? '')
          } else if (action.kind === 'incentive') {
            body =
              action.verse != null
                ? copy.incentiveOneBody
                    .replace('{symbol}', action.verse.symbol)
                    .replace('{date}', formatDay(action.deadline ?? '', locale))
                : copy.incentiveCountBody.replace('{n}', String(action.count ?? 0))
          } else if (action.kind === 'vault-ready') {
            body = copy.vaultReadyBody.replace('{n}', String(action.count ?? 0))
          } else if (action.kind === 'refund') {
            body = copy.refundBody
              .replace('{symbol}', action.verse?.symbol ?? '')
              .replace(
                '{amount}',
                `${formatAmount(action.amount ?? 0, locale, true)} ${action.verse?.raiseAsset ?? ''}`,
              )
          } else {
            const message = strandedMessages.find(
              (candidate) => candidate.id === action.bridgeMessageId,
            )
            body = message
              ? copy.strandedBody
                  .replace('{amount}', formatAmount(message.amount, locale, true))
                  .replace('{asset}', message.assetSymbol)
                  .replace('{from}', message.fromChainName)
                  .replace('{to}', message.toChainName)
              : copy.strandedBody
          }

          const deadlineNode =
            action.remainingMs == null || action.deadline == null ? null : action.remainingMs <
              24 * HOUR_MS ? (
              <DeadlineClock remainingMs={action.remainingMs} template={copy.deadlineWithin} />
            ) : (
              <span data-numeric>{staticDeadline(action.remainingMs, copy.deadlineWithin)}</span>
            )

          const cta =
            action.kind === 'protection' || action.kind === 'refund' ? (
              <Button
                className={primary ? 'ax-ghost-cta' : undefined}
                variant={primary ? 'default' : 'outline'}
                nativeButton={false}
                render={<Link href={verseHref(locale, action.verse?.id ?? '')} />}
              >
                {action.kind === 'protection' ? copy.ctaProtection : copy.ctaRefund}
              </Button>
            ) : action.kind === 'incentive' && action.verse != null ? (
              <Button
                className={primary ? 'ax-ghost-cta' : undefined}
                variant={primary ? 'default' : 'outline'}
                nativeButton={false}
                render={<Link href={verseHref(locale, action.verse.id)} />}
              >
                {copy.ctaIncentive}
              </Button>
            ) : action.kind === 'incentive' || action.kind === 'vault-ready' ? (
              <Button
                className={primary ? 'ax-ghost-cta' : undefined}
                variant={primary ? 'default' : 'outline'}
                nativeButton={false}
                render={<a href="#pf-positions" />}
              >
                {action.kind === 'incentive' ? copy.ctaIncentive : copy.ctaVault}
              </Button>
            ) : (
              <StrandedDialog
                locale={locale}
                triggerLabel={copy.ctaStranded}
                message={strandedMessages.find(
                  (candidate) => candidate.id === action.bridgeMessageId,
                ) ?? {
                  assetSymbol: '',
                  amount: 0,
                  fromChainName: '',
                  toChainName: '',
                  sentAt: '',
                }}
              />
            )

          return (
            <li key={`${action.kind}-${action.verse?.id ?? action.bridgeMessageId ?? index}`}>
              <article className="pf-action" data-tone={tone} data-primary={primary || undefined}>
                <div className="pf-action__head">
                  <h3>{title}</h3>
                  {deadlineNode}
                </div>
                <p className="pf-action__body">{body}</p>
                <p className="pf-action__meta">
                  {action.verse != null ? (
                    <Link href={verseHref(locale, action.verse.id)}>
                      <strong>{action.verse.symbol}</strong> {action.verse.name}
                    </Link>
                  ) : null}
                </p>
                <div className="pf-action__cta">{cta}</div>
              </article>
            </li>
          )
        })}
      </ul>
      <p className="panel-note">{copy.fixedAnchor}</p>
    </section>
  )
}

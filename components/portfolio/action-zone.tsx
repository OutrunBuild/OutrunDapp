'use client'

/**
 * ①待办区 v5（2026-10-05 四轮裁定拆表）：形态跟随导航目标——
 * 卡片层=页内锚点/限时警报（保护窗卡倒计时 hero + 金库取出卡页内 signpost）；
 * 领取层=两张独立 Data surface 面板（周期激励逐 verse 行·窗口剩余升序 ／
 * 创世退款行·金额降序），行行动全部跳 verse 页——单面板双组混排可读性不足，
 * 拆表后各行语义同质。跨链滞留项已删（2026-10-05 用户裁定）。
 * 卡片语法=kind 铭牌 / hero 数字 / KV+CTA 底栏（hairline、等高钉底）；一屏一黄主钮。
 */
import Link from 'next/link'
import { useEffect, useState } from 'react'

import type { FixturePortfolioAction, Locale } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { verseHref } from '../global/routes'
import { formatAmount, SectionHeading } from '../global/signal-ui'
import { Button } from '@/components/ui/button'

const HOUR_MS = 3_600_000
const WINDOW_MS = 24 * HOUR_MS

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

function staticDuration(remainingMs: number) {
  const days = Math.floor(remainingMs / (24 * HOUR_MS))
  const hours = Math.floor((remainingMs % (24 * HOUR_MS)) / HOUR_MS)
  return `${days}d ${hours}h`
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
}: {
  locale: Locale
  actions: FixturePortfolioAction[]
}) {
  const copy = getCopy(locale).portfolio.action
  if (actions.length === 0) return null

  const cards = actions.filter(
    (action) => action.kind === 'protection' || action.kind === 'vault-ready',
  )
  // 领取双表（2026-10-05 四轮裁定拆表）：激励=窗口剩余升序；退款=金额降序
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
              // 金库取出卡：页内 signpost（CTA 锚 #pf-vault），hero=美元待取合计
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
                      <span data-numeric>
                        {copy.vaultReadySub.replace('{n}', String(action.count ?? 0))}
                      </span>
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

            // 保护窗卡：倒计时 hero + 窗口余量条 + 在场本金 KV
            const tone = deadlineTone(action.remainingMs)
            const remainingMs = action.remainingMs ?? 0
            const windowLeft = Math.min(100, Math.round((remainingMs / WINDOW_MS) * 100))
            const clock =
              remainingMs < WINDOW_MS ? (
                <DeadlineClock remainingMs={remainingMs} template={copy.deadlineWithin} />
              ) : (
                <span data-numeric>
                  {copy.deadlineWithin.replace('{t}', staticDuration(remainingMs))}
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
                    <Button
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={verseHref(locale, action.verse?.id ?? '')} />}
                    >
                      {copy.ctaProtection}
                    </Button>
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
                          {copy.deadlineWithin.replace('{t}', staticDuration(action.remainingMs))}
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

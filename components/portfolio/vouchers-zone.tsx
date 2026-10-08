/**
 * ④已参与区（服务端组件；RSC）：阶段分组面板 + 行式清单（2026-10-05 用户裁定重做：
 * 字母表头数字矩阵「不是产品 UI」——行改资产行同款 ledger 节奏：tile 视觉锚 / 身份 +
 * 构成行（单位行内嵌「15.25K POL」、零值省略）/ 右缘主数字 + 日期副行 / 行尾动作；
 * 可领绿数=持仓行主数字，锁定行副行=预计解锁日（创世截止+365d 固定锁期，
 * MemeverseRegistrationLib.sol:14 合约常量）。可领筛选=组件内客户端态按钮（2026-10-08
 * 用户裁定：?claimable=1 URL 导航整页刷新被否，同仓位链筛选先例 positions-zone）；
 * 操作出口深链 verse 详情（PD-02 出口规则：跨 Verse 领取类深链对应 Verse）。
 */
'use client'
import Link from 'next/link'
import { useState } from 'react'

import type { FixtureVoucherRow, Locale, VerseStage } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { localePath, verseHref } from '../global/routes'
import { formatAmount, formatDay, SectionHeading, StageBadge } from '../global/signal-ui'
import { Button } from '@/components/ui/button'

const GROUP_ORDER: VerseStage[] = ['genesis', 'locked', 'unlocked']

/** 构成行：单位行内嵌、零值省略（LP=四池合计不展示——2026-10-05 用户裁定）；全零返回 null */
function MakeupLine({
  locale,
  holdings,
}: {
  locale: Locale
  holdings: NonNullable<FixtureVoucherRow['holdings']>
}) {
  const parts: string[] = []
  if (holdings.pol > 0) parts.push(`${formatAmount(holdings.pol, locale, true)} POL`)
  if (holdings.pt > 0) parts.push(`${formatAmount(holdings.pt, locale, true)} PT`)
  if (holdings.yt > 0) parts.push(`${formatAmount(holdings.yt, locale, true)} YT`)
  if (parts.length === 0) return null
  return <span className="pf-voucher-row__makeup">{parts.join(' · ')}</span>
}

function VoucherRow({ locale, row }: { locale: Locale; row: FixtureVoucherRow }) {
  const copy = getCopy(locale).portfolio.vouchers
  const href = verseHref(locale, row.verse.id)
  const claimable = row.holdings?.claimableYt ?? 0

  // 右缘主数字：创世=参与金额；持仓=可领 YT（success 绿）；无可领=--（与持仓零值同语）
  const state =
    row.genesis != null ? (
      <span className="pf-voucher-row__amount">
        {formatAmount(row.genesis.total, locale, true)}
        <span className="pf-voucher-row__unit">{row.verse.raiseAsset}</span>
      </span>
    ) : claimable > 0 ? (
      <span className="pf-claimable">
        <span className="pf-voucher-row__amount">
          +{formatAmount(claimable, locale, true)}
          <span className="pf-voucher-row__unit">YT</span>
        </span>
      </span>
    ) : (
      <span className="pf-voucher-row__none" aria-hidden="true">
        --
      </span>
    )

  // 日期副行：锁定=预计解锁日（截止+365d）；创世与已解锁行无
  const dateLine =
    row.verse.stage === 'locked' ? (
      <span className="pf-voucher-row__date">
        {copy.unlocksOn.replace('{d}', formatDay(row.verse.unlockAt, locale))}
      </span>
    ) : null

  // 构成行：创世=截止日；持仓=POL/PT/YT 构成
  const makeup =
    row.holdings != null ? (
      <MakeupLine locale={locale} holdings={row.holdings} />
    ) : (
      <span className="pf-voucher-row__note">
        {copy.endsOn.replace('{d}', formatDay(row.verse.endsAt, locale))}
      </span>
    )

  const cta = claimable > 0 ? copy.claim : copy.manage

  return (
    <li className="pf-voucher-row">
      <span className="pf-voucher-row__tile" aria-hidden="true">
        <span className="pf-voucher-row__glyph">{row.verse.symbol[0]}</span>
      </span>
      <div className="pf-voucher-row__id">
        <Link href={href} className="pf-voucher-row__verse">
          <strong>{row.verse.symbol}</strong>
          {row.genesis != null ? (
            <span className="pf-vouchers__flags">
              {row.genesis.stakeRoute ? (
                <span className="pf-vouchers__flag">{copy.routeStake}</span>
              ) : null}
              {row.genesis.leverage > 0 ? (
                <span className="pf-vouchers__flag">{copy.kindLeverage}</span>
              ) : null}
              {row.genesis.preorder > 0 ? (
                <span className="pf-vouchers__flag">{copy.kindPreorder}</span>
              ) : null}
            </span>
          ) : null}
        </Link>
        {makeup}
      </div>
      <div className="pf-voucher-row__state">
        {state}
        {dateLine}
      </div>
      <div className="pf-voucher-row__action">
        <Link href={href} className="pf-table__link">
          {cta}
        </Link>
      </div>
    </li>
  )
}

export function VouchersZone({ locale, rows }: { locale: Locale; rows: FixtureVoucherRow[] }) {
  const copy = getCopy(locale).portfolio.vouchers
  const [claimableOnly, setClaimableOnly] = useState(false)
  const claimableCount = rows.filter((row) => (row.holdings?.claimableYt ?? 0) > 0).length
  const visible = claimableOnly
    ? rows.filter((row) => (row.holdings?.claimableYt ?? 0) > 0)
    : rows

  const filterToggle = claimableCount > 0 && (
    <nav className="pf-vouchers__filter" aria-label={copy.filterClaimable}>
      <button
        type="button"
        aria-pressed={!claimableOnly}
        data-selected={!claimableOnly || undefined}
        onClick={() => setClaimableOnly(false)}
      >
        {copy.filterAll}
      </button>
      <button
        type="button"
        aria-pressed={claimableOnly}
        data-selected={claimableOnly || undefined}
        onClick={() => setClaimableOnly(true)}
      >
        {`${copy.filterClaimable} (${claimableCount})`}
      </button>
    </nav>
  )

  if (rows.length === 0) {
    return (
      <section className="pf-vouchers" id="pf-vouchers">
        <SectionHeading title={copy.title} description={copy.sub} />
        <div className="empty-state">
          <h3>{copy.empty}</h3>
          <Button
            className="ax-ghost-cta"
            nativeButton={false}
            render={<Link href={localePath(locale, '/memeverse/explore')} />}
          >
            {copy.emptyCta}
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section className="pf-vouchers" id="pf-vouchers">
      <SectionHeading title={copy.title} description={copy.sub} aside={filterToggle} />
      <div className="pf-vouchers__groups">
        {GROUP_ORDER.map((stage) => {
          const group = visible.filter((row) => row.verse.stage === stage)
          if (group.length === 0) return null
          return (
            <div key={stage} className="pf-vouchers__group" data-stage={stage}>
              {/* 017 面板化：材质/投影随 .pf-panel 原语；阶段主线=面板首 child 元素 */}
              <div className="pf-panel">
                <i className="pf-vouchers__stage-line" aria-hidden="true" />
                <header className="pf-vouchers__group-head">
                  <StageBadge stage={stage} locale={locale} />
                  <span data-numeric>{group.length}</span>
                </header>
                <ul className="pf-vouchers__list">
                  {group.map((row) => (
                    <VoucherRow key={row.verse.id} locale={locale} row={row} />
                  ))}
                </ul>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

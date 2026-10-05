/**
 * ④参与凭证区（服务端组件；RSC）：阶段分组面板 + 行式清单（2026-10-05 用户裁定重做：
 * 字母表头数字矩阵「不是产品 UI」——行改资产行同款 ledger 节奏：tile 视觉锚 / 身份 +
 * 构成行（单位行内嵌「15.25K POL」、零值省略）/ 右缘主数字 + 日期副行 / 行尾动作；
 * 可领绿数=持仓行主数字，锁定行副行=预计解锁日（创世截止+365d 固定锁期，
 * MemeverseRegistrationLib.sol:14 合约常量）。可领筛选走 URL 状态（?claimable=1，
 * 发现页 ?stage= 同款模式：链接可分享、可后退、零客户端态）；操作出口深链 verse
 * 详情（PD-02 出口规则：跨 Verse 领取类深链对应 Verse）。
 */
import Link from 'next/link'

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

  // 构成行：创世=截止日；持仓=凭证构成
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

export function VouchersZone({
  locale,
  rows,
  claimableOnly,
  claimableCount,
}: {
  locale: Locale
  rows: FixtureVoucherRow[]
  /** ?claimable=1 → 仅显示 claimableYt>0 的持仓行 */
  claimableOnly: boolean
  claimableCount: number
}) {
  const copy = getCopy(locale).portfolio.vouchers
  const baseHref = localePath(locale, '/portfolio')
  const visible = claimableOnly
    ? rows.filter((row) => (row.holdings?.claimableYt ?? 0) > 0)
    : rows

  const filterToggle = claimableCount > 0 && (
    <nav className="pf-vouchers__filter" aria-label={copy.filterClaimable}>
      <a
        href={baseHref}
        aria-current={claimableOnly ? undefined : 'page'}
        data-selected={!claimableOnly || undefined}
      >
        {copy.filterAll}
      </a>
      <a
        href={`${baseHref}?claimable=1`}
        aria-current={claimableOnly ? 'page' : undefined}
        data-selected={claimableOnly || undefined}
      >
        {`${copy.filterClaimable} (${claimableCount})`}
      </a>
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
          )
        })}
      </div>
    </section>
  )
}

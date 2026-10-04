/**
 * ④参与凭证区（服务端组件；RSC）：阶段分组表——创世中=参与记录（未来凭证），
 * 锁定中/已解锁=POL/PT/YT/LP 持仓；分组序=生命周期方向。可领筛选走 URL 状态
 * （?claimable=1，发现页 ?stage= 同款模式：链接可分享、可后退、零客户端态）。
 * 可领数字 success 绿；操作出口深链 verse 详情（操作弹窗群已住在那里——
 * PD-02 出口规则：跨 Verse 领取类深链对应 Verse）。
 */
import Link from 'next/link'

import type { FixtureVoucherRow, Locale, VerseStage } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { localePath, verseHref } from '../global/routes'
import { formatAmount, formatStamp, SectionHeading, StageBadge } from '../global/signal-ui'
import { Button } from '@/components/ui/button'

const GROUP_ORDER: VerseStage[] = ['genesis', 'locked', 'unlocked']

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
              <div className="pf-table-wrap">
                <table className="pf-table">
                  <thead>
                    <tr>
                      <th scope="col">Verse</th>
                      {stage === 'genesis' ? (
                        <>
                          <th scope="col">{copy.genesisParticipating}</th>
                          <th scope="col">{getCopy(locale).discovery.genesisEndtime}</th>
                        </>
                      ) : (
                        <>
                          <th scope="col">POL</th>
                          <th scope="col">PT</th>
                          <th scope="col">YT</th>
                          <th scope="col">LP</th>
                          <th scope="col">{copy.claimableCell}</th>
                        </>
                      )}
                      <th scope="col" aria-label={copy.manage} />
                    </tr>
                  </thead>
                  <tbody>
                    {group.map((row) => (
                      <tr key={row.verse.id}>
                        <th scope="row">
                          <Link href={verseHref(locale, row.verse.id)}>
                            <strong>{row.verse.symbol}</strong> {row.verse.name}
                          </Link>
                        </th>
                        {row.genesis != null ? (
                          <>
                            <td>
                              <span data-numeric>
                                {formatAmount(row.genesis.total, locale, true)}{' '}
                                {row.verse.raiseAsset}
                              </span>
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
                            </td>
                            <td data-numeric>{formatStamp(row.verse.endsAt)}</td>
                            <td>
                              <Link href={verseHref(locale, row.verse.id)} className="pf-table__link">
                                {copy.participateCta}
                              </Link>
                            </td>
                          </>
                        ) : row.holdings != null ? (
                          <>
                            <td data-numeric>{formatAmount(row.holdings.pol, locale, true)}</td>
                            <td data-numeric>{formatAmount(row.holdings.pt, locale, true)}</td>
                            <td data-numeric>{formatAmount(row.holdings.yt, locale, true)}</td>
                            <td data-numeric>{formatAmount(row.holdings.lp, locale, true)}</td>
                            <td>
                              {row.holdings.claimableYt > 0 ? (
                                <span className="pf-claimable">
                                  <span data-numeric>
                                    +{formatAmount(row.holdings.claimableYt, locale, true)}
                                  </span>
                                  {row.holdings.ytRedeemUAssetPerUnit != null ? (
                                    <small data-numeric>
                                      {copy.ytRedeemHint
                                        .replace(
                                          '{v}',
                                          row.holdings.ytRedeemUAssetPerUnit.toFixed(4),
                                        )
                                        .replace('{asset}', row.verse.raiseAsset)}
                                    </small>
                                  ) : null}
                                </span>
                              ) : (
                                <span aria-hidden="true">--</span>
                              )}
                            </td>
                            <td>
                              <Link href={verseHref(locale, row.verse.id)} className="pf-table__link">
                                {row.holdings.claimableYt > 0 ? copy.claim : copy.manage}
                              </Link>
                            </td>
                          </>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>
      <p className="panel-note">{getCopy(locale).portfolio.action.fixedAnchor}</p>
    </section>
  )
}

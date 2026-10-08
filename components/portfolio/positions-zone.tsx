'use client'

/**
 * ③OutStake 三分区（2026-10-02 用户裁定：头寸/储蓄/收益金库不混排，单独拆开）：
 * 质押仓位=OutrunStakingPositionUpgradeable（stakeForGenesis 原子开仓 + redeem）；
 * 储蓄=OutrunUSRVaultUpgradeable（存取 + usrRate/accrualIndex）；
 * 收益金库=Memeverse MemecoinYieldVault（requestRedeem → REDEEM_DELAY → redeem/withdraw
 * 领回；**金库上无激励功能**——周期激励属 GovernanceCycleIncentivizerUpgradeable.claimReward，
 * 只出现在①待办聚合卡）。金库行操作深链 verse 金库页签（Memeverse 域操作住在 verse 页）。
 */
import Link from 'next/link'
import { useState } from 'react'

import type {
  FixtureCdpPosition,
  FixtureUsrSavings,
  FixtureVaultRow,
  Locale,
} from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { ChainLogoMark } from '../global/chain-icons'
import { verseHref } from '../global/routes'
import { formatAmount, formatMarketCap, formatPercent, SectionHeading } from '../global/signal-ui'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CdpRedeemDialog, UsrSavingsDialog } from './portfolio-dialogs'

/**
 * ③质押仓位（2026-10-04 用户裁定：卡片网格→面板+表格）：仓位事实集合同构
 * （链/抵押/债务/生息来源/唯一动作），行数随参与创世线性增长——同构多行单一动作
 * 用表格（合约 redeem(positionId) 逐仓操作、无批量，OutrunStakingPositionUpgradeable.sol:217）。
 * 链筛选=组件内客户端态（同日二轮修订：URL ?chain 导航整页刷新被否，筛选只换表格内容）；
 * 铭牌行=计数 + 按锚族债务合计。
 */
export function StakedPositionsZone({
  locale,
  cdpPositions,
  uAssetBalances,
}: {
  locale: Locale
  cdpPositions: FixtureCdpPosition[]
  uAssetBalances: Record<string, number>
}) {
  const copy = getCopy(locale).portfolio.positions
  const [chainFilter, setChainFilter] = useState<number | null>(null)
  if (cdpPositions.length === 0) return null

  const chainList = [...new Map(cdpPositions.map((p) => [p.chainId, p.chainName]))]
  const filterActive = chainFilter != null && chainList.some(([id]) => id === chainFilter)
  const visible = filterActive
    ? cdpPositions.filter((p) => p.chainId === chainFilter)
    : cdpPositions
  // 最大敞口优先（合约 Position 无时间戳，「按新近」不可得）
  const rows = [...visible].sort((a, b) => b.debt - a.debt)

  const owed = new Map<string, number>()
  for (const position of visible) {
    owed.set(position.uAssetSymbol, (owed.get(position.uAssetSymbol) ?? 0) + position.debt)
  }
  // 族序=合计降序（确定序，不随筛选漂移）
  const owedRows = [...owed].sort((a, b) => b[1] - a[1])

  const filterChips =
    chainList.length >= 2 && (
      <nav className="pf-positions__filter" aria-label={copy.filterLabel}>
        <button
          type="button"
          aria-pressed={!filterActive}
          data-selected={!filterActive || undefined}
          onClick={() => setChainFilter(null)}
        >
          {copy.filterAll}
        </button>
        {chainList.map(([chainId, chainName]) => {
          const selected = filterActive && chainFilter === chainId
          return (
            <button
              key={chainId}
              type="button"
              aria-pressed={selected}
              data-selected={selected || undefined}
              onClick={() => setChainFilter(chainId)}
            >
              {chainName}
            </button>
          )
        })}
      </nav>
    )

  return (
    <section className="pf-positions" id="pf-positions">
      <SectionHeading title={copy.title} description={copy.sub} aside={filterChips} />
      <div className="pf-panel">
        <header className="pf-panel__bar">
          <span>
            {copy.cdpBadge} · <span data-numeric>{rows.length}</span>
          </span>
          <span className="pf-positions__owed">
            {copy.owed}
            {owedRows.map(([symbol, total], index) => (
              <span key={symbol} data-numeric>
                {index > 0 ? ' · ' : ' '}
                {formatAmount(total, locale)} {symbol}
              </span>
            ))}
          </span>
        </header>
        <div className="pf-table-wrap">
          <table className="pf-table">
            <colgroup>
              {/* 列序/列宽（2026-10-04 用户裁定「Source 与 Borrowed 贴太近」二轮）：
                  在哪居左（链+来源），多少+操作居右（资产区行同款分组语义）——
                  fixed 比例分配，Source 吸剩余松弛成组间呼吸带 */}
              <col className="pf-positions__col-chain" />
              <col />
              <col className="pf-positions__col-coll" />
              <col className="pf-positions__col-borr" />
              <col className="pf-positions__col-act" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">{copy.colChain}</th>
                <th scope="col">{copy.colSource}</th>
                <th scope="col" data-numeric>
                  {copy.cdpCollateral}
                </th>
                <th scope="col" data-numeric>
                  {copy.cdpBorrowed}
                </th>
                <th scope="col" aria-label={copy.cdpRedeem} />
              </tr>
            </thead>
            <tbody>
              {rows.map((position) => {
                const balance = uAssetBalances[position.uAssetSymbol] ?? null
                return (
                  <tr key={position.id}>
                    <th scope="row">
                      {/*
                        链列=图标+悬停气泡（2026-10-04 用户裁定）：全链图标官方可辨，
                        链名退为 tooltip；SR 名字走 Trigger aria-label（img alt="" 无声）。
                      */}
                      <Tooltip>
                        <TooltipTrigger
                          aria-label={position.chainName}
                          className="pf-positions__chain"
                        >
                          <ChainLogoMark chainId={position.chainId} size={16} />
                        </TooltipTrigger>
                        <TooltipContent>{position.chainName}</TooltipContent>
                      </Tooltip>
                    </th>
                    <td>{position.yieldSource}</td>
                    <td data-numeric>
                      {formatAmount(position.collateralAmount, locale)} {position.collateralSymbol}
                    </td>
                    <td data-numeric>
                      {formatAmount(position.debt, locale)} {position.uAssetSymbol}
                    </td>
                    <td>
                      <div className="pf-positions__act">
                        <CdpRedeemDialog
                          locale={locale}
                          appearance="link"
                          triggerLabel={copy.cdpRedeem}
                          uAssetSymbol={position.uAssetSymbol}
                          collateralSymbol={position.collateralSymbol}
                          collateralAmount={position.collateralAmount}
                          debt={position.debt}
                          uAssetBalance={balance}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {/* 移动端堆叠台账行（决议 018）：≤54rem 表格隐藏、此清单接管——身份行
            （链标+来源+赎回）+ 事实双列（抵押/借入，复用列头文案）；桌面 display:none */}
        <ul className="pf-mrows">
          {rows.map((position) => (
            <li key={position.id} className="pf-mrow">
              <div className="pf-mrow__head">
                <span className="pf-mrow__id">
                  <ChainLogoMark chainId={position.chainId} size={20} />
                  <strong>{position.yieldSource}</strong>
                </span>
                <CdpRedeemDialog
                  locale={locale}
                  appearance="link"
                  triggerLabel={copy.cdpRedeem}
                  uAssetSymbol={position.uAssetSymbol}
                  collateralSymbol={position.collateralSymbol}
                  collateralAmount={position.collateralAmount}
                  debt={position.debt}
                  uAssetBalance={uAssetBalances[position.uAssetSymbol] ?? null}
                />
              </div>
              <dl className="pf-mrow__facts">
                <div>
                  <dt>{copy.cdpCollateral}</dt>
                  <dd data-numeric>
                    {formatAmount(position.collateralAmount, locale)} {position.collateralSymbol}
                  </dd>
                </div>
                <div>
                  <dt>{copy.cdpBorrowed}</dt>
                  <dd data-numeric>
                    {formatAmount(position.debt, locale)} {position.uAssetSymbol}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/**
 * ③储蓄卡（2026-10-04 用户裁定重做：主数字=存款价值（资产行右缘同款 22px data 档），
 * 份额降为副行凭证记号；利率行=APY 标签+% 数值——同日二轮裁定状态词（Earning 等）
 * 与三句语义句全删、「没意义」，未激活显 0%、capped 不再显示，三态回归纯数值二态。
 * 零新增 fixture 数据（Q1-4 否决）。
 */
export function SavingsZone({
  locale,
  usrSavings,
  uAssetBalances,
}: {
  locale: Locale
  usrSavings: FixtureUsrSavings[]
  uAssetBalances: Record<string, number>
}) {
  const copy = getCopy(locale).portfolio.savings
  if (usrSavings.length === 0) return null

  return (
    <section className="pf-savings" id="pf-savings">
      <SectionHeading title={copy.title} description={copy.sub} />
      <div className="pf-holdings">
        {usrSavings.map((vault) => (
          <article key={vault.id} className="pf-card" data-type="usr">
            <div className="pf-card__bar">
              <span>{copy.badge}</span>
              <span className="pf-card__chain">
                <ChainLogoMark chainId={vault.chainId} size={12} aria-hidden="true" />
                {vault.chainName}
              </span>
            </div>
            <div className="pf-card__holding">
              <span className="pf-card__hero" data-numeric>
                {formatAmount(vault.myAssets, locale)} {vault.uAssetSymbol}
              </span>
              {vault.usdSample != null ? (
                <span className="pf-card__sub" data-numeric>
                  ≈ ${formatMarketCap(vault.myAssets * vault.usdSample)}
                </span>
              ) : null}
            </div>
            <dl className="pf-card__facts">
              <div>
                <dt>{copy.apy}</dt>
                <dd>
                  <span data-numeric data-state={vault.rateActive ? 'active' : 'inactive'}>
                    {formatPercent(vault.rate * 100, locale)}%
                  </span>
                </dd>
              </div>
              <div>
                <dt>{copy.sharesLabel}</dt>
                <dd data-numeric>
                  {formatAmount(vault.myShares, locale)} {vault.shareSymbol}
                </dd>
              </div>
            </dl>
            <div className="pf-card__actions">
              <UsrSavingsDialog
                locale={locale}
                triggerLabel={copy.depositCta}
                mode="deposit"
                vault={vault}
                uAssetBalance={uAssetBalances[vault.uAssetSymbol] ?? null}
              />
              <UsrSavingsDialog
                locale={locale}
                triggerLabel={copy.withdrawCta}
                mode="withdraw"
                vault={vault}
                uAssetBalance={uAssetBalances[vault.uAssetSymbol] ?? null}
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export function VaultZone({ locale, vaultRows }: { locale: Locale; vaultRows: FixtureVaultRow[] }) {
  const copy = getCopy(locale).portfolio.vault
  if (vaultRows.length === 0) return null

  return (
    <section className="pf-vault" id="pf-vault">
      <SectionHeading title={copy.title} description={copy.sub} />
      <div className="pf-panel">
        <header className="pf-panel__bar">
          <span>{copy.shares}</span>
          <span data-numeric>{vaultRows.length}</span>
        </header>
        <div className="pf-table-wrap">
          <table className="pf-table">
            <thead>
              <tr>
                <th scope="col">Verse</th>
                <th scope="col" data-numeric className="pf-vault__col-shares">
                  <span className="pf-vault__num">{copy.shares}</span>
                </th>
                <th scope="col" data-numeric className="pf-vault__col-apy">
                  <span className="pf-vault__num">{copy.apy}</span>
                </th>
                <th scope="col" data-numeric className="pf-vault__col-redeems">
                  <span className="pf-vault__num">{copy.redeems}</span>
                </th>
                <th scope="col" aria-label={copy.withdrawCta} />
              </tr>
            </thead>
            <tbody>
              {vaultRows.map((row) => (
                <tr key={row.verse.id}>
                  <th scope="row">
                    {/* 阶段徽标不进库存单（2026-10-04 用户裁定）：行身份=verse 符号即可 */}
                    <Link href={verseHref(locale, row.verse.id)}>
                      <strong>{row.verse.symbol}</strong>
                    </Link>
                  </th>
                  <td data-numeric className="pf-vault__col-shares">
                    <span className="pf-vault__num">
                      {formatAmount(row.myShares, locale, true)} {row.shareSymbol}
                    </span>
                  </td>
                  <td data-numeric className="pf-vault__col-apy">
                    <span className="pf-vault__num">{formatPercent(row.apy7d, locale)}%</span>
                  </td>
                  <td data-numeric className="pf-vault__col-redeems">
                    {row.readyTotal > 0 ? (
                      <span className="pf-claimable pf-vault__num">
                        <span data-numeric>
                          {formatAmount(row.readyTotal, locale, true)} {row.verse.symbol}
                        </span>
                        <small>{copy.ready}</small>
                      </span>
                    ) : row.waitingTotal > 0 ? (
                      <span className="pf-claimable pf-vault__num" data-kind="waiting">
                        <span data-numeric>
                          {formatAmount(row.waitingTotal, locale, true)} {row.verse.symbol}
                        </span>
                        <small>{copy.waiting}</small>
                      </span>
                    ) : (
                      <span aria-hidden="true" className="pf-vault__num">
                        --
                      </span>
                    )}
                  </td>
                  <td>
                    {/* Stake 常驻（深链金库页签，Stake 卡即首屏）；Withdraw 仅在有成熟赎回时
                        出现、深链金库页签并直落 Withdraw 子页签（2026-10-04 用户裁定） */}
                    <div className="pf-vault__act">
                      {row.readyTotal > 0 ? (
                        <Link
                          href={verseHref(locale, row.verse.id, 'vault', 'withdraw')}
                          className="pf-table__link"
                        >
                          {copy.withdrawCta}
                        </Link>
                      ) : null}
                      <Link href={verseHref(locale, row.verse.id, 'vault')} className="pf-table__link">
                        {copy.stakeCta}
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* 移动端堆叠台账行（决议 018）：verse 身份 + Stake/Withdraw 深链 + 事实列
            （份额/7日年化/赎回状态，绿=可取出）；桌面 display:none */}
        <ul className="pf-mrows">
          {vaultRows.map((row) => (
            <li key={row.verse.id} className="pf-mrow">
              <div className="pf-mrow__head">
                <Link href={verseHref(locale, row.verse.id)} className="pf-mrow__verse">
                  <strong>{row.verse.symbol}</strong>
                </Link>
                <span className="pf-mrow__act">
                  {row.readyTotal > 0 ? (
                    <Link
                      href={verseHref(locale, row.verse.id, 'vault', 'withdraw')}
                      className="pf-table__link"
                    >
                      {copy.withdrawCta}
                    </Link>
                  ) : null}
                  <Link href={verseHref(locale, row.verse.id, 'vault')} className="pf-table__link">
                    {copy.stakeCta}
                  </Link>
                </span>
              </div>
              <dl className="pf-mrow__facts">
                <div>
                  <dt>{copy.shares}</dt>
                  <dd data-numeric>
                    {formatAmount(row.myShares, locale, true)} {row.shareSymbol}
                  </dd>
                </div>
                <div>
                  <dt>{copy.apy}</dt>
                  <dd data-numeric>{formatPercent(row.apy7d, locale)}%</dd>
                </div>
                <div>
                  <dt>{copy.redeems}</dt>
                  <dd>
                    {row.readyTotal > 0 ? (
                      <span className="pf-claimable">
                        <span data-numeric>
                          {formatAmount(row.readyTotal, locale, true)} {row.verse.symbol}
                        </span>
                        <small>{copy.ready}</small>
                      </span>
                    ) : row.waitingTotal > 0 ? (
                      <span className="pf-claimable" data-kind="waiting">
                        <span data-numeric>
                          {formatAmount(row.waitingTotal, locale, true)} {row.verse.symbol}
                        </span>
                        <small>{copy.waiting}</small>
                      </span>
                    ) : (
                      <span className="pf-participation-row__none" aria-hidden="true">
                        --
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

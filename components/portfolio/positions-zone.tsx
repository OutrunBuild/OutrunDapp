'use client'

/**
 * ③仓位与储蓄区（2026-10-02 裁定）：OutStake 域（CDP 质押仓位 + USR 储蓄）为异构
 * 少量 → 卡网格（economy-grid 先例）；收益库存单为同构多行 → 紧凑表（表格为扫描
 * 与比较而生）。质押仓位显示来源 Verse（route=openedFor 互链叙事）。就地操作全部
 * 弹窗（CdpRedeem/UsrSavings/VaultExecute）；周期激励领取深链 verse 详情治理页签。
 */
import Link from 'next/link'

import type {
  FixtureCdpPosition,
  FixtureUsrSavings,
  FixtureVaultRow,
  Locale,
} from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { verseHref } from '../global/routes'
import { formatAmount, formatDay, formatPercent, SectionHeading, StageBadge } from '../global/signal-ui'
import { CdpRedeemDialog, UsrSavingsDialog, VaultExecuteDialog } from './portfolio-dialogs'

export function PositionsZone({
  locale,
  cdpPositions,
  usrSavings,
  vaultRows,
  uAssetBalances,
}: {
  locale: Locale
  cdpPositions: FixtureCdpPosition[]
  usrSavings: FixtureUsrSavings[]
  vaultRows: FixtureVaultRow[]
  /** 钱包 uAsset 余额表（赎回弹窗 Max 来源） */
  uAssetBalances: Record<string, number>
}) {
  const copy = getCopy(locale).portfolio.positions

  return (
    <section className="pf-positions" id="pf-positions">
      <SectionHeading title={copy.title} description={copy.sub} />

      {(cdpPositions.length > 0 || usrSavings.length > 0) && (
        <div className="pf-holdings">
          {cdpPositions.map((position) => (
            <article key={position.id} className="pf-card" data-type="cdp">
              <div className="pf-card__bar">
                <span>{copy.cdpBadge}</span>
                <span className="pf-card__chain">{position.chainName}</span>
              </div>
              <dl className="pf-card__facts">
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
              <p className="pf-card__meta">{position.yieldSource}</p>
              {position.openedFor != null ? (
                <p className="pf-card__source">
                  <Link href={verseHref(locale, position.openedFor.id)}>
                    {copy.cdpSource.replace('{name}', position.openedFor.name)}
                  </Link>
                </p>
              ) : null}
              <p className="pf-card__note">{copy.cdpPlain}</p>
              <CdpRedeemDialog
                locale={locale}
                triggerLabel={copy.cdpRedeem}
                uAssetSymbol={position.uAssetSymbol}
                collateralSymbol={position.collateralSymbol}
                collateralAmount={position.collateralAmount}
                debt={position.debt}
                uAssetBalance={uAssetBalances[position.uAssetSymbol] ?? null}
              />
            </article>
          ))}

          {usrSavings.map((vault) => (
            <article key={vault.id} className="pf-card" data-type="usr">
              <div className="pf-card__bar">
                <span>{copy.usrBadge}</span>
                <span className="pf-card__chain">{vault.chainName}</span>
              </div>
              <dl className="pf-card__facts">
                <div>
                  <dt>{copy.usrRate}</dt>
                  <dd>
                    {vault.rateActive ? (
                      <span data-numeric data-state="active">
                        {formatPercent(vault.rate * 100, locale)}
                      </span>
                    ) : (
                      <span data-state="inactive">{copy.usrStateInactive}</span>
                    )}
                    {vault.capped ? (
                      <span className="pf-card__flag" data-state="capped">
                        {copy.usrStateCapped}
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt>{copy.usrMyDeposit}</dt>
                  <dd data-numeric>
                    {formatAmount(vault.myAssets, locale)} {vault.uAssetSymbol}
                  </dd>
                </div>
              </dl>
              <p className="pf-card__meta">
                <span data-numeric>{formatAmount(vault.myShares, locale)}</span> {vault.shareSymbol}
              </p>
              <div className="pf-card__actions">
                <UsrSavingsDialog
                  locale={locale}
                  triggerLabel={copy.usrDepositCta}
                  mode="deposit"
                  vault={vault}
                  uAssetBalance={uAssetBalances[vault.uAssetSymbol] ?? null}
                />
                <UsrSavingsDialog
                  locale={locale}
                  triggerLabel={copy.usrWithdrawCta}
                  mode="withdraw"
                  vault={vault}
                  uAssetBalance={uAssetBalances[vault.uAssetSymbol] ?? null}
                />
              </div>
            </article>
          ))}
        </div>
      )}

      {vaultRows.length > 0 ? (
        <div className="pf-panel">
          <header className="pf-panel__bar">
            <span>{copy.vaultBadge}</span>
            <span data-numeric>{vaultRows.length}</span>
          </header>
          <div className="pf-table-wrap">
            <table className="pf-table">
            <thead>
              <tr>
                <th scope="col">Verse</th>
                <th scope="col">{copy.vaultShares}</th>
                <th scope="col">{copy.vaultValue}</th>
                <th scope="col">{copy.vaultApy}</th>
                <th scope="col">{copy.vaultPending}</th>
                <th scope="col">{copy.vaultIncentive}</th>
                <th scope="col" aria-label={copy.vaultExecute} />
              </tr>
            </thead>
            <tbody>
              {vaultRows.map((row) => (
                <tr key={row.verse.id}>
                  <th scope="row">
                    <Link href={verseHref(locale, row.verse.id)}>
                      <strong>{row.verse.symbol}</strong>
                    </Link>
                    <StageBadge stage={row.verse.stage} locale={locale} />
                  </th>
                  <td data-numeric>
                    {formatAmount(row.myShares, locale, true)} {row.shareSymbol}
                  </td>
                  <td data-numeric>{formatAmount(row.shareValue, locale, true)}</td>
                  <td data-numeric>{formatPercent(row.apy7d, locale)}</td>
                  <td>
                    {row.readyTotal > 0 ? (
                      <VaultExecuteDialog
                        locale={locale}
                        triggerLabel={copy.vaultExecute}
                        verseSymbol={row.verse.symbol}
                        shareSymbol={row.shareSymbol}
                        readyTotal={row.readyTotal}
                        waitingCount={row.waitingCount}
                      />
                    ) : row.waitingCount > 0 ? (
                      <span data-numeric>{copy.vaultWaiting.replace('{n}', String(row.waitingCount))}</span>
                    ) : (
                      <span aria-hidden="true">--</span>
                    )}
                  </td>
                  <td>
                    {row.incentive != null ? (
                      <span className="pf-claimable">
                        <span data-numeric>{formatAmount(row.incentive.claimable, locale, true)}</span>
                        <small data-numeric>
                          {copy.vaultWindowEnds.replace(
                            '{date}',
                            formatDay(row.incentive.windowEndsAt, locale),
                          )}
                        </small>
                      </span>
                    ) : (
                      <span aria-hidden="true">--</span>
                    )}
                  </td>
                  <td>
                    {row.incentive != null ? (
                      <Link href={verseHref(locale, row.verse.id)} className="pf-table__link">
                        {copy.vaultClaim}
                      </Link>
                    ) : (
                      <Link href={verseHref(locale, row.verse.id)} className="pf-table__link">
                        {getCopy(locale).portfolio.vouchers.manage}
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  )
}

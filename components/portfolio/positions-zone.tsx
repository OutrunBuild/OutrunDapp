'use client'

/**
 * (3) OutStake three sections (positions/savings/yield vault are separate sections, not
 * mixed): staked positions = OutrunStakingPositionUpgradeable
 * (stakeForGenesis atomic open + redeem); savings = OutrunUSRVaultUpgradeable (deposit/withdraw
 * + usrRate/accrualIndex); yield vault = Memeverse MemecoinYieldVault (requestRedeem →
 * REDEEM_DELAY → redeem/withdraw to claim back; **no incentive feature on the vault** — periodic
 * incentives belong to GovernanceCycleIncentivizerUpgradeable.claimReward and appear only in the
 * (1) to-do aggregation card). Vault row actions deep-link to the verse vault tab (Memeverse
 * domain actions live on the verse page).
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
 * (3) Staked positions (panel + table layout): position fact sets
 * are homogeneous (chain / collateral / debt / yield source / single action), row count grows
 * linearly with genesis participation — homogeneous many-row single-action uses a table (the
 * contract's redeem(positionId) operates per position, no batching).
 * Chain filter = in-component client state (URL ?chain navigation would cause a full page
 * refresh; the filter swaps only the table content); the nameplate row = count + debt total per
 * uAsset family (the uAsset is each family's anchor).
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
  // Largest exposure first (the contract's Position has no timestamp, "most recent" is
  // unobtainable)
  const rows = [...visible].sort((a, b) => b.debt - a.debt)

  const owed = new Map<string, number>()
  for (const position of visible) {
    owed.set(position.uAssetSymbol, (owed.get(position.uAssetSymbol) ?? 0) + position.debt)
  }
  // Family order = totals descending (deterministic order, does not drift with filtering)
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
              {/* Column order/width: identity columns go left (chain + source); amount + action go
                  right (same grouping semantics as the asset-zone rows) — fixed proportional
                  allocation; Source absorbs the remaining slack as an inter-group breathing band */}
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
                        Chain column = icon + hover bubble: the chain
                        icons are officially recognizable; chain names demote to tooltip; the SR
                        name goes through the Trigger aria-label (img alt="" is silent).
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
        {/* Mobile stacked ledger rows: ≤54rem hides the table and this list takes
            over — identity row (chain mark + source + redeem) + two fact columns (collateral/
            borrowed, reusing the column header copy); display:none on desktop */}
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
 * (3) Savings card: main number = deposit value (same 22px data
 * step as the asset row's right edge), shares demoted to a subline credential marker; rate row =
 * APY label + % value only — no status words, no semantic sentences;
 * inactive renders 0% and no separate capped state; active/inactive form a pure numeric
 * two-state.
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
                    {/* Stage badges stay out of the holdings table: the row
                        identity = the verse symbol suffices */}
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
                    {/* Stake is permanent (deep-links the vault tab, where the Stake card is the
                        first screen); Withdraw appears only when mature redeems exist, deep-linking
                        the vault tab and landing directly on the Withdraw sub-tab */}
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
        {/* Mobile stacked ledger rows: verse identity + Stake/Withdraw deep links +
            fact columns (shares / 7-day APY / redeem status, green = withdrawable); display:none
            on desktop */}
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

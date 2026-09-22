import type {
  Locale,
  PrototypeGovernanceState,
  PrototypePolPosition,
  PrototypeVerse,
  PrototypeVerseTrade,
} from '@/lib/data/prototype-repository'

import { Button } from '@/components/ui/button'
import { CopyAddress } from './copy-address'
import { getCopy } from './copy'
import { formatAmount, formatMarketCap, formatPercent, formatStamp, SourceRef } from './signal-ui'

function Slot({ children }: { children: React.ReactNode }) {
  return <span className="ax-slot">{children}</span>
}

/** Liquidity 标签：四池总览 + 池卡（four-pools.md:9-14；APR/量=样本+读链槽位） */
export function LiquidityPanel({ locale, trade }: { locale: Locale; trade: PrototypeVerseTrade }) {
  const copy = getCopy(locale).verseDesk
  const roleKeys = {
    main: copy.poolRoleMain,
    'pol-uasset': copy.poolRolePolUasset,
    'pt-uasset': copy.poolRolePtUasset,
    'pt-pol': copy.poolRolePtPol,
  } as const
  const volumeTotal = trade.tokenStats.volume24h

  return (
    <div className="liquidity-panel">
      <h3>{copy.liquidityTitle}</h3>
      <dl className="liquidity-panel__overview" data-numeric>
        <div>
          <dt>{copy.totalValueLocked}</dt>
          <dd>{formatMarketCap(trade.tokenStats.liquidity)}</dd>
        </div>
        <div>
          <dt>{copy.liquidityVolume}</dt>
          <dd>{volumeTotal != null ? formatMarketCap(volumeTotal) : <Slot>{copy.onChainSlot}</Slot>}</dd>
        </div>
      </dl>
      <h4>{copy.poolsTitle}</h4>
      <ul className="liquidity-panel__pools">
        {trade.pools.map((pool) => (
          <li key={pool.id} className="pool-card" data-pool={pool.pool}>
            <div className="pool-card__head">
              <strong data-numeric>
                {pool.baseSymbol}/{pool.quoteSymbol}
              </strong>
              <span>{roleKeys[pool.pool]}</span>
            </div>
            <dl className="pool-card__stats" data-numeric>
              <div>
                <dt>TVL</dt>
                <dd>{formatMarketCap(pool.tvl)}</dd>
              </div>
              <div>
                <dt>{copy.liquidityVolume}</dt>
                <dd>
                  {pool.volume24h != null ? formatMarketCap(pool.volume24h) : <Slot>{copy.onChainSlot}</Slot>}
                </dd>
              </div>
              <div>
                <dt>{copy.aprLabel}</dt>
                <dd>
                  {pool.apr7d != null ? (
                    `${formatPercent(pool.apr7d * 100, locale)}%`
                  ) : (
                    <Slot>{copy.onChainSlot}</Slot>
                  )}
                </dd>
              </div>
            </dl>
            {pool.pool === 'main' ? (
              <Button variant="outline" size="sm" disabled title={copy.onChainSlot}>
                {copy.addLiquidity}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="panel-note">{copy.auxFeeNote}</p>
      <SourceRef value="docs/page-briefs/source-map.md#M5" />
    </div>
  )
}

/** POL 标签：市场价/名义价值（Q5 口径）+ 持仓 + 阶段门控操作区（Q6：Mint/Redeem+拆合） */
export function PolPanel({
  locale,
  verse,
  pol,
}: {
  locale: Locale
  verse: PrototypeVerse
  pol: PrototypePolPosition | null
}) {
  const copy = getCopy(locale).verseDesk
  const locked = verse.stage === 'locked'

  return (
    <div className="pol-panel">
      <h3>{copy.polTitle}</h3>
      {pol ? (
        <>
          <dl className="pol-panel__stats" data-numeric>
            <div>
              <dt>{copy.marketPrice}</dt>
              <dd>
                {pol.marketPricePerPol.toFixed(4)} {verse.raiseAsset}
              </dd>
            </div>
            <div>
              <dt>{copy.nominalValue}</dt>
              <dd>
                {pol.nominalValuePerPol.toFixed(4)} {verse.raiseAsset}
              </dd>
            </div>
            <div>
              <dt>{copy.polMarketCap}</dt>
              <dd>{formatMarketCap(pol.marketPricePerPol * pol.polSupply)}</dd>
            </div>
            <div>
              <dt>{copy.polTotalSupply}</dt>
              <dd>{formatMarketCap(pol.polSupply)}</dd>
            </div>
          </dl>
          <p className="panel-note">{copy.nominalNote}</p>
          <div className="pol-panel__wallet">
            <div>
              <span>{copy.yourPol}</span>
              <strong data-numeric>
                {formatAmount(pol.myPol, locale)} POL · ≈ {formatMarketCap(pol.myPol * pol.marketPricePerPol)}{' '}
                {verse.raiseAsset}
              </strong>
            </div>
            <div>
              <span>{copy.claimPol}</span>
              <strong data-numeric>{formatAmount(pol.claimablePol, locale)} POL</strong>
              {/* 原型纪律：写操作一律禁用（可领>0 也不伪造链上成功） */}
              <Button variant="outline" size="sm" disabled title={copy.claimPolNote}>
                {copy.claimPol}
              </Button>
            </div>
            <p className="panel-note">{copy.claimPolNote}</p>
          </div>
        </>
      ) : (
        <p className="panel-note">
          <Slot>{copy.onChainSlot}</Slot>
        </p>
      )}
      <div className="pol-panel__operate">
        <h4>{copy.operate}</h4>
        <div className="pol-panel__actions">
          <div className="pol-action">
            <Button variant="outline" size="sm" disabled title={copy.mintNote}>
              {copy.mintPol}
            </Button>
            <p>{copy.mintNote}</p>
          </div>
          <div className="pol-action">
            <Button variant="outline" size="sm" disabled title={copy.redeemPolNote}>
              {copy.redeemPol}
            </Button>
            <p>{copy.redeemPolNote}</p>
          </div>
          <div className="pol-action">
            <Button variant="outline" size="sm" disabled title={locked ? copy.splitNote : copy.splitClosed}>
              {copy.splitPol} / {copy.mergePol}
            </Button>
            <p>{locked ? copy.splitNote : copy.splitClosed}</p>
          </div>
        </div>
      </div>
      <SourceRef value="docs/page-briefs/source-map.md#M14" />
    </div>
  )
}

/** DAO 标签：概览 + Tally 外链卡 + 当期/上期周期激励（Q11：不含提案列表） */
export function DaoPanel({
  locale,
  verse,
  governance,
}: {
  locale: Locale
  verse: PrototypeVerse
  governance: PrototypeGovernanceState | null
}) {
  const copy = getCopy(locale).verseDesk
  if (!governance) {
    return (
      <div className="dao-panel">
        <h3>{copy.daoTitle}</h3>
        <p className="panel-note">
          <Slot>{copy.onChainSlot}</Slot>
        </p>
      </div>
    )
  }

  return (
    <div className="dao-panel">
      <h3>{copy.daoTitle}</h3>
      <div className="dao-panel__head">
        <dl className="dao-panel__stats" data-numeric>
          <div>
            <dt>{copy.governor}</dt>
            <dd>
              {governance.governorAddress ? (
                <CopyAddress locale={locale} value={governance.governorAddress} />
              ) : (
                <Slot>{copy.onChainSlot}</Slot>
              )}
            </dd>
          </div>
          <div>
            <dt>{copy.liveIn}</dt>
            <dd>{verse.governanceChainName}</dd>
          </div>
          <div>
            <dt>{copy.delegates}</dt>
            <dd>
              {governance.delegates != null ? formatAmount(governance.delegates, locale) : <Slot>{copy.onChainSlot}</Slot>}
            </dd>
          </div>
          <div>
            <dt>{copy.proposals}</dt>
            <dd>
              {governance.proposalCount
                ? `${governance.proposalCount.total} · ${copy.activeCount.replace('{n}', String(governance.proposalCount.active))}`
                : <Slot>{copy.onChainSlot}</Slot>}
            </dd>
          </div>
          <div>
            <dt>{copy.votingPower}</dt>
            <dd>
              {governance.totalVotingPower != null
                ? `${formatMarketCap(governance.totalVotingPower)} s${verse.symbol}`
                : <Slot>{copy.onChainSlot}</Slot>}
            </dd>
          </div>
        </dl>
        <div className="dao-panel__tally">
          <strong>{copy.tallyCard}</strong>
          <p>{copy.tallyNote}</p>
          <Button variant="outline" size="sm" disabled title={copy.tallyNote}>
            {copy.tallyEnter}
          </Button>
        </div>
      </div>

      <div className="dao-panel__cycles">
        <section className="cycle-card" data-current>
          <header>
            <h4>{copy.cycleTitle}</h4>
            <span data-numeric>
              {copy.cycle.replace('{n}', governance.cycleNumber)} ·{' '}
              {copy.cycleDuration.replace('{n}', String(governance.cycleDurationDays))}
            </span>
          </header>
          <dl data-numeric>
            <div>
              <dt>{copy.incentivizer}</dt>
              <dd>
                {governance.incentivizerAddress ? (
                  <CopyAddress locale={locale} value={governance.incentivizerAddress} />
                ) : (
                  <Slot>{copy.onChainSlot}</Slot>
                )}
              </dd>
            </div>
            <div>
              <dt>{copy.treasury}</dt>
              <dd>
                {governance.treasuryUAsset != null
                  ? `${formatMarketCap(governance.treasuryUAsset)} ${verse.raiseAsset}`
                  : <Slot>{copy.onChainSlot}</Slot>}
              </dd>
            </div>
            <div>
              <dt>{copy.rewardRatio}</dt>
              <dd>
                {governance.rewardRatioBps != null
                  ? `${governance.rewardRatioBps / 100}%`
                  : <Slot>{copy.onChainSlot}</Slot>}
              </dd>
            </div>
            <div>
              <dt>{copy.cumulativePool}</dt>
              <dd>
                {governance.cumulativeIncentivePool != null
                  ? formatMarketCap(governance.cumulativeIncentivePool)
                  : <Slot>{copy.onChainSlot}</Slot>}
              </dd>
            </div>
            {governance.currentCycleVotes ? (
              <>
                <div>
                  <dt>{copy.cycleTotalVotes}</dt>
                  <dd>{formatMarketCap(governance.currentCycleVotes.total)}</dd>
                </div>
                <div>
                  <dt>{copy.cycleYourVotes}</dt>
                  <dd>{formatMarketCap(governance.currentCycleVotes.mine)}</dd>
                </div>
                <div>
                  <dt>{copy.estClaimable}</dt>
                  <dd>
                    {governance.estimatedClaimable != null
                      ? formatMarketCap(governance.estimatedClaimable)
                      : '--'}
                  </dd>
                </div>
              </>
            ) : null}
          </dl>
          <div className="cycle-card__foot">
            <span data-numeric>
              {governance.finalized
                ? copy.ended
                : `${copy.endsIn} ${formatStamp(governance.cycleEndsAt)}`}
            </span>
            <Button variant="outline" size="sm" disabled={governance.finalized} title={copy.finalizeNote}>
              {copy.finalize}
            </Button>
          </div>
          <p className="panel-note">{copy.finalizeNote}</p>
        </section>

        {governance.lastCycle ? (
          <section className="cycle-card">
            <header>
              <h4>{copy.lastCycleTitle}</h4>
              <span data-numeric>{copy.cycle.replace('{n}', governance.lastCycle.number)}</span>
            </header>
            <dl data-numeric>
              <div>
                <dt>{copy.treasury}</dt>
                <dd>{formatMarketCap(governance.lastCycle.treasuryUAsset)}</dd>
              </div>
              <div>
                <dt>{copy.remainingRewards}</dt>
                <dd>{formatMarketCap(governance.lastCycle.remainingRewards)}</dd>
              </div>
              <div>
                <dt>{copy.cycleTotalVotes}</dt>
                <dd>{formatMarketCap(governance.lastCycle.totalVotes)}</dd>
              </div>
              <div>
                <dt>{copy.cycleYourVotes}</dt>
                <dd>{formatMarketCap(governance.lastCycle.myVotes)}</dd>
              </div>
              <div>
                <dt>{copy.yourClaimable}</dt>
                <dd>{formatMarketCap(governance.lastCycle.myClaimable)}</dd>
              </div>
            </dl>
            <div className="cycle-card__foot">
              {governance.claimWindowEndsAt ? (
                <span data-numeric>{formatStamp(governance.claimWindowEndsAt)}</span>
              ) : null}
              <Button variant="outline" size="sm" disabled title={copy.claimWindowNote}>
                {copy.claimRewards}
              </Button>
            </div>
            <p className="panel-note">{copy.claimWindowNote}</p>
          </section>
        ) : null}
      </div>
      <p className="panel-note">{copy.votingWeightNote}</p>
      <SourceRef value="docs/page-briefs/source-map.md#M10" />
    </div>
  )
}

import type {
  Locale,
  FixtureGovernanceState,
  FixturePolPosition,
  FixtureVerse,
  FixtureVerseTrade,
} from '@/lib/data/fixture-repository'

import { useId } from 'react'
import { getFixtureAssetUsdSample } from '@/lib/data/fixture-repository'

import { Info } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CactusLogo } from './cactus-logo'
import { CopyAddress } from '../global/copy-address'
import { DaoDots, DaoFundDialog } from './dao-fund-dialog'
import { getCopy } from '../global/copy'
import { PoolAddLiquidityDialog } from './pool-add-liquidity-dialog'
import { PoolRemoveLiquidityDialog } from './pool-remove-liquidity-dialog'
import { PolMintDialog } from './pol-mint-dialog'
import { PolRedeemLpDialog } from './pol-redeem-lp-dialog'
import { PolFlashSwapDialog } from './pol-flash-swap-dialog'
import { PolRedeemPtYtDialog } from './pol-redeem-pt-yt-dialog'
import { PolSplitMergeDialog } from './pol-split-merge-dialog'
import { formatAmount, formatDay, formatMarketCap, formatPercent, SourceRef } from '../global/signal-ui'

/** Liquidity tab: four-pool overview + pool cards (APR/volume=samples,
 *  missing fields → that row not rendered — null renders nothing);
 *  the pool cards' Add/Remove buttons open dialogs
 *  (PoolAddLiquidityDialog/PoolRemoveLiquidityDialog,
 *  mechanism layering see each component's header note) */
export async function LiquidityPanel({
  locale,
  verse,
  trade,
  pol,
}: {
  locale: Locale
  verse: FixtureVerse
  trade: FixtureVerseTrade
  pol: FixturePolPosition | null
}) {
  const copy = getCopy(locale).verseDesk
  // Overview=four-pool totals; the stats bar's Liq/Vol is main-pool scope, the two have different sources
  const volumeTotal = trade.pools.reduce(
    (sum, pool) => (pool.volume24h != null ? sum + pool.volume24h : sum),
    0,
  )
  const hasVolume = trade.pools.some((pool) => pool.volume24h != null)
  // ≈$ conversion is paired with the main pool (same uAssetUsd/price sources as PolPanel)
  const uAssetUsd = await getFixtureAssetUsdSample(verse.raiseAsset)

  return (
    <div className="liquidity-panel">
      <dl className="liquidity-panel__overview" data-numeric>
        <div>
          <dt>{copy.totalValueLocked}</dt>
          <dd>{`$${formatMarketCap(trade.pools.reduce((sum, pool) => sum + pool.tvl, 0))}`}</dd>
        </div>
        {hasVolume ? (
          <div>
            <dt>{copy.liquidityVolume}</dt>
            <dd>{`$${formatMarketCap(volumeTotal)}`}</dd>
          </div>
        ) : null}
      </dl>
      <h3 className="panel-title">{copy.poolsTitle}</h3>
      <ul className="liquidity-panel__pools">
        {trade.pools.map((pool) => (
          <li key={pool.id} className="pool-card" data-pool={pool.pool}>
            {/* Three stacked sections (a single row of 6 elements squeezed at ~480px card width:
                stat cells crushed to 54px, values wrapping, four cards uneven in height):
                head row=pair+APR readout,
                data row=TVL+24h volume, bottom row=full-width equal-split dual buttons */}
            <header className="pool-card__head">
              <strong className="pool-card__pair" data-numeric>
                {pool.baseSymbol}/{pool.quoteSymbol}
              </strong>
              {pool.apr7d != null ? (
                <span className="pool-card__apr">
                  <span className="pool-card__apr-label">{copy.aprLabel}</span>
                  <strong className="pool-card__apr-value" data-numeric>
                    {`${formatPercent(pool.apr7d * 100, locale)}%`}
                  </strong>
                </span>
              ) : null}
            </header>
            <dl className="pool-card__stats" data-numeric>
              <div>
                <dt>TVL</dt>
                <dd>{`$${formatMarketCap(pool.tvl)}`}</dd>
              </div>
              {pool.volume24h != null ? (
                <div>
                  <dt>{copy.liquidityVolume}</dt>
                  <dd>{`$${formatMarketCap(pool.volume24h)}`}</dd>
                </div>
              ) : null}
            </dl>
            {/* Pool card dual buttons Add/Remove (Remove for
                liquidity removal, Add uses the short copy);
                both join a full-width equal-split row (same as the POL terminal
                card's full-row button language) */}
            <div className="pool-card__actions">
              <PoolAddLiquidityDialog
                locale={locale}
                pool={pool}
                pol={pol}
                price={trade.tokenStats.price}
                uAssetUsd={uAssetUsd}
              />
              <PoolRemoveLiquidityDialog
                locale={locale}
                pool={pool}
                pol={pol}
                price={trade.tokenStats.price}
                uAssetUsd={uAssetUsd}
              />
            </div>
          </li>
        ))}
      </ul>
      <SourceRef value="docs/page-briefs/source-map.md#M5" />
    </div>
  )
}

/** Tokenization tab "split terminal":
 * POL asset card (balance as primary readout + market price↔nominal value gauge) ⇢ seam
 * (Y-shaped split glyph=mechanism metaphor) ⇢ PT/YT derivative cards.
 * Mechanism: Mint/Redeem=POL tokens;
 * Split/Merge=1 POL⇄1 PT+1 YT
 * only during the locked period (merge=burning equal PT+YT for POL
 * 1:1; after unlock/settled it is
 * AlreadyUnlocked); Redeem PT/YT=burn-and-redeem after the unlocked settlement
 * (in the unlocked state the PT/YT card's action bar shows the two Redeem buttons); Claim YT=one-time claim pro rata
 * to contribution after the genesis lock
 * (leverage participants claim via claimLeveragedYT by interest
 * share);
 * nominal value=2×uAsset side. */
export async function PolPanel({
  locale,
  verse,
  pol,
  price,
}: {
  locale: Locale
  verse: FixtureVerse
  pol: FixturePolPosition | null
  /** Main-pool price (trade.tokenStats.price): source of the Mint dialog's ratio and the Rate row; null=no sample */
  price: number | null
}) {
  const copy = getCopy(locale).verseDesk
  const unlocked = verse.stage === 'unlocked'
  // Symbol conventions: POL-/PT-/YT- prefixed with the memecoin symbol
  const polSymbol = `POL-${verse.symbol}`
  const ptSymbol = `PT-${verse.symbol}`
  const ytSymbol = `YT-${verse.symbol}`

  // Deviation comparison scale: this is a comparison of two prices
  // (measure vs target), not a slider —
  // language=bullet chart semantics: the axis is a linear "deviation from nominal value" scale,
  // the end labels −D%/+D% anchor the scale
  // (D starts at 50; when |Δ| exceeds the bound it widens
  // automatically to 100/200/400 with the end labels synced),
  // baseline=0 (parity, magenta datum), the market mark's position is always the linear landing
  // spot Δ/(2D)+50%, and the deviation bar between them is the ink of |Δ|
  const nominal = pol?.nominalValuePerPol ?? 0
  const market = pol?.marketPricePerPol ?? 0
  const deltaPct = nominal > 0 ? ((market - nominal) / nominal) * 100 : 0
  const domainPct = [50, 100, 200, 400].find((d) => Math.abs(deltaPct) <= d) ?? 400
  const marketPos = nominal > 0 ? Math.min(1, Math.max(0, 0.5 + deltaPct / (domainPct * 2))) : 0.5
  const spanWidth = Math.abs(marketPos - 0.5)
  const deltaLabel = `${deltaPct < 0 ? '−' : '+'}${formatPercent(Math.abs(deltaPct), locale)}%`

  // Denomination=USD (pricing unified to the $ scope, consistent with
  // the trade desk stats bar/Liquidity panel;
  // rate=fixture usdSample — same uAssetUsd source as SwapPanel; no sample → slot state.
  // Market cap/total supply not shown — no real value to users)
  const uAssetUsd = await getFixtureAssetUsdSample(verse.raiseAsset)
  const marketUsd = uAssetUsd != null && pol ? `$${formatAmount(market * uAssetUsd, locale)}` : null
  const nominalUsd = uAssetUsd != null && pol ? `$${formatAmount(nominal * uAssetUsd, locale)}` : null
  const estUsd =
    uAssetUsd != null && pol ? `$${formatMarketCap(pol.myPol * market * uAssetUsd)}` : null
  // Per-unit mechanism values of PT/YT (well readout):
  // PT leg=fixed redemption rate uAssetPerPol (registered once at genesis lock, determined in
  // both locked/unlocked, not 1:1),
  // USD=leg×uAssetUsd sample;
  // YT legs (dual-leg form — "YT settlement payout=uAsset+Memecoin, two tokens"):
  // the memecoin leg is derivable in both stages (1 PT+1 YT=1 POL=M meme+U uAsset; PT fixedly
  // consumes the uAsset side →
  // residual nominal=memecoin side=uAssetPerPol÷main-pool price; unlocked uses the settlement
  // sample ytRedeemMemecoinPerUnit);
  // uAsset leg=ytRedeemUAssetPerUnit sample (locked=settlement estimate sample — locked-stage
  // estimate sample, not a settlement read; unlocked=settlement-derived truth).
  // USD=(meme leg×main-pool price+uAsset leg)×uAssetUsd; sample/price missing → null → '--'.
  const ptLeg = pol ? pol.uAssetPerPol : null
  const ptUsd = ptLeg != null && uAssetUsd != null ? ptLeg * uAssetUsd : null
  const ytMemeLeg = !pol
    ? null
    : unlocked
      ? pol.ytRedeemMemecoinPerUnit
      : price != null && price > 0
        ? pol.uAssetPerPol / price
        : null
  const ytUAssetLeg = pol ? pol.ytRedeemUAssetPerUnit : null
  const ytUsd =
    pol == null || uAssetUsd == null || ytMemeLeg == null || ytUAssetLeg == null || price == null
      ? null
      : (ytMemeLeg * price + ytUAssetLeg) * uAssetUsd

  return (
    <div className="pol-panel">
      {/* No panel title here (the tab already shows it, redundant) */}
      {pol ? (
        <div className="pol-panel__grid">
          <section className="pol-card" data-token="pol">
            <header className="pol-card__head">
              <span className="pol-glyph">POL</span>
              <strong className="pol-card__symbol" data-numeric>
                {polSymbol}
              </strong>
              <span className="pol-card__tag">{copy.polTag}</span>
            </header>
            <div className="pol-card__balance">
              <span className="pol-label">{copy.polBalance}</span>
              {/* symbol already shown in the card head, not repeated on the balance row; valuation trails inline */}
              <strong className="pol-card__amount" data-numeric>
                {formatAmount(pol.myPol, locale)}
                {estUsd != null ? (
                  <span className="pol-card__est">
                    {/* ≈ is the separator (same as the pol-twin USD echo row); a "· ≈"
                        double punctuation would leave a stranded · at line start after
                        wrapping on mobile */}
                    ≈ {estUsd}
                  </span>
                ) : null}
              </strong>
            </div>
            <div
              className="pol-gauge"
              role="img"
              data-numeric
              aria-label={`${copy.marketPrice} ${marketUsd ?? `${market.toFixed(4)} ${verse.raiseAsset}`} · ${copy.nominalValue} ${nominalUsd ?? `${nominal.toFixed(4)} ${verse.raiseAsset}`} · ${deltaLabel} ${copy.vsNominal} · ${copy.polScaleNote.replace('{n}', String(domainPct))}`}
            >
              <div className="pol-gauge__row">
                <span className="pol-gauge__legend pol-gauge__legend--market">
                  <span className="pol-gauge__legend-label">{copy.marketPrice}</span>
                  {marketUsd != null ? (
                    <strong className="pol-gauge__value pol-gauge__value--market">{marketUsd}</strong>
                  ) : null}
                </span>
                <span className="pol-gauge__readout" data-trend={deltaPct < 0 ? 'down' : 'up'}>
                  <em>{copy.vsNominal}</em>
                  <strong>{deltaLabel}</strong>
                </span>
              </div>
              <div className="pol-gauge__axis">
                {/* Z order=deviation bar → market mark → nominal datum: near parity the datum sits
                    above the mark so the 0 point never disappears */}
                {spanWidth > 0.004 && (
                  <span
                    className="pol-gauge__span"
                    data-trend={deltaPct < 0 ? 'down' : 'up'}
                    style={{
                      insetInlineStart: `${(Math.min(marketPos, 0.5) * 100).toFixed(1)}%`,
                      inlineSize: `${(spanWidth * 100).toFixed(1)}%`,
                    }}
                  />
                )}
                <span
                  className="pol-gauge__mark"
                  style={{ insetInlineStart: `${(marketPos * 100).toFixed(1)}%` }}
                />
                <span className="pol-gauge__datum" style={{ insetInlineStart: '50%' }} />
                {/* End labels + midpoint anchor the scale: linear deviation scale
                    −D%~+D%, 0=parity */}
                <span className="pol-gauge__scale" aria-hidden="true">
                  <span data-numeric>{`−${domainPct}%`}</span>
                  <span data-numeric>0</span>
                  <span data-numeric>{`+${domainPct}%`}</span>
                </span>
              </div>
              <div className="pol-gauge__row">
                <span className="pol-gauge__legend pol-gauge__legend--nominal">
                  <span className="pol-gauge__legend-label">
                    {copy.nominalValue}
                    <Tooltip>
                      <TooltipTrigger className="create-info" aria-label={copy.nominalNote}>
                        <Info aria-hidden="true" />
                      </TooltipTrigger>
                      <TooltipContent>{copy.nominalNote}</TooltipContent>
                    </Tooltip>
                  </span>
                  {nominalUsd != null ? (
                    <strong className="pol-gauge__value pol-gauge__value--nominal">{nominalUsd}</strong>
                  ) : null}
                </span>
              </div>
            </div>
            <div className="pol-card__actions">
              <div className="pol-card__btns">
                {/* Mint opens a dialog (dual-token supply → POL,
                    mechanism same as mintNote;
                    the in-dialog CTA stays disabled — no faked execution) */}
                <PolMintDialog
                  locale={locale}
                  verse={verse}
                  pol={pol}
                  price={price}
                  uAssetUsd={uAssetUsd}
                />
                {/* Redeem is a dialog
                    (PolRedeemLpDialog — burn POL
                    for main-pool LP tokens 1:1, mechanism see that component's header note);
                    unlocked only (contract NotUnlockedStage
                    gate; the fixture-domain pol position only has locked/unlocked);
                    locked skips rendering a disabled button and Mint spans the row;
                    no note row, no title hover */}
                {unlocked ? (
                  <PolRedeemLpDialog locale={locale} verse={verse} pol={pol} />
                ) : null}
              </div>
            </div>
          </section>

          <div className="pol-seam" aria-hidden="true">
            <span className="pol-seam__line" />
            <span className="pol-seam__glyph">
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M1.5 8H6L14.5 3M6 8l8.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
              </svg>
            </span>
            <span className="pol-seam__line" />
          </div>

          <section className="pol-card" data-token="pt-yt">
            {/* Twin wells (pure-read symmetry — identity head +
                account rows + USD echo, no buttons at the well bottom;
                the mechanism equation lives in the well-group header (with the left seam
                forming "symbol left, formula right"); actions unified in a full-width bar under
                the well group:
                locked=Flash Swap/Split/Merge three equal-width, unlocked=Redeem PT/YT two equal-width */}
            <p className="pol-twin__equation">
              <span data-numeric>{`1 ${polSymbol} = 1 PT + 1 YT`}</span>
              <Tooltip>
                <TooltipTrigger className="create-info" aria-label={copy.splitNote}>
                  <Info aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent>{copy.splitNote}</TooltipContent>
              </Tooltip>
            </p>
            <div className="pol-twin">
              <div className="pol-twin__well" data-token="pt">
                <div className="pol-twin__head">
                  <span className="pol-glyph pol-glyph--pt">PT</span>
                  <div className="pol-twin__id">
                    <strong className="pol-twin__symbol" data-numeric>
                      {ptSymbol}
                    </strong>
                    {/* The one-line mechanism note keeps only the full name; the explanation
                        lives in the ⊙ bubble */}
                    <span className="pol-twin__desc">
                      {copy.ptFullName}
                      <Tooltip>
                        <TooltipTrigger
                          className="create-info"
                          aria-label={copy.ptTip.replace('{asset}', verse.raiseAsset)}
                        >
                          <Info aria-hidden="true" />
                        </TooltipTrigger>
                        <TooltipContent>{copy.ptTip.replace('{asset}', verse.raiseAsset)}</TooltipContent>
                      </Tooltip>
                    </span>
                  </div>
                </div>
                <div className="pol-twin__quote">
                  {/* Account row=nominal value scope (must be explicit
                      that it is not the market price) */}
                  <span className="pol-label">
                    {copy.nominalValue}
                    <Tooltip>
                      <TooltipTrigger className="create-info" aria-label={copy.ptNominalTip}>
                        <Info aria-hidden="true" />
                      </TooltipTrigger>
                      <TooltipContent>{copy.ptNominalTip}</TooltipContent>
                    </Tooltip>
                  </span>
                  <div className="pol-twin__legs" data-numeric>
                    <span>
                      {ptLeg != null
                        ? `${formatAmount(ptLeg, locale)} ${verse.raiseAsset}`
                        : '--'}
                    </span>
                  </div>
                </div>
                {ptUsd != null ? (
                  <p className="pol-twin__usd" data-numeric>
                    ≈ ${formatAmount(ptUsd, locale)}
                  </p>
                ) : null}
              </div>
              <div className="pol-twin__well" data-token="yt">
                <div className="pol-twin__head">
                  <span className="pol-glyph pol-glyph--yt">YT</span>
                  <div className="pol-twin__id">
                    <strong className="pol-twin__symbol" data-numeric>
                      {ytSymbol}
                    </strong>
                    <span className="pol-twin__desc">
                      {copy.ytFullName}
                      <Tooltip>
                        <TooltipTrigger
                          className="create-info"
                          aria-label={copy.ytTip.replace('{asset}', verse.raiseAsset)}
                        >
                          <Info aria-hidden="true" />
                        </TooltipTrigger>
                        <TooltipContent>{copy.ytTip.replace('{asset}', verse.raiseAsset)}</TooltipContent>
                      </Tooltip>
                    </span>
                  </div>
                </div>
                <div className="pol-twin__quote">
                  {/* Account row=nominal value scope (must be explicit
                      that it is not the market price);
                      dual legs: unlocked=settlement sample truth; locked=derived meme leg +
                      estimated uAsset leg sample (locked-stage estimate; see above) */}
                  <span className="pol-label">
                    {copy.nominalValue}
                    <Tooltip>
                      <TooltipTrigger className="create-info" aria-label={copy.ytNominalTip}>
                        <Info aria-hidden="true" />
                      </TooltipTrigger>
                      <TooltipContent>{copy.ytNominalTip}</TooltipContent>
                    </Tooltip>
                  </span>
                  <div className="pol-twin__legs" data-numeric>
                    <span>
                      {ytMemeLeg != null
                        ? `${formatAmount(ytMemeLeg, locale)} ${verse.symbol}`
                        : '--'}
                    </span>
                    {/* uAsset leg: unlocked=settlement sample truth; locked=settlement estimate
                        sample (locked-stage estimate; see above) */}
                    <span className="pol-twin__leg-extra">
                      + {ytUAssetLeg != null ? `${formatAmount(ytUAssetLeg, locale)} ${verse.raiseAsset}` : '--'}
                    </span>
                  </div>
                </div>
                {ytUsd != null ? (
                  <p className="pol-twin__usd" data-numeric>
                    ≈ ${formatAmount(ytUsd, locale)}
                  </p>
                ) : null}
              </div>
            </div>
            {/* Full-width action area (well bottoms cleared to pure read; actions
                unified in a full-width bar under the well group — position consistent across
                stages;
                locked=Flash Swap/Split/Merge three equal-width (Flash Swap belongs to the YT
                single channel),
                unlocked=Redeem PT/YT two equal-width; balances shown in each dialog's Balance/Max) */}
            <div className="pol-card__btns">
              {unlocked ? (
                <>
                  <PolRedeemPtYtDialog
                    locale={locale}
                    verse={verse}
                    pol={pol}
                    mode="pt"
                    price={price}
                    uAssetUsd={uAssetUsd}
                  />
                  <PolRedeemPtYtDialog
                    locale={locale}
                    verse={verse}
                    pol={pol}
                    mode="yt"
                    price={price}
                    uAssetUsd={uAssetUsd}
                  />
                </>
              ) : (
                <>
                  <PolFlashSwapDialog locale={locale} verse={verse} pol={pol} uAssetUsd={uAssetUsd} />
                  <PolSplitMergeDialog locale={locale} verse={verse} pol={pol} mode="split" />
                  <PolSplitMergeDialog locale={locale} verse={verse} pol={pol} mode="merge" />
                </>
              )}
            </div>
          </section>
        </div>
      ) : null}
      <SourceRef value="docs/page-briefs/source-map.md#M14" />
    </div>
  )
}

/** DAO tab: overview + Tally external-link card + current/last cycle incentives (no proposal list) */
export function DaoPanel({
  locale,
  verse,
  governance,
}: {
  locale: Locale
  verse: FixtureVerse
  governance: FixtureGovernanceState | null
}) {
  const copy = getCopy(locale).verseDesk
  const finalizeNoteId = useId()
  if (!governance) {
    return (
      <div className="dao-panel">
        <h3 className="panel-title">{copy.daoTitle.replace('{symbol}', verse.symbol)}</h3>
      </div>
    )
  }

  return (
    <div className="dao-panel">
      <section className="dao-overview">
        <header className="dao-panel__head">
          <h3 className="panel-title">{copy.daoTitle.replace('{symbol}', verse.symbol)}</h3>
          <div className="dao-panel__head-governor" data-numeric>
            {governance.governorAddress ? (
              <>
                {copy.governorLabel}: <CopyAddress locale={locale} value={governance.governorAddress} />
              </>
            ) : null}
          </div>
          <dl className="dao-panel__head-live" data-numeric>
            <dt>{copy.liveIn}</dt>
            <dd>{verse.governanceChainName}</dd>
          </dl>
        </header>
        <dl className="dao-panel__stats" data-numeric>
          {governance.delegates != null ? (
            <div>
              <dt>{copy.delegates}</dt>
              <dd>{formatAmount(governance.delegates, locale)}</dd>
            </div>
          ) : null}
          {governance.proposalCount ? (
            <div>
              <dt>{copy.proposals}</dt>
              <dd>
                {governance.proposalCount.total}{' '}
                <span className="stat-flag">
                  ({copy.activeCount.replace('{n}', String(governance.proposalCount.active))})
                </span>
              </dd>
            </div>
          ) : null}
          {governance.totalVotingPower != null ? (
            <div>
              <dt>{copy.votingPower}</dt>
              <dd>{`${formatMarketCap(governance.totalVotingPower)} s${verse.symbol}`}</dd>
            </div>
          ) : null}
          <div className="dao-panel__tally">
            <dt className="dao-panel__tally-label">
              {copy.tallyCard}
              <Tooltip>
                <TooltipTrigger className="create-info" aria-label={copy.tallyNote}>
                  <Info aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent>{copy.tallyNote}</TooltipContent>
              </Tooltip>
            </dt>
            <dd>
              <Button variant="outline" size="sm" disabled>
                {copy.tallyEnter}
                <CactusLogo className="dao-panel__tally-logo" />
              </Button>
            </dd>
          </div>
        </dl>
      </section>

      <div className="dao-panel__cycles">
        <section className="cycle-card" data-current>
          <header className="cycle-card__head">
            <div className="cycle-card__head-meta">
              <h4 className="panel-subtitle">{copy.cycleTitle}</h4>
            </div>
            {governance.incentivizerAddress ? (
              <span className="cycle-card__head-incentivizer">
                <span className="cycle-card__head-label">{copy.incentivizer}:</span>{' '}
                <CopyAddress locale={locale} value={governance.incentivizerAddress} />
              </span>
            ) : null}
          </header>
          {/* Settlement window banner: the finalize button is not
              permanent — rendered only when the cycle end
              time has passed and settlement has not happened; finalizeNote tucked into the ⊙
              bubble after the button (the explanation does not go into the banner body), button
              placed right */}
          {!governance.finalized && new Date(governance.cycleEndsAt).getTime() <= Date.now() ? (
            <div className="cycle-card__settle">
              <div className="cycle-card__settle-copy">
                <strong>{copy.settleOpen}</strong>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="cycle-card__settle-trigger"
                aria-describedby={finalizeNoteId}
              >
                {copy.finalize}
                <Tooltip>
                  <TooltipTrigger render={<span className="create-info" aria-hidden="true" />}>
                    <Info aria-hidden="true" />
                  </TooltipTrigger>
                  <TooltipContent className="cycle-card__settle-tip">{copy.finalizeNote}</TooltipContent>
                </Tooltip>
              </Button>
              {/* sr-only placed outside the button: inside, it would be merged into the button's
                  accessible name; the explanation should be announced separately via describedby */}
              <span id={finalizeNoteId} className="sr-only">
                {copy.finalizeNote}
              </span>
            </div>
          ) : null}
          <dl className="cycle-card__stats" data-numeric>
            <div>
              <dt>{copy.cycleChip}</dt>
              <dd className="stat-meta">
                #{governance.cycleNumber}{' '}
                <span className="stat-sub">
                  ({governance.finalized ? copy.ended : `${copy.endsIn} ${formatDay(governance.cycleEndsAt, locale)}`})
                </span>
              </dd>
            </div>
            {governance.treasuryUAsset != null && governance.treasuryAssets ? (
              <DaoFundDialog
                locale={locale}
                title={copy.treasuryDetailsTitle}
                totalUsd={governance.treasuryUAsset}
                assets={governance.treasuryAssets}
              >
                <>
                  <dt>
                    {copy.treasury}
                    <DaoDots />
                  </dt>
                  <dd>${formatAmount(governance.treasuryUAsset, locale)}</dd>
                </>
              </DaoFundDialog>
            ) : governance.treasuryUAsset != null ? (
              <div>
                <dt>{copy.treasury}</dt>
                <dd>{`$${formatAmount(governance.treasuryUAsset, locale)}`}</dd>
              </div>
            ) : null}
            {governance.rewardRatioBps != null ? (
              <div>
                <dt>{copy.rewardRatio}</dt>
                <dd>{`${governance.rewardRatioBps / 100}%`}</dd>
              </div>
            ) : null}
            {governance.cumulativeIncentivePool != null ? (
              <div>
                <dt>{copy.cumulativePool}</dt>
                <dd>{`$${formatAmount(governance.cumulativeIncentivePool, locale)}`}</dd>
              </div>
            ) : null}
            {governance.currentCycleVotes ? (
              <>
                <div>
                  <dt>{copy.cycleTotalVotes}</dt>
                  <dd>
                    {formatAmount(governance.currentCycleVotes.total, locale)}{' '}
                    <span className="stat-unit">{copy.votesUnit}</span>
                  </dd>
                </div>
                <div>
                  <dt>{copy.cycleYourVotes}</dt>
                  <dd>
                    {formatAmount(governance.currentCycleVotes.mine, locale)}{' '}
                    <span className="stat-unit">{copy.votesUnit}</span>
                  </dd>
                </div>
              </>
            ) : null}
          </dl>
          {governance.currentCycleVotes ? (
            <div className="cycle-card__banner" data-numeric>
              <span>{copy.estClaimable}</span>
              <strong>
                {governance.estimatedClaimable != null
                  ? `~$${formatAmount(governance.estimatedClaimable, locale)}`
                  : '--'}
              </strong>
            </div>
          ) : null}
        </section>

        {governance.lastCycle ? (
          <section className="cycle-card">
            <header className="cycle-card__head">
              <div className="cycle-card__head-meta">
                <h4 className="panel-subtitle">{copy.lastCycleTitle}</h4>
              </div>
            </header>
            <dl className="cycle-card__stats" data-numeric>
              <div>
                <dt>{copy.lastCycleChip}</dt>
                <dd className="stat-meta">#{governance.lastCycle.number}</dd>
              </div>
              {governance.lastCycle.treasuryAssets ? (
                <DaoFundDialog
                  locale={locale}
                  title={copy.lastTreasuryDetailsTitle}
                  totalUsd={governance.lastCycle.treasuryUAsset}
                  assets={governance.lastCycle.treasuryAssets}
                >
                  <>
                    <dt>
                      {copy.treasury}
                      <DaoDots />
                    </dt>
                    <dd>${formatAmount(governance.lastCycle.treasuryUAsset, locale)}</dd>
                  </>
                </DaoFundDialog>
              ) : (
                <div>
                  <dt>{copy.treasury}</dt>
                  <dd>${formatAmount(governance.lastCycle.treasuryUAsset, locale)}</dd>
                </div>
              )}
              {governance.lastCycle.unclaimedAssets ? (
                <DaoFundDialog
                  locale={locale}
                  title={copy.unclaimedDetailsTitle}
                  totalUsd={governance.lastCycle.remainingRewards}
                  assets={governance.lastCycle.unclaimedAssets}
                  showRegisteredNote={false}
                >
                  <>
                    <dt>
                      {copy.remainingRewards}
                      <DaoDots />
                    </dt>
                    <dd>${formatAmount(governance.lastCycle.remainingRewards, locale)}</dd>
                  </>
                </DaoFundDialog>
              ) : (
                <div>
                  <dt>{copy.remainingRewards}</dt>
                  <dd>${formatAmount(governance.lastCycle.remainingRewards, locale)}</dd>
                </div>
              )}
              <div>
                <dt>{copy.cycleTotalVotes}</dt>
                <dd>
                  {formatAmount(governance.lastCycle.totalVotes, locale)}{' '}
                  <span className="stat-unit">{copy.votesUnit}</span>
                </dd>
              </div>
              <div>
                <dt>{copy.cycleYourVotes}</dt>
                <dd>
                  {formatAmount(governance.lastCycle.myVotes, locale)}{' '}
                  <span className="stat-unit">{copy.votesUnit}</span>
                </dd>
              </div>
              {/* Claimable row: the whole row is not a trigger —
                  the breakdown dialog is triggered only by
                  the claim button itself (triggerButton variant), the >>> glyph (DaoDots) lives
                  in the button copy;
                  without a sample composition it falls back to a disabled button */}
              <div>
                <dt className="cycle-card__claim-label">
                  {copy.yourClaimable}
                  <Tooltip>
                    <TooltipTrigger className="create-info" aria-label={copy.claimWindowNote}>
                      <Info aria-hidden="true" />
                    </TooltipTrigger>
                    <TooltipContent>{copy.claimWindowNote}</TooltipContent>
                  </Tooltip>
                </dt>
                <dd className="stat-action">
                  ${formatAmount(governance.lastCycle.myClaimable, locale)}
                  {governance.lastCycle.claimableAssets ? (
                    <DaoFundDialog
                      locale={locale}
                      title={copy.claimableDetailsTitle}
                      totalUsd={governance.lastCycle.myClaimable}
                      assets={governance.lastCycle.claimableAssets}
                      actionLabel={copy.claimRewards}
                      triggerButton={copy.claimRewards}
                      showRegisteredNote={false}
                    />
                  ) : (
                    <Button variant="outline" size="sm" disabled>
                      {copy.claimRewards}
                    </Button>
                  )}
                </dd>
              </div>
            </dl>
          </section>
        ) : null}
      </div>
      <SourceRef value="docs/page-briefs/source-map.md#M10" />
    </div>
  )
}

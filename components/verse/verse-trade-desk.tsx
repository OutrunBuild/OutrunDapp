import type {
  Locale,
  FixtureVerse,
  FixtureVerseTrade,
} from '@/lib/data/fixture-repository'
import { getFixtureAssetUsdSample, getFixtureParticipationOptions, getFixturePolPosition } from '@/lib/data/fixture-repository'
import { fmtPrice } from '../global/amount-format'

import { CandleChart } from './candle-chart'
import { CopyAddress } from '../global/copy-address'
import { getCopy } from '../global/copy'
import { SwapPanel } from './swap-panel'
import { formatAmount, formatCount, formatMarketCap, formatPercent } from '../global/signal-ui'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** Stat chip: body uses dl/dt/dd; the trigger=a focusable button inside dd (Tab reachable —
 *  render={<div/>} would replace the default button wholesale and drop out of the Tab chain);
 *  aria-label carries visible value+full name+full amount (the accessible name must contain
 *  the visible text; deduplicated when value===tipValue);
 *  bubble=full name+full amount */
function StatChip({
  label,
  value,
  tipTitle,
  tipValue,
}: {
  label: string
  value: string
  tipTitle: string
  tipValue: string
}) {
  return (
    <Tooltip>
      <div>
        <dt>{label}:</dt>
        <dd>
          <TooltipTrigger
            aria-label={value === tipValue ? `${tipTitle}: ${tipValue}` : `${tipTitle}: ${value} (${tipValue})`}
          >
            {value}
          </TooltipTrigger>
        </dd>
      </div>
      <TooltipContent>
        <span className="token-strip__tip">
          <b>{tipTitle}</b>
          <i>{tipValue}</i>
        </span>
      </TooltipContent>
    </Tooltip>
  )
}

/** Splits a formatted price into integer + decimal spans. Price=fmtPrice, the sole
 *  implementation of the market scope:
 *  ≥1 → two decimals, <1 → six significant digits with trailing zeros trimmed, ≥4 leading zeros
 *  marked with a subscript zero — reads the "price level" without precision noise */
function SplitPrice({ price }: { price: number }) {
  return (
    <>
      <span className="token-strip__price-sign">$</span>
      {fmtPrice(price)}
    </>
  )
}

/**
 * Trade desk persistent area (below the head card, above the tab area): token stats strip +
 * main-pool candlestick + standard Swap.
 * Stat scopes: Liq/Vol = main-pool TVL / 24h volume (stats-bar convention; four-pool totals
 * live in the Liquidity tab's overview);
 * market cap=current price×total supply (derived); CA=fixture sample. Missing fields → that
 * stat chip is not rendered (null renders nothing).
 */
export async function VerseTradeDesk({
  locale,
  verse,
  trade,
}: {
  locale: Locale
  verse: FixtureVerse
  trade: FixtureVerseTrade
}) {
  const copy = getCopy(locale).verseDesk
  const stats = trade.tokenStats
  // Swap/Mint POL supply-side balances share the same source (pol-positions fixture; null=slot)
  const pol = await getFixturePolPosition(verse.id)

  return (
    <section className="verse-desk" aria-label={verse.symbol}>
      <div className="verse-desk__main">
        {/* Stats strip + candlestick on one card */}
        <div className="trade-chart" data-numeric>
          {/* Layout: first row token name + single-row
              chips (MC/Liq/Vol/Pop/TS label and value on the same line);
              second row left=large price+change, right=CA chip */}
          <div className="token-strip" data-numeric>
            <div className="token-strip__row">
              <strong className="token-strip__symbol ax-glitch-text">{verse.symbol}</strong>
              <dl className="token-strip__chips">
                {stats.marketCap != null ? (
                  <StatChip
                    label={copy.marketCap}
                    value={`$${formatMarketCap(stats.marketCap)}`}
                    tipTitle={copy.marketCapFull}
                    tipValue={`$${formatAmount(stats.marketCap, locale)}`}
                  />
                ) : null}
                <StatChip
                  label={copy.liquidity}
                  value={`$${formatMarketCap(stats.liquidity)}`}
                  tipTitle={copy.liquidityFull}
                  tipValue={`$${formatAmount(stats.liquidity, locale)}`}
                />
                {stats.volume24h != null ? (
                  <StatChip
                    label={copy.volume24h}
                    value={`$${formatMarketCap(stats.volume24h)}`}
                    tipTitle={copy.volume24hFull}
                    tipValue={`$${formatAmount(stats.volume24h, locale)}`}
                  />
                ) : null}
                {stats.holders != null ? (
                  <StatChip
                    label={copy.holders}
                    value={formatCount(stats.holders)}
                    tipTitle={copy.holdersFull}
                    tipValue={formatAmount(stats.holders, locale)}
                  />
                ) : null}
                {stats.totalSupply != null ? (
                  <StatChip
                    label={copy.totalSupply}
                    value={formatMarketCap(stats.totalSupply)}
                    tipTitle={copy.totalSupplyFull}
                    tipValue={formatAmount(stats.totalSupply, locale)}
                  />
                ) : null}
              </dl>
            </div>
          </div>
          <CandleChart
            candles={trade.candles}
            fineCandles={trade.fineCandles}
            locale={locale}
            pairLabel={`${verse.symbol}/${verse.raiseAsset}`}
            header={
              /* Price+CA passed into the chart component, on the same row as the granularity
                 buttons;
                 key: header arrives via an RSC shard as a multi-child array of CandleChart;
                 without a key it triggers React's list-key warning */
              <div key="chart-header" className="candle-chart__row">
                <div className="token-strip__price">
                  {stats.price != null ? (
                    <strong>
                      <SplitPrice price={stats.price} />
                    </strong>
                  ) : null}
                  {stats.change24h != null ? (
                    <span data-trend={stats.change24h >= 0 ? 'up' : 'down'}>
                      {stats.change24h >= 0 ? '+' : ''}
                      {formatPercent(stats.change24h, locale)}%
                    </span>
                  ) : null}
                </div>
                {stats.tokenAddress ? <CopyAddress locale={locale} value={stats.tokenAddress} /> : null}
              </div>
            }
          />
        </div>
      </div>
      <div className="verse-desk__side">
        <SwapPanel
          locale={locale}
          memecoinSymbol={verse.symbol}
          memecoinName={verse.name}
          uAssetSymbol={verse.raiseAsset}
          price={stats.price ?? 0}
          uAssetUsd={await getFixtureAssetUsdSample(verse.raiseAsset)}
          memecoinBalance={pol?.myMemecoin ?? null}
          uAssetBalance={pol?.myUAsset ?? null}
          reserves={(await getFixtureParticipationOptions(verse.raiseAsset)).reserves}
          reserveBalance={pol?.myReserve ?? null}
          pol={pol}
          governanceChain={verse.governanceChain}
          governanceChainName={verse.governanceChainName}
        />
      </div>
    </section>
  )
}

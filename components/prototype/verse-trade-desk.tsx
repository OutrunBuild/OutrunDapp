import type { Locale, PrototypeVerse, PrototypeVerseTrade } from '@/lib/data/prototype-repository'

import { CandleChart } from './candle-chart'
import { CopyAddress } from './copy-address'
import { getCopy } from './copy'
import { SwapPanel } from './swap-panel'
import { formatAmount, formatMarketCap, formatPercent } from './signal-ui'

/**
 * 交易台持久区（头卡下方、标签区上方）：代币统计条 + 主池 K 线 + 标准 Swap。
 * 统计口径（Q&A 2026-09-23）：Liq=四池 TVL 合计；Vol=四池 24h 量合计；
 * 市值=现价×总供应（推导）；CA=fixture 样本。缺失字段→「以链上读值为准」槽位。
 */
export function VerseTradeDesk({
  locale,
  verse,
  trade,
}: {
  locale: Locale
  verse: PrototypeVerse
  trade: PrototypeVerseTrade
}) {
  const copy = getCopy(locale).verseDesk
  const stats = trade.tokenStats

  return (
    <section className="verse-desk" aria-label={copy.chartTitle}>
      <div className="verse-desk__main">
        <div className="token-strip" data-numeric>
          <div className="token-strip__price">
            <strong>{stats.price != null ? stats.price.toFixed(6) : copy.onChainSlot}</strong>
            {stats.change24h != null ? (
              <span data-trend={stats.change24h >= 0 ? 'up' : 'down'}>
                {formatPercent(stats.change24h, locale)}%
              </span>
            ) : null}
          </div>
          <dl className="token-strip__chips">
            <div>
              <dt>{copy.marketCap}</dt>
              <dd>{stats.marketCap != null ? formatMarketCap(stats.marketCap) : copy.onChainSlot}</dd>
            </div>
            <div>
              <dt>{copy.liquidity}</dt>
              <dd>{formatMarketCap(stats.liquidity)}</dd>
            </div>
            <div>
              <dt>{copy.volume24h}</dt>
              <dd>{stats.volume24h != null ? formatMarketCap(stats.volume24h) : copy.onChainSlot}</dd>
            </div>
            <div>
              <dt>{copy.holders}</dt>
              <dd>{stats.holders != null ? formatAmount(stats.holders, locale, true) : copy.onChainSlot}</dd>
            </div>
            <div>
              <dt>{copy.totalSupply}</dt>
              <dd>
                {stats.totalSupply != null ? formatMarketCap(stats.totalSupply) : copy.onChainSlot}
              </dd>
            </div>
          </dl>
          {stats.tokenAddress ? (
            <div className="token-strip__ca">
              <span>{copy.contract}</span>
              <CopyAddress locale={locale} value={stats.tokenAddress} />
            </div>
          ) : null}
        </div>
        <CandleChart
          candles={trade.candles}
          locale={locale}
          pairLabel={`${verse.symbol}/${verse.raiseAsset}`}
        />
      </div>
      <div className="verse-desk__side">
        <SwapPanel
          locale={locale}
          memecoinSymbol={verse.symbol}
          uAssetSymbol={verse.raiseAsset}
          price={stats.price ?? 0}
        />
      </div>
    </section>
  )
}

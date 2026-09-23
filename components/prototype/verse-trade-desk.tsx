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
/** 价格有效位分层（2026-09-23 用户裁定）：货币符+有效位大号白 semibold，尾随零缩小降级——读「价位」不读精度噪音 */
function SplitPrice({ price }: { price: number }) {
  const fixed = price.toFixed(6)
  const match = /^(.*[^0])(0*)$/.exec(fixed)
  const significant = match ? match[1] : fixed
  const tail = match ? match[2] : ''
  return (
    <>
      <span className="token-strip__price-sign">$</span>
      {significant}
      {tail ? <span className="token-strip__price-tail">{tail}</span> : null}
    </>
  )
}

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
    <section className="verse-desk" aria-label={verse.symbol}>
      <div className="verse-desk__main">
        {/* 统计条+K线同卡（2026-09-23 用户裁定：不再拆两张卡） */}
        <div className="trade-chart" data-numeric>
          {/* 排列按参照页（demo.outrun.build）：第一行 代币名+单行胶囊(MC/Liq/Vol/Pop/TS 标签值同行)；
              第二行 左=大字价格+涨跌、右=CA 胶囊 */}
          <div className="token-strip" data-numeric>
            <div className="token-strip__row">
              <strong className="token-strip__symbol ax-glitch-text">{verse.symbol}</strong>
              <dl className="token-strip__chips">
                <div>
                  <dt>{copy.marketCap}:</dt>
                  <dd>
                    {stats.marketCap != null ? `$${formatMarketCap(stats.marketCap)}` : copy.onChainSlot}
                  </dd>
                </div>
                <div>
                  <dt>{copy.liquidity}:</dt>
                  <dd>${formatMarketCap(stats.liquidity)}</dd>
                </div>
                <div>
                  <dt>{copy.volume24h}:</dt>
                  <dd>
                    {stats.volume24h != null ? `$${formatMarketCap(stats.volume24h)}` : copy.onChainSlot}
                  </dd>
                </div>
                <div>
                  <dt>{copy.holders}:</dt>
                  <dd>{stats.holders != null ? formatAmount(stats.holders, locale, true) : copy.onChainSlot}</dd>
                </div>
                <div>
                  <dt>{copy.totalSupply}:</dt>
                  <dd>
                    {stats.totalSupply != null ? formatMarketCap(stats.totalSupply) : copy.onChainSlot}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="token-strip__row token-strip__row--main">
              <div className="token-strip__price">
                <strong>{stats.price != null ? <SplitPrice price={stats.price} /> : copy.onChainSlot}</strong>
                {stats.change24h != null ? (
                  <span data-trend={stats.change24h >= 0 ? 'up' : 'down'}>
                    {stats.change24h >= 0 ? '+' : ''}
                    {formatPercent(stats.change24h, locale)}%
                  </span>
                ) : null}
              </div>
              {stats.tokenAddress ? <CopyAddress locale={locale} value={stats.tokenAddress} /> : null}
            </div>
          </div>
          <CandleChart
            candles={trade.candles}
            fineCandles={trade.fineCandles}
            locale={locale}
            pairLabel={`${verse.symbol}/${verse.raiseAsset}`}
          />
        </div>
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

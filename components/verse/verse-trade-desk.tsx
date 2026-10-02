import type {
  Locale,
  FixtureVerse,
  FixtureVerseTrade,
} from '@/lib/data/fixture-repository'
import { getFixtureAssetUsdSample, getFixtureParticipationOptions, getFixturePolPosition } from '@/lib/data/fixture-repository'

import { CandleChart } from './candle-chart'
import { CopyAddress } from './copy-address'
import { getCopy } from '../global/copy'
import { SwapPanel } from './swap-panel'
import { formatAmount, formatMarketCap, formatPercent } from '../global/signal-ui'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** 统计胶囊：本体走 dl/dt/dd，挂悬停气泡（全称+完整数值+口径说明——2026-09-23 用户裁定） */
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
      <TooltipTrigger render={<div />}>
        <dt>{label}:</dt>
        <dd>{value}</dd>
      </TooltipTrigger>
      <TooltipContent>
        <span className="token-strip__tip">
          <b>{tipTitle}</b>
          <i>{tipValue}</i>
        </span>
      </TooltipContent>
    </Tooltip>
  )
}

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
  verse: FixtureVerse
  trade: FixtureVerseTrade
}) {
  const copy = getCopy(locale).verseDesk
  const stats = trade.tokenStats
  // Swap/Mint POL 供给侧余额同源（pol-positions fixture；null=槽位）
  const pol = getFixturePolPosition(verse.id)

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
                <StatChip
                  label={copy.marketCap}
                  value={stats.marketCap != null ? `$${formatMarketCap(stats.marketCap)}` : copy.onChainSlot}
                  tipTitle={copy.marketCapFull}
                  tipValue={stats.marketCap != null ? `$${formatAmount(stats.marketCap, locale)}` : copy.onChainSlot}
                />
                <StatChip
                  label={copy.liquidity}
                  value={`$${formatMarketCap(stats.liquidity)}`}
                  tipTitle={copy.liquidityFull}
                  tipValue={`$${formatAmount(stats.liquidity, locale)}`}
                />
                <StatChip
                  label={copy.volume24h}
                  value={stats.volume24h != null ? `$${formatMarketCap(stats.volume24h)}` : copy.onChainSlot}
                  tipTitle={copy.volume24hFull}
                  tipValue={stats.volume24h != null ? `$${formatAmount(stats.volume24h, locale)}` : copy.onChainSlot}
                />
                <StatChip
                  label={copy.holders}
                  value={stats.holders != null ? formatAmount(stats.holders, locale, true) : copy.onChainSlot}
                  tipTitle={copy.holdersFull}
                  tipValue={stats.holders != null ? formatAmount(stats.holders, locale) : copy.onChainSlot}
                />
                <StatChip
                  label={copy.totalSupply}
                  value={stats.totalSupply != null ? formatMarketCap(stats.totalSupply) : copy.onChainSlot}
                  tipTitle={copy.totalSupplyFull}
                  tipValue={stats.totalSupply != null ? formatAmount(stats.totalSupply, locale) : copy.onChainSlot}
                />
              </dl>
            </div>
          </div>
          <CandleChart
            candles={trade.candles}
            fineCandles={trade.fineCandles}
            locale={locale}
            pairLabel={`${verse.symbol}/${verse.raiseAsset}`}
            header={
              /* 价格+CA 传入图表组件，与粒度钮同行（2026-09-23 用户裁定）；
                 key：header 经 RSC 分片流式到达 CandleChart 的多子节点数组，无 key 会触发
                 React 列表 key 告警（react.dev/link/warning-keys：在元素创建处给 key） */
              <div key="chart-header" className="candle-chart__row">
                <div className="token-strip__price">
                  <strong>
                    {stats.price != null ? <SplitPrice price={stats.price} /> : copy.onChainSlot}
                  </strong>
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
          uAssetUsd={getFixtureAssetUsdSample(verse.raiseAsset)}
          memecoinBalance={pol?.myMemecoin ?? null}
          uAssetBalance={pol?.myUAsset ?? null}
          reserves={getFixtureParticipationOptions(verse.raiseAsset).reserves}
          reserveBalance={pol?.myReserve ?? null}
          pol={pol}
        />
      </div>
    </section>
  )
}

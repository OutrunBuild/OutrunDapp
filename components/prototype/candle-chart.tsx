'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'

import type { Locale, PrototypeCandle, PrototypeFineCandles } from '@/lib/data/prototype-repository'

import { getCopy } from './copy'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

/** 粒度集（Q3 用户裁定：粒度式学币安；全部可选——细粒度走 fixture 样本，粗粒度由 1h 聚合） */
const GRANULARITIES = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'] as const
type Granularity = (typeof GRANULARITIES)[number]
/** 粗粒度每根聚合蜡烛吸收的 1h 蜡烛数 */
const AGGREGATE: Partial<Record<Granularity, number>> = { '1h': 1, '4h': 4, '1d': 24, '1w': 168 }
/** 视口最多渲染蜡烛数（1h 原始 168 根过密——只显示最近 96 根） */
const MAX_CANDLES = 96

function aggregate(candles: PrototypeCandle[], size: number): PrototypeCandle[] {
  const out: PrototypeCandle[] = []
  for (let end = candles.length; end > 0; end -= size) {
    const bucket = candles.slice(Math.max(0, end - size), end)
    out.unshift({
      t: bucket[0].t,
      o: bucket[0].o,
      h: Math.max(...bucket.map((c) => c.h)),
      l: Math.min(...bucket.map((c) => c.l)),
      c: bucket[bucket.length - 1].c,
    })
  }
  return out
}

/** 渲染层不自造颜色/字体——运行时从设计 token 读（2026-09-23 用户裁定：K线用 TradingView 开源 Lightweight Charts，不重复造轮子） */
function cssVar(name: string): string {
  if (typeof window === 'undefined') return 'transparent'
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || 'transparent'
}

function toChartData(candles: PrototypeCandle[]): CandlestickData<UTCTimestamp>[] {
  return candles.map((candle) => ({
    time: (Date.parse(candle.t) / 1000) as UTCTimestamp,
    open: candle.o,
    high: candle.h,
    low: candle.l,
    close: candle.c,
  }))
}

/** 主池蜡烛图（Lightweight Charts 渲染在 .trade-chart 面板内部，与统计条同卡） */
export function CandleChart({
  candles,
  fineCandles,
  locale,
  pairLabel,
}: {
  candles: PrototypeCandle[]
  fineCandles: PrototypeFineCandles | null
  locale: Locale
  pairLabel: string
}) {
  const copy = getCopy(locale).verseDesk
  const [granularity, setGranularity] = useState<Granularity>('1h')
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)

  const series = useMemo(() => {
    if (granularity === '1m' || granularity === '5m' || granularity === '15m') {
      return fineCandles ? fineCandles[granularity] : []
    }
    const size = AGGREGATE[granularity]
    if (!size) return []
    return aggregate(candles.slice(-MAX_CANDLES * size), size)
  }, [candles, fineCandles, granularity])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: cssVar('--color-text-secondary'),
        fontFamily: cssVar('--font-data'),
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: cssVar('--grid-cyan-inner') },
        horzLines: { color: cssVar('--grid-cyan-inner') },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      crosshair: {
        vertLine: { color: 'rgba(0, 240, 255, 0.35)', labelBackgroundColor: cssVar('--color-surface-raised') },
        horzLine: { color: 'rgba(0, 240, 255, 0.35)', labelBackgroundColor: cssVar('--color-surface-raised') },
      },
    })
    const up = cssVar('--color-success')
    const down = cssVar('--color-danger')
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: up,
      downColor: down,
      wickUpColor: up,
      wickDownColor: down,
      borderVisible: false,
    })
    chartRef.current = chart
    seriesRef.current = candleSeries
    return () => {
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  useEffect(() => {
    seriesRef.current?.setData(toChartData(series))
    chartRef.current?.timeScale().fitContent()
  }, [series])

  return (
    <div className="candle-chart">
      <div className="candle-chart__bar">
        <ToggleGroup
          className="candle-chart__granularity"
          value={[granularity]}
          onValueChange={(value) => {
            if (value[0]) setGranularity(value[0] as Granularity)
          }}
          aria-label={copy.granularity}
        >
          {GRANULARITIES.map((item) => (
            <ToggleGroupItem key={item} value={item}>
              {item}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      {series.length > 0 ? (
        <div className="candle-chart__plot" ref={containerRef} aria-label={`${pairLabel} OHLC`} role="img" />
      ) : (
        <div className="candle-chart__empty">{copy.syncing}</div>
      )}
    </div>
  )
}

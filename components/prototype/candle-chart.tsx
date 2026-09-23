'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type UTCTimestamp,
} from 'lightweight-charts'

import type { Locale, PrototypeCandle, PrototypeFineCandles } from '@/lib/data/prototype-repository'

import { getCopy } from './copy'
import { formatAmount } from './signal-ui'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

/** 粒度集（Q3 用户裁定：粒度式学币安；全部可选——细粒度走 fixture 样本，粗粒度由 1h 聚合） */
const GRANULARITIES = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'] as const
type Granularity = (typeof GRANULARITIES)[number]
/** 粗粒度每根聚合蜡烛吸收的 1h 蜡烛数 */
const AGGREGATE: Partial<Record<Granularity, number>> = { '1h': 1, '4h': 4, '1d': 24, '1w': 168 }
/** 视口最多渲染蜡烛数（1h 原始 168 根过密——只显示最近 96 根） */
const MAX_CANDLES = 96
/** 均线窗口（学币安默认快慢线） */
const MA_FAST = 7
const MA_SLOW = 25

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
      v: bucket.reduce((sum, c) => sum + c.v, 0),
    })
  }
  return out
}

/** 简单移动平均；前 window-1 根为 null */
function movingAverage(values: number[], window: number): Array<number | null> {
  return values.map((_, i) => {
    if (i < window - 1) return null
    let sum = 0
    for (let j = i - window + 1; j <= i; j++) sum += values[j]
    return sum / window
  })
}

/** 渲染层不自造颜色——token 十六进制运行时读取并加透明度 */
function cssVar(name: string): string {
  if (typeof window === 'undefined') return 'transparent'
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || 'transparent'
}

function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

const toTime = (iso: string) => (Date.parse(iso) / 1000) as UTCTimestamp

/** 主池蜡烛图（Lightweight Charts；2026-09-23 用户裁定：对齐 DexScreener 观感——量能柱+OHLC/Vol 悬浮读数+MA 快慢线；
   header=价格+CA 由 RSC 传入，与粒度钮同行） */
export function CandleChart({
  candles,
  fineCandles,
  locale,
  pairLabel,
  header,
}: {
  candles: PrototypeCandle[]
  fineCandles: PrototypeFineCandles | null
  locale: Locale
  pairLabel: string
  header?: ReactNode
}) {
  const copy = getCopy(locale).verseDesk
  const [granularity, setGranularity] = useState<Granularity>('1h')
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const maFastRef = useRef<ISeriesApi<'Line'> | null>(null)
  const maSlowRef = useRef<ISeriesApi<'Line'> | null>(null)

  const series = useMemo(() => {
    if (granularity === '1m' || granularity === '5m' || granularity === '15m') {
      return fineCandles ? fineCandles[granularity] : []
    }
    const size = AGGREGATE[granularity]
    if (!size) return []
    return aggregate(candles.slice(-MAX_CANDLES * size), size)
  }, [candles, fineCandles, granularity])

  const timeIndex = useMemo(
    () => new Map(series.map((candle, i) => [toTime(candle.t) as number, i])),
    [series],
  )
  const maFast = useMemo(() => movingAverage(series.map((c) => c.c), MA_FAST), [series])
  const maSlow = useMemo(() => movingAverage(series.map((c) => c.c), MA_SLOW), [series])

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
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.06, bottom: 0.22 } },
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
      priceFormat: { type: 'price', precision: 6, minMove: 0.000001 },
    })
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: 'vol',
      priceFormat: { type: 'volume' },
      lastValueVisible: false,
      priceLineVisible: false,
    })
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })
    const maFastSeries = chart.addSeries(LineSeries, {
      color: withAlpha(cssVar('--or-cyan'), 0.55),
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
    const maSlowSeries = chart.addSeries(LineSeries, {
      color: withAlpha(cssVar('--accent-echo'), 0.45),
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries
    maFastRef.current = maFastSeries
    maSlowRef.current = maSlowSeries
    return () => {
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
      maFastRef.current = null
      maSlowRef.current = null
    }
  }, [])

  useEffect(() => {
    candleSeriesRef.current?.setData(
      series.map<CandlestickData<UTCTimestamp>>((candle) => ({
        time: toTime(candle.t),
        open: candle.o,
        high: candle.h,
        low: candle.l,
        close: candle.c,
      })),
    )
    volumeSeriesRef.current?.setData(
      series.map<HistogramData<UTCTimestamp>>((candle) => ({
        time: toTime(candle.t),
        value: candle.v,
        color: withAlpha(candle.c >= candle.o ? cssVar('--color-success') : cssVar('--color-danger'), 0.35),
      })),
    )
    const toLine = (values: Array<number | null>) =>
      values
        .map<LineData<UTCTimestamp> | null>((value, i) =>
          value == null ? null : { time: toTime(series[i].t), value },
        )
        .filter((point): point is LineData<UTCTimestamp> => point != null)
    maFastRef.current?.setData(toLine(maFast))
    maSlowRef.current?.setData(toLine(maSlow))
    setHoverIdx(null)
    chartRef.current?.timeScale().fitContent()
  }, [series, maFast, maSlow])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const handler = (param: Parameters<Parameters<IChartApi['subscribeCrosshairMove']>[0]>[0]) => {
      if (param.time == null) {
        setHoverIdx(null)
        return
      }
      setHoverIdx(timeIndex.get(param.time as number) ?? null)
    }
    chart.subscribeCrosshairMove(handler)
    return () => chart.unsubscribeCrosshairMove(handler)
  }, [timeIndex])

  const active = series[hoverIdx ?? series.length - 1] ?? null
  const activeMaFast = active ? (maFast[hoverIdx ?? series.length - 1] ?? null) : null
  const activeMaSlow = active ? (maSlow[hoverIdx ?? series.length - 1] ?? null) : null
  const trend = active ? (active.c >= active.o ? 'up' : 'down') : 'up'
  const change = active ? ((active.c - active.o) / active.o) * 100 : 0

  return (
    <div className="candle-chart">
      <div className="candle-chart__bar">
        {header}
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
      {series.length > 0 && active ? (
        <div className="candle-chart__plot" role="img" aria-label={`${pairLabel} OHLC`}>
          <div className="candle-chart__legend" data-numeric>
            <b>{`${pairLabel} · ${granularity}`}</b>
            <span>
              O <i>{active.o.toFixed(6)}</i>
            </span>
            <span>
              H <i>{active.h.toFixed(6)}</i>
            </span>
            <span>
              L <i>{active.l.toFixed(6)}</i>
            </span>
            <span>
              C <i data-trend={trend}>{active.c.toFixed(6)}</i>
            </span>
            <i data-trend={trend}>
              {change >= 0 ? '+' : ''}
              {change.toFixed(2)}%
            </i>
            <span>
              Vol <i>{formatAmount(active.v, locale, true)}</i>
            </span>
            {activeMaFast != null ? (
              <span className="candle-chart__ma candle-chart__ma--fast">
                MA{MA_FAST} <i>{activeMaFast.toFixed(6)}</i>
              </span>
            ) : null}
            {activeMaSlow != null ? (
              <span className="candle-chart__ma candle-chart__ma--slow">
                MA{MA_SLOW} <i>{activeMaSlow.toFixed(6)}</i>
              </span>
            ) : null}
          </div>
          <div className="candle-chart__holder" ref={containerRef} />
        </div>
      ) : (
        <div className="candle-chart__empty">{copy.syncing}</div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type {
  CandlestickData,
  HistogramData,
  IChartApi,
  ISeriesApi,
  LineData,
  LogicalRange,
  UTCTimestamp,
} from 'lightweight-charts'

import type { Locale, Candle, FineCandles } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { formatAmount, formatPercent } from '../global/signal-ui'
import { fmtPrice } from '../global/amount-format'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

/** Granularity set (granularity modeled on Binance; all selectable — fine
 *  granularity uses fixture samples, coarse granularity is aggregated from 1h) */
const GRANULARITIES = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'] as const
type Granularity = (typeof GRANULARITIES)[number]
/** Number of 1h candles absorbed per aggregated coarse-granularity candle */
const AGGREGATE: Partial<Record<Granularity, number>> = { '1h': 1, '4h': 4, '1d': 24, '1w': 168 }
/** Initial candles fed to the chart; infinite left-scroll: feed more in LOAD_CHUNK increments
 *  as the viewport nears the left edge (standard exchange practice) */
const INITIAL_BARS = 96
const LOAD_CHUNK = 240
const EDGE_BARS = 10
/** MA windows: three lines MA7/MA30/MA60 */
const MA_WINDOWS = [7, 30, 60] as const
/** MA colors: fast=cyan / mid=magenta echo / slow=secondary gray (tokens read at runtime) */
const MA_COLOR_VARS = ['--or-cyan', '--accent-echo', '--color-text-secondary'] as const
const MA_ALPHAS = [0.55, 0.45, 0.9] as const

function aggregate(candles: Candle[], size: number): Candle[] {
  const out: Candle[] = []
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

/** Simple moving average; the first window-1 entries are null */
function movingAverage(values: number[], window: number): Array<number | null> {
  return values.map((_, i) => {
    if (i < window - 1) return null
    let sum = 0
    for (let j = i - window + 1; j <= i; j++) sum += values[j]
    return sum / window
  })
}

/** The render layer never invents colors — token hex values are read at runtime with alpha added */
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

/** Main-pool candlestick chart (Lightweight Charts; match the
 *  DexScreener look — volume bars + OHLC/Vol hover readout + MA fast/slow lines;
 *  header=price+CA passed in from RSC, on the same row as the granularity buttons) */
export function CandleChart({
  candles,
  fineCandles,
  locale,
  pairLabel,
  header,
}: {
  candles: Candle[]
  fineCandles: FineCandles | null
  locale: Locale
  pairLabel: string
  header?: ReactNode
}) {
  const copy = getCopy(locale).verseDesk
  const [granularity, setGranularity] = useState<Granularity>('1h')
  const [limit, setLimit] = useState(INITIAL_BARS)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  /** True only once the lib is in place and the chart is built: re-triggers the three effects
   *  that consume chart refs (feed/infinite left-scroll/crosshair) — on their first run the
   *  chart is mostly not built yet, and ?. silently no-ops without self-healing */
  const [chartReady, setChartReady] = useState(false)
  /** Viewport to restore after incremental feeding (prevents visual jump from setData prepending) */
  const restoreRangeRef = useRef<{ from: number; to: number } | null>(null)
  const firstDataRef = useRef(true)
  const prevGranularityRef = useRef(granularity)
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const maRefs = useRef<Array<ISeriesApi<'Line'> | null>>([])

  const series = useMemo(() => {
    if (granularity === '1m' || granularity === '5m' || granularity === '15m') {
      return fineCandles ? fineCandles[granularity].slice(-limit) : []
    }
    const size = AGGREGATE[granularity]
    if (!size) return []
    return aggregate(candles.slice(-limit * size), size)
  }, [candles, fineCandles, granularity, limit])

  /** Total candles loadable at the current granularity (the data layer backfills ~1 year of 1h history;
   *  fine granularity = fixture sample size) */
  const totalBars = useMemo(() => {
    if (granularity === '1m' || granularity === '5m' || granularity === '15m') {
      return fineCandles ? fineCandles[granularity].length : 0
    }
    const size = AGGREGATE[granularity] ?? 1
    return Math.ceil(candles.length / size)
  }, [candles, fineCandles, granularity])

  /** Criterion for the holder being in the DOM (plot branch = series non-empty): late-arriving
   *  data / granularity empty-state round trips rebuild the chart via init effect deps */
  const hasData = series.length > 0

  // Reset the initial viewport on granularity switch
  useEffect(() => {
    setLimit(INITIAL_BARS)
  }, [granularity])

  const timeIndex = useMemo(
    () => new Map(series.map((candle, i) => [toTime(candle.t) as number, i])),
    [series],
  )
  const maValues = useMemo(
    () => MA_WINDOWS.map((window) => movingAverage(series.map((c) => c.c), window)),
    [series],
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    // lightweight-charts (~74KB gzip) is imported only when the effect runs, keeping it out of
    // the route's eager chunk so hydration/interaction is not blocked by it (doing dynamic at
    // the RSC import site without ssr:false cannot split it out: SSR renders the real content
    // and the boundary hydrates together with the root; an ssr:false wrapper would lose the SSR
    // shell and cause placeholder jumping).
    // Repeat imports hit the module cache; rebuilding the chart on locale change costs nothing extra
    let cancelled = false
    let teardownChart = () => {}
    import('lightweight-charts').then(
      ({ createChart, CandlestickSeries, ColorType, HistogramSeries, LineSeries }) => {
        if (cancelled || containerRef.current !== el) return
        const chart = createChart(el, {
          autoSize: true,
          // Time axis ticks follow the page locale (the library default follows the browser
          // locale, which can render zh-formatted date labels on the en page)
          localization: { locale: locale === 'zh' ? 'zh-CN' : 'en-US' },
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
          // top 0.10: leave headroom at the top for the hover readout row (the readout row sat
          // too close to the candles)
          rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.1, bottom: 0.22 } },
          timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
          crosshair: {
            vertLine: {
              color: withAlpha(cssVar('--or-cyan'), 0.35),
              labelBackgroundColor: cssVar('--color-surface-raised'),
            },
            horzLine: {
              color: withAlpha(cssVar('--or-cyan'), 0.35),
              labelBackgroundColor: cssVar('--color-surface-raised'),
            },
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
        const maSeries = MA_WINDOWS.map((_, i) =>
          chart.addSeries(LineSeries, {
            color: withAlpha(cssVar(MA_COLOR_VARS[i]), MA_ALPHAS[i]),
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
          }),
        )
        chartRef.current = chart
        candleSeriesRef.current = candleSeries
        volumeSeriesRef.current = volumeSeries
        maRefs.current = maSeries
        setChartReady(true)
        teardownChart = () => {
          chart.remove()
          chartRef.current = null
          candleSeriesRef.current = null
          volumeSeriesRef.current = null
          maRefs.current = []
        }
      },
    ).catch((error) => {
      // Chunk invalidation / weak-network stream cut: leave no unhandled rejection; the chart
      // area stays in its empty state
      console.error('candle-chart: lightweight-charts failed to load', error)
    })
    return () => {
      cancelled = true
      teardownChart()
      setChartReady(false)
    }
  }, [locale, hasData])

  useEffect(() => {
    // Skip the whole run when the chart is not in place (async lib load / locale rebuild
    // window): consumption of flags like firstDataRef/restoreRangeRef does not go through ?.;
    // an idle run would prematurely consume "first-mount fitContent / viewport restore"
    if (!candleSeriesRef.current) return
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
    maValues.forEach((values, i) => maRefs.current[i]?.setData(toLine(values)))
    setHoverIdx(null)
    // Incremental prepend: restore the original viewport (shifted right by added bars);
    // granularity switch / first mount: fitContent
    if (restoreRangeRef.current) {
      chartRef.current?.timeScale().setVisibleLogicalRange(restoreRangeRef.current)
      restoreRangeRef.current = null
    } else if (prevGranularityRef.current !== granularity || firstDataRef.current) {
      prevGranularityRef.current = granularity
      firstDataRef.current = false
      chartRef.current?.timeScale().fitContent()
    }
  }, [series, maValues, granularity, chartReady])

  // Infinite left-scroll: feed another batch when the viewport is within EDGE_BARS bars of the
  // left edge, until totalBars is fully loaded
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || series.length === 0 || series.length >= totalBars) return
    const timeScale = chart.timeScale()
    const handler = (range: LogicalRange | null) => {
      if (!range || range.from > EDGE_BARS) return
      const added = Math.min(LOAD_CHUNK, totalBars - series.length)
      restoreRangeRef.current = { from: range.from + added, to: range.to + added }
      setLimit((prev) => prev + LOAD_CHUNK)
    }
    timeScale.subscribeVisibleLogicalRangeChange(handler)
    return () => timeScale.unsubscribeVisibleLogicalRangeChange(handler)
  }, [series, totalBars, chartReady])

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
  }, [timeIndex, chartReady])

  const active = series[hoverIdx ?? series.length - 1] ?? null
  const activeMas = active
    ? maValues.map((values) => values[hoverIdx ?? series.length - 1] ?? null)
    : []
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
        <div className="candle-chart__plot">
          <div className="candle-chart__legend" data-numeric>
            <span>
              {copy.ohlc.open} <i>{fmtPrice(active.o)}</i>
            </span>
            <span>
              {copy.ohlc.high} <i>{fmtPrice(active.h)}</i>
            </span>
            <span>
              {copy.ohlc.low} <i>{fmtPrice(active.l)}</i>
            </span>
            <span>
              {copy.ohlc.close} <i data-trend={trend}>{fmtPrice(active.c)}</i>
            </span>
            <i data-trend={trend}>
              {change >= 0 ? '+' : ''}
              {formatPercent(change, locale)}%
            </i>
            <span>
              {copy.vol} <i>{formatAmount(active.v, locale, true)}</i>
            </span>
            {MA_WINDOWS.map((window, i) =>
              activeMas[i] != null ? (
                <span key={window} className={`candle-chart__ma candle-chart__ma--${i}`}>
                  MA{window} <i>{activeMas[i] != null ? fmtPrice(activeMas[i]) : null}</i>
                </span>
              ) : null,
            )}
          </div>
          <div
            className="candle-chart__holder"
            ref={containerRef}
            role="img"
            aria-label={`${pairLabel} ${copy.chartAlt}`}
          />
        </div>
      ) : (
        <div className="candle-chart__empty">{copy.syncing}</div>
      )}
    </div>
  )
}

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

import type { Locale, FixtureCandle, FixtureFineCandles } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { formatAmount, formatPercent } from '../global/signal-ui'
import { fmtPrice } from '../global/amount-format'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

/** 粒度集（Q3 用户裁定：粒度式学币安；全部可选——细粒度走 fixture 样本，粗粒度由 1h 聚合） */
const GRANULARITIES = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'] as const
type Granularity = (typeof GRANULARITIES)[number]
/** 粗粒度每根聚合蜡烛吸收的 1h 蜡烛数 */
const AGGREGATE: Partial<Record<Granularity, number>> = { '1h': 1, '4h': 4, '1d': 24, '1w': 168 }
/** 初始喂给图表的蜡烛数；无限左滑：视口逼近左缘时按 LOAD_CHUNK 增量再喂（交易所标准做法） */
const INITIAL_BARS = 96
const LOAD_CHUNK = 240
const EDGE_BARS = 10
/** 均线窗口（2026-09-23 用户裁定：MA7/MA30/MA60 三线） */
const MA_WINDOWS = [7, 30, 60] as const
/** 均线配色：快=青 / 中=品红回声 / 慢=次级灰（token 运行时读取） */
const MA_COLOR_VARS = ['--or-cyan', '--accent-echo', '--color-text-secondary'] as const
const MA_ALPHAS = [0.55, 0.45, 0.9] as const

function aggregate(candles: FixtureCandle[], size: number): FixtureCandle[] {
  const out: FixtureCandle[] = []
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
  candles: FixtureCandle[]
  fineCandles: FixtureFineCandles | null
  locale: Locale
  pairLabel: string
  header?: ReactNode
}) {
  const copy = getCopy(locale).verseDesk
  const [granularity, setGranularity] = useState<Granularity>('1h')
  const [limit, setLimit] = useState(INITIAL_BARS)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  /** 库异步就位、图表建好后才 true：把喂入/无限左滑/十字线三个消费 chart refs 的
   *  effect 重新触发一遍——它们首次运行时图表多半还没建好，?. 静默空转不会自愈 */
  const [chartReady, setChartReady] = useState(false)
  /** 增量喂入后待恢复的视口（防 setData 前插导致画面跳动） */
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

  /** 当前粒度可载入的总蜡烛数（repo 已回溯派生 ~1 年 1h 历史；细粒度=fixture 样本量） */
  const totalBars = useMemo(() => {
    if (granularity === '1m' || granularity === '5m' || granularity === '15m') {
      return fineCandles ? fineCandles[granularity].length : 0
    }
    const size = AGGREGATE[granularity] ?? 1
    return Math.ceil(candles.length / size)
  }, [candles, fineCandles, granularity])

  /** holder 在 DOM 的判据（plot 分支 = series 非空）：数据后到/粒度空态往返经 init effect 依赖重建图表 */
  const hasData = series.length > 0

  // 粒度切换重置初始视口
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
    // lightweight-charts（~74KB gzip）到 effect 运行时才 import，不进路由 eager chunk，
    // 水合/交互不被它阻塞（在 RSC import 处做 dynamic 且不带 ssr:false 拆不出：SSR 渲染
    // 的是真实内容，边界随根一起水合；ssr:false 包裹层则丢 SSR 外壳+占位跳动）。
    // 重复 import 走模块缓存，locale 重建图表无额外开销
    let cancelled = false
    let teardownChart = () => {}
    import('lightweight-charts').then(
      ({ createChart, CandlestickSeries, ColorType, HistogramSeries, LineSeries }) => {
        if (cancelled || containerRef.current !== el) return
        const chart = createChart(el, {
          autoSize: true,
          // 时间轴刻度随页面 locale（库缺省跟随浏览器 locale，曾致 en 页出现「12日/9月」）
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
          // top 0.10：顶部留白给悬浮读数行让位（2026-09-24 用户裁定——读数行离蜡烛太近）
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
      // chunk 失效/弱网断流：不留 unhandled rejection；图表区保持空态
      console.error('candle-chart: lightweight-charts 加载失败', error)
    })
    return () => {
      cancelled = true
      teardownChart()
      setChartReady(false)
    }
  }, [locale, hasData])

  useEffect(() => {
    // 图表未就位（库异步加载/locale 重建窗口）整跑跳过：firstDataRef/restoreRangeRef 等
    // 标志的消耗不走 ?.，空转跑会把「首次挂载 fitContent / 视口恢复」提前吃掉
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
    // 增量前插：恢复原视口（右移 added 根）；粒度切换/首次挂载：fitContent
    if (restoreRangeRef.current) {
      chartRef.current?.timeScale().setVisibleLogicalRange(restoreRangeRef.current)
      restoreRangeRef.current = null
    } else if (prevGranularityRef.current !== granularity || firstDataRef.current) {
      prevGranularityRef.current = granularity
      firstDataRef.current = false
      chartRef.current?.timeScale().fitContent()
    }
  }, [series, maValues, granularity, chartReady])

  // 无限左滑：视口距左缘 < EDGE_BARS 根时再喂一批，直到 totalBars 全量
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

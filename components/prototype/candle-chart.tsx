'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  dispose,
  init,
  type Chart,
  type KLineData,
  type Period,
} from 'klinecharts'
import {
  Activity,
  AudioWaveform,
  BarChart3,
  CircleDashed,
  Eraser,
  Minus,
  MousePointer2,
  Ruler,
  Square,
  TrendingUp,
} from 'lucide-react'

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

const PERIOD_BY_GRANULARITY: Record<Granularity, Period> = {
  '1m': { type: 'minute', span: 1 },
  '5m': { type: 'minute', span: 5 },
  '15m': { type: 'minute', span: 15 },
  '1h': { type: 'hour', span: 1 },
  '4h': { type: 'hour', span: 4 },
  '1d': { type: 'day', span: 1 },
  '1w': { type: 'week', span: 1 },
}
const GRANULARITY_BY_PERIOD_KEY: Record<string, Granularity> = {
  'minute:1': '1m',
  'minute:5': '5m',
  'minute:15': '15m',
  'hour:1': '1h',
  'hour:4': '4h',
  'day:1': '1d',
  'week:1': '1w',
}

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

/** 渲染层不自造颜色——token 十六进制运行时读取 */
function cssVar(name: string): string {
  if (typeof window === 'undefined') return 'transparent'
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || 'transparent'
}

/** 左侧工具栏：画线工具 + 指标开关（klinecharts 内置引擎，2026-09-23 用户裁定：专业 K 线工具属行业标配） */
const DRAW_TOOLS = [
  { name: 'segment', icon: TrendingUp, label: 'Trend line' },
  { name: 'horizontalStraightLine', icon: Minus, label: 'Horizontal line' },
  { name: 'fibonacciLine', icon: Ruler, label: 'Fibonacci' },
  { name: 'rect', icon: Square, label: 'Rectangle' },
] as const
type DrawTool = (typeof DRAW_TOOLS)[number]['name']

const INDICATORS = [
  { name: 'MA', calcParams: [7, 25], stack: true, icon: Activity, label: 'MA' },
  { name: 'VOL', stack: false, icon: BarChart3, label: 'Volume' },
  { name: 'MACD', stack: false, icon: AudioWaveform, label: 'MACD' },
  { name: 'BOLL', stack: true, icon: CircleDashed, label: 'BOLL' },
] as const
type IndicatorName = (typeof INDICATORS)[number]['name']

/** 主池蜡烛图（klinecharts：指标+画线工具+悬浮读数，对齐专业交易站标配——2026-09-23） */
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
  const [tool, setTool] = useState<DrawTool | null>(null)
  const [indicatorOn, setIndicatorOn] = useState<Record<IndicatorName, boolean>>({
    MA: true,
    VOL: true,
    MACD: false,
    BOLL: false,
  })
  const holderRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<Chart | null>(null)
  const indicatorIdsRef = useRef<Partial<Record<IndicatorName, string>>>({})

  const series = useMemo(() => {
    if (granularity === '1m' || granularity === '5m' || granularity === '15m') {
      return fineCandles ? fineCandles[granularity] : []
    }
    const size = AGGREGATE[granularity]
    if (!size) return []
    return aggregate(candles.slice(-MAX_CANDLES * size), size)
  }, [candles, fineCandles, granularity])

  useEffect(() => {
    const el = holderRef.current
    if (!el) return
    const up = cssVar('--color-success')
    const down = cssVar('--color-danger')
    const secondary = cssVar('--color-text-secondary')
    const mono = cssVar('--font-data')
    const border = cssVar('--color-border')
    const grid = cssVar('--grid-cyan-inner')
    const chart = init(el, {
      styles: {
        grid: { horizontal: { color: grid }, vertical: { color: grid } },
        candle: {
          bar: {
            upColor: up,
            downColor: down,
            upBorderColor: up,
            downBorderColor: down,
            upWickColor: up,
            downWickColor: down,
            noChangeColor: up,
            noChangeBorderColor: up,
            noChangeWickColor: up,
          },
        },
        indicator: {
          ohlc: { upColor: up, downColor: down, noChangeColor: up },
          tooltip: { legend: { family: mono, color: secondary } },
        },
        xAxis: { tickText: { color: secondary, family: mono }, axisLine: { color: border } },
        yAxis: { tickText: { color: secondary, family: mono }, axisLine: { color: border } },
        crosshair: {
          horizontal: { text: { backgroundColor: cssVar('--color-surface-raised') } },
          vertical: { text: { backgroundColor: cssVar('--color-surface-raised') } },
        },
        separator: { color: border },
      },
    })
    if (!chart) return
    chartRef.current = chart
    return () => {
      dispose(chart)
      chartRef.current = null
      indicatorIdsRef.current = {}
    }
  }, [])

  // 数据装载（v10 setDataLoader）：按 period 请求选择 fixture 序列，全量返回（无增量）
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    chart.setDataLoader({
      getBars: ({ period, callback }) => {
        const key = `${period.type}:${period.span}`
        const gran = GRANULARITY_BY_PERIOD_KEY[key] ?? '1h'
        let rows: PrototypeCandle[]
        if (gran === '1m' || gran === '5m' || gran === '15m') {
          rows = fineCandles ? fineCandles[gran] : []
        } else {
          const size = AGGREGATE[gran] ?? 1
          rows = aggregate(candles.slice(-MAX_CANDLES * size), size)
        }
        callback(
          rows.map<KLineData>((candle) => ({
            timestamp: Date.parse(candle.t),
            open: candle.o,
            high: candle.h,
            low: candle.l,
            close: candle.c,
            volume: candle.v,
          })),
          false,
        )
      },
    })
    chart.setSymbol({ ticker: pairLabel, pricePrecision: 6, volumePrecision: 0 })
  }, [candles, fineCandles, pairLabel])

  useEffect(() => {
    chartRef.current?.setPeriod(PERIOD_BY_GRANULARITY[granularity])
  }, [granularity])

  const toggleIndicator = (name: IndicatorName) => {
    const chart = chartRef.current
    if (!chart) return
    const next = !indicatorOn[name]
    if (next) {
      const spec = INDICATORS.find((item) => item.name === name)
      const id = chart.createIndicator(
        spec && 'calcParams' in spec && spec.calcParams ? { name, calcParams: [...spec.calcParams] } : name,
        spec?.stack ?? false,
      )
      if (id) indicatorIdsRef.current[name] = id
    } else {
      const id = indicatorIdsRef.current[name]
      if (id) chart.removeIndicator({ id })
      delete indicatorIdsRef.current[name]
    }
    setIndicatorOn((state) => ({ ...state, [name]: next }))
  }

  const toggleTool = (name: DrawTool) => {
    const chart = chartRef.current
    if (!chart) return
    if (tool === name) {
      chart.removeOverlay({ name })
      setTool(null)
      return
    }
    if (tool) chart.removeOverlay({ name: tool })
    chart.createOverlay({ name })
    setTool(name)
  }

  const clearOverlays = () => {
    chartRef.current?.removeOverlay()
    setTool(null)
  }

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
        <div className="candle-chart__plot" role="img" aria-label={`${pairLabel} OHLC`}>
          <div className="candle-chart__toolbar" role="toolbar" aria-label="chart tools">
            <button
              type="button"
              className="candle-chart__tool"
              data-active={tool == null}
              onClick={() => {
                if (tool) chartRef.current?.removeOverlay({ name: tool })
                setTool(null)
              }}
              aria-label="pointer"
            >
              <MousePointer2 aria-hidden="true" size={14} />
            </button>
            {DRAW_TOOLS.map((item) => (
              <button
                key={item.name}
                type="button"
                className="candle-chart__tool"
                data-active={tool === item.name}
                onClick={() => toggleTool(item.name)}
                aria-label={item.label}
              >
                <item.icon aria-hidden="true" size={14} />
              </button>
            ))}
            <button
              type="button"
              className="candle-chart__tool"
              onClick={clearOverlays}
              aria-label="clear drawings"
            >
              <Eraser aria-hidden="true" size={14} />
            </button>
            <span className="candle-chart__tool-divider" />
            {INDICATORS.map((item) => (
              <button
                key={item.name}
                type="button"
                className="candle-chart__tool"
                data-active={indicatorOn[item.name]}
                onClick={() => toggleIndicator(item.name)}
                aria-label={item.label}
              >
                <item.icon aria-hidden="true" size={14} />
              </button>
            ))}
          </div>
          <div className="candle-chart__holder" ref={holderRef} />
        </div>
      ) : (
        <div className="candle-chart__empty">{copy.syncing}</div>
      )}
    </div>
  )
}

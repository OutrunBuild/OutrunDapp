'use client'

import { useMemo, useState } from 'react'

import type { Locale, PrototypeCandle } from '@/lib/data/prototype-repository'

import { getCopy } from './copy'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

/** 可用粒度（Q3 用户裁定：粒度式学币安）。1h 为 fixture 原始粒度；粗粒度聚合；细分粒度标「同步中」 */
const GRANULARITIES = ['1m', '5m', '15m', '1h', '4h', '1d', '1w'] as const
type Granularity = (typeof GRANULARITIES)[number]
/** 每根聚合蜡烛吸收的 1h 蜡烛数 */
const AGGREGATE: Partial<Record<Granularity, number>> = { '1h': 1, '4h': 4, '1d': 24, '1w': 168 }

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

export function CandleChart({
  candles,
  locale,
  pairLabel,
}: {
  candles: PrototypeCandle[]
  locale: Locale
  pairLabel: string
}) {
  const copy = getCopy(locale).verseDesk
  const [granularity, setGranularity] = useState<Granularity>('1h')

  const series = useMemo(() => {
    const size = AGGREGATE[granularity]
    return size ? aggregate(candles, size) : []
  }, [candles, granularity])

  const last = candles.at(-1)
  const first = candles[0]
  const range = useMemo(() => {
    if (!series.length) return null
    const lo = Math.min(...series.map((c) => c.l))
    const hi = Math.max(...series.map((c) => c.h))
    return { lo, hi, span: hi - lo || hi * 0.01 }
  }, [series])

  const W = 640
  const H = 240
  const PAD = 8
  const bodyW = Math.max(1.5, (W - PAD * 2) / series.length / 2.4)

  return (
    <div className="candle-chart">
      <div className="candle-chart__head">
        <div className="candle-chart__pair">
          <strong>{copy.chartTitle}</strong>
          <span>{pairLabel}</span>
        </div>
        <ToggleGroup
          className="candle-chart__granularity"
          value={[granularity]}
          onValueChange={(value) => {
            if (value[0]) setGranularity(value[0] as Granularity)
          }}
          aria-label={copy.granularity}
        >
          {GRANULARITIES.map((item) => (
            <ToggleGroupItem key={item} value={item} disabled={!AGGREGATE[item]} title={AGGREGATE[item] ? undefined : copy.syncing}>
              {item}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      {series.length > 0 && range ? (
        <svg
          className="candle-chart__svg"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${pairLabel} OHLC`}
        >
          {series.map((candle, i) => {
            const x = PAD + ((W - PAD * 2) / series.length) * (i + 0.5)
            const y = (v: number) => PAD + (1 - (v - range.lo) / range.span) * (H - PAD * 2)
            const up = candle.c >= candle.o
            const top = y(Math.max(candle.o, candle.c))
            const bottom = y(Math.min(candle.o, candle.c))
            return (
              <g key={candle.t} className={up ? 'candle--up' : 'candle--down'}>
                <line x1={x} x2={x} y1={y(candle.h)} y2={y(candle.l)} strokeWidth="1" />
                <rect
                  x={x - bodyW / 2}
                  y={top}
                  width={bodyW}
                  height={Math.max(1, bottom - top)}
                />
              </g>
            )
          })}
        </svg>
      ) : (
        <div className="candle-chart__empty">{copy.syncing}</div>
      )}
      {last && first ? (
        <div className="candle-chart__meta" data-numeric>
          <span>O {first.o.toFixed(6)}</span>
          <span>H {last.h.toFixed(6)}</span>
          <span>L {last.l.toFixed(6)}</span>
          <span>C {last.c.toFixed(6)}</span>
        </div>
      ) : null}
    </div>
  )
}

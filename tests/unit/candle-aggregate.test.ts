// Candle aggregation boundary: buckets are built backwards from the newest candle, so the
// OLDEST bucket carries the remainder (partial) and must still open at its own first candle and
// close at its own last one. candle-order.test.ts only locks the fixture time order — this file
// locks the bucket algebra itself (open/close/high/low/volume and the partial head bucket).
import { describe, expect, it } from 'vitest';

import type { Candle } from '@/lib/data/fixture-repository';
import { aggregate } from '../../components/verse/candle-chart';

const candle = (t: string, o: number, h: number, l: number, c: number, v: number): Candle => ({
  t,
  o,
  h,
  l,
  c,
  v,
});

const hour = (n: number) => `2026-09-16T${String(n).padStart(2, '0')}:00:00Z`;

describe('aggregate (bucket open/close, high/low, volume)', () => {
  it('merges a full bucket into one candle: opens first, closes last, extremes kept', () => {
    const source = [
      candle(hour(0), 1, 3, 0.5, 2, 10),
      candle(hour(1), 2, 5, 1.5, 4, 20),
      candle(hour(2), 4, 4.5, 2, 3, 5),
      candle(hour(3), 3, 6, 2.5, 5, 7),
    ];
    expect(aggregate(source, 4)).toEqual([{ t: hour(0), o: 1, h: 6, l: 0.5, c: 5, v: 42 }]);
  });

  it('leaves the OLDEST bucket partial — its own open and close, never borrowed', () => {
    // 5 candles, size 4 → buckets [c0] (partial head) and [c1..c4]
    const source = [
      candle(hour(0), 9, 9.5, 8.8, 9.2, 100),
      candle(hour(1), 1, 3, 0.5, 2, 10),
      candle(hour(2), 2, 5, 1.5, 4, 20),
      candle(hour(3), 4, 4.5, 2, 3, 5),
      candle(hour(4), 3, 6, 2.5, 5, 7),
    ];
    expect(aggregate(source, 4)).toEqual([
      { t: hour(0), o: 9, h: 9.5, l: 8.8, c: 9.2, v: 100 },
      { t: hour(1), o: 1, h: 6, l: 0.5, c: 5, v: 42 },
    ]);
  });

  it('returns an empty list unchanged and a size ≥ length as one bucket', () => {
    expect(aggregate([], 4)).toEqual([]);
    const source = [candle(hour(0), 1, 2, 0.5, 1.5, 3), candle(hour(1), 1.5, 1.8, 1, 1.2, 4)];
    expect(aggregate(source, 10)).toEqual([{ t: hour(0), o: 1, h: 2, l: 0.5, c: 1.2, v: 7 }]);
  });

  it('sums volume across legs and keeps order oldest-first for many buckets', () => {
    const source = [0, 1, 2, 3, 4, 5].map((n) => candle(hour(n), n, n + 1, n - 1, n + 0.5, n + 1));
    const out = aggregate(source, 2);
    expect(out).toHaveLength(3);
    expect(out.map((c) => c.t)).toEqual([hour(0), hour(2), hour(4)]);
    expect(out[0]).toEqual({ t: hour(0), o: 0, h: 2, l: -1, c: 1.5, v: 3 });
  });
});

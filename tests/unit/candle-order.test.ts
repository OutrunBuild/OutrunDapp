// Candlestick timestamp ordering regression: verse-003 main 1h once went
// backwards in time at bar 164 (11:00 → 08:00, landing exactly
// inside the initial 96-bar window), and lightweight-charts setData crashes
// the whole page with "data must be asc ordered by time". The chart component
// does not sort; ordering must be guaranteed at the data layer (fixture
// snapshot + extendHourlyHistory derivation seam).
import { describe, expect, it } from 'vitest';

import { getSnapshot, getVerseTrade } from '../../lib/data/fixture-repository';

function assertAscending(label: string, times: number[]) {
  for (let i = 1; i < times.length; i++) {
    if (times[i] <= times[i - 1]) {
      throw new Error(
        `${label} timestamps not strictly increasing: i=${i} ${times[i - 1]} -> ${times[i]}`,
      );
    }
  }
}

describe('candle timestamps strictly increasing (lightweight-charts setData precondition)', () => {
  const verses = getSnapshot().verses.filter(
    (verse) => verse.stage === 'locked' || verse.stage === 'unlocked',
  );
  const versesWithCandles = verses.filter(
    (verse) => (getVerseTrade(verse.id)?.candles.length ?? 0) > 0,
  );

  it('count of locked/unlocked verses with candle samples > 0 (guards against an emptied snapshot passing vacuously)', () => {
    expect(versesWithCandles.length).toBeGreaterThan(0);
  });

  it.each(versesWithCandles.map((verse) => [verse.id, verse.stage] as const))(
    '%s (%s): 1h full history + fine-grained samples strictly increasing',
    (verseId) => {
      const trade = getVerseTrade(verseId)!;
      assertAscending(
        `${verseId} 1h`,
        trade.candles.map((candle) => Date.parse(candle.t)),
      );
      if (trade.fineCandles) {
        for (const gran of ['1m', '5m', '15m'] as const) {
          const rows = trade.fineCandles[gran];
          assertAscending(
            `${verseId} ${gran}`,
            rows.map((candle) => Date.parse(candle.t)),
          );
        }
      }
    },
  );
});

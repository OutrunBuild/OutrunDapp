// K线时间戳有序性回归（2026-09-25）：verse-003 main 1h 曾在第 164 根时间倒序
// （11:00 → 08:00，恰好落进初始 96 根窗口），lightweight-charts setData 断言
// "data must be asc ordered by time" 直接崩整页；图表组件不做排序，
// 有序性必须由数据层保证（fixture 快照 + extendHourlyHistory 派生接缝）。
import { describe, expect, it } from 'vitest';

import { getPrototypeSnapshot, getPrototypeVerseTrade } from '../../lib/data/prototype-repository';

function assertAscending(label: string, times: number[]) {
  for (let i = 1; i < times.length; i++) {
    if (times[i] <= times[i - 1]) {
      throw new Error(`${label} 时间戳非严格递增：i=${i} ${times[i - 1]} → ${times[i]}`);
    }
  }
}

describe('K线时间戳严格递增（lightweight-charts setData 前置条件）', () => {
  const verses = getPrototypeSnapshot().verses.filter(
    (verse) => verse.stage === 'locked' || verse.stage === 'unlocked',
  );

  it('有 K 线样本的 locked/unlocked verse 数量 > 0（防快照掏空导致空转通过）', () => {
    const withCandles = verses.filter(
      (verse) => (getPrototypeVerseTrade(verse.id)?.candles.length ?? 0) > 0,
    );
    expect(withCandles.length).toBeGreaterThan(0);
  });

  it.each(verses.map((verse) => [verse.id, verse.stage] as const))(
    '%s（%s）：1h 全量历史 + 细粒度样本严格递增',
    (verseId) => {
      const trade = getPrototypeVerseTrade(verseId);
      if (!trade || trade.candles.length === 0) return // 无样本 verse 跳过（B3 降级口径）
      assertAscending(`${verseId} 1h`, trade.candles.map((candle) => Date.parse(candle.t)))
      if (trade.fineCandles) {
        for (const gran of ['1m', '5m', '15m'] as const) {
          const rows = trade.fineCandles[gran]
          assertAscending(`${verseId} ${gran}`, rows.map((candle) => Date.parse(candle.t)))
        }
      }
    },
  )
})

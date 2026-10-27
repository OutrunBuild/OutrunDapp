// signal-ui formatting pure-function unit tests. Pins the display standards:
// compact amounts always show two decimals (min=max=2), formatHex truncates to
// head-6 + tail-4, formatMarketCap uses fixed B/M/K abbreviations and does not
// convert per locale, formatStamp/formatDay render in UTC+8 (fixture
// timestamps are fixed UTC, display converts to UTC+8).
import { describe, expect, it } from 'vitest';

import {
  formatAmount,
  formatCountdown,
  formatDay,
  formatDate,
  formatHex,
  formatMarketCap,
  formatPercent,
  formatStamp,
} from '../../components/global/signal-ui';

describe('formatAmount: decimal-place tiers + compact two-decimal discipline', () => {
  it('>=1 at most two decimals, <1 at most six', () => {
    expect(formatAmount(1234.5, 'en')).toBe('1,234.5');
    expect(formatAmount(0.123456789, 'en')).toBe('0.123457');
    expect(formatAmount(42, 'zh')).toBe('42');
  });

  it('compact always shows two decimals (eliminates the mixed 45K/122.83K/2.1K within one column)', () => {
    expect(formatAmount(45_000, 'en', true)).toBe('45.00K');
    expect(formatAmount(122_830, 'en', true)).toBe('122.83K');
  });

  it('zh follows zh-CN compact convention (wan grouping)', () => {
    expect(formatAmount(45_000, 'zh', true)).toBe('4.50万');
  });
});

describe('formatPercent: one decimal by default, fixed precision on request', () => {
  it('rounds to one decimal', () => {
    expect(formatPercent(12.25, 'en')).toBe('12.3');
    expect(formatPercent(0, 'zh')).toBe('0');
  });

  it('fixed digits pad trailing zeros (price impact shows two decimals)', () => {
    expect(formatPercent(12.2, 'en', 2)).toBe('12.20');
    expect(formatPercent(0.004, 'en', 2)).toBe('0.00');
    expect(formatPercent(0, 'zh', 2)).toBe('0.00');
  });
});

describe('formatHex: address/hash truncation', () => {
  it('head 6 + ellipsis + tail 4', () => {
    expect(formatHex('0x1234567890abcdef')).toBe('0x1234…cdef');
  });
});

describe('formatMarketCap: fixed B/M/K abbreviations + two decimals', () => {
  it('not locale-converted to CJK units', () => {
    expect(formatMarketCap(1_234_567_890)).toBe('1.23B');
    expect(formatMarketCap(45_000_000)).toBe('45.00M');
    expect(formatMarketCap(122_830)).toBe('122.83K');
  });

  it('below K shows bare two decimals', () => {
    expect(formatMarketCap(999.5)).toBe('999.50');
    expect(formatMarketCap(0)).toBe('0.00');
  });
});

describe('formatDate: UTC date-time (middle tier)', () => {
  it('en/zh each in own locale form (timeZone=UTC, no +8 shift)', () => {
    expect(formatDate('2026-10-01T00:00:00Z', 'en')).toBe('Oct 1, 2026, 12:00 AM');
    expect(formatDate('2026-10-01T00:00:00Z', 'zh')).toBe('2026年10月1日 00:00');
  });
});

describe('formatStamp: compact timestamp in UTC+8', () => {
  it('YYYY-MM-DD HH:mm, +8 shift including day rollover', () => {
    expect(formatStamp('2026-10-01T00:00:00Z')).toBe('2026-10-01 08:00');
    expect(formatStamp('2026-09-30T18:00:00Z')).toBe('2026-10-01 02:00');
  });
});

describe('formatDay: date only (Dec 25, 2024 form)', () => {
  it('takes the day after +8 shift (day boundary 18:00Z rolls to next day)', () => {
    expect(formatDay('2026-10-01T00:00:00Z', 'en')).toBe('Oct 1, 2026');
    expect(formatDay('2026-09-30T18:00:00Z', 'en')).toBe('Oct 1, 2026');
    expect(formatDay('2026-10-01T00:00:00Z', 'zh')).toBe('2026年10月1日');
  });
});

describe('formatCountdown: genesis deadline spans', () => {
  it('day spans use day/hour words per locale', () => {
    expect(formatCountdown(2 * 86_400_000 + 4 * 3_600_000, 'en')).toBe('2d 4h');
    expect(formatCountdown(2 * 86_400_000 + 4 * 3_600_000, 'zh')).toBe('2 天 4 小时');
  });

  it('hour spans use hour/minute words per locale', () => {
    expect(formatCountdown(5 * 3_600_000 + 30 * 60_000, 'en')).toBe('5h 30m');
    expect(formatCountdown(5 * 3_600_000 + 30 * 60_000, 'zh')).toBe('5 小时 30 分');
  });

  it('sub-hour spans show whole minutes, never a seconds readout or a pending zero', () => {
    expect(formatCountdown(90_000, 'en')).toBe('1m');
    expect(formatCountdown(90_000, 'zh')).toBe('1 分钟');
    expect(formatCountdown(45 * 60_000, 'en')).toBe('45m');
    expect(formatCountdown(10_000, 'en')).toBe('1m');
    expect(formatCountdown(-1_000, 'en')).toBe('0m');
  });
});

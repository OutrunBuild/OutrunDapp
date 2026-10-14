// formatRelative branch-boundary unit tests.
// Four minute-granularity branches (justNow/min/hour/day, copy keys copy.ts
// referral.ago) + future timestamps render "just now" (negative minutes and
// <1 minute both fall into the first branch; the Math.max(0,…) clamp does not
// change output); minutes/hours/days all use Math.round integer reflow.
import { describe, expect, it } from 'vitest';

import { formatRelative } from '../../components/referral/relative-time';

const NOW = Date.parse('2026-10-01T00:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const ahead = (ms: number) => new Date(NOW + ms).toISOString();

describe('formatRelative: minute-granularity branches', () => {
  it('just now: under 1 minute after rounding (true boundary 30s, Math.round(0.5)=1 carries)', () => {
    expect(formatRelative(ago(0), 'en', NOW)).toBe('just now');
    expect(formatRelative(ago(20_000), 'en', NOW)).toBe('just now');
    expect(formatRelative(ahead(5 * 60_000), 'en', NOW)).toBe('just now');
    // Half-minute reflow carries: 0.5 → 1
    expect(formatRelative(ago(30_000), 'en', NOW)).toBe('1 min ago');
  });

  it('min branch: under 60 minutes', () => {
    expect(formatRelative(ago(5 * 60_000), 'en', NOW)).toBe('5 min ago');
    expect(formatRelative(ago(59 * 60_000), 'en', NOW)).toBe('59 min ago');
  });

  it('59.5 minutes rounds into the hour branch (Math.round(59.5)=60)', () => {
    expect(formatRelative(ago(59 * 60_000 + 30_000), 'en', NOW)).toBe('1 h ago');
  });

  it('hour branch: under 24 hours (round(90/60)=2)', () => {
    expect(formatRelative(ago(90 * 60_000), 'en', NOW)).toBe('2 h ago');
    expect(formatRelative(ago(23 * 3_600_000), 'en', NOW)).toBe('23 h ago');
  });

  it('day branch: >=24 hours (round(25/24)=1, round(60/24)=3)', () => {
    expect(formatRelative(ago(25 * 3_600_000), 'en', NOW)).toBe('1 d ago');
    expect(formatRelative(ago(60 * 3_600_000), 'en', NOW)).toBe('3 d ago');
  });

  it('zh copy branches', () => {
    expect(formatRelative(ago(0), 'zh', NOW)).toBe('刚刚');
    expect(formatRelative(ago(5 * 60_000), 'zh', NOW)).toBe('5 分钟前');
    expect(formatRelative(ago(90 * 60_000), 'zh', NOW)).toBe('2 小时前');
    expect(formatRelative(ago(25 * 3_600_000), 'zh', NOW)).toBe('1 天前');
  });
});

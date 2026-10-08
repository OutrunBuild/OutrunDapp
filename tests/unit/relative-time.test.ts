// formatRelative 分支边界单测（2026-10-08 测试盲区裁决 [D]：模块私有 → 导出配测）。
// 分钟粒度四分支（justNow/min/hour/day，文案键 copy.ts referral.ago）+ 未来时刻渲染
// just now（负分钟与 <1 分钟同落首分支，Math.max(0,…) 钳制不改变输出）；分钟/小时/天
// 均取 Math.round 整流。
import { describe, expect, it } from 'vitest';

import { formatRelative } from '../../components/referral/relative-time';

const NOW = Date.parse('2026-10-01T00:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const ahead = (ms: number) => new Date(NOW + ms).toISOString();

describe('formatRelative：分钟粒度分支', () => {
  it('just now：round 后 <1 分钟（真实边界=30s，Math.round(0.5)=1 已进位）', () => {
    expect(formatRelative(ago(0), 'en', NOW)).toBe('just now');
    expect(formatRelative(ago(20_000), 'en', NOW)).toBe('just now');
    expect(formatRelative(ahead(5 * 60_000), 'en', NOW)).toBe('just now');
    // 半分钟整流进位：0.5 → 1
    expect(formatRelative(ago(30_000), 'en', NOW)).toBe('1 min ago');
  });

  it('min 分支：<60 分钟', () => {
    expect(formatRelative(ago(5 * 60_000), 'en', NOW)).toBe('5 min ago');
    expect(formatRelative(ago(59 * 60_000), 'en', NOW)).toBe('59 min ago');
  });

  it('59.5 分钟整流进小时分支（Math.round(59.5)=60）', () => {
    expect(formatRelative(ago(59 * 60_000 + 30_000), 'en', NOW)).toBe('1 h ago');
  });

  it('hour 分支：<24 小时（round(90/60)=2）', () => {
    expect(formatRelative(ago(90 * 60_000), 'en', NOW)).toBe('2 h ago');
    expect(formatRelative(ago(23 * 3_600_000), 'en', NOW)).toBe('23 h ago');
  });

  it('day 分支：≥24 小时（round(25/24)=1、round(60/24)=3）', () => {
    expect(formatRelative(ago(25 * 3_600_000), 'en', NOW)).toBe('1 d ago');
    expect(formatRelative(ago(60 * 3_600_000), 'en', NOW)).toBe('3 d ago');
  });

  it('zh 文案分支', () => {
    expect(formatRelative(ago(0), 'zh', NOW)).toBe('刚刚');
    expect(formatRelative(ago(5 * 60_000), 'zh', NOW)).toBe('5 分钟前');
    expect(formatRelative(ago(90 * 60_000), 'zh', NOW)).toBe('2 小时前');
    expect(formatRelative(ago(25 * 3_600_000), 'zh', NOW)).toBe('1 天前');
  });
});

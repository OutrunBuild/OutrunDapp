// signal-ui 格式化纯函数单测（2026-10-08 测试盲区裁决 [B]：姊妹模块 amount-format 全测、
// 本模块零测）。钉死登记口径：017 compact 恒两位小数（min=max=2）、formatHex 头 6+尾 4
// 收敛（2026-10-08 三处私有实现收敛）、formatMarketCap 不随 locale 换算（2026-09-23 用户
// 裁定）、formatStamp/formatDay 的 UTC+8 口径（fixture 时刻为固定 UTC，展示转 UTC+8）。
import { describe, expect, it } from 'vitest';

import {
  formatAmount,
  formatDay,
  formatDate,
  formatHex,
  formatMarketCap,
  formatPercent,
  formatStamp,
} from '../../components/global/signal-ui';

describe('formatAmount：位数分档 + compact 017 数字纪律', () => {
  it('≥1 最多两位小数、<1 最多六位', () => {
    expect(formatAmount(1234.5, 'en')).toBe('1,234.5');
    expect(formatAmount(0.123456789, 'en')).toBe('0.123457');
    expect(formatAmount(42, 'zh')).toBe('42');
  });

  it('compact 恒两位小数（终结 45K/122.83K/2.1K 同列混排）', () => {
    expect(formatAmount(45_000, 'en', true)).toBe('45.00K');
    expect(formatAmount(122_830, 'en', true)).toBe('122.83K');
  });

  it('zh 走 zh-CN 紧凑习惯（万位）', () => {
    expect(formatAmount(45_000, 'zh', true)).toBe('4.50万');
  });
});

describe('formatPercent：一位小数', () => {
  it('四舍五入到一位', () => {
    expect(formatPercent(12.25, 'en')).toBe('12.3');
    expect(formatPercent(0, 'zh')).toBe('0');
  });
});

describe('formatHex：地址/哈希截断', () => {
  it('头 6 + … + 尾 4（2026-10-08 三处私有实现收敛）', () => {
    expect(formatHex('0x1234567890abcdef')).toBe('0x1234…cdef');
  });
});

describe('formatMarketCap：B/M/K 固定缩写 + 两位小数', () => {
  it('不随 locale 换算为亿/万（2026-09-23 用户裁定）', () => {
    expect(formatMarketCap(1_234_567_890)).toBe('1.23B');
    expect(formatMarketCap(45_000_000)).toBe('45.00M');
    expect(formatMarketCap(122_830)).toBe('122.83K');
  });

  it('K 以下裸两位小数', () => {
    expect(formatMarketCap(999.5)).toBe('999.50');
    expect(formatMarketCap(0)).toBe('0.00');
  });
});

describe('formatDate：UTC 中档日期时间', () => {
  it('en/zh 各自 locale 形态（timeZone=UTC，不做 +8 位移）', () => {
    expect(formatDate('2026-10-01T00:00:00Z', 'en')).toBe('Oct 1, 2026, 12:00 AM');
    expect(formatDate('2026-10-01T00:00:00Z', 'zh')).toBe('2026年10月1日 00:00');
  });
});

describe('formatStamp：紧凑时间戳 UTC+8 口径', () => {
  it('YYYY-MM-DD HH:mm，+8 位移含跨日', () => {
    expect(formatStamp('2026-10-01T00:00:00Z')).toBe('2026-10-01 08:00');
    expect(formatStamp('2026-09-30T18:00:00Z')).toBe('2026-10-01 02:00');
  });
});

describe('formatDay：纯日期（Dec 25, 2024 形态，2026-09-26 用户裁定）', () => {
  it('UTC+8 位移后取日（跨日边界 18:00Z → 次日）', () => {
    expect(formatDay('2026-10-01T00:00:00Z', 'en')).toBe('Oct 1, 2026');
    expect(formatDay('2026-09-30T18:00:00Z', 'en')).toBe('Oct 1, 2026');
    expect(formatDay('2026-10-01T00:00:00Z', 'zh')).toBe('2026年10月1日');
  });
});

// 大数分层展示单测（component-contract.md §1 分层口径：≥1e21 科学 / ≥1e15 紧凑 / 常态 normal）
// 阈值边界与各档中英输出钉死，防五处调用方再漂回裸 toFixed 数字墙
import { describe, expect, it } from 'vitest';
import {
  COMPACT_AMOUNT_THRESHOLD,
  PRICE_SUBSCRIPT_ZERO_THRESHOLD,
  SCIENTIFIC_AMOUNT_THRESHOLD,
  fmtPrice,
  fmtTiered,
  fmtTokenAmount,
  fmtUsd,
} from '../../components/global/amount-format';

describe('fmtTokenAmount', () => {
  it('常态档 toFixed(6)：常规量级、小值、整值', () => {
    expect(fmtTokenAmount(1234.567891, 'en')).toBe('1234.567891');
    expect(fmtTokenAmount(0.000123456789, 'en')).toBe('0.000123');
    expect(fmtTokenAmount(42, 'en')).toBe('42.000000');
  });

  it('1e15−1 仍走常态档（阈值下沿，长串如实展示由 CSS 截断兜底）', () => {
    expect(fmtTokenAmount(COMPACT_AMOUNT_THRESHOLD - 1, 'en')).toBe('999999999999999.000000');
  });

  it('紧凑档 ≥1e15：en=T 后缀、zh=万亿', () => {
    expect(fmtTokenAmount(3e15, 'en')).toBe('3000T');
    expect(fmtTokenAmount(3e15, 'zh')).toBe('3000万亿');
    expect(fmtTokenAmount(1e16, 'en')).toBe('10,000T');
    expect(fmtTokenAmount(1e16, 'zh')).toBe('10,000万亿');
  });

  it('科学档 ≥1e21：中英同为 E 记法', () => {
    expect(fmtTokenAmount(2.5e21, 'en')).toBe('2.5E21');
    expect(fmtTokenAmount(2.5e21, 'zh')).toBe('2.5E21');
  });

  it('负数走同一分层（abs 判档）', () => {
    expect(fmtTokenAmount(-3e15, 'en')).toBe('-3000T');
    expect(fmtTokenAmount(-1234.5, 'en')).toBe('-1234.500000');
  });
});

describe('fmtUsd', () => {
  it('常态档千分位 + 最多 2 位小数', () => {
    expect(fmtUsd(1234.567, 'en')).toBe('1,234.57');
    expect(fmtUsd(0.5, 'zh')).toBe('0.5');
  });

  it('大额同样分层', () => {
    expect(fmtUsd(3e15, 'en')).toBe('3000T');
    expect(fmtUsd(2.5e21, 'zh')).toBe('2.5E21');
  });
});

describe('fmtTiered', () => {
  it('自定义 normal 档透传（compactDigits 只作用于上两档）', () => {
    expect(fmtTiered(1.5, 'en', 3, (v) => `x${v.toFixed(1)}`)).toBe('x1.5');
    expect(fmtTiered(3e15, 'en', 3, () => 'unused')).toBe('3000T');
  });

  it('阈值常量口径', () => {
    expect(COMPACT_AMOUNT_THRESHOLD).toBe(1e15);
    expect(SCIENTIFIC_AMOUNT_THRESHOLD).toBe(1e21);
  });
});

describe('fmtPrice（决议 019 市场口径：有效位格式化+裁尾零，取代固定 6 位小数+尾零灰显）', () => {
  it('≥1 两位小数法币惯例', () => {
    expect(fmtPrice(1.2)).toBe('1.20');
    expect(fmtPrice(42)).toBe('42.00');
    expect(fmtPrice(1234.5)).toBe('1,234.50');
  });

  it('<1 六位有效数字、尾随零裁掉', () => {
    expect(fmtPrice(0.0042)).toBe('0.0042');
    expect(fmtPrice(0.00406)).toBe('0.00406');
    expect(fmtPrice(0.5)).toBe('0.5');
    expect(fmtPrice(0.123456789)).toBe('0.123457');
  });

  it('前导零 ≥4 下标记零（下标=前导零总数，0.0000042→0.0₅42）', () => {
    expect(fmtPrice(0.0000999)).toBe('0.0₄999');
    expect(fmtPrice(0.000042)).toBe('0.0₄42');
    expect(fmtPrice(0.0000042)).toBe('0.0₅42');
    expect(fmtPrice(0.0000000042)).toBe('0.0₈42');
  });

  it('边界：3 个前导零不切下标；进位/0 兜底', () => {
    expect(fmtPrice(0.0001)).toBe('0.0001');
    expect(fmtPrice(0.000999)).toBe('0.000999');
    expect(fmtPrice(0.9999999)).toBe('1.00');
    expect(fmtPrice(0)).toBe('0.00');
    expect(PRICE_SUBSCRIPT_ZERO_THRESHOLD).toBe(4);
  });
});

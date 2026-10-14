// Unit tests for tiered large-number display (tiers:
// >=1e21 scientific / >=1e15 compact / normal otherwise)
// Threshold boundaries and per-tier en/zh output are pinned, so the five call
// sites cannot drift back to raw toFixed number walls.
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
  it('normal tier toFixed(6): regular magnitude, small values, integers', () => {
    expect(fmtTokenAmount(1234.567891, 'en')).toBe('1234.567891');
    expect(fmtTokenAmount(0.000123456789, 'en')).toBe('0.000123');
    expect(fmtTokenAmount(42, 'en')).toBe('42.000000');
  });

  it('1e15-1 stays in the normal tier (threshold lower edge; long strings handled by CSS truncation)', () => {
    expect(fmtTokenAmount(COMPACT_AMOUNT_THRESHOLD - 1, 'en')).toBe('999999999999999.000000');
  });

  it('compact tier >=1e15: en gets T suffix, zh gets CJK compact units', () => {
    expect(fmtTokenAmount(3e15, 'en')).toBe('3000T');
    expect(fmtTokenAmount(3e15, 'zh')).toBe('3000万亿');
    expect(fmtTokenAmount(1e16, 'en')).toBe('10,000T');
    expect(fmtTokenAmount(1e16, 'zh')).toBe('10,000万亿');
  });

  it('scientific tier >=1e21: same E notation for en and zh', () => {
    expect(fmtTokenAmount(2.5e21, 'en')).toBe('2.5E21');
    expect(fmtTokenAmount(2.5e21, 'zh')).toBe('2.5E21');
  });

  it('negative numbers use the same tiers (tier chosen on abs)', () => {
    expect(fmtTokenAmount(-3e15, 'en')).toBe('-3000T');
    expect(fmtTokenAmount(-1234.5, 'en')).toBe('-1234.500000');
  });
});

describe('fmtUsd', () => {
  it('normal tier: thousands separators + at most 2 decimals', () => {
    expect(fmtUsd(1234.567, 'en')).toBe('1,234.57');
    expect(fmtUsd(0.5, 'zh')).toBe('0.5');
  });

  it('large amounts tiered the same way', () => {
    expect(fmtUsd(3e15, 'en')).toBe('3000T');
    expect(fmtUsd(2.5e21, 'zh')).toBe('2.5E21');
  });
});

describe('fmtTiered', () => {
  it('custom normal-tier formatter passes through (compactDigits only affects the upper two tiers)', () => {
    expect(fmtTiered(1.5, 'en', 3, (v) => `x${v.toFixed(1)}`)).toBe('x1.5');
    expect(fmtTiered(3e15, 'en', 3, () => 'unused')).toBe('3000T');
  });

  it('tier thresholds are 1e15 and 1e21', () => {
    expect(COMPACT_AMOUNT_THRESHOLD).toBe(1e15);
    expect(SCIENTIFIC_AMOUNT_THRESHOLD).toBe(1e21);
  });
});

describe('fmtPrice (fiat tier >=1 fixed two decimals; <1 six significant digits, trailing zeros trimmed, subscript zeros at >=4 leading zeros)', () => {
  it('>=1 uses two decimals, fiat convention', () => {
    expect(fmtPrice(1.2)).toBe('1.20');
    expect(fmtPrice(42)).toBe('42.00');
    expect(fmtPrice(1234.5)).toBe('1,234.50');
  });

  it('<1 uses six significant digits, trailing zeros trimmed', () => {
    expect(fmtPrice(0.0042)).toBe('0.0042');
    expect(fmtPrice(0.00406)).toBe('0.00406');
    expect(fmtPrice(0.5)).toBe('0.5');
    expect(fmtPrice(0.123456789)).toBe('0.123457');
  });

  it('leading zeros >=4 switch to subscript zeros (subscript = count of leading zeros, 0.0000042 -> 0.0₅42)', () => {
    expect(fmtPrice(0.0000999)).toBe('0.0₄999');
    expect(fmtPrice(0.000042)).toBe('0.0₄42');
    expect(fmtPrice(0.0000042)).toBe('0.0₅42');
    expect(fmtPrice(0.0000000042)).toBe('0.0₈42');
  });

  it('boundary: 3 leading zeros stay plain; carry and 0 fallbacks', () => {
    expect(fmtPrice(0.0001)).toBe('0.0001');
    expect(fmtPrice(0.000999)).toBe('0.000999');
    expect(fmtPrice(0.9999999)).toBe('1.00');
    expect(fmtPrice(0)).toBe('0.00');
    expect(PRICE_SUBSCRIPT_ZERO_THRESHOLD).toBe(4);
  });
});

// Unit tests for tiered trade-amount display (Uniswap-style tiers: '<0.00001' display
// floor / six significant digits below 1e4 / grouped two decimals below 1e15 /
// international K-M-B-T compact / scientific overflow guard). Threshold boundaries and
// per-tier en/zh output are pinned, so the call sites cannot drift back to raw toFixed
// number walls or CJK large-number units.
import { describe, expect, it } from 'vitest';
import {
  COMPACT_AMOUNT_THRESHOLD,
  PRICE_SUBSCRIPT_ZERO_THRESHOLD,
  SCIENTIFIC_AMOUNT_THRESHOLD,
  TOKEN_AMOUNT_DISPLAY_FLOOR,
  fmtPrice,
  fmtTiered,
  fmtTokenAmount,
  fmtUsd,
} from '../../components/global/amount-format';

describe('fmtTokenAmount', () => {
  it('display floor: 0 renders plain, sub-floor positives render <0.00001', () => {
    expect(fmtTokenAmount(0, 'en')).toBe('0');
    expect(fmtTokenAmount(TOKEN_AMOUNT_DISPLAY_FLOOR / 10, 'en')).toBe('<0.00001');
  });

  it('below 1e4: six significant digits, trailing zeros trimmed, grouped', () => {
    expect(fmtTokenAmount(1234.567891, 'en')).toBe('1,234.57');
    expect(fmtTokenAmount(0.000123456789, 'en')).toBe('0.000123457');
    expect(fmtTokenAmount(42, 'en')).toBe('42');
    expect(fmtTokenAmount(0.5, 'zh')).toBe('0.5');
  });

  it('1e4 to 1e15: grouped two decimals (1e15-1 stays un-compacted; overlong handled by CSS ellipsis)', () => {
    expect(fmtTokenAmount(123456.7891, 'en')).toBe('123,456.79');
    expect(fmtTokenAmount(COMPACT_AMOUNT_THRESHOLD - 1, 'en')).toBe('999,999,999,999,999.00');
  });

  it('compact tier >=1e15: international K/M/B/T symbols in both locales (no CJK units)', () => {
    expect(fmtTokenAmount(3e15, 'en')).toBe('3000T');
    expect(fmtTokenAmount(3e15, 'zh')).toBe('3000T');
    expect(fmtTokenAmount(8.30799102221e19, 'zh')).toBe('83,079,910.22T');
  });

  it('scientific tier >=1e21: same E notation for en and zh', () => {
    expect(fmtTokenAmount(2.5e21, 'en')).toBe('2.5E21');
    expect(fmtTokenAmount(2.5e21, 'zh')).toBe('2.5E21');
  });

  it('negative numbers use the same tiers (tier chosen on abs)', () => {
    expect(fmtTokenAmount(-1234.5, 'en')).toBe('-1,234.5');
  });
});

describe('fmtUsd', () => {
  it('normal tier: thousands separators + at most 2 decimals', () => {
    expect(fmtUsd(1234.567, 'en')).toBe('1,234.57');
    expect(fmtUsd(0.5, 'zh')).toBe('0.5');
  });

  it('large amounts tiered the same way (compact/scientific pinned to international symbols)', () => {
    expect(fmtUsd(3e15, 'en')).toBe('3000T');
    expect(fmtUsd(3e15, 'zh')).toBe('3000T');
    expect(fmtUsd(2.5e21, 'zh')).toBe('2.5E21');
  });
});

describe('fmtTiered', () => {
  it('custom normal-tier formatter passes through (compactDigits only affects the upper two tiers)', () => {
    expect(fmtTiered(1.5, 'en', 3, (v) => `x${v.toFixed(1)}`)).toBe('x1.5');
    expect(fmtTiered(3e15, 'en', 3, () => 'unused')).toBe('3000T');
    expect(fmtTiered(3e15, 'zh', 3, () => 'unused')).toBe('3000T');
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

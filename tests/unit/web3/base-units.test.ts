// Base-units contract tests: exact integer parsing/formatting for every money figure on the
// site. Floats are never allowed on amounts.
import { describe, expect, it } from 'vitest';

import { WAD, formatBaseUnits, formatWadPercent, toBaseUnits } from '../../../lib/web3/base-units';

describe('toBaseUnits', () => {
  it('parses plain decimals exactly (no float round-trip)', () => {
    expect(toBaseUnits('0.123456789012345678', 18)).toBe(123456789012345678n);
    expect(toBaseUnits('5', 18)).toBe(5n * WAD);
  });

  it('accepts a trailing dot and empty input as zero', () => {
    expect(toBaseUnits('1.', 18)).toBe(WAD);
    expect(toBaseUnits('', 18)).toBe(0n);
    expect(toBaseUnits('.', 18)).toBe(0n);
  });

  it('truncates digits beyond the asset precision (never rounds up)', () => {
    expect(toBaseUnits('1.9999999', 6)).toBe(1_999_999n);
  });

  it('rejects junk as zero instead of NaN', () => {
    expect(toBaseUnits('1e-7', 18)).toBe(0n);
    expect(toBaseUnits('abc', 18)).toBe(0n);
  });
});

describe('formatBaseUnits', () => {
  it('groups the whole part exactly for values beyond float64 integer precision', () => {
    expect(formatBaseUnits(123_456_789_012_345_678_901n * WAD, 18, 'en')).toBe(
      '123,456,789,012,345,678,901',
    );
  });

  it('truncates the fraction instead of rounding (display never overstates)', () => {
    expect(formatBaseUnits(1_999_999n, 6, 'en', 2)).toBe('1.99');
    expect(formatBaseUnits(1_999_999n, 6, 'en', 6)).toBe('1.999999');
  });

  it('drops trailing zeros and omits a bare decimal point', () => {
    expect(formatBaseUnits(5n * WAD, 18, 'en')).toBe('5');
    expect(formatBaseUnits(15n * 10n ** 17n, 18, 'en')).toBe('1.5');
  });
});

describe('formatWadPercent', () => {
  it('renders an 18-dec point value as a percent with fixed digits', () => {
    expect(formatWadPercent(10n ** 15n, 'en', 1)).toBe('0.1');
    expect(formatWadPercent(25n * 10n ** 15n, 'en', 2)).toBe('2.50');
  });
});

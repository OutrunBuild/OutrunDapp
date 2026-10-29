// Base-units contract tests: exact integer parsing/formatting for every money figure on the
// site. Floats are never allowed on amounts.
import { describe, expect, it } from 'vitest';

import {
  WAD,
  estimateBaseUnitsCeil,
  estimateBaseUnitsFloor,
  formatBaseUnits,
  formatWadPercent,
  toBaseUnits,
} from '../../../lib/web3/base-units';

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
    expect(toBaseUnits('1.2.3', 18)).toBe(0n);
  });
});

describe('estimateBaseUnitsFloor/Ceil', () => {
  it('handles dust that String() would emit as scientific notation (viem parseUnits throws there)', () => {
    // doubles sit just below their decimal intent; floor/ceil track the actual double
    expect(estimateBaseUnitsFloor(1.2e-7, 18)).toBe(119_999_999_999n);
    expect(estimateBaseUnitsCeil(1.2e-7, 18)).toBe(120_000_000_000n);
    expect(estimateBaseUnitsFloor(0.0000001, 6)).toBe(0n);
    expect(estimateBaseUnitsCeil(0.0000001, 6)).toBe(1n);
  });

  it('floors min-out bounds — never above the estimate double', () => {
    expect(estimateBaseUnitsFloor(0.1, 6)).toBe(100_000n);
    // the double for 1234.5678901 is 1234.56789010000001133... — floor keeps the tail honest
    expect(estimateBaseUnitsFloor(1234.5678901, 18)).toBe(1_234_567_890_100_000_113_307n);
  });

  it('ceils max-in bounds — never below the estimate double', () => {
    expect(estimateBaseUnitsCeil(0.1, 6)).toBe(100_001n);
    // the double nearest 2.675 is 2.6749999999999998223... — ceil climbs one unit past it,
    // floor stays under (the classic half-way literal that must never round up on a bound)
    expect(estimateBaseUnitsCeil(2.675, 6)).toBe(2_675_000n);
    expect(estimateBaseUnitsFloor(2.675, 6)).toBe(2_674_999n);
    // the literal 1.9999999999999999 parses to the double 2.0 exactly — grid-exact
    expect(estimateBaseUnitsFloor(1.9999999999999999, 18)).toBe(2_000_000_000_000_000_000n);
    expect(estimateBaseUnitsCeil(1.9999999999999999, 18)).toBe(2_000_000_000_000_000_000n);
  });

  it('is exact for values already on the decimal grid', () => {
    expect(estimateBaseUnitsFloor(0.5, 18)).toBe(500_000_000_000_000_000n);
    expect(estimateBaseUnitsCeil(0.5, 18)).toBe(500_000_000_000_000_000n);
  });

  it('stays total above 1e21 (doubles are exact integers there)', () => {
    expect(estimateBaseUnitsFloor(1.5e21, 18)).toBe(1_500_000_000_000_000_000_000n * WAD);
    expect(estimateBaseUnitsCeil(1e21, 0)).toBe(10n ** 21n);
  });

  it('degenerate inputs read as zero instead of throwing', () => {
    expect(estimateBaseUnitsFloor(0, 18)).toBe(0n);
    expect(estimateBaseUnitsCeil(-1.5, 18)).toBe(0n);
    expect(estimateBaseUnitsFloor(Number.NaN, 18)).toBe(0n);
    expect(estimateBaseUnitsCeil(Number.POSITIVE_INFINITY, 18)).toBe(0n);
  });

  it('brackets every finite positive value (floor ≤ ceil, at most one unit apart)', () => {
    for (const value of [1.2e-7, 0.1, 0.13, 2.675, 1.9999999999999999, 700244913.3205775]) {
      for (const decimals of [0, 6, 18]) {
        const floor = estimateBaseUnitsFloor(value, decimals);
        const ceil = estimateBaseUnitsCeil(value, decimals);
        expect(ceil).toBeGreaterThanOrEqual(floor);
        expect(ceil - floor).toBeLessThanOrEqual(1n);
      }
    }
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

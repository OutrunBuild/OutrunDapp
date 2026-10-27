// Unit tests for amount-input sanitization (keypad row:
// allowlist + multiple decimal-point collapsing)
import { describe, expect, it } from 'vitest';
import {
  amountToInputString,
  sanitizeAmount,
  trimFractionZeros,
  typedAmountPositive,
} from '../../components/global/amount-input';

describe('sanitizeAmount', () => {
  it('strips non-allowlisted characters (pasting 1,000,000 -> 1000000)', () => {
    expect(sanitizeAmount('1,000,000')).toBe('1000000');
  });

  it('collapses multiple decimal points to the first (1.2.3 -> 1.23; 1.2.3.4 -> 1.234)', () => {
    expect(sanitizeAmount('1.2.3')).toBe('1.23');
    expect(sanitizeAmount('1.2.3.4')).toBe('1.234');
  });

  it('keeps a single trailing point after a leading digit (1. -> 1.; 1.2. -> 1.2)', () => {
    expect(sanitizeAmount('1.')).toBe('1.');
    expect(sanitizeAmount('1.2.')).toBe('1.2');
  });

  it('empty string stays empty; letters stripped; lone dot passes through', () => {
    expect(sanitizeAmount('')).toBe('');
    expect(sanitizeAmount('abc')).toBe('');
    expect(sanitizeAmount('.')).toBe('.');
  });

  it('valid input passes through unchanged', () => {
    expect(sanitizeAmount('123')).toBe('123');
    expect(sanitizeAmount('0.5')).toBe('0.5');
  });
});

describe('amountToInputString', () => {
  it('sub-1e-6 values (String() emits scientific notation) return empty — they floor to zero at 6 decimals anyway', () => {
    expect(amountToInputString(1e-7)).toBe('');
    expect(amountToInputString(0.0000005)).toBe('');
  });

  it('floors at 6-decimal precision — never rounds up past the true balance (the Max prefill must not trip its own insufficient-balance gate)', () => {
    // The reported bug class: a 7th-decimal tail that toFixed(6) would carry upward
    expect(amountToInputString(700244913.3205775)).toBe('700244913.320577');
    expect(Number(amountToInputString(700244913.3205775))).toBeLessThanOrEqual(700244913.3205775);
    expect(amountToInputString(12.0000005)).toBe('12');
    expect(amountToInputString(12.0000009)).toBe('12');
    expect(amountToInputString(12.000001)).toBe('12.000001');
  });

  it('trims trailing zeros at 6-decimal precision', () => {
    expect(amountToInputString(1234.5678901)).toBe('1234.56789');
    expect(amountToInputString(1234.5)).toBe('1234.5');
    expect(amountToInputString(5)).toBe('5');
    expect(amountToInputString(0.5)).toBe('0.5');
  });

  it('0/non-finite values return empty string', () => {
    expect(amountToInputString(0)).toBe('');
    expect(amountToInputString(Number.NaN)).toBe('');
    expect(amountToInputString(Number.POSITIVE_INFINITY)).toBe('');
  });
});

describe('trimFractionZeros', () => {
  it('trims trailing fraction zeros without touching integers ("1000" stays "1000")', () => {
    expect(trimFractionZeros('1000')).toBe('1000');
    expect(trimFractionZeros('1.500000')).toBe('1.5');
    expect(trimFractionZeros('700244913.320577')).toBe('700244913.320577');
    expect(trimFractionZeros('2.000000')).toBe('2');
  });
});

describe('typedAmountPositive', () => {
  it('dust below one base unit fails once the exact decimals are known (0.0000005 on 6-dec parses to 0n)', () => {
    expect(typedAmountPositive('0.0000005', { decimals: 6 })).toBe(false);
    expect(typedAmountPositive('0.0000009', { decimals: 6 })).toBe(false);
    expect(typedAmountPositive('0.0000005', { decimals: 18 })).toBe(true);
    expect(typedAmountPositive('0.000001', { decimals: 6 })).toBe(true);
  });

  it('float half decides when no exact read exists (probe failed / fixture sample)', () => {
    expect(typedAmountPositive('0.0000005', null)).toBe(true);
    expect(typedAmountPositive('0', null)).toBe(false);
  });

  it('non-finite / empty / non-positive input fails regardless of decimals', () => {
    expect(typedAmountPositive('abc', { decimals: 6 })).toBe(false);
    expect(typedAmountPositive('', { decimals: 18 })).toBe(false);
    expect(typedAmountPositive('0', { decimals: 6 })).toBe(false);
  });
});

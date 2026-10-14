// Unit tests for amount-input sanitization (keypad row:
// allowlist + multiple decimal-point collapsing)
import { describe, expect, it } from 'vitest';
import { amountToInputString, sanitizeAmount } from '../../components/global/amount-input';

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
  it('small values use plain decimal strings, never scientific notation (1e-7 hits the 6-decimal floor -> 0)', () => {
    expect(amountToInputString(1e-7)).toBe('0');
  });

  it('trims trailing zeros at 6-decimal precision', () => {
    expect(amountToInputString(1234.5678901)).toBe('1234.56789');
    expect(amountToInputString(5)).toBe('5');
    expect(amountToInputString(0.5)).toBe('0.5');
  });

  it('0/non-finite values return empty string', () => {
    expect(amountToInputString(0)).toBe('');
    expect(amountToInputString(Number.NaN)).toBe('');
  });
});

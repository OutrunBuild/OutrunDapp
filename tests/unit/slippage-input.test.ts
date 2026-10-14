// Slippage setting validation unit tests (settings layer accepts 0.01–50%)
import { describe, expect, it } from 'vitest';
import {
  DEADLINE_PRESETS,
  SLIPPAGE_MAX,
  SLIPPAGE_MIN,
  SLIPPAGE_PRESETS,
  deadlineToNumber,
  getSlippageIssue,
  isWholeMinutes,
  slippageErrorCopyKey,
  slippageToNumber,
} from '../../components/global/slippage-input';

describe('getSlippageIssue', () => {
  it('in-range values (boundaries included) pass: 0.01 / 0.5 / 1 / 50 -> null', () => {
    expect(getSlippageIssue(SLIPPAGE_MIN)).toBeNull();
    expect(getSlippageIssue(0.5)).toBeNull();
    expect(getSlippageIssue(1)).toBeNull();
    expect(getSlippageIssue(SLIPPAGE_MAX)).toBeNull();
  });

  it('below the lower bound reports below-min: 0 (zero tolerance must fall back) and 0.001', () => {
    expect(getSlippageIssue(0)).toBe('below-min');
    expect(getSlippageIssue(0.001)).toBe('below-min');
  });

  it('above the upper bound reports above-max: 50.0001 / 99 / 150', () => {
    expect(getSlippageIssue(50.0001)).toBe('above-max');
    expect(getSlippageIssue(99)).toBe('above-max');
    expect(getSlippageIssue(150)).toBe('above-max');
  });

  it('non-finite numbers fall back to below-min (NaN comparisons are always false, must not silently validate)', () => {
    expect(getSlippageIssue(Number.NaN)).toBe('below-min');
    expect(getSlippageIssue(Number.POSITIVE_INFINITY)).toBe('below-min');
  });
});

describe('slippageErrorCopyKey', () => {
  it('out-of-range categories map to copy keys (below-min -> tooLow, above-max -> tooHigh)', () => {
    expect(slippageErrorCopyKey('below-min')).toBe('slippageTooLow');
    expect(slippageErrorCopyKey('above-max')).toBe('slippageTooHigh');
  });
});

describe('isWholeMinutes / presets', () => {
  it('whole minutes (including presets 10/20/30) pass, non-whole and 0/negative rejected', () => {
    for (const preset of DEADLINE_PRESETS) expect(isWholeMinutes(preset)).toBe(true);
    expect(isWholeMinutes(1.5)).toBe(false);
    expect(isWholeMinutes(0)).toBe(false);
  });

  it('preset values unchanged: slippage 0.1/0.5/1, deadline 10/20/30', () => {
    expect([...SLIPPAGE_PRESETS]).toEqual([0.1, 0.5, 1]);
    expect([...DEADLINE_PRESETS]).toEqual([10, 20, 30]);
  });
});

describe('slippageToNumber / deadlineToNumber (controlled string input)', () => {
  it('well-formed strings convert as-is (including a trailing decimal point — typed intermediate state)', () => {
    expect(slippageToNumber('0.5')).toBe(0.5);
    expect(slippageToNumber('25')).toBe(25);
    // Intermediate state '0.' derives to 0 (display still shows '0.' verbatim; errors go through below-min)
    expect(slippageToNumber('0.')).toBe(0);
    expect(deadlineToNumber('1.5')).toBe(1.5);
  });

  it('empty/invalid strings fall back to the existing convention: slippage -> 0 (zero tolerance errors), deadline -> 1 minute', () => {
    expect(slippageToNumber('')).toBe(0);
    expect(slippageToNumber('.')).toBe(0);
    expect(deadlineToNumber('')).toBe(1);
    expect(deadlineToNumber('.')).toBe(1);
  });
});

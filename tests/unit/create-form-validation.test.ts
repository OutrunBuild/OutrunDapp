// Create-form validation: the byte gates run on UTF-8 byteLength (not code points — CJK names
// are 3 bytes each against the 31-byte budget), occupancy is exact-match on the raw symbol, and
// the duration is clamped to the chain config's [min,max] window. The same predicate feeds the
// live field errors and the submit handler, so a slip here lets an invalid registration reach
// the wallet and revert on-chain.
import { describe, expect, it } from 'vitest';

import {
  byteLength,
  durationInRange,
  fill,
  registrationInputsOk,
} from '../../components/create/create-form';

const CONFIG = { minDurationDays: 1, maxDurationDays: 3 };

describe('byteLength (UTF-8 bytes, not code points)', () => {
  it('counts ASCII as one byte per character', () => {
    expect(byteLength('abc')).toBe(3);
  });

  it('counts CJK as three bytes and emoji as four', () => {
    expect(byteLength('中')).toBe(3);
    expect(byteLength('中文')).toBe(6);
    expect(byteLength('😀')).toBe(4);
  });
});

describe('fill (help-copy template)', () => {
  it('substitutes known keys and preserves unknown ones', () => {
    expect(
      fill('Genesis {min}–{max} days, {days}-day lockup, {count} chains', {
        min: '1',
        max: '3',
        days: '365',
        count: '2',
      }),
    ).toBe('Genesis 1–3 days, 365-day lockup, 2 chains');
    expect(fill('{min} of {unknown}', { min: '1' })).toBe('1 of {unknown}');
  });
});

describe('durationInRange (config window clamp)', () => {
  it('accepts integers inside [min,max] and rejects everything else', () => {
    expect(durationInRange(1, CONFIG)).toBe(true);
    expect(durationInRange(2, CONFIG)).toBe(true);
    expect(durationInRange(3, CONFIG)).toBe(true);
    expect(durationInRange(0, CONFIG)).toBe(false);
    expect(durationInRange(4, CONFIG)).toBe(false);
    expect(durationInRange(2.5, CONFIG)).toBe(false);
    expect(durationInRange(Number('x'), CONFIG)).toBe(false); // NaN: not an integer
  });

  it('leaves the field unjudged while the config is missing', () => {
    expect(durationInRange(2, null)).toBe(false);
  });
});

describe('registrationInputsOk (submit gate)', () => {
  const base = {
    hasLogo: true,
    name: 'Moon Verse',
    symbol: 'MOON',
    desc: 'A memeverse',
    occupiedSymbols: [] as string[],
    duration: 2,
    config: CONFIG,
  };

  it('accepts a complete valid registration shape', () => {
    expect(registrationInputsOk(base)).toBe(true);
  });

  it('rejects on each gate independently', () => {
    expect(registrationInputsOk({ ...base, hasLogo: false })).toBe(false);
    expect(registrationInputsOk({ ...base, name: '' })).toBe(false);
    expect(registrationInputsOk({ ...base, symbol: '' })).toBe(false);
    expect(registrationInputsOk({ ...base, desc: '' })).toBe(false);
    expect(registrationInputsOk({ ...base, occupiedSymbols: ['MOON'] })).toBe(false);
    expect(registrationInputsOk({ ...base, duration: 4 })).toBe(false);
  });

  it('enforces the byte budget against CJK input (31 bytes name/symbol, 255 desc)', () => {
    // 11 CJK chars = 33 bytes > 31; 10 + one ASCII byte = 31 exactly
    expect(registrationInputsOk({ ...base, name: '中'.repeat(11) })).toBe(false);
    expect(registrationInputsOk({ ...base, name: '中'.repeat(10) + 'a' })).toBe(true);
    // 85 CJK chars = 255 bytes exactly (budget edge); 86 = 258 bytes is over
    expect(registrationInputsOk({ ...base, desc: '中'.repeat(85) })).toBe(true);
    expect(registrationInputsOk({ ...base, desc: '中'.repeat(86) })).toBe(false);
  });
});

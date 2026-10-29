import { describe, expect, it } from 'vitest';

import { cardAmountValid, cardSellDecimals } from '../../components/verse/swap-amount';

describe('cardSellDecimals', () => {
  it('prefers the exact probe, then the reserve Asset decimals, then the protocol constant', () => {
    expect(cardSellDecimals({ exactDecimals: 6, reserveDecimals: 18 })).toBe(6);
    expect(cardSellDecimals({ exactDecimals: null, reserveDecimals: 6 })).toBe(6);
    expect(cardSellDecimals({ exactDecimals: null, reserveDecimals: undefined })).toBe(18);
  });
});

describe('cardAmountValid', () => {
  it('rejects sub-unit dust even when the exact probe has not landed', () => {
    // Float-only positivity would keep these "valid" while the quote layer parses them to 0n
    // and never answers (permanent pending spinner).
    expect(cardAmountValid('0.0000001', { exactDecimals: null, reserveDecimals: 6 })).toBe(false);
    expect(
      cardAmountValid('0.0000000000000000001', {
        exactDecimals: null,
        reserveDecimals: undefined,
      }),
    ).toBe(false);
  });

  it('accepts one base unit on both leg kinds', () => {
    expect(cardAmountValid('0.000001', { exactDecimals: null, reserveDecimals: 6 })).toBe(true);
    expect(
      cardAmountValid('0.000000000000000001', {
        exactDecimals: null,
        reserveDecimals: undefined,
      }),
    ).toBe(true);
  });

  it('the exact probe wins over the Asset fallback', () => {
    // 18-dec exact read on a leg whose reserve Asset says 6: the live decimals decide validity.
    expect(cardAmountValid('0.0000001', { exactDecimals: 18, reserveDecimals: 6 })).toBe(true);
  });

  it('non-positive input stays invalid', () => {
    expect(cardAmountValid('', { exactDecimals: 18, reserveDecimals: undefined })).toBe(false);
    expect(cardAmountValid('0', { exactDecimals: 18, reserveDecimals: undefined })).toBe(false);
  });
});

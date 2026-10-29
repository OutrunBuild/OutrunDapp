import { describe, expect, it } from 'vitest';
import type { Hex } from 'viem';

import {
  IMPACT_DANGER,
  IMPACT_WARNING,
  cardOutOf,
  impactTone,
  memeTokenAddressOf,
  minOutOf,
  priceImpactOf,
  spotReferenceOf,
  swapQuoteKey,
  toDisplay,
} from '../../components/verse/swap-live-quote';

describe('spotReferenceOf', () => {
  it('scales the per-unit spot into the total reference — the midPrice.quote(input) shape', () => {
    expect(spotReferenceOf(72_048, 10)).toBeCloseTo(720_480);
    expect(spotReferenceOf(2, 0.5)).toBeCloseTo(1);
  });

  it('returns null on a non-positive or NaN side (units drift cannot fake a reference)', () => {
    expect(spotReferenceOf(0, 10)).toBeNull();
    expect(spotReferenceOf(2, 0)).toBeNull();
    expect(spotReferenceOf(Number.NaN, 10)).toBeNull();
  });
});

describe('priceImpactOf', () => {
  it('measures the executable quote against the same-pass spot reference', () => {
    expect(priceImpactOf(100, 98, 0n)).toBeCloseTo(0.02);
    expect(priceImpactOf(100, 50, 0n)).toBeCloseTo(0.5);
  });

  it('pins the units pairing: per-unit spot must be scaled by the input amount first', () => {
    // spot 2 out per in, 10 in, 19.6 out, 1% fee → true impact 1% — NOT 1−19.6/2 (clamped 0)
    const reference = spotReferenceOf(2, 10);
    expect(reference).not.toBeNull();
    expect(priceImpactOf(reference!, 19.6, 100n)).toBeCloseTo(0.01);
    // half-unit input: healthy fill 0.99 against a 1.0 reference stays at zero, never ~50% danger
    expect(priceImpactOf(spotReferenceOf(2, 0.5)!, 0.99, 100n)).toBeCloseTo(0);
  });

  it('subtracts the swap fee so the row carries pure price-movement cost', () => {
    expect(priceImpactOf(100, 98.5, 100n)).toBeCloseTo(0.005);
    expect(priceImpactOf(100, 99, 100n)).toBeCloseTo(0);
  });

  it('clamps upside to zero — a quote above the reference is not negative impact', () => {
    expect(priceImpactOf(100, 101, 0n)).toBe(0);
  });

  it('returns null when either side is unknown or non-positive', () => {
    expect(priceImpactOf(0, 10, 0n)).toBeNull();
    expect(priceImpactOf(10, 0, 0n)).toBeNull();
    expect(priceImpactOf(-1, 10, 0n)).toBeNull();
  });
});

describe('impactTone', () => {
  it('tiers at the market-convention thresholds', () => {
    expect(impactTone(0.049)).toBeNull();
    expect(impactTone(IMPACT_WARNING)).toBe('warning');
    expect(impactTone(0.1)).toBe('warning');
    expect(impactTone(IMPACT_DANGER)).toBe('danger');
    expect(impactTone(0.9)).toBe('danger');
    expect(impactTone(null)).toBeNull();
  });
});

describe('minOutOf', () => {
  it('floors the quote by the slippage allowance in whole units', () => {
    expect(minOutOf(10_000n, 50)).toBe(9_950n);
    expect(minOutOf(10n, 50)).toBe(9n);
    expect(minOutOf(10_000n, 0)).toBe(10_000n);
  });
});

describe('swapQuoteKey', () => {
  it('keys the full request identity — a display value is only valid for its own key', () => {
    const base = swapQuoteKey(97, '21', '0xe0a', '0xa', '0xb', '0x0', 100n);
    expect(base).toBe('97:21:0xe0a:0xa:0xb:0x0:100');
    expect(swapQuoteKey(97, '21', '0xe0a', '0xb', '0xa', '0x0', 100n)).not.toBe(base);
    expect(swapQuoteKey(97, '21', '0xe0a', '0xa', '0xb', '0x0', 101n)).not.toBe(base);
  });

  it('separates the card stable leg and the trader — axes the pool request cannot see', () => {
    // The verse's uAsset and its PSM reserve are the SAME pool request (identical legs and
    // memecoin input amount) but different card requests: the cached quote must not cross over.
    const uAssetSide = swapQuoteKey(97, '21', '0xe0a', '0xa', '0xb', '0x0', 100n);
    const reserveSide = swapQuoteKey(97, '21', '0xe0a', '0xa', '0xb', '0xcc', 100n);
    expect(reserveSide).not.toBe(uAssetSide);
    // quoteSwap prices the trader's dynamic-fee batch state — another EOA is another quote.
    expect(swapQuoteKey(97, '21', '0xe0b', '0xa', '0xb', '0x0', 100n)).not.toBe(uAssetSide);
  });
});

describe('toDisplay', () => {
  it('converts raw units through the token decimals', () => {
    expect(toDisplay(1_000_000n, 6)).toBe(1);
    expect(toDisplay(1n, 18)).toBeCloseTo(1e-18);
  });
});

describe('cardOutOf', () => {
  it('formats the output at the card leg decimals, not the pool leg decimals', () => {
    // Reserve sell: `out` is in 6-dec reserve units while the pool leg is 18-dec uAsset.
    // Formatting with the pool decimals would render ~1e-12 of the real amount on the card.
    expect(cardOutOf({ out: 1_500_000n, cardDecimalsOut: 6 })).toBe(1.5);
    expect(toDisplay(1_500_000n, 18)).toBeCloseTo(1.5e-12);
    // uAsset↔meme legs keep the pool decimals (cardDecimalsOut mirrors them).
    expect(cardOutOf({ out: 1_500_000_000_000_000_000n, cardDecimalsOut: 18 })).toBeCloseTo(1.5);
  });
});

describe('memeTokenAddressOf', () => {
  const addresses = { memecoin: '0xaaa' as Hex, pol: '0xbbb' as Hex, pt: '0xccc' as Hex };

  it('picks the selected meme leg address', () => {
    expect(memeTokenAddressOf('meme', addresses)).toBe('0xaaa');
    expect(memeTokenAddressOf('pol', addresses)).toBe('0xbbb');
    expect(memeTokenAddressOf('pt', addresses)).toBe('0xccc');
  });

  it('maps a missing PT leg (zero address normalized to null upstream) to null', () => {
    expect(memeTokenAddressOf('pt', { ...addresses, pt: null })).toBeNull();
    expect(memeTokenAddressOf('meme', { ...addresses, pt: null })).toBe('0xaaa');
  });
});

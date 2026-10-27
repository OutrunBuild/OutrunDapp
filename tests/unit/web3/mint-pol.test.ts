import { describe, expect, it } from 'vitest';

import {
  mintPolEstimateFromPrice,
  mintPolTargetFromQuote,
  uAssetPerPolAtPrice,
} from '@/lib/web3/mint-pol';

// Live BSC-testnet quote for the smoke verse's main pool (1 POL of reference liquidity):
// the settlement anchor (uAssetPerPol) no longer matches this composition after the price rise.
const QUOTED_UASSET = 4_377_355_077_109_926n;
const QUOTED_MEMECOIN = 228_448_454_005_753_878_173n;
const REFERENCE = 10n ** 18n;
const PRICE = 1.916e-5;

describe('mintPolTargetFromQuote', () => {
  it('takes the tighter budget and applies slippage', () => {
    const fromQuote = mintPolTargetFromQuote({
      uAssetDesired: 100n * 10n ** 18n,
      memecoinDesired: (100n * 10n ** 18n * QUOTED_MEMECOIN) / QUOTED_UASSET,
      referenceLiquidity: REFERENCE,
      quotedUAsset: QUOTED_UASSET,
      quotedMemecoin: QUOTED_MEMECOIN,
      slippageBps: 50,
    });
    const achievable = (100n * 10n ** 18n * REFERENCE) / QUOTED_UASSET;
    expect(fromQuote).toBe((achievable * 9_950n) / 10_000n);
  });

  it('never asks for more than either typed budget', () => {
    const uAssetDesired = 100n * 10n ** 18n;
    const memecoinDesired = (uAssetDesired * QUOTED_MEMECOIN) / QUOTED_UASSET + 123n;
    const target = mintPolTargetFromQuote({
      uAssetDesired,
      memecoinDesired,
      referenceLiquidity: REFERENCE,
      quotedUAsset: QUOTED_UASSET,
      quotedMemecoin: QUOTED_MEMECOIN,
      slippageBps: 50,
    });
    // The launcher re-quotes with round-up; the target must stay under both budgets.
    const requiredUAsset = (target * QUOTED_UASSET + REFERENCE - 1n) / REFERENCE;
    const requiredMemecoin = (target * QUOTED_MEMECOIN + REFERENCE - 1n) / REFERENCE;
    expect(requiredUAsset).toBeLessThanOrEqual(uAssetDesired);
    expect(requiredMemecoin).toBeLessThanOrEqual(memecoinDesired);
  });

  it('lets the limiting side decide', () => {
    const tightMeme = mintPolTargetFromQuote({
      uAssetDesired: 100n * 10n ** 18n,
      memecoinDesired: 10n * 10n ** 18n,
      referenceLiquidity: REFERENCE,
      quotedUAsset: QUOTED_UASSET,
      quotedMemecoin: QUOTED_MEMECOIN,
      slippageBps: 0,
    });
    expect(tightMeme).toBe((10n * 10n ** 18n * REFERENCE) / QUOTED_MEMECOIN);
  });

  it('degrades to auto mode (0) when the pool quote is empty', () => {
    expect(
      mintPolTargetFromQuote({
        uAssetDesired: 1n,
        memecoinDesired: 1n,
        referenceLiquidity: REFERENCE,
        quotedUAsset: 0n,
        quotedMemecoin: 0n,
        slippageBps: 50,
      }),
    ).toBe(0n);
  });
});

describe('mintPolEstimateFromPrice', () => {
  it('prices a POL at the main-pool price, not the settlement anchor', () => {
    expect(
      uAssetPerPolAtPrice({ price: PRICE, uAssetDecimals: 18, memecoinDecimals: 18 }),
    ).toBeCloseTo(Math.sqrt(PRICE), 12);
    const out = mintPolEstimateFromPrice({
      uAssetAmount: 100,
      price: PRICE,
      uAssetDecimals: 18,
      memecoinDecimals: 18,
    });
    // 100 uAsset ÷ 0.004377 uAsset per POL ≈ 22,845 POL (the settlement-anchor formula gave
    // 31,622 POL — 38% above what the pool can mint at this price).
    expect(out).toBeCloseTo(100 / Math.sqrt(PRICE), 6);
  });

  it('returns null without a usable price or amount', () => {
    expect(
      mintPolEstimateFromPrice({
        uAssetAmount: 100,
        price: 0,
        uAssetDecimals: 18,
        memecoinDecimals: 18,
      }),
    ).toBeNull();
    expect(
      mintPolEstimateFromPrice({
        uAssetAmount: 0,
        price: PRICE,
        uAssetDecimals: 18,
        memecoinDecimals: 18,
      }),
    ).toBeNull();
  });
});

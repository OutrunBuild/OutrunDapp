// Contract-formula tests: each helper mirrors an on-chain formula (sources in the module
// header) and must stay integer-exact — the UI quotes and gates with these numbers.
import { describe, expect, it } from 'vitest';

import { WAD } from '../../../lib/web3/base-units';
import {
  leverageDebtBase,
  preorderCapBase,
  preorderCapacityCeilingBase,
  psmMintQuote,
  psmRedeemQuote,
  stakeMintBase,
} from '../../../lib/web3/contract-formulas';

describe('psmMintQuote', () => {
  it('18-dec reserve: 1 unit mints (1 - tin) with the floor the contract takes', () => {
    // tin = 0.1% (the live testnet PSM value: 1e15 wad)
    const q = psmMintQuote(WAD, 18, 10n ** 15n);
    expect(q.faceValue).toBe(WAD);
    expect(q.amountOut).toBe(999n * 10n ** 15n);
    expect(q.feeIn).toBe(10n ** 15n);
  });

  it('6-dec reserve rescales to 18-dec face value exactly (1 USDC = 1e18)', () => {
    const q = psmMintQuote(1_000_000n, 6, 10n ** 15n);
    expect(q.faceValue).toBe(WAD);
    expect(q.amountOut).toBe(999n * 10n ** 15n);
  });

  it('floors, never rounds up: a 1-wei face value with nonzero tin mints 0', () => {
    const q = psmMintQuote(1n, 18, 10n ** 15n);
    expect(q.amountOut).toBe(0n);
    expect(q.feeIn).toBe(1n);
  });

  it('a reserve above 18 decimals is outside the PSM domain (quotes zero)', () => {
    expect(psmMintQuote(10n, 19, 0n).faceValue).toBe(0n);
  });
});

describe('psmRedeemQuote', () => {
  it('18-dec reserve: burns (1 - tout) face value and pays it 1:1 (dust-free scale)', () => {
    const q = psmRedeemQuote(WAD, 18, 10n ** 15n);
    expect(q.faceValue).toBe(999n * 10n ** 15n);
    expect(q.amountOut).toBe(999n * 10n ** 15n);
    expect(q.feeOut).toBe(10n ** 15n);
  });

  it('6-dec reserve: rescale floor dust counts into feeOut', () => {
    // 1.0000009 UUSD at zero fee → 1.000000 reserve units (the 0.0000009 floor is dust)
    const q = psmRedeemQuote(1_000_000_900_000_000_000n, 6, 0n);
    expect(q.amountOut).toBe(1_000_000n);
    expect(q.feeOut).toBe(900_000_000_000n);
  });

  it('a zero payout (sub-unit burn) quotes zero and keeps the whole burn as fee', () => {
    const q = psmRedeemQuote(1n, 6, 0n);
    expect(q.amountOut).toBe(0n);
    expect(q.feeOut).toBe(1n);
  });
});

describe('preorderCapBase', () => {
  it('funds × 70% × ratio, both floors (5 UUSD at 25% → 0.875)', () => {
    expect(preorderCapBase(5n * WAD, 2_500n)).toBe(875n * 10n ** 15n);
  });

  it('floors the intermediate 70% step like the launcher lib', () => {
    // 1 wei * 70% floors to 0 regardless of the ratio
    expect(preorderCapBase(1n, 10_000n)).toBe(0n);
  });
});

describe('preorderCapacityCeilingBase', () => {
  it('mirrors the chain single-step mulDiv (5 UUSD at 25% → 0.875)', () => {
    expect(preorderCapacityCeilingBase(5n * WAD, 2_500n)).toBe(875n * 10n ** 15n);
  });

  it('can sit one wei above the two-step per-user floor (state reconstruction needs the chain value)', () => {
    // funds=143 wei, ratio=9999 bps: chain = 143×7×9999 ÷ 1e5 = 100.08… → 100;
    // two-step = floor(143×70%) = 100, then floor(100×99.99%) = 99.
    expect(preorderCapacityCeilingBase(143n, 9_999n)).toBe(100n);
    expect(preorderCapBase(143n, 9_999n)).toBe(99n);
  });
});

describe('leverageDebtBase', () => {
  it('debt = interest / rate (1 UUSD at 5% → 20 UUSD)', () => {
    expect(leverageDebtBase(WAD, 5n * 10n ** 16n)).toBe(20n * WAD);
  });

  it('a zero rate quotes nothing (no division)', () => {
    expect(leverageDebtBase(WAD, 0n)).toBe(0n);
  });
});

describe('stakeMintBase', () => {
  it('applies the per-whole-token preview ratio and floors once', () => {
    // 1.05 UUSD per 1 token, 2 tokens, 18-dec token
    expect(stakeMintBase(2n * WAD, 18, 105n * 10n ** 16n)).toBe(210n * 10n ** 16n);
  });

  it('handles 6-dec input tokens', () => {
    // 2 USDC (6 dec) at 1.0 preview → 2e18 uAsset
    expect(stakeMintBase(2_000_000n, 6, WAD)).toBe(2n * WAD);
  });
});

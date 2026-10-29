// Contract-formula tests: each helper mirrors an on-chain formula (sources in the module
// header) and must stay integer-exact — the UI quotes and gates with these numbers.
import { describe, expect, it } from 'vitest';

import { WAD } from '../../../lib/web3/base-units';
import {
  debtHeadroomBase,
  leverageCapExceeded,
  leverageDebtBase,
  leverageGateExceeded,
  preorderCapBase,
  preorderCapacityCeilingBase,
  preorderRemainingExceeded,
  psmMintQuote,
  psmRedeemQuote,
  resolveLeverageRateWad,
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

describe('leverageCapExceeded', () => {
  const RATE = 5n * 10n ** 16n; // 5% one-off ratio

  it('exactly at the cap passes (the chain gate is a strict >)', () => {
    // 1 UUSD interest at 5% → 20 UUSD debt; cap = 20 UUSD
    expect(leverageCapExceeded(0n, WAD, RATE, 20n * WAD)).toBe(false);
  });

  it('one wei over the cap trips the gate', () => {
    expect(leverageCapExceeded(0n, WAD, RATE, 20n * WAD - 1n)).toBe(true);
  });

  it('adds total and new interest before dividing (the chain books them together)', () => {
    // (0.5 + 0.5) UUSD at 5% → the same 20 UUSD debt as one 1 UUSD borrow
    expect(leverageCapExceeded(5n * 10n ** 17n, 5n * 10n ** 17n, RATE, 20n * WAD)).toBe(false);
  });

  it('trips with total>0 once total+new debt exceeds the cap (total cannot be dropped)', () => {
    // (10 + 1) UUSD at 5% → 220 UUSD debt; cap one wei under trips. A total-dropping
    // drift (new-only debt of 20 UUSD) would pass and fail here.
    expect(leverageCapExceeded(10n * WAD, WAD, RATE, 220n * WAD - 1n)).toBe(true);
  });

  it('floors the debt like mulDiv: a sub-wei remainder stays under a tight cap', () => {
    // 1 wei at 3%: floor(1 × 1e18 / 3e16) = 33 wei debt — cap 33 passes, 32 trips
    expect(leverageCapExceeded(0n, 1n, 3n * 10n ** 16n, 33n)).toBe(false);
    expect(leverageCapExceeded(0n, 1n, 3n * 10n ** 16n, 32n)).toBe(true);
  });
});

describe('leverageGateExceeded', () => {
  const RATE = 5n * 10n ** 16n; // 5% one-off ratio
  const probe = {
    interestBase: 10n * WAD,
    interestRateBase: RATE,
    debtCapBase: 220n * WAD,
  };

  it('a landed probe is the gate on its own: exact comparison, never null', () => {
    // (10 + 1) UUSD at 5% → 220 UUSD debt: equal cap passes (strict >), one wei under trips
    expect(leverageGateExceeded(WAD, probe)).toBe(false);
    expect(leverageGateExceeded(WAD, { ...probe, debtCapBase: 220n * WAD - 1n })).toBe(true);
  });

  it('a landed probe with a zero rate stays null, not an always-pass gate', () => {
    expect(leverageGateExceeded(WAD, { ...probe, interestRateBase: 0n })).toBe(null);
  });

  it('probe not landed or mint unread/zero → null (float layer decides)', () => {
    expect(leverageGateExceeded(null, probe)).toBe(null);
    expect(leverageGateExceeded(WAD, null)).toBe(null);
    expect(leverageGateExceeded(0n, probe)).toBe(null);
  });
});

describe('resolveLeverageRateWad', () => {
  const SSR_WAD = '50000000000000000'; // canonical chain's copy: 5% one-off ratio

  it('a landed probe wins even when the canonical copy differs (single-chain invariant)', () => {
    // a revert to canonical single-sourcing would read 5% here and fail
    expect(resolveLeverageRateWad(3n * 10n ** 16n, SSR_WAD)).toBe(3n * 10n ** 16n);
  });

  it('a landed zero rate (unseeded verse) falls back to the SSR wad', () => {
    expect(resolveLeverageRateWad(0n, SSR_WAD)).toBe(5n * 10n ** 16n);
  });

  it('probe not landed → the SSR wad covers the window', () => {
    expect(resolveLeverageRateWad(null, SSR_WAD)).toBe(5n * 10n ** 16n);
  });

  it('no source on any layer → null', () => {
    expect(resolveLeverageRateWad(null, null)).toBe(null);
    expect(resolveLeverageRateWad(0n, null)).toBe(null);
  });
});

describe('debtHeadroomBase', () => {
  it('cap − debt while the probe is landed', () => {
    expect(debtHeadroomBase({ debtCapBase: 90n * WAD, debtBase: 2n * WAD })).toBe(88n * WAD);
  });

  it('floor-clamps at zero once debt reaches the cap', () => {
    expect(debtHeadroomBase({ debtCapBase: 90n * WAD, debtBase: 90n * WAD })).toBe(0n);
    expect(debtHeadroomBase({ debtCapBase: 90n * WAD, debtBase: 91n * WAD })).toBe(0n);
  });

  it('probe not landed → null (float layer covers the window)', () => {
    expect(debtHeadroomBase(null)).toBe(null);
  });
});

describe('preorderRemainingExceeded', () => {
  const REMAINING = 875n * 10n ** 15n; // 0.875 UUSD verse remaining

  it('exact probe: mint above the remaining capacity trips the gate', () => {
    expect(preorderRemainingExceeded(REMAINING, REMAINING + 1n, null, 0)).toBe(true);
  });

  it('exact probe: mint equal to the remaining capacity passes (strict >)', () => {
    expect(preorderRemainingExceeded(REMAINING, REMAINING, null, 0)).toBe(false);
  });

  it('exact-first: non-null float operands are ignored while both exact operands are in', () => {
    // a float-first drift would read 999 > 0 and trip; the exact comparison wins and passes
    expect(preorderRemainingExceeded(REMAINING, REMAINING, 0, 999)).toBe(false);
  });

  it('float fallback while the probe remaining is unread (float compare)', () => {
    expect(preorderRemainingExceeded(null, null, 0.875, 0.9)).toBe(true);
    expect(preorderRemainingExceeded(null, null, 0.875, 0.875)).toBe(false);
  });

  it('falls back to float when the mint quote is missing even though the probe remaining is in', () => {
    expect(preorderRemainingExceeded(REMAINING, null, 0.875, 0.9)).toBe(true);
  });

  it('no readable remaining on any layer → no gate', () => {
    expect(preorderRemainingExceeded(null, null, null, 0.9)).toBe(false);
  });
});

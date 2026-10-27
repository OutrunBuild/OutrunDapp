// Claim-center card derivation: render rules per the ledger — a vesting preorder position
// stays visible at zero claimable (the rest is still locked in), one-shot cards drop out
// once claimed, multi-currency claims split into a hero leg plus equal-basis extra legs,
// and the badge only counts cards with a live claim action.
import { describe, expect, it } from 'vitest';

import {
  claimableBadgeCount,
  deriveClaimRows,
  type ClaimEntitlements,
} from '../../components/verse/claim-rows';

const base: ClaimEntitlements = { memecoinSymbol: 'CACTUS', uAssetSymbol: 'UUSD' };

describe('deriveClaimRows', () => {
  it('renders all four cards in display order with hero + extra legs', () => {
    const rows = deriveClaimRows({
      ...base,
      preorder: { claimable: 1240.5, claimed: 2000 },
      yt: { claimable: 512 },
      fees: { uAsset: 18.2, pt: 3.4 },
      lp: { meme: 320.6, uAsset: 4.1 },
    });
    expect(rows.map((row) => row.kind)).toEqual(['preorder', 'yt', 'fees', 'lp']);
    expect(rows[0].main).toEqual({ amount: 1240.5, symbol: 'CACTUS' });
    expect(rows[0].claimed).toBe(2000);
    expect(rows[1].main).toEqual({ amount: 512, symbol: 'YT-CACTUS' });
    expect(rows[2].main).toEqual({ amount: 18.2, symbol: 'UUSD' });
    expect(rows[2].extra).toEqual([{ amount: 3.4, symbol: 'PT-CACTUS' }]);
    expect(rows[3].main).toEqual({ amount: 320.6, symbol: 'CACTUS' });
    expect(rows[3].extra).toEqual([{ amount: 4.1, symbol: 'UUSD' }]);
  });

  it('keeps a vesting preorder position at zero claimable, but not a fully-empty one', () => {
    const vesting = deriveClaimRows({ ...base, preorder: { claimable: 0, claimed: 2000 } });
    expect(vesting).toHaveLength(1);
    expect(vesting[0].claimable).toBe(false);

    expect(deriveClaimRows({ ...base, preorder: { claimable: 0, claimed: 0 } })).toHaveLength(0);
  });

  it('carries the linear-unlock progress sample only when provided', () => {
    expect(
      deriveClaimRows({ ...base, preorder: { claimable: 1, claimed: 0 } })[0].progress,
    ).toBeNull();
    expect(
      deriveClaimRows({ ...base, preorder: { claimable: 1, claimed: 0, progress: 0.78 } })[0]
        .progress,
    ).toBe(0.78);
  });

  it('promotes the sole non-zero leg to hero when the first currency is zero', () => {
    const onlyPt = deriveClaimRows({ ...base, fees: { uAsset: 0, pt: 2 } });
    expect(onlyPt).toHaveLength(1);
    expect(onlyPt[0].main).toEqual({ amount: 2, symbol: 'PT-CACTUS' });
    expect(onlyPt[0].extra).toEqual([]);
  });

  it('drops fully-zero cards', () => {
    expect(deriveClaimRows({ ...base, lp: { meme: 0, uAsset: 0 } })).toHaveLength(0);
    expect(deriveClaimRows({ ...base, yt: { claimable: 0 } })).toHaveLength(0);
    expect(deriveClaimRows(base)).toEqual([]);
  });
});

describe('claimableBadgeCount', () => {
  it('counts only cards with a live claim action', () => {
    const rows = deriveClaimRows({
      ...base,
      preorder: { claimable: 0, claimed: 2000 },
      fees: { uAsset: 1, pt: 0 },
    });
    expect(rows).toHaveLength(2);
    expect(claimableBadgeCount(rows)).toBe(1);
  });

  it('is zero when nothing is actionable', () => {
    expect(claimableBadgeCount(deriveClaimRows(base))).toBe(0);
  });
});

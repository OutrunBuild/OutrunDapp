// Participations-zone ledger decode: viem multicall with allowFailure wraps every entry as
// {status, result}; a reverted leg must unwrap to null (one bad verse skips its row, never
// poisons the scan) and a row summing to zero holds nothing and is skipped rather than rendered
// as an empty position.
import { describe, expect, it } from 'vitest';

import { multicallLeg, participationTotals } from '../../components/portfolio/participations-zone';

describe('multicallLeg (allowFailure unwrap)', () => {
  it('unwraps a successful entry', () => {
    expect(multicallLeg({ status: 'success', result: [1n, true, false] })).toEqual([
      1n,
      true,
      false,
    ]);
    expect(multicallLeg({ status: 'success', result: 5n })).toBe(5n);
  });

  it('nulls a reverted leg, a success without a result, and an absent leg', () => {
    expect(multicallLeg({ status: 'failure' })).toBeNull();
    expect(multicallLeg({ status: 'revert', result: undefined })).toBeNull();
    expect(multicallLeg(undefined)).toBeNull();
  });
});

describe('participationTotals (ledger row math)', () => {
  it("converts the three legs at the token's decimals and sums them", () => {
    // 1.5 genesis + 1.0 leveraged debt + 0.5 preorder, 6-dec uAsset
    const totals = participationTotals(1_500_000n, 500_000n, 1_000_000n, 6);
    expect(totals).toEqual({ normal: 1.5, leverage: 1, preorder: 0.5, total: 3 });
  });

  it('keeps exact uAsset units at 18 decimals', () => {
    expect(participationTotals(2_000_000_000_000_000_000n, 0n, 0n, 18)).toEqual({
      normal: 2,
      leverage: 0,
      preorder: 0,
      total: 2,
    });
  });

  it('returns null for a row summing to zero (nothing held, nothing owed)', () => {
    expect(participationTotals(0n, 0n, 0n, 6)).toBeNull();
  });
});

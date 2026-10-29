// Omnichain supply discipline: every landed chain's totalSupply is that chain's local
// circulation, so a partial sum silently under-reports the global figure. One unread leg must
// collapse the whole total to null (the renderer then omits the row).
import { describe, expect, it } from 'vitest';

import { sumCompleteSupplies } from '../../../lib/data/onchain-source';

describe('sumCompleteSupplies', () => {
  it('sums every leg when all reads landed', () => {
    expect(sumCompleteSupplies([1n, 2n, 3n])).toBe(6n);
  });

  it('collapses to null when any single leg failed', () => {
    expect(sumCompleteSupplies([1n, null, 3n])).toBeNull();
    expect(sumCompleteSupplies([null])).toBeNull();
  });

  it('reports null rather than 0 for an empty landed set', () => {
    // An empty array means "no chain resolved", not "supply is zero" — 0n would render a real
    // number on the market-cap row.
    expect(sumCompleteSupplies([])).toBeNull();
  });
});

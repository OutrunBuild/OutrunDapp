// Balance semantics of Balance/Max in the genesis participation form:
// balances.json aggregates across chains by symbol; symbols with no snapshot
// rows (USDT, sy assets) do not appear in the table → panel slot state
// (-- + Max disabled)
import { describe, expect, it } from 'vitest';

import { getFixtureWalletBalances } from '../../lib/data/fixture-repository';

describe('getFixtureWalletBalances: per-symbol cross-chain totals', () => {
  const balances = getFixtureWalletBalances();

  it('multi-chain uAsset rows sum (UETH = 6 + 2.5 + 1)', () => {
    expect(balances.UETH).toBe(9.5);
  });

  it('credit and reserve rows enter the table the same way (cross-chain totals)', () => {
    expect(balances['UETH(Credit)']).toBe(1.4);
    expect(balances.USDC).toBe(2500);
    expect(balances.ETH).toBe(0.9);
  });

  it('symbols without snapshot rows are absent (USDT / sy assets -> slot state)', () => {
    expect(balances.USDT).toBeUndefined();
    expect(balances.sUSDe).toBeUndefined();
    expect(balances.wstETH).toBeUndefined();
  });
});

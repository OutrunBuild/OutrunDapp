// Reserve pull-leg builder: the participation routes that pay a reserve all assemble the same
// leg (token + decimals-scaled amount + display) plus the PSM funding that consumes it, and
// two legs on one token must merge into a single approve. Pure functions only — decimals
// arrive as an argument, so no wallet/chain is involved.
import { describe, expect, it } from 'vitest';
import type { Hex } from 'viem';

import { buildReserveLeg, mergePullLegs } from '../../components/verse/fund-leg';
import { FUND_SOURCE } from '../../lib/web3/session-actions';

const USDC = '0x2222222222222222222222222222222222222222' as Hex;
const UUSD = '0x3333333333333333333333333333333333333333' as Hex;

describe('buildReserveLeg', () => {
  it('scales the typed amount with the token decimals and carries the PSM funding', () => {
    const leg = buildReserveLeg({ token: USDC, amount: '12.5', decimals: 6, symbol: 'USDC' });
    expect(leg.amount).toBe(12_500_000n);
    expect(leg.display).toBe('12.5 USDC');
    expect(leg.decimals).toBe(6);
    expect(leg.funding).toEqual({
      source: FUND_SOURCE.Psm,
      token: USDC,
      amount: 12_500_000n,
      sp: '0x0000000000000000000000000000000000000000',
      minSyOut: 0n,
      minUAssetMinted: 0n,
    });
  });

  it('truncates beyond the asset precision instead of rounding up', () => {
    const leg = buildReserveLeg({ token: USDC, amount: '1.2345678', decimals: 6, symbol: 'USDC' });
    expect(leg.amount).toBe(1_234_567n);
  });

  it('keeps 18-decimal reserves intact for the display string', () => {
    const leg = buildReserveLeg({ token: UUSD, amount: '1000', decimals: 18, symbol: 'UUSD' });
    expect(leg.amount).toBe(10n ** 21n);
    expect(leg.display).toBe('1000 UUSD');
  });
});

describe('mergePullLegs', () => {
  const reserve = buildReserveLeg({ token: USDC, amount: '4', decimals: 6, symbol: 'USDC' });

  it('merges two legs on one token into a single approve of the summed amount', () => {
    const legs = mergePullLegs({ token: USDC, amount: 6_000_000n, display: '6 USDC' }, reserve);
    expect(legs).toHaveLength(1);
    expect(legs[0]).toEqual({ token: USDC, amount: 10_000_000n, display: '10 USDC' });
  });

  it('keeps two legs when the sibling pays another token', () => {
    const sibling = { token: UUSD, amount: 5n, display: '5 UUSD' };
    const legs = mergePullLegs(sibling, reserve);
    expect(legs).toHaveLength(2);
    expect(legs[0]).toBe(sibling);
    expect(legs[1]).toMatchObject({ token: USDC, amount: 4_000_000n, display: '4 USDC' });
  });

  it('treats hex casing as the same token', () => {
    const mixed = '0xaBcDeF0000000000000000000000000000000001' as Hex;
    const lower = buildReserveLeg({
      token: mixed.toLowerCase() as Hex,
      amount: '4',
      decimals: 6,
      symbol: 'USDC',
    });
    const sibling = { token: mixed, amount: 1_000_000n, display: '1 USDC' };
    expect(mergePullLegs(sibling, lower)).toHaveLength(1);
  });

  it('recomputes the merged display from the reserve leg, never from the sibling string', () => {
    // The sibling display is deliberately stale-formatted: a merge that reuses it (or its
    // precision) instead of the reserve metadata would surface here.
    const stale = { token: USDC, amount: 6_000_000n, display: '6.000000 USDC (stale)' };
    expect(mergePullLegs(stale, reserve)[0]?.display).toBe('10 USDC');

    const longReserve = buildReserveLeg({
      token: UUSD,
      amount: '24',
      decimals: 18,
      symbol: 'UUSD',
    });
    const sameToken = { token: UUSD, amount: 10n ** 18n, display: '1 UUSD' };
    expect(mergePullLegs(sameToken, longReserve)[0]).toMatchObject({
      token: UUSD,
      amount: 25n * 10n ** 18n,
      display: '25 UUSD',
    });
  });
});

// Floor-aware tier ladder (ruling 049/050): percentiles from eth_feeHistory set the tips,
// the node's eth_gasPrice is a hard floor, and the tip never exceeds what the protocol can
// actually pay (maxFee − baseFee).
import { describe, expect, it } from 'vitest';

import { buildGasTiers } from '../../../components/global/use-gas-quote';

const GWEI = 1_000_000_000n;
const LIMIT = 400_000n;

describe('buildGasTiers', () => {
  it('respects the BSC floor and still separates the tiers (base fee = 0)', () => {
    const tiers = buildGasTiers({
      nextBase: 0n,
      floor: GWEI / 10n, // 0.1 gwei validator minimum
      p10: (GWEI * 21n) / 1000n,
      p50: (GWEI * 535n) / 10_000n, // below the floor
      p90: (GWEI * 217n) / 1000n,
      gasLimit: LIMIT,
    });
    const [slow, avg, fast] = tiers;
    expect(slow!.maxFee).toBe(GWEI / 10n);
    expect(avg!.maxFee).toBe((GWEI * 125n) / 1000n); // floor × tip ladder
    expect(fast!.maxFee).toBe((GWEI * 217n) / 1000n); // p90 above the ladder
    for (const tier of tiers) {
      expect(tier.maxFee).toBeGreaterThanOrEqual(GWEI / 10n);
      expect(tier.tip).toBeLessThanOrEqual(tier.maxFee);
      expect(tier.fee).toBe(tier.maxFee * LIMIT);
    }
    expect(avg!.tip).toBeGreaterThan(slow!.tip);
    expect(fast!.tip).toBeGreaterThan(avg!.tip);
  });

  it('adds base-fee headroom on an ETH-like chain and keeps the tip payable', () => {
    const nextBase = GWEI;
    const tiers = buildGasTiers({
      nextBase,
      floor: (GWEI * 105n) / 100n,
      p10: (GWEI * 4n) / 100n,
      p50: (GWEI * 5n) / 100n,
      p90: (GWEI * 8n) / 100n,
      gasLimit: LIMIT,
    });
    // Tips: p10 is raised to the floor tip (1.05 − 1); then the ladder (×1.25, ×1.3) and
    // p90 (0.08) decide avg/fast.
    const slowTip = GWEI / 20n; // 0.05
    const avgTip = (slowTip * 125n) / 100n; // 0.0625
    const fastTip = (avgTip * 130n) / 100n; // 0.08125 > p90
    expect(tiers[0]!.tip).toBe(slowTip);
    expect(tiers[1]!.tip).toBe(avgTip);
    expect(tiers[2]!.tip).toBe(fastTip);
    expect(tiers[0]!.maxFee).toBe((GWEI * 110n) / 100n + slowTip);
    expect(tiers[1]!.maxFee).toBe((GWEI * 125n) / 100n + avgTip);
    expect(tiers[2]!.maxFee).toBe((GWEI * 160n) / 100n + fastTip);
    for (const tier of tiers) {
      expect(tier.maxFee).toBeGreaterThanOrEqual((GWEI * 105n) / 100n);
      expect(tier.tip).toBeLessThanOrEqual(tier.maxFee - nextBase);
    }
  });

  it('never quotes below the node price when the market is empty', () => {
    const tiers = buildGasTiers({
      nextBase: 0n,
      floor: GWEI,
      p10: 0n,
      p50: 0n,
      p90: 0n,
      gasLimit: LIMIT,
    });
    expect(tiers.map((tier) => tier.maxFee)).toEqual([
      GWEI,
      (GWEI * 125n) / 100n,
      (GWEI * 1625n) / 1000n,
    ]);
  });
});

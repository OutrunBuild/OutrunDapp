// Memeverse hook pool key shape + full-range price derivation:
// - key = sorted currencies + dynamic-fee flag (0x800000) + tick spacing 200 — MemeversePoolKeyLib.hookPoolKey
// - poolId = keccak256(abi.encode(PoolKey)) — v4 PoolId.toId, computed locally
// - display price from raw reserve amounts across differing token decimals
import { describe, expect, it } from 'vitest';
import { getAddress, keccak256 } from 'viem';
import {
  DYNAMIC_FEE_FLAG,
  HOOK_TICK_SPACING,
  hookPoolKey,
  lpPerQuoteUnit,
  poolIdOf,
  priceQuotePerBase,
} from '../../../lib/web3/pool-quote';

const A = getAddress('0x000000000000000000000000000000000000000a');
const B = getAddress('0x00000000000000000000000000000000000000bb');
const HOOK = getAddress('0x56eDfD9077f78aaEc23B9BcF6883E718B9f428cc');

/** Independent encoding path: manual solidity tuple packing (address,address,uint24,int24,address)
 *  as concatenated 32-byte words — guards the viem encodeAbiParameters call against arg-order drift. */
function manualPoolId(key: {
  currency0: string;
  currency1: string;
  fee: number;
  tickSpacing: number;
  hooks: string;
}): string {
  const word = (addr: string) => addr.toLowerCase().slice(2).padStart(64, '0');
  const uint24 = key.fee.toString(16).padStart(64, '0');
  const int24 = BigInt(key.tickSpacing).toString(16).padStart(64, '0');
  return keccak256(
    ('0x' +
      word(key.currency0) +
      word(key.currency1) +
      uint24 +
      int24 +
      word(key.hooks)) as `0x${string}`,
  );
}

describe('hookPoolKey shape', () => {
  it('sorts currencies by address regardless of argument order', () => {
    const forward = hookPoolKey(A, B, HOOK);
    const backward = hookPoolKey(B, A, HOOK);
    expect(forward).toEqual(backward);
    expect(forward.currency0.toLowerCase()).toBe(A.toLowerCase());
    expect(forward.currency1.toLowerCase()).toBe(B.toLowerCase());
  });

  it('binds the dynamic-fee flag and tick spacing 200 (MemeversePoolKeyLib)', () => {
    const key = hookPoolKey(A, B, HOOK);
    expect(key.fee).toBe(DYNAMIC_FEE_FLAG);
    expect(DYNAMIC_FEE_FLAG).toBe(0x800000);
    expect(key.tickSpacing).toBe(HOOK_TICK_SPACING);
    expect(HOOK_TICK_SPACING).toBe(200);
    expect(key.hooks).toBe(HOOK);
  });
});

describe('poolIdOf', () => {
  it('matches an independently packed keccak of the PoolKey tuple', () => {
    const key = hookPoolKey(A, B, HOOK);
    expect(poolIdOf(key)).toBe(manualPoolId(key));
  });

  it('is sensitive to the hook binding (different hook = different pool)', () => {
    const other = '0x00000000000000000000000000000000000000ff' as const;
    expect(poolIdOf(hookPoolKey(A, B, other))).not.toBe(poolIdOf(hookPoolKey(A, B, HOOK)));
  });
});

describe('priceQuotePerBase', () => {
  it('derives the display price from raw reserves at equal decimals', () => {
    // 2 meme (18 dec) backing 0.01 uAsset (18 dec) -> 0.005 uAsset per meme
    expect(priceQuotePerBase(2n * 10n ** 18n, 18, 1n * 10n ** 16n, 18)).toBeCloseTo(0.005, 12);
  });

  it('normalizes across differing decimals', () => {
    // 1 base at 6 dec = 1_000_000 raw; 2 quote at 18 dec -> price 2
    expect(priceQuotePerBase(1_000_000n, 6, 2n * 10n ** 18n, 18)).toBeCloseTo(2, 12);
  });

  it('returns null on an empty pool (no reserves to price)', () => {
    expect(priceQuotePerBase(0n, 18, 5n * 10n ** 18n, 18)).toBeNull();
  });
});

describe('lpPerQuoteUnit', () => {
  it('mints-per-quote is LP supply over the quote-side reserve (raw ratio is decimal-free)', () => {
    expect(lpPerQuoteUnit(1200n, 400n)).toBeCloseTo(3, 12);
  });

  it('null when the quote side is empty (division without a denominator)', () => {
    expect(lpPerQuoteUnit(1200n, 0n)).toBeNull();
  });
});

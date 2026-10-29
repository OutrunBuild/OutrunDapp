// Portfolio dialog amount state machines: four dialogs gate the same predicates — an
// over-balance entry must never reach the wallet, switching convert direction clears the carried
// amount, a depleted mint headroom hard-stops the CTA, and the USR share-index conversion must
// divide on deposit and multiply on withdraw. Previously only bridgeExecutionReady (one pure
// function of four) had a test; these cover the rest of the family.
import { describe, expect, it } from 'vitest';

import {
  amountGate,
  mintBlockedByHeadroom,
  modeSwitch,
  shareAmount,
} from '../../components/portfolio/portfolio-dialogs';

describe('amountGate (finite/positive + over-balance)', () => {
  it('accepts a positive amount within balance', () => {
    expect(amountGate('1.5', 2)).toEqual({ parsed: 1.5, valid: true, overBalance: false });
  });

  it('rejects empty, non-numeric, zero and negative entries', () => {
    expect(amountGate('', 2).valid).toBe(false);
    expect(amountGate('abc', 2).valid).toBe(false);
    expect(amountGate('0', 2).valid).toBe(false);
    expect(amountGate('-1', 2).valid).toBe(false);
    expect(amountGate('abc', 2).overBalance).toBe(false);
  });

  it('flags an amount above the balance without trusting a NaN parse against it', () => {
    expect(amountGate('2.5', 2).overBalance).toBe(true);
    // an unknown balance (null) cannot judge over-balance
    expect(amountGate('2.5', null).overBalance).toBe(false);
  });
});

describe('modeSwitch (direction change clears the amount)', () => {
  it('clears the carried amount when the direction actually changes', () => {
    expect(modeSwitch('mint', 'redeem')).toEqual({ mode: 'redeem', clearAmount: true });
    expect(modeSwitch('redeem', 'mint')).toEqual({ mode: 'mint', clearAmount: true });
  });

  it('is a no-op when the requested direction is already active', () => {
    expect(modeSwitch('mint', 'mint')).toEqual({ mode: 'mint', clearAmount: false });
    expect(modeSwitch('redeem', 'redeem')).toEqual({ mode: 'redeem', clearAmount: false });
  });
});

describe('mintBlockedByHeadroom (credit-line stop)', () => {
  it('blocks mint when the headroom is exhausted, keeps redeem open', () => {
    expect(mintBlockedByHeadroom('mint', 0)).toBe(true);
    expect(mintBlockedByHeadroom('mint', -1)).toBe(true);
    expect(mintBlockedByHeadroom('redeem', 0)).toBe(false);
  });

  it('stays open while headroom is positive or unknown', () => {
    expect(mintBlockedByHeadroom('mint', 1)).toBe(false);
    expect(mintBlockedByHeadroom('mint', null)).toBe(false);
  });
});

describe('shareAmount (USR share-index conversion)', () => {
  it('divides by the index on deposit and multiplies on withdraw', () => {
    expect(shareAmount(100, 1.25, 'deposit')).toBe(80);
    expect(shareAmount(80, 1.25, 'withdraw')).toBe(100);
  });

  it('is the identity when the index is exactly 1', () => {
    expect(shareAmount(12.5, 1, 'deposit')).toBe(12.5);
    expect(shareAmount(12.5, 1, 'withdraw')).toBe(12.5);
  });
});

// Transaction center contract tests (stage 6 step 4, architecture.md §6.4/§7):
// - the eleven states are the §7 verbatim set and advance only on events (no timers)
// - the review panel gates signing; gas shortage blocks authorization AND signature
// - refusal cancels with no error tone (B4)
// - a source-chain receipt is not completion; scope drift discards auth/simulation
import { describe, expect, it } from 'vitest';

import {
  INITIAL_TX_CONTEXT,
  isReviewComplete,
  reduceTx,
  txDisplayOf,
  TX_STATES,
  type TxContext,
  type TxEvent,
  type TxReview,
} from '../../../lib/web3/tx-center';

const REVIEW: TxReview = {
  chainId: 421614,
  account: '0x1111111111111111111111111111111111111111',
  targetContract: '0x2222222222222222222222222222222222222222',
  functionName: 'swap',
  inputs: 'in/out amounts',
  minOutput: 'min out',
  fee: 'fee',
  gasPayer: '0x1111111111111111111111111111111111111111',
  authorizationChange: 'new delegation',
  estimatedGas: 'estimate',
  nativeBalance: 'balance',
};

const run = (events: TxEvent[]): TxContext => events.reduce(reduceTx, INITIAL_TX_CONTEXT);

describe('transaction state set', () => {
  it('is the §7 verbatim eleven', () => {
    expect([...TX_STATES]).toEqual([
      'Preparing…',
      'Preflighting…',
      'Awaiting authorization…',
      'Simulating Type-4 transaction…',
      'Awaiting transaction signature…',
      'Submitted',
      'Confirming…',
      'Confirmed',
      'Reverted',
      'Replaced',
      'Cancelled',
    ]);
  });
});

describe('reduceTx', () => {
  it('walks the single-chain happy path on events only', () => {
    const end = run([
      { type: 'begin', review: REVIEW },
      { type: 'preflight-ok' },
      { type: 'authorization-requested' },
      { type: 'authorization-signed' },
      { type: 'simulation-ok' },
      { type: 'tx-signed', hash: '0xabc' },
      { type: 'receipt-pending' },
      { type: 'receipt-success', hash: '0xabc' },
    ]);
    expect(end.state).toBe('Confirmed');
    expect(end.txHash).toBe('0xabc');
  });

  it('blocks authorization and signature while gas is insufficient (§6.4)', () => {
    const gated = run([
      { type: 'begin', review: REVIEW },
      { type: 'preflight-block-gas' },
      { type: 'authorization-requested' },
    ]);
    expect(gated.gasGate).toBe('insufficient');
    expect(gated.state).toBe('Preparing…');
    const signed = reduceTx(
      { ...gated, state: 'Awaiting transaction signature…' },
      { type: 'tx-signed', hash: '0xabc' },
    );
    expect(signed.state).toBe('Awaiting transaction signature…');
    expect(signed.txHash).toBeNull();
  });

  it('cancels on refusal with no error tone (B4)', () => {
    const end = run([
      { type: 'begin', review: REVIEW },
      { type: 'preflight-ok' },
      { type: 'authorization-requested' },
      { type: 'user-rejected' },
    ]);
    expect(end.state).toBe('Cancelled');
    expect(end.errorKind).toBeNull();
  });

  it('keeps cross-chain messages pending past the source receipt', () => {
    const mid = run([
      { type: 'begin', review: REVIEW },
      { type: 'preflight-ok' },
      { type: 'authorization-requested' },
      { type: 'authorization-signed' },
      { type: 'simulation-ok' },
      { type: 'tx-signed', hash: '0xsrc' },
      { type: 'receipt-pending' },
      { type: 'source-confirmed', hash: '0xsrc' },
      { type: 'receipt-success', hash: '0xsrc' },
    ]);
    expect(mid.state).toBe('Confirming…');
    const done = reduceTx(mid, { type: 'destination-confirmed' });
    expect(done.state).toBe('Confirmed');
  });

  it('lands simulation failure in the error state and discards drifted scope', () => {
    const failed = run([
      { type: 'begin', review: REVIEW },
      { type: 'preflight-ok' },
      { type: 'authorization-requested' },
      { type: 'authorization-signed' },
      { type: 'simulation-failed', kind: 'batch-reverted' },
    ]);
    expect(failed.state).toBe('Reverted');
    expect(failed.errorKind).toBe('batch-reverted');
    const stale = reduceTx(
      run([
        { type: 'begin', review: REVIEW },
        { type: 'preflight-ok' },
        { type: 'authorization-requested' },
      ]),
      { type: 'scope-stale' },
    );
    expect(stale.state).toBe('Preparing…');
    expect(stale.review).toEqual(REVIEW);
  });

  it('ignores meaningless events and freezes terminal states', () => {
    expect(run([{ type: 'tx-signed', hash: '0xabc' }]).state).toBe('Preparing…');
    const done = run([
      { type: 'begin', review: REVIEW },
      { type: 'preflight-ok' },
      { type: 'authorization-requested' },
      { type: 'authorization-signed' },
      { type: 'simulation-ok' },
      { type: 'tx-signed', hash: '0xabc' },
      { type: 'receipt-pending' },
      { type: 'receipt-success', hash: '0xabc' },
    ]);
    expect(reduceTx(done, { type: 'user-rejected' }).state).toBe('Confirmed');
    expect(reduceTx(done, { type: 'scope-stale' }).state).toBe('Confirmed');
  });
});

describe('wallet capability failure', () => {
  it('keeps the form open and surfaces the capability error instead of cancelling', () => {
    const started = run([{ type: 'begin', review: REVIEW }]);
    const unsupported = reduceTx(started, { type: 'wallet-unsupported' });
    expect(unsupported.state).toBe(started.state);
    expect(unsupported.errorKind).toBe('wallet-unsupported');
  });

  it('is ignored once the flow is terminal', () => {
    const done = run([
      { type: 'begin', review: REVIEW },
      { type: 'preflight-ok' },
      { type: 'authorization-requested' },
      { type: 'authorization-signed' },
      { type: 'simulation-ok' },
      { type: 'tx-signed', hash: '0xabc' },
      { type: 'receipt-pending' },
      { type: 'receipt-success', hash: '0xabc' },
    ]);
    expect(reduceTx(done, { type: 'wallet-unsupported' }).state).toBe('Confirmed');
  });
});

describe('review gate', () => {
  it('requires every pre-signature field before authorization', () => {
    expect(isReviewComplete(REVIEW)).toBe(true);
    const rest = { ...REVIEW, fee: '' };
    expect(isReviewComplete(rest)).toBe(false);
  });
});

describe('txDisplayOf', () => {
  it('projects onto the existing status strip', () => {
    expect(txDisplayOf(null)).toBe('idle');
    expect(txDisplayOf('Preparing…')).toBe('signing');
    expect(txDisplayOf('Awaiting transaction signature…')).toBe('signing');
    expect(txDisplayOf('Submitted')).toBe('confirming');
    expect(txDisplayOf('Confirmed')).toBe('confirmed');
    expect(txDisplayOf('Cancelled')).toBe('cancelled');
    expect(txDisplayOf('Reverted')).toBe('reverted');
    expect(txDisplayOf('Replaced')).toBe('reverted');
  });
});

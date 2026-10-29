// Account nine-state machine + capability detection contract tests (stage 6 step 2):
// - the nine states are exactly the architecture §6.2 set (no tenth state is reachable)
// - authorization refusal returns to Connected EOA (B4: not an error, draft preserved)
// - delegation standing is per-chain: chain-changed re-evaluates from Connected EOA
// - capability detection follows the §6.5 1→4 order, including fail-closed mismatch
// - a provider without 7702 abilities blocks only the standings that still need one
import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_STATES,
  advanceAccount,
  CONNECTION_TRIGGER_POLICY,
  detectCodeCapability,
  parseDelegationAddress,
  resolveWriteCapability,
  type AccountEvent,
  type AccountState,
} from '../../../lib/web3/account';

const KERNEL = '0xd6CEDDe84be40893d153Be9d467CD6aD37875b28';
const OTHER = '0x1111111111111111111111111111111111111111';

const run = (start: AccountState, events: AccountEvent[]): AccountState =>
  events.reduce(advanceAccount, start);

describe('account nine-state set', () => {
  it('is exactly the §6.2 nine states', () => {
    expect([...ACCOUNT_STATES]).toEqual([
      'Disconnected',
      'Connected EOA',
      'Authorization requested',
      'Authorization signed',
      'Delegation pending',
      'Kernel delegated',
      'Unsupported delegation',
      'Delegation replacement pending',
      'Delegation revoked',
    ]);
  });
});

describe('advanceAccount', () => {
  it('walks the happy path to Kernel delegated', () => {
    expect(
      run('Disconnected', [
        { type: 'connect' },
        { type: 'request-authorization' },
        { type: 'authorization-signed' },
        { type: 'authorization-submitted' },
        { type: 'delegation-observed', supported: true },
      ]),
    ).toBe('Kernel delegated');
  });

  it('lands directly on delegation standing when an already-delegated wallet connects', () => {
    expect(
      run('Disconnected', [{ type: 'connect' }, { type: 'delegation-observed', supported: true }]),
    ).toBe('Kernel delegated');
    expect(
      run('Disconnected', [{ type: 'connect' }, { type: 'delegation-observed', supported: false }]),
    ).toBe('Unsupported delegation');
  });

  it('returns refusal to Connected EOA (B4: not an error, form keeps its draft)', () => {
    expect(
      run('Disconnected', [
        { type: 'connect' },
        { type: 'request-authorization' },
        { type: 'reject-authorization' },
      ]),
    ).toBe('Connected EOA');
  });

  it('replaces and revokes delegation explicitly', () => {
    expect(
      run('Kernel delegated', [
        { type: 'request-replacement' },
        { type: 'replacement-observed', supported: true },
      ]),
    ).toBe('Kernel delegated');
    expect(
      run('Unsupported delegation', [
        { type: 'request-replacement' },
        { type: 'replacement-observed', supported: false },
      ]),
    ).toBe('Unsupported delegation');
    expect(run('Kernel delegated', [{ type: 'revocation-observed' }])).toBe('Delegation revoked');
    expect(run('Delegation revoked', [{ type: 'request-authorization' }])).toBe(
      'Authorization requested',
    );
  });

  it('drops delegation standing on chain change (chain-specific delegation)', () => {
    for (const standing of [
      'Kernel delegated',
      'Unsupported delegation',
      'Delegation revoked',
    ] as const) {
      expect(run(standing, [{ type: 'chain-changed' }])).toBe('Connected EOA');
    }
  });

  it('disconnects from every state and ignores meaningless events', () => {
    for (const state of ACCOUNT_STATES) {
      expect(advanceAccount(state, { type: 'disconnect' })).toBe('Disconnected');
    }
    expect(advanceAccount('Disconnected', { type: 'authorization-signed' })).toBe('Disconnected');
    expect(advanceAccount('Kernel delegated', { type: 'authorization-signed' })).toBe(
      'Kernel delegated',
    );
  });
});

describe('connection trigger policy', () => {
  it('forbids auto popups and auto signatures; session restore only', () => {
    expect(CONNECTION_TRIGGER_POLICY).toEqual({
      userActionOnly: true,
      restoreSessionOnly: true,
      noAutoPopup: true,
      noAutoSign: true,
    });
  });
});

describe('parseDelegationAddress', () => {
  it('extracts the trailing implementation address', () => {
    expect(parseDelegationAddress(`0xef0100${KERNEL.slice(2)}`.toLowerCase())).toBe(
      KERNEL.toLowerCase(),
    );
  });

  it('returns null for plain EOAs, short codes, and non-delegation contracts', () => {
    expect(parseDelegationAddress('0x')).toBeNull();
    expect(parseDelegationAddress(null)).toBeNull();
    expect(parseDelegationAddress('0xef0100')).toBeNull();
    expect(parseDelegationAddress(`${OTHER}00`)).toBeNull();
  });
});

describe('detectCodeCapability (§6.5 order)', () => {
  it('branch 1: empty code is a plain EOA', () => {
    expect(detectCodeCapability('0x', KERNEL)).toBe('plain-eoa');
    expect(detectCodeCapability(null, KERNEL)).toBe('plain-eoa');
  });

  it('branch 2: matching 0xef0100 implementation is Kernel delegated', () => {
    expect(detectCodeCapability(`0xef0100${KERNEL.slice(2)}`, KERNEL)).toBe('kernel-delegated');
  });

  it('branch 3: mismatched implementation fails closed to unsupported', () => {
    expect(detectCodeCapability(`0xef0100${OTHER.slice(2)}`, KERNEL)).toBe(
      'unsupported-delegation',
    );
    expect(detectCodeCapability('0xef0100', KERNEL)).toBe('other-contract');
  });

  it('branch 4: other non-empty code is never inferred compatible', () => {
    expect(detectCodeCapability(`${OTHER}00`, KERNEL)).toBe('other-contract');
  });
});

describe('resolveWriteCapability', () => {
  it('keeps read access with an upgrade prompt when the provider cannot sign or send', () => {
    for (const provider of [
      { canSignAuthorization: false, canSendType4: true },
      { canSignAuthorization: true, canSendType4: false },
      { canSignAuthorization: false, canSendType4: false },
    ]) {
      expect(resolveWriteCapability('plain-eoa', provider)).toEqual({
        capability: 'blocked-readonly',
        upgradeHint: true,
      });
    }
  });

  it('maps standing to write posture with a capable provider', () => {
    const provider = { canSignAuthorization: true, canSendType4: true };
    expect(resolveWriteCapability('kernel-delegated', provider).capability).toBe('ready');
    expect(resolveWriteCapability('plain-eoa', provider)).toEqual({
      capability: 'needs-delegation',
      upgradeHint: false,
    });
    expect(resolveWriteCapability('unsupported-delegation', provider).capability).toBe(
      'needs-replacement',
    );
    expect(resolveWriteCapability('other-contract', provider)).toEqual({
      capability: 'blocked-other-contract',
      upgradeHint: false,
    });
  });

  it('keeps a kernel-delegated account ready even without 7702 provider abilities', () => {
    expect(
      resolveWriteCapability('kernel-delegated', {
        canSignAuthorization: false,
        canSendType4: false,
      }),
    ).toEqual({ capability: 'ready', upgradeHint: false });
  });

  it('still blocks standings that need a 7702 action on a limited provider', () => {
    const limited = { canSignAuthorization: false, canSendType4: false };
    expect(resolveWriteCapability('plain-eoa', limited)).toEqual({
      capability: 'blocked-readonly',
      upgradeHint: true,
    });
    expect(resolveWriteCapability('unsupported-delegation', limited)).toEqual({
      capability: 'blocked-readonly',
      upgradeHint: true,
    });
  });
});

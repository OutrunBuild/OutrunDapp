import { describe, expect, it } from 'vitest';

import { advance, displayGroupOf, FLOW_STATES } from '../../../lib/prototype/flow-machine';

describe('flow-machine advance', () => {
  it('full sequence advances to confirmed in order', () => {
    let state: (typeof FLOW_STATES)[number] | null = 'preparing';
    const seen: string[] = [];
    while (state) {
      seen.push(state);
      state = advance(state, 'confirmed');
    }
    expect(seen).toEqual([
      'preparing',
      'preflighting',
      'awaiting-authorization',
      'simulating',
      'awaiting-signature',
      'submitted',
      'confirming',
      'confirmed',
    ]);
  });

  it('signature rejection happens only in the awaiting-signature stage, cancelled terminal', () => {
    expect(advance('awaiting-signature', 'user-rejected')).toBe('cancelled');
    expect(advance('preparing', 'user-rejected')).toBe(null);
    expect(advance('submitted', 'user-rejected')).toBe(null);
    expect(advance('cancelled', 'user-rejected')).toBe(null);
  });

  it('revert is possible only after submission, reverted terminal', () => {
    expect(advance('awaiting-signature', 'reverted')).toBe('submitted');
    expect(advance('submitted', 'reverted')).toBe('reverted');
    expect(advance('reverted', 'reverted')).toBe(null);
  });

  it('terminal states have no successor', () => {
    expect(advance('confirmed', 'confirmed')).toBe(null);
  });
});

describe('displayGroupOf', () => {
  it('preparation maps to signing, post-submission to confirming, terminal states map to themselves', () => {
    expect(displayGroupOf('preparing')).toBe('signing');
    expect(displayGroupOf('awaiting-signature')).toBe('signing');
    expect(displayGroupOf('submitted')).toBe('confirming');
    expect(displayGroupOf('confirmed')).toBe('confirmed');
    expect(displayGroupOf('reverted')).toBe('reverted');
    expect(displayGroupOf('cancelled')).toBe('cancelled');
  });
});

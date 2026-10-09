import { describe, expect, it } from 'vitest';

import { advance, displayGroupOf, FLOW_STATES } from '../../../lib/prototype/flow-machine';

describe('flow-machine advance', () => {
  it('全序列按 §7 顺序推进到 Confirmed', () => {
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

  it('拒签只发生在等待签名阶段，终态 Cancelled', () => {
    expect(advance('awaiting-signature', 'user-rejected')).toBe('cancelled');
    expect(advance('preparing', 'user-rejected')).toBe(null);
    expect(advance('submitted', 'user-rejected')).toBe(null);
    expect(advance('cancelled', 'user-rejected')).toBe(null);
  });

  it('回退最早发生在提交后，Reverted 为终态', () => {
    expect(advance('awaiting-signature', 'reverted')).toBe('submitted');
    expect(advance('submitted', 'reverted')).toBe('reverted');
    expect(advance('reverted', 'reverted')).toBe(null);
  });

  it('终态无后继', () => {
    expect(advance('confirmed', 'confirmed')).toBe(null);
  });
});

describe('displayGroupOf', () => {
  it('准备段归 signing、提交后归 confirming、终态各归其位', () => {
    expect(displayGroupOf('preparing')).toBe('signing');
    expect(displayGroupOf('awaiting-signature')).toBe('signing');
    expect(displayGroupOf('submitted')).toBe('confirming');
    expect(displayGroupOf('confirmed')).toBe('confirmed');
    expect(displayGroupOf('reverted')).toBe('reverted');
    expect(displayGroupOf('cancelled')).toBe('cancelled');
  });
});

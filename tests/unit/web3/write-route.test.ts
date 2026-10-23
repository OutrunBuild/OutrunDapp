// Wallet-routing matrix (pure): direct → embedded session → external 5792 → unsupported.
// 'unknown' is the slow-Privy-list window and must keep the embedded default.
import { describe, expect, it } from 'vitest';

import { routeWrite } from '../../../lib/web3/write-route';

const calls = [{ target: '0x1111111111111111111111111111111111111111', value: 0n, callData: '0x' }];

describe('routeWrite', () => {
  it('routes direct specs first, regardless of wallet kind', () => {
    for (const kind of ['embedded', 'external', 'unknown'] as const) {
      expect(routeWrite({ direct: { to: '0x1', data: '0x' }, calls }, kind)).toBe('direct');
    }
  });

  it('routes embedded and unknown wallets through the session pipeline', () => {
    expect(routeWrite({ calls }, 'embedded')).toBe('session');
    expect(routeWrite({ calls }, 'unknown')).toBe('session');
    expect(routeWrite({}, 'unknown')).toBe('session');
  });

  it('routes external wallets to 5792 only when legs exist', () => {
    expect(routeWrite({ calls }, 'external')).toBe('calls');
    expect(routeWrite({ calls: [] }, 'external')).toBe('unsupported');
    expect(routeWrite({}, 'external')).toBe('unsupported');
  });
});

// Login identity contract tests: Google name (else email), X @username (else name),
// MetaMask/unknown falls back to null name (caller formats the address); last-login
// preference wins so a stored OAuth session plus an active MetaMask connection
// displays the address row, not the stale social name.
import { describe, expect, it } from 'vitest';

import { resolveLoginIdentity } from '../../../lib/web3/login-identity';

describe('resolveLoginIdentity', () => {
  it('returns null without an address', () => {
    expect(resolveLoginIdentity({ google: { name: 'G', email: 'g@x.com' } }, null)).toBeNull();
  });

  it('prefers the last-login provider over a stale OAuth user', () => {
    expect(
      resolveLoginIdentity({ google: { name: 'G', email: 'g@x.com' } }, '0xabc', 'metamask'),
    ).toEqual({ provider: 'metamask', name: null });
  });

  it('resolves Google name, else email', () => {
    expect(resolveLoginIdentity({ google: { name: 'G', email: 'g@x.com' } }, '0xabc')).toEqual({
      provider: 'google',
      name: 'G',
    });
    expect(resolveLoginIdentity({ google: { name: null, email: 'g@x.com' } }, '0xabc')).toEqual({
      provider: 'google',
      name: 'g@x.com',
    });
  });

  it('resolves X @username, else name', () => {
    expect(
      resolveLoginIdentity({ twitter: { username: 'outrun', name: 'Outrun' } }, '0xabc'),
    ).toEqual({ provider: 'x', name: '@outrun' });
    expect(resolveLoginIdentity({ twitter: { username: null, name: 'Outrun' } }, '0xabc')).toEqual({
      provider: 'x',
      name: 'Outrun',
    });
  });

  it('falls back to MetaMask for unknown users', () => {
    expect(resolveLoginIdentity(null, '0xabc')).toEqual({ provider: 'metamask', name: null });
  });
});

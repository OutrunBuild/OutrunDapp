// @vitest-environment jsdom
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

import { WalletControl } from '../../components/global/wallet-control';

let centerState: { connected: boolean; sessionRestoring: boolean; connectAction: () => void };
let privyState: { ready: boolean; authenticated: boolean };

// Partial mock: useAccountCenter is state-driven; the rest of the module
// (isPrivyOAuthLanding) must stay real for the direct tests below.
vi.mock('@/components/global/use-account-center', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../components/global/use-account-center')>()),
  useAccountCenter: () => centerState,
}));
vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => privyState,
  useUser: () => ({ user: null }),
  useLogout: () => ({ logout: () => undefined }),
  useWallets: () => ({ wallets: [] }),
}));
vi.mock('wagmi', () => ({ useAccount: () => ({ address: undefined }) }));
vi.mock('@/lib/web3/active-provider', () => ({ isWeb3Configured: () => true }));
vi.mock('@/components/global/wallet-selector-dialog', () => ({
  WalletSelectorHost: () => null,
}));
// AccountPlaceholder must stay real (it is the object under test's rendering);
// AccountMenu is stubbed — its dropdown/dialog tree is out of scope here.
vi.mock('@/components/global/account-menu', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../components/global/account-menu')>()),
  AccountMenu: () => createElement('div', { 'data-testid': 'account-menu' }),
}));

function render(): string {
  return renderToString(createElement(WalletControl, { locale: 'en', address: '0xabc' }));
}

describe('WalletControl placeholder spans the whole session-restore window', () => {
  it('shows the skeleton while Privy boots (!ready)', () => {
    privyState = { ready: false, authenticated: false };
    centerState = { connected: false, sessionRestoring: false, connectAction: () => undefined };
    const html = render();
    expect(html).toContain('data-restoring');
    expect(html).not.toContain('wallet-control__label-full');
  });

  it('keeps the skeleton after ready while the wallet link has not landed — no Login flash', () => {
    privyState = { ready: true, authenticated: true };
    centerState = { connected: false, sessionRestoring: true, connectAction: () => undefined };
    const html = render();
    expect(html).toContain('data-restoring');
    expect(html).not.toContain('wallet-control__label-full');
  });

  it('keeps the skeleton on the OAuth landing gap: ready, callback not yet consumed, no wallet link', () => {
    privyState = { ready: true, authenticated: false };
    centerState = { connected: false, sessionRestoring: true, connectAction: () => undefined };
    const html = render();
    expect(html).toContain('data-restoring');
    expect(html).not.toContain('wallet-control__label-full');
  });

  it('falls back to the Login button once the restore window closes unconnected', () => {
    privyState = { ready: true, authenticated: false };
    centerState = { connected: false, sessionRestoring: false, connectAction: () => undefined };
    const html = render();
    expect(html).toContain('wallet-control__label-full');
    expect(html).not.toContain('data-restoring');
  });

  it('renders the connected menu when the session lands', () => {
    privyState = { ready: true, authenticated: true };
    centerState = { connected: true, sessionRestoring: false, connectAction: () => undefined };
    const html = render();
    expect(html).toContain('data-testid="account-menu"');
  });
});

describe('isPrivyOAuthLanding detects the OAuth-return URL shape', () => {
  it('matches any privy_oauth* query param', async () => {
    const { isPrivyOAuthLanding } = await import('../../components/global/use-account-center');
    expect(isPrivyOAuthLanding('?privy_oauth_code=x&privy_oauth_state=y')).toBe(true);
    expect(isPrivyOAuthLanding('?privy_oauth_state=abc')).toBe(true);
    expect(isPrivyOAuthLanding('?foo=privy_oauth_code')).toBe(false);
    expect(isPrivyOAuthLanding('?a=1&b=2')).toBe(false);
    expect(isPrivyOAuthLanding('')).toBe(false);
  });
});

describe('resolveSessionRestoring spans the pre-authentication refresh gap', () => {
  const base = {
    authenticated: false,
    isConnected: false,
    status: 'disconnected',
    oauthLanding: false,
    storedSession: false,
    restoreWindowClosed: false,
  };

  async function resolve(overrides: Partial<typeof base>): Promise<boolean> {
    const { resolveSessionRestoring } = await import('../../components/global/use-account-center');
    return resolveSessionRestoring({ ...base, ...overrides });
  }

  it('holds the skeleton for the MetaMask path (no Privy auth, persisted wagmi link)', async () => {
    // MetaMask login is plain wagmi: authenticated stays false the whole time, and
    // the persisted connection is what lands. The gate must hold on storedSession
    // alone, before wagmi flips to `reconnecting`.
    expect(
      await resolve({ authenticated: false, status: 'disconnected', storedSession: true }),
    ).toBe(true);
  });

  it('holds for the full 7s budget, not a short pre-auth timer', async () => {
    expect(await resolve({ storedSession: true })).toBe(true);
    expect(await resolve({ storedSession: true, restoreWindowClosed: true })).toBe(false);
  });

  it('never delays a visitor with no persisted wallet session', async () => {
    expect(await resolve({ storedSession: false })).toBe(false);
  });

  it('keeps the full window for authenticated-but-unlinked and wagmi reconnecting', async () => {
    expect(await resolve({ authenticated: true })).toBe(true);
    expect(await resolve({ status: 'reconnecting' })).toBe(true);
    expect(await resolve({ oauthLanding: true })).toBe(true);
  });

  it('degrades to Login after the 7s link budget', async () => {
    expect(await resolve({ authenticated: true, restoreWindowClosed: true })).toBe(false);
  });

  it('never holds once the wallet is connected', async () => {
    expect(await resolve({ isConnected: true, storedSession: true })).toBe(false);
  });
});

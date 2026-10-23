// @vitest-environment jsdom
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';

import { LoginSessionRestore } from '../../components/global/login-session-restore';
import { beginDisconnect, endDisconnect } from '../../lib/web3/disconnect-guard';

// Controllable Privy/wagmi state. The real getEmbeddedConnectedWallet is kept
// (importOriginal spread) so the tests exercise the actual wallet matching,
// not a copy of it.
const hookState = vi.hoisted(() => ({
  ready: true,
  authenticated: true,
  user: {
    id: 'did:privy:abc123',
    google: { name: 'Casey', email: 'casey@example.com' },
  } as unknown,
  address: undefined as string | undefined,
  wallets: [] as unknown[],
  createWallet: vi.fn(),
  setActiveWallet: vi.fn(),
}));

vi.mock('@privy-io/react-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@privy-io/react-auth')>();
  return {
    ...actual,
    useLoginWithOAuth: () => ({}),
    usePrivy: () => ({
      ready: hookState.ready,
      authenticated: hookState.authenticated,
      user: hookState.user,
    }),
    useWallets: () => ({ wallets: hookState.wallets }),
    useCreateWallet: () => ({ createWallet: hookState.createWallet }),
  };
});

vi.mock('@privy-io/wagmi', () => ({
  useSetActiveWallet: () => ({ setActiveWallet: hookState.setActiveWallet }),
}));

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: hookState.address }),
}));

beforeEach(() => {
  hookState.ready = true;
  hookState.authenticated = true;
  hookState.address = undefined;
  hookState.wallets = [];
  hookState.createWallet.mockReset().mockResolvedValue({ address: '0x0' });
  hookState.setActiveWallet.mockReset().mockResolvedValue(undefined);
  // Mirror production: startOAuth wrote the headless marker before navigating away.
  window.localStorage.setItem('privy:headless_oauth', 'true');
  window.localStorage.removeItem('outrun:wallet-link');
  window.sessionStorage.setItem('privy:oauth-rescue', '1');
  window.history.replaceState({}, '', '/');
  endDisconnect();
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
  endDisconnect();
});

describe('LoginSessionRestore (authenticated without embedded wallet)', () => {
  it('creates the embedded wallet so the link step has something to attach', async () => {
    render(createElement(LoginSessionRestore));
    await waitFor(() => expect(hookState.createWallet).toHaveBeenCalledTimes(1));
  });

  it('clears stuck privy_oauth_* params once a session is held', async () => {
    window.history.replaceState(
      {},
      '',
      '/?privy_oauth_state=s&privy_oauth_provider=google&privy_oauth_code=c',
    );
    render(createElement(LoginSessionRestore));
    await waitFor(() => expect(window.location.search).not.toContain('privy_oauth'));
  });

  it('does not re-attach the wallet while an intentional disconnect is in flight', async () => {
    hookState.wallets = [
      { walletClientType: 'privy', connectorType: 'embedded', address: '0x123' },
    ];
    beginDisconnect();
    render(createElement(LoginSessionRestore));
    // Let effects settle; the link must never fire during the flag window.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(hookState.setActiveWallet).not.toHaveBeenCalled();
    expect(hookState.createWallet).not.toHaveBeenCalled();
  });

  it('does not attach the embedded wallet while a MetaMask ownership marker exists', async () => {
    window.localStorage.setItem('outrun:wallet-link', 'metamask');
    hookState.wallets = [
      { walletClientType: 'privy', connectorType: 'embedded', address: '0x123' },
    ];
    render(createElement(LoginSessionRestore));
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(hookState.setActiveWallet).not.toHaveBeenCalled();
  });

  it('retries a transient createWallet failure instead of wedging the page', async () => {
    hookState.createWallet.mockRejectedValueOnce(new Error('flaky'));
    render(createElement(LoginSessionRestore));
    await waitFor(() => expect(hookState.createWallet).toHaveBeenCalledTimes(2), {
      timeout: 4000,
    });
  });

  it('does not create when an embedded wallet already exists', async () => {
    hookState.wallets = [
      { walletClientType: 'privy', connectorType: 'embedded', address: '0x123' },
    ];
    render(createElement(LoginSessionRestore));
    // Let the link effect settle; creation must never fire on this path.
    await waitFor(() => expect(hookState.setActiveWallet).toHaveBeenCalled());
    expect(hookState.createWallet).not.toHaveBeenCalled();
  });
});

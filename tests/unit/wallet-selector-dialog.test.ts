// @vitest-environment jsdom
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';

import { WalletSelectorDialog } from '../../components/global/wallet-selector-dialog';
import { beginDisconnect, endDisconnect, isDisconnecting } from '../../lib/web3/disconnect-guard';

// Controllable Privy/wagmi state for the mid-logout window. The real
// getEmbeddedConnectedWallet is kept (importOriginal spread) so the tests
// exercise the actual wallet matching, not a copy of it.
const hookState = vi.hoisted(() => ({
  authenticated: true,
  user: {
    id: 'did:privy:abc123',
    twitter: { username: 'ralewon', name: 'ralewon' },
  } as unknown,
  address: undefined as string | undefined,
  wallets: [] as unknown[],
  initOAuth: vi.fn(),
  setActiveWallet: vi.fn(),
  connect: vi.fn(),
  onOpenChange: vi.fn(),
}));

vi.mock('@privy-io/react-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@privy-io/react-auth')>();
  return {
    ...actual,
    usePrivy: () => ({ authenticated: hookState.authenticated }),
    useUser: () => ({ user: hookState.user }),
    useWallets: () => ({ wallets: hookState.wallets }),
    useLoginWithOAuth: () => ({
      initOAuth: hookState.initOAuth,
      loading: false,
    }),
  };
});

vi.mock('@privy-io/wagmi', () => ({
  useSetActiveWallet: () => ({ setActiveWallet: hookState.setActiveWallet }),
}));

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: hookState.address }),
  useConnect: () => ({ connect: hookState.connect }),
  injected: () => ({}),
}));

vi.mock('@/lib/web3/active-provider', () => ({ isWeb3Configured: () => true }));

const EMBEDDED = {
  walletClientType: 'privy',
  connectorType: 'embedded',
  address: '0x1234abcd5678',
};

function renderOpen(): void {
  render(
    createElement(WalletSelectorDialog, {
      locale: 'en',
      open: true,
      onOpenChange: hookState.onOpenChange,
    }),
  );
}

beforeEach(() => {
  hookState.authenticated = true;
  hookState.address = undefined;
  hookState.wallets = [];
  hookState.initOAuth.mockReset().mockResolvedValue(undefined);
  hookState.setActiveWallet.mockReset().mockResolvedValue(undefined);
  hookState.connect.mockReset();
  hookState.onOpenChange.mockReset();
  endDisconnect();
});

afterEach(() => {
  cleanup();
  endDisconnect();
  window.history.replaceState({}, '', '/');
  delete (window as { ethereum?: unknown }).ethereum;
});

describe('WalletSelectorDialog MetaMask connect', () => {
  function clickMetamask(): void {
    (window as { ethereum?: unknown }).ethereum = { request: vi.fn() };
    renderOpen();
    fireEvent.click(screen.getByText('Continue with MetaMask'));
  }

  it('connects through the default permission path', () => {
    clickMetamask();
    expect(hookState.connect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('writes no session markers from the connect callback', () => {
    // onSuccess only closes the dialog: link persistence is owned by the
    // account-center effect, so a reintroduced dual-write must fail here.
    hookState.connect.mockImplementation((_config: unknown, opts?: { onSuccess?: () => void }) =>
      opts?.onSuccess?.(),
    );
    window.localStorage.clear();
    clickMetamask();
    expect(window.localStorage.getItem('outrun:wallet-link')).toBeNull();
    expect(window.localStorage.getItem('outrun:last-login')).toBeNull();
  });

  it('closes the dialog when the address lands without a success callback', async () => {
    // Queued -32002 retry path: wagmi can land connected without firing
    // onSuccess, so the dialog must close on address instead of the callback.
    clickMetamask();
    hookState.address = '0x1234abcd5678ef9012345678ef9012345678ef90';
    renderOpen();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(hookState.onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('WalletSelectorDialog mid-logout guard', () => {
  it('does not auto-link the stale embedded wallet while an intentional disconnect is in flight', async () => {
    // Logout flight window: wagmi already disconnected, Privy still holds the
    // X user + embedded wallet, the account menu flagged the intentional
    // disconnect. The dialog must offer the three rows instead of flashing shut.
    hookState.wallets = [EMBEDDED];
    beginDisconnect();
    renderOpen();
    expect(await screen.findByText('Continue with X')).toBeDefined();
    // Let the auto-link effects settle; neither may fire during the flag window.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(hookState.setActiveWallet).not.toHaveBeenCalled();
    expect(hookState.onOpenChange).not.toHaveBeenCalled();
  });

  it('still auto-links a live returning session once the disconnect window clears', async () => {
    hookState.wallets = [EMBEDDED];
    renderOpen();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(hookState.setActiveWallet).toHaveBeenCalledTimes(1);
    expect(hookState.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not auto-link a stale user object once logged out', async () => {
    hookState.authenticated = false;
    hookState.wallets = [EMBEDDED];
    renderOpen();
    expect(await screen.findByText('Continue with X')).toBeDefined();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(hookState.setActiveWallet).not.toHaveBeenCalled();
    expect(hookState.onOpenChange).not.toHaveBeenCalled();
  });

  it('an explicit OAuth click clears the reload stamp but keeps the in-page guard', async () => {
    beginDisconnect();
    renderOpen();
    fireEvent.click(screen.getByText('Continue with X'));
    // The reload stamp is gone so the OAuth return can link, but the current page
    // still blocks the stale wallet from bouncing back before navigation.
    expect(window.sessionStorage.getItem('outrun:disconnecting')).toBeNull();
    expect(isDisconnecting()).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(hookState.setActiveWallet).not.toHaveBeenCalled();
  });

  it('surfaces a storage failure instead of leaving the OAuth row silently dead', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key) => {
      if (key === 'privy:headless_oauth') throw new Error('denied');
    });
    try {
      renderOpen();
      fireEvent.click(screen.getByText('Continue with X'));
      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toContain('Browser storage is unavailable');
      expect(hookState.initOAuth).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('does not auto-link an in-flight OAuth login while an intentional disconnect is in flight', async () => {
    // linkPending path: OAuth started before logout (or re-clicked in the
    // window), wagmi disconnected, the stale session must not re-link.
    hookState.wallets = [EMBEDDED];
    beginDisconnect();
    renderOpen();
    fireEvent.click(screen.getByText('Continue with X'));
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(hookState.setActiveWallet).not.toHaveBeenCalled();
    expect(hookState.onOpenChange).not.toHaveBeenCalled();
  });

  it('does not auto-link an in-flight OAuth login once logged out', async () => {
    hookState.authenticated = false;
    hookState.wallets = [EMBEDDED];
    renderOpen();
    fireEvent.click(screen.getByText('Continue with X'));
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(hookState.setActiveWallet).not.toHaveBeenCalled();
    expect(hookState.onOpenChange).not.toHaveBeenCalled();
  });
});

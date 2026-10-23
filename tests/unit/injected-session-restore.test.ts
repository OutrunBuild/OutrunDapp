// @vitest-environment jsdom
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';

import { InjectedSessionRestore } from '../../components/global/injected-session-restore';
import { beginDisconnect, endDisconnect } from '../../lib/web3/disconnect-guard';

const hookState = vi.hoisted(() => ({
  reconnectAsync: vi.fn().mockResolvedValue([{ accounts: ['0x1'] }]),
  status: 'disconnected' as string,
}));

vi.mock('wagmi', () => ({
  useAccount: () => ({ status: hookState.status }),
  useConfig: () => ({ _internal: { store: { persist: { hasHydrated: () => true } } } }),
  useReconnect: () => ({ reconnectAsync: hookState.reconnectAsync }),
}));
vi.mock('wagmi/connectors', () => ({
  injected: (args: unknown) => ({ args }),
}));
vi.mock('@privy-io/react-auth', () => ({ usePrivy: () => ({ ready: true }) }));

function installEthereum(): void {
  (window as { ethereum?: unknown }).ethereum = { isMetaMask: true, request: vi.fn() };
}

beforeEach(() => {
  window.localStorage.clear();
  delete (window as { ethereum?: unknown }).ethereum;
  hookState.reconnectAsync.mockReset().mockResolvedValue([{ accounts: ['0x1'] }]);
  hookState.status = 'disconnected';
  endDisconnect();
});

afterEach(() => {
  cleanup();
  endDisconnect();
  delete (window as { ethereum?: unknown }).ethereum;
});

describe('InjectedSessionRestore', () => {
  it('restores MetaMask through the isMetaMask fallback without a 6963 announcement', async () => {
    window.localStorage.setItem('outrun:wallet-link', 'metamask');
    installEthereum();
    render(createElement(InjectedSessionRestore));
    await waitFor(() => expect(hookState.reconnectAsync).toHaveBeenCalledTimes(1), {
      timeout: 3000,
    });
    expect(hookState.reconnectAsync.mock.calls[0][0].connectors).toHaveLength(1);
  });

  it('does nothing without the durable wallet-link marker', async () => {
    installEthereum();
    render(createElement(InjectedSessionRestore));
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(hookState.reconnectAsync).not.toHaveBeenCalled();
  });

  it('never reconnects while an intentional disconnect is in flight', async () => {
    window.localStorage.setItem('outrun:wallet-link', 'metamask');
    installEthereum();
    beginDisconnect();
    render(createElement(InjectedSessionRestore));
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(hookState.reconnectAsync).not.toHaveBeenCalled();
  });
});

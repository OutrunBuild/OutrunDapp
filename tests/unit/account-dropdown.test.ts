// @vitest-environment jsdom
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { AccountMenu } from '../../components/global/account-menu';
import { endDisconnect } from '../../lib/web3/disconnect-guard';

// Privy/wagmi state: authenticated Google user with an embedded wallet linked.
const hookState = vi.hoisted(() => ({
  user: {
    id: 'did:privy:abc123',
    google: { name: 'Casey', email: 'casey@example.com' },
  } as unknown,
  wallets: [
    { walletClientType: 'privy', connectorType: 'embedded', address: '0x1234abcd5678' },
  ] as unknown[],
  connections: [{ connector: { id: 'io.privy.wallet.0x1234abcd5678' } }] as unknown[],
  disconnectAsync: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn().mockResolvedValue(undefined),
  exportWallet: vi.fn().mockResolvedValue(undefined),
  authenticated: true,
}));

vi.mock('@privy-io/react-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@privy-io/react-auth')>();
  return {
    ...actual,
    usePrivy: () => ({ user: hookState.user, authenticated: hookState.authenticated }),
    useWallets: () => ({ wallets: hookState.wallets }),
    useDisconnect: () => ({ disconnectAsync: hookState.disconnectAsync }),
    useLogout: () => ({ logout: hookState.logout }),
    useExportWallet: () => ({ exportWallet: hookState.exportWallet }),
  };
});

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: '0x1234abcd5678' }),
  useConnections: () => hookState.connections,
  useDisconnect: () => ({ disconnectAsync: hookState.disconnectAsync }),
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  hookState.disconnectAsync.mockReset().mockResolvedValue(undefined);
  hookState.logout.mockReset().mockResolvedValue(undefined);
  hookState.connections = [{ connector: { id: 'io.privy.wallet.0x1234abcd5678' } }] as unknown[];
  hookState.authenticated = true;
  window.localStorage.removeItem('outrun:last-login');
  window.localStorage.removeItem('outrun:wallet-link');
  endDisconnect();
});

describe('AccountMenu (connected account dropdown)', () => {
  it('trigger shows the login identity, menu opens on click', async () => {
    render(createElement(AccountMenu, { locale: 'en', display: 'Casey' }));
    fireEvent.click(screen.getByRole('button', { name: 'Casey' }));
    expect(await screen.findByRole('menuitem', { name: 'Account' })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: 'Portfolio' })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: 'Disconnect' })).toBeDefined();
  });

  it('Account opens the account dialog with username + full address + export', async () => {
    render(createElement(AccountMenu, { locale: 'en', display: 'Casey' }));
    fireEvent.click(screen.getByRole('button', { name: 'Casey' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Account/ }));
    const dialog = await screen.findByRole('dialog');
    // Username section label + name, wallet group, backup button without title.
    expect(dialog.textContent).toContain('Username');
    expect(dialog.textContent).toContain('Casey');
    // X handle renders without the @ prefix.
    expect(dialog.textContent).not.toContain('@');
    const groupsNow = Array.from(
      dialog.querySelectorAll('[data-testid="account-dialog-group"]'),
    ).map((el) => el.getAttribute('data-group'));
    expect(groupsNow).toEqual(['wallet', 'backup']);
    expect(dialog.querySelector('[data-group="backup"]')!.textContent).not.toContain('Backup');
    // Full address, no truncation, no box.
    expect(dialog.textContent).toContain('0x1234abcd5678');
    expect(dialog.textContent).not.toContain('\u2026');
    const copyBtn = dialog.querySelector('.token-strip__copy');
    expect(copyBtn?.getAttribute('title')).toBe('0x1234abcd5678');
    expect(dialog.textContent).toContain('Export wallet');
  });

  it('account dialog groups wallet address and backup under section labels', async () => {
    render(createElement(AccountMenu, { locale: 'en', display: 'Casey' }));
    fireEvent.click(screen.getByRole('button', { name: 'Casey' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Account/ }));
    const dialog = await screen.findByRole('dialog');
    // Group labels: wallet address group + backup group, wallet first.
    const groups = Array.from(dialog.querySelectorAll('[data-testid="account-dialog-group"]')).map(
      (el) => el.getAttribute('data-group'),
    );
    expect(groups).toEqual(['wallet', 'backup']);
    expect(screen.getByText('Wallet')).toBeDefined();
  });

  it('menu lists actions left-aligned with no identity header', async () => {
    render(createElement(AccountMenu, { locale: 'en', display: 'Casey' }));
    fireEvent.click(screen.getByRole('button', { name: 'Casey' }));
    const menu = await screen.findByTestId('account-menu');
    // No identity header, no username/email in the menu itself ...
    expect(menu.querySelector('[data-testid="account-menu-identity"]')).toBeNull();
    expect(menu.textContent).not.toContain('casey@example.com');
    // ... three left-aligned action rows.
    expect(menu.querySelectorAll('.account-menu__item').length).toBe(3);
  });

  it('action rows carry icons and disconnect is the danger row', async () => {
    render(createElement(AccountMenu, { locale: 'en', display: 'Casey' }));
    fireEvent.click(screen.getByRole('button', { name: 'Casey' }));
    const menu = await screen.findByTestId('account-menu');
    // Every action row has an icon.
    for (const name of ['Account', 'Portfolio', 'Disconnect']) {
      const row = await screen.findByRole('menuitem', { name: new RegExp(name) });
      expect(row.querySelector('svg')).not.toBeNull();
    }
    // Disconnect is the danger row.
    const danger = menu.querySelector('[data-tone="danger"]');
    expect(danger).not.toBeNull();
    expect(danger!.textContent).toContain('Disconnect');
  });

  it('X handle renders without the @ prefix', async () => {
    hookState.user = {
      id: 'did:privy:xyz789',
      twitter: { username: 'ralewon', name: 'ralewon' },
    } as unknown;
    render(createElement(AccountMenu, { locale: 'en', display: 'ralewon' }));
    fireEvent.click(screen.getByRole('button', { name: 'ralewon' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Account/ }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('ralewon');
    expect(dialog.textContent).not.toContain('@ralewon');
    // Restore the Google mock for the remaining tests.
    hookState.user = {
      id: 'did:privy:abc123',
      google: { name: 'Casey', email: 'casey@example.com' },
    } as unknown;
  });

  it('ignores a lingering Privy user once the session is logged out', () => {
    // The user object can outlive the session for a beat; a MetaMask login right
    // after logout must not be labelled with the previous social handle.
    hookState.authenticated = false;
    render(createElement(AccountMenu, { locale: 'en', display: 'Casey' }));
    const trigger = screen.getByRole('button');
    expect(trigger.getAttribute('aria-label')).not.toContain('Casey');
    expect(trigger.getAttribute('aria-label')).toContain('0x1234');
  });

  it('a MetaMask-only exit skips Privy logout and clears the wallet link', async () => {
    hookState.authenticated = false;
    window.localStorage.setItem('outrun:wallet-link', 'metamask');
    render(createElement(AccountMenu, { locale: 'en', display: 'Casey' }));
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Disconnect/ }));
    await waitFor(() => expect(hookState.disconnectAsync).toHaveBeenCalledTimes(1));
    // No Privy session to revoke: /sessions/logout would return 400.
    expect(hookState.logout).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('outrun:wallet-link')).toBeNull();
  });

  it('Disconnect calls disconnect + logout', async () => {
    render(createElement(AccountMenu, { locale: 'en', display: 'Casey' }));
    fireEvent.click(screen.getByRole('button', { name: 'Casey' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Disconnect/ }));
    expect(hookState.disconnectAsync).toHaveBeenCalledTimes(1);
    expect(hookState.disconnectAsync).toHaveBeenCalledWith({
      connector: { id: 'io.privy.wallet.0x1234abcd5678' },
    });
    await waitFor(() => expect(hookState.logout).toHaveBeenCalledTimes(1));
  });

  it('Disconnect clears the last-login badge so logout exits the social path', async () => {
    window.localStorage.setItem('outrun:last-login', 'x');
    render(createElement(AccountMenu, { locale: 'en', display: 'Casey' }));
    fireEvent.click(screen.getByRole('button', { name: 'Casey' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Disconnect/ }));
    expect(window.localStorage.getItem('outrun:last-login')).toBeNull();
  });

  it('Disconnect waits for every live connection before logout', async () => {
    const second = { id: 'io.metamask' };
    hookState.connections = [
      { connector: { id: 'io.privy.wallet.0x1234abcd5678' } },
      { connector: second },
    ] as unknown[];
    const order: string[] = [];
    hookState.disconnectAsync.mockImplementation(() => {
      order.push('disconnect');
      return Promise.resolve(undefined);
    });
    hookState.logout.mockImplementation(() => {
      order.push('logout');
      return Promise.resolve(undefined);
    });
    render(createElement(AccountMenu, { locale: 'en', display: 'Casey' }));
    fireEvent.click(screen.getByRole('button', { name: 'Casey' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Disconnect/ }));
    await waitFor(() => expect(hookState.logout).toHaveBeenCalledTimes(1));
    expect(hookState.disconnectAsync).toHaveBeenCalledTimes(2);
    expect(hookState.disconnectAsync).toHaveBeenCalledWith({ connector: second });
    expect(order).toEqual(['disconnect', 'disconnect', 'logout']);
    hookState.connections = [{ connector: { id: 'io.privy.wallet.0x1234abcd5678' } }] as unknown[];
  });

  it('Disconnect keeps the guard when logout rejects (stale session must not re-link)', async () => {
    hookState.logout.mockRejectedValueOnce(new Error('logout down'));
    render(createElement(AccountMenu, { locale: 'en', display: 'Casey' }));
    fireEvent.click(screen.getByRole('button', { name: 'Casey' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Disconnect/ }));
    await waitFor(() => expect(hookState.logout).toHaveBeenCalledTimes(1));
    // The rejection is absorbed, but the Privy session is still live: releasing
    // the guard here would let the auto-link effects attach the old wallet again.
    expect(window.sessionStorage.getItem('outrun:disconnecting')).not.toBeNull();
  });
});

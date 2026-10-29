// @vitest-environment jsdom
import { cloneElement, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { ChainSelectorDialog } from '../../components/global/chain-selector-dialog';
import type { ChainInfo } from '@/lib/data/fixture-repository';

const center = vi.hoisted(() => ({
  source: 'real' as 'real' | 'harness',
  connected: false,
  sessionRestoring: false,
  chainId: null as number | null,
  connectAction: vi.fn(),
  switchChainAction: vi.fn().mockResolvedValue(true),
  switchChainError: null as string | null,
  clearSwitchChainError: vi.fn(),
}));

vi.mock('@/components/global/use-account-center', () => ({
  useAccountCenter: () => center,
}));

// The ui/dialog primitive is base-ui (portal + focus trap); the selector's own
// contract under test is which action a click dispatches, so the shell is a
// pass-through that always renders the list. Trigger props (className, data-*)
// land on the rendered element, matching the real primitive.
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => children,
  DialogTrigger: ({ render, ...rest }: { render: React.ReactElement } & Record<string, unknown>) =>
    cloneElement(render, rest as Record<string, unknown>),
  DialogContent: ({ children }: { children: React.ReactNode }) => children,
  DialogTitle: ({ children }: { children: React.ReactNode }) => children,
}));

const chains = [
  { chainId: 97, name: 'BNB Smart Chain Testnet' },
  { chainId: 84532, name: 'Base Sepolia' },
] as unknown as ChainInfo[];

function clickChain(name: string): void {
  fireEvent.click(screen.getByRole('button', { name }));
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  center.source = 'real';
  center.connected = false;
  center.sessionRestoring = false;
  center.chainId = null;
  center.connectAction.mockClear();
  center.switchChainAction.mockClear().mockResolvedValue(true);
});

describe('ChainSelectorDialog disconnected gate', () => {
  it('opens the connect entry instead of a wallet RPC when disconnected', () => {
    render(createElement(ChainSelectorDialog, { locale: 'en', chains }));
    clickChain('Base Sepolia');

    expect(center.connectAction).toHaveBeenCalledTimes(1);
    // wagmi resolves switchChain without any wallet call while disconnected, so
    // dispatching it here is what produced the fake success.
    expect(center.switchChainAction).not.toHaveBeenCalled();
  });

  it('switches the wallet chain when connected', async () => {
    center.connected = true;
    render(createElement(ChainSelectorDialog, { locale: 'en', chains }));
    clickChain('Base Sepolia');

    expect(center.switchChainAction).toHaveBeenCalledWith(84532);
    expect(center.connectAction).not.toHaveBeenCalled();
  });

  it('dispatches nothing while a session is still restoring', () => {
    center.sessionRestoring = true;
    render(createElement(ChainSelectorDialog, { locale: 'en', chains }));
    clickChain('Base Sepolia');

    // A connection is about to land: neither a login dialog over it nor a
    // switch that would resolve without a wallet.
    expect(center.connectAction).not.toHaveBeenCalled();
    expect(center.switchChainAction).not.toHaveBeenCalled();
  });

  it('keeps the harness switch path (its chain moves without a wallet)', () => {
    center.source = 'harness';
    render(createElement(ChainSelectorDialog, { locale: 'en', chains }));
    clickChain('Base Sepolia');

    expect(center.switchChainAction).toHaveBeenCalledWith(84532);
    expect(center.connectAction).not.toHaveBeenCalled();
  });
});

describe('ChainSelectorDialog wrong-network state (state-matrix A8)', () => {
  it('warns and names the real chain when the wallet sits outside the offered set', () => {
    // Ethereum mainnet: in the six-chain registry, off the testnet list.
    center.connected = true;
    center.chainId = 1;
    render(createElement(ChainSelectorDialog, { locale: 'en', chains }));

    const trigger = screen.getByRole('button', { name: 'Ethereum' });
    expect(trigger.getAttribute('data-warning')).toBe('true');
    // The contrast note, not a chain the wallet is not on.
    expect(screen.getByText('Unsupported Network')).toBeTruthy();
    expect(screen.getByText('Write actions are disabled on this network.')).toBeTruthy();
  });

  it('falls back to the wrong-network label for chains the registry does not know', () => {
    center.connected = true;
    center.chainId = 137;
    render(createElement(ChainSelectorDialog, { locale: 'en', chains }));

    const trigger = screen.getByRole('button', { name: 'Unsupported Network' });
    expect(trigger.getAttribute('data-warning')).toBe('true');
    // Trigger label + notice title share the copy key.
    expect(screen.getAllByText('Unsupported Network')).toHaveLength(2);
  });

  it('keeps the plain trigger while the wallet is on a listed chain', () => {
    center.connected = true;
    center.chainId = 84532;
    render(createElement(ChainSelectorDialog, { locale: 'en', chains }));

    expect(document.querySelector('[data-warning="true"]')).toBeNull();
    expect(screen.queryByText('Unsupported Network')).toBeNull();
  });

  it('keeps the fixture pixel contract: the harness id never warns', () => {
    // The harness default (11155111) sits outside the set on purpose — the shell
    // falls back to chains[0] for display so e2e baselines stay byte-identical.
    center.source = 'harness';
    center.connected = true;
    center.chainId = 11155111;
    render(createElement(ChainSelectorDialog, { locale: 'en', chains }));

    expect(document.querySelector('[data-warning="true"]')).toBeNull();
    expect(screen.queryByText('Unsupported Network')).toBeNull();
    // Trigger and list option share the fallback name.
    expect(screen.getAllByRole('button', { name: 'BNB Smart Chain Testnet' })).toHaveLength(2);
  });
});

// @vitest-environment jsdom
// SwitchChainCta routing matrix (B3-ADJ-P3-016 fix): a wallet rejection must END the
// flow — the wagmi fallback would re-issue the same wallet_switchEthereumChain against
// the same provider and pop the prompt a second time. Only outcomes where the direct
// call cannot complete (unsupported/no-provider) still fall back, and only a clean
// switch (plus the fallback handoff) fires the success callback.
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { SwitchChainCta } from '../../components/global/switch-chain-cta';

const switchProviderChain = vi.hoisted(() => vi.fn());

vi.mock('@/lib/web3/active-provider', () => ({ switchProviderChain }));

function renderCta(onSwitch: (chainId: number) => void, onSwitched: () => void) {
  render(
    createElement(SwitchChainCta, {
      locale: 'en',
      execChain: 97,
      chainName: 'BNB Smart Chain',
      onSwitch,
      onSwitched,
    }),
  );
  return screen.getByRole('button');
}

afterEach(() => {
  cleanup();
  switchProviderChain.mockReset();
});

describe('SwitchChainCta routing', () => {
  it('a rejected switch ends the flow: no wagmi re-prompt, no success handoff', async () => {
    switchProviderChain.mockResolvedValue('rejected');
    const onSwitch = vi.fn();
    const onSwitched = vi.fn();
    renderCta(onSwitch, onSwitched);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(switchProviderChain).toHaveBeenCalledWith(97));
    expect(onSwitch).not.toHaveBeenCalled();
    expect(onSwitched).not.toHaveBeenCalled();
  });

  it('a completed switch fires only the success handoff', async () => {
    switchProviderChain.mockResolvedValue('switched');
    const onSwitch = vi.fn();
    const onSwitched = vi.fn();
    renderCta(onSwitch, onSwitched);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(onSwitched).toHaveBeenCalledTimes(1));
    expect(onSwitch).not.toHaveBeenCalled();
  });

  it.each(['unsupported', 'no-provider'] as const)(
    'a %s direct outcome still falls back to the wagmi path',
    async (result) => {
      switchProviderChain.mockResolvedValue(result);
      const onSwitch = vi.fn();
      const onSwitched = vi.fn();
      renderCta(onSwitch, onSwitched);
      fireEvent.click(screen.getByRole('button'));
      await waitFor(() => expect(onSwitch).toHaveBeenCalledTimes(1));
      expect(onSwitch).toHaveBeenCalledWith(97);
      expect(onSwitched).toHaveBeenCalledTimes(1);
    },
  );
});

// End-genesis CTA pending label: before the deadline the button shows the countdown,
// not the action text (the stats card no longer carries a deadline row). Rendered on the
// server so the suites below need no provider: Date.now is the only clock.
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

import { EndGenesisButton } from '../../components/verse/end-genesis-button';

vi.mock('@/components/global/use-account-center', () => ({
  useAccountCenter: () => ({
    source: 'harness',
    connected: false,
    address: null,
    chainId: null,
    connectAction: () => undefined,
    switchChainAction: async () => false,
  }),
}));
vi.mock('@/components/global/use-tx-center', () => ({
  useTxCenter: () => ({ running: false, active: false, display: 'idle', reset: () => undefined }),
}));
vi.mock('@/lib/web3/active-provider', () => ({
  getActiveEip1193Provider: () => null,
  useActiveEip1193Provider: () => null,
}));

const BASE = {
  locale: 'en',
  verseIdParam: '21',
  governanceChain: 56,
  governanceChainName: 'BNB Smart Chain',
  deployedChainIds: null,
  fastGenesis: false,
  thresholdMet: false,
} as const;

function render(endsAt: string): string {
  return renderToString(createElement(EndGenesisButton, { ...BASE, endsAt }));
}

describe('EndGenesisButton pending label', () => {
  it('shows the countdown while the deadline is pending', () => {
    const html = render(
      new Date(Date.now() + 2 * 86_400_000 + 4 * 3_600_000 + 60_000).toISOString(),
    );
    expect(html).toContain('Advance in 2d 4h');
    // gated ⇒ outcome still open ⇒ generic hover explanation
    expect(html).toContain('title="Advance to the next stage"');
  });

  it('past the deadline unmet: plain label names the Refund stage', () => {
    const html = render(new Date(Date.now() - 1_000).toISOString());
    expect(html).not.toContain('Advance in');
    expect(html).toContain('Enter Refund');
  });

  it('Fast with a threshold met shows the Locked stage even before the deadline', () => {
    const html = renderToString(
      createElement(EndGenesisButton, {
        ...BASE,
        fastGenesis: true,
        thresholdMet: true,
        endsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
      }),
    );
    expect(html).not.toContain('Advance in');
    expect(html).toContain('Enter Locked');
  });
});

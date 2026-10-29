// End-genesis CTA pending label: before the deadline the button shows the countdown,
// not the action text (the stats card no longer carries a deadline row). Rendered on the
// server so the suites below need no provider: the page's RSC supplies the clock.
// The clock is pinned to a fixed instant, so these cases fail if the component goes back to
// reading its own wall clock instead of the server-supplied initialNow.
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

/** Fixed server render clock — decoupled from the wall clock so the assertions pin the source. */
const NOW = Date.parse('2026-01-01T00:00:00Z');

const BASE = {
  locale: 'en',
  verseIdParam: '21',
  governanceChain: 56,
  governanceChainName: 'BNB Smart Chain',
  deployedChainIds: null,
  fastGenesis: false,
  thresholdMet: false,
  // Server render clock, wired by the page's RSC (verse-page.tsx); the component never reads
  // its own clock before mount.
  initialNow: NOW,
} as const;

function render(endsAt: string | null): string {
  return renderToString(createElement(EndGenesisButton, { ...BASE, endsAt }));
}

describe('EndGenesisButton pending label', () => {
  it('shows the countdown while the deadline is pending', () => {
    const html = render(new Date(NOW + 2 * 86_400_000 + 4 * 3_600_000 + 60_000).toISOString());
    expect(html).toContain('Advance in 2d 4h');
    // gated ⇒ outcome still open ⇒ generic hover explanation
    expect(html).toContain('title="Advance to the Next Stage"');
  });

  it('past the deadline unmet: plain label names the Refund stage', () => {
    const html = render(new Date(NOW - 1_000).toISOString());
    expect(html).not.toContain('Advance in');
    expect(html).toContain('Enter Refund');
  });

  it('Fast with a threshold met shows the Locked stage even before the deadline', () => {
    const html = renderToString(
      createElement(EndGenesisButton, {
        ...BASE,
        fastGenesis: true,
        thresholdMet: true,
        endsAt: new Date(NOW + 2 * 86_400_000).toISOString(),
      }),
    );
    expect(html).not.toContain('Advance in');
    expect(html).toContain('Enter Locked');
  });

  it('an unrepresentable deadline renders without a countdown (on-chain gate decides)', () => {
    const html = render(null);
    expect(html).not.toContain('Advance in');
    expect(html).toContain('Enter Refund');
  });
});

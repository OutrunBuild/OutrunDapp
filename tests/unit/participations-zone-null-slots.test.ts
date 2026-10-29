// Null-slot degradation for the participation row date lines (B2-ADJ-P3-007): a locked row
// shows the projected-unlock subline only while the source timestamp is representable — a
// dirty timestamp (null slot) drops the subline and the ends-on note instead of rendering a
// broken date. The dated sibling in the same render proves the subline/note path itself is
// alive, so the absence assertions cannot pass trivially.
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

import { ParticipationsZone } from '../../components/portfolio/participations-zone';
import type { ParticipationRow } from '../../lib/data/fixture-repository';

// harness source keeps the zone on the SSR sample rows (no live scan on the server)
vi.mock('@/components/global/use-account-center', () => ({
  useAccountCenter: () => ({ source: 'harness', connected: false, address: null, chainId: null }),
}));
vi.mock('@/components/global/wallet-provider-reader', () => ({
  useWalletProviderReader: () => null,
}));

function head(overrides: Partial<ParticipationRow['verse']> = {}): ParticipationRow['verse'] {
  return {
    id: 'verse-901',
    symbol: 'NSLT',
    name: 'NullSlotTest',
    stage: 'locked',
    raiseAsset: 'POL',
    endsAt: '2026-06-01T00:00:00Z',
    unlockAt: '2027-06-01T00:00:00Z',
    unlockedAt: null,
    ...overrides,
  };
}

function row(verse: ParticipationRow['verse']): ParticipationRow {
  return { verse, genesis: null, holdings: null };
}

describe('ParticipationsZone date null slots', () => {
  it('locked row with an unrepresentable unlockAt drops the date subline; the dated row keeps it', () => {
    const html = renderToString(
      createElement(ParticipationsZone, {
        locale: 'en',
        rows: [
          row(head({ id: 'verse-902', unlockAt: null, endsAt: null })),
          row(head({ id: 'verse-903' })),
        ],
        candidates: [],
      }),
    );
    expect(html).toContain('pf-participation-row');
    // The dated row renders its subline and its ends-on note (exactly once each)…
    expect(html.split('pf-participation-row__date').length - 1).toBe(1);
    expect(html.split('pf-participation-row__note').length - 1).toBe(1);
    // …so the null-slot row is the reason neither appears twice.
  });
});

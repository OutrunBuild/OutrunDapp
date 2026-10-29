// DAO cycle null slots (B2-ADJ-P3-007): the settle banner renders only when the cycle end
// time has actually passed AND is representable — a dirty index row (cycleEndsAt=null) keeps
// it down, and an unreadable subgraph (finalized=null) degrades the cycle chip to "--"
// instead of masquerading as "not finalized" (GovernanceState field notes in
// fixture-repository). The passed-representable contrast case proves the banner path is alive.
// The future-date leg (finalized=false, cycleEndsAt ahead — B2-ADJ-P3-042) pins the
// "Ends on" chip branch the contrast cases alone leave unpinned.
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';

import { DaoPanel } from '../../components/verse/verse-tab-panels';
import type { GovernanceState } from '../../lib/data/fixture-repository';
import { getSnapshot } from '../../lib/data/fixture-repository';

const verse = getSnapshot().verses[0]!;

// Null-state base: every optional slot unreadable, so the render carries the heading, the
// tally card and the cycle card skeleton only — exactly the scaffold the null slots sit in.
const GOV_NULL: GovernanceState = {
  cycleNumber: '3',
  cycleDurationDays: 14,
  cycleEndsAt: null,
  finalized: null,
  claimWindowEndsAt: null,
  governorAddress: null,
  incentivizerAddress: null,
  delegates: null,
  totalVotingPower: null,
  myVotes: null,
  treasuryUAsset: null,
  rewardRatioBps: null,
  cumulativeIncentivePool: null,
  treasuryAssets: null,
  currentCycleVotes: null,
  estimatedClaimable: null,
  lastCycle: null,
  proposalCount: null,
};

function gov(overrides: Partial<GovernanceState>): GovernanceState {
  return { ...GOV_NULL, ...overrides };
}

function renderPanel(governance: GovernanceState): string {
  return renderToString(createElement(DaoPanel, { locale: 'en', verse, governance }));
}

describe('DaoPanel cycle null slots', () => {
  it('finalized=false with an unrepresentable cycleEndsAt keeps the settle banner down', () => {
    const html = renderPanel(gov({ finalized: false, cycleEndsAt: null }));
    expect(html).toContain('dao-panel');
    expect(html).toContain('cycle-card');
    // not-finalized over no-date renders the '--' leg of the chip ternary
    const text = html.replace(/<!--[\s\S]*?-->/g, '');
    expect(text).toContain('(--)');
    expect(html).not.toContain('cycle-card__settle');
  });

  it('settle banner does render for a passed, representable end time (contrast)', () => {
    const html = renderPanel(gov({ finalized: false, cycleEndsAt: '2026-01-01T00:00:00Z' }));
    expect(html).toContain('cycle-card__settle');
  });

  it('finalized=null over a passed, representable cycleEndsAt keeps the chip at -- and the banner down', () => {
    // The mixed state is the discriminating one (finalized: subgraph; cycleEndsAt: index
    // row): a regression treating null as "not finalized" flips the chip to "Ends in …" AND
    // raises the banner — both assertions catch it.
    const html = renderPanel(gov({ cycleEndsAt: '2026-01-01T00:00:00Z' }));
    const text = html.replace(/<!--[\s\S]*?-->/g, '');
    expect(text).toContain('(--)');
    expect(html).not.toContain('cycle-card__settle');
  });

  it('finalized=false over a far-future cycleEndsAt renders the Ends-on chip leg, banner stays down', () => {
    // Far-future literal: the banner guard compares against Date.now(), so a near-future
    // date decays into a false-red once the clock passes it.
    const html = renderPanel(gov({ finalized: false, cycleEndsAt: '2099-01-01T00:00:00Z' }));
    const text = html.replace(/<!--[\s\S]*?-->/g, '');
    expect(text).toContain('Ends on');
    expect(text).toContain('2099');
    expect(text).not.toContain('(--)');
    expect(html).not.toContain('cycle-card__settle');
  });

  it('finalized=true renders the ended chip leg even with an unrepresentable end time', () => {
    // cycleEndsAt stays null: an impl that wrongly gates "Ended" on a past end time would
    // fall back to the '--' leg and fail the assertions below.
    const html = renderPanel(gov({ finalized: true }));
    const text = html.replace(/<!--[\s\S]*?-->/g, '');
    expect(text).toContain('Ended');
    expect(text).not.toContain('(--)');
    expect(html).not.toContain('cycle-card__settle');
  });
});

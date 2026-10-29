// Null-slot degradation for the economy-card date facts (B2-ADJ-P3-007): a dirty source
// timestamp beyond the JS Date range arrives as a null slot and degrades its own dd to the
// shared "unavailable" copy — never "Invalid Date" or a fabricated stamp. The fixtures carry
// no null rows, so the null paths are forced here by spread-overriding a snapshot row.
// The signal/facts slots (B2-ADJ-P3-042) pin the same degradation for the card's non-date
// null ternaries.
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';

import { EconomyCard } from '../../components/discovery/economy-card';
import { getCopy } from '../../components/global/copy';
import { getSnapshot } from '../../lib/data/fixture-repository';

const copy = getCopy('en');
const verses = getSnapshot().verses;

function renderCard(verse: (typeof verses)[number]): string {
  // deployedChainIds: null keeps the chain Tooltip set empty — unit scope is the date facts,
  // not the tooltip primitive.
  return renderToString(
    createElement(EconomyCard, { locale: 'en', verse, chains: [], onOpen: () => undefined }),
  );
}

describe('EconomyCard date null slots degrade to the unavailable copy', () => {
  it('locked card: unrepresentable unlockTimeAt degrades the unlock-time dd', () => {
    const locked = verses.find((verse) => verse.stage === 'locked');
    expect(locked).toBeDefined();
    const html = renderCard({ ...locked!, unlockTimeAt: null, deployedChainIds: null });
    expect(html).toContain(copy.discovery.unlockTime);
    // The bare <dd> anchors THIS slot: every other null slot on the card keeps its
    // data-numeric attribute, so fixture drift cannot satisfy the assertion for it.
    expect(html).toContain(`<dd>${copy.discovery.unavailable}</dd>`);
    expect(html).not.toContain('UTC+8');
  });

  it('genesis card: unrepresentable endsAt degrades the genesis-endtime dd', () => {
    const genesis = verses.find((verse) => verse.stage === 'genesis');
    expect(genesis).toBeDefined();
    const html = renderCard({ ...genesis!, endsAt: null, deployedChainIds: null });
    expect(html).toContain(copy.discovery.genesisEndtime);
    expect(html).toContain(`<dd>${copy.discovery.unavailable}</dd>`);
    expect(html).not.toContain('UTC+8');
  });
});

describe('EconomyCard signal/facts null slots degrade to the unavailable copy', () => {
  it('locked card: null stakingApy degrades the apy slot', () => {
    const locked = verses.find((verse) => verse.stage === 'locked');
    expect(locked).toBeDefined();
    // The bare <b> anchors THIS slot: volume24h is pinned non-null by an explicit sentinel
    // (its own null fallback renders the same bare <b>); the other <b> siblings keep
    // data-numeric unconditionally.
    const html = renderCard({
      ...locked!,
      stakingApy: null,
      volume24h: 1_000_000,
      deployedChainIds: null,
    });
    expect(html).toContain(copy.discovery.stakingApy);
    expect(html).toContain(`<b>${copy.discovery.unavailable}</b>`);
  });

  it('locked card: null volume24h degrades the 24h-volume slot', () => {
    const locked = verses.find((verse) => verse.stage === 'locked');
    expect(locked).toBeDefined();
    const html = renderCard({
      ...locked!,
      stakingApy: 5,
      volume24h: null,
      deployedChainIds: null,
    });
    expect(html).toContain(copy.discovery.volume24h);
    expect(html).toContain(`<b>${copy.discovery.unavailable}</b>`);
  });

  it('locked card: null treasuryFundUsd degrades the treasury dd', () => {
    const locked = verses.find((verse) => verse.stage === 'locked');
    expect(locked).toBeDefined();
    const html = renderCard({ ...locked!, treasuryFundUsd: null, deployedChainIds: null });
    expect(html).toContain(copy.discovery.treasuryFund);
    // Unlike the date slots, this dd keeps data-numeric on the degraded copy — the
    // data-numeric + bare-copy pair anchors THIS dd on the locked card.
    expect(html).toContain(`<dd data-numeric="true">${copy.discovery.unavailable}</dd>`);
  });

  it('genesis card: null omniRaised degrades the raised dd', () => {
    const genesis = verses.find((verse) => verse.stage === 'genesis');
    expect(genesis).toBeDefined();
    const html = renderCard({
      ...genesis!,
      omniRaised: null,
      // Pinned non-null so the bare <dd> below anchors ONLY the omniRaised slot
      endsAt: '2027-01-15T00:00:00Z',
      deployedChainIds: null,
    });
    expect(html).toContain(copy.discovery.omniRaised);
    expect(html).toContain(`<dd>${copy.discovery.unavailable}</dd>`);
  });
});

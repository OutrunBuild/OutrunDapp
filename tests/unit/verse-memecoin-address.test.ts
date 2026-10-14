// Memecoin CA and discovery-page address search semantics (the discovery
// search placeholder promises "address" search, so deployed verses must all
// carry a findable CA):
// deployed = locked/unlocked (same standard as fixture-repository
// deployedVerseCount; contracts deploy only after genesis succeeds);
// search = name/symbol/CA on one path (trim + lowercase + substring match);
// on-chain contract addresses are unique by nature.
import { describe, expect, it } from 'vitest';

import { getFixtureSnapshot } from '../../lib/data/fixture-repository';

describe('Verse memecoin CA: address-search data contract', () => {
  const verses = getFixtureSnapshot().verses;
  const deployed = verses.filter((verse) => verse.stage === 'locked' || verse.stage === 'unlocked');

  it('deployed verses (locked/unlocked) all carry a CA — address search never misses the deployed surface', () => {
    expect(deployed.length).toBeGreaterThan(0);
    for (const verse of deployed) {
      expect(verse.memecoinAddress, `${verse.id} missing tokenStats`).toMatch(
        /^0x[0-9a-fA-F]{40}$/,
      );
    }
  });

  it('undeployed verses (genesis/refund) have CA=null — no contract to find before genesis succeeds', () => {
    for (const verse of verses.filter(
      (verse) => verse.stage === 'genesis' || verse.stage === 'refund',
    )) {
      expect(verse.memecoinAddress, `${verse.id} must not have a CA`).toBeNull();
    }
  });

  // Regression: verse-002/003 once shared an address.
  it('CAs globally unique (on-chain addresses are unique by nature)', () => {
    const addresses = deployed.map((verse) => verse.memecoinAddress);
    expect(new Set(addresses).size).toBe(addresses.length);
  });

  it('case-insensitive matching: any case slicing of a sample CA works as a search term', () => {
    const verse = deployed[0];
    const address = verse.memecoinAddress!;
    const slice = address.slice(2, 12);
    // Mirrors the component filter's normalization (trim + lowercase substring match)
    const hit = (query: string) =>
      verses.some((v) => v.memecoinAddress?.toLowerCase().includes(query.trim().toLowerCase()));
    expect(hit(slice.toUpperCase())).toBe(true);
    expect(hit(address)).toBe(true);
  });
});

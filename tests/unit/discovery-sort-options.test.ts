// Switching stage tabs must normalize sort legality — locked↔unlocked
// shared options are kept; cross-genesis (sort-set intersection is only
// createtime) and illegal values fall back to createtime
import { describe, expect, it } from 'vitest';

import { getFixtureSnapshot } from '../../lib/data/fixture-repository';
import {
  SORT_OPTIONS_BY_STAGE,
  legalSortForStage,
  sortVerses,
} from '../../components/discovery/sort-options';

describe('legalSortForStage', () => {
  it('legal for the target stage is kept (locked<->unlocked shared options survive)', () => {
    expect(legalSortForStage('unlocked', 'marketcap')).toBe('marketcap');
    expect(legalSortForStage('unlocked', 'volume')).toBe('volume');
    expect(legalSortForStage('locked', 'treasury')).toBe('treasury');
    expect(legalSortForStage('genesis', 'endtime')).toBe('endtime');
  });

  it('illegal for the target stage falls back to createtime (crossing genesis always downgrades)', () => {
    expect(legalSortForStage('locked', 'endtime')).toBe('createtime');
    expect(legalSortForStage('unlocked', 'progress')).toBe('createtime');
    expect(legalSortForStage('genesis', 'unlocktime')).toBe('createtime');
    expect(legalSortForStage('genesis', 'marketcap')).toBe('createtime');
  });

  it('unknown/empty values fall back to createtime', () => {
    expect(legalSortForStage('locked', 'bogus')).toBe('createtime');
    expect(legalSortForStage('genesis', '')).toBe('createtime');
  });

  it('createtime is the only sort option shared by all three browsing stages', () => {
    const stages = ['genesis', 'locked', 'unlocked'] as const;
    const shared = stages
      .map((stage) => new Set(SORT_OPTIONS_BY_STAGE[stage]))
      .reduce((acc, set) => new Set([...acc].filter((value) => set.has(value))));
    expect([...shared]).toEqual(['createtime']);
  });
});

// sortVerses expectations are pinned to the frozen fixture: verse data changes
// go through the freeze chain re-signing, which requires updating here in sync
describe('sortVerses', () => {
  function pick(...ids: string[]) {
    const verses = getFixtureSnapshot().verses;
    return ids.map((id) => {
      const verse = verses.find((candidate) => candidate.id === id);
      if (!verse) throw new Error(`fixture verse missing: ${id}`);
      return verse;
    });
  }

  it('nullable numeric keys sink nulls to the end regardless of sort direction', () => {
    // verse-001 has no livePhase snapshot (volume24h=null); 002/026 are locked with values
    const verses = pick('verse-002', 'verse-001', 'verse-026');
    expect(sortVerses(verses, 'volume', 'asc').map((verse) => verse.id)).toEqual([
      'verse-002',
      'verse-026',
      'verse-001',
    ]);
    expect(sortVerses(verses, 'volume', 'desc').map((verse) => verse.id)).toEqual([
      'verse-026',
      'verse-002',
      'verse-001',
    ]);
  });

  it('unknown sort name sorts by size (participationSize) asc/desc', () => {
    // size: verse-021=27000 < verse-005=182000 < verse-017=562000
    const verses = pick('verse-005', 'verse-021', 'verse-017');
    expect(sortVerses(verses, 'bogus', 'asc').map((verse) => verse.id)).toEqual([
      'verse-021',
      'verse-005',
      'verse-017',
    ]);
    expect(sortVerses(verses, 'bogus', 'desc').map((verse) => verse.id)).toEqual([
      'verse-017',
      'verse-005',
      'verse-021',
    ]);
  });

  it('progress sorts by the larger of the two thresholds', () => {
    // max(normal, leverage): verse-008=106.7 > verse-001=82 > verse-022=80
    const verses = pick('verse-001', 'verse-008', 'verse-022');
    expect(sortVerses(verses, 'progress', 'desc').map((verse) => verse.id)).toEqual([
      'verse-008',
      'verse-001',
      'verse-022',
    ]);
  });

  it('sorting returns a new array without mutating input order', () => {
    const verses = pick('verse-005', 'verse-021', 'verse-017');
    const before = verses.map((verse) => verse.id);
    sortVerses(verses, 'size', 'asc');
    expect(verses.map((verse) => verse.id)).toEqual(before);
  });
});

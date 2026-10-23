// Route scheme unit tests: en has no prefix / zh carries
// the /zh prefix, detail pages use numeric ids (= on-chain uint256 verseId
// standard), fixture row ids stay at the data layer
import { describe, expect, it } from 'vitest';

import {
  localePath,
  narrowVerseQuery,
  parseVerseIdParam,
  verseHref,
  versePathSegment,
} from '../../components/global/routes';
import { getFixtureVerse } from '../../lib/data/fixture-repository';

describe('localePath', () => {
  it('en has no prefix, home is /', () => {
    expect(localePath('en', '')).toBe('/');
    expect(localePath('en', '/')).toBe('/');
    expect(localePath('en', '/memeverse')).toBe('/memeverse');
    expect(localePath('en', '/memeverse/21')).toBe('/memeverse/21');
  });

  it('zh carries the /zh prefix, home is /zh', () => {
    expect(localePath('zh', '')).toBe('/zh');
    expect(localePath('zh', '/')).toBe('/zh');
    expect(localePath('zh', '/memeverse')).toBe('/zh/memeverse');
    expect(localePath('zh', '/memeverse/21')).toBe('/zh/memeverse/21');
  });
});

describe('versePathSegment / verseHref', () => {
  it('fixture row id strips prefix and leading zeros into a numeric segment', () => {
    expect(versePathSegment('verse-021')).toBe('21');
    expect(versePathSegment('verse-001')).toBe('1');
    expect(versePathSegment('verse-100')).toBe('100');
  });

  it('unparseable segment returned as-is (downstream notFound fallback)', () => {
    expect(versePathSegment('moon-verse')).toBe('moon-verse');
  });

  it('verseHref builds the detail href per locale', () => {
    expect(verseHref('en', 'verse-004')).toBe('/memeverse/4');
    expect(verseHref('zh', 'verse-004')).toBe('/zh/memeverse/4');
  });

  it('verseHref deep links: non-default tabs go into query, liquidity default tab has no query', () => {
    expect(verseHref('en', 'verse-021', 'pol')).toBe('/memeverse/21?tab=pol');
    expect(verseHref('en', 'verse-021', 'liquidity')).toBe('/memeverse/21');
  });

  it('verseHref vault tab carries the action deep link', () => {
    expect(verseHref('zh', 'verse-021', 'vault', 'withdraw')).toBe(
      '/zh/memeverse/21?tab=vault&action=withdraw',
    );
  });

  it('oversized numeric id preserved verbatim (uint256, no Number coercion)', () => {
    expect(verseHref('en', 'verse-999999999999999999999999')).toBe(
      '/memeverse/999999999999999999999999',
    );
  });
});

describe('parseVerseIdParam (uint256 precision)', () => {
  // The registered BSC smoke verse — 77 digits, far past Number.MAX_SAFE_INTEGER
  const SMOKE_VERSE_ID =
    '52837714424155436352242994144496188832833587031649586216523996295503828439311';

  it('returns the exact decimal string for a 77-digit verseId', () => {
    expect(parseVerseIdParam(SMOKE_VERSE_ID)).toBe(SMOKE_VERSE_ID);
    expect(BigInt(parseVerseIdParam(SMOKE_VERSE_ID) as string)).toBe(BigInt(SMOKE_VERSE_ID));
  });

  it('Number coercion would destroy the id — the regression this parser guards against', () => {
    expect(String(Number(SMOKE_VERSE_ID))).not.toBe(SMOKE_VERSE_ID);
    expect(BigInt(Math.trunc(Number(SMOKE_VERSE_ID)))).not.toBe(BigInt(SMOKE_VERSE_ID));
  });

  it('rejects legacy, scientific, empty and non-string forms', () => {
    expect(parseVerseIdParam('verse-021')).toBeNull();
    expect(parseVerseIdParam('1e3')).toBeNull();
    expect(parseVerseIdParam('')).toBeNull();
    expect(parseVerseIdParam(undefined)).toBeNull();
    expect(parseVerseIdParam(21)).toBeNull();
    expect(parseVerseIdParam(['21'])).toBeNull();
  });

  it('small numeric segments pass through unchanged', () => {
    expect(parseVerseIdParam('21')).toBe('21');
    expect(parseVerseIdParam('0')).toBe('0');
  });
});

describe('narrowVerseQuery', () => {
  it('allowlisted tab/action pass through unchanged', () => {
    expect(narrowVerseQuery({ tab: 'vault', action: 'withdraw' })).toEqual({
      tab: 'vault',
      action: 'withdraw',
    });
    // liquidity is inside the allowlist; verseHref is what keeps it out of the query
    expect(narrowVerseQuery({ tab: 'liquidity' })).toEqual({ tab: 'liquidity', action: undefined });
  });

  it('non-allowlisted values and case variants dropped', () => {
    expect(narrowVerseQuery({ tab: 'foo', action: 'deposit' })).toEqual({
      tab: undefined,
      action: undefined,
    });
    expect(narrowVerseQuery({ tab: 'Pol' })).toEqual({ tab: undefined, action: undefined });
  });

  it('missing (undefined) values pass through', () => {
    expect(narrowVerseQuery({})).toEqual({ tab: undefined, action: undefined });
  });
});

describe('getFixtureVerse numeric parsing', () => {
  it('numeric segments (with leading zeros) and legacy verse-xxx forms resolve to the same fixture row', () => {
    expect(getFixtureVerse('21')?.id).toBe('verse-021');
    expect(getFixtureVerse('021')?.id).toBe('verse-021');
    expect(getFixtureVerse('verse-021')?.id).toBe('verse-021');
  });

  it('unknown numbers and invalid segments return null', () => {
    expect(getFixtureVerse('999')).toBeNull();
    expect(getFixtureVerse('abc')).toBeNull();
  });
});

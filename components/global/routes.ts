// URL scheme: language state lives in the URL — en has no prefix (the proxy
// internally rewrites to /en/**), zh carries the /zh prefix; the memeverse detail page
// uses a numeric segment (= the on-chain uint256 verseId convention), fixture row ids
// (verse-021) stay in the data layer. The create and discovery pages live under the
// /memeverse/* domain — /memeverse/launch and /memeverse/explore; legacy addresses
// 307-redirect at the proxy to the current paths.
// Zero-side-effect language switching: /zh/** is likewise rewritten to /en/** inside
// the proxy; cross-language navigation shares one route tree (soft navigation does not
// remount, component state fully preserved);
// the display language is written by the proxy into the x-locale request header and
// read by pages via lib/locale.ts getDisplayLocale().
import type { Locale } from '@/lib/data/fixture-repository'

/** Build a path per locale: en has no prefix (home='/'), zh adds the /zh prefix
 * (home='/zh') */
export function localePath(locale: Locale, path: string): string {
  if (locale === 'zh') return path === '' || path === '/' ? '/zh' : `/zh${path}`
  return path === '' || path === '/' ? '/' : path
}

/** Fixture row id (verse-021) → numeric URL segment (21); returns the input unchanged
 * if parsing fails */
export function versePathSegment(verseId: string): string {
  const match = /^verse-0*(\d+)$/i.exec(verseId)
  return match ? match[1] : verseId
}

/** The trading desk's four tab keys (?tab= deep-link whitelist — matches VerseTabs'
 * ToggleGroupItem value) */
export const VERSE_TAB_KEYS = ['liquidity', 'pol', 'vault', 'dao'] as const

/** URL ?tab=/?action= raw values → whitelist narrowing (unknown values and case
 * variants are dropped; action only accepts withdraw — same convention as the VersePage
 * consumer) */
export function narrowVerseQuery(
  search: { tab?: string; action?: string },
): { tab?: (typeof VERSE_TAB_KEYS)[number]; action?: 'withdraw' } {
  const tab = VERSE_TAB_KEYS.find((key) => key === search.tab)
  const action = search.action === 'withdraw' ? 'withdraw' : undefined
  return { tab, action }
}

export function verseHref(
  locale: Locale,
  verseId: string,
  /** Trading desk tab deep link (?tab=; liquidity = default, no query — validated by
   * VersePage's whitelist) */
  tab?: (typeof VERSE_TAB_KEYS)[number],
  /** In-tab view deep link (?action=; only the vault tab accepts withdraw —
   * validated by VersePage's whitelist) */
  action?: 'withdraw',
): string {
  const params = new URLSearchParams()
  if (tab && tab !== 'liquidity') params.set('tab', tab)
  if (action) params.set('action', action)
  const query = params.size > 0 ? `?${params.toString()}` : ''
  return localePath(locale, `/memeverse/${versePathSegment(verseId)}${query}`)
}

import { headers } from 'next/headers';

import type { Locale } from '@/lib/data/types';

/**
 * Display language source:
 * the URL prefix remains the sole source of truth for language — the proxy rewrites both /zh/** and the prefix-less
 * shape to the /en/** internal routes (cross-language soft navigation hits the same-key cache and does not remount
 * the page tree) and writes the URL-determined language into the x-locale request header; page render language is
 * always taken from here, no longer read from params.locale (internally always 'en'). Falls back to 'en' when the header is missing.
 */
export async function getDisplayLocale(): Promise<Locale> {
  const headerList = await headers();
  return headerList.get('x-locale') === 'zh' ? 'zh' : 'en';
}

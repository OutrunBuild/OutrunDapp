// proxy x-locale header semantics unit tests (regression guard: a client-preset
// x-locale header can never override the URL-derived locale): the URL prefix
// is the single source of truth for locale; x-locale may only be written by
// the proxy per the URL — the no-prefix branch must unconditionally overwrite
// a client-preset value (the internal rewrite target is always /en/**, so it
// never re-enters that branch); direct /en/** hits are 307-converged to the
// no-prefix form (entry disappears = forgery surface disappears); LEGACY_PATHS
// old addresses are 307-converged.
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { proxy } from '../../proxy';

function requestFor(path: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL(`http://localhost${path}`), { headers });
}

/** Headers rewritten by the proxy are exposed on the response as x-middleware-request-* (next/server bridging semantics) */
function forwardedLocale(res: Response): string | null {
  return res.headers.get('x-middleware-request-x-locale');
}

describe('proxy x-locale (URL prefix is the single source of truth for locale)', () => {
  it('no prefix: client-preset x-locale: zh is overwritten to en (forgery surface sealed)', () => {
    const res = proxy(requestFor('/', { 'x-locale': 'zh' }));
    expect(res.headers.get('x-middleware-rewrite')).toContain('/en');
    expect(forwardedLocale(res)).toBe('en');
  });

  it('no prefix: no header defaults to en', () => {
    const res = proxy(requestFor('/memeverse/explore'));
    expect(res.headers.get('x-middleware-rewrite')).toContain('/en/memeverse/explore');
    expect(forwardedLocale(res)).toBe('en');
  });

  it('/zh: unconditionally writes zh, preset en header has no effect', () => {
    const res = proxy(requestFor('/zh/memeverse/21', { 'x-locale': 'en' }));
    expect(res.headers.get('x-middleware-rewrite')).toContain('/en/memeverse/21');
    expect(forwardedLocale(res)).toBe('zh');
  });

  it('/en direct hit: 307-converged to the no-prefix canonical, forged header loses its render surface', () => {
    const res = proxy(requestFor('/en/portfolio', { 'x-locale': 'zh' }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/portfolio');
  });

  it('/en root path and query converge faithfully', () => {
    expect(proxy(requestFor('/en')).headers.get('location')).toBe('http://localhost/');
    expect(proxy(requestFor('/en/memeverse/launch?tab=pol')).headers.get('location')).toBe(
      'http://localhost/memeverse/launch?tab=pol',
    );
  });

  it('legacy paths (LEGACY_PATHS): 307 to the new domain, locale prefix and query preserved', () => {
    const res = proxy(requestFor('/launch'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/memeverse/launch');
    expect(proxy(requestFor('/memeverse')).headers.get('location')).toBe(
      'http://localhost/memeverse/explore',
    );
    // /en/launch first hop of the whole chain: legacyRedirect keeps the /en
    // prefix (second hop is covered by the case above)
    expect(proxy(requestFor('/en/launch?tab=pol')).headers.get('location')).toBe(
      'http://localhost/en/memeverse/launch?tab=pol',
    );
    expect(proxy(requestFor('/zh/memeverse')).headers.get('location')).toBe(
      'http://localhost/zh/memeverse/explore',
    );
  });
});

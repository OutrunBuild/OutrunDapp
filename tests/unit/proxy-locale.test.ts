// proxy x-locale header semantics unit tests (regression guard: a client-preset
// x-locale header can never override the URL-derived locale): the URL prefix
// is the single source of truth for locale; x-locale may only be written by
// the proxy per the URL — the no-prefix branch must unconditionally overwrite
// a client-preset value (the internal rewrite target is always /en/**, so it
// never re-enters that branch); direct /en/** hits are 307-converged to the
// no-prefix form (entry disappears = forgery surface disappears).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('retired legacy paths are NOT redirected: /launch falls through to the /en rewrite (not-found surface)', () => {
    const res = proxy(requestFor('/launch'));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-rewrite')).toContain('/en/launch');
    expect(proxy(requestFor('/memeverse')).headers.get('x-middleware-rewrite')).toContain(
      '/en/memeverse',
    );
  });
});

// CSP/nonce/cookie branches: every rewrite response must re-set the CSP explicitly
// (request headers are not forwarded as response headers — without this the rewritten
// page ships with no browser-facing CSP, and the site's only CSP source is this proxy),
// the per-request nonce (csp-origins.json noncePolicy.required/perRequest) feeds both the
// request x-nonce header (consumed by the root layout's PAINT_BOOT_JS inline script) and
// the CSP itself, and the returning-visitor cookie redirect is the / entry for zh readers.
// NODE_ENV is pinned per test: the CSP profile is read at call time, and vitest only
// defaults NODE_ENV to 'test' when the environment has not exported it (??= semantics) —
// a development-exporting shell would otherwise leak 'unsafe-eval' into the assertions.
describe('proxy CSP/nonce/cookie branches (per-request nonce security surface)', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('/ with OUTRUN_LOCALE=zh cookie: returning visitor 307-redirected to /zh', () => {
    const res = proxy(requestFor('/', { cookie: 'OUTRUN_LOCALE=zh' }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/zh');
  });

  it('/ without the cookie falls through to the en rewrite (first visit stays canonical)', () => {
    const res = proxy(requestFor('/'));
    expect(res.headers.get('x-middleware-rewrite')).toContain('/en');
  });

  it('every rewrite response re-sets the CSP explicitly, request and response CSP carry the same policy', () => {
    for (const path of ['/zh/memeverse/21', '/memeverse/explore', '/']) {
      const res = proxy(requestFor(path));
      const csp = res.headers.get('content-security-policy');
      expect(csp).toContain("'nonce-");
      expect(csp).toContain("'strict-dynamic'");
      // dev-only directive must never leak into the production profile (vitest runs with NODE_ENV=test)
      expect(csp).not.toContain("'unsafe-eval'");
      expect(res.headers.get('x-middleware-request-content-security-policy')).toBe(csp);
    }
  });

  it('x-nonce is injected per request: present, embedded in the matching CSP, fresh across requests', () => {
    const res1 = proxy(requestFor('/portfolio'));
    const res2 = proxy(requestFor('/portfolio'));
    const nonce1 = res1.headers.get('x-middleware-request-x-nonce');
    const nonce2 = res2.headers.get('x-middleware-request-x-nonce');
    expect(nonce1).toBeTruthy();
    expect(nonce2).toBeTruthy();
    expect(nonce1).not.toBe(nonce2);
    expect(res1.headers.get('content-security-policy')).toContain(`'nonce-${nonce1}'`);
  });

  it('/zh bare root: rewritten to the shared /en route tree with the zh header (not a redirect)', () => {
    const res = proxy(requestFor('/zh'));
    expect(res.headers.get('x-middleware-rewrite')).toContain('/en');
    expect(forwardedLocale(res)).toBe('zh');
    expect(res.headers.get('content-security-policy')).toContain("'nonce-");
  });
});

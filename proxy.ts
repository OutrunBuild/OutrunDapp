// Next.js 16 proxy: generate a base64 nonce per request;
// the same nonce is written into the request x-nonce, the request CSP and the response CSP;
// site-wide dynamic rendering; ISR/PPR/static export are forbidden — cached output would replay a stale
// per-request nonce and break the CSP.
import { NextResponse, type NextRequest } from 'next/server';

import cspOrigins from './docs/security/csp-origins.json';

function buildNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString('base64');
}

// connect-src / frame-src / child-src come from docs/security/csp-origins.json (the §14
// machine-readable baseline) — never hardcode new origins here; register them in the JSON
// first. Six-chain RPC/Graph exact origins stay server-side (wallet provider path serves
// browser calls), so the browser policy only carries the JSON's wallet/auth origins.
function cspHeader(nonce: string, dev: boolean): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    'https://challenges.cloudflare.com',
    ...(dev ? ["'unsafe-eval'"] : []), // development only
  ].join(' ');

  const directives = cspOrigins.directives as Record<string, string[]>;
  const join = (key: string): string => directives[key].join(' ');
  return [
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${join('connect-src')}`,
    `frame-src ${join('frame-src')}`,
    `child-src ${join('child-src')}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

// locale routing:
// language state still lives in the URL — en is prefix-less (internally rewritten to /en/**), zh carries the /zh prefix;
// the cookie only stores the returning-visitor preference, used for the '/' redirect
// (Googlebot has no cookie, so the canonical English content at '/' is unaffected).
const LOCALE_COOKIE = 'OUTRUN_LOCALE';

function localeRouting(
  request: NextRequest,
  requestHeaders: Headers,
  csp: string,
): NextResponse | null {
  const { pathname, search } = request.nextUrl;

  // zh prefix: internally also rewritten to /en/**,
  // sharing the same route tree as the prefix-less shape — cross-language soft navigation hits the same-key client
  // cache and the page tree does not remount (form/chart/dialog component state is fully preserved). The display
  // language does not use a route segment; it is passed down via the x-locale request header
  // (the URL prefix remains the sole source of truth for language).
  if (pathname === '/zh' || pathname.startsWith('/zh/')) {
    requestHeaders.set('x-locale', 'zh');
    const target = new URL(
      `/en${pathname === '/zh' ? '' : pathname.slice(3)}${search}`,
      request.url,
    );
    // Request headers are not forwarded as response headers, so every rewrite response must set
    // the CSP explicitly — without this the rewritten page ships with no browser-facing CSP.
    const rewritten = NextResponse.rewrite(target, { request: { headers: requestHeaders } });
    rewritten.headers.set('Content-Security-Policy', csp);
    return rewritten;
  }

  // Legacy /en/** addresses converge to the canonical prefix-less form.
  // Internal rewrites never re-enter the proxy, so this branch only sees external direct requests.
  // 307 so browsers do not cache the redirect (flip to 301 once URLs freeze at launch);
  // redirecting /en/** away also removes the URL surface a client-forged x-locale could pair with.
  if (pathname === '/en' || pathname.startsWith('/en/')) {
    const rest = pathname === '/en' ? '/' : pathname.slice(3);
    return NextResponse.redirect(new URL(`${rest}${search}`, request.url), 307);
  }

  if (pathname === '/' && request.cookies.get(LOCALE_COOKIE)?.value === 'zh') {
    return NextResponse.redirect(new URL(`/zh${search}`, request.url));
  }

  // All other page paths = English content: internally rewritten to /en/**, the URL bar stays prefix-less.
  // Unconditional overwrite: a client-preset x-locale must not impersonate the internal first-hop signal (internal
  // rewrite targets are always /en/** and never re-enter this branch; first-hop zh protection is the /en branch guard above).
  requestHeaders.set('x-locale', 'en');
  const target = new URL(`/en${pathname === '/' ? '' : pathname}${search}`, request.url);
  // Same as the /zh branch: request headers are not forwarded as response headers, so the rewrite
  // response must set the CSP explicitly or the prefix-less pages (the canonical entry) ship with none.
  const rewritten = NextResponse.rewrite(target, { request: { headers: requestHeaders } });
  rewritten.headers.set('Content-Security-Policy', csp);
  return rewritten;
}

export function proxy(request: NextRequest) {
  const nonce = buildNonce();
  const dev = process.env.NODE_ENV === 'development';
  const csp = cspHeader(nonce, dev);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const routed = localeRouting(request, requestHeaders, csp);
  if (routed) return routed;

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  // paint/ = Paint Worklet static assets, fonts/ = CJK font subset artifacts
  // (public/**, must load via their exact URLs, no locale rewrite)
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.ico$|.*\\.svg$|paint/|fonts/).*)',
  ],
};

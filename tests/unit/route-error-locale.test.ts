// Route-level error boundary locale derivation (previously zero-covered): the client
// fallback surfaces cannot read the x-locale request header, so the language comes from
// the visible URL prefix via localeFromPathname — the SSR arm has no window and falls
// back to '/'. Copy strings are asserted via getCopy itself so copy edits don't break
// the wiring assertions. Node environment: the SSR arm needs `typeof window === 'undefined'`.
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

import RouteError from '../../app/error';
import GlobalError from '../../app/global-error';
import { getCopy } from '../../components/global/copy';

// global-error pulls next/font/google (module-scope font loaders, unusable outside a Next build)
vi.mock('@/components/design-system/fonts', () => ({ productFontClassName: 'font-harness' }));

/** Node env has no window by default; the stub emulates the hydrated client at a given URL. */
function withClientPathname<T>(pathname: string, run: () => T): T {
  vi.stubGlobal('window', { location: { pathname } });
  try {
    return run();
  } finally {
    vi.unstubAllGlobals();
  }
}

function boundaryError(digest?: string): Error & { digest?: string } {
  const error = new Error('render boom') as Error & { digest?: string };
  error.digest = digest;
  return error;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RouteError (app/error.tsx) locale arms', () => {
  it('SSR arm (no window): en copy, digest handed to the fallback card, retry CTA present', () => {
    const retry = () => undefined;
    const html = renderToString(
      createElement(RouteError, { error: boundaryError('dg-123'), retry }),
    );
    const en = getCopy('en').common.routeFallback;
    expect(html).toContain(en.errorTitle);
    expect(html).toContain(en.retry);
    expect(html).toContain('dg-123');
  });

  it('CSR arm (window at a /zh path): zh copy wins the visible prefix', () => {
    const retry = () => undefined;
    const html = withClientPathname('/zh/memeverse/21', () =>
      renderToString(createElement(RouteError, { error: boundaryError(), retry })),
    );
    const zh = getCopy('zh').common.routeFallback;
    const en = getCopy('en').common.routeFallback;
    expect(html).toContain(zh.errorTitle);
    // derivation must be exclusive: the /zh prefix must not also render the en voice
    if (en.errorTitle !== zh.errorTitle) expect(html).not.toContain(en.errorTitle);
  });
});

describe('GlobalError (app/global-error.tsx) locale arms', () => {
  it('SSR arm: self-contained document renders with lang=en and the retry CTA', () => {
    const retry = () => undefined;
    const html = renderToString(createElement(GlobalError, { error: boundaryError(), retry }));
    expect(html).toContain('<html lang="en"');
    expect(html).toContain('font-harness');
    expect(html).toContain(getCopy('en').common.routeFallback.errorTitle);
  });

  it('CSR arm at a /zh path: document lang flips to zh-CN with the zh copy', () => {
    const retry = () => undefined;
    const html = withClientPathname('/zh/portfolio', () =>
      renderToString(createElement(GlobalError, { error: boundaryError(), retry })),
    );
    expect(html).toContain('<html lang="zh-CN"');
    expect(html).toContain(getCopy('zh').common.routeFallback.errorTitle);
  });
});

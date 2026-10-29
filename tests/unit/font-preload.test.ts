// FontPreloadLinks regression guard (previously zero-covered): manifest candidate
// fallthrough (server/ artifact tree first, dev/server/ alternate second — picking wrong
// preloads stale hashes that 404), the mtime-keyed cache (no manifest re-read per
// request), the zh-only CJK preload (en pages consume no CJK glyphs), and the silent
// empty fallback when no manifest is readable. fs and next/headers are mocked; the
// async server component is invoked directly and rendered via react-dom/server.
// Module-INIT behaviors (NODE_ENV branch, NEXT_DIST_DIR fail-fast) live in
// font-preload-boot.test.ts — they need controlled env at import time.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

import { CJK_SUBSET_HREF } from '../../components/design-system/cjk-subset';
import { FontPreloadLinks } from '../../components/design-system/font-preload';

const fsMock = vi.hoisted(() => ({ stat: vi.fn(), readFile: vi.fn() }));
vi.mock('node:fs/promises', () => ({ stat: fsMock.stat, readFile: fsMock.readFile }));

const headersState = vi.hoisted(() => ({ locale: 'en' }));
vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (key: string) => (key === 'x-locale' ? headersState.locale : null),
  }),
}));

const PROD_HREF = '/_next/prod-font.woff2';
const DEV_HREF = '/_next/dev-font.woff2';

function manifest(hrefs: string[]): string {
  return JSON.stringify({ app: { '/page': hrefs.map((href) => href.replace('/_next/', '')) } });
}

function preloadCount(html: string): number {
  return html.split('rel="preload"').length - 1;
}

beforeEach(() => {
  fsMock.stat.mockReset();
  fsMock.readFile.mockReset();
  headersState.locale = 'en';
});

describe('FontPreloadLinks', () => {
  it('reads the server/ manifest when present, dedupes hrefs, emits crossorigin preloads', async () => {
    fsMock.stat.mockResolvedValue({ mtimeMs: 111 });
    fsMock.readFile.mockResolvedValue(manifest([PROD_HREF, PROD_HREF, '/_next/second.woff2']));
    const html = renderToString(await FontPreloadLinks());
    expect(html).toContain(PROD_HREF);
    expect(html).not.toContain(DEV_HREF);
    // Set-dedupe: one occurrence per unique href, the inlined @font-face always ships
    expect(preloadCount(html)).toBe(2);
    expect(html).toContain('crossorigin');
    expect(html).toContain('@font-face');
  });

  it('falls through to the dev/server candidate when the server/ manifest is missing', async () => {
    fsMock.stat.mockImplementation(async (p) => {
      if (String(p).includes('dev/server/next-font-manifest.json')) return { mtimeMs: 7 };
      throw new Error('missing');
    });
    fsMock.readFile.mockImplementation(async (p) => {
      if (String(p).includes('dev/server/next-font-manifest.json')) return manifest([DEV_HREF]);
      throw new Error('missing');
    });
    const html = renderToString(await FontPreloadLinks());
    expect(html).toContain(DEV_HREF);
    expect(html).not.toContain(PROD_HREF);
  });

  it('mtime cache: an unchanged manifest is not re-read; a changed mtime re-reads once', async () => {
    // The mtime cache lives at module level and this file's cases share one instance, so
    // mtimes used across these tests must stay mutually distinct (111/7/100/200) — a new
    // case reusing one would silently inherit the cache from an earlier case.
    let mtime = 100;
    fsMock.stat.mockImplementation(async () => ({ mtimeMs: mtime }));
    fsMock.readFile.mockResolvedValue(manifest([PROD_HREF]));
    await FontPreloadLinks();
    await FontPreloadLinks();
    expect(fsMock.readFile).toHaveBeenCalledTimes(1);
    mtime = 200;
    await FontPreloadLinks();
    expect(fsMock.readFile).toHaveBeenCalledTimes(2);
  });

  it('zh routes preload the CJK subset; en routes do not', async () => {
    fsMock.stat.mockRejectedValue(new Error('missing'));
    const en = renderToString(await FontPreloadLinks());
    expect(preloadCount(en)).toBe(0);
    expect(en).toContain('@font-face');
    headersState.locale = 'zh';
    const zh = renderToString(await FontPreloadLinks());
    expect(zh).toContain(`<link rel="preload" href="${CJK_SUBSET_HREF}"`);
  });

  it('unreadable manifests degrade silently: no preload links, @font-face still ships', async () => {
    fsMock.stat.mockRejectedValue(new Error('missing'));
    const html = renderToString(await FontPreloadLinks());
    expect(preloadCount(html)).toBe(0);
    expect(html).toContain('@font-face');
  });
});

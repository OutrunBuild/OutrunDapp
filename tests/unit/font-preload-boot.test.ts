// Module-boot behaviors of font-preload.tsx: the manifest candidate order is chosen
// from NODE_ENV at import (dev runs incrementally into dev/server/, production into
// server/ — the two trees' font hash names differ, so the wrong pick preloads stale
// hashes that 404), and a NEXT_DIST_DIR with '..' segments must fail fast at import
// instead of silently reading another tree's stale fonts. The env must be pinned
// BEFORE the module evaluates, hence the dedicated file (vi.hoisted runs above imports).
// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

vi.hoisted(() => {
  // Next's env typing pins NODE_ENV readonly; the boot branch reads the real runtime value
  (process.env as { NODE_ENV: string }).NODE_ENV = 'development';
});

const fsMock = vi.hoisted(() => ({ stat: vi.fn(), readFile: vi.fn() }));
vi.mock('node:fs/promises', () => ({ stat: fsMock.stat, readFile: fsMock.readFile }));

const headersState = vi.hoisted(() => ({ locale: 'en' }));
vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (key: string) => (key === 'x-locale' ? headersState.locale : null),
  }),
}));

import { FontPreloadLinks } from '../../components/design-system/font-preload';

const DEV_HREF = '/_next/dev-font.woff2';
const PROD_HREF = '/_next/prod-font.woff2';

describe('FontPreloadLinks module boot', () => {
  it('development boot reads the dev/server manifest first even when both trees exist', async () => {
    fsMock.stat.mockResolvedValue({ mtimeMs: 1 });
    fsMock.readFile.mockImplementation(async (p) =>
      String(p).includes('dev/server/next-font-manifest.json')
        ? JSON.stringify({ app: { '/page': ['dev-font.woff2'] } })
        : JSON.stringify({ app: { '/page': ['prod-font.woff2'] } }),
    );
    const html = renderToString(await FontPreloadLinks());
    expect(html).toContain(DEV_HREF);
    expect(html).not.toContain(PROD_HREF);
  });

  it("NEXT_DIST_DIR '..' segments fail fast at import, before reading any manifest", async () => {
    vi.stubEnv('NEXT_DIST_DIR', 'out/../.next');
    vi.resetModules();
    const statCallsBefore = fsMock.stat.mock.calls.length;
    await expect(import('../../components/design-system/font-preload')).rejects.toThrow(
      /must not contain '\.\.' segments/,
    );
    expect(fsMock.stat.mock.calls.length).toBe(statCallsBefore);
  });
});

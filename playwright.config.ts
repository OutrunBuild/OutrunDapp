import { defineConfig } from '@playwright/test';

// Operating policy for visual baselines + axe:
// - Three viewports = repo convention 1280×800 / 860×900 / 390×844, DPR at the Playwright default of 1 (avoids subpixel drift of chamfer strokes/Worklet)
// - The server runs from the separate NEXT_DIST_DIR=.next-e2e build, never touching .next (no conflict with a running dev/preview)
// - The first run writes baseline snapshots automatically (e2e/*-snapshots/, committed); afterwards any style change shows a pixel diff on the next run
// - Update baselines: pnpm test:e2e -- --update-snapshots (a human must confirm the diff is an intended change)

const PORT = 4188;
const BASE = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  // Visual comparison tolerance: up to 1% differing pixels passes (margin for canvas charts and antialiasing; real regressions far exceed this)
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
    },
  },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 1,
  reporter: [['list']],
  use: {
    baseURL: BASE,
    colorScheme: 'dark',
  },
  projects: [
    { name: 'desktop-1280', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'tablet-860', use: { viewport: { width: 860, height: 900 } } },
    {
      name: 'mobile-390',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    // Data mode pinned to fixture (stage 5 step 8): the e2e baseline proves the onchain seam
    // leaves fixture rendering byte-identical; any diff = real regression, fix code not baseline.
    // Playwright runs via pnpm directly (never through rtk — flag swallowing, silent rewrites).
    command:
      'OUTRUN_DATA_SOURCE=fixture NEXT_DIST_DIR=.next-e2e pnpm build && OUTRUN_DATA_SOURCE=fixture NEXT_DIST_DIR=.next-e2e pnpm start -p 4188',
    url: `${BASE}/`,
    reuseExistingServer: true,
    timeout: 420_000,
  },
});

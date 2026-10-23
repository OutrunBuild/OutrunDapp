import { expect, test, type Page } from '@playwright/test';
import { FALLBACK_PAGES, FIXED_NOW, PAGES, ZH_PAGES } from './pages';

// Visual baselines: full-page screenshots of routes in
// the baseline across the three viewport tiers.
// The clock is pinned to FIXED_NOW (later than fixtures' already-past static
// timestamps), so countdowns/relative times are pixel-deterministic; motion
// freezing uses reduced-motion + animation:none as a double guard.
// First run writes the baseline automatically (e2e/*-snapshots/, committed);
// updating a baseline requires a human-confirmed diff:
//   pnpm test:e2e -- --update-snapshots
//
// Full-page screenshots have known capture artifacts for position:fixed/sticky
// (captureBeyondViewport collects a single frame: fixed freezes at the initial
// viewport position, sticky lands at its in-flow position): in the mobile/tablet
// baselines the fixed bottom nav floats at y = viewport height − 64 (780 on the
// 390 tier, 836 on the 860 tier), covering mid-page content; in the desktop
// baseline the 100dvh sidebar only paints the first ~800px.
// Real viewports never show these frames (the bottom bar pins to the viewport
// edge, content scrolls beneath it) — expected noise; do not "fix" pages based
// on it.

test.beforeEach(async ({ page }) => {
  // pauseAt after install: time freezing does not advance the clock, so
  // Date.now() stays constant for the seconds the tests run
  await page.clock.install({ time: FIXED_NOW });
  await page.clock.pauseAt(FIXED_NOW);
});

async function stabilize(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addStyleTag({
    content:
      '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
  });
  await page.evaluate(() => document.fonts.ready);
  // Paint worklet readiness gate: before registration, paint()
  // rasterizes empty (buttons lose their stroke and render text only), which
  // once corrupted the zh baseline; PaintSkin sets html[data-paint-ready] when
  // registration completes. Timeout is swallowed as a fallback (when
  // non-Chromium/load failure takes the CSS fallback path the flag is still
  // set; this gate only prevents a race, it does not judge errors)
  await page.waitForSelector('html[data-paint-ready]', { timeout: 2000 }).catch(() => {});
  // Settling margin for the candlestick canvas and font layout
  await page.waitForTimeout(300);
}

async function connectWallet(page: Page) {
  // The product shell has exactly one wallet button, in product-topbar
  // (marketing-header only exists on the home shell)
  const control = page.locator('.wallet-control');
  // Fixture builds toggle the harness on the Login button: the click swaps the
  // button for the account-menu trigger (same .wallet-control footprint) instead
  // of opening anything. Assert the swap, then open the menu explicitly.
  await control.click();
  // Connected = the Login button swapped for the account-menu trigger.
  // (Opening the menu itself is covered by unit tests; e2e keeps the
  // menu closed for screenshots/scans, matching the old baseline.)
  await expect(control).toHaveAttribute('aria-haspopup', 'menu');
}

async function shoot(
  page: Page,
  name: string,
  path: string,
  connect = false,
  expectStatus: number | number[] = 200,
) {
  const res = await page.goto(path, { waitUntil: 'networkidle' });
  const allowed = Array.isArray(expectStatus) ? expectStatus : [expectStatus];
  expect(allowed, `${path} should return ${allowed.join('|')}`).toContain(res?.status());
  if (connect) await connectWallet(page);
  await stabilize(page);
  await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
}

for (const { name, path, connectWallet } of PAGES) {
  test(`visual: ${name}`, async ({ page }) => {
    await shoot(page, name, path, connectWallet === true);
  });
}

// zh locks only the mobile tier (one /zh mobile screenshot standard)
for (const { name, path, connectWallet } of ZH_PAGES) {
  test(`visual: ${name}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-390', 'zh runs on the mobile tier only');
    await shoot(page, name, path, connectWallet === true);
  });
}

// Route-level 404 fallback: a dynamic not-found page may resolve as a streamed
// 200 or a non-streamed 404 — both are the documented contract, so accept either
for (const { name, path, mobileOnly } of FALLBACK_PAGES) {
  test(`visual: ${name}`, async ({ page }, testInfo) => {
    test.skip(
      mobileOnly === true && testInfo.project.name !== 'mobile-390',
      'zh runs on the mobile tier only',
    );
    await shoot(page, name, path, false, [200, 404]);
  });
}

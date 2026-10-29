import { expect, test, type Page } from '@playwright/test';

// Locale-switch zero-side-effect regression gate: /zh and the
// no-prefix form share the /en route tree; switching = push+refresh swapping
// only the language payload with all component state preserved; the back key
// recovers "URL standard = rendered language" via a popstate reconciliation.
// Assertions use semantic selectors and URL/lang attributes, not pinned copy;
// desktop tier only (same standard as dialog-a11y/swap-settings); no
// screenshots, no snapshots.

const VERSE_LOCKED = '/memeverse/2';

/** Opens the locale menu and switches to the other language (current item has data-current="true", the target item lacks it) */
async function switchLocale(page: Page) {
  await page.locator('.locale-menu__trigger').click();
  await page.locator('.locale-menu__item:not([data-current])').click();
}

test('switch to zh: URL prefix flips + form input state fully preserved (zero side effects)', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'runs on the desktop tier only');
  await page.goto(VERSE_LOCKED, { waitUntil: 'networkidle' });

  // Sell-side amount input = the persistent form's controlled string state
  // (a Popover carrier would be legitimately closed by the outside-click of
  // "opening the locale menu", so it cannot serve as the zero-side-effect carrier)
  const amount = page.locator('.swap-panel input.numeric-input').first();
  await amount.fill('0.42');
  await expect(amount).toHaveValue('0.42');
  await expect(page.locator('.outrun-site')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await switchLocale(page);

  await expect(page).toHaveURL(/\/zh\/memeverse\/2$/);
  await expect(page.locator('.outrun-site')).toHaveAttribute('lang', 'zh-CN');
  // Document-level language must follow the switch too: body-mounted portals and the shell-less
  // not-found/error surfaces inherit <html lang>, not the .outrun-site subtree declaration
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  // Core: after soft navigation + refresh the input value survives (page tree not remounted)
  await expect(amount).toBeVisible();
  await expect(amount).toHaveValue('0.42');
});

test('back key after switching to en: popstate reconciliation restores render language consistent with the URL', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'runs on the desktop tier only');
  await page.goto(`/zh${VERSE_LOCKED}`, { waitUntil: 'networkidle' });
  await expect(page.locator('.outrun-site')).toHaveAttribute('lang', 'zh-CN');

  await switchLocale(page); // zh → en
  await expect(page).toHaveURL(/memeverse\/2$/);
  await expect(page.locator('.outrun-site')).toHaveAttribute('lang', 'en');

  // Back key: popstate first restores the shared-segment cache (= post-switch en) →
  // the URL is back at /zh, mismatching the render → the reconciliation refresh
  // re-fetches the zh payload (assertion auto-retry covers the 100ms delay +
  // refresh round trip)
  await page.goBack();
  await expect(page).toHaveURL(/\/zh\/memeverse\/2$/);
  await expect(page.locator('.outrun-site')).toHaveAttribute('lang', 'zh-CN');
});

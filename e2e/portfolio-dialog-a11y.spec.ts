import { expect, test, type Locator, type Page } from '@playwright/test';

// portfolio dialog interaction-contract e2e: completes
// the asset area's three interaction exits — desktop inline Convert/Bridge
// dialogs + mobile AssetActionsSheet (including the nested task dialog;
// panel-hosts-context contract: Esc closes only the dialog, the sheet stays).
// Assertion standard same as dialog-a11y.spec: DialogTitle/SheetTitle
// accessible-name anchor resolution, focus entry + Tab trap round-trip + Esc
// close restoring the trigger (adjunct popover interaction contract); structural
// assertions use the DOM itself (chips wording / data-selected migration /
// aria-label wiring), except trigger names — same as the verse pages, e2e
// defaults to en. No screenshots, no snapshots.
// Tiers: inline dialogs desktop only (inline buttons hidden ≤54rem, hit layer
// hidden ≥54rem — mutually exclusive visibility); sheet mobile only (same panel
// DOM, tablet is isomorphic and not locked twice).

const DIALOG = '[data-slot="dialog-content"]';
const SHEET = '[data-slot="sheet-content"]';

async function connectWallet(page: Page) {
  const control = page.locator('.wallet-control');
  await control.click();
  await expect(control).toHaveAttribute('aria-pressed', 'true');
}

/** DialogTitle/SheetTitle anchor: the layer's aria-labelledby resolves to an in-place title */
async function assertTitleAnchor(page: Page, layer: Locator) {
  const labelledBy = await layer.getAttribute('aria-labelledby');
  expect(labelledBy, 'layer should have aria-labelledby (title anchor)').toBeTruthy();
  await expect(page.locator(`[id="${labelledBy}"]`)).toBeAttached();
}

/** Adjunct popover contract: focus enters → Tab past edge traps back → Esc closes and restores the trigger */
async function assertLayerContract(page: Page, layer: string, trigger: Locator) {
  await expect
    .poll(() => page.evaluate((sel) => !!document.activeElement?.closest(sel), layer), {
      message: 'focus should enter the dialog after open',
    })
    .toBe(true);
  // base-ui trapping is an asynchronous focusout round-trip (not synchronous
  // interception); assert the steady state (same standard as the chain dialog)
  for (let i = 0; i < 8; i += 1) await page.keyboard.press('Tab');
  await expect
    .poll(() => page.evaluate((sel) => !!document.activeElement?.closest(sel), layer), {
      message: 'focus should return inside the dialog after Tab past the edge (trap steady state)',
    })
    .toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator(layer)).toHaveCount(0);
  await expect(trigger).toBeFocused();
}

/** First asset row containing a Convert exit (uAsset with a PSM pairing; row picked by DOM text, not a pinned index) */
function convertibleRow(page: Page) {
  return page
    .locator('.pf-asset-row')
    .filter({ has: page.locator('button', { hasText: 'Convert' }) })
    .first();
}

test('portfolio Convert dialog: title anchor + layer contract + mode switch', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-1280',
    'inline dialogs run on the desktop tier only',
  );
  await page.goto('/portfolio', { waitUntil: 'networkidle' });
  await connectWallet(page);

  const trigger = convertibleRow(page).getByRole('button', { name: 'Convert', exact: true });
  await trigger.click();
  const dialog = page.locator(DIALOG);
  await expect(dialog).toBeVisible();
  await assertTitleAnchor(page, dialog);

  // mint/redeem mode switch: chips are a two-button group; data-selected moves
  // with the click (unselected = attribute absent)
  const chips = dialog.locator('[role="group"] button');
  await expect(chips).toHaveCount(2);
  await chips.nth(1).click();
  await expect(chips.nth(1)).toHaveAttribute('data-selected', 'true');
  await expect(chips.nth(0)).not.toHaveAttribute('data-selected', 'true');

  // Amount input accessible-name wiring (AmountField aria-label)
  await expect(dialog.locator('input')).toHaveAttribute('aria-label', /.+/);

  await assertLayerContract(page, DIALOG, trigger);
});

test('portfolio Bridge dialog: title anchor + from/to groups + layer contract', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-1280',
    'inline dialogs run on the desktop tier only',
  );
  await page.goto('/portfolio', { waitUntil: 'networkidle' });
  await connectWallet(page);

  const trigger = convertibleRow(page).getByRole('button', { name: 'Bridge', exact: true });
  await trigger.click();
  const dialog = page.locator(DIALOG);
  await expect(dialog).toBeVisible();
  await assertTitleAnchor(page, dialog);

  // from/to chain selectors each form a group (role=group ×2)
  await expect(dialog.locator('[role="group"]')).toHaveCount(2);

  await assertLayerContract(page, DIALOG, trigger);
});

test('portfolio AssetActionsSheet: hit-layer accessible name + sheet title anchor + nested Convert', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'mobile-390',
    'asset actions sheet runs on the mobile tier only (hit layer visible <=54rem)',
  );
  await page.goto('/portfolio', { waitUntil: 'networkidle' });
  await connectWallet(page);

  // Mobile deck shows one zone at a time: the connected state defaults to the
  // action zone (when actions exist), so switch to the money zone first, then
  // trigger the hit layer
  await page.locator('.pf-zone-tabs button', { hasText: 'Assets' }).click();
  await expect(page.locator('[data-zone-wrap="money"]')).toBeVisible();

  // Hit layer = non-native button div; the accessible name must be explicit (aria-label wiring)
  const hit = convertibleRow(page).locator('.pf-asset-row__hit');
  await expect(hit).toHaveAttribute('aria-label', /.+/);
  await hit.click();

  const sheet = page.locator(SHEET);
  await expect(sheet).toBeVisible();
  await assertTitleAnchor(page, sheet);

  // Nested task dialog: the CTA-row Convert Portal stacks on top of the sheet;
  // Esc closes only the dialog, the sheet hosting the context stays
  await sheet.getByRole('button', { name: 'Convert', exact: true }).click();
  const dialog = page.locator(DIALOG);
  await expect(dialog).toBeVisible();
  await assertTitleAnchor(page, dialog);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(sheet).toBeVisible();

  // Sheet close button dismisses the sheet
  await sheet.locator('button.pol-mint__close').click();
  await expect(page.locator(SHEET)).toHaveCount(0);
});

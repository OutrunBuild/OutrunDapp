import { expect, test } from '@playwright/test';

// Settings-layer custom-input regression (covers
// components/global/swap-settings.tsx): the controlled value is stored as a
// string and displayed verbatim — per-keystroke decimal points are not
// swallowed. The old number state silently rewrote '0.' back to '0' (typing
// 0.25 produced 25, 1.5 produced 15), making the "non-whole-minute
// inline error" reachable only via paste.
// Assertions use semantic selectors, not pinned copy; desktop tier only (same
// standard as dialog-a11y.spec); no screenshots, no snapshots.

const VERSE_LOCKED = '/memeverse/2';
const DIALOG = '[data-slot="dialog-content"]';

test('swap card settings layer: per-keystroke 0.25 keeps the dot, preset writes back, 1.5 non-whole-minute inline error', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'runs on the desktop tier only');
  await page.goto(VERSE_LOCKED, { waitUntil: 'networkidle' });

  await page.locator('.swap-panel .swap-panel__settings-toggle').click();
  const slippage = page.locator('.swap-settings input').first();
  const deadline = page.locator('.swap-settings input').nth(1);
  await expect(slippage).toBeVisible();

  // Core regression: with 0 displayed, pressing '.' must keep the controlled
  // value '0.' (number state would rewrite it back to '0')
  await slippage.fill('0');
  await slippage.press('.');
  await expect(slippage).toHaveValue('0.');
  await slippage.press('2');
  await slippage.press('5');
  await expect(slippage).toHaveValue('0.25');
  // Derived row stays in sync (slippageToNumber chain): max slippage row reads 0.25%
  await expect(page.locator('.swap-panel__details')).toContainText('0.25%');

  // Preset click writes back String(preset)
  await page.getByRole('button', { name: '0.5%', exact: true }).click();
  await expect(slippage).toHaveValue('0.5');

  // deadline: 1 → '.' (keep the point) → '1.5' triggers the deadlineWholeMinutes
  // inline error (reachable via keyboard path)
  await deadline.fill('1');
  await deadline.press('.');
  await expect(deadline).toHaveValue('1.');
  await deadline.press('5');
  await expect(deadline).toHaveValue('1.5');
  await expect(deadline).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('.swap-settings [role="alert"]')).toBeVisible();
});

test('swap CTA gating: disconnected = Connect clickable, connected = action button disabled (prototype does not fake execution)', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', 'runs on the desktop tier only');
  await page.goto(VERSE_LOCKED, { waitUntil: 'networkidle' });

  const cta = page.locator('.swap-panel__cta');
  await expect(cta).toBeEnabled();
  // Disconnected button = Connect Wallet; clicking toggles the site-wide simulated connection
  await cta.click();
  // Connected = action button always disabled (DialogCta disabled defaults to
  // true; regression pin: the connected action button must never turn clickable)
  await expect(cta).toBeDisabled();
});

test('Mint POL dialog settings layer (toolbar wiring): slippage per-keystroke decimal point not swallowed', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-1280',
    'dialog assertions run on the desktop tier only',
  );
  await page.goto(VERSE_LOCKED, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Tokenization' }).click();
  await page.getByRole('button', { name: 'Mint', exact: true }).click();
  const dialog = page.locator(DIALOG);
  await expect(dialog).toBeVisible();

  await dialog.locator('.swap-panel__settings-toggle').click();
  // The Popover layer is portaled to body (not inside the dialog-content
  // subtree), so locate at page level (same as test 1)
  const slippage = page.locator('.swap-settings input').first();
  await expect(slippage).toBeVisible();

  await slippage.fill('0');
  await slippage.press('.');
  await expect(slippage).toHaveValue('0.');
  await slippage.press('2');
  await slippage.press('5');
  await expect(slippage).toHaveValue('0.25');
});

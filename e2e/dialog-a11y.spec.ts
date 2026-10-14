import { expect, test, type Locator, type Page } from '@playwright/test';

// Dialog output-area aria wiring assertions (tests open dialogs directly):
// the last test additionally covers the adjunct popover interaction contract
// (Esc / focus trap / focus restore) on the chain selector dialog.
// Verifies the general "output ledger box a11y" rule —
// the output field container has role="group" and aria-labelledby
// resolving to the head label span; each read-only <output>'s composite
// aria-label contains the field label text + same-row token-chip symbol.
// Assertions use the DOM's own wording (label text + token chip), not pinned
// copy strings, so copy evolution does not break tests. Dialog routes are
// picked by fixture state: /2=locked (Liquidity pool-card two dialogs +
// Tokenization Mint/Flash Swap), /3=unlocked (Tokenization Mint/Redeem PT/Redeem YT).
// Desktop tier only (same standard as a11y.spec: same DOM, assertions do not
// vary by viewport). No screenshots, no snapshots, no a11y-baseline coupling.

const VERSE_LOCKED = '/memeverse/2';
const VERSE_UNLOCKED = '/memeverse/3';

const DIALOG = '[data-slot="dialog-content"]';

async function openDialog(page: Page, trigger: Locator) {
  await trigger.click();
  const dialog = page.locator(DIALOG);
  await expect(dialog).toBeVisible();
  return dialog;
}

async function closeDialog(page: Page) {
  await page.keyboard.press('Escape');
  await expect(page.locator(DIALOG)).toHaveCount(0);
}

/** Output ledger box three-layer wiring: output → same-row token-chip symbol;
 *  output → ancestor group → labelledby → unique label span;
 *  output composite aria-label ⊇ label text + token symbol */
async function assertOutputWiring(scope: Locator, name: string) {
  const outputs = scope.locator('output');
  const count = await outputs.count();
  expect(count, `${name}: should have read-only output(s)`).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const out = outputs.nth(i);
    const symbol = (
      await out.locator('xpath=..').locator('.swap-panel__token strong').innerText()
    ).trim();
    const group = out.locator('xpath=ancestor::div[@role="group"][1]');
    await expect(
      group,
      `${name} output#${i}: should belong to a role="group" output box`,
    ).toHaveCount(1);
    const labelledBy = await group.getAttribute('aria-labelledby');
    expect(labelledBy, `${name} output#${i}: group should have aria-labelledby`).toBeTruthy();
    const labelSpan = scope.locator(`[id="${labelledBy}"]`);
    await expect(
      labelSpan,
      `${name} output#${i}: aria-labelledby should resolve to a unique label span`,
    ).toHaveCount(1);
    const ariaLabel = (await out.getAttribute('aria-label')) ?? '';
    expect(ariaLabel, `${name} output#${i}: output should have a composite aria-label`).toContain(
      (await labelSpan.innerText()).trim(),
    );
    expect(
      ariaLabel,
      `${name} output#${i}: aria-label should contain same-row token symbol ${symbol}`,
    ).toContain(symbol);
  }
}

test('dialog aria: Liquidity pool card Add = one output / Remove = two outputs', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-1280',
    'dialog assertions run on the desktop tier only',
  );
  await page.goto(VERSE_LOCKED, { waitUntil: 'networkidle' });
  const card = page.locator('.pool-card').first();

  const add = await openDialog(page, card.getByRole('button', { name: 'Add', exact: true }));
  expect(await add.locator('output').count()).toBe(1);
  await assertOutputWiring(add, 'Add Liquidity');
  await closeDialog(page);

  const remove = await openDialog(page, card.getByRole('button', { name: 'Remove', exact: true }));
  expect(await remove.locator('output').count()).toBe(2);
  await assertOutputWiring(remove, 'Remove Liquidity');
});

test('dialog aria: Tokenization(locked) Mint / Flash Swap', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-1280',
    'dialog assertions run on the desktop tier only',
  );
  await page.goto(VERSE_LOCKED, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Tokenization' }).click();

  const mint = await openDialog(page, page.getByRole('button', { name: 'Mint', exact: true }));
  expect(await mint.locator('output').count()).toBe(1);
  await assertOutputWiring(mint, 'Mint POL');
  await closeDialog(page);

  const flash = await openDialog(
    page,
    page.getByRole('button', { name: 'Flash Swap', exact: true }),
  );
  expect(await flash.locator('output').count()).toBe(1);
  await assertOutputWiring(flash, 'Flash Swap');
});

test('dialog aria: Tokenization(unlocked) Mint / Redeem PT = one output / Redeem YT = two outputs', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-1280',
    'dialog assertions run on the desktop tier only',
  );
  await page.goto(VERSE_UNLOCKED, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Tokenization' }).click();

  const mint = await openDialog(page, page.getByRole('button', { name: 'Mint', exact: true }));
  expect(await mint.locator('output').count()).toBe(1);
  await assertOutputWiring(mint, 'Mint POL');
  await closeDialog(page);

  const redeemPt = await openDialog(
    page,
    page.getByRole('button', { name: 'Redeem PT', exact: true }),
  );
  expect(await redeemPt.locator('output').count()).toBe(1);
  await assertOutputWiring(redeemPt, 'Redeem PT');
  await closeDialog(page);

  const redeemYt = await openDialog(
    page,
    page.getByRole('button', { name: 'Redeem YT', exact: true }),
  );
  expect(await redeemYt.locator('output').count()).toBe(2);
  await assertOutputWiring(redeemYt, 'Redeem YT');
});

test('swap card buy output aria wiring (page-level, no dialog)', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-1280',
    'page-level output wiring runs on the desktop tier only',
  );
  await page.goto(VERSE_LOCKED, { waitUntil: 'networkidle' });
  const desk = page.locator('.swap-panel').first();
  await expect(desk.locator('output').first()).toBeVisible();
  expect(await desk.locator('output').count()).toBe(1);
  await assertOutputWiring(desk, 'Swap card buy');
});

test('chain selector dialog: DialogTitle wiring + focus trap + Esc close restores trigger', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-1280',
    'dialog assertions run on the desktop tier only',
  );
  await page.goto('/', { waitUntil: 'networkidle' });
  const trigger = page.locator('.chain-dialog__trigger');
  await trigger.click();
  const dialog = page.locator(DIALOG);
  await expect(dialog).toBeVisible();

  // DialogTitle wiring: the dialog accessible-name anchor resolves to the
  // in-panel title (ui/dialog.tsx "required to pass a11y")
  const labelledBy = await dialog.getAttribute('aria-labelledby');
  expect(labelledBy, 'DialogContent should have aria-labelledby (DialogTitle anchor)').toBeTruthy();
  await expect(page.locator(`[id="${labelledBy}"]`)).toBeAttached();

  // Focus enters the dialog after open (modal contract; base-ui initialFocus
  // settles asynchronously, wait before Tab)
  await expect
    .poll(
      () => page.evaluate(() => !!document.activeElement?.closest('[data-slot="dialog-content"]')),
      {
        message: 'focus should enter the dialog after open',
      },
    )
    .toBe(true);

  // Focus trap (adjunct popover contract): repeated Tab past the dialog's last
  // element — base-ui trapping is an asynchronous focusout re-round-trip
  // (not a synchronous interception; the same primitive behavior for all
  // ui/dialog dialogs in the repo), so assert the steady state: focus is back
  // inside the dialog and the dialog did not close
  for (let i = 0; i < 8; i += 1) await page.keyboard.press('Tab');
  await expect
    .poll(
      () => page.evaluate(() => !!document.activeElement?.closest('[data-slot="dialog-content"]')),
      {
        message:
          'focus should return inside the dialog after Tab past the edge (trap steady state)',
      },
    )
    .toBe(true);
  await expect(page.locator(DIALOG)).toBeVisible();

  // Esc closes + focus restored to trigger (adjunct popover contract)
  await page.keyboard.press('Escape');
  await expect(page.locator(DIALOG)).toHaveCount(0);
  await expect(trigger).toBeFocused();

  // select semantics preserved (the chain dialog is the sole entry point for
  // chain switching): picking a non-first chain writes ?chain=, picking the first
  // chain again removes the param
  await trigger.click();
  await expect(dialog).toBeVisible();
  await dialog.locator('.chain-dialog__option').nth(1).click();
  await expect(page).toHaveURL(/chain=/);
  await trigger.click();
  await expect(dialog).toBeVisible();
  await dialog.locator('.chain-dialog__option').first().click();
  await expect(page).not.toHaveURL(/chain=/);
});

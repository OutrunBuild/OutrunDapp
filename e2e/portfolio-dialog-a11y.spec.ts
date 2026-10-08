import { expect, test, type Locator, type Page } from '@playwright/test';

// portfolio 弹窗交互契约 e2e（fix-review F3 落地）：补齐资产区三类交互出口——
// 桌面行内 Convert/Bridge 弹窗 + 移动端 AssetActionsSheet（含嵌套任务弹窗，
// 面板承载上下文契约：Esc 只关弹窗、面板不收）。断言口径同 dialog-a11y.spec：
// DialogTitle/SheetTitle 可达名锚点解析、焦点进入 + Tab 圈闭回笼 + Esc 关闭还原触发器
// （附则弹层交互契约）；结构断言取 DOM 自身（chips 组词/data-selected 迁移/aria-label
// 接线），触发器名除外——同 verse 口径，e2e 默认 en。不截屏、不写快照。
// 档位：行内弹窗仅桌面档（行内钮 ≤54rem 隐藏、hit 层 ≥54rem 隐藏，互斥显隐）；
// sheet 仅移动档（同一面板 DOM，tablet 同构不重复锁）。

const DIALOG = '[data-slot="dialog-content"]';
const SHEET = '[data-slot="sheet-content"]';

async function connectWallet(page: Page) {
  const control = page.locator('.wallet-control');
  await control.click();
  await expect(control).toHaveAttribute('aria-pressed', 'true');
}

/** DialogTitle/SheetTitle 锚点：弹层 aria-labelledby 解析到在位标题 */
async function assertTitleAnchor(page: Page, layer: Locator) {
  const labelledBy = await layer.getAttribute('aria-labelledby');
  expect(labelledBy, '弹层应有 aria-labelledby（标题锚点）').toBeTruthy();
  await expect(page.locator(`[id="${labelledBy}"]`)).toBeAttached();
}

/** 附则弹层契约：焦点进入 → Tab 出界圈闭回笼 → Esc 关闭并还原触发器 */
async function assertLayerContract(page: Page, layer: string, trigger: Locator) {
  await expect
    .poll(() => page.evaluate((sel) => !!document.activeElement?.closest(sel), layer), {
      message: '打开后焦点应进入弹窗',
    })
    .toBe(true);
  // base-ui 圈闭为 focusout 异步回笼（非同步拦截），断言稳态（同链选择弹窗口径）
  for (let i = 0; i < 8; i += 1) await page.keyboard.press('Tab');
  await expect
    .poll(() => page.evaluate((sel) => !!document.activeElement?.closest(sel), layer), {
      message: 'Tab 出界后焦点应回笼弹窗（圈闭稳态）',
    })
    .toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator(layer)).toHaveCount(0);
  await expect(trigger).toBeFocused();
}

/** 首个含 Convert 出口的资产行（uAsset 且有 PSM 配对；行选择按 DOM 文本不钉索引） */
function convertibleRow(page: Page) {
  return page
    .locator('.pf-asset-row')
    .filter({ has: page.locator('button', { hasText: 'Convert' }) })
    .first();
}

test('portfolio Convert 弹窗：标题锚点 + 弹层契约 + 模式切换', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', '行内弹窗仅桌面档');
  await page.goto('/portfolio', { waitUntil: 'networkidle' });
  await connectWallet(page);

  const trigger = convertibleRow(page).getByRole('button', { name: 'Convert', exact: true });
  await trigger.click();
  const dialog = page.locator(DIALOG);
  await expect(dialog).toBeVisible();
  await assertTitleAnchor(page, dialog);

  // mint/redeem 模式切换：chips 双钮一组，data-selected 随点击迁移（未选=无属性）
  const chips = dialog.locator('[role="group"] button');
  await expect(chips).toHaveCount(2);
  await chips.nth(1).click();
  await expect(chips.nth(1)).toHaveAttribute('data-selected', 'true');
  await expect(chips.nth(0)).not.toHaveAttribute('data-selected', 'true');

  // 金额输入可达名接线（AmountField aria-label）
  await expect(dialog.locator('input')).toHaveAttribute('aria-label', /.+/);

  await assertLayerContract(page, DIALOG, trigger);
});

test('portfolio Bridge 弹窗：标题锚点 + from/to 双组 + 弹层契约', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', '行内弹窗仅桌面档');
  await page.goto('/portfolio', { waitUntil: 'networkidle' });
  await connectWallet(page);

  const trigger = convertibleRow(page).getByRole('button', { name: 'Bridge', exact: true });
  await trigger.click();
  const dialog = page.locator(DIALOG);
  await expect(dialog).toBeVisible();
  await assertTitleAnchor(page, dialog);

  // from/to 链选择各成组（role=group ×2）
  await expect(dialog.locator('[role="group"]')).toHaveCount(2);

  await assertLayerContract(page, DIALOG, trigger);
});

test('portfolio AssetActionsSheet：hit 层可达名 + sheet 标题锚点 + 嵌套 Convert', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-390', '资产操作面板仅移动档（hit 层 ≤54rem 显示）');
  await page.goto('/portfolio', { waitUntil: 'networkidle' });
  await connectWallet(page);

  // 移动端 deck 一次显一区：连接态默认 action 区（有 actions 时），先切 money 区再触 hit 层
  await page.locator('.pf-zone-tabs button', { hasText: 'Assets' }).click();
  await expect(page.locator('[data-zone-wrap="money"]')).toBeVisible();

  // hit 层=非原生钮 div，可访问名必须显式（aria-label 接线）
  const hit = convertibleRow(page).locator('.pf-asset-row__hit');
  await expect(hit).toHaveAttribute('aria-label', /.+/);
  await hit.click();

  const sheet = page.locator(SHEET);
  await expect(sheet).toBeVisible();
  await assertTitleAnchor(page, sheet);

  // 嵌套任务弹窗：CTA 行 Convert Portal 叠上面板；Esc 只关弹窗、面板承载上下文不收
  await sheet.getByRole('button', { name: 'Convert', exact: true }).click();
  const dialog = page.locator(DIALOG);
  await expect(dialog).toBeVisible();
  await assertTitleAnchor(page, dialog);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(sheet).toBeVisible();

  // 面板关闭钮收面板
  await sheet.locator('button.pol-mint__close').click();
  await expect(page.locator(SHEET)).toHaveCount(0);
});

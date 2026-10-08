import { expect, test } from '@playwright/test';

// 设置层自定义输入回归（P1-1，2026-10-08 收敛 components/global/swap-settings.tsx）：
// 受控值存 string 原样展示——逐键输入的小数点不被吞。旧 number 状态把 '0.' 静默
// 回写 '0'（0.25 键成 25、1.5 键成 15），§25 拍板 A「非整分钟就地报错」仅粘贴可达。
// 断言取语义 selector 不钉 copy；仅桌面档（同 dialog-a11y.spec 口径）、不截屏不写快照。

const VERSE_LOCKED = '/memeverse/2';
const DIALOG = '[data-slot="dialog-content"]';

test('swap 卡设置层：逐键 0.25 点不吞、预设回写、1.5 非整分钟就地报错', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', '弹窗断言仅桌面档');
  await page.goto(VERSE_LOCKED, { waitUntil: 'networkidle' });

  await page.locator('.swap-panel .swap-panel__settings-toggle').click();
  const slippage = page.locator('.swap-settings input').first();
  const deadline = page.locator('.swap-settings input').nth(1);
  await expect(slippage).toBeVisible();

  // P1-1 核心：显示 0 时敲 '.'，受控值必须仍是 '0.'（number 状态会被回写 '0'）
  await slippage.fill('0');
  await slippage.press('.');
  await expect(slippage).toHaveValue('0.');
  await slippage.press('2');
  await slippage.press('5');
  await expect(slippage).toHaveValue('0.25');
  // 推导行同步（slippageToNumber 链路）：最大滑点行读 0.25%
  await expect(page.locator('.swap-panel__details')).toContainText('0.25%');

  // 预设点击回写 String(preset)
  await page.getByRole('button', { name: '0.5%', exact: true }).click();
  await expect(slippage).toHaveValue('0.5');

  // deadline：1 → '.'（留点）→ '1.5' 触发 deadlineWholeMinutes 就地报错（键盘路径可达）
  await deadline.fill('1');
  await deadline.press('.');
  await expect(deadline).toHaveValue('1.');
  await deadline.press('5');
  await expect(deadline).toHaveValue('1.5');
  await expect(deadline).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('.swap-settings [role="alert"]')).toBeVisible();
});

test('swap CTA 门控：未连接=Connect 可点、连接后=动作钮禁用（原型不伪造成交）', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', '弹窗断言仅桌面档');
  await page.goto(VERSE_LOCKED, { waitUntil: 'networkidle' });

  const cta = page.locator('.swap-panel__cta');
  await expect(cta).toBeEnabled();
  // 未连接钮=Connect Wallet，点击切换全站模拟连接
  await cta.click();
  // 已连接=动作钮恒禁用（DialogCta disabled 缺省=true，fix-review F1 回归钉）
  await expect(cta).toBeDisabled();
});

test('Mint POL 弹窗设置层（toolbar 接线）：滑点逐键小数点不吞', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', '弹窗断言仅桌面档');
  await page.goto(VERSE_LOCKED, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Tokenization' }).click();
  await page.getByRole('button', { name: 'Mint', exact: true }).click();
  const dialog = page.locator(DIALOG);
  await expect(dialog).toBeVisible();

  await dialog.locator('.swap-panel__settings-toggle').click();
  // Popover 弹层 Portal 挂 body（不在 dialog-content 子树），按页面级取（同测试 1）
  const slippage = page.locator('.swap-settings input').first();
  await expect(slippage).toBeVisible();

  await slippage.fill('0');
  await slippage.press('.');
  await expect(slippage).toHaveValue('0.');
  await slippage.press('2');
  await slippage.press('5');
  await expect(slippage).toHaveValue('0.25');
});

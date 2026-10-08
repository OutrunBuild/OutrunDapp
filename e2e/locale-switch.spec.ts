import { expect, test, type Page } from '@playwright/test';

// 语言切换零副作用回归闸（2026-10-08 测试盲区裁决 [F]；裁决本体 = architecture.md §22
// 2026-09-26）：/zh 与无前缀形态共用 /en 路由树，切换 = push+refresh 仅换语言载荷、
// 组件状态全保；返回键经 popstate 对账恢复「URL 口径 = 渲染语言」。断言取语义
// selector 与 URL/lang 属性，不钉 copy；仅桌面档（同 dialog-a11y/swap-settings 口径）、
// 不截屏不写快照。

const VERSE_LOCKED = '/memeverse/2';

/** 点开语言菜单并切到对端语言（当前项 data-current="true"，目标项无该属性） */
async function switchLocale(page: Page) {
  await page.locator('.locale-menu__trigger').click();
  await page.locator('.locale-menu__item:not([data-current])').click();
}

test('切到中文：URL 前缀翻转 + 表单输入态全保（零副作用本体）', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', '弹窗断言仅桌面档');
  await page.goto(VERSE_LOCKED, { waitUntil: 'networkidle' });

  // 卖出侧金额输入 = 常驻表单的受控 string 状态（Popover 载体会被「点开语言菜单」
  // 这一浮层外点击正常关闭，不能当零副作用载体）
  const amount = page.locator('.swap-panel input.numeric-input').first();
  await amount.fill('0.42');
  await expect(amount).toHaveValue('0.42');
  await expect(page.locator('.outrun-site')).toHaveAttribute('lang', 'en');

  await switchLocale(page);

  await expect(page).toHaveURL(/\/zh\/memeverse\/2$/);
  await expect(page.locator('.outrun-site')).toHaveAttribute('lang', 'zh-CN');
  // 核心：软导航 + refresh 后输入值仍在（页面树不重挂载）
  await expect(amount).toBeVisible();
  await expect(amount).toHaveValue('0.42');
});

test('切回英文后按返回键：popstate 对账恢复渲染语言与 URL 一致', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1280', '弹窗断言仅桌面档');
  await page.goto(`/zh${VERSE_LOCKED}`, { waitUntil: 'networkidle' });
  await expect(page.locator('.outrun-site')).toHaveAttribute('lang', 'zh-CN');

  await switchLocale(page); // zh → en
  await expect(page).toHaveURL(/memeverse\/2$/);
  await expect(page.locator('.outrun-site')).toHaveAttribute('lang', 'en');

  // 返回键：popstate 先恢复共享段缓存（= 切换后的 en）→ URL 已回 /zh 与渲染错位 →
  // 对账 refresh 重取 zh 载荷（断言自动重试覆盖 100ms 延时 + refresh 往返）
  await page.goBack();
  await expect(page).toHaveURL(/\/zh\/memeverse\/2$/);
  await expect(page.locator('.outrun-site')).toHaveAttribute('lang', 'zh-CN');
});

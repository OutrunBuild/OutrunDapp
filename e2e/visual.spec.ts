import { expect, test, type Page } from '@playwright/test';
import { FIXED_NOW, PAGES, ZH_PAGES } from './pages';

// 视觉基线（agent-workflow.md §3.2）：已入基线路由的三档视口整页截图。
// 时钟钉死在 2026-10-01（晚于 fixtures 已过的静态时间戳），倒计时/相对时间逐像素确定；
// 动效冻结走 reduced-motion + animation:none 双保险。
// 首次跑自动写入基线（e2e/*-snapshots/，入库）；更新基线必须人工确认 diff：
//   pnpm test:e2e -- --update-snapshots
//
// 整页截图对 position:fixed/sticky 有已知采集伪影（captureBeyondViewport 单帧采集，fixed 冻结于
// 初始视口位、sticky 落回流位）：mobile/tablet 基线里固定底导航悬浮在 y=视口高−64（390 档 780、
// 860 档 836）压住中部内容；desktop 基线里 100dvh 侧栏只画首屏 ~800px。
// 真人视口不存在这些画面（底栏钉视口底缘、内容滚过其下）——预期噪音，勿据此修页面（§3.2 告示）。

test.beforeEach(async ({ page }) => {
  // install 后 pauseAt：时间冻结不走表，跑测试的几秒内 Date.now() 也恒定
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
  // paint worklet 就位闸（2026-10-07）：注册前 paint() 光栅化为空（按钮无描边只剩文字），
  // 曾把 zh 基线写坏；PaintSkin 注册完成打 html[data-paint-ready]。超时兜底吞掉
  // （非 Chromium/装载失败走 CSS 回落时标记仍会置位，此闸只防竞态不判错）
  await page.waitForSelector('html[data-paint-ready]', { timeout: 2000 }).catch(() => {});
  // K 线 canvas 与字体布局的收敛余量
  await page.waitForTimeout(300);
}

async function connectWallet(page: Page) {
  // 产品壳仅 product-topbar 一处钱包钮（marketing-header 只在 home 壳）
  const control = page.locator('.wallet-control');
  await control.click();
  await expect(control).toHaveAttribute('aria-pressed', 'true');
}

async function shoot(page: Page, name: string, path: string, connect = false) {
  const res = await page.goto(path, { waitUntil: 'networkidle' });
  expect(res?.status(), `${path} 应为 200`).toBe(200);
  if (connect) await connectWallet(page);
  await stabilize(page);
  await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
}

for (const { name, path, connectWallet } of PAGES) {
  test(`visual: ${name}`, async ({ page }) => {
    await shoot(page, name, path, connectWallet === true);
  });
}

// zh 只锁移动端档（与 agent-workflow §3.2「/zh 移动端一张」口径一致）
for (const { name, path, connectWallet } of ZH_PAGES) {
  test(`visual: ${name}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-390', 'zh 仅移动端档');
    await shoot(page, name, path, connectWallet === true);
  });
}

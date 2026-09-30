import { defineConfig } from '@playwright/test';

// 视觉基线 + axe 的运行口径（agent-workflow.md §3.2）：
// - 三档视口 = 仓库约定 1280×800 / 860×900 / 390×844，DPR 固定 1（规避切角描边/Worklet 的亚像素漂移）
// - 服务走 NEXT_DIST_DIR=.next-e2e 独立构建，不碰 .next（与运行中 dev/预览无冲突）
// - 首次跑自动写入基线快照（e2e/*-snapshots/，入库）；此后改样式跑一次即出像素 diff
// - 更新基线：pnpm test:e2e -- --update-snapshots（必须人工确认 diff 是预期改动）

const PORT = 4188;
const BASE = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  // 视觉比对容差：1% 像素差以内视为通过（canvas 图表与抗锯齿余量；真回归远超此值）
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
    command: 'NEXT_DIST_DIR=.next-e2e pnpm build && NEXT_DIST_DIR=.next-e2e pnpm start -p 4188',
    url: `${BASE}/`,
    reuseExistingServer: true,
    timeout: 420_000,
  },
});

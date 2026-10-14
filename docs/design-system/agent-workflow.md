# Agent 工作流（Agent Workflow）

> 面向在本仓库继续开发 UI 的任何 Agent。目标：不重新发明、不违反决议、交付可验证。

## 1. 开工前（5 分钟）

1. 读 `docs/design-system/README.md`（本目录入口）与硬约束十条。
2. 按任务读对应章节：foundations / components / patterns / copy-and-i18n。
3. 打开真实源确认细节：`components/design-system/tokens.css`、`app/globals.css` 中相关 class、`components/global/signal-ui.tsx`、`copy.ts`。
4. 若任务涉及领域组件行为（金额输入、资产/链选择、交易审阅/状态、账户能力、空态）：读 `components/design-system/component-contract.md` 对应条目 + `state-matrix.md`。
5. 若任务会改变品牌方向、色板、字体角色、密度：**停止**，这需要新决议写入 `docs/design/decision-log.md` 并由人工签署。

## 2. 实施规则

- 复用顺序：格式化函数 → `components/ui` → `signal-ui` 原子 → `globals.css` 页面 class → 新建。
- import 路径风格：components↔components 一律相对（同桶 `./x`、跨桶 `../bucket/x`）；到 `ui` 基件与 `lib` 一律别名（`@/components/ui/x`、`@/lib/x`）；`app`→components 一律别名（`@/components/<桶>/x`）。
- 新 token 先进 `tokens.css` + `token-contract.md`；新组件/模式登记到 `components.md`。
- 登记条目=现行状态单一版本：更新=改写原条目，不追加重复行、不续写裁定流水；日期/轮数/被否候选编年只进 `decision-log.md`，条目内至多保留一句禁令或 rationale（`pnpm check:design-docs` 拦重复与超长）。
- 文案两语言同时加；数字全部 `data-numeric`。
- 不在页面里重复壳层内容（网格、扫描线、状态簇、语言切换、钱包）。
- CSS 命名 `block__element`，状态 `data-*`；不用 `!important`（`.mobile-filter-toggle` 的 display 是历史特例）。
- shadcn 用 `pnpm dlx shadcn@latest add <name>`；添加后读一遍文件，确认没有硬编码颜色、`asChild`（本项目是 base 原语，用 `render`）。

## 3. 交付前验证

### 3.1 静态

```bash
pnpm exec tsc --noEmit
pnpm exec lint        # 本仓已配 ESLint 10 flat config
pnpm check:design     # 裸值扫描（scripts/check-design-bare-values.mjs，--self-test 自检）
pnpm check:contrast   # token 对比度双闸门（scripts/check-design-contrast.mjs，--self-test 自检）
pnpm check:design-docs # 登记文档闸（scripts/check-design-docs.mjs，--self-test 自检）
```

登记文档闸：components.md §6 模式名重复 FAIL（防「更新时追加新行不删旧行」事故）、docs/design-system/*.md 单行超 12,000 字符 FAIL（格式改造落地后逐档下调）；叙事日期（YYYY-MM-DD）= FAIL——沿革只进 decision-log，豁免表见脚本文件头（现仅 e2e 时钟钉定值一条）。

裸值扫描（实现与豁免表见脚本文件头）：产品 `components/`、`app/` 的 `.tsx` 中裸 `#hex`、Tailwind 原始调色板类、`space-x/y-*`、`transition: 'all'`（含内联样式引号形态）；注释先剥离（注释里的 issue 号 `#1178` 不误报）；豁免表唯一条目 = `app/layout.tsx` 的 viewport `themeColor`（meta 无法引用 CSS 变量，品牌锚必要镜像）。

对比度闸门：从 `tokens.css` 解析实际 hex 按配对表算 WCAG 比率，双校验——低于下限（正文 4.5 / 大字图形 3.0）= 回归 FAIL；与 `DESIGN.md` §2 登记实测值差 >0.05 = 文档漂移 FAIL。边框装饰对（`--color-border(-strong)`）无 WCAG 下限（min 1.0），doc 按登记 hex 现算、仅承担值锁防漂移——边框渲染面积低于视觉基线 `maxDiffPixelRatio` 阈值，像素闸门不保证拦截，值锁补位。改 token 颜色必须同步 `DESIGN.md` §2 与脚本配对表（色值本身变更走 decision-log 决议）。

基线：裸值 0 命中、对比度 14 配对全过、`tsc --noEmit` 通过（扩入边框值锁对 → 16 配对，含漂移开火双向验证，重跑全过）。

### 3.2 浏览器（自动基线 + 人工抽查）

已入基线的路由跑 Playwright 视觉回归：`pnpm test:e2e`。三档视口（1280×800 / 860×900 / 390×844）、DPR 固定 1、时钟钉 2026-10-01、动效冻结后整页截图比对；axe 无障碍扫描同套路由含 `/zh` 变体页（`e2e/a11y.spec.ts`，新增违规即 FAIL；zh 是不同 DOM——测试盲区裁决补录）。构建走 `NEXT_DIST_DIR=.next-e2e` 独立产物目录，**不碰 `.next`**，与运行中的 dev/生产预览无冲突（部署纪律见 AGENTS.md 已知坑）。改样式后直接跑，像素 diff 自动报出。

整页截图伪影告示：fullPage 走 CDP captureBeyondViewport 单帧采集，`position:fixed` 元素冻结在初始视口位、`sticky` 落回流位——mobile-390/tablet-860 基线里固定底导航悬浮于 y=780/836（视口高−64px）压住中部内容，desktop-1280 基线里 100dvh 侧栏只画首屏 ~800px。真人视口中底栏恒钉视口底缘、内容从其下滚过（`.product-main` ≤54rem 有 88px 底部预留）。看基线图/处理视觉 diff 时，这些是**预期噪音，勿当遮挡 bug 修页面**。

基线外的新页面/新交互，用 `agent-browser` 人工抽查，随后补进 `e2e/visual.spec.ts` 基线：

```bash
agent-browser open <preview-url>/en/memeverse --color-scheme dark
agent-browser set viewport 1280 800 && agent-browser screenshot /tmp/agent-browser/ds-desktop.png
agent-browser set viewport 860 900  && agent-browser screenshot /tmp/agent-browser/ds-tablet.png
agent-browser set viewport 390 844  && agent-browser screenshot /tmp/agent-browser/ds-mobile.png
```

再切 `/zh/...` 重复一次移动端。检查：一屏一个黄 CTA；数字等宽；focus 青环可见（Tab 一遍）；`data-glow="off"` 时仍可读（在 DevTools 改根属性）。

### 3.3 设计检测器（本仓已装）

本仓库自带 `impeccable` 技能（`.agents/skills/impeccable`）：

```bash
rtk node .agents/skills/impeccable/scripts/detect.mjs --target components/<域>/<file>.tsx
```

v0 平台侧的同名技能位于其团队记忆（`v0_memories/`），不在本仓库；两份规则以本目录真相源层级为准。


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
- 新 token 先进 `tokens.css` + `token-contract.md`；新组件/模式登记到 `components.md`。
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
```

裸值扫描（实现、豁免表与排除项见脚本文件头）：产品 `components/`、`app/` 的 `.tsx` 中裸 `#hex`、Tailwind 原始调色板类、`space-x/y-*`、`transition: 'all'`（含内联样式引号形态）；注释先剥离（注释里的 issue 号 `#1178` 不误报）；豁免表唯一条目 = `app/layout.tsx` 的 viewport `themeColor`（meta 无法引用 CSS 变量，品牌锚必要镜像）。排除 Stage-01 内部审阅工具（`components/axis-choice/`、`direction-choice/`、`app/design-review/`）。

对比度闸门：从 `tokens.css` 解析实际 hex 按配对表算 WCAG 比率，双校验——低于下限（正文 4.5 / 大字图形 3.0）= 回归 FAIL；与 `DESIGN.md` §2 登记实测值差 >0.05 = 文档漂移 FAIL。改 token 颜色必须同步 `DESIGN.md` §2 与脚本配对表（色值本身变更走 decision-log 决议）。

基线（2026-09-30）：裸值 0 命中、对比度 14 配对全过、`tsc --noEmit` 通过。

### 3.2 浏览器（自动基线 + 人工抽查）

已入基线的路由跑 Playwright 视觉回归：`pnpm test:e2e`。三档视口（1280×800 / 860×900 / 390×844）、DPR 固定 1、时钟钉 2026-10-01、动效冻结后整页截图比对；axe 无障碍扫描同套路由（`e2e/a11y.spec.ts`，新增违规即 FAIL）。构建走 `NEXT_DIST_DIR=.next-e2e` 独立产物目录，**不碰 `.next`**，与运行中的 dev/生产预览无冲突（部署纪律见 AGENTS.md 已知坑）。改样式后直接跑，像素 diff 自动报出。

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


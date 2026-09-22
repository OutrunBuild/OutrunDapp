# Agent 工作流（Agent Workflow）

> 面向在本仓库继续开发 UI 的任何 Agent。目标：不重新发明、不违反决议、交付可验证。

## 1. 开工前（5 分钟）

1. 读 `docs/design-system/README.md`（本目录入口）与硬约束十条。
2. 按任务读对应章节：foundations / components / patterns / copy-and-i18n。
3. 打开真实源确认细节：`components/design-system/tokens.css`、`app/globals.css` 中相关 class、`components/prototype/signal-ui.tsx`、`copy.ts`。
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
```

裸值扫描（产品代码应为 0 命中；排除项：`tokens.css`、`globals.css` 的 `@theme`/`:root` 桥接段，以及 `components/axis-choice/` + `app/design-review/`——这是 Stage-01 内部审阅投票工具，不是产品界面，不纳入系统约束也不要改写）：

```bash
grep -rnE "#[0-9a-fA-F]{3,8}\b" components app --include=*.tsx | grep -vE "axis-choice|design-review"
grep -rnE "\b(bg|text|border)-(red|blue|green|yellow|purple|pink|cyan|emerald|slate|zinc|gray)-[0-9]" components app --include=*.tsx
grep -rnE "transition: all|\bspace-[xy]-" components app
```

基线（2026-09-19）：三项扫描产品代码均为 0 命中，`tsc --noEmit` 通过。

### 3.2 浏览器

用 `agent-browser` 打开预览，暗色方案，三档视口各一张：

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
rtk node .agents/skills/impeccable/scripts/detect.mjs --target components/prototype/<file>.tsx
```

v0 平台侧的同名技能位于其团队记忆（`v0_memories/`），不在本仓库；两份规则以本目录真相源层级为准。


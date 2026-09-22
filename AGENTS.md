# AGENTS.md — Outrun DApp

面向在本仓库工作的任何 AI Agent（v0 / Cursor / Claude Code / Codex 等）。本文件只做路由，不重复规范。

## 项目

Next.js 16 App Router · React 19 · Tailwind v4 · shadcn（`base` 原语，非 radix）· `pnpm`。路由 `app/[locale]/…`，`locale ∈ en | zh`，默认 `en`。URL scheme（2026-09-22 方案 C）：en 无前缀（`proxy.ts` 内部 rewrite 到 `/en/**`），zh 带 `/zh` 前缀；语言切换走 `components/prototype/routes.ts` 的 `localePath`，勿手拼 `/${locale}`。memeverse 详情页 URL 用数字段 `/memeverse/<verseId 数字>`（= 链上 uint256 verseId 口径），fixture 行 id（`verse-021`）不进 URL。产品代码在 `components/prototype/`；`components/axis-choice/`、`components/direction-choice/`、`app/design-review/` 是 Stage-01 内部审阅工具，不是产品界面，不要按产品规范改写。

## 产品真源

产品功能逻辑的真相源是三个邻居仓库（冻结 commit 与逐文件登记见 `docs/page-briefs/source-map.md`）：

- **Memeverse**（`/home/azkrale/Web3Project/Memeverse`）— 合约机制 spec：创世/POLend 杠杆、四池、治理。例：杠杆创世债务额度=利息÷利率、利率一次性非年化（`src/polend/POLendUpgradeable.sol`、`src/polend/interfaces/IPOLend.sol`）
- **OutStake**（`/home/azkrale/Web3Project/OutStake`）— 合约机制 spec：PSM、USR 储蓄、Router、仓位
- **OutrunBook**（`/home/azkrale/Web3Project/OutrunBook`）— 产品叙事真相源：面向用户的解释、数值量级示例（例 `memeverse/polend.md`：5 倍放大锚点、损失上限=利息、无清算、失败全额退）

冲突规则：产品叙事以 OutrunBook 为准、机制以合约 spec 为准；冲突登记 `source-map.md` 对账区，Agent 不裁决。

工作方式：页面/交互需要机制公式或样本数值时，**先查真源**（spec 定公式、OutrunBook 定解释与量级），再把样本数据写进 `fixtures/`（schema + sourceRef 齐全，走三层边界），不要以「数据不可得」为由禁用功能或留空；只有 fixture 快照本身缺失的字段才降级为「以链上读值为准」槽位。

## 细节保真（新功能 / 新 UI 硬纪律，2026-09-22 用户裁定）

真源层级 = 三仓库 + 用户当次指定的参照物（如旧 demo）；`docs/page-briefs/*` 是派生登记，不是真源，与其上来源冲突时按上来源做、事后改 brief 登记口径。

任何新页面/新功能，**写第一行代码前**先在任务回复里产出「细节台账」，每个字段/数值/文案/交互分支标三态之一：

- **G（真源）**：三仓库或本仓架构有原文 → 引用到 文件:行；界面术语与 OutrunBook 用词一致
- **S（样本）**：真源无具体值但机制有口径 → 机制口径 + fixture 样本 + 界面标注「以链上读值为准」；参照物（旧 demo 等）的数值只能当样本，禁止当真源引用
- **Q（待拍板）**：真源与参照物都没答案 → 列成清单问用户，**Q 项未拍板不写对应代码**（用户明说「直接做」除外）

参照物必须逐屏截图逐字段核对，不接受一次性文字摘要。交付前逐项复核台账：G 抽查原文、S 确认界面标注在位、Q 确认已拍板。「不猜」的可检验形式 = 每个细节都可追溯到三态之一；出现无出处又无标注的细节即违约。

## UI 工作必读

仓库版设计系统 skill：`.agents/skills/outrun-design-system/SKILL.md`。任何 Agent（v0 / Cursor / Claude Code / Codex）处理 UI 前都应先读取它；它再路由到本目录的设计系统真相源。

任何涉及页面、组件、样式、文案的改动，先读：

1. `docs/design-system/README.md` — 设计系统入口、真相源层级、十条硬约束
2. 按任务读同目录 `foundations.md` / `components.md` / `patterns.md` / `copy-and-i18n.md`
3. 交付前按 `docs/design-system/agent-workflow.md` 验证

真相源：`DESIGN.md`（视觉定稿）→ `components/design-system/tokens.css`（唯一 token 源）→ `components/design-system/*.md`（契约）。品牌方向、色板、字体、密度的变更需要人工在 `docs/design/decision-log.md` 新增决议，Agent 不得自行执行。

## 速记

- 只用 token 与 shadcn 语义类；禁裸 `#hex`、裸 `px`、`bg-blue-500`
- 黄 = 唯一主行动（一屏一个 CTA）；青 = 链接/focus/功能信号；品红 = 仅 1–2px 回声
- 所有数字/地址/时间加 `data-numeric`，零 glow
- 阶段色走 `data-stage`（genesis 黄 / locked 品红 / unlocked 青 / refund 橙）
- 文案从 `getCopy(locale)` 取，en/zh 同时加；页面包在 `OutrunShell` 内
- shadcn base 原语：自定义触发器用 `render`；表单用 `FieldGroup + Field`；用 `gap` 不用 `space-*`

## 命令

```bash
pnpm dev
pnpm exec tsc --noEmit
pnpm dlx shadcn@latest add <component>
```

## 架构边界

- **fixture 数据边界（三层强制）**：`fixtures/**` → `lib/data/prototype-repository.ts`（唯一合法消费方）→ `components/prototype/**`。页面/组件禁止直接 import `fixtures/`，生产代码禁止反向到达；派生纪律：组件不自造领域数值——数值口径从产品真源取、样本数据落 `fixtures/`（见「产品真源」），fixture 快照缺失的字段才渲染「以链上读值为准」槽位。由 `scripts/check-fixture-boundary.mjs` 的 `--source` / `--graph production` / `--bundle .next` 三层验证。
- **双编译器桥**：`typescript` 包 = `vendor/typescript-bridge`（bin/tsc 走 TS 7.0.2 CLI，require 转发 TS 6.0.2 API）。不要直接改桥、不要用 `typescript` 的程序 API 写 TS7 语法；tsconfig 禁 TS7 废弃选项（`baseUrl`、`target: es5` 等）。
- **runbook 纪律**：阶段执行走 `docs/runbooks/stage-0N-*.md`，每步结果必须登记 `docs/runbooks/progress.md`；人工决策步骤逐项问答，不得默认替签；证据链（manifest→handoff→checker）变更后需重新冻结。

## 命令

```bash
pnpm dev
pnpm exec tsc --noEmit            # TS 7.0.2
pnpm exec vitest run              # 单测
pnpm node scripts/check-fixture-boundary.mjs --source   # 边界三层（另两个参数见文件头注释）
pnpm node scripts/check-architecture-compliance.mjs    # §3 版本/目录/RSC 边界
pnpm exec prettier --check .
pnpm build                        # production；verify ignoreBuildErrors 未开
pnpm dlx shadcn@latest add <component>   # pnpm workspace-root 检查会拦 dlx，加完后按现有 ui/*.tsx 手工内联
```

## 已知坑

- **Tailwind v4 内容扫描遵循 .gitignore**：忽略 `components/` 这类源码目录会导致工具类整体不生成（曾致按钮布局全坏）。`.gitignore` 只定向忽略证据二进制（如 `docs/design/v0-input/*.tar.gz`），禁止忽略含 CSS/TSX 的目录。
- **部署纪律**：`pnpm build` 与运行中的 server 不可并发（重建 `.next` 会产生新旧 chunk 混用）；重建后必须按 PID kill 旧 `next start` 再重启（禁 `pkill -f`，会自杀会话）。
- 本仓库尚无 git commit 历史；大改动前先确认用户是否要基线 commit。

## 登记义务

新 token → `tokens.css` + `token-contract.md`；新组件/页面级 class → `docs/design-system/components.md`；新领域组件行为 → `components/design-system/component-contract.md`。不登记视为未完成。

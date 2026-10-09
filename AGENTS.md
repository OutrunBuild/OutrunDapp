# AGENTS.md — Outrun DApp

面向在本仓库工作的任何 AI Agent（v0 / Cursor / Claude Code / Codex 等）。本文件只做路由，不重复规范。

## 项目

Next.js 16 App Router · React 19 · Tailwind v4 · shadcn（`base` 原语，非 radix）· `pnpm`。路由 `app/[locale]/…`，`locale ∈ en | zh`，默认 `en`。URL scheme（2026-09-22 方案 C）：en 无前缀（`proxy.ts` 内部 rewrite 到 `/en/**`），zh 带 `/zh` 前缀；语言切换走 `components/global/routes.ts` 的 `localePath`，勿手拼 `/${locale}`。memeverse 详情页 URL 用数字段 `/memeverse/<verseId 数字>`（= 链上 uint256 verseId 口径），fixture 行 id（`verse-021`）不进 URL；创建页=`/memeverse/launch`（原 `/launch`）、发现页=`/memeverse/explore`（原 `/memeverse`）（2026-09-23 用户裁定，旧地址由 `proxy.ts` 307 收敛）。产品代码按域分桶：`components/verse/`（详情页/交易台/POL·池·赎回弹窗群）、`components/home/`、`components/discovery/`、`components/create/`、`components/portfolio/`、`components/referral/`，跨页共享件在 `components/global/`（shell/wallet/copy/routes/signal-ui 等）（2026-10-02 由 `components/prototype/` 按 import 闭包拆分）。

## 产品真源

产品功能逻辑的真相源是三个邻居仓库（冻结 commit 与逐文件登记见 `docs/page-briefs/source-map.md`）：

- **Memeverse**（`/home/azkrale/Web3Project/Memeverse`）— 合约机制 spec：创世/POLend 杠杆、四池、治理。例：杠杆创世债务额度=利息÷利率、利率一次性非年化（`src/polend/POLendUpgradeable.sol`、`src/polend/interfaces/IPOLend.sol`）
- **OutStake**（`/home/azkrale/Web3Project/OutStake`）— 合约机制 spec：PSM、USR 储蓄、Router、仓位
- **OutrunBook**（`/home/azkrale/Web3Project/OutrunBook`）— 产品叙事真相源：面向用户的解释、数值量级示例（例 `memeverse/polend.md`：5 倍放大锚点、损失上限=利息、无清算、失败全额退）

冲突规则：产品叙事以 OutrunBook 为准、机制以合约 spec 为准；冲突登记 `source-map.md` 对账区，Agent 不裁决。

工作方式：页面/交互需要机制公式或样本数值时，**先查真源**（spec 定公式、OutrunBook 定解释与量级），再把样本数据写进 `fixtures/`（schema + sourceRef 齐全，走三层边界），不要以「数据不可得」为由禁用功能或留空；只有 fixture 快照本身缺失的字段才降级为「null 不渲染」槽位（「以链上读值为准」类解释文案 2026-10-05 用户裁定全站禁用，`docs/design-system/copy-and-i18n.md` §2）。

## 细节保真（新功能 / 新 UI 硬纪律，2026-09-22 用户裁定）

真源层级 = 三仓库 + 用户当次指定的参照物（如旧 demo）；`docs/page-briefs/*` 是派生登记，不是真源，与其上来源冲突时按上来源做、事后改 brief 登记口径。

任何新页面/新功能，**写第一行代码前**先在任务回复里产出「细节台账」，每个字段/数值/文案/交互分支标三态之一：

- **G（真源）**：三仓库或本仓架构有原文 → 引用到 文件:行；界面术语与 OutrunBook 用词一致
- **S（样本）**：真源无具体值但机制有口径 → 机制口径 + fixture 样本 + 缺失字段「null 不渲染」；参照物（旧 demo 等）的数值只能当样本，禁止当真源引用
- **Q（待拍板）**：真源与参照物都没答案 → 列成清单问用户，**Q 项未拍板不写对应代码**（用户明说「直接做」除外）

参照物必须逐屏截图逐字段核对，不接受一次性文字摘要。交付前逐项复核台账：G 抽查原文、S 确认样本与降级处理在位、Q 确认已拍板。「不猜」的可检验形式 = 每个细节都可追溯到三态之一；出现无出处又无降级处理的细节即违约。

## UI 工作必读

仓库版设计系统 skill：`.agents/skills/outrun-design-system/SKILL.md`。任何 Agent（v0 / Cursor / Claude Code / Codex）处理 UI 前都应先读取它；它再路由到本目录的设计系统真相源。

任何涉及页面、组件、样式、文案的改动，先读：

1. `docs/design-system/README.md` — 设计系统入口、真相源层级、十条硬约束
2. 按任务读同目录 `foundations.md` / `components.md` / `patterns.md` / `copy-and-i18n.md`
3. 交付前按 `docs/design-system/agent-workflow.md` 验证

真相源：`DESIGN.md`（视觉定稿）→ `components/design-system/tokens.css`（唯一 token 源）→ `components/design-system/*.md`（契约）。品牌方向、色板、字体、密度的变更需要人工在 `docs/design/decision-log.md` 新增决议，Agent 不得自行执行。

## 速记

硬约束唯一正文 = `docs/design-system/README.md` §3（十条，含品红三层管辖），此处不复制条文、防漂移。开工保险丝两句话：只用 token 与语义类——裸 `#hex` / 原始调色板类 / `space-*` 由 `pnpm check:design` 自动拦截；触及品牌方向/色板/字体/密度 = 停手走 `docs/design/decision-log.md` 新决议。实施细则（shadcn base 原语 `render`、CSS 命名、复用顺序）见 `agent-workflow.md` §2；`gap` 不用 `space-*`、`data-stage` 阶段色等组件规则见 `components.md` §7/§8。

## 架构边界

- **fixture 数据边界（三层强制）**：`fixtures/**` → `lib/data/fixture-repository.ts`（唯一合法消费方）→ `components/**`（`ui/`、`design-system/` 通用层除外）。页面/组件禁止直接 import `fixtures/`，生产代码禁止反向到达；派生纪律：组件不自造领域数值——数值口径从产品真源取、样本数据落 `fixtures/`（见「产品真源」），fixture 快照缺失的字段按「null 不渲染」处理。由 `scripts/check-fixture-boundary.mjs` 的 `--source` / `--graph production` / `--bundle .next` 三层验证。
- **双编译器桥**：`typescript` 包 = `vendor/typescript-bridge`（bin/tsc 走 TS 7.0.2 CLI，require 转发 TS 6.0.2 API）。不要直接改桥、不要用 `typescript` 的程序 API 写 TS7 语法；tsconfig 禁 TS7 废弃选项（`baseUrl`、`target: es5` 等）。
- **runbook 纪律**：阶段执行走 `docs/runbooks/stage-0N-*.md`，每步结果必须登记 `docs/runbooks/progress.md`；人工决策步骤逐项问答，不得默认替签；证据链（manifest→handoff→checker）变更后需重新冻结。

## 命令

```bash
pnpm dev
pnpm exec tsc --noEmit            # TS 7.0.2
pnpm exec vitest run              # 单测
pnpm node scripts/check-fixture-boundary.mjs --source   # 边界三层（另两个参数见文件头注释）
pnpm node scripts/check-architecture-compliance.mjs    # §3 版本/目录/RSC 边界
pnpm check:design                 # 设计裸值扫描（hex/原始色类/space-*/transition:all；--self-test 自检）
pnpm check:contrast               # tokens.css 对比度闸门（对 DESIGN.md §2 实测值防漂移）
pnpm build:cjk-font               # 中文字体子集重切（改 copy.ts/fixtures 中文文案后必须跑，决议 029）
pnpm check:cjk-font               # 子集对账闸（已入 vitest 契约闸；--self-test 双谓词自检）
pnpm test:e2e                     # Playwright 三档视口视觉基线 + axe 无障碍扫描（NEXT_DIST_DIR=.next-e2e 独立构建，不碰 .next）
pnpm design:detect <file.tsx>     # impeccable 设计反模式检测（agent-workflow §3.3）
pnpm exec prettier --check .
pnpm build                        # production；verify ignoreBuildErrors 未开
pnpm dlx shadcn@latest add <component>   # pnpm workspace-root 检查会拦 dlx，加完后按现有 ui/*.tsx 手工内联
```

## 已知坑

- **Tailwind v4 内容扫描遵循 .gitignore**：忽略 `components/` 这类源码目录会导致工具类整体不生成（曾致按钮布局全坏）。`.gitignore` 只定向忽略证据二进制（如 `docs/design/v0-input/*.tar.gz`），禁止忽略含 CSS/TSX 的目录。
- **部署纪律**：`pnpm build` 与运行中的 server 不可并发（重建 `.next` 会产生新旧 chunk 混用）；重建后必须按 PID kill 旧 `next start` 再重启（禁 `pkill -f`，会自杀会话）。

## 登记义务

新 token → `tokens.css` + `token-contract.md`；新组件/页面级 class → `docs/design-system/components.md`；新领域组件行为 → `components/design-system/component-contract.md`。不登记视为未完成。

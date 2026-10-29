# AGENTS.md — Outrun DApp

面向在本仓库工作的任何 AI Agent（v0 / Cursor / Claude Code / Codex 等）。本文件只做红线与路由，细则一律指向对应文档。

## 0. 读前路由

| 你要做什么                                                                            | 先读                                        |
| ------------------------------------------------------------------------------------- | ------------------------------------------- |
| 动手改任何东西之前                                                                    | §1 红线                                     |
| 改页面/组件/样式/文案                                                                 | §1.4 视觉红线，阅读顺序见 §5.1，登记见 §8.2 |
| 涉及 URL、locale、目录归桶                                                            | §2 项目底盘                                 |
| 涉及钱包连接、签名、换链                                                              | §2.3 钱包双轨                               |
| 机制公式、样本数值，或任何产品行为/窗口期/开放性/规则的为什么（调试与答疑中出现也算） | §3 产品真源，再走 §4 任务工作流             |
| 挑选要加载的 Skill                                                                    | §5 Skill 路由                               |
| 写代码、动性能                                                                        | §6 代码规范                                 |
| 交付前自查                                                                            | §7 质量门                                   |
| 开分支、提 PR、登记新产物                                                             | §8 协作                                     |
| 跨链 send、部署重启                                                                   | §9 运维备忘                                 |

## 1. 红线

违反任何一条即返工；多数红线有自动化闸门兜底（括号内标注）。钱包执行面的品牌分支禁令同属红线，正文见 §2.3。

### 1.1 基线与版本 pin

默认分支 `main`，`pnpm@11.24.0`，Node `24.x`。版本 pin 以 `scripts/check-architecture-compliance.mjs` 为准，禁 caret/range。

### 1.2 数据边界

`lib/data/fixture-repository.ts` 是 fixture 数据的唯一合法消费方，由 `check-fixture-boundary` 的 `--source` / `--graph onchain` / `--bundle .next` 三层拦截：

- 页面与领域组件从 repository 取数，禁止直接 import `fixtures/`；生产代码禁止反向写入 fixture。`ui/` 与 `design-system/` 通用层不受此限。
- 组件不自造领域数值：数值口径从产品真源取（§3），样本数据落 `fixtures/`（schema + sourceRef 齐全）。
- fixture 快照缺失的字段按「null 不渲染」处理；样本量级调整只走等比缩尺，禁止归零/删构成。

### 1.3 生产命名

- 生产类型/函数/字段禁 `Fixture/mock/sample/prototype` 前缀。类型如 `Verse`、`Asset`；函数与字段如 `getSnapshot`、`displayAccount`、`usdPrice`、`confirm`。
- 旧名只许留别名过渡，移除条件写在别名块注释里。
- `fixtures/schema.ts` 的字段也是生产命名的一部分：改名必须同步 `fixtures/data/*.json` 与单测。
- onchain 数据源放 `lib/data/onchain-source.ts`，禁止放 `components/`（构建别名与边界脚本同步改）。

### 1.4 视觉唯一源

`components/design-system/tokens.css`。只用 token 与语义类，裸 `#hex` / 原始调色板类 / `space-*` 由 `pnpm check:design` 拦截；缺语义先扩 token，禁拿近似色顶上。

- 硬约束唯一正文 = `docs/design-system/README.md` §3（十条，含品红三层管辖），此处不复制条文、防漂移。
- 实施细则（shadcn base 原语 `render`、CSS 命名、复用顺序）见 `agent-workflow.md` §2；`gap` 不用 `space-*`、`data-stage` 阶段色等组件规则见 `components.md` §7/§8。
- 触及品牌方向、色板、字体、密度 = 停手走 `docs/design/decision-log.md` 新决议，Agent 不得自行执行。

### 1.5 生成物不直改

只改输入、跑脚本重出产物，禁手工编辑：

- 中文字体子集：改 `copy.ts` / fixtures 中文文案后跑 `pnpm build:cjk-font`，再过 `pnpm check:cjk-font`。
- 设计冻结清单：改监视树后先跑 `node scripts/write-design-artifact-manifest.mjs` 重生成，再过 `pnpm check:freeze`。清单文件 `docs/design/final-artifacts.sha256` 只验不改。
- 依赖哈希：改 `pnpm-lock.yaml` 后跑 `node scripts/write-file-hash.mjs --input pnpm-lock.yaml --output docs/page-briefs/pnpm-lock.sha256`。

### 1.6 双编译器桥

`typescript` 包 = `vendor/typescript-bridge`（bin/tsc 走 TS 7.0.2 CLI，require 转发 TS 6.0.2 API）。不要直接改桥、不要用 `typescript` 的程序 API 写 TS7 语法；tsconfig 禁 TS7 废弃选项（`baseUrl`、`target: es5` 等）。双编译器分歧以 CLI（`pnpm exec tsc`）为准。

### 1.7 destructive-git 与密钥（安全闸，不要绕过）

`.harness/policy.json` 是全局 destructive-git 守护的激活标记；`.claude/settings.json` 另有一层 deny 清单。两层都禁止 `git checkout` / `git restore` / `git stash*` / `git clean` / `git push` / 破坏性 `git reset`，以及读取 `.env*`：

- 回退单个文件不要用 `git checkout -- <file>`：它会连同**会话前的未提交改动**一起丢弃。改用精准 Edit 反向修改，或先问用户。
- 确实需要回滚时，由用户执行；Agent 不得自行绕过钩子（换写法、写脚本、改配置都算绕过）。
- 钩子不可用时（构建失败等）会 fail-open 放行，但规则不变。

## 2. 项目底盘

Next.js 16 App Router · React 19 · Tailwind v4 · shadcn（`base` 原语，非 radix，用 `render` 不用 `asChild`）· `pnpm`。路由 `app/[locale]/…`，`locale ∈ en | zh`，默认 `en`。

### 2.1 URL 与 locale 口径（做 URL 前必读）

- locale 前缀：en 无前缀（`proxy.ts` 内部 rewrite 到 `/en/**`），zh 带 `/zh` 前缀；外部直连 `/en/**` 由 `proxy.ts` 307 收敛到无前缀地址（x-locale 防伪造守卫，非兼容跳转）。
- 语言切换走 `components/global/routes.ts` 的 `localePath`，勿手拼 `/${locale}`。
- memeverse 详情页 URL 用数字段 `/memeverse/<verseId 数字>`（= 链上 uint256 verseId 口径），fixture 行 id（`verse-021`）不进 URL；创建页 = `/memeverse/launch`、发现页 = `/memeverse/explore`。

### 2.2 目录分桶

按域分桶；`ui/`、`design-system/` 为通用层：

- `components/verse/`：memeverse 详情页/交易台/POL·池·赎回弹窗群
- `components/home/` · `components/discovery/` · `components/create/` · `components/portfolio/` · `components/referral/`：对应同名页面
- `components/faucet/`：水龙头领取与兑换
- `components/global/`：跨页共享件（shell/wallet/copy/routes/signal-ui 等）

### 2.3 钱包双轨（MetaMask 与 Privy）

两种连接方式、一条执行面；业务代码不得按钱包品牌分支（红线级）：

- 一切客户端链上读/写只走 `getActiveEip1193Provider()`，能力差异走 ProviderCapability 判定，禁止写品牌 if。
- 连接、持久化、登出竞态、换链、无 App ID 退化的机制与约束见 `lib/web3/README.md`。

## 3. 产品真源

产品功能逻辑的真相源是三个邻居仓库（冻结 commit 与逐文件登记见 `docs/page-briefs/source-map.md`）：

- **Memeverse**（`/home/azkrale/Web3Project/Memeverse`）— 合约机制 spec：创世/POLend 杠杆、四池、治理。例：杠杆创世债务额度=利息÷利率、利率一次性非年化（`src/polend/POLendUpgradeable.sol`、`src/polend/interfaces/IPOLend.sol`）
- **OutStake**（`/home/azkrale/Web3Project/OutStake`）— 合约机制 spec：PSM、USR 储蓄、Router、仓位
- **OutrunBook**（`/home/azkrale/Web3Project/OutrunBook`）— 产品叙事真相源：面向用户的解释、数值量级示例（例 `memeverse/polend.md`：5 倍放大锚点、损失上限=利息、无清算、失败全额退）

冲突规则：产品叙事以 OutrunBook 为准、机制以合约 spec 为准；冲突登记 `source-map.md` 对账区，Agent 不裁决。

工作方式：页面/交互需要机制公式或样本数值时，**先查真源**（spec 定公式、OutrunBook 定解释与量级），再把样本数据写进 `fixtures/`（schema + sourceRef 齐全，走 §1.2 三层边界）。

不要以「数据不可得」为由禁用功能或留空；只有 fixture 快照本身缺失的字段才降级为「null 不渲染」槽位（文案红线见 §5.1）。

## 4. 任务工作流

真源层级 = 三仓库 + 用户当次指定的参照物（如旧 demo）；`docs/page-briefs/*` 是派生登记，不是真源，与其上来源冲突时按上来源做、事后改 brief 登记口径。

**真源三步与矛盾纪律**

产品行为/窗口期/开放性/规则问题（"能不能、什么时候、对谁开放、怎么变化"——调试与答疑中出现也算）的结论必须走真源三步，每一步引用都带 `文件:行`：

1. **OutrunBook**（`~/Web3Project/OutrunBook/memeverse/`）：叙事、窗口期、用户侧解释
2. **Memeverse 合约校验代码**：规则是否被合约强制执行的唯一依据——指函数入场处的阶段/权限检查语句（例：`MemeverseLaunchImpl.sol` 里 `preorder()` 执行前的 `require` 阶段检查），不是泛指某个文件
3. **本仓登记**：`fixtures/../glossary.md`、`docs/page-briefs/*`、`docs/design/decision-log.md` 决议

三步都找不到答案，才允许回答「规格未定义」。在此之上，四条纪律违反任意一条即返工：

- 读数只回答「是什么」。**禁止从数据观察反推产品许可**——"链上出现了"不等于"规则允许"
- 读数与规格冲突时，默认读数错。唯一合法动作是换源重读（换工具、换独立第二源对照）；禁止生成解释性叙事（"用户加仓了""被稀释了"这类故事都算）
- 引用规格前必须重开原文核对，记忆不作为引用依据
- 关键数字双源对照后才进结论；数据转述必须程序解码（`cast call "...(uint256,uint256,bool)"` 带签名调用、或 python 精确计算），禁止从原始字节手切、禁止心算单位换算

If the docs and the existing code disagree, follow the existing code, and list every mismatch in your final reply.

### 4.1 任务分级

- **存量修正**（已有页面/组件/文案的 bug、换算、费率遗漏：无新 token、无新组件、无新页面）：走轻量路——一行假设 + 1–2 个来源引用 + 降级说明，不做三态台账，不读全套设计系统，只读命中的契约小节与文案键。改到中文文案的，另触发 §1.5 字体子集重切。
  - 查来源的停止条件：同一公式最多查两个来源（一个机制来源 + 一个数据通路来源），两个一致就动手；互相矛盾才继续查。
  - 升级条件：两个来源矛盾 → AskUserQuestion 或全量台账；涉及新组件/新 token/新页面结构 → 直接走全量流程。
- **新页面 / 新功能**：沿用全量流程（§4.2）。

### 4.2 细节台账（新功能写第一行代码前产出）

每个字段/数值/文案/交互分支标三态之一（标题必须用中文全称，禁用单字母简写）：

- **真源**：三仓库或本仓架构有原文 → 引用到 文件:行；界面术语与 OutrunBook 用词一致
- **示例值**：真源只给了算法和口径、没给具体数 → 先拿旧 demo 或随手写的值顶上让页面跑起来；参照物（旧 demo 等）的数值只能当示例值，禁止当真源引用；链上有真读数就换真数，链上没这字段的不编数、直接不渲染那一槽
- **待拍板**：真源与参照物都没答案 → 列成清单问用户，**待拍板项未拍板不写对应代码**（用户明说「直接做」除外）

参照物必须逐屏截图逐字段核对，不接受一次性文字摘要。交付前逐项复核台账：抽查真源原文、确认示例值与降级处理在位、确认待拍板项已拍板。「不猜」的可检验形式 = 每个细节都可追溯到三态之一；出现无出处又无降级处理的细节即违约。

## 5. Skill 路由

Skill 列表进上下文时只带名称与路径，正文按需延迟加载：开工先按任务路由显式加载一次对应 Skill；无对应 Skill 不得编造名称；同一 Skill 已加载不再重复加载。任务首条回复写明已加载的 Skill 名。

### 5.1 设计与文案

任何涉及页面、组件、样式、文案的改动，阅读顺序：

1. 先读 `docs/design-system/README.md`（入口、真相源层级、十条硬约束）。
2. 按任务读同目录 `foundations.md` / `components.md` / `patterns.md` / `copy-and-i18n.md`。
3. 交付前按 `docs/design-system/agent-workflow.md` 验证。

真相源链 = `DESIGN.md`（视觉定稿）→ `components/design-system/tokens.css`（唯一 token 源）→ `components/design-system/*.md`（契约）。文案红线：「以链上读值为准」类解释文案全站禁用（`copy-and-i18n.md` §2）。

Skill 路由：

- `outrun-design-system`（仓库版，UI 任务默认入口）：路由到 `docs/design-system/README.md` 真相源层级与十条硬约束
- `frontend-design`（外部视觉）：全新页面/品牌视觉方向/大改版才用；与仓库设计系统冲突时以本仓 `DESIGN.md` 与 `decision-log.md` 为准
- `tailwind-design-system`（Token 实现）：Tailwind v4 `@theme` 写法、语义 token 分层、响应式与暗色模式
- `impeccable`（质量评审）：`critique/audit/polish/optimize` 等子命令船新页面交付前跑一遍；`optimize` 覆盖 UI 性能诊断
- `logo-design`（品牌标）：仅 logo 专项任务用，产出多版决策材料不是终稿
- `universal-imagegen`（位图资产）：照片/插画/banner/mockup 等位图的生成与改图；确定性图标/图表优先 SVG/CSS
- `web-design-guidelines` / `writing-guidelines`（外部评审口径）：跑评审前用 WebFetch 拉最新规则再对文件逐条核对

### 5.2 性能与链交互

- `vercel-react-best-practices`（React/Next 性能）：请求瀑布（`async-*`）、包体积、服务端性能、客户端取数、重渲染；点击链路 RPC 问题默认先调它
- `viem-integration`（链交互）：viem/wagmi/钱包/provider 读写、交易发送；读 `references/` 下对应主题
- `vercel-optimize`（线上归因）：必须先有 Vercel 生产指标与确定性门控才可动手，不做全仓 grep 式优化
- `vercel-react-view-transitions`（视图转场）：路由/列表/弹窗状态变化的原生转场；说不清传达什么空间关系就不加

### 5.3 部署与验证

- `deploy-to-vercel`（部署）：默认 preview 非 production；按 linked/unlinked × git remote 有无 × CLI 认证状态选方法
- `vercel-cli-with-tokens`（Token 部署）：无 `vercel login` 时用 `VERCEL_TOKEN` 环境变量驱动 CLI，禁止 `--token` 明文传参
- `agent-browser`（浏览器验证）：视觉回归与交互验证走 `agent-browser skills get core` 取最新工作流，不按过期 stub 自行发挥
- `systematic-debugging`（故障排查）：任何技术问题先走四阶段（根因→模式→假设→实现），3 次修不好停手质疑架构

### 5.4 明确不用的

- `vercel-composition-patterns`（组件组合）：重构布尔属性泛滥的组件库 API 时才用，日常页面任务不调

## 6. 代码规范

完整细则已拆出：代码风格与注释纪律见 `docs/engineering/code-style.md`，性能纪律见 `docs/engineering/performance.md`。红线速览：

- 风格规则以抽象 Good/Bad 示例自证，不引用仓库现有代码当正反例。
- `any` 默认禁止（唯一豁免 viem 适配层 `lib/web3/viem-rpc-port.ts`）；`try/catch` 只做错误到值的转换。
- 注释只写就地 why，不引用 `decision-log` 决议编号。
- 性能四条：刷新粒度 = 变更作用域；写后刷新 = 双层管线（禁裸 `router.refresh()`）；点击链路 RPC 预算（会话只走 `write-session.ts`，组件直连 `resolveVerseSession` 由 `check-architecture-compliance` 拦截）；数据齐了再开窗。

## 7. 质量门

### 7.1 检查分级

- 日常三件套：`tsc --noEmit`、`vitest run`、`eslint`（§7.2 表中标「日常」）。
- 交付前全量：日常 + 表中全部「交付前」命令。
- 分歧仲裁：类型以 TS 7.0.2 CLI 为准，设计以 `DESIGN.md` §2 实测值为准（`check:contrast` 差值 >0.05 即漂移 FAIL）。

### 7.2 命令清单

| 命令                                                    | 级别   | 作用                                                                           |
| ------------------------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| `pnpm dev`                                              | 开发   | dev server                                                                     |
| `pnpm exec tsc --noEmit`                                | 日常   | 类型检查（TS 7.0.2）                                                           |
| `pnpm exec vitest run`                                  | 日常   | 单测                                                                           |
| `pnpm exec eslint`                                      | 日常   | lint                                                                           |
| `pnpm node scripts/check-fixture-boundary.mjs --source` | 交付前 | fixture 边界三层之一（`--graph` / `--bundle` 参数见文件头）                    |
| `pnpm node scripts/check-architecture-compliance.mjs`   | 交付前 | 版本 pin（§1.1）+ 双编译器桥（§1.6）+ 点击链路预算（§6.3）                     |
| `pnpm check:design`                                     | 交付前 | 设计裸值扫描（hex/原始色类/space-*/transition:all）                            |
| `pnpm check:contrast`                                   | 交付前 | tokens.css 对比度闸门                                                          |
| `pnpm check:freeze`                                     | 交付前 | 设计冻结清单双向对账（改监视树先跑 write-design-artifact-manifest.mjs 重生成） |
| `pnpm check:design-docs`                                | 交付前 | 登记文档闸（components.md §6 模式名重复 / 超长单行 / 叙事日期）                |
| `pnpm check:cjk-font`                                   | 交付前 | 中文字体子集对账                                                               |
| `pnpm check:cjk-copy`                                   | 交付前 | 组件内 CJK 字面量扫描——字典契约执行闸（copy-and-i18n.md §1）                   |
| `pnpm check:copy-punctuation`                           | 交付前 | 文案分号扫描——语气规则执行闸（copy-and-i18n.md §2；入 vitest contract gates）  |
| `pnpm test:e2e`                                         | 交付前 | Playwright 三视口视觉基线 + axe（NEXT_DIST_DIR=.next-e2e 独立构建）            |
| `pnpm exec prettier --check .`                          | 交付前 | 格式检查                                                                       |
| `pnpm build:cjk-font`                                   | 按需   | 改 copy.ts/fixtures 中文文案后必须跑，再过 `check:cjk-font`                    |
| `pnpm design:detect <file.tsx>`                         | 按需   | impeccable 设计反模式检测                                                      |
| `pnpm build`                                            | 按需   | production 构建（verify ignoreBuildErrors 未开）                               |
| `pnpm dlx shadcn@latest add <component>`                | 按需   | workspace-root 检查会拦 dlx，加完按现有 ui/*.tsx 手工内联                      |

## 8. 协作

### 8.1 分支 / 提交 / PR

- 基线：默认分支 `main`，功能分支从 `origin/main` 拉出。分支名短横线小写、不带 `/` 域前缀（如 `verse-live-probe`）。
- 提交：`type(scope): summary`，`type` 沿用仓内现有前缀（`verse` / `web3` / `data` / `pages` / `design` / `chore` / `docs` / `fix` / `feat` / `refactor` / `test` / `style` / `deployments`），不造新顶层词；scope 填域或页面。
- 用户可见改动（`feat` / `fix` / 视觉变化）随 PR 贴 Playwright 三视口截图 + axe 结果（§7.2 `test:e2e`），样式改动先跑基线、像素 diff 随 PR 解释。

### 8.2 登记义务

- 新 token：扩 `components/design-system/tokens.css`（规则见 §1.4）→ 登记 `components/design-system/token-contract.md` → 过 `check:contrast`（§7.2）。
- 新组件/页面级 class → `docs/design-system/components.md`。
- 新领域组件行为 → `components/design-system/component-contract.md`。

不登记视为未完成。

## 9. 运维备忘

### 9.1 已知坑

- **Tailwind v4 内容扫描遵循 .gitignore**：忽略 `components/` 这类源码目录会导致工具类整体不生成。`.gitignore` 只定向忽略证据二进制（如 `docs/design/v0-input/*.tar.gz`），禁止忽略含 CSS/TSX 的目录。
- **部署纪律**：`pnpm build` 与运行中的 server 不可并发（重建 `.next` 会产生新旧 chunk 混用）；重建后必须按 PID kill 旧 `next start` 再重启（禁 `pkill -f`，会自杀会话）。

### 9.2 测试网跨链：send 确认 ≠ 到账，必须手动 relay

测试网（BSC Testnet / Base Sepolia / Arbitrum Sepolia）LayerZero 默认 DVN 不给用户流量签名，也没有活跃的第三方 DVN。后果：

- 前端发起的跨链 send（GenesisCredit OFT）在源链确认后**只 burn 代币，包永远停在未验证状态**，目标链不会到账，除非手动 relay。
- **每次跨链 send 确认后，必须跑一次 relay**（源链固定 BSC Testnet，等源交易确认后）：

  ```bash
  bash /home/azkrale/Web3Project/Memeverse/script/relay-lz-packet.sh <源交易hash> <base|arb>
  ```

  脚本从源回执提取包，在目标链依次执行 `verify`（owner EOA 自任 DVN，无 DVN 合约）→ `commitVerification` → `lzReceive`，代币到账。

- 前置条件：目标链 ULN 配置的 `requiredDVNs` 含 owner（cUETH/cUUSD/cUBNB 在 Base+Arb 已配好）。改配置用 `Memeverse/script/LzSetConfig.s.sol`（`CFG_DVN=<owner>`，以 OApp delegate 身份广播）。发送侧配置保持 LayerZero 默认——死 DVN 的 `assignJob` 是无害空操作。
- 同一路径按 nonce 顺序投递（端点 lazy-nonce 规则）；脚本一次处理一笔。
- 测试 UI「跨链中/待到账」状态时，别等链上自动到账——先跑 relay 再断言余额变化。

安全性：owner EOA 自签 = relay 脚本就是信任锚，仅测试网。主网必须配真 DVN（`requiredDVNs` = 各链 DVN 合约，同一个 `LzSetConfig.s.sol` 可接线）。

### 9.3 Anvil fork 集成套件：变更触发式节奏

`tests/integration/`（batch 形态 + Type-4 会话）默认被 `ANVIL_URL` 门控跳过，CI 与 pre-push 都不跑（CI 是先导子集，见 `docs/architecture.md` §12）。涉及 ABI、chain、account、Privy、external wallet、EIP-7702、Kernel、交易、subgraph 或 `deployments/` 的变更，以及发布候选，必须跑一次；普通样式 PR 不跑（无外部网络硬依赖，§11.3）。

前置：Foundry `1.8.5`（`anvil` + `cast`；type4 用 `cast wallet sign-auth`），`deployments/<chainId>.json` 存在。

```bash
anvil --fork-url https://bsc-testnet-rpc.publicnode.com --port 8545
TEST_CHAIN_ID=97 ANVIL_URL=http://localhost:8545 VERSE_ID=<id> \
  pnpm exec vitest run tests/integration
```

`TEST_CHAIN_ID` 必须显式给（type4 缺省 0 会在 warm-up 处整文件报错，整组用例失败而非静默通过）。`VERSE_ID` 为空时创世/verse 流跳过（`it.skipIf`），PSM/USR 流照跑；421614 上 verse 流同样跳过。未设 `ANVIL_URL` 时整文件 skipped，这是 `pnpm test` 的常态，vitest 输出里显示为跳过而非失败。需要钉死链状态时在 fork 命令加 `--fork-block-number <区块号>`。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

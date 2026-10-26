# AGENTS.md — Outrun DApp

面向在本仓库工作的任何 AI Agent（v0 / Cursor / Claude Code / Codex 等）。本文件只做路由，不重复规范。

## 项目

Next.js 16 App Router · React 19 · Tailwind v4 · shadcn（`base` 原语，非 radix）· `pnpm`。路由 `app/[locale]/…`，`locale ∈ en | zh`，默认 `en`。

**URL scheme**：en 无前缀（`proxy.ts` 内部 rewrite 到 `/en/**`），zh 带 `/zh` 前缀；外部直连 `/en/**` 由 `proxy.ts` 307 收敛到无前缀地址（x-locale 防伪造守卫，非兼容跳转）。语言切换走 `components/global/routes.ts` 的 `localePath`，勿手拼 `/${locale}`。memeverse 详情页 URL 用数字段 `/memeverse/<verseId 数字>`（= 链上 uint256 verseId 口径），fixture 行 id（`verse-021`）不进 URL；创建页=`/memeverse/launch`、发现页=`/memeverse/explore`。

**目录分桶**（按域分桶；`ui/`、`design-system/` 为通用层）：

- `components/verse/`：memeverse 详情页/交易台/POL·池·赎回弹窗群
- `components/home/` · `components/discovery/` · `components/create/` · `components/portfolio/` · `components/referral/`：对应同名页面
- `components/faucet/`：水龙头领取与兑换
- `components/data/`：链上读数适配（`onchain-adapter.ts` 等）
- `components/global/`：跨页共享件（shell/wallet/copy/routes/signal-ui 等）

## 产品真源

产品功能逻辑的真相源是三个邻居仓库（冻结 commit 与逐文件登记见 `docs/page-briefs/source-map.md`）：

- **Memeverse**（`/home/azkrale/Web3Project/Memeverse`）— 合约机制 spec：创世/POLend 杠杆、四池、治理。例：杠杆创世债务额度=利息÷利率、利率一次性非年化（`src/polend/POLendUpgradeable.sol`、`src/polend/interfaces/IPOLend.sol`）
- **OutStake**（`/home/azkrale/Web3Project/OutStake`）— 合约机制 spec：PSM、USR 储蓄、Router、仓位
- **OutrunBook**（`/home/azkrale/Web3Project/OutrunBook`）— 产品叙事真相源：面向用户的解释、数值量级示例（例 `memeverse/polend.md`：5 倍放大锚点、损失上限=利息、无清算、失败全额退）

冲突规则：产品叙事以 OutrunBook 为准、机制以合约 spec 为准；冲突登记 `source-map.md` 对账区，Agent 不裁决。

工作方式：页面/交互需要机制公式或样本数值时，**先查真源**（spec 定公式、OutrunBook 定解释与量级），再把样本数据写进 `fixtures/`（schema + sourceRef 齐全，走三层边界），不要以「数据不可得」为由禁用功能或留空；只有 fixture 快照本身缺失的字段才降级为「null 不渲染」槽位（「以链上读值为准」类解释文案全站禁用，`docs/design-system/copy-and-i18n.md` §2）。

## 细节保真（新功能 / 新 UI 硬纪律）

真源层级 = 三仓库 + 用户当次指定的参照物（如旧 demo）；`docs/page-briefs/*` 是派生登记，不是真源，与其上来源冲突时按上来源做、事后改 brief 登记口径。

### 任务分级（存量修正不走全量台账）

- **存量修正**（已有页面/组件/文案的 bug、换算、费率遗漏：无新 token、无新组件、无新页面）：走轻量路——一行假设 + 1–2 个来源引用 + 降级说明，不做三态台账，不读全套设计系统，只读命中的契约小节与文案键。查来源的停止条件：同一公式最多查两个来源（一个机制来源 + 一个数据通路来源），两个一致就动手；只有两个来源互相矛盾才继续查。轻量路只管开工：两个来源矛盾、或涉及新组件/新 token/新页面结构时升级——前者走 AskUserQuestion 或全量台账，后者直接走全量流程。
- **新页面 / 新功能**：沿用下述全量流程。

任何新页面/新功能，**写第一行代码前**先在任务回复里产出「细节台账」，每个字段/数值/文案/交互分支标三态之一（标题必须用中文全称，禁用单字母简写）：

- **真源**：三仓库或本仓架构有原文 → 引用到 文件:行；界面术语与 OutrunBook 用词一致
- **示例值**：真源只给了算法和口径、没给具体数 → 先拿旧 demo 或随手写的值顶上让页面跑起来；参照物（旧 demo 等）的数值只能当示例值，禁止当真源引用；链上有真读数就换真数，链上没这字段的不编数、直接不渲染那一槽
- **待拍板**：真源与参照物都没答案 → 列成清单问用户，**待拍板项未拍板不写对应代码**（用户明说「直接做」除外）

参照物必须逐屏截图逐字段核对，不接受一次性文字摘要。交付前逐项复核台账：G 抽查原文、S 确认样本与降级处理在位、Q 确认已拍板。「不猜」的可检验形式 = 每个细节都可追溯到三态之一；出现无出处又无降级处理的细节即违约。

## Skill 加载纪律

Skill 列表进上下文时只带名称与路径，正文按需延迟加载：开工先按任务路由显式加载一次对应 Skill；无对应 Skill 不得编造名称；同一 Skill 已加载不再重复加载。

任务首条回复写明已加载的 Skill 名；同一任务内复用已加载 Skill 不再重复声明。

### 设计与文案

- `outrun-design-system`（仓库版，UI 任务默认入口）：路由到 `docs/design-system/README.md` 真相源层级与十条硬约束（本节不再复述细则）
- `frontend-design`（外部视觉）：全新页面/品牌视觉方向/大改版才用；与仓库设计系统冲突时以本仓 `DESIGN.md` 与 `decision-log.md` 为准
- `tailwind-design-system`（Token 实现）：Tailwind v4 `@theme` 写法、语义 token 分层、响应式与暗色模式
- `impeccable`（质量评审）：`critique/audit/polish/optimize` 等子命令船新页面交付前跑一遍；`optimize` 覆盖 UI 性能诊断
- `logo-design`（品牌标）：仅 logo 专项任务用，产出多版决策材料不是终稿
- `universal-imagegen`（位图资产）：照片/插画/banner/mockup 生成与改图走 `scripts/image_gen.py`，密钥只读环境变量；确定性图标/图表优先用 SVG/CSS
- `web-design-guidelines` / `writing-guidelines`（外部评审口径）：跑评审前用 WebFetch 拉最新规则再对文件逐条核对

任何涉及页面、组件、样式、文案的改动先读 `docs/design-system/README.md`（入口、真相源层级、十条硬约束）再按任务读同目录 `foundations.md` / `components.md` / `patterns.md` / `copy-and-i18n.md`，交付前按 `docs/design-system/agent-workflow.md` 验证。真相源：`DESIGN.md`（视觉定稿）→ `components/design-system/tokens.css`（唯一 token 源）→ `components/design-system/*.md`（契约）。品牌方向、色板、字体、密度的变更需要人工在 `docs/design/decision-log.md` 新增决议，Agent 不得自行执行。

### 性能与链交互

- `vercel-react-best-practices`（React/Next 性能）：请求瀑布（`async-*`）、包体积、服务端性能、客户端取数、重渲染；点击链路 RPC 问题默认先调它
- `viem-integration`（链交互）：viem/wagmi/钱包/provider 读写、交易发送；读 `references/` 下对应主题
- `vercel-optimize`（线上归因）：必须先有 Vercel 生产指标与确定性门控才可动手，不做全仓 grep 式优化
- `vercel-react-view-transitions`（视图转场）：路由/列表/弹窗状态变化的原生转场；说不清传达什么空间关系就不加

### 部署与验证

- `deploy-to-vercel`（部署）：默认 preview 非 production；按 linked/unlinked × git remote 有无 × CLI 认证状态选方法
- `vercel-cli-with-tokens`（Token 部署）：无 `vercel login` 时用 `VERCEL_TOKEN` 环境变量驱动 CLI，禁止 `--token` 明文传参
- `agent-browser`（浏览器验证）：视觉回归与交互验证走 `agent-browser skills get core` 取最新工作流，不按过期 stub 自行发挥
- `systematic-debugging`（故障排查）：任何技术问题先走四阶段（根因→模式→假设→实现），3 次修不好停手质疑架构

### 明确不用的

- `vercel-composition-patterns`（组件组合）：重构布尔属性泛滥的组件库 API 时才用，日常页面任务不调

## 速记

硬约束唯一正文 = `docs/design-system/README.md` §3（十条，含品红三层管辖），此处不复制条文、防漂移。开工保险丝两句话：只用 token 与语义类——裸 `#hex` / 原始调色板类 / `space-*` 由 `pnpm check:design` 自动拦截；触及品牌方向/色板/字体/密度 = 停手走 `docs/design/decision-log.md` 新决议。实施细则（shadcn base 原语 `render`、CSS 命名、复用顺序）见 `agent-workflow.md` §2；`gap` 不用 `space-*`、`data-stage` 阶段色等组件规则见 `components.md` §7/§8。

## 架构边界

- **fixture 数据边界（三层强制）**：`fixtures/**` → `lib/data/fixture-repository.ts`（唯一合法消费方）→ `components/**`（`ui/`、`design-system/` 通用层除外）。页面/组件禁止直接 import `fixtures/`，生产代码禁止反向到达；派生纪律：组件不自造领域数值——数值口径从产品真源取、样本数据落 `fixtures/`（见「产品真源」），fixture 快照缺失的字段按「null 不渲染」处理；样本量级调整只走等比缩尺，禁止归零/删构成。由 `scripts/check-fixture-boundary.mjs` 的 `--source` / `--graph production` / `--bundle .next` 三层验证。
- **生产命名禁 `Fixture/mock/sample/prototype`**：生产类型/函数/字段一律去前缀（`Verse`、`Asset`、`getSnapshot`、`displayAccount`、`usdPrice`、`confirm`），旧名只许留别名过渡（移除条件写在别名块注释里）；`fixtures/schema.ts` 的字段也是生产命名的一部分，改名必须同步 `fixtures/data/*.json` 与单测；onchain 数据源放 `lib/data/onchain-source.ts`，禁止放 `components/`（构建别名与边界脚本同步改）。
- **双编译器桥**：`typescript` 包 = `vendor/typescript-bridge`（bin/tsc 走 TS 7.0.2 CLI，require 转发 TS 6.0.2 API）。不要直接改桥、不要用 `typescript` 的程序 API 写 TS7 语法；tsconfig 禁 TS7 废弃选项（`baseUrl`、`target: es5` 等）。

## 命令

```bash
pnpm dev
pnpm exec tsc --noEmit            # TS 7.0.2
pnpm exec vitest run              # 单测
pnpm node scripts/check-fixture-boundary.mjs --source   # 边界三层（另两个参数见文件头注释）
pnpm node scripts/check-architecture-compliance.mjs    # §3 版本/目录/RSC 边界
pnpm check:design                 # 设计裸值扫描（hex/原始色类/space-*/transition:all；--self-test 自检）
pnpm check:contrast               # tokens.css 对比度闸门（对 DESIGN.md §2 实测值防漂移）
pnpm check:freeze                 # 设计冻结清单闸（docs/design/final-artifacts.sha256 双向对账；改监视树后先跑 write-design-artifact-manifest.mjs 重生成清单）
pnpm check:design-docs            # 登记/路由文档闸（docs/design-system/*.md + 根 AGENTS.md：§6 重复行 / 超长单行 / 叙事日期 FAIL；--self-test 自检）
pnpm build:cjk-font               # 中文字体子集重切（改 copy.ts/fixtures 中文文案后必须跑）
pnpm check:cjk-font               # 子集对账闸（已入 vitest 契约闸；--self-test 双谓词自检）
pnpm test:e2e                     # Playwright 三档视口视觉基线 + axe 无障碍扫描（NEXT_DIST_DIR=.next-e2e 独立构建，不碰 .next）
pnpm design:detect <file.tsx>     # impeccable 设计反模式检测（agent-workflow §3.3）
pnpm exec prettier --check .
pnpm build                        # production；verify ignoreBuildErrors 未开
pnpm dlx shadcn@latest add <component>   # pnpm workspace-root 检查会拦 dlx，加完后按现有 ui/*.tsx 手工内联
```

## 性能纪律

- **刷新粒度 = 变更作用域**：一次写操作完成后只重读该操作影响的项，禁止「清空整表 + 全量重读」——未涉及的行会集体闪烁，一次操作被放大成 N 次 RPC。展示型倒计时存绝对截止时间、不存「剩余 + 探测时刻」，否则局部刷新会让其他行的基准漂移；全量重置只允许发生在账号 / 链 / provider 变化时。参考实现：`components/faucet/faucet-claims.tsx` 的 `probeRef`（按 symbol 合并、只重读本次领取的币种）。
- **写后刷新 = 双层管线，禁止裸 `router.refresh()`**：写确认后受影响数字的立即刷新不得依赖单独的 `router.refresh()`。服务端数据走 30s/60s stale-while-revalidate 缓存（`onchain-source.ts` 的 `cachedConfig`、`graph-repository.ts` 的 `cached()`）：TTL 内当次渲染直接重放交易前数值，TTL 外也是先发旧值、后台 revalidation 落地后没有任何再渲染；subgraph 聚合另叠加索引滞后。**显示链口径**：创世逐链结算，聚合类显示（阈值进度表/参与面板聚合/可预购余量）跟随钱包实链（限 verse 落地集内，越集或断连回退 canonical 副本链的 SSR 值）——基线=`getVerse` 下发的逐链行 `chainAggregates`，钱包链在非 canonical 时其余量等即时值只能来自客户端探针；个人全链合计（「您的参与」）= 本链钱包 provider 读 + 兄弟链 on-demand server action（`lib/data/verse-reads.ts`，钱包 provider 只服务当前链）；参与地址=omni 合计（逐链去重计数求和，跨链去重无身份可用）。两层管线：① **即时层（客户端探针）**——确认（`tx.display === 'confirmed'`）或账号/链切换时经钱包 provider（与 receipt 同链同源）定向重读本次写影响的项、直接更新显示位，参考实现 `components/verse/genesis-live.tsx`（`VerseLiveProvider` 探针 + `writeNonce` 信号）与 faucet `probeRef`；探针读数只在钱包实链 ∈ 落地集时落值，读失败保持基线值（null 不覆盖），账号/链变化清空（全量重置白名单点）。② **中央层（服务端收敛，新写面零接线）**——`WriteSpec.writeScope` 声明本次写的数据作用域（`{ kind: 'verse', chainId, verseId }`），`use-tx-center` 在 `outcome === 'confirmed'` 时统一调 server action `refreshVerseAfterWrite`（`lib/data/write-refresh.ts`，自动携带本笔 tx hash）：先等 subgraph 索引追平写入区块（receipt 区块定位，读不到回退安全头；有界轮询——失效早了冷读会把交易前数值重新入缓存并重置 TTL），再失效该 verse 的两层缓存（`GraphRepository.invalidateVerse` + `onchain-source invalidateVerseConfig`，含磁盘 seed），预热 `getVerse` 后 `router.refresh()`——页面全部服务端数字（进度条/参与地址/门槛/未来新增字段）一次收敛。新增写面的义务：spec 带 `writeScope`（凡有服务端渲染依赖）+ 数值面板接探针；漏声明 scope 的面中央层兜不住。
- **点击链路 RPC 预算**：交易弹窗的点击链路禁止串行静态读与展示读。静态半（verse 元组、部署表、token decimals）在首次交互时由 `prefetchVerseSession` 预热，点击时 `getVerseSession` / `getTokenDecimals` 命中缓存（`components/global/write-session.ts`；同落地链+verse+account 只有一个在途解析，并发合并；调用必带 `chains` 允许集，会话按 provider 探到的实链缓存）；弹窗 SSR 已有的数据（费率、余额、headroom）点击时不重读；`quote/estimateGas` 只进渲染的面板才读，免审阅面板不读；点击链路上只留 `allowance` 这类必须现查的读（`readAllowances`，腿之间并行）。新增/改造交易弹窗照此接入，不要另建一套会话解析——组件直连 `resolveVerseSession` 由 `check-architecture-compliance` 拦截。
- **数据齐了再开窗，一次渲染**：点确认先探 `eth_chainId`（错链闸门，也是执行链选址：钱包在 verse 落地集的哪条链就在哪条链执行），再组 spec（allowance）并取完弹窗要画的报价（网络费行），全部到手才 `setReviewing(true)`。弹窗打开后不得再出现后到的行/数值——「先开窗再补数据」会让已渲染的卡片被顶一下（Network Fee 后到最典型）。链路等待放在表单态解决：`resolving` 持续置位挡住重复提交，失败走降级错误行；禁止把等待搬进弹窗。

## 已知坑

- **Tailwind v4 内容扫描遵循 .gitignore**：忽略 `components/` 这类源码目录会导致工具类整体不生成。`.gitignore` 只定向忽略证据二进制（如 `docs/design/v0-input/*.tar.gz`），禁止忽略含 CSS/TSX 的目录。
- **部署纪律**：`pnpm build` 与运行中的 server 不可并发（重建 `.next` 会产生新旧 chunk 混用）；重建后必须按 PID kill 旧 `next start` 再重启（禁 `pkill -f`，会自杀会话）。

## 测试网跨链：send 确认 ≠ 到账，必须手动 relay

测试网（BSC Testnet / Base Sepolia / Arbitrum Sepolia）LayerZero 默认 DVN 不给用户流量签名（2026-10 链上验证：数万块内用户 DVN 零签名，仅系统合约在动），也没有活跃的第三方 DVN。后果：

- 前端发起的跨链 send（GenesisCredit OFT）在源链确认后**只 burn 代币，包永远停在未验证状态**，目标链不会到账，除非手动 relay。
- **每次跨链 send 确认后，必须跑一次 relay**（源链固定 BSC Testnet，等源交易确认后）：

  ```bash
  bash /home/azkrale/Web3Project/Memeverse/script/relay-lz-packet.sh <源交易hash> <base|arb>
  ```

  脚本从源回执提取包，在目标链依次执行 `verify`（owner EOA 自任 DVN，无 DVN 合约）→ `commitVerification` → `lzReceive`，代币到账。

- 前置条件（cUETH/cUUSD/cUBNB 在 Base+Arb 已配好）：目标链接收 ULN 配置的 `requiredDVNs` 含 owner。改配置用 `Memeverse/script/LzSetConfig.s.sol`（`CFG_DVN=<owner>`，以 OApp delegate 身份广播）。发送侧配置保持 LayerZero 默认——死 DVN 的 `assignJob` 是无害空操作。
- 同一路径按 nonce 顺序投递（端点 lazy-nonce 规则）；脚本一次处理一笔。
- 测试 UI「跨链中/待到账」状态时，别等链上自动到账——先跑 relay 再断言余额变化。

安全性：owner EOA 自签 = relay 脚本就是信任锚，仅测试网。主网必须配真 DVN（`requiredDVNs` = 各链 DVN 合约，同一个 `LzSetConfig.s.sol` 可接线）。

**BSC Testnet gas 陷阱**：验证者强制最低 0.1 gwei tip，forge/cast 默认 1559 交易（tip=1 wei）会被内存池静默黑洞（永不打包、无报错）。BSC 广播必须 `--legacy` + 显式 gasPrice（如 `--gas-price 15gwei`）。Base/Arb Sepolia 不受影响。

## 阶段验收

阶段交付的验收工作方式 = `docs/runbooks/`：`stage-*` 过程册记录各阶段的实装与验证过程，`acceptance-checklist.md` 是非专家黑盒验收清单（AC-1…AC-7，执行后回填执行记录）。两者为活文档，按阶段推进维护，不做整目录清理。

## 登记义务

新 token → `tokens.css` + `token-contract.md`；新组件/页面级 class → `docs/design-system/components.md`；新领域组件行为 → `components/design-system/component-contract.md`。不登记视为未完成。

## 注释纪律

代码注释只写就地原因与约束（why / 不这样做会怎样），不引用 `decision-log` 的决议编号、日期或「ruling / 决议」字样——注释必须脱离外部文档独立读懂，出处归 `decision-log.md`，决策变了改注释而不改引用。链上观测、SDK 版本、基准值这类经验事实可以带日期；会话轮次（round N）、「用户裁定」之类叙事一律不进注释。

## Agent 安全闸（不要绕过）

`.harness/policy.json` 是全局 destructive-git 守护的激活标记；`.claude/settings.json` 另有一层 deny 清单。
两层都禁止：`git checkout` / `git restore` / `git stash*` / `git clean` / `git push` / 破坏性 `git reset`，
以及读取 `.env*`。

- 回退单个文件不要用 `git checkout -- <file>`：它会连同**会话前的未提交改动**一起丢弃。
  改用精准 Edit 反向修改，或先问用户。
- 确实需要回滚时，由用户执行；Agent 不得自行绕过钩子（换写法、写脚本、改配置都算绕过）。
- 钩子不可用时（构建失败等）会 fail-open 放行，但规则不变。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

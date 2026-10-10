---
title: Outrun DApp 前端架构规范
navLabel: 前端架构规范
category: Architecture
meta:
  contentType: Reference
---

# Outrun DApp 前端架构规范

| 字段     | 值                                              |
| -------- | ----------------------------------------------- |
| 状态     | Final                                           |
| 生效日期 | 2026-08-31                                      |
| 适用产品 | Memeverse + OutStake DApp                       |
| 目标网络 | Ethereum、Base、BNB Smart Chain，含主网与测试网 |
| 交付方式 | 高保真原型全量验收后，按业务模块完成生产交付    |
| 部署平台 | Vercel                                          |

本文档定义 Outrun 去中心化应用（DApp）的前端架构、账户模型、页面范围、数据边界和质量门槛。它是实现和验收的单一真相源。实现不得降低页面范围、绕过 EIP-7702 账户要求或用生产假数据替代真实链上数据。

## 主路径摘要

原型用 v0 Plus 与仓库设计 Skills 生成覆盖 7 条产品路由（另含 `/design-system` 工具页）、双语响应式、全状态的 Next.js 原型，验收前不进入业务开发。栈为 Next.js 16、React 19、TypeScript、Tailwind CSS、shadcn/ui、TanStack Query、wagmi 3、viem、Privy 和 Kernel V3.3。Privy 接入 embedded EOA 及 MetaMask、OKX Wallet、Coinbase Wallet、WalletConnect 外部 EOA。Memeverse 写操作由 EOA 发送 EIP-7702 Type-4，在 Kernel 中原子执行 `approval? → beginAccountSession → Router → endAccountSession`；gas 由用户支付。数据走直接 RPC 与六链 The Graph，ABI 从固定合约 commit 冻结；测试含 Vitest、Playwright、Anvil fork 和测试网，部署 Vercel，监控 Sentry。

## 1. 产品目标、术语与阶段门

本节固定产品目标、文档术语和进入业务开发前的 UI 验收门。

本文档使用以下术语：

- **UI**：User Interface，用户直接操作和查看的界面
- **EOA**：Externally Owned Account，由私钥直接控制的外部账户
- **EIP-7702**：允许 EOA 将执行委托给合约代码的 Ethereum Improvement Proposal
- **Type-4 transaction**：EIP-7702 `SET_CODE_TX_TYPE` 交易，携带 `authorizationList`
- **Delegation implementation**：被 EIP-7702 authorization 挂载到 EOA 的账户代码
- **Authorization**：授权 EOA 在指定 chainId 和 nonce 下委托给 implementation 的签名
- **RPC**：Remote Procedure Call，前端读取和提交链上请求的接口
- **ABI**：Application Binary Interface，前端调用合约的类型边界
- **RSC**：React Server Components，Next.js 服务端组件模型
- **CI**：Continuous Integration，由 GitHub Actions 执行的持续集成检查
- **MAU**：Monthly Active Users，Privy 计费使用的月活跃用户数
- **CU**：Compute Units，Alchemy 计量 RPC 用量的单位

Outrun DApp 提供 Memeverse 与 OutStake 的完整用户功能、全部核心页面和全部链上数据展示。产品采用中英双语、桌面优先的响应式设计，同时完整支持移动端。

业务逻辑和合约集成开始前，必须先完成覆盖全部页面的高保真 UI 原型并通过产品验收。原型必须满足以下条件：

- 覆盖本文档定义的全部路由和全局交互面。
- 提供 1280×800 桌面、860×900 平板与 390×844 移动视图（三档=已冻结视觉基线口径，2026-10-10 对齐实况，见 §25）。
- 同时提供中文和英文内容，禁止只验证一种语言后推断另一种语言可用。
- 覆盖未连接、连接中、错误网络、普通 EOA、智能账户启用中、已启用智能账户、授权、签名、提交、确认、成功、失败、Loading…、Empty 和 Error 状态。
- 所有主流程可点击完成，禁止静态拼图、空按钮、占位页面和 lorem 文本。
- 原型数据采用符合真实产品规则的确定性 fixture；fixture 不得进入生产数据路径。
- 每轮设计反馈维护“本轮关闭的差异项”。连续两轮没有有效关闭差异时，停止生成并进入人工对齐。

原型载体是可运行的 Next.js 应用。验收通过的原型代码直接成为生产 UI 层，避免重新翻译设计稿。设计真相固定在 `PRODUCT.md`、`DESIGN.md`、设计 token、页面 brief、桌面截图和移动截图中。

原型设计固定使用 v0 Plus 与 Coding Agent。Coding Agent 必须应用仓库内 `frontend-design`、`impeccable`、`web-design-guidelines` 和 `vercel-react-best-practices`：v0 生成同一应用内的视觉方向和全页面代码，`frontend-design` 固定品牌视觉，`impeccable` 管理设计文档与成品质量，`web-design-guidelines` 检查可访问性和交互，`vercel-react-best-practices` 约束生产 React 实现。

## 2. 信息架构与页面清单

URL 方案：zh 路径带 `/zh` 前缀；en 为无前缀 canonical（`proxy.ts` 内部 rewrite 到 `/en/**`，应用树只有 `app/[locale]`）。表中的 `/` 代表落地页（en canonical `/`、zh `/zh`）。旧地址（`/launch`、`/memeverse`、`/memeverse/create`、`/en/**` 等）由 `proxy.ts` 307 收敛到 canonical（原型期防浏览器缓存，上线换 301；2026-09-22 方案 C）。语言切换走 `components/global/routes.ts` 的 `localePath`，禁止手拼 `/${locale}`。共 7 条产品路由；另有 `/design-system` 设计系统工具页（内部，不进导航）与 4 条嵌入型资产动线（组件级，非路由）。动态段 `[verseId]` = 链上 uint256 verseId，fixture 行 id 不进 URL。

| 路由                    | 页面职责         | 核心功能与数据                                                                        |
| ----------------------- | ---------------- | ------------------------------------------------------------------------------------- |
| `/`                     | 产品落地页       | Hero 定位（双模块闭环）、营销口径指标证据带、双引擎卡、机制入门与生命周期教育、进入产品 CTA；无个性化摘要（决议 007） |
| `/memeverse/explore`    | Memeverse 发现   | Verse 列表（阶段 tab：创世中默认/锁定中/已解锁，不跨阶段混排）、阶段内排序、治理链/资产族/创世模式过滤、搜索、参与规模 |
| `/memeverse/launch`     | 创建 Memeverse   | 注册参数、symbol 校验、多链选择、费用报价、提交和跨链注册状态                         |
| `/memeverse/[verseId]`  | Verse 详情单页   | 头卡+判定面板（双门槛/Fast Genesis）+参与面板（Genesis/Preorder/退款/领取）+交易台持久区（统计条/K 线/Swap）+四标签 `?tab=liquidity\|pol\|vault\|dao`（流动性与 LP、POL 铸造/赎回与拆合、收益库赎回、DAO 治理） |
| `/portfolio`            | 统一资产与活动   | 六链余额、uAsset/SY 资产（行内跨链 BridgeDialog/面值兑换/存入储蓄入口）、CDP 仓位与债务赎回（open-term，`redeem` 唯一减借）、USR 储蓄（suToken）、GenesisCredit、Genesis/POL/PT/YT 凭证、待领取项、跨链在途/滞留提醒（跨链发起并入本页，v1 无独立 bridge 页；交易历史归全局交易中心，决议 007） |
| `/referral`             | 推荐返佣         | 邀请链接（/ref/短码样式）、返佣 KPI（累计/待领/人数/费率）、逐币种领取、分账说明（65/25/10）、流水与朋友表 |
| `/faucet`               | 测试网水龙头     | 三 mock 代币领取（逐 token 24h 冷却/批量）、Get UUSD（PSM 面值 1:1）、生息资产直达创世入口 |

全局交互面包含主网/测试网模式、查看链选择器、钱包选择器、交易中心、跨链消息详情、通知中心和中英文切换。跨链消息详情由交易中心承载（决议 007）；通知中心 v1 延后——待办提醒由 `/portfolio` 可行动区与操作完成 toast 承接（决议 007，2026-09-17，条目保留供后续版本）。全局交互面与页面一并进入高保真验收。

> **产品裁定（2026-09-14）**：OutStake 模块与品牌对最终用户隐藏，用户仅通过参与 Memeverse 间接使用 OutStake 能力。据此 `/outstake`、`/outstake/[market]`、`/positions` 三条路由撤出页面清单：uAsset 获取（创世质押铸造、PSM 面值兑换）、USR 储蓄、仓位管理与债务赎回作为**嵌入型资产动线**进入 Memeverse 参与流程与 `/portfolio`，以组件级 brief 定义，不设独立品牌页面。导航与文案不得出现 OutStake 字样；uAsset、suToken 等可作为用户资产命名，SY、CDP、PSM、Kernel 等机制词汇仅必要时出现且须经术语表定稿。后续路由演进：详情页四子路由（trade/yield/stake/governance）并入单页四标签（2026-09-23 裁定）；创建/发现页并入 `/memeverse/*` 域（2026-09-23 裁定）；跨链功能并入 `/portfolio`、无独立 bridge 页（2026-10-02 裁定）；新增 `/referral`（2026-10-07）与 `/faucet`（2026-10-09）。

## 3. 前端技术栈

| 层                                   | 组件                               | 固定版本                           | 用途                                                                                                                                                             |
| ------------------------------------ | ---------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime                              | Node.js                            | 24.20.0（本地/CI）；24.x（Vercel） | 本地与 CI 精确使用 Krypton LTS `24.20.0`；Vercel 使用受支持的 `24.x` 并记录实际 patch                                                                            |
| Package manager                      | pnpm                               | 11.24.0                            | 严格依赖解析和高效缓存                                                                                                                                           |
| Toolchain bootstrap                  | Corepack                           | 0.34.5                             | 显式固定版本并固定 pnpm 版本；不依赖 Node 安装包中的默认版本                                                                                                     |
| Framework                            | Next.js                            | 16.3.3                             | App Router、React Server Components、服务端数据聚合和 Vercel 原生部署                                                                                            |
| UI runtime                           | React                              | 19.2.8                             | 页面和交互组件                                                                                                                                                   |
| React types                          | `@types/react`、`@types/react-dom` | 19.2.18 / 19.2.5                   | React 19 类型声明，Testing Library 必填 peer                                                                                                                     |
| Node types                           | `@types/node`                      | 24.13.3                            | Node.js 24 类型声明，Next.js/Vitest 构建支持                                                                                                                     |
| Language                             | TypeScript                         | 7.0.2                              | Go 原生编译器，`typescript7` alias 暴露的 `tsc` CLI 负责类型检查；满足 `wagmi 3.7.7` 的 TypeScript peer `>=5.9.3` 与 `viem 2.55.10` 的 TypeScript peer `>=5.0.4` |
| Language（lint 侧）                  | `vendor/typescript-bridge`（内含 `@typescript/typescript6`） | 6.0.2 | TypeScript 7 过渡期的本地桥包；普通包名 `typescript` 经 `link:` 指向该包：`main` 转发 `@typescript/typescript6` Compiler API 供 typescript-eslint，`bin/tsc` 调用 `typescript7` 的 TS 7 CLI |
| Lint                                 | ESLint + typescript-eslint         | 10.9.1 / 8.68.0                    | typed linting；`typescript` alias 满足 typescript-eslint peer `typescript >=4.8.4 <6.1.0`                                                                        |
| Formatting                           | Prettier                           | 3.9.6                              | `format:check` 的唯一格式化实现，配置归仓库                                                                                                                      |
| Styling                              | Tailwind CSS                       | 4.3.3                              | token 驱动的响应式样式                                                                                                                                           |
| CSS build support                    | PostCSS + `@tailwindcss/postcss`   | 8.5.26 / 4.3.3                     | Tailwind CSS 4 的 Next.js/PostCSS 构建支持                                                                                                                       |
| Components                           | shadcn/ui                          | 4.19.0                             | 可访问性基础组件，源码归仓库                                                                                                                                     |
| Component primitives runtime         | `@base-ui/react`                   | 1.5.0                              | shadcn base 变体组件的渲染原语（本仓 ui 组件经它渲染，非 radix）                                                                                                 |
| Icons                                | lucide-react                       | 1.37.0                             | 统一图标系统                                                                                                                                                     |
| Charting                             | lightweight-charts                 | 5.2.1                              | Verse 详情页 K 线交易台（candle-chart），客户端渲染不进 RSC 树                                                                                                    |
| Async state                          | TanStack Query                     | 5.102.8                            | RPC、GraphQL、交易和缓存状态                                                                                                                                     |
| Validation                           | Zod                                | 4.5.4                              | 配置、部署 manifest、表单和 API 边界校验                                                                                                                         |
| Ethereum state                       | wagmi                              | 3.7.7                              | 钱包连接、账户、网络和 React 链状态                                                                                                                              |
| Ethereum client                      | viem                               | 2.55.10                            | RPC、ABI、带 `authorizationList` 的 Type-4 交易、直接交易 simulation 和 EIP-7702                                                                                 |
| Wallet platform                      | `@privy-io/react-auth`             | 3.38.0                             | embedded EOA、外部钱包连接、登录、活动钱包选择和 EIP-7702 authorization                                                                                          |
| wagmi bridge                         | `@privy-io/wagmi`                  | 4.0.16                             | 同步 Privy embedded/external connectors 与 wagmi 状态                                                                                                            |
| Delegation implementation            | ZeroDev Kernel V3.3                | 合约版本 `0.3.3`                   | EIP-7702 delegated EOA 的直接 `execute` 原子调用代码                                                                                                             |
| Kernel ABI/encoder                   | Kernel V3.3 ABI + viem             | 合约版本 `0.3.3`                   | 从固定 Kernel tag 提取 ABI，用 viem 编码默认回退型 ERC-7579 batch                                                                                                |
| Indexing CLI                         | `@graphprotocol/graph-cli`         | 0.98.1                             | 六链 subgraph 构建与发布                                                                                                                                         |
| Unit tests                           | Vitest                             | 4.1.11                             | 领域、数据适配器和组件单测                                                                                                                                       |
| Test transform                       | vite                               | 8.2.2                              | Vitest 4 必填 peer（`^6                                                                                                                                          |     | ^7  |     | ^8`），测试转译与模块解析，不进入生产构建 |
| UI tests                             | Testing Library                    | 16.3.3                             | 语义化组件行为测试                                                                                                                                               |
| Testing Library peer                 | `@testing-library/dom`             | 10.4.1                             | `@testing-library/react` 16.3.3 必填 peer `^10.0.0`                                                                                                              |
| Test DOM environment                 | jsdom                              | 30.0.1                             | 组件测试 DOM 环境                                                                                                                                                |
| End-to-end tests                     | Playwright                         | 1.62.1                             | 双语、响应式、视觉和交易流程测试                                                                                                                                 |
| Accessibility scan                   | `@axe-core/playwright`             | 4.13.0                             | Playwright e2e 内嵌 axe 无障碍扫描（`check:e2e` 门禁组成部分）                                                                                                    |
| Ethereum Virtual Machine integration | Foundry/Anvil                      | 1.8.1                              | 与合约仓一致的本地链和 fork 测试                                                                                                                                 |
| Monitoring                           | `@sentry/nextjs`                   | 10.72.0                            | 客户端、服务端、RPC 和交易错误监控                                                                                                                               |

shadcn 组件复制件依赖四个随附样式工具——`class-variance-authority 0.7.1`、`clsx 2.1.1`、`tailwind-merge 3.3.1`、`tw-animate-css 1.4.0`（variant 组合、类名合并与入场动画；版本证据见 §18）。

`viem` 固定为 `2.55.10`，因为 `@privy-io/wagmi 4.0.16` 当前将其声明为精确 peer 版本。依赖升级必须先通过 peer 依赖、六链 EIP-7702 和完整交易回归测试。

TypeScript 采用双编译器布局：package manager 以 `typescript7: npm:typescript@7.0.2` 安装主编译器；普通包名 `typescript` 经 `link:./vendor/typescript-bridge` 指向本地桥包（`pnpm-workspace.yaml` 的 `packages` 同时列入根 package 与该桥包目录）。桥包 `main` 转发 `@typescript/typescript6@6.0.2` 的 Compiler API——typescript-eslint 通过普通包名加载的就是这份 TS 6 API，不能解析主 TS 7 包；桥包 `bin/tsc` 经绝对 `file://` 路径调用 `typescript7` 的 TS 7 CLI，`pnpm exec tsc` 与 `next build` 均经它执行类型检查。不得直接修改桥包，也不得用 `typescript` 包的程序化 API 书写 TS 7 语法。`@typescript/typescript6@6.0.2` 内部依赖 `@typescript/old: npm:typescript@^6`，因此根目录 `pnpm-workspace.yaml` 必须以 `overrides` 将 `@typescript/old` 固定为 `npm:typescript@6.0.2`，禁止解析到其他 6.x patch。package manager 必须同时锁定 `typescript7` alias、桥包内两个精确依赖和该 override；运行 `pnpm exec tsc --version` 必须输出 `Version 7.0.2`，typed-lint 自检 `node -p "require('typescript').version"` 必须输出 `6.0.2`。tsconfig 必须清理 TS 6 起废弃的选项（`baseUrl`、`target: es5`、`moduleResolution: node` 等），它们在 TS 7 中是硬错误。TS 7.1 提供稳定程序化 API 且 typescript-eslint 完成适配后，才可提出撤销双编译器的架构变更。

Next.js 16 production build 必须在 `next.config.ts` 显式保持 `experimental.useTypeScriptCli: true`，让 `next build` 调用项目 `.bin/tsc`（`vendor/typescript-bridge` 的 bin，转发 `typescript7` 的 TS 7 CLI）；禁止设置 `useTypeScriptCli: false` 或 `typescript.ignoreBuildErrors: true`。因此 Next build 与独立 `pnpm exec tsc --noEmit` 使用同一个 TS 7 编译器，普通包名 `typescript` 的 TS 6 API 只供 typescript-eslint typed lint 使用。

Node.js `24.20.0` 是 2026-08-26 发布的最新稳定 LTS 版本（代号 Krypton）。本地和 GitHub Actions 必须通过根目录 `.node-version` 精确使用该 patch；Vercel 官方按 `24.x` 选择并自动滚动 patch，因此 Vercel 构建必须记录实际 `process.version`，不能声称其始终运行 `24.20.0`。所有环境仍必须校验 Corepack `0.34.5`，再执行 `corepack enable` 和 `corepack install --global pnpm@11.24.0`；Node.js 25+ 环境必须显式安装 Corepack，不能假设其随 Node 分发。Vercel 必须以 custom Install Command `node scripts/bootstrap-pnpm.mjs` 覆盖平台默认安装：该无依赖脚本在读取 lockfile 前用 npm `--ignore-scripts` 安装/校验 `corepack@0.34.5`，激活 `pnpm@11.24.0`，再执行 frozen install；不得把安装后的 Corepack 检查误当作安装前版本证据。统一检查入口为 `node scripts/check-runtime.mjs --strict`（本地/CI）和 `node scripts/check-runtime.mjs --vercel --require-package`（Vercel）。

## 4. 应用结构与状态边界

代码按产品能力组织，不按页面堆叠网络请求：

```text
app/                 路由、布局、RSC 和页面组合
features/            stake、bridge、genesis、swap、pol、governance、account
entities/            asset、position、verse、proposal、transaction、account
components/          通用 UI 与领域组件
lib/web3/            chain、RPC、wagmi、Privy、Kernel 和交易生命周期
lib/data/            RPC/Graph repository、query key 和 ViewModel 映射
contracts/abi/       冻结 ABI
deployments/         按 chainId 管理的部署 manifest
subgraph/            事件索引 schema、mapping 和 data source template
fixtures/            原型和测试 fixture，生产构建禁止导入
tests/               unit、integration、e2e 和 visual
```

仓库根目录的运行时控制文件为 `.node-version`、`pnpm-workspace.yaml`、`.prettierrc.json`、`.prettierignore`、`scripts/bootstrap-pnpm.mjs` 和 `scripts/check-runtime.mjs`；它们与 `package.json` 的 `engines`/`packageManager` 字段共同构成可执行的环境与安全策略契约，不属于业务模块目录。`pnpm-workspace.yaml` 必须包含当前根 package 与双编译器桥包（`packages: ['.', 'vendor/typescript-bridge']`）并将 `@typescript/old` override 固定为 `npm:typescript@6.0.2`。

状态所有权固定如下：

- URL 保存 locale、查看链、筛选、排序、分页、Verse 和 market 标识。
- TanStack Query 保存 RPC、GraphQL、交易回执和异步服务状态。
- wagmi 保存钱包连接、活动账户和钱包链。
- Privy 保存用户会话、linked wallets 和 embedded wallet 状态。
- 表单草稿和弹窗状态保留在最近组件，不增加全局状态库。
- 合约原始返回值先映射为领域 ViewModel，页面不得直接依赖复杂 ABI tuple。

默认使用 React Server Components。由于第 14 节固定每请求 CSP nonce，所有页面按请求动态渲染；RSC 仍用于服务端组合和数据边界，但不得启用静态导出、ISR 或 PPR。钱包、输入、authorization、Type-4 simulation、交易和实时状态是边界清晰的 Client Components。服务端不得访问外部钱包 provider；客户端不得持有 Privy secret、Graph deploy key 或 RPC 管理密钥。

## 5. 网络与部署配置

| 环境    | 网络                    |  chainId |
| ------- | ----------------------- | -------: |
| Mainnet | Ethereum                |        1 |
| Mainnet | Base                    |     8453 |
| Mainnet | BNB Smart Chain         |       56 |
| Testnet | Ethereum Sepolia        | 11155111 |
| Testnet | Base Sepolia            |    84532 |
| Testnet | BNB Smart Chain Testnet |       97 |

每条链只有一个受 Zod 校验的配置对象，至少包含：

```text
chainId
environment
rpc.primary
rpc.fallback
explorer
layerZeroEid
finalityPolicy
contracts
deploymentBlock
abiVersion
implementationCodehashes
kernel7702Implementation
kernel7702Codehash
eip7702TxType
authorizationPolicy
gasPaymentPolicy
subgraphEndpoint
features
```

RPC 使用 Alchemy 主端点和 Infura fallback。公共 RPC 只用于本地开发，不进入生产 fallback。viem 使用有健康排名的 fallback transport 和 multicall；所有端点均设置域名限制、用量上限和告警。

生产域名默认只显示三条主网。测试网由明确的 Testnet 模式开启，并持续显示测试网标识。切换主网/测试网会清空当前交易草稿和目标链，禁止跨环境复用签名或报价。

“查看链”和“钱包链”相互独立。未连接用户可以查看任意支持链；写操作要求钱包或智能账户处于目标链。应用只在用户点击确认后请求切链，不自动切换钱包网络。

合约地址只来自 `deployments/{chainId}.json`。未部署地址使用结构化 `undeployed` 状态，禁止零地址或占位地址进入生产构建。构建阶段校验地址、ABI 版本、部署块、实现 codehash 和代理实现。

六条链统一使用 EIP-7702 Type-4 交易，`eip7702TxType` 固定为 `0x04`。交易由当前 EOA 自己签署并广播；首次启用时 authorization 与执行 calldata 放在同一 Type-4 交易中，后续交易不再重复携带 authorization。gas 由当前 EOA 支付。

六条链的 Kernel V3.3 implementation 地址均为 `0xd6CEDDe84be40893d153Be9d467CD6aD37875b28`。2026-08-30 的链上基线如下，runtime bytecode 大小均为 24,469 bytes：

|  chainId | runtime codehash                                                     |    核验区块 |
| -------: | -------------------------------------------------------------------- | ----------: |
|        1 | `0xd748c6060679ccb34583963e5edc21299e4c6723e7c7a80561d255861ed209b7` |  25,862,260 |
|     8453 | `0xe5b56d82025d2358308f77833fe29c3856b1a7a0f7a4b9f86b1fd77da3e3b4fb` |  50,616,719 |
|       56 | `0xcad500ade34248a6e7e84f6594cbbe31391fa26910527c9d131e39e42e75cc63` | 118,803,721 |
| 11155111 | `0x1cacd781072bcb657a6306afd074049f35d0a9d7f50eccda9b12bdd00c636995` |  11,593,138 |
|    84532 | `0x0b7b78a4c39a523ebfc23394a547dffd0b9eb0276740e8ce59b6b87287ded3af` |  46,127,248 |
|       97 | `0x5143969744cb305cedc9748f191ce11fb77fab00ae1e08f8d3beeeb0219239bd` | 127,947,409 |

Kernel 地址和 ABI 的外部来源固定为 `docs/architecture/kernel-v3.3-evidence.md` 登记的 ZeroDev `v3.3` tag commit `cd697c7e21715d015e0643af22310a99aa17433b`；该文件是 §19 两个业务合约仓之外的唯一外部合约来源。表中 codehash 是 2026-08-30 的本地链上观察值，不声称由上游源码发布；阶段 4/发布认证必须按该文件的 `cast chain-id`、`cast code`、`cast codehash` 命令逐链重读并写入 manifest，未重读或不匹配时保持只读。

每条链只有在发布时重新证明 EIP-7702 已激活、Kernel V3.3 implementation 地址及逐链 runtime codehash 匹配、chain-specific authorization 生效、带 `authorizationList` 的完整 Type-4 simulation 成功且真实 session Swap 成功后，才可开启写操作。不得替换为测试 mock；证据不完整时该链保持只读。

## 6. 钱包与 EIP-7702 账户模型

### 6.1 账户原则

普通 EOA 不能直接执行 Memeverse Swap。Swap、Permit2 Swap 和 YT Flash Swap 必须由有代码的账户在同一原子执行帧内完成：

```text
Hook.beginAccountSession()
Router action
Hook.endAccountSession()
```

产品的标准执行账户是 EIP-7702 delegated EOA。用户地址、资产和既有授权保持不变，账户代码逐链委托给 ZeroDev Kernel V3.3。前端只允许 codehash 与部署 manifest 匹配的 Kernel V3.3 delegation 进入 Memeverse 交易；交易直接由活动 EOA 以 Type-4 格式发送。

### 6.2 账户来源

Privy 同时提供以下账户入口：

- 外部 EOA：MetaMask、OKX Wallet、Coinbase Wallet，以及通过 WalletConnect 或 EIP-6963 发现的兼容 EVM 钱包。
- Privy embedded EOA：邮箱、社交账号或无兼容外部钱包的用户。

Privy 负责登录、连接、linked wallets 和活动钱包选择。`useSign7702Authorization` 按活动钱包地址请求 authorization；外部钱包由自身 provider 展示并确认签名，embedded EOA 由 Privy signer 完成签名。wagmi 读取 Privy connector 暴露的活动 EIP-1193 provider，viem WalletClient 使用同一 provider 发送带 `authorizationList` 的 Type-4 交易。

外部 EOA 直接在原地址启用 delegation，不创建新账户、不迁移资产。Kernel 只作为挂载到该 EOA 的执行代码。每个钱包品牌和版本必须通过 authorization 签名与 Type-4 发送能力检测；能力不满足时保留读取功能并提示升级钱包，Privy embedded EOA 作为用户主动选择的独立账户入口。

连接钱包不等于启用智能账户。账户状态固定为：

```text
Disconnected
Connected EOA
Authorization requested
Authorization signed
Delegation pending
Kernel delegated
Unsupported delegation
Delegation replacement pending
Delegation revoked
```

### 6.3 Kernel V3.3 执行

Kernel V3.3 是唯一生产 EIP-7702 delegate implementation。Kernel ABI 固定到 `v3.3` tag；本地 encoder 使用 viem `encodeFunctionData` 与 `encodeAbiParameters` 生成 `execute(ExecMode,bytes)` calldata。`ExecMode` 固定为 `CALLTYPE_BATCH = 0x01`、`EXECTYPE_DEFAULT = 0x00`，batch 固定编码为 `Execution(address target,uint256 value,bytes callData)[]`。

Memeverse 交易使用 Kernel 默认原子 batch，调用顺序固定为：

```text
可选 token approval / Permit2 approval
Hook.beginAccountSession
MemeverseSwapRouter.swap / swapWithPermit2 / YTFlashSwapRouter action
Hook.endAccountSession
```

禁止使用 Kernel `TRY_EXEC`。任一调用失败必须使整个 batch 回退。Router 看到的 `msg.sender`、Hook 记录的 active principal、token payer、Permit2 owner、费用归属地址和输出账户必须是同一个 delegated EOA 地址。

EIP-7702 delegation 启用和首笔 Swap 是两个独立的用户可见状态。授权处理可能在后续执行失败时仍然生效，因此 UI 不得把“Swap 失败”解释为“智能账户未启用”。账户页必须显示当前链 delegation、实现地址、codehash、启用交易和撤销/替换入口。

authorization 使用当前目标 chainId，禁止使用 `chainId = 0` 的通用授权。六条链分别维护 delegation 状态和实现 codehash。

所有经 Kernel 执行的 Memeverse 写操作先冻结报价与 manifest，再以 Kernel `execute` 的默认 revert-on-failure 模式编码同一 atomic callData。禁止对 `MemeverseSwapRouter.swap`、`swapWithPermit2` 或 `YTFlashSwapRouter` 单独调用 viem `simulateContract`，因为脱离 Kernel session batch 时 Hook 没有 active account session；应模拟最终 Type-4 交易的完整执行上下文。首次 delegation 的 Type-4 交易携带 chain-specific authorization，`to` 固定为用户 EOA 地址，calldata 为 Kernel 的 `execute` batch；已 delegated 账户的后续 Type-4 交易不重复携带 authorization。

直接交易准备固定遵循：读取当前 EOA pending transaction nonce `N` 和 chainId → 生成 Kernel `execute` batch callData → 如未 delegated，以当前链、Kernel 地址和 authorization nonce `N + 1` 调用 Privy `useSign7702Authorization`，并显式传入活动钱包地址 → 以 transaction nonce `N`、`authorizationList` 和 `to = EOA` 构造自执行 Type-4 交易 → 用 `publicClient.simulateContract` 在 EOA 地址上携带相同 `authorizationList` 模拟最终 Kernel batch → 用户确认后由同一钱包签署并广播完全相同的交易字段。`N + 1` 是 signer 与 Type-4 transaction sender 为同一 EOA 时的协议要求；使用 viem 原生 authorization signer 时等价配置为 `executor: 'self'`。simulation 与广播之间 EOA nonce、chainId、authorization、报价、slippage、deadline、callData、manifest 或账户代码变化时必须重新构造和模拟。Kernel `TRY_EXEC` 禁止使用；任何嵌套 revert data 统一解码到交易错误模型并显示恢复动作。

### 6.4 Gas 支付

Type-4 交易由活动 EOA 支付目标链原生 gas。交易中心在签名前显示预计 gas、原生币余额和不足时的补充入口；余额不足时禁止请求 authorization 和交易签名。

### 6.5 账户能力检测

前端按以下顺序判断：

1. `eth_getCode` 为空：普通 EOA，Memeverse 交易前必须启用 7702。
2. 代码以 `0xef0100` 开头，implementation 与 manifest 匹配：Kernel delegated，可执行 Swap。
3. 代码以 `0xef0100` 开头但 implementation 不匹配：Unsupported delegation，先替换 delegation。
4. 其他非空代码：允许连接和读取；Memeverse Swap 默认禁用，不自动推断兼容性。

报价和 Type-4 simulation 必须使用最终执行账户作为 `account`、交易 sender 和 trader。账户状态、钱包地址或链发生变化时，已有报价和 simulation 立即失效。

## 7. 钱包与交易 UX

钱包 UI 由 shadcn/ui 和 wagmi/Privy hooks 实现，保持 Outrun 视觉系统，不使用第三方默认 modal 作为产品界面。

钱包列表顺序固定为：

1. 当前浏览器通过 EIP-6963 发现的 MetaMask、OKX Wallet、Coinbase Wallet 和其他已安装 EVM 钱包。
2. WalletConnect。
3. 创建或恢复 Privy embedded wallet。

同一钱包按 provider UUID/RDNS 去重。发现具体钱包后不再显示笼统的 “Injected Wallet”。连接必须由用户动作触发；页面加载只允许恢复用户此前授权的会话，禁止自动弹窗、自动请求账户或自动签名。

所有写操作使用统一交易中心，状态固定为：

```text
Preparing…
Preflighting…
Awaiting authorization…
Simulating Type-4 transaction…
Awaiting transaction signature…
Submitted
Confirming…
Confirmed
Reverted
Replaced
Cancelled
```

每笔交易在签名前显示目标链、活动账户、目标合约、函数语义、输入、最小输出、费用、gas 支付方和授权变化，并按执行账户进入对应 simulation 路径。

直接 EOA 合约写入使用 viem `simulateContract`。Kernel 写入使用第 6.3 节定义的完整 Type-4 pipeline：首次 delegation 先签 authorization，再以相同 `authorizationList` 模拟 EOA 地址上的 Kernel batch，最后签署并广播相同交易；已 delegated 账户跳过 authorization。任何 simulation 失败都禁止发送，并将解析后的 ABI custom error 或基础设施错误显示在交易中心。

跨链操作在源链确认后保持 Message pending，直到目标链事件确认。拿到源链交易 hash 不等于跨链完成。

## 8. 合约并行开发与 ABI 冻结

设计阶段允许 Memeverse 和 OutStake 合约继续开发，前端原型只依赖领域 ViewModel fixture，不直接读取未冻结 Foundry artifact。

高保真原型通过后，从固定合约 commit 导出前端 ABI release candidate：

```text
contracts/abi/v1-rc/*.json
contracts/abi/v1-rc/manifest.json
```

manifest 记录：

- Memeverse commit。
- OutStake commit。
- 合约名称和 ABI SHA256。
- ABI 版本。
- 每链代理地址和实现地址。
- 部署块和部署交易。
- runtime codehash。
- Kernel V3.3 implementation 地址和 codehash。

ABI RC 冻结后部署 Sepolia、Base Sepolia 和 BSC Testnet。前端合约集成只使用冻结 ABI 和真实测试网地址。冻结后的 ABI 语义变化必须提升 ABI 版本、更新 manifest、重新部署受影响测试网实例并完成全量回归。

主网发布前将 ABI 冻结为 `v1`。生产前端保留旧 ABI 直到对应旧代理和用户交易全部完成，禁止原地覆盖 ABI 文件。

## 9. 链上数据架构

数据按用途分成两条路径。

### 9.1 直接 RPC

viem 直接读取以下数据：

- 余额、allowance、nonce 和 EIP-7702 code。
- 当前仓位、汇率、容量、暂停状态和报价。
- simulation、gas、交易回执和跨链即时状态。
- 与当前用户和当前页面直接相关的 bounded multicall。

### 9.2 The Graph Studio/Network

每条链部署一个 subgraph。主网使用 Graph Network 查询端点，测试网使用 Studio 查询端点。subgraph 负责：

- Verse 注册、生命周期和列表。
- Genesis、Preorder、退款、领取和参与历史。
- OutStake 仓位事件和用户活动。
- Swap、流动性、费用、推荐返佣和 YT Flash Swap 历史。
- Staking、治理提案、投票、周期奖励和国库活动。
- LayerZero 发送和接收事件索引。

Memeverse 动态部署的 Memecoin、POL、PT、YT、YieldVault 和 Governor 使用 subgraph data source template。每个实体主键包含 chainId 和链上唯一标识，禁止跨链仅用地址作为主键。

全局列表和跨链聚合通过 Next.js 服务端 repository 查询 Graph，并使用短时缓存和请求去重。浏览器只查询当前用户必须实时读取的数据。页面同时读取 Graph `_meta.block.number` 和 RPC 最新安全块。索引落后时静默降级（聚合历史数据稍旧，不显示用户可见状态）；余额、授权、账户代码和交易最终结果始终以 RPC 为准。（原「显示同步状态」横幅撤除；曾错引决议 015，已撤，见 §24）

## 10. UI 与可访问性标准

- 设计系统以 token 管理颜色、字体、间距、边框、阴影、层级和 motion。
- shadcn 组件复制进仓库后，只通过 token 和明确 variant 扩展。
- 领域组件至少包含 AmountInput、AssetSelector、ChainSelector、TransactionReview、TransactionStatus、AccountCapability、PositionTable、VerseStage、TokenPair 和 EmptyState。
- 所有按钮、输入、弹窗、菜单、表格和通知可使用键盘操作，并具有可见 focus state。
- 图标按钮具有可访问名称；装饰图标对辅助技术隐藏。
- 异步状态通过 `aria-live` 宣布；错误显示在操作附近并提供恢复动作。
- 所有 motion 尊重 `prefers-reduced-motion`。
- 表格数字使用 tabular numerals；地址、hash、symbol 和长文本支持截断及复制。
- 中文和英文不使用同一固定字符宽度推断布局；两种语言分别进行溢出测试。
- 页面必须处理零余额、零仓位、未部署、暂停、RPC 故障和用户拒签。（索引延迟为静默降级，不列为用户可见状态）

## 11. 测试体系

### 11.1 单元与组件测试

- 领域金额、单位换算、slippage、deadline、链配置和 ViewModel 映射使用 Vitest。
- 表单、账户状态、错误信息、键盘操作和双语渲染使用 Testing Library。
- RPC、Graph、Privy、Kernel encoder 和 external-wallet provider adapter 通过接口级 mock 测试，不 mock 领域规则。

### 11.2 浏览器测试

Playwright 覆盖 Chromium、WebKit 和 Firefox。必测矩阵包含：

- 1280×800 桌面、860×900 平板与 390×844 移动视图（三档=已冻结视觉基线，DPR 固定 1；口径对齐见 §25）。
- 中文与英文。
- 主网与测试网模式。
- 未连接、外部 EOA、embedded EOA、Kernel delegated 和 unsupported delegation。
- 每个页面的 Loading…、Empty、Error、成功和失败状态。
- 关键页面视觉快照和交互回归。

### 11.3 EVM 集成测试

Anvil 使用与合约仓相同的 Foundry `1.8.1`。集成测试覆盖：

- Ethereum、Base 和 BSC 固定区块 fork。
- EIP-7702 Type-4 authorization、`N / N + 1` nonce 关系、Kernel V3.3 delegation、Kernel `execute` batch、`authorizationList` 和 byte-identical submission。
- 三个 Router 写方法禁止脱离 session batch 仿真；必须在 EOA 地址上携带相同 `authorizationList` 模拟最终 Type-4 交易。
- Kernel 默认 atomic batch 的 `begin → Router → end`。
- 任一内层调用失败时完整 batch 回退。
- `TRY_EXEC` 不得出现在生产调用中。
- principal、payer、Permit2 owner、recipient 和动态费率 key 一致。
- 普通 Swap、Permit2 Swap、YT Flash Buy/Sell、加减流动性和费用领取。
- delegation 替换、撤销、错误 codehash 和逐链状态隔离。
- PSM 面值兑换（`tin`/`tout` 费率、`stockCap` headroom、dust 域 quote 返 0 而执行 revert）、USR ERC4626 计息（`accrualIndex` 平方求幂外推、封顶钳制、`usrRate` 前瞻生效）与 open-term CDP 仓位（`stakeForGenesis` 唯一铸造入口、债务/赎回状态机）。

真实 Sepolia、Base Sepolia 和 BSC Testnet 测试使用 Privy embedded/external wallet、viem Type-4 transaction 和 Kernel V3.3 implementation。三条链都必须覆盖真实 authorization、带 `authorizationList` 的最终 Type-4 simulation、签名、提交、回执和 session Swap。该套件在 ABI、账户依赖、部署 manifest 变化和发布候选上执行，不作为普通样式 PR 的外部网络硬依赖。

## 12. 持续集成、部署与环境

GitHub Actions 是唯一 CI。所有 PR 必须通过：

- 依赖锁文件一致性与已知漏洞检查。
- TypeScript 类型检查（TS 7 `tsc`）、lint（typescript-eslint，类型信息来自 `@typescript/typescript6`）、格式和生产构建。
- 单元与组件测试。
- Playwright 桌面/移动、中文/英文和视觉测试。
- ABI/manifest schema、SHA256、地址和 codehash 校验。

运行时和包管理器绑定是机器可执行契约：根目录 `.node-version` 必须为 `24.20.0`；`pnpm-workspace.yaml` 必须包含根 package 与 `vendor/typescript-bridge` 并固定 `@typescript/old: npm:typescript@6.0.2` override；前端 `package.json` 必须包含 `engines.node: "24.x"`、`engines.pnpm: "11.24.0"` 和 `packageManager: "pnpm@11.24.0"`。本地与 GitHub Actions 使用 `actions/setup-node@v4` 的 `node-version-file: .node-version`，随后校验 Corepack `0.34.5`、pnpm `11.24.0`，并运行 `node scripts/check-runtime.mjs --strict`。Vercel 项目 Node.js 设置固定为 `24.x`，`vercel.json` 的 `installCommand` 固定为 `node scripts/bootstrap-pnpm.mjs`；该脚本安装并验证 Corepack `0.34.5` 后才允许 `pnpm install --frozen-lockfile`。`ENABLE_EXPERIMENTAL_COREPACK=1` 可保留为平台兼容开关，但不作为 Corepack patch 证据。构建前仍运行 `node scripts/check-runtime.mjs --vercel --require-package` 和 `pnpm --version`；Vercel 自动更新同一 major 的 Node patch，实际版本和 bootstrap 输出必须写入构建证据。

格式门禁固定使用 Prettier `3.9.6` 和仓库根目录 `.prettierrc.json`，命令为 `pnpm exec prettier --check .`；不得以缺少 `format:check` script 或只运行 ESLint 代替格式检查。

涉及 ABI、chain、account、Privy、external wallet、EIP-7702、Kernel、交易或 subgraph 的变更增加 Anvil fork 和真实测试网套件。

机器闸门为 `.githooks` + GitHub Actions 双轨。`.githooks` 已入库（`git config core.hooksPath .githooks` 挂载）：pre-commit 对 staged blob 跑 prettier 与 eslint（staged-blob 语义，`--no-verify` 绕过后须补跑全量）；pre-push 跑全仓 typecheck 与 vitest 全量（vitest 内含 fixture 边界与设计三 checker）。CI 现状（2026-10-10）为上列契约的先导子集：typecheck、lint、format、vitest、冻结清单完整性已接线（lint 存量债已清偿、阻断已恢复，见 §25）；生产构建与 Playwright 原型期走本地 `pnpm build` / `pnpm test:e2e`，ABI 校验随冻结轮接线，均未进 CI。

Vercel 环境固定为：

| 环境       | 网络             | 用途                                                           |
| ---------- | ---------------- | -------------------------------------------------------------- |
| Preview    | fixture 或测试网 | PR 视觉和功能验收                                              |
| Staging    | 三条测试网       | 真实合约、Privy embedded/external wallet、Kernel 和 Graph 集成 |
| Production | 三条主网         | 用户生产流量                                                   |

生产部署只从受保护主分支产生。阶段 3 原型验收可使用本地可运行预览或 v0 URL 完成；Vercel Preview 可作为补充证据，不是阶段 3 阶段门的必要条件。模块和 PR 的部署验收在需要时使用 Vercel Preview。生产环境变量与 Preview、Staging 完全隔离。Vercel 的 Node 版本按 `24.x` 运行并记录实际 patch，不将 Vercel 平台的自动 patch 更新误写为本地 `24.20.0`。

每个生产部署记录应用 commit、依赖锁文件 hash、ABI 版本和部署 manifest hash。前端故障通过 Vercel 回滚到最近兼容部署；回滚目标必须兼容当前链上代理和 Kernel codehash。没有兼容构建时，应用进入只读维护模式并停止所有写操作。

## 13. 监控与运维信号

Sentry 记录脱敏后的：

- 页面、RSC、route handler 和 hydration 错误。
- RPC provider、chainId、方法类别、延迟和失败类型。
- Privy 连接和 authorization 阶段，不记录签名、token 或完整用户数据。
- Privy、external-wallet provider、EIP-7702 authorization、阶段、延迟和失败类型。
- Type-4 transaction simulation、签名、提交、确认、revert 和 replacement。
- Graph 查询错误与索引延迟。

监控阈值固定为：

- RPC 5 分钟错误率超过 1% 或 p95 超过 2 秒告警。
- Graph 索引落后时静默降级（聚合数据稍旧），不做用户可见展示。
- Type-4 transaction Pending 超过 2 分钟提示用户，超过 10 分钟触发运维告警。
- Privy、Alchemy、Infura、Graph 和 Vercel 用量达到 70% 预警、90% 高优先级告警。
- Kernel implementation、Memeverse/OutStake 代理实现、peer、暂停和 rate-limit 配置发生未登记变化时立即告警。

Sentry 中的钱包地址默认哈希化；只有用户主动复制或进入区块浏览器时展示完整地址。Session Replay 默认关闭。

## 14. 安全约束

- Privy app secret、Graph deploy key 和部署私钥只能存在于服务端密钥存储；外部钱包密钥永远不进入应用或服务端。
- 浏览器中的 public project ID 必须配置域名和用量限制。
- 前端只信任 manifest 登记的代理、实现、Hook、Router、Permit2 和 Kernel 地址。
- EIP-7702 authorization 前展示目标 implementation、chainId 和权限含义。
- Kernel implementation codehash 不匹配时禁止 Swap，不提供“仍然继续”入口。
- Kernel V3.3 implementation、Privy signer、external-wallet provider、直接 Type-4 encoding、Memeverse account session 的精确生产组合必须在主网上线前通过独立安全审查。审查对象固定到 commit、包版本、implementation 地址和 codehash。
- ZeroDev 发布新 Kernel implementation 时，前端不得自动接受。新实现必须建立新 manifest 版本、完成独立安全审查，并由用户明确签署新的 delegation。
- delegation 使用 chain-specific authorization，禁止默认 universal authorization。
- Type-4 交易固定由活动 EOA 支付原生 gas；余额不足时禁止进入签名阶段。
- 所有写操作先 simulation；Kernel 路径按第 6.3 节标准 Type-4 pipeline 执行，禁止脱离 session batch 模拟 Router。账户、链、EOA nonce、authorization、报价、callData 或 deployment manifest 变化时重新准备；签名后任一交易字段变化必须废弃签名。
- Approval 默认使用精确额度；只有用户明确选择时才允许无限授权，并提供撤销入口。
- 内容安全策略（Content Security Policy，CSP）使用 Next.js App Router 的每请求 nonce 模式。Next.js 16 `proxy.ts` 必须用 Web Crypto 为每次请求生成独立高熵 nonce，将同一 nonce 写入 request 的 `x-nonce`、request CSP header 和 response CSP header；`script-src` 固定包含 `'self'`、`'nonce-<request-value>'`、`'strict-dynamic'` 与已登记的 Cloudflare challenge origin，生产环境禁止 `'unsafe-inline'`/`'unsafe-eval'`。根 locale layout 读取 `x-nonce` 并传给显式 `next/script`；Next.js 从 request CSP 自动为 framework/page scripts 附 nonce。Nonce 页面全部动态渲染，明确放弃静态优化、ISR、PPR 和默认 Edge CDN 页面缓存；这一安全取舍不得在实现阶段改回静态模式或 SRI。
- CSP 的机器可读基准是 `docs/security/csp-origins.json`：`frame-src`/`child-src` 允许 `auth.privy.io`、WalletConnect verify 域名和 Cloudflare challenge；`connect-src` 允许 Privy auth/RPC、WalletConnect relay/explorer 以及 `'self'`。六条 RPC 和 Graph endpoint 必须以精确 origin 从 Zod 链配置注入，Sentry 只允许从配置 DSN 解析出的 origin；Vercel/其他分析域名默认不加入，启用前必须更新该文件并重新审查。禁止未登记的 bare `*` 或任意第三方脚本源。CI 必须对两次独立 production 请求证明 nonce 形状有效且互不相同、response CSP 中恰有一个 nonce，并用 Playwright 证明每个可执行 `<script>` 的 DOM `nonce` 与该响应一致；只校验 JSON、只发 `Content-Security-Policy-Report-Only` 或复用 nonce 均失败。
- 前端不得根据 `tx.origin`、URL 地址或客户端参数推断链上权限。

## 15. 模块完成标准

模块只有同时满足以下条件才可上线：

- 对应页面达到已验收高保真设计，桌面和移动无布局重叠或文本溢出。
- 中文和英文内容完整。
- 只使用真实测试网/主网数据，生产路径无 fixture。
- 正常、Loading…、Empty、Error、暂停、错误网络和拒签状态完整。
- 写操作包含正确执行上下文的 Type-4 simulation、交易审阅、明确 authorization/transaction 签名阶段和最终结果。
- ABI、地址、codehash 和起始块来自冻结 manifest。
- 单元、组件、Playwright、Anvil fork 和适用的真实测试网测试通过。
- Sentry、RPC、Graph、Privy、Kernel 和 external-wallet provider 监控已接入。
- 页面没有占位文案、未实现按钮或隐藏的核心功能。

在全页面高保真原型已通过的前提下，生产模块按以下边界独立交付：

1. 应用壳、账户、网络和 Portfolio。
2. 资产动线（uAsset 铸造、PSM 兑换、USR 储蓄、仓位赎回的内嵌流程）与跨链。
3. Memeverse 发现、创建、详情、Genesis 和 Preorder。
4. Memeverse Swap、流动性和 7702 session。
5. POLend、POL/PT/YT 和 YT Flash Swap。
6. Staking、DAO 治理和奖励。

每个已上线模块均为最终质量，不存在半成品上线状态。

## 16. 生产风险与处置

| 风险                                  | 触发条件                                                            | 监控信号                                            | 预案                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 某链不满足 EIP-7702/Kernel 发布条件   | hardfork、implementation 或 codehash 任一验证失败                   | chain certification CI 失败、codehash 告警          | 该链保持只读；恢复已审查的逐链基线并重新完成全链认证后才能开启写操作                         |
| 外部钱包不能签 EIP-7702 authorization | provider 不暴露签名能力、返回不支持或连续拒绝                       | wallet RDNS/版本维度的 capability 失败率            | 保留读取功能并提示升级钱包；用户主动选择 Privy embedded EOA 时，单独展示新账户地址和入金流程 |
| Type-4 simulation 与提交状态漂移      | EOA nonce、authorization、报价、deadline、callData 或 manifest 变化 | 签名交易字段与提交前重算字段不一致、revert 错误上升 | 废弃旧结果，重建 authorization、Type-4 交易并重新 simulation                                 |
| ABI 或链上实现漂移                    | 代理实现、runtime codehash、ABI hash 与 manifest 不一致             | 构建校验或运行时完整性告警                          | 立即关闭受影响写操作并进入只读；发布匹配的新 manifest 与兼容前端                             |
| Graph 索引延迟或查询中断              | 安全块落后超过 120 秒或查询错误率超过 1%                            | `_meta.block.number` 差值、Graph 错误率             | 静默降级（聚合历史数据稍旧，无用户可见状态）；余额、授权和交易结果改用 RPC，禁止用陈旧索引判定交易成功 |
| 跨链消息长时间未完成                  | 源链已确认但目标链事件超过协议预期窗口                              | message age、源/目标链事件差异                      | 保留 Message pending，提供源链 hash 与消息标识；禁止重复发起同一业务动作                     |
| Kernel/Privy/SDK 出现高危漏洞         | 官方安全公告、独立审查发现或依赖漏洞扫描命中                        | 安全订阅、CI advisory、Sentry 异常模式              | 关闭全部相关写操作，维持只读；固定修复版本、重新审查并要求不兼容 delegation 显式替换         |

## 17. 成本基线

价格以 2026-08-30 官方页面为准，不含链上 gas、税费和超额用量。

| 组件                     |                                        基线成本 |
| ------------------------ | ----------------------------------------------: |
| v0 Plus                  |                   原型期 $30/月，原型验收后取消 |
| Vercel Pro               |                                          $20/月 |
| Privy                    | 0 至 499 MAU 为 $0；500 至 2,499 MAU 为 $299/月 |
| Alchemy                  |                               30M CU/月免费档起 |
| Infura                   |                          免费档作为 fallback 起 |
| The Graph Studio/Network |                         100,000 查询/月免费档起 |
| Sentry                   |                              Developer 免费档起 |
| GitHub Actions           |            公共仓免费；私有仓按 GitHub 账户额度 |

原型期固定平台成本为 $50/月。主网上线后的最低固定平台成本为 $20/月（Vercel Pro，Type-4 交易由用户支付 gas）；Privy、RPC、Graph、Sentry 和 CI 超额费用按实际流量增加。

## 18. 版本与维护证据

检索日期：2026-08-31。

- v0 是持续交付 SaaS，没有公开语义版本号：[changelog](https://v0.dev/changelog)、[pricing](https://v0.dev/pricing)。
- 本地 `frontend-design` 没有声明语义版本，固定 SHA256 `1608ea77fbb6fc30d13a97d12cfa8ebf31358d40f0dd97beed24829d6b3f45dd`：[本地指令](../.agents/skills/frontend-design/SKILL.md)、[上游](https://github.com/anthropics/skills)。
- 本地 `impeccable 4.1.2`：[本地指令](../.agents/skills/impeccable/SKILL.md)、[上游](https://github.com/pbakaus/impeccable)。
- 本地 `web-design-guidelines 1.0.0` 与 `vercel-react-best-practices 1.0.0`：[Web guidelines](../.agents/skills/web-design-guidelines/SKILL.md)、[React guidelines](../.agents/skills/vercel-react-best-practices/SKILL.md)、[上游](https://github.com/vercel-labs/agent-skills)。
- Node.js `24.20.0`（Krypton，LTS；发布于 2026-08-26；npm `11.19.0`；Linux x64 tarball SHA256 `855d581f8a4eb1a8117e3426de25fe02770592febcfb31369aee1ffbfee9e8ec`）：[release index](https://nodejs.org/dist/index.json)。
- Corepack `0.34.5`（Node.js 25+ 不再随 Node 分发，需显式安装）：[distribution policy](https://github.com/nodejs/node/blob/main/doc/contributing/distribution.md)、[npm](https://www.npmjs.com/package/corepack/v/0.34.5)。
- pnpm `11.24.0`：[npm](https://www.npmjs.com/package/pnpm/v/11.24.0)、[releases](https://github.com/pnpm/pnpm/releases)。
- `@types/node 24.13.3`：[npm](https://www.npmjs.com/package/@types/node/v/24.13.3)。
- PostCSS `8.5.26` 与 `@tailwindcss/postcss 4.3.3`：[PostCSS npm](https://www.npmjs.com/package/postcss/v/8.5.26)、[Tailwind PostCSS npm](https://www.npmjs.com/package/@tailwindcss/postcss/v/4.3.3)。
- Next.js `16.3.3`：[release](https://github.com/vercel/next.js/releases/tag/v16.3.3)。
- React `19.2.8`：[release](https://github.com/facebook/react/releases/tag/v19.2.8)。
- TypeScript `7.0.2`：[npm](https://www.npmjs.com/package/typescript/v/7.0.2)、[repository](https://github.com/microsoft/TypeScript)、[7.0 公告](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)；主编译器 alias 为 `typescript7: npm:typescript@7.0.2`。普通包名 `typescript` 经 `link:` 指向本地桥包 `vendor/typescript-bridge`：`main` 转发 [兼容包 npm](https://www.npmjs.com/package/@typescript/typescript6/v/6.0.2) `@typescript/typescript6@6.0.2` 的 API，`bin/tsc` 调用 TS 7 CLI；该兼容包声明 `@typescript/old: npm:typescript@^6`，由 `pnpm-workspace.yaml` override 精确解析为 `typescript@6.0.2`。TypeScript 7 尚无稳定程序化 API，故 typescript-eslint 保持 TypeScript 6 API 进程隔离。
- Tailwind CSS `4.3.3`：[release](https://github.com/tailwindlabs/tailwindcss/releases/tag/v4.3.3)。
- shadcn `4.19.0`：[release](https://github.com/shadcn-ui/ui/releases/tag/shadcn%404.19.0)。
- `@base-ui/react 1.5.0`：[npm](https://www.npmjs.com/package/@base-ui/react/v/1.5.0)。
- shadcn 随附样式工具 `class-variance-authority 0.7.1`、`clsx 2.1.1`、`tailwind-merge 3.3.1`、`tw-animate-css 1.4.0`：[cva npm](https://www.npmjs.com/package/class-variance-authority/v/0.7.1)、[clsx npm](https://www.npmjs.com/package/clsx/v/2.1.1)、[tailwind-merge npm](https://www.npmjs.com/package/tailwind-merge/v/3.3.1)、[tw-animate-css npm](https://www.npmjs.com/package/tw-animate-css/v/1.4.0)。
- lucide-react `1.37.0`：[npm](https://www.npmjs.com/package/lucide-react/v/1.37.0)、[repository](https://github.com/lucide-icons/lucide)。
- lightweight-charts `5.2.1`：[npm](https://www.npmjs.com/package/lightweight-charts/v/5.2.1)、[repository](https://github.com/tradingview/lightweight-charts)。
- TanStack Query `5.102.8`：[npm](https://www.npmjs.com/package/@tanstack/react-query/v/5.102.8)、[repository](https://github.com/TanStack/query)。
- Zod `4.5.4`：[npm](https://www.npmjs.com/package/zod/v/4.5.4)、[repository](https://github.com/colinhacks/zod)。
- wagmi `3.7.7`：[release](https://github.com/wevm/wagmi/releases/tag/wagmi%403.7.7)。
- viem `2.55.10`：[release](https://github.com/wevm/viem/releases/tag/viem%402.55.10)、[EIP-7702 Type-4 transaction](https://viem.sh/docs/eip7702/sending-transactions)、[authorization simulation](https://viem.sh/docs/contract/simulateContract)；项目在 `2.56.x` 持续维护，当前因 Privy peer 固定旧 patch。
- Privy `@privy-io/react-auth 3.38.0`、`@privy-io/wagmi 4.0.16`：[React SDK](https://www.npmjs.com/package/@privy-io/react-auth/v/3.38.0)、[wagmi bridge](https://www.npmjs.com/package/@privy-io/wagmi/v/4.0.16)、[EIP-7702 authorization](https://docs.privy.io/wallets/using-wallets/ethereum/sign-7702-authorization)、[外部钱包配置](https://docs.privy.io/wallets/connectors/setup/configuring-external-connector-wallets)、[wagmi integration](https://docs.privy.io/wallets/connectors/ethereum/integrations/wagmi)、[定价](https://www.privy.io/pricing)。
- ZeroDev Kernel V3.3：[固定 tag](https://github.com/zerodevapp/kernel/tree/v3.3)、[`execute` 访问边界](https://github.com/zerodevapp/kernel/blob/v3.3/src/Kernel.sol#L330)、[batch 与失败语义](https://github.com/zerodevapp/kernel/blob/v3.3/src/utils/ExecLib.sol)、[Kernel 地址](https://github.com/zerodevapp/kernel/tree/v3.3#addresses)。
- The Graph CLI `0.98.1`：[release](https://github.com/graphprotocol/graph-tooling/releases/tag/%40graphprotocol%2Fgraph-cli%400.98.1)、[Studio](https://thegraph.com/docs/en/subgraphs/providers/subgraph-studio/introduction/)。
- Playwright `1.62.1`：[release](https://github.com/microsoft/playwright/releases/tag/v1.62.1)。
- `@axe-core/playwright 4.13.0`：[npm](https://www.npmjs.com/package/@axe-core/playwright/v/4.13.0)。
- Vitest `4.1.11`：[release](https://github.com/vitest-dev/vitest/releases/tag/v4.1.11)。
- Testing Library `16.3.3`：[release](https://github.com/testing-library/react-testing-library/releases/tag/v16.3.3)。
- vite `8.2.2`：[npm](https://www.npmjs.com/package/vite/v/8.2.2)、[repository](https://github.com/vitejs/vite)。
- `@testing-library/dom 10.4.1`：[npm](https://www.npmjs.com/package/@testing-library/dom/v/10.4.1)。
- jsdom `30.0.1`：[npm](https://www.npmjs.com/package/jsdom/v/30.0.1)。
- `@types/react 19.2.18`、`@types/react-dom 19.2.5`：[npm](https://www.npmjs.com/package/@types/react/v/19.2.18)、[npm](https://www.npmjs.com/package/@types/react-dom/v/19.2.5)。
- ESLint `10.9.1`、typescript-eslint `8.68.0`：[ESLint](https://www.npmjs.com/package/eslint/v/10.9.1)、[typescript-eslint](https://www.npmjs.com/package/typescript-eslint/v/8.68.0)、[repository](https://github.com/typescript-eslint/typescript-eslint)。
- Prettier `3.9.6`：[npm](https://www.npmjs.com/package/prettier/v/3.9.6)、[repository](https://github.com/prettier/prettier)。
- Sentry JavaScript `10.72.0`：[release](https://github.com/getsentry/sentry-javascript/releases/tag/10.72.0)。
- Foundry `1.8.1`：[release](https://github.com/foundry-rs/foundry/releases/tag/v1.8.1)，与 Memeverse/OutStake CI 固定版本一致。
- Vercel Node.js 版本与 Corepack 配置：[Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)、[build Corepack](https://vercel.com/docs/builds/configure-a-build#corepack)。
- Next.js App Router nonce CSP 与动态渲染代价：[Content Security Policy guide](https://nextjs.org/docs/app/guides/content-security-policy)；Vercel custom Install Command：[package managers](https://vercel.com/docs/package-managers)、[`vercel.json` installCommand](https://vercel.com/docs/project-configuration/vercel-json#installcommand)。
- Next.js 16 TypeScript 7 build 使用项目本地 `tsc` CLI：[Using TypeScript 7](https://nextjs.org/docs/pages/api-reference/config/typescript#using-typescript-7)、[`useTypeScriptCli`](https://nextjs.org/docs/app/api-reference/config/next-config-js/useTypeScriptCli)。
- Privy CSP：[implementation guide](https://docs.privy.io/security/implementation-guide/content-security-policy)；WalletConnect CSP：[official guide](https://github.com/walletconnect/walletconnect-docs/blob/main/docs/advanced/security/content-security-policy.md)；Sentry CSP：[official guide](https://docs.sentry.io/platforms/javascript/common/install/loader/#content-security-policy)。
- ZeroDev Kernel V3.3 外部合约证据：`docs/architecture/kernel-v3.3-evidence.md`、[v3.3 tag](https://github.com/zerodevapp/kernel/tree/v3.3)。
- Node.js 24 兼容性核验：Next.js `16.3.3` requires `>=20.9.0`；TypeScript `7.0.2` requires `>=16.20.0`；ESLint `10.9.1` supports `>=24`；vite `8.2.2` supports `>=22.12.0`；Vitest `4.1.11` supports `>=24.0.0`；Playwright `1.62.1` requires `>=20`；`@graphprotocol/graph-cli 0.98.1` requires `>=20.18.1`；`@sentry/nextjs 10.72.0` requires `>=18`。阶段 3 必须在 Node `24.20.0` 下完成 frozen install、typecheck、lint、format、test 和 production build，未执行不视为兼容性已证明。
- Alchemy、Infura、Vercel、GitHub Actions 和 Sentry 托管服务没有可固定的语义版本号：[Alchemy pricing](https://www.alchemy.com/pricing)、[Infura pricing](https://www.infura.io/pricing)、[Vercel pricing](https://vercel.com/pricing)、[GitHub Actions billing](https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions)、[Sentry pricing](https://sentry.io/pricing/)。

证据分类：上列版本、兼容性、网络支持和价格均来自项目官方 release、npm、源码仓或服务官方文档，检索日期为 2026-08-31；本文不把无法版本化核验的社区讨论声明为社区共识。框架分层、原型载体、逐链基础设施映射、Type-4 simulation 边界和交付门属于架构独立判断，置信度高；月成本仅代表当前公开价格，未来账单预测置信度中，发布前必须按实际 MAU 和用量复核。

## 19. 本地真相源

前端实现以以下本地仓库为产品和合约真相源：

- Memeverse：`/home/azkrale/Web3Project/Memeverse`，基线 commit `782a672115c90118c2fccfc2e0c125c655f789a6`（`feat(script): batch-dispatched multi-chain deployment with PoolManager self-deploy`；2026-10-10 自 `3cdb8046` 推进，见 §24）。
- OutStake：`/home/azkrale/Web3Project/OutStake`，基线 commit `0ab97820f7f563be94aae7298d7712105f25877f`（`docs(deploy): record mocksy/mocksp batches, idempotent resume semantics, VERIFY opt-in`；2026-10-10 自 `81e53ac6` 推进，见 §25）。
- 用户产品文档：`/home/azkrale/Web3Project/OutrunBook`。
- ZeroDev Kernel：外部依赖固定到 `v3.3` tag commit `cd697c7e21715d015e0643af22310a99aa17433b`，证据与逐链复核命令见 `docs/architecture/kernel-v3.3-evidence.md`。

账户 session 的规范事实来自 Memeverse `docs/spec/swap/swap-flow.md`、`docs/spec/swap/swap-integration.md`、`docs/spec/swap/permit2.md`、`docs/spec/swap/yt-flash-swap.md` 和 `src/swap/MemeverseUniswapHookUpgradeable.sol`。合约仓基线变化时，必须同步更新本文档、ABI manifest 和相关测试证据。

## 20. 协议基线修订记录（2026-09-14）

基线自 §19 初版以来经历一次协议级修订。本节按「基线变化必须同步」规则记录事实面；页面级产品决策（入口归属、呈现方式）不在此裁决，统一走阶段 2 产品意图锚定的决策清单。

- 新基线：Memeverse `3cdb8046380bf1af8ae57a04be5e92c086834567`、OutStake `73c9b1637c4953dad99fb702cf0c4fbda3150997`。
- OutStake 新增用户可触面，机制事实以下列 spec 为准：PSM（`docs/spec/psm/peg-stability-module.md`：面值 1:1 双向兑换 USDC/USDT↔UUSD、ETH↔UETH、BNB↔UBNB，`tin`/`tout` 上线默认各 0.1%，`stockCap` 存量上限，dust 域 quote 返 0 不可执行，储备枯竭关闭面值退出）；USR 储蓄金库（`docs/spec/usr/usr-vaults.md`：ERC4626，三族 suETH/suUSD/suBNB，族利率 `usrRate` 按秒计息、上线默认 0 未激活，份额价 `accrualIndex` 单调不降、封顶钳制）。
- OutStake 仓位重构为 open-term CDP：无到期概念；uAsset 面值铸造唯一入口是 `stakeForGenesis`（SP 抵押为用户自有生息 SY），router 侧 `stakeFromToken`/`stakeFromSY` 已随 v1 删除；genesis 经 router 双路径门（PSM 门 `genesisByPSM` 与 CDP 门，见 `docs/spec/router/router-and-user-flows.md`）。
- Memeverse：治理时钟由区块高改为 timestamp（`docs/spec/events.md`、`docs/spec/governance/governance-yield-details.md`）；POLend 杠杆 Genesis 条目增加 user 参数实现 payer/user 分离，并暴露 `marketUAsset` getter。
- §2 依据产品裁定（2026-09-14）完成 IA 修订：三条 OutStake 路由撤出页面清单（14 → 11），资产动线内嵌进 Memeverse 参与流程与 `/portfolio`；阶段 2 决策清单首项相应改为资产动线的嵌入位置与呈现（参与流程节点、Portfolio 信息架构、动线内 PSM/储蓄的露出方式），其后依次为：USR 是否进入 v1、Genesis 双路径（PSM 门/CDP 门/杠杆门）的用户呈现、治理周期时间口径展示、POLend payer/user 呈现。
- OutrunBook 与合约仓同步推进中（Git 仓库，`outstake/psm.md`、`outstake/usr.md` 已覆盖新表面）：产品叙事以 OutrunBook 为准，机制争议以合约 spec 为准；两者冲突时登记进阶段 2 对账区，不阻塞阶段推进。阶段 1 信息复杂度地图与阶段 2 产品意图提取在执行时核对 OutrunBook 当时基线。

## 21. 架构修订记录（2026-09-17）

用户于 2026-09-17 阶段 2 执行中授权一次架构修订窗口（会话裁决「基线+默认en」「我代改」，决策证据见 `docs/design/decision-log.md` 决议 006），本节记录事实面；已有 handoff 按 §19 规则判 superseded，阶段 1 审批证据以 v1.1.0 重新生成并重新签字。

- OutStake 基线自 `73c9b1637c4953dad99fb702cf0c4fbda3150997` 推进到 `731541109f058e6df1dc042d8fa65b8221e12bcb`（两个 commit `d56939f`/`7315411` 均已在 origin/main）。经只读核验：`73c9b163..7315411` 的 diff 仅触及 `script/harness/slither-baseline.json` 与 `test/upgradeable/SYAdaptersUpgradeable.t.sol`，不触及 `docs/spec/` 与 `src/`，合约 spec 事实无差异。
- §2 默认 locale 由 `/zh` 修订为 `/en`：落地阶段 1 已批决议 001-B（单语言页面经 `/{locale}` 切换、默认英文）。产品语义（页面单语、切换而非双语混排）以阶段 1 决议 001-A/001-B 为准。
- /portfolio 职责修订（用户于阶段 2 产品拍板会裁决，决议 007）：撤下「跨链消息和交易历史」——跨链仅保留在途/滞留提醒并深链 `/bridge`；交易历史归全局交易中心。页面信息分区定为：可行动（待领取/待执行赎回/保护窗倒计时/跨链在途提醒）、仓位与储蓄（CDP 赎回+USR 存取）、凭证（POL/PT/YT 按兑付时间线分组）。
- `/` 定位修订（同会话裁决）：首页=产品落地页（介绍/三档路径/营销指标/资产说明/CTA），非生态总览仪表页；个性化摘要职责移除（发现页与 /portfolio 承接）；发现页采用阶段 tab（创世中默认/锁定中/已解锁/全部）+阶段内排序+过滤（治理链/资产族），阶段为分组维度不跨阶段混排。
- R-07 路由更名（同会话裁决，11E 签字前）：`/memeverse/[verseId]/pol` → `/memeverse/[verseId]/yield`，页面职责名「收益（Yield）」——earn/vault 弃用（vault 与 Memeverse 收益库 YieldVault 撞词）、leverage 覆盖不全（拆合/赎回非杠杆）；§4 的 `features/pol` 为代码能力目录名，不随路由更名。阶段 1 冻结证据与历史决议行中的「/pol」为当时事实，不回改。

## 22. 架构修订记录（2026-09-26）

用户裁决（会话内拍板「A，按最佳实践，能保留的尽量保留」）：语言切换零副作用——切换 locale 不重置任何会话内状态。外部 URL 语义不变（2026-09-22 方案 C：zh 带 `/zh` 前缀、en 无前缀、`/` 依 cookie 307、旧地址 307 收敛）；本节只登记内部实现事实：

- locale 路由内部统一（`proxy.ts`）：`/zh/**` 与无前缀形态一律内部 rewrite 到 `/en/**` 路由树（`[locale]` 段内部恒为 `en`），跨语言客户端软导航命中同键段缓存、页面树不重挂载（组件 state 全保）。展示语言由 proxy 写入 `x-locale` 请求头下传。（原登记「生产环境 rewrite 目标会二次进入 proxy，首跳 `x-locale` 不得覆写、en 分支带已设跳过守卫」——2026-10-08 实证该重入不成立、守卫系死代码，已删，见 §23。）
- 页面渲染语言改从 `lib/locale.ts getDisplayLocale()`（读 `x-locale`，缺失回退 `en`）取得，不再读 `params.locale`；7 个页面与 home `generateMetadata` 同步切换。
- 语言切换导航（`components/global/locale-menu.tsx`）：软导航 `router.push` 后紧跟 `router.refresh()` 强制应用新语言载荷（路由树两侧同键时 push 拿不到新载荷——这是统一内部树的代价，refresh 保留组件 state）；popstate 对账（URL 前缀 vs 壳层 `lang` 不一致则 refresh）修正返回/前进的语言错配。首页例外走整页跳转：`/` 依 cookie 307，push+refresh 与预取缓存交错会漂到内部 canonical `/en`，首页无会话内状态可保，取确定性。对端链接在菜单挂载时预取（消除下拉初开即点的预取竞速整页刷新回退）；首页对端 href（`/`、`/zh`）不预取（307 跟随会污染预取缓存）。
- 事实依据（2026-09-26 生产预览实测）：跨 `[locale]` 段值变化的软导航必然重挂载页面子树（Next.js App Router 客户端缓存按段值索引），为本次修订前「切语言重置全站状态」的根因；模块级状态（如 `mock-wallet`）不受影响，故钱包在软导航下存活。

## 23. 架构修订记录（2026-10-08）

x-locale 头伪造面封堵与「rewrite 二次进入」实证修正（P0-1 裁决→修复→fix-review 全链，护栏 `tests/unit/proxy-locale.test.ts`）：

- **rewrite 不二次进入 proxy（实证推翻 §22 原登记）**：生产构建（Next 16.3.3，`NEXT_DIST_DIR` 隔离插桩）实测每次外部请求 proxy 恰调用一次——`/zh` 单次调用即渲染中文，rewrite 修改头经 `x-middleware-request-*` 机制直达渲染，不重跑 middleware。原 `/en` 分支「已设跳过守卫」对内部流程系死代码，已删。
- **无前缀分支无条件写 `x-locale: en`**：原条件写入把客户端预置头当内部首跳信号，伪造 `x-locale: zh` 直访 canonical URL 渲染中文（实测复现），违反「URL 前缀仍是语言唯一真源」；内部 rewrite 目标恒为 `/en/**` 不会命中该分支，无条件覆写对合法流零影响。
- **旧 `/en/**` 直达 307 收敛到无前缀**（原「暂保持可达」提前收敛）：该分支只剩外部请求，`/en/**` → 剥前缀 307（query 保真；原型期 307 与 LEGACY_PATHS 同口径防浏览器缓存，上线换 301）。伪造头直达渲染面随入口消失而封死；站内无 `/en` 链接、e2e 无 `/en` 用例，零存量依赖。

## 24. 架构修订记录（2026-10-10）

对账勘误 + 基线同步轮；同轮用户裁定 handoff 机制退役、决策登记转极简口径：

- 双编译器桥：`typescript` 经 `link:` 指向 `vendor/typescript-bridge`（`73f80ce`），§3/§4/§12/§18 按实装改写，`@typescript/old` override 不变。
- 基线推进：Memeverse `3cdb8046` → `782a6721`、OutStake `7315411` → `81e53ac6`（各 22 commits，均触及 `src/` 与 `docs/spec/`）。OutStake PSM 收敛单实例单储备（USDC↔UUSD、ETH↔UETH、BNB↔UBNB，UUSD 撤 USDT 腿——§20「USDC/USDT↔UUSD」以本条为准）、新增 owner-only `setFeeRecipient`、部署面新增 Arbitrum Sepolia（前端 §5 六链不自动跟随）；Memeverse 所有权基座 never-renounceable、Router 构造 fail-closed 守卫、POL 赎回单源化、spec 新增 POL 名义价值展示推导。swap session 机制与 §19 引用的 spec 文件不变；§2 `/faucet` 的 USDC 兑换口径与新拓扑一致；`source-map.md` 逐文件登记按其自身注记另行重跑复核。
- 勘误：撤「决议 015」错引（实为品红分层管辖）；§16 Graph 行对齐静默降级；§4 移除未建的 `check-csp-policy.mjs`。
- handoff 机制退役（用户裁定）；`check-handoff-integrity.mjs` 零接线，物理删除并入下一次 freeze 清单重生成轮（清单另有 2 条已提交漂移待收敛）。

## 25. 架构修订记录（2026-10-10，runbook 对账裁决轮）

- OutStake 基线自 `81e53ac6` 推进到 `0ab97820f7f563be94aae7298d7712105f25877f`（用户裁决：取实际 HEAD）。区间 4 commits（`b18e3cd` idempotent CREATE3 部署与 mocksy/mocksp 批次拆分、`9165167` 单点部署日志与 impl-slot 续跑守卫、`e951520` setFeeRecipient 规格化、`0ab9782` 部署批次记录）均为部署面与 docs 变更；`37063aa→0ab9782` 区间内 `src/psm` 的两处语义变更（PSM 收敛 USDC 单腿、owner-only `setFeeRecipient`）已由 §24 先行登记。`source-map.md` 基线行同步推进并按其注记方法重跑复核（变更 × 引用交集 = S1/S4/S8/S11 四文件，锚点零漂移）。
- 真源仓工作树的未提交修改不作为前端侧登记或管理对象（用户裁定：与前端无关）；阶段 4 起一切合约产物一律自冻结 commit 导出（`git archive` / 独立 worktree），不读取工作树状态。
- CI lint 门恢复阻断（用户裁决「现在就摘掉」）：存量 11 处 lint 债已随重构清零（2026-10-10 实测 `pnpm lint` 零问题），ci.yml 移除 `continue-on-error`，lint 回归红线拦截；§12 现状句同步改写。
- e2e/视觉基线视口口径对齐实况（用户裁定「一切以最新代码优先」）：§1/§11.2 的「1440px 桌面 + 390px 移动」改为已冻结的三档 1280×800 / 860×900 / 390×844（DPR 固定 1）；不新增 1440 档。
- §3/§18 补登记 `@base-ui/react 1.5.0`（shadcn base 变体组件原语运行时，本仓 12 个 `components/ui` 组件的渲染依赖）及四个随附样式工具（cva/clsx/tailwind-merge/tw-animate-css）——既成事实补录，非新增依赖。
- 冻结清单收敛（用户裁定「清单和文档如果有问题就处理」）：`docs/design/final-artifacts.sha256` 重生成（两条漂移已核为有意改动：decision-log 极简口径清理、`.prettierignore` 增 `test-results/`）；阶段 2 遗留的 `docs/page-briefs/freeze-artifacts.sha256` 及其失修生成脚本 `write-stage02-freeze-manifest.mjs` 废弃删除（防篡改统一由 CI 在用的 final-artifacts 清单承担；brief/fixture 覆盖面如需并入，阶段 8 CI 轮处理）；`check-handoff-integrity.mjs` 按 §24 既定裁定物理删除并移出清单生成范围。

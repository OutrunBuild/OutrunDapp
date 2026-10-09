# Page Briefs — 页面规格登记（现状对齐版）

> 本目录是页面/动线规格与产品事实的登记层，与仓库当前实现一一对应。真源层级：三邻居仓库（Memeverse/OutStake/OutrunBook）+ `docs/architecture.md` > 本目录；冲突时按上来源做、事后回改本目录登记。

## 登记规则

1. **路由清单唯一真相 = [`routes.json`](routes.json)**：7 条产品路由（`kind: route`）+ 1 条内部工具页（`kind: internal`，/design-system）+ 1 条全局交互面（`kind: global-surface`）+ 4 条嵌入型资产动线（`kind: embedded-flow`）。URL 方案：en 无前缀（proxy.ts 内部 rewrite 到 /en/**），zh 带 /zh 前缀；旧地址由 proxy.ts 307 收敛；语言切换走 `components/global/routes.ts` 的 `localePath`。
2. **状态词汇唯一真相 = [`state-catalog.md`](state-catalog.md)**：brief 不得发明状态同义词；每个状态标 `rendered-here` / `delegated` / `N/A(原因)`。
3. **产品事实唯一真相 = [`product-intent.md`](product-intent.md)**：产品性选择（排序键、指标集、信息优先级、动线挂载）标注 `docs/design/decision-log.md` 决策 ID；未拍板条目不得携带默认值进 brief。
4. **术语唯一真相 = [`glossary.md`](glossary.md)**：zh/en 双列；brief 文案键一律引术语表。
5. **链上事实唯一入口 = [`source-map.md`](source-map.md)**：brief 只引用表内登记的 commit+文件+章节；不写部署地址、ABI tuple、凭记忆的函数签名。
6. **fixture 唯一入口 = `fixtures/`**：确定性数据；生产代码禁止导入（`fixture-boundary-contract.md` 强制，三层检查）。
7. **完整性 = [`freeze-artifacts.sha256`](freeze-artifacts.sha256)**：`pnpm node scripts/write-stage02-freeze-manifest.mjs` 重出（确定性排序，可随时重跑对账磁盘真相）；外部锚点哈希见 `pnpm-lock.sha256`、`outrunbook-hashes.txt`。

## 清单速览（详表见 routes.json）

| 类别 | 条目 |
|---|---|
| 页面路由 ×7 | `/`、`/memeverse/explore`、`/memeverse/launch`、`/memeverse/[verseId]`（单页四标签 liquidity/pol/vault/dao）、`/portfolio`、`/referral`、`/faucet` |
| 内部工具页 ×1 | `/design-system`（不进导航，e2e 基线承载页） |
| 全局交互面 ×1 | 主网/测试网、查看链、钱包选择器、交易中心、跨链消息详情、通知中心（v1 延后）、locale 切换 |
| 嵌入型资产动线 ×4 | EF-1 创世质押铸 uAsset · EF-2 PSM 面值兑换 · EF-3 USR 储蓄 · EF-4 CDP 仓位管理与债务赎回 |

## 文档地图

1. 入口：本 README → [routes.json](routes.json)（路由真相）
2. 词汇：[state-catalog.md](state-catalog.md) → [glossary.md](glossary.md)
3. 事实：[source-map.md](source-map.md)（链上事实唯一登记）→ [product-intent.md](product-intent.md)（产品事实层）
4. 规格：[brief-template.md](brief-template.md) → 页面 brief（见下表）
5. 边界与完整性：[fixture-boundary-contract.md](fixture-boundary-contract.md) → [bootstrap-contract.md](bootstrap-contract.md) → freeze-artifacts.sha256
6. 交叉核对：[state-coverage-matrix.md](state-coverage-matrix.md)

## 页面 brief 一览

| routes.json | brief 文件 | 覆盖 |
|---|---|---|
| R-01 `/` | [home.md](home.md) | 落地页 |
| R-02 `/memeverse/explore` | [memeverse-discovery.md](memeverse-discovery.md) | 发现页 |
| R-03 `/memeverse/launch` | [memeverse-create.md](memeverse-create.md) | 创建页 |
| R-04 `/memeverse/[verseId]` | [verse-overview.md](verse-overview.md)（页）+ [verse-trade.md](verse-trade.md)（交易台+Liquidity）+ [verse-yield.md](verse-yield.md)（POL+Yield Vault）+ [verse-governance.md](verse-governance.md)（DAO） | 详情单页四标签 |
| R-05 `/portfolio` | [portfolio.md](portfolio.md) | 资产组合（含跨链 BridgeDialog） |
| R-06 `/referral` | （无独立 brief；契约=component-contract.md §32） | 推荐返佣 |
| R-07 `/faucet` | （无独立 brief；契约=component-contract.md §34） | 测试网水龙头 |
| GS-01 | [global-interactions.md](global-interactions.md) | 全局交互面 |
| EF-1~4 | [asset-flows.md](asset-flows.md) | 嵌入型资产动线 |

**禁止项**：OutStake 品牌页面、额外营销路由、隐式路由；导航与文案不得出现 OutStake 字样（uAsset/suToken 可见；SY/CDP/PSM/Kernel 机制词仅必要时且经术语表定稿）。

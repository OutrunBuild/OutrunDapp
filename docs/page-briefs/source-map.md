# Source Map — 合约/数据事实唯一引用登记

> 本文件是所有页面 brief 引用链上事实的**唯一登记处**：brief 只允许引用本表登记的 commit+路径+章节，不得凭记忆写 ABI、地址、函数签名或部署数值。

## 1. 基线 commit

| 仓库 | 基线 commit | 提交 subject | 工作树 |
|---|---|---|---|
| Memeverse（`/home/azkrale/Web3Project/Memeverse`） | `782a672` | `feat(script): batch-dispatched multi-chain deployment with PoolManager self-deploy` | 干净 |
| OutStake（`/home/azkrale/Web3Project/OutStake`） | `37063aa` | `feat(deploy): batch-dispatch deploy scripts and add Arbitrum Sepolia testnet` | 干净 |
| OutrunBook（`/home/azkrale/Web3Project/OutrunBook`） | main `d8f167f`（zh 分支 `9ee861d` 同步） | `docs(memeverse): document post-launch POL supply entries — mintPOLToken from Locked, redeemMemecoinLiquidity from Unlocked` | 干净 |

> **复核注记**：M/S 条目及 brief 内全部带行号引用已按当前基线（Memeverse `782a672`、OutStake `37063aa`、OutrunBook main `d8f167f`——内容与 `87d68d9` 相同，仅叠加重基线时的 GitBook 同步提交）完成行级复核：方法=两仓「登记时点→基线」变更文件清单 × 全部引用求交集，未变文件引用自动成立，变更文件逐锚点打印核对。结果=机制事实零漂移，7 处行号锚点漂移已就地修正（swap-flow 动态费重入、governance-yield 终局/票权基数、interoperation 重试语义、genesis 保护期原句、pol-splitter 拆合门控、yt-flash-swap 预算语义）。此后基线再推进时重跑同一方法。

## 2. Kernel / CSP / 架构证据

| 证据 | 值/路径 | 校验 |
|---|---|---|
| ZeroDev Kernel V3.3 tag commit | `cd697c7e21715d015e0643af22310a99aa17433b`（`v3.3`） | `docs/architecture/kernel-v3.3-evidence.md`（sha256 `01e0ebc67c9e9662…`） |
| CSP 机器可读基准 | `docs/security/csp-origins.json` | sha256 `95b1b1d773faa19a…` |
| 唯一架构真相 | `docs/architecture.md` | sha256 `c5d3838cfc8d0105…` |
| pnpm-lock | `pnpm-lock.yaml` | `docs/page-briefs/pnpm-lock.sha256`（`scripts/write-file-hash.mjs` 重出） |

## 3. 引用规则（brief 强制）

1. 链上机制事实（函数、费率语义、状态机、金额关系）→ 只能引用本表登记的 commit 下的文件+章节；`sourceRef` = 仓库相对路径 + 章节/commit，禁止 `/home/...` 绝对路径。
2. 部署地址/ABI tuple：brief 一律不写；实装阶段由冻结 ABI/manifest 提供（brief 中标「依赖冻结 ABI/manifest 后确认」）。
3. OutrunBook：产品叙事以此为准；与合约 spec 冲突时机制以 spec 为准、冲突登记 architecture §20/§21 流程处理，Agent 不裁决。
4. 本表任何新增/变更 → brief 相应字段必须回溯核对。

## 4. Bootstrap owner

`package.json` / `pnpm-lock.yaml` / `pnpm-workspace.yaml` / `.node-version` / `.prettierrc.json` / `.prettierignore` / `scripts/{check-runtime,bootstrap-pnpm,write-file-hash}.mjs` 的所有权规则见 [`bootstrap-contract.md`](bootstrap-contract.md)。

## 5. 事实引用矩阵（路径均为各自仓库相对路径）

### 5.1 Memeverse @ `782a672`

| # | 路径 | 覆盖的 brief 事实 |
|---|---|---|
| M1 | `docs/spec/swap/swap-flow.md` | 普通_swap 流程、account session 事实（R-04 交易台、GS-01/账户子机） |
| M2 | `docs/spec/swap/swap-integration.md` | swap 集成边界（R-04 交易台） |
| M3 | `docs/spec/swap/permit2.md` | Permit2 授权流（R-04 交易台；界面只说「授权」） |
| M4 | `docs/spec/swap/yt-flash-swap.md` | YT Flash Swap（R-04 交易台、R-04 Vault） |
| M5 | `docs/spec/swap/uniswap-v4.md` | 池/动态费率/LP 事实（R-04 Liquidity）；referral 规则：单层无绑定/自推荐合法/按链独立（:106，R-06） |
| M6 | `docs/spec/verse/accounting.md` | Verse 记账、POL/PT/YT 份额（R-04 Vault） |
| M7 | `docs/spec/verse/lifecycle-details.md` | 生命周期/关键时间（R-02、R-04） |
| M8 | `docs/spec/verse/registration-details.md` | 注册参数/symbol 校验/费用（R-03，唯一来源） |
| M9 | `docs/spec/verse/state-machines.md` | Verse 状态机（R-02、R-04） |
| M10 | `docs/spec/governance/governance-yield-details.md` | 治理时钟 timestamp/提案/奖励（R-04 DAO、R-05 收益库待执行赎回） |
| M11 | `docs/spec/interoperation/interoperation-details.md` | 跨链消息/桥（GS-5 跨链消息详情、R-05 BridgeDialog） |
| M12 | `docs/spec/interoperation/layerzero-oapp-oft.md` | LayerZero OApp/OFT（GS-5、R-05） |
| M13 | `docs/spec/polend/genesis.md` | 杠杆 Genesis/payer-user 分离（R-04 Vault/参与面板） |
| M14 | `src/swap/MemeverseUniswapHookUpgradeable.sol` | Hook 行为（R-04 Liquidity）；referral：`claimRebate`/`pendingRebateOf`/`setReferrerRebateBps`（:895-943、R-06） |
| M15 | `docs/GLOSSARY.md` | Referral rebate 定义（Rebate in-kind/逐币累积不进国库 :34；referrer=`encodePacked` 前 20 字节打包 :33；R-06） |

### 5.2 OutStake @ `37063aa`

| # | 路径 | 覆盖的 brief 事实 |
|---|---|---|
| S1 | `docs/spec/router/router-and-user-flows.md` | 用户流/Genesis 门（genesisByPSM/genesisByToken/genesisBySY/leveragedGenesisByPSM、SP.stakeForGenesis）（R-04、R-05、EF-1）；R-07 /faucet 生息资产去向口径（sUSDS/aUSDC 直接 stakeForGenesis 进创世、不经 UUSD） |
| S2 | `docs/spec/position/accounting.md` | CDP 记账/open-term（drawUAsset 已删除，partial redeem 唯一减借）（R-05、EF-1、EF-4） |
| S3 | `docs/spec/position/state-machines.md` | 仓位状态机/赎回（R-05、EF-4） |
| S4 | `docs/spec/protocol.md` | 协议总貌（R-05） |
| S5 | `docs/spec/common-foundations.md` | 共同基础（金额/份额域约定） |
| S6 | `docs/spec/yield/yield-adapters.md` | SY 适配器（EF-1、EF-4） |
| S7 | `docs/spec/yield/oracles-and-integrations.md` | 预言机（R-05） |
| S8 | `docs/spec/psm/peg-stability-module.md` | PSM 面值兑换/tin-tout/stockCap/dust（EF-2、R-05）；R-07 /faucet Get UUSD 弹窗机制口径（UUSD 唯一获取路径） |
| S9 | `docs/spec/usr/usr-vaults.md` | USR 金库/suToken/usrRate/accrualIndex（EF-3、R-05） |
| S10 | `test/support/Faucet.sol` | 测试网水龙头（R-07）：`claim`/`batchClaim` 每注册代币 24h 冷却（`ClaimTooSoon`）、日限一次性全额 mint、错误面 `UnsupportedToken`/`ClaimTooSoon`/`InvalidDailyLimit` |
| S11 | `script/deploy/OutstakeScript.s.sol` | 测试网 mock 接线（R-07）：`_deployMockERC20` 部署 Faucet+MockUSDC/MockSUSDS/MockAUSDC（均 18-dec）并 `addToken` 各登记日限 1,000,000×1e18 |

### 5.3 OutrunBook @ main `d8f167f`（zh 分支 `9ee861d` 同步；产品叙事真相源）

| 层 | 文件/目录 |
|---|---|
| 意图层 | `vision.md`、`ecosystem/audience.md`、`ecosystem/business-model.md`、`ecosystem/flywheel.md`、`ecosystem/playbooks.md`、`.agents/skills/product-vision/`、`.agents/skills/user-personas/`、`.agents/skills/value-proposition/`、`.agents/skills/intended-vs-implemented/` |
| 模块层 memeverse/ | `genesis.md`、`preorder.md`、`lifecycle.md`、`four-pools.md`、`polend.md`、`pol-splitter.md`、`yt-flash-swap.md`、`hook.md`、`dao-governance.md`、`memecoin-staking.md`、`omnichain.md`、`genesis-credit.md`、`vs-pump-fun.md` |
| 模块层 outstake/ | `uasset.md`、`sy-adapters.md`、`psm.md`、`usr.md`、`router.md`、`staking-modes.md`、`omnichain.md` |
| 参考层 | `reference/glossary.md`、`reference/faq.md`、`reference/participation-map.md` |

引用规则：产品叙事以 OutrunBook 为准、机制以合约 spec 为准；冲突登记 §6 对账区不裁决（architecture §20/§21）。

## 6. 对账区（叙事与机制张力登记，Agent 不裁决）

当前无未决项。已解决项的现行口径直接落在本表之外：叙事侧=OutrunBook 当前基线，界面侧=各 brief 与 `docs/design/decision-log.md`。

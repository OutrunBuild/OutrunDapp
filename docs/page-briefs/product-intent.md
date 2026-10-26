# Product Intent（定稿）— 7 路由 + 详情页四标签 + 4 嵌入动线 + 全局交互面

> 本文件为产品事实层（PRODUCT.md 只引用不复制）；与 glossary.md、decision-log（docs/design/decision-log.md）共同构成 brief 的强制依据。
> 依据：OutrunBook（行级引用，路径相对 OutrunBook 根）× architecture.md §2；引用缩写：OB:文件:行 = OutrunBook；SPEC-M/SPEC-S=Memeverse/OutStake 基线 spec（source map M/S 条目）；§=architecture.md；PD-xx=决议 007 决策项。

## 0. 受众基线（每条意图的目标用户都引自这里）

| 画像 | OB 引用 | 一句话 |
|---|---|---|
| P1 Memecoin 社区核心 | OB:ecosystem/audience.md:5-14 | 要公平、抗 rug、社区掌权 |
| P2 DeFi 用户/收益农夫 | audience.md:16-25 | 生息资产要统一出口与多元用途 |
| P3 稳定币/uAsset 使用者 | audience.md:27-36 | 要稳定可跨链的价值媒介 |
| P4 杠杆/进阶玩家 | audience.md:38-47 | 用资本效率博早期份额，厌恶清算 |
| P5 Memecoin 发起人 | audience.md:49-58 | 一键多链公平启动 + 持续设施 |
| 风险三档 | OB:ecosystem/playbooks.md:7-11 | 稳健（备 uAsset+普通创世）/平衡（杠杆+预购）/共建（买入+质押+DAO） |
| 专门角色 | playbooks.md:98-102；OB:memeverse/lifecycle.md:71-75 | 发起人/LP/执行者（触发费分发） |
| 串联原则 | audience.md:60-62 | 一切流经 uAsset；双模块闭环 |

## 1. 页面路由（7）+ 详情页标签域

### R-01 `/` 产品落地页
- 目标用户：**陌生人/新访客**（3 秒懂这是什么+可信度判断）；回访用户经导航直接进内页
- 用户任务：看懂产品（双模块闭环）；判断可信度（营销指标）；按三档路径找到自己的入口；CTA 进产品
- 完成定义：点击 CTA 进入内页
- 页面结构：一句话定位 → 证据带（总锁定/已部署 Verse 数/累计参与地址——Graph 聚合）→ 双引擎卡 → 机制入门段 → 生命周期教育段 → 收尾 CTA（主 CTA→发现页创世视图=有意漏斗；文档外链）
- **无个性化、无用户摘要、无待办**（职责在 /portfolio 与发现页）

### R-02 `/memeverse/explore` 发现
- 目标用户：P1/P5（浏览与发起）；三档路径起点（playbooks.md:3）
- 用户任务：按生命周期/治理链/参与规模浏览、搜索、过滤 Verse
- 完成定义：进入目标 Verse 页
- 最重要的一个决策：**选哪个 Verse 参与**
- 机制依据：各链创世/推进/四池独立（OB:memeverse/omnichain.md:9）；阶段推进需链上交易触发（OB:memeverse/lifecycle.md:51）
- 阶段 tab=分组维度（创世中默认/锁定中/已解锁；不跨阶段混排，无「全部」视图）；排序/过滤项=PD-07

### R-03 `/memeverse/launch` 创建（Consensus Launch）
- 目标用户：P5（发起人）
- 用户任务：设定规则（选链、创世时长 OB:memeverse/lifecycle.md:22）、多链启动（无门槛无特权 OB:memeverse/README.md:23）、支付费用、跟踪跨链注册
- 完成定义：创世开启并进入阶段推进
- 最重要的一个决策：**治理链选哪条**（lifecycle.md:22、:36；治理链选择 omnichain.md:13）；次级：是否开快速创世（lifecycle.md:52-54）
- 信任面：365 天硬锁定（lifecycle.md:62）；协议保留创世判定前调参权限（lifecycle.md:77）

### R-04 `/memeverse/[verseId]` Verse 详情单页（含四标签域）

**总览/参与（页面主体）**
- 目标用户：P1/P2/P4/P5 全参与；三档全覆盖
- 用户任务：看懂「当前阶段能做什么」——阶段×开放操作表（lifecycle.md:10-18：创世期参与/退款态领取/锁定期领 YT+加池+质押/解锁期赎回系列）；跟踪成功判定与关键时间
- 完成定义：完成任一阶段开放操作（参与/领取/退款）
- 最重要的一个决策：**以何种方式参与创世**（普通/杠杆/预购——参与面板两层决策，PD-01+PD-05）；成功判定双门槛独立（普通资金≥最低额度 或 杠杆利息≥最低额度，预购与债务本金不计入，lifecycle.md:35-49）
- Genesis 参与门挂载 EF-1/EF-2 → 参与面板（PD-01：直接参与/质押参与，双门可达时显选）

**交易台+Liquidity 标签（`?tab=liquidity`）**
- 目标用户：P3（结算）、P1（买入）、LP 角色（lifecycle.md:71）
- 用户任务：公开交易（Swap）；加池铸 POL 赚手续费；理解费率构成
- 完成定义：成交/流动性建立；报价纪律——参考价≠保证成交（OB:memeverse/yt-flash-swap.md:71）
- 最重要的一个决策：**是否接受当前动态费率成交**——回归均衡交易付基础费，制造波动交易承担动态费（OB:memeverse/hook.md:39-40）；开池 50%→1% 15 分钟衰减（:46-56）
- 前置：智能账户门槛（hook.md:73）；界面只说「授权」（Permit2 不上 UI，决议 007）
- LP 分成 65/35（有推荐人 65/25/10，hook.md:64-67）

**POL+Yield Vault 标签（`?tab=pol|vault`，收益域）**
- 目标用户：P4（杠杆/进阶）＋平衡档（playbooks.md:53）
- 用户任务：杠杆创世（付息放大份额 OB:memeverse/polend.md:7）；split/merge（锁定期内，OB:memeverse/pol-splitter.md:9-16）；YT Flash Swap（买入=精确到量非花光预算 yt-flash-swap.md:66）；解锁期赎回系列；POL Mint（locked 起）/Redeem（unlocked 起）
- 完成定义：**六步完整退出**（OB:memeverse/genesis.md:60-67）——领到 LP/POL/PT/YT ≠ 完成 uAsset 本金退出；24 小时保护窗内完成
- 最重要的一个决策：**付息资产选 uAsset 还是创世积分**（份额等价，利息去向不同：国库 vs 销毁，polend.md:11-16,42-44）
- 风险边界必须呈现：损失上限=利息；无清算无预言机；创世失败利息全额退（playbooks.md:63）；利率=一次性比例非年化（polend.md:24-28）
- POLend payer/user：前端 UI 不做代付入口（PD-11；合约 genesisUser 能力保留）

**DAO 标签（`?tab=dao`，治理域）**
- 目标用户：共建档
- 用户任务：浏览提案/投票/触发结算/领取周期激励；查看国库（v1 提案创建/执行走 Cactus 外链（原 Tally，已更名），决议 008；提案列表/站内投票待后续版本）
- 完成定义：投票生效 + 激励领取（逾期并入国库不补发 dao-governance.md:51）
- 最重要的一个决策：**对提案投什么票**；治理合约类提案需超级多数（:65）
- 时间口径：周期时长读链显示实际配置值+倒计时（PD-09/C4；OB 的 90 天是示例）；激励周期非投票期；启动期不能提案（:66）；gas 提示（:55）

### R-05 `/portfolio` 统一资产与活动
- 目标用户：P2/P4（多凭证持仓管理）＋全部参与者
- 用户任务：看清「持有什么、何时能兑付成什么」；执行赎回/领取/赎回申请；管理 CDP 仓位（EF-4）与 USR（EF-3）；uAsset 跨链（BridgeDialog 就地发起，v1 无独立 bridge 页）
- 完成定义：任一资产动作完成（领取/赎回/存取）
- 最重要的一个决策：**下一步处理哪项资产**（凭证兑付时间线 = 凭证分区信息模型，OB:reference/participation-map.md:30-44）
- **三分区（决议 007）**：①可行动（待领取/待执行赎回/保护窗倒计时/跨链在途滞留提醒）②仓位与储蓄（CDP 赎回+USR 存取就地展开；资产区 uAsset 行内「存入储蓄/面值兑换/跨链」快捷入口）③凭证（POL/PT/YT 按兑付时间线分组）；**无跨链历史区、无交易历史区**（交易历史归全局交易中心）

### R-06 `/referral` 推荐返佣
- 目标用户：全部用户（推荐人视角）
- 用户任务：生成邀请链接（`/ref/<短码>` 样式——链上无 code 注册表，生产映射待定）；看返佣 KPI（累计收益/待领/推荐人数/费率）；逐币种领取待领返佣；看懂分账与流水
- 完成定义：claimRebate 到账（逐币 pull，无批量）
- 最重要的一个决策：**领哪个币种的待领返佣**
- 机制依据：LP 分成 65/25/10（有推荐人，hook.md:64-67）；referrerRebateBps 默认 1000bps（SPEC-M5:106 单层无绑定/自推荐合法/按链独立）；in-kind 多币种累积不进国库（docs/GLOSSARY.md:34）；链上事件只记 referrer+币种+金额，被推荐人明细走索引器口径（Friends 表=fixture 样本）
- 行为契约：component-contract.md §32；`/ref/<code>` 落地路由与 swap 侧 ref 接线不在本期

### R-07 `/faucet` 测试网水龙头
- 目标用户：测试网参与者
- 用户任务：领三 mock 代币（逐 token 24h 冷却 claim/batchClaim——Faucet.sol `ClaimTooSoon`、日限一次性全额 mint）；Get UUSD（PSM 面值 1:1 双向、tin/tout 费率）；生息资产（sUSDS/aUSDC）直达创世（不经 UUSD——唯一铸造入口 SP.stakeForGenesis，router-and-user-flows §4）
- 完成定义：mock 代币/UUSD 到账
- 行为契约：component-contract.md §34；batchClaim 前端只传可领集合（任一冷却中整笔回滚）

## 2. 嵌入型资产动线（4，非路由）

### EF-1 创世质押铸 uAsset（CDP 门）
- 目标用户：P2（生息资产持有者）＋稳健档
- 用户任务：存生息资产按面值铸 uAsset（1 ETH 生息资产→1 UETH，OB:outstake/staking-modes.md:7-9）；抵押继续生息、敞口自留（:3）
- 完成定义：uAsset 进入创世（一步为正典，PD-03：参与面板内铸造/兑换原子直进创世=合约门机制 OB:outstake/router.md:5-12；非创世语境两步天然存在）
- 最重要的一个决策：**走 CDP 门还是 PSM 门**（按持有物，faq.md:35-36）
- 三无承诺：无利息、无清算、无到期（staking-modes.md:12-15）；赎出资产≠存入资产（sy-adapters 警告 OB:outstake/sy-adapters.md:33）

### EF-2 PSM 面值兑换
- 目标用户：P3（把 uAsset 当稳定币用）＋只有储备资产者
- 用户任务：USDC/USDT↔UUSD、ETH↔UETH、BNB↔UBNB 面值双向兑换（OB:outstake/psm.md:7-12）；换完即结清无仓位
- 完成定义：到账（报价与执行一致 psm.md:22）
- 最重要的一个决策：**兑换方向与数量**（费率各约 0.1%、可调上限 1%，:21）
- 用途：备创世资金/日常换汇/回锚套利（:26-28）；「不产生收益，是面值进出通道」flywheel.md:46
- 挂载：R-04 参与面板（直进创世）/R-05 Portfolio 行内入口/R-07 faucet Get UUSD

### EF-3 USR 储蓄
- 目标用户：P2（闲置 uAsset 生息）
- 用户任务：存 uAsset 得 suToken 份额，份额价随族利率增长（OB:outstake/usr.md:3-11）；随存随取
- 完成定义：份额到账/取回到账
- 最重要的一个决策：**存哪个金库**（三族）
- 状态面：usrRate=0 未激活时存取照常不增值（:17）；预算不足利息暂停、已累积不变（:20）；禁止直接转账进金库地址（:20）
- 完整形态进 v1（PD-04：三金库存取+份额/利率+未激活态照常显示）

### EF-4 CDP 仓位管理与债务赎回
- 目标用户：经 CDP 门参与的用户（仓位售后）
- 用户任务：按比例双腿赎回销债取回抵押生息资产（全赎=归还等值 uAsset；部分赎回按比例销债、剩余仓位存续——SPEC-S3 state-machines.md:32-40 `redeem(positionId, syRedeemed, receiver, …)`；OB 叙事 staking-modes.md:24-29）；**无增借入口（drawUAsset 已删除，SPEC-S2 accounting.md:50）**
- 完成定义：生息资产到账、仓位结清
- 最重要的一个决策：**赎出资产选什么**（适配器矩阵，staking-modes.md:27）
- 联动约束：经 CDP 门创世的仓位，赎回需另行持有等值 uAsset（OB:outstake/router.md:29）；跨链出去的 uAsset 需先桥回（:17）

## 3. 全局交互面（GS-01，非路由）

- 交易中心：承载 A7–A12 交易状态 + 报价/滑点纪律（router.md:20-23 预览非保证、设最低到账保护线）
- 跨链消息详情：三阶段状态机（发送/到账/落位 omnichain.md:31-43）+ 滞留手动恢复（:34）+ 份额 vs 裸币核验（:51）→ 归属 PD-10
- 通知中心：v1 延后——待办提醒由 Portfolio ①可行动区 + 操作完成 toast 承接
- 主网/测试网、查看链、钱包选择器、locale 切换：意图以 architecture §2/§5/§6 为准 + 治理链概念（omnichain.md:13）为查看链语境
- 语言政策基线：「专有词保留英文，解释用中文」（OB:reference/glossary.md:3）+ 分层语气（PD-06）

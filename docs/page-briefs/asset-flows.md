# Brief：嵌入型资产动线（asset-flows，非路由）

- routes.json ID：EF-1~EF-4；决议 007（PD-01/03/04/05/09/11）
- 依据：SPEC-S1 router-and-user-flows.md（§6 双门表+§6.1+§7）、SPEC-S2 position/accounting.md（L50 drawUAsset 删除/redeem 唯一减借）、SPEC-S3 position/state-machines.md（redeem 生命周期）、SPEC-S8 peg-stability-module.md、SPEC-S9 usr-vaults.md；OB:outstake/{router,staking-modes,psm,usr,sy-adapters}.md；product-intent.md EF 节（定稿）
- 术语：glossary.md A 节；机制词（PSM/CDP/SP/SY）不上 UI

## 0. 共享组件：参与面板（EF-1/EF-2 的载体，挂 R-04 详情页）

**两层决策结构**（决议 007）：

1. **模式层**：默认「普通创世」面板；显眼按钮切换「杠杆创世」面板（视觉形态变化走 echo-confirm 风格，非花哨动效；杠杆面板=签名交互候选）
2. **普通面板**：路径选择 → 支付资产选项随路径解析（读链，**不得写死**；路径决定支付代币）：
   - 「**直接参与**」（=uAsset 直付与 PSM 门 `genesisByPSM` 合并为一路径）：支付资产下拉=本 Verse 募集 uAsset（直付，不经任何供给路径——genesis.md:9，默认首选）+ PSM 配对储备资产（面值即时兑换，一 uAsset 多配对时显式选择）；说明文案随所选资产切换（直付「不经兑换，无仓位」/兑换「面值兑换即时结清，无仓位，直进创世」）
   - 「**质押参与**」（=CDP 门 `genesisByToken` token 正门/`genesisBySY` SY 高级入口；同资产可多 SP；原「质押参与 · {生息来源品牌}」简写）：支付资产=所选 SP 可存资产（SY 适配器矩阵读链）：副文案「继续生息，留仓位随时可赎」——SP 列表来自 registry（**不得写死**，运行时读链），**且按本 Verse uAsset 族过滤**（来源 `anchor`=uAsset 符号去 U 前缀；UETH verse 不出现 sUSDe 类 USD 来源）
   - 单选项自动选中呈固定值；多选项显式选择（收益权衡在副文案）
3. **杠杆面板**：输入利息金额+支付资产（uAsset/创世积分直付；储备资产自动经面值兑换转 uAsset 利息——`leveragedGenesisByPSM`，全额作为利息，无 CDP 仓位）→ 实时预览：债务额度=利息÷利率（一次性比例**非年化**）、债务上限余量（**余量不足→输入实时拦截+显示剩余可建额度**——对照 PSM stockCap 模式） → 披露「损失上限=利息、无清算、创世失败利息全额退」
4. **预购**：与普通/杠杆创世**同级**的独立参与路径（模式层第三项，仅预购不创世）；普通/杠杆面板内另提供「一键预购」开关——开启后出现预购金额输入，**实时显示可预购上限=创世资金按面值折算 uAsset×70%×容量比例（glossary 公式；容量比例为 per-Verse 读链参数，fixture 快照缺失时 UI 不渲染），超限输入实时拦截**（对照 stockCap 模式），最终按钮一笔同时提交创世+预购；全局预购容量口径不变（=(普通资金+杠杆债务本金)×70%×容量比例，读链）
5. **代付**：无入口（决议 007 PD-11；`genesisUser`=调用者（产品约束 PD-11；合约层支持代付——genesis.md:95））
6. **审阅卡**（提交前）：路径、金额、费率、到账/份额预估、滑点保护（minUAssetMinted/minSyOut/minTokenOut 下限——SPEC-S1 §6.1 签名）、授权链清单

一步正典（PD-03）：面板内铸造/兑换原子直进创世（合约门单笔）；非创世语境（独立获取 uAsset）用 §2/§3 的独立入口，结果进余额。

## 1. EF-1 创世质押铸 uAsset（CDP 门）

- **挂载节点**：R-04 详情页参与面板「质押参与」路径；R-05 Portfolio 仓位区（既有仓位管理→EF-4）
- **触发条件**：创世期（阶段开放表 lifecycle.md:10-18）；所选 SP 注册且未暂停；输入 token 为该 SP 可存入资产（SY 适配器矩阵读链，**不得写死**）
- **预览面**：存入 token →（SY.deposit）→ 生息资产 → 面值铸 uAsset（价值平价，v1 无 LTV 缩放——SPEC-S1 §6 表）；预估：铸出 uAsset 数（minUAssetMinted 下限）+「抵押 {品牌} 继续生息、留仓位」说明
- **授权/状态面**：token 授权（ERC20 approve router，界面只说「授权」）→ Kernel batch：`genesisByToken(SP, tokenIn, …)`（A5→A12 全程交易中心）；披露（**当前零利率**（v1 默认、治理参数可调——position/accounting.md:87,147）/无清算/无到期——glossary 仓位词条）
- **赎出资产≠存入资产警示**：适配器决定赎出物（如只出生息代币），确认卡明示（OB:outstake/sy-adapters.md:33）
- **出口**：完成→参与确认态（份额到账视图）；仓位归 Portfolio 仓位区（EF-4）
- fixture 场景：`normal`/`paused`（SP 暂停或 uAsset 传导）/`undeployed`（SP 未注册）/`zero-balance`/`user-rejected`/`tx-failure`；页面特有数据变体见 fixture 记录：`fixtures/data/positions.json#pos-001~003`+`fixtures/data/psm.json#psm-001~004`+`fixtures/data/usr-vaults.json#usr-001~003`；min-mint-slippage=审阅卡下限行为（断言）

## 2. EF-2 PSM 面值兑换

- **挂载节点**：①R-04 详情页参与面板「直接参与」路径（面值直兑并入，直进创世）②R-05 Portfolio 资产区 uAsset 行「面值兑换」入口（独立语境，进余额；首页=纯落地页无功能入口——PD-07）③R-07 /faucet「Get UUSD」弹窗
- **触发条件**：`(uAsset, reserveToken)` 配对注册（一资产一 PSM（配对寻址——SPEC-S1 §1.2.1））；`stockCap` 余量>0（mint 侧：`stockCap − netUAssetMinted`，SPEC-S8 cap 节）
- **预览面**：`quoteMint/quoteRedeem`（SPEC-S8）：mint `到账=面值×(1−tin)`；redeem `付出=面值×(1−tout)`；费率默认各 0.1%（可调上限 1%，界面显示为准）；**dust 域 quote 返 0 → 禁发**（不可执行态，SPEC-S8 零输出守卫 `ZeroInput`）；stockCap 余量不足→显示剩余额度+禁超
- **授权/状态面**：reserve 授权（**原生 ETH/BNB 免授权**——psm.md:20）→PSM `mint/redeem`（或经参与面板单笔合成）；状态面=交易中心；「换完即结清：无仓位、无债务」
- **边界态**：储备枯竭关闭面值退出（redeem 侧不可用→说明+等待）；uAsset 暂停→reserveMint `EnforcedPause`（B1）
- **出口**：参与语境→参与确认；独立语境→余额到账（Portfolio 原位刷新）
- fixture：`normal`/`stockcap-full`/`dust-quote-zero`/`reserve-depleted`/`paused`

## 3. EF-3 USR 储蓄

- **挂载节点**：R-05 Portfolio 三分区之「仓位与储蓄」区 + 资产区 uAsset 行「存入储蓄」快捷入口（决议 007 PD-02）
- **触发条件**：v1 完整形态（PD-04）；三金库（suETH/suUSD/suBNB）；存取无门槛（未激活也可存取）
- **预览面**：`previewDeposit/Redeem`（ERC4626，SPEC-S9）：储蓄份额/资产预估；**利率状态必显**：币种利率（usrRate）激活与否（0=未激活：存取照常、份额不增值）；份额价=accrualIndex（1e18 起，按秒增长，惰性结算——入口时推进）；显示「当前份额价」+「预估到账」
- **授权/状态面**：uAsset 授权→`deposit/withdraw/redeem`（标准 ERC4626 无许可入口）；无滑点参数→**前端以执行时份额/资产下限复核**（SPEC-S9 集成指引）；状态面=交易中心
- **警示**：直接向储蓄金库地址转账不产生储蓄份额且无法找回（OB:outstake/usr.md:20）→ 表单只用协议入口
- **预算耗尽态**：利息暂停增长、已累积不变、存取不受影响（usr.md:20——利率状态并列展示）；**封顶钳制域**（SPEC-S9 §封顶规则）：份额价增长不越过「实际余额/流通份额」；UI 不展示内部钳制细节，只以 preview 实值为准
- **出口**：完成→Portfolio 储蓄区原位刷新（不跳页）
- fixture：`normal`/`rate-zero`（未激活）/`capped`（钳制域）/`share-price-growth`（时间推进）

## 4. EF-4 CDP 仓位管理与债务赎回

- **挂载节点**：R-05 Portfolio「仓位与储蓄」区（就地展开 sheet/抽屉）
- **触发条件**：存在仓位（EF-1 或（历史）直接 `stakeForGenesis` 建立）；任意时刻可赎（无到期）
- **仓位卡**（列表行→展开）：抵押生息资产（品牌+数量+当前价值）、未偿 uAsset 债务、生息状态；大白话披露（无到期/当前零利率·治理可调/无清算/随时可赎/需主动——PD-09；五件套=glossary 仓位词条）
- **赎回面**：`redeem(positionId, syRedeemed, receiver, …)`（SPEC-S3 §3）：输入=要赎回的抵押数量（或比例）；**按比例双腿销债**（全赎=归还等值 uAsset+取回全部含息抵押；部分赎回=按比例、剩余仓位存续）；预览=minTokenOut 下限（tokenOut==SY 时直接校验，SPEC-S3 §3.4）
- **联动约束**（确认卡明示）：经 CDP 门创世的仓位，赎回需**另行持有等值 uAsset**（创世投入部分仍在四池）；跨链出去的 uAsset 需先桥回原链（OB:outstake/router.md:29、staking-modes.md:27）→ 桥回=Portfolio 资产区跨链（BridgeDialog）
- **赎出资产选择**：适配器矩阵可赎出物（读链）；「能存进去什么≠能原样取回什么」警示
- **授权/状态面**：uAsset 授权→redeem；状态面=交易中心；完成=生息资产到账+仓位结清（或部分存续）
- **出口**：Portfolio 仓位区原位刷新
- fixture：`normal`/`partial-redeem`/`insufficient-uasset`（联动约束触发）/`cross-chain-collateral`（需桥回）

## 全动线状态标注（共用）

A4（首次写前启用引导）rendered-here（挂载点上下文）；A5–A12 delegated-to-global-surface（交易中心）；A13/A14/A15 rendered-here（预览加载/零仓位/报价失败）；B1 Paused rendered-here（SP 暂停位或 **uAsset 级暂停传导**（PSM/储蓄金库自身无 pause 位——peg-stability-module.md:11/usr-vaults.md:59）→对应操作禁用+归因说明）；B2 Undeployed rendered-here（SP/金库未注册→入口禁用）；B3 applied-to-page（预览走 RPC 不受索引影响；历史聚合降级）；B4 rendered-here（回表单草稿保留）。

> 本文件全部写操作（铸造/兑换/存取/赎回）：**原型只演示 ViewModel 状态，业务集成待实装**。

## 渲染边界

预览/报价/余额=Client 岛（RPC 实时）；SP/PSM/金库注册表与适配器矩阵=服务端 RSC 取数+按需客户端刷新（§9：浏览器只查用户实时数据）；全部写操作经 Kernel batch（§6/§7），禁止脱离 batch 单独 simulate 交易类合约（§6.3）。

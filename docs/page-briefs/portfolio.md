# Brief：`/portfolio`（统一资产与活动）

- routes.json ID：R-05；决议 007（PD-02/08 三分区；PD-10 跨链在途提醒；跨链功能并入本页——v1 无独立 bridge 页，资产区行内 BridgeDialog 发起）
- 依据：architecture §2（修订行）/§5/§9；product-intent.md R-05；OB:reference/participation-map.md:30-44（凭证兑付时间线）；asset-flows.md EF-3/EF-4（就地展开）
- 信息优先级=三分区（决议 007，无跨链历史/无交易历史）

## 1. 用户任务

- 目标用户：P2/P4+全部参与者
- 用户任务：①看清持有什么、何时能兑付成什么 ②执行待办（领取/赎回/执行到账）③管理仓位与储蓄（EF-4/EF-3 就地）④看六链余额
- 完成定义：任一资产动作完成（领取/赎回/存取）
- 最重要的一个决策：**下一步处理哪项资产**（可行动区按截止时间排序，最紧急置顶）

## 2. 核心组件（三分区）

| 分区 | 组件 |
|---|---|
| ①可行动（置顶） | 待办卡列表：待领取（初始 YT/辅助池分成/LP 费/预购可领量/**创世退款**〔每地址一次〕/**周期激励临期**/**创世积分空投领取**）、待执行收益库赎回（等待期已过，memecoin-staking.md:30）、24 小时保护期倒计时（解锁后，genesis.md:43）、跨链在途/滞留（状态+处理入口）；**按截止时间排序**，逾期后果标注（激励逾期并入国库等）；**出口规则**：跨 Verse 领取类（YT/分成/LP 费/预购/创世退款/周期激励）→深链对应 Verse 领取中心；收益库待执行赎回与仓位赎回→就地执行；创世积分领取→就地（限主链，非主链禁用+切链提示）；跨链卡→就地 BridgeDialog/交易中心跨链详情 |
| ②仓位与储蓄 | CDP 仓位卡（EF-4 就地展开赎回）；USR 储蓄卡（EF-3 就地展开存取+利率状态）；资产区 uAsset 行内「存入储蓄」「面值兑换」「跨链」（BridgeDialog）快捷入口；**独立持有的生息资产（SY，如 wstETH/sUSDe）单列资产行**（未入仓位的抵押物——architecture §2「uAsset/SY 资产」） |
| ③凭证 | POL/PT/YT 按兑付时间线分组（participation-map.md:30-44：何时获得/何时能兑付/兑付成什么/风险性质）；每凭证操作入口→对应 Verse 详情页标签（vault=拆分/赎回、liquidity=移除流动性） |

另有：六链余额总览条（uAsset 族+原生资产，链分组）；GenesisCredit 余额（uAsset 族计，跨 Verse 通用——genesis-credit.md:17；付息入口→选择目标 Verse：参与中 Verse 直达其参与面板，无则跳发现页）。

桌面：可行动横条（有则显）→ 三分区两列（仓位储蓄左/凭证右）+余额条顶。移动：可行动→余额→仓位储蓄→凭证。密度=高（全站天花板之一，分区消化）。

## 3. 数据依赖

余额/授权/回执=**RPC 实时（永不降级为陈旧索引——§9/§16）**；聚合/凭证历史=Graph（B3 静默降级——数据稍旧无可见状态；可行动区不受影响——待办判定走 RPC）；倒计时=客户端+RPC 校准。

渲染边界：三分区主体 RSC（Graph）；每卡片操作=Client 岛；EF-3/EF-4 就地展开复用动线组件。

## 4. URL 状态

`?section=action|positions|participations`（分区锚点）；无 hash 深链到卡片（卡片量动态）。

## 5. 文案键

action.deadline-soft（今日内）/ action.deadline-urgent（即将截止）/ participations.unlockable-now（可兑付）/ positions.no-maturity（无到期 · 无利息 · 无清算 · 随时可赎 · 需主动操作——glossary 五件套；短标签+展开全口径）/ redeem.vault（收益库赎回·待执行）/ redeem.position（仓位赎回）/ savings.rate-status（币种利率：激活/未激活）。

## 6. 全状态标注

A1 rendered-here（引导连接后显示个性化分区）；A3 rendered-here（链切换语境，本页跨链只读+写操作按链禁用）；A4–A12：A4 rendered-here（EF-3/4 首次写）、A5–A12 delegated（交易中心）；A13 rendered-here（各分区骨架）；A14 rendered-here（零持仓→「开始参与」→发现页；各区独立空态）；A15 rendered-here；B1 rendered-here（仓位/金库暂停→对应操作禁用）；B2 rendered-here（某链未部署→该链余额区标注）；B3 rendered-here（聚合降级横幅+余额照常）；B4 rendered-here。

## 7. 可点击主流程（写操作——原型只演示 ViewModel 状态，业务集成待实装）

待办卡→对应动作（领取/执行/处理跨链）；EF-4 赎回 sheet 就地展开→审阅→执行→仓位刷新；EF-3 存取同；凭证卡→跳转对应页操作。

## 8. 错误恢复

某链 RPC 失败：该链区标注错误+重试，其余链不受影响（分区隔离）；Graph 降级：余额/待办照常（RPC），历史类隐藏+说明。

## 9. 视觉证据

DESIGN.md 四轴；待办卡=最高视觉权重（截止时间色阶：normal→warning→danger）；凭证时间线=线性分组；PositionTable/EmptyState 契约。

## 10. fixture 场景

`normal`/`zero-balance`/`zero-position`/`index-lag`（聚合降级+RPC 照常）/`rpc-fail`（单链错误隔离）/`paused`/`user-rejected`；页面特有数据变体见 fixture 记录：`fixtures/data/positions.json`（仓位赎回样本）+`fixtures/data/usr-vaults.json`（利率态）+`fixtures/data/bridge-messages.json#bm-004`（滞留待办）；保护期/激励临期倒计时=verse-003/gov-001 时间字段驱动。

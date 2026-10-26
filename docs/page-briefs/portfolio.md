# Brief：`/portfolio`（统一资产与活动）

- routes.json ID：R-05；决议 007（PD-02/08 分区结构、PD-10 跨链在途提醒；跨链功能并入本页——v1 无独立 bridge 页，资产区行内 BridgeDialog 发起）
- 依据：architecture §2（修订行）/§5/§9；product-intent.md R-05；OB:reference/participation-map.md:30-44（凭证兑付时间线）；asset-flows.md EF-3/EF-4（就地展开）
- 信息优先级=四分区（决议 007 分区结构的现行版）：①待办 ②资产与跨链 ③仓位/储蓄/收益金库 ④参与凭证；页头签名=KPI 状态带+净值 hero

## 1. 用户任务

- 目标用户：P2/P4+全部参与者
- 用户任务：①看清持有什么、何时能兑付成什么 ②执行待办（领取/赎回/执行到账）③管理仓位与储蓄（EF-4/EF-3 就地）④看多链余额（链集=部署链，按 deployments 动态）
- 完成定义：任一资产动作完成（领取/赎回/存取）
- 最重要的一个决策：**下一步处理哪项资产**（可行动区按截止时间排序，最紧急置顶）

## 2. 核心组件（四分区 + 页头签名）

| 分区 | 组件 |
|---|---|
| 页头签名 | KPI 状态带（`.pf-kpi`：待办/可领双芯片，摘要即导航、锚点滚动）；净值 hero（`.pf-hero`：Liquid Assets 口径=钱包+储蓄+金库待领，mono 主读数+三段分配条+图例） |
| ①待办（置顶） | 只收「逾期有后果」项：待领取（YT/分成/LP 费/预购/创世退款〔每地址一次〕/周期激励临期）、24 小时保护期倒计时卡（解锁后，genesis.md:43）、收益库待取合计 signpost；按截止时间排序、卡=页内锚点/限时警报、领取=独立面板；**出口规则**：跨 Verse 领取类→深链对应 Verse 领取中心，收益库待执行赎回与仓位赎回→就地执行，创世积分领取→就地（限主链，非主链禁用+切链提示）；跨链在途/滞留段不占版面（sent 无需行动） |
| ②资产与跨链 | uAsset 清单+Credit 清单（UETH/UUSD/UBNB，链徽+法币折算）+ SY 独立持产行（未入仓位的抵押物）+ 不可跨链资产页脚行；行内 Convert/Bridge 弹窗入口，移动端=整行 hit 层开底部操作面板 |
| ③仓位/储蓄/收益金库 | CDP 仓位表（Redeem 就地，EF-4——「无到期·无利息·无清算·随时可赎」glossary 口径）；USR 储蓄卡（EF-3 存取+APY/份额）；收益金库表（Stake 深链 `?tab=vault` 常驻、Withdraw 仅成熟赎回时并存） |
| ④参与凭证 | 按阶段分组（genesis/locked/unlocked）：内嵌面板+阶段顶线+台账行；创世行=参与额+截止注、锁定行=可领 YT+预计解锁日（创世截止+365d 固定锁期，MemeverseRegistrationLib.sol:14）；行尾深链 verse |

另有 GenesisCredit 余额行（uAsset 族计，跨 Verse 通用——genesis-credit.md:17；付息入口→选择目标 Verse：参与中 Verse 直达其参与面板，无则跳发现页）。

桌面：页头签名→四分区两列（仓位储蓄金库左/凭证右）。移动（≤54rem）：分区页签 deck（`.pf-deck`/`.pf-zone-tabs`，页签条吸顶、KPI 带让位角标）+台账行降档。密度=高（全站天花板之一，分区消化）。

## 3. 数据依赖

余额/授权/回执=**RPC 实时（永不降级为陈旧索引——§9/§16）**；聚合/凭证历史=Graph（B3 静默降级——数据稍旧无可见状态；可行动区不受影响——待办判定走 RPC）；倒计时=锚定快照剩余时间的展示型走秒（纯显示 tick，不触发重读）。

渲染边界：三分区主体 RSC（Graph）；每卡片操作=Client 岛；EF-3/EF-4 就地展开复用动线组件。

## 4. URL 状态

无分区 URL 参数；深链走 `#pf-*` 页内锚点（KPI 芯片/待办卡目标）与移动端分区页签；`?claimable=1` 默认凭证页签；金库深链=`?tab=vault&action=withdraw`（落 verse 详情页）。

## 5. 文案键

`portfolio.action.deadlineWithin`（Ends in {t}，倒计时徽章）/ `vaultReadyTitle` / `refundTitle`（待办与领取面板铭牌）/ `positions.cdpRedeem`（仓位行赎回）/ `savings.apy`（储蓄利率）——键集以 copy.ts `portfolio.*` 现状为准。

## 6. 全状态标注

A1 rendered-here（引导连接后显示个性化分区）；A3 rendered-here（链切换语境，本页跨链只读+写操作按链禁用）；A4–A12：A4 rendered-here（EF-3/4 首次写）、A5–A12 delegated（交易中心）；A13 rendered-here（各分区骨架）；A14 rendered-here（零持仓→「开始参与」→发现页；各区独立空态）；A15 rendered-here；B1 rendered-here（仓位/金库暂停→对应操作禁用）；B2 rendered-here（某链未部署→该链余额区标注）；B3 rendered-here（聚合降级横幅+余额照常）；B4 rendered-here。

## 7. 可点击主流程（写操作——已接 useTxCenter 真实写路径）

待办卡→对应动作（领取/执行）；EF-4 仓位赎回=保护期 Exit 弹窗（`protection-exit-dialog.tsx` 就地多步向导）→确认→执行→仓位刷新；EF-3 存取与 Convert/Bridge 弹窗同走动作弹窗确认（ActionDialogShell）→钱包；凭证卡→跳转对应页操作。

## 8. 错误恢复

某链 RPC 失败：该链区标注错误+重试，其余链不受影响（分区隔离）；Graph 降级：余额/待办照常（RPC），历史类隐藏+说明。

## 9. 视觉证据

DESIGN.md 四轴；待办卡=最高视觉权重（截止时间色阶：normal→warning→danger）；凭证时间线=线性分组；PositionTable/EmptyState 契约。

## 10. fixture 场景

`normal`/`zero-balance`/`zero-position`/`index-lag`（聚合降级+RPC 照常）/`rpc-fail`（单链错误隔离）/`paused`/`user-rejected`；页面特有数据变体见 fixture 记录：`fixtures/data/positions.json`（仓位赎回样本）+`fixtures/data/usr-vaults.json`（利率态）+`fixtures/data/bridge-messages.json#bm-004`（滞留待办）；保护期/激励临期倒计时=verse-003/gov-001 时间字段驱动。

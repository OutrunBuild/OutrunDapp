# Brief：`/memeverse/explore`（Memeverse 发现）

- routes.json ID：R-02；决议 007（PD-07：阶段 tab）
- 依据：architecture §2；SPEC-M9 verse/state-machines.md、SPEC-M7 lifecycle-details.md；OB:memeverse/{lifecycle,vs-pump-fun}.md；product-intent.md R-02
- 产品性选择：PD-07（阶段=分组维度；默认创世中 tab；排序/过滤项）
- 实现：`components/discovery/discovery-page.tsx` 等 `components/discovery/*`

## 1. 用户任务

- 目标用户：P1/P5（浏览与发起）；三档路径的选品起点
- 用户任务：按阶段浏览 Verse；过滤/搜索；比较（进度/规模/剩余时间）；进入目标 Verse
- 完成定义：点击进入 `/memeverse/[verseId]`
- 最重要的一个决策：**选哪个 Verse 参与**（比较创世进度与规模）

## 2. 核心组件

| 组件 | 职责 |
|---|---|
| 阶段 tab | 创世中（默认）/锁定中/已解锁——阶段=分组维度，不跨阶段混排；无「全部」tab、无「退款」tab（退款态 Verse 的动线由 Portfolio 页承接，发现页内经搜索可达） |
| 排序切换 | 按阶段 tab 区分排序项：创世中=创建时间/创世截止/累计募集/参与人数/进度；锁定中=创建时间/解锁时间/交易量(24h)/市值/质押年化/国库资金；已解锁=同锁定中减解锁时间；跨阶段搜索视图仍按当前 tab 的排序项执行，可空字段（无 livePhase 快照）恒沉底 |
| 黄昏区 | 已截止未推进的 Verse 留在创世中 tab：剩余时间列显示「待推进」并排末位（口径见 verse-overview 黄昏区段） |
| 过滤器 | 查看链（单链单选，无「全部链」：各链创世独立结算，跨链合计进度无合约定义；默认第一条有 Verse 的链，URL `?chain=` 常写）/创世模式（全部/Normal Mode/Fast Genesis——按链上 fastGenesis 创建参数过滤，URL `?mode=normal|fast`）。创世模式筛选仅创世中 tab 显示（Locked/Unlocked 无模式筛选）；其余阶段 `mode` 参数忽略不生效、切换 tab 时从 URL 收敛 |
| 搜索框 | 名称/symbol/Memecoin CA 匹配：trim+小写+子串包含（地址搜索为真实能力）；CA=markets 主池 tokenStats 样本，已部署 verse（locked/unlocked）全携带、创世中/退款为 null 不命中——创世成功后才部署 |
| Verse 列表 | 行/卡（按阶段 tab 明示字段集，不同阶段展示不同信息）：通用列=名称、symbol、阶段徽章、治理链标识、缩略图（有则显示，无则字标 symbol 兜底）；**卡头市值**=全部阶段卡头（名称与徽章之间）单行显示，美元口径（`$` 前缀，B/M/K 缩写固定两位小数、随 locale 不换算亿/万；样本=fixture `projectedMarketCap`，生产按链上价×供应量计算 USD）；**创世中（默认）**=所选链单链口径进度（普通资金+杠杆利息距该链最低成功额度 %，lifecycle.md:35-49；每条链的 genesis 各自独立结算，禁用跨链合计进度）+距截止（黄昏区显示「待推进」）+Fast Genesis 徽章（fastGenesis=true，青色功能信号）；**锁定中与已解锁**（两阶段卡内容一致）=Staking APY+Volume (24h)+参与人数（信号区三行读数，APY 置顶；参与人数=fixture `participants` 快照，与排序项同口径）+国库资金（$，美元口径）+解锁时间（绝对，`endTime+FIXED_LOCKUP_DURATION(365d)` 推导——MemeverseRegistrationLib.sol:14）；样本=fixture `livePhase` 快照（volume24h uAsset 计/stakingApy ratio/treasuryFundUsd），机制口径 OB:memeverse/memecoin-staking.md+dao-governance.md，生产读链上值；卡片不展示描述行。无列表「展示模式切换」（Normal/Flash 切换不采纳）；Fast Genesis 徽章+筛选按链上创建参数，属采纳范围（glossary B） |

桌面：tab+搜索一排，过滤器左列，列表主区（表格型——four.meme/pons 列表为密度参照系，非视觉参照）。移动：tab 横滑，过滤器抽屉，列表卡片纵排。密度=中。

## 3. 数据依赖

列表/计数/进度=Graph（RSC，短缓存+去重；B3 静默降级——数据稍旧无可见状态）；实时倒计时=客户端时钟对齐链上截止时间（RPC 校准一次）；交易热度（已解锁 tab）=Graph。

## 4. URL 状态

`?stage=genesis|locked|unlocked&sort=…&chain=…&asset=…&mode=normal|fast&q=…`——全部进查询参数；分享还原视图；tab 切换更新 URL（后退可用）。无 `all`/`refund` 值（跨阶段仅经搜索，退款态 Verse 动线由 Portfolio 承接）。

## 5. 文案键

stage.genesis/locked/unlocked（创世中/锁定中/已解锁）；progress.label（距最低成功额度）；sort.progress/time/size/heat/latest；discovery.mode/allModes/normalMode/fastGenesis（创世模式筛选器）；fastGenesis（Fast Genesis 徽章，glossary B）。术语引 glossary B 节。

## 6. 全状态标注

A1 rendered-here（未连接完全可读）；A2 delegated（钱包选择器）；A3 N/A（本页无写操作——错链语境由目标页承载）；A4–A12 N/A（本页无写操作）→ 链接交易中心/钱包面；A13 rendered-here（列表骨架）；A14 rendered-here（空态：「还没有创世中的 Verse」+去创建 CTA）；A15 rendered-here（Graph 失败重试）；B1 N/A（页面级）；B2 rendered-here（某链未部署→过滤项禁用）；B3 rendered-here（静默降级——数据路径承载，无横幅）；B4 N/A。

## 7. 可点击主流程

纯导航页：tab/排序/过滤/搜索 → 列表更新（URL 同步）→ 点行 → Verse 页。无写操作。

## 8. 错误恢复

Graph 失败：整列骨架+重试（不清空 URL 参数）；单行数据缺字段：该行降级显示，不阻塞列表。

## 9. 视觉证据

DESIGN.md 四轴；阶段徽章=VerseStage 契约；进度条零 glow、tabular-nums；列表密度参照 pons/four.meme（消费级两档），视觉语言用自身系统（决议 005：不抄片段版面）。

## 10. fixture 场景

`normal`/`zero-balance`（创世中空态）/`index-lag`/`undeployed`（过滤项禁用）/`rpc-fail`；列表数据=fixture 记录 `fixtures/data/verses.json#verse-001~004`（四阶段各态覆盖，退款态=verse-004，经搜索可达、动线由 Portfolio 承接）；Fast Genesis 筛选=verse-020（已达标待推进）/verse-022（未达标）。

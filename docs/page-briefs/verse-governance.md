# Brief：Verse 详情页 · DAO 标签（DAO 治理）

- routes.json ID：R-04 子规范（`/memeverse/[verseId]` 单页标签 `?tab=dao`；父规范=[verse-overview.md](verse-overview.md)）；决议 007（PD-09/C4：周期读链）；决议 008（创建/执行提案→Cactus 外部工具（原 Tally，已更名），本标签保留浏览/投票/结算/激励/国库+链上状态回显）
- 依据：architecture §2；SPEC-M10 governance-yield-details.md（周期语义/treasury ledger/permissionless finalize）；OB:memeverse/dao-governance.md:31-109
- 落位：v1 不含提案列表与站内投票，DAO 治理用 Cactus（计数 + Cactus 入口卡）；周期激励/国库/领取窗口口径见下；提案列表/投票保留在本 brief 待后续版本；实现 `components/verse/verse-tab-panels.tsx`（DaoPanel——现役=周期计数卡+激励+国库+外链卡，无提案列表）


## 1. 用户任务

- 目标用户：共建档
- 用户任务：①浏览/搜索提案（未实装——现役仅 proposalCount 计数）②投票（未实装——规划位）③触发周期结算 ④领取周期激励 ⑤查看国库；创建提案/执行提案→Cactus（外链，决议 008）
- 完成定义：投票上链；或激励领取到账
- 最重要的一个决策：**对提案投什么票**（治理合约类提案门槛更高——dao-governance.md:65）

## 2. 核心组件

| 组件 | 职责 |
|---|---|
| 治理概览卡 | 周期号+周期结束时间（绝对时间戳）；启动期状态（部署后初期不能提案，:66）。周期时长行不渲染（周期时长=合约常量，v1 固定 90 天——读链口径，文案不硬编码） |
| 提案列表（未实装规范项） | 状态过滤（活跃/通过/否决/已执行——spec：queue 未实现、无队列期，投票期结束即终局，governance-yield-details.md:377）；治理类标记（超级多数门槛徽章）；法定人数进度（票权基数含未委托份额——governance-yield-details.md:35） |
| 提案详情（未实装规范项） | 内容+当前票数（赞成/反对/弃权）+投票截止+执行状态；投票操作（赞/反/弃） |
| 周期激励卡 | 结算状态（是否有人触发过 `finalize`——**permissionless**，SPEC-M10 §周期语义：任何人可调，窗口≥CYCLE_DURATION）；划拨条件（有人投票+国库有入账+币种纳入——dao-governance.md:49）；领取窗口倒计时（**口径：最短剩余=当前周期 endTime；无人触发结算时窗口无上限**——显示「最短剩余 X·待下一次结算」）+「窗口过后未领并入国库不补发」（:51）；我的可领份额 |
| 治理工具卡（Cactus） | **外链卡：创建提案/执行提案在 Cactus 完成**（原 Tally，决议 008：v1 不自研治理工具）；入口按钮+引导（发起门槛读链提示、治理类需超级多数——规则见 Cactus）；本页从链上回显提案与执行结果（「已执行」为显示态）；启动期禁用+剩余时间同样在卡内提示；Cactus 域名与 CSP 登记标 `pending-manifest` |
| 国库卡 | 资产列表+余额（Governor 托管；ledger 守恒 G=T+R 语义不露出，仅展示资产） |

桌面：概览顶+提案列表左/激励+国库右。移动：纵排。密度=中。

## 3. 数据依赖

提案/票数/委托状态=RPC 实时；历史提案/激励记录=Graph（B3 降级）；周期参数=读链（CYCLE_DURATION 合约常量）；国库余额=RPC。

## 4. URL 状态

`?tab=dao` 之外无 dao 专属查询参数；`?proposal={id}` 提案详情直达=未实装规范项（无提案列表）。

## 5. 文案键

gov.tallyCard/tallyEnter/tallyNote（Cactus 外链卡）/ gov.finalize（触发结算——任何人可触发）/ gov.finalizeNote / gov.claimWindowNote（当前周期内可领上一周期奖励；结算时未领部分并入国库，不再补发）。超级多数/法定人数说明与 gas 提示=提案列表与投票实装时随键补齐（现役面板不渲染）。

## 6. 全状态标注

A1 rendered-here（只读完整）；A3 rendered-here（投票/领取禁用）；A4 rendered-here；A5–A12 delegated（交易中心）；A13 rendered-here；A14 rendered-here（无提案：「启动期」或「暂无提案」+说明）；A15 rendered-here；B1 rendered-here（governor 暂停）；B2 rendered-here（非治理链访问→引导切换/跨链信息）；B3 rendered-here（历史降级）；B4 rendered-here。

## 7. 可点击主流程（写操作——已接 useTxCenter 真实写路径；提案浏览/投票未实装）

触发结算→激励可领→领取到账；（规划位）浏览提案→详情→投票（钱包签名→状态）；创建提案/执行提案→跳 Cactus（外部工具）→本页回显「活跃/已通过/已执行」。

## 8. 错误恢复

无票权（未委托）：说明票权来自 Memecoin 质押份额委托（质押/委托 UI 未建，待后续版本）；启动期提案：禁用+剩余时间；领取窗口已过：说明并入国库（不补发）；gas 不足：原生代币提示。

## 9. 视觉证据

DESIGN.md 四轴；提案状态=徽章系统（线性时间线）；票数条形对比（赞成/反对）；零 glow；tabular-nums。

## 10. fixture 场景

`normal`/`paused`（governance 暂停）/`undeployed`（非治理链）/`index-lag`（历史降级）/`user-rejected`；页面特有数据变体见 fixture 记录：`fixtures/data/governance.json#gov-001`（含 supermajority 提案+待 finalize 周期）、`fixtures/data/accounts.json#acct-001`（no-voting-power=未委托）、启动期=verse 部署后初期（governor 读链状态）。

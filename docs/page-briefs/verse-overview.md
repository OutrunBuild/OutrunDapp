# Brief：`/memeverse/[verseId]`（Verse 详情单页）

- routes.json ID：R-04（动态 `[verseId]`，= 链上 uint256 verseId；fixture 行 id 不进 URL）；决议 007（PD-01/03/05 参与面板；asset-flows.md §0 为组件规范）
- 依据：architecture §2/§7；SPEC-M7 lifecycle-details.md、SPEC-M9 state-machines.md、SPEC-S1 router-and-user-flows.md；OB:memeverse/{lifecycle,genesis,preorder,four-pools}.md；product-intent.md R-04
- 子规范：交易台+Liquidity 标签=[verse-trade.md](verse-trade.md)；POL+Yield Vault 标签=[verse-yield.md](verse-yield.md)；DAO 标签=[verse-governance.md](verse-governance.md)
- 实现：`components/verse/verse-page.tsx`（按阶段双形态）+ `components/verse/*`

## 1. 用户任务

- 目标用户：P1/P2/P4/P5 全画像（三档路径都汇聚于此页）
- 用户任务：①看懂「当前阶段能做什么」（阶段×开放操作表 lifecycle.md:10-18）②参与创世（普通/杠杆）或预购 ③退款/领取（对应阶段）④跟踪关键时间与成功判定；locked/unlocked 起交易与 POL/PT/YT/DAO 操作
- 完成定义：完成任一阶段开放操作（参与/领取/退款确认到账）
- 最重要的一个决策：**以何种方式参与**（普通/杠杆/预购——参与面板两层决策）

## 2. 核心组件（按阶段双形态）

**Genesis/Refund 态**：

| 组件 | 职责 |
|---|---|
| Verse 头卡 | 名称/symbol/阶段徽章（VerseStage）+ Fast Genesis 徽章（fastGenesis 创世 verse）/治理链/关键倒计时（创世截止/解锁时间）；**黄昏区**（截止后、推进触发前）：倒计时显示「已截止 · 待阶段推进」 |
| 黄昏区说明 | 链上阶段仍为 Genesis、参与仍合法且**计入达标判定**（合约只查 stage 不查 endTime——MemeverseLaunchImpl.sol:159-183）：**参与面板保持可用**（仍在创世阶段即产品逻辑，不禁止参与）+说明「截止已过·仍在创世阶段，参与仍计入成功判定」，「触发阶段推进」入口高亮（permissionless，任何人可触发） |
| 判定面板（threshold-panel） | 双门槛进度条：普通资金与杠杆利息**独立**判断（预购与债务本金不计入，lifecycle.md:35-49）；最低成功额度；**Fast Genesis 状态行**（fastGenesis 创世 verse 专属）：未达标=「任一门槛达标即可提前结束创世，无需等到截止时间」；达标=青色「已达标 · 待推进。已满足成功阈值——任何人都可以触发阶段推进」（state-machines:33-35/lifecycle.md:52-54） |
| 当前操作卡（action-panel） | 当前阶段开放的操作集（创世期：参与+预购；退款态：退款领取——按 SPEC-M9 状态机门控，**读链判定不前端硬编码**）；`data-stage` 阶段色 |
| 参与面板 | **完整规范见 [asset-flows.md](asset-flows.md) §0**（普通创世默认+杠杆切换+预购分配器；直接参与/质押参与）——本页为 EF-1/EF-2 挂载节点 |
| 统计面板（stats-panel） | 创世截止时间/参与人数/预估市值（projectedMarketCap，null 不渲染）/我的参与（零参与=未参与文案） |
| 触发费分发 | **permissionless 入口**（锁定期起）：任何人触发手续费分发、获执行奖励（主池 uAsset 费 0.25% 当前默认——lifecycle.md:75/playbooks.md:102）；显示可触发状态+预估奖励+手续费提示 |
| 触发阶段推进 | **permissionless 入口**：阶段推进需链上交易触发、不随时间自动发生（lifecycle.md:51/state-machines:69）——显示当前可推进阶段+触发按钮（手续费由触发者承担；到点未触发则后续操作阻塞，此入口即出口） |
| 四池概览 | 主池（Memecoin/uAsset）+三辅助池；资金流向 70/30 与 POL 2:3:2、PT 1:2（four-pools.md:22-23）；剩余资金去向不展示（决议 C2） |
| 领取/退款中心 | 退款领取（每地址一次；POLend 杠杆退款领受益人、普通/预购退款领领取人——无代付下两者同为本账户）；锁定期起领取项（初始 YT、辅助池分成、LP 费、预购线性解锁可领量） |

**Locked/Unlocked 态**：交易台持久区（`VerseTradeDesk`，规范见 verse-trade.md）+ 四标签（`VerseTabs`，白名单 `liquidity|pol|vault|dao`——components/global/routes.ts `VERSE_TAB_KEYS`）。

桌面：头卡+判定横排 → 参与面板左/操作右 → 统计横排。移动：头部→判定→参与面板→操作→折叠。密度=高（T2 上限内）。

## 3. 数据依赖

Verse 元数据/阶段=RPC（阶段变更需链上交易触发——lifecycle.md:51，前端不自动推断）；进度双口径=Graph+RPC 复核；参与面板数据=asset-flows §3；领取资格=RPC（每地址状态）；倒计时=客户端时钟+RPC 校准。B3 降级不影响阶段判定（以 RPC 为准）。

## 4. URL 状态

路径参数 `[verseId]`；查询参数 `?tab=liquidity|pol|vault|dao`（白名单外回落 liquidity）+ `?action=withdraw`（vault 标签初始视图）；`#participate` 锚点（参与面板直达，可分享）。

## 5. 文案键

phase.genesis/locked/unlocked/refund（阶段徽章）；success.dual-threshold（双门槛独立判定说明）；verse.fastGenesis/fastGenesisNote/fastGenesisReached/fastGenesisReachedNote（Fast Genesis 徽章与判定面板状态行，glossary B）；verse.metricsTitle/genesisEnds/participantsLabel/estMarketCap/yourParticipation/notParticipating（统计面板）；participate.*（见 asset-flows）；protection.short（「本金守恒 · 24 小时保护期内可完整退出」——C5 短标签）+ 详情展开（OB 原句 genesis.md:37,58）；refund.once（每地址一次，退给受益人）。

## 6. 全状态标注

A1 rendered-here（只读完整；参与面板引导连接）；A2 delegated-to-global-surface（钱包选择器）；A3 rendered-here（错链禁写：参与/领取禁用+说明）；A4 rendered-here（首次写前启用引导；**三分支**：code 为空→启用引导；code 非空但不匹配（C3）→「检测到其他应用的启用，需先替换」行内引导；已启用→直付）；A5–A12 delegated（交易中心；参与/领取交易状态）；A13 rendered-here（阶段/进度骨架）；A14 rendered-here（未参与→统计面板「未参与」文案+入口；退款态无记录→说明）；A15 rendered-here（数据失败重试）；B1 rendered-here（Verse 暂停位/池暂停→写操作禁用）；B2 rendered-here（该 Verse 未在当前查看链部署→引导切换链）；B3 rendered-here（静默降级，阶段以 RPC）；B4 rendered-here（回面板草稿保留）。

## 7. 可点击主流程（写操作——原型只演示 ViewModel 状态，业务集成待实装）

1. 创世期：参与面板（普通/杠杆+预购分配）→ 审阅→授权→签名→提交→确认→份额到账视图（出口=本页确认态）
2. 退款态：退款卡→确认→到账（每地址一次守卫）
3. 锁定期起：领取项逐个/批量领取；进入四标签（liquidity=公开交易/加减池、pol/vault=拆分赎回系列、dao=治理）
4. 解锁期：vault 标签赎回工作流（六步退出口径，规范见 verse-yield.md）

## 8. 错误恢复

阶段数据失败：以 RPC 兜底显示+重试；参与失败：错误解码+恢复动作（重试/调参）；领取失败：资格校验提示（未到窗口/已领取）；错链：禁写+切换引导。

## 9. 视觉证据

DESIGN.md 四轴；阶段徽章+倒计时=VerseStage 契约；双门槛进度条零 glow、tabular-nums；参与面板切换=echo-confirm 候选（杠杆面板形态变化）；时间线线性（禁旋转/3D）。

## 10. fixture 场景

`normal`/`zero-balance`/`paused`/`undeployed`/`wrong-network`/`user-rejected`/`index-lag`；页面特有数据变体见 fixture 记录：`fixtures/data/verses.json#verse-001~004`（创世期近门槛/锁定含领取项/解锁保护期内/退款态——即 routes.json fixturePath）；`genesis.fastGenesis`=verse-020（已达标待推进）/verse-022（未达标）；`fixtures/data/transactions.json`（参与/领取交易样本）。

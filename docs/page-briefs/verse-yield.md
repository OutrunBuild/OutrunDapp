# Brief：Verse 详情页 · POL 标签 + Yield Vault 标签（杠杆仓位与 PT/YT）

- routes.json ID：R-04 子规范（`/memeverse/[verseId]` 单页标签 `?tab=pol|vault`；父规范=[verse-overview.md](verse-overview.md)）；决议 007（PD-06 交易台密度、PD-11 无代付、C1 储备金不露出、C5 保护期口径、C9 原子口径）
- 依据：architecture §2/§7；SPEC-M13 polend/genesis.md、SPEC-M6 verse/accounting.md、SPEC-M7 lifecycle-details.md、SPEC-M4 swap/yt-flash-swap.md；OB:memeverse/{polend,pol-splitter,genesis-credit}.md、genesis.md:60-77；POL 名义价值口径=Memeverse spec polend/pt-yt-splitter.md §4
- 落位：POL 标签=Operate（Mint（locked 起）/Redeem（unlocked 起））+ Split/Merge（仅 locked）——代码口径 mintPOLToken/redeemMemecoinLiquidity/POLSplitter；Yield Vault 标签=杠杆头寸管理+赎回（赎回六步工作流等深水区待实装，本 brief 为规范源）；实现 `components/verse/verse-tab-panels.tsx`（PolPanel）+ `verse-vault-panel.tsx` + `pol-split-merge-dialog.tsx`/`pol-redeem-pt-yt-dialog.tsx`

- 杠杆创世入口在参与面板（asset-flows.md §0.3）；POL/Vault 标签=杠杆仓位的管理与 PT/YT 凭证操作台

## 1. 用户任务

- 目标用户：P4 杠杆/进阶玩家+平衡档（playbooks.md:53）
- 用户任务：①管理杠杆头寸（债务额度/上限/付息记录）②split/merge（仅锁定期）③YT 闪电兑换（买/卖 YT）④解锁期赎回系列（六步完整退出）⑤GenesisCredit 管理（付息抵扣/跨链/领取）
- 完成定义：任一操作确认到账；完整退出=六步全部完成（genesis.md:60-67）
- 最重要的一个决策：**付息资产选 uAsset 还是创世积分**（份额等价、利息去向不同：uAsset 归国库/积分销毁——OB:memeverse/polend.md:11-16,42-44）

## 2. 核心组件

| 组件 | 职责 |
|---|---|
| 头寸总览卡 | 杠杆份额、债务额度、市场债务上限余量（SPEC-M13 读链）、付息记录（uAsset/积分分列） |
| 拆分/合并面板 | 1 POL ⇄ 1 PT + 1 YT（仅锁定期门控——SPEC-M7 开放表；解锁/结算后不可，pol-splitter.md:16）；批量输入+预览 |
| YT 闪电兑换面板 | 用 POL 买 YT / 卖 YT 换回 POL（复用 PT/POL 池）；**买入=精确到量**（设 100 预算、YT 实得即指定数量，实付 POL 按实际成本结算、未用预算留在钱包——yt-flash-swap.md:66）；仅锁定期；价格保护线（大单建议紧保护+尽快成交） |
| 赎回工作流（解锁期起） | 完整退出向导（**六步=OB 用户文档口径 genesis.md:60-67**；spec 层为动作集+门控、无步骤计数——lifecycle-details:179-185）：领权益→撤辅助池→赎 PT（按结算锚定比率）→烧 POL（须设最低到账+截止）→赎 YT（结算剩余）→确认完成；**步骤进度持久化**、各步分笔可执行；警示「领到 LP/POL/PT/YT ≠ 完成 uAsset 本金退出」；解锁期本 tab 默认选中 |
| GenesisCredit 面板 | 余额展示+付息入口→**本 verse** 参与面板杠杆模式；领取入口在 Portfolio 可行动区就地执行（限主链，非主链查看链时禁用+切链提示——GCredit 为 uAsset 族全局资产，跨 Verse 通用）；领取规则（主链、每账户一次——OB genesis-credit.md:9；**领取规则基线 spec 无条文，标 pending-manifest（冻结 ABI 时核实）**）/用于付息入口/跨链（→Portfolio 跨链 BridgeDialog） |
| 风险披露区 | 损失上限=利息、无清算、失败全额退（playbooks.md:63）；利率=一次性比例非年化（polend.md:24-28） |

桌面：头寸总览顶 → 左操作面板（Tab：拆分合并/闪电兑换/赎回）右 GenesisCredit+披露。移动：总览→Tab 纵排→披露折叠。密度=全站最高。

## 3. 数据依赖

头寸/份额/上限=RPC 实时；YT 兑换报价=RPC（PT/POL 池 quoter）；赎回各步资格与到账预估=RPC；历史=Graph（B3 降级）。全部写操作经 Kernel batch（§6.3）；结算储备金**不露出**（决议 C1）。

## 4. URL 状态

`?tab=pol|vault`（+`&action=withdraw`=Vault 标签初始取回视图）；赎回向导步骤进 URL（`&step=n`，中断可回）为深水区实装规范；`#position-{id}` 头寸锚点。

## 5. 文案键

pol.invariant（1 POL = 1 PT + 1 YT）/ flash.exact-out（买入=精确拿到指定数量 YT）/ redeem.six-steps（六步完整退出）/ redeem.warning（领到凭证≠本金退出）/ leverage.rate-note（一次性创世利息比例，非年化）/ credit.burn-note（创世积分付息：结算时销毁——本页「积分」均指创世积分 GenesisCredit，首现全称）/ protection（C5 短标签+OB 原句展开）。

## 6. 全状态标注

A1 rendered-here；A3 rendered-here（错链禁写）；A4 rendered-here；A5–A12 delegated（交易中心；六步每步独立交易状态）；A13 rendered-here（头寸/报价骨架）；A14 rendered-here（零头寸→「未参与杠杆创世」+参与面板入口；YT 余额为零→买卖禁用）；A15 rendered-here；B1 rendered-here（市场暂停）；B2 rendered-here；B3 rendered-here（历史降级，操作不依赖）；B4 rendered-here。**解锁前 split/merge/flash 面板整体禁用+阶段说明**（SPEC-M7 门控）；解锁后 split/merge/flash 禁用（pol-splitter.md:16）。

## 7. 可点击主流程

> 阶段前置降级（URL 直达）：Refund 态=「创世失败·杠杆利息全额退」+退款引导（头寸语境无意义）；Genesis 态=拆合/闪电禁用（仅锁定期）+参与入口高亮。（写操作——原型只演示 ViewModel 状态，业务集成待实装）

1. 拆分：输 POL 数→预览 PT+YT→审阅→执行→到账
2. YT 买入：输目标 YT 数量+预算上限→报价（实付≤预算）→保护线→执行
3. 赎回向导：逐步执行（每步独立审阅+状态）→第六步确认完成视图
4. 失败必测：向导中断（步骤持久化重入）、保护线触发、拒签

## 8. 错误恢复

阶段门控违规（如解锁后拆分）：前置禁用（不可点）而非提交后报错；赎回中断：步骤状态持久化+「继续第 n 步」；闪电兑换价差扩大：保护线拦截+重报；结算相关失败：保持锁定可重试口径（C9——不出现「解锁成功但结算失败」文案）。

## 9. 视觉证据

DESIGN.md 四轴；交易台密度（PD-06）；六步向导=进度指示器（线性、可回溯步骤状态）；数字 tabular-nums；红色语义仅损失场景；风险披露用警示条非弹窗（不打断）。

## 10. fixture 场景

`normal`/`zero-position`/`zero-balance`/`paused`/`index-lag`/`user-rejected`/`tx-failure`；页面特有数据变体见 fixture 记录：`fixtures/data/verses.json#verse-002|003`（锁定/解锁态门控）+`fixtures/data/transactions.json`（向导各步与拆合交易样本）；债务上限余量/积分余额=运行时读链展示。

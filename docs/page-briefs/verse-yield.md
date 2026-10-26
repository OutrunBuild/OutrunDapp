# Brief：Verse 详情页 · POL 标签 + Yield Vault 标签（POL 凭证操作与 Memecoin 收益库）

- routes.json ID：R-04 子规范（`/memeverse/[verseId]` 单页标签 `?tab=pol|vault`；父规范=[verse-overview.md](verse-overview.md)）；决议 007（PD-06 交易台密度、PD-11 无代付、C1 储备金不露出、C5 保护期口径、C9 原子口径）
- 依据：architecture §2/§7；SPEC-M13 polend/genesis.md、SPEC-M6 verse/accounting.md、SPEC-M7 lifecycle-details.md、SPEC-M4 swap/yt-flash-swap.md；OB:memeverse/{polend,pol-splitter,genesis-credit}.md、genesis.md:60-77；POL 名义价值口径=Memeverse spec polend/pt-yt-splitter.md §4
- 落位：POL 标签=Operate（Mint（locked 起）/Redeem（unlocked 起））+ Split/Merge（仅 locked）——代码口径 mintPOLToken/redeemMemecoinLiquidity/POLSplitter；Yield Vault 标签=**Memecoin 收益库质押**（Stake + Redeem/Withdraw 两页签、两步异步赎回）；杠杆头寸读数与付息入口=参与面板 credit 行 + Portfolio 资产区 Credit 清单；保护期完整退出（六步）=Portfolio 保护期 Exit 弹窗；实现 `components/verse/verse-tab-panels.tsx`（PolPanel）+ `verse-vault-panel.tsx` + `pol-split-merge-dialog.tsx`/`pol-redeem-pt-yt-dialog.tsx` + `components/portfolio/protection-exit-dialog.tsx`

- 杠杆创世入口在参与面板（asset-flows.md §0.3）；POL 标签=PT/YT 凭证操作台，Vault 标签=收益库质押操作台

## 1. 用户任务

- 目标用户：P4 杠杆/进阶玩家+平衡档（playbooks.md:53）
- 用户任务：①split/merge（仅锁定期）②YT 闪电兑换（买/卖 YT）③POL Mint/Redeem ④收益库质押（Stake/两步异步赎回/委托/跨链引导）⑤GenesisCredit 付息（入口=参与面板；领取/跨链在 Portfolio）
- 完成定义：任一操作确认到账；完整退出=六步全部完成（genesis.md:60-67）
- 最重要的一个决策：**付息资产选 uAsset 还是创世积分**（份额等价、利息去向不同：uAsset 归国库/积分销毁——OB:memeverse/polend.md:11-16,42-44）

## 2. 核心组件

| 组件 | 职责 |
|---|---|
| POL 操作面板 | Mint（locked 起）/Redeem（unlocked 起）LP 凭证（mintPOLToken/redeemMemecoinLiquidity） |
| 拆分/合并面板 | 1 POL ⇄ 1 PT + 1 YT（仅锁定期门控——SPEC-M7 开放表；解锁/结算后不可，pol-splitter.md:16）；批量输入+预览 |
| YT 闪电兑换面板 | 用 POL 买 YT / 卖 YT 换回 POL（复用 PT/POL 池）；**买入=精确到量**（设 100 预算、YT 实得即指定数量，实付 POL 按实际成本结算、未用预算留在钱包——yt-flash-swap.md:66）；仅锁定期；价格保护线（大单建议紧保护+尽快成交） |
| 收益库面板（vault） | Memecoin 收益库质押：Stake + Redeem（等待期条目，秒级倒计时）/Withdraw（成熟条目）两页签；赎回=两步异步（发起→等待→领取）；委托（代他人/被委托）；跨链 banner（他链仓位引导）；Portfolio 金库表 Stake 深链 `?tab=vault` 落本页签 |
| 保护期完整退出（六步） | 落位=Portfolio 保护期 Exit 弹窗（`protection-exit-dialog.tsx` 多步向导；六步=OB 用户文档口径 genesis.md:60-67，spec 层为动作集+门控、无步骤计数——lifecycle-details:179-185）：领权益→撤辅助池→赎 PT（按结算锚定比率）→烧 POL（须设最低到账+截止）→赎 YT（结算剩余）→确认完成；警示「领到 LP/POL/PT/YT ≠ 完成 uAsset 本金退出」；步骤进度 URL 化=未实装规范项 |
| GenesisCredit 付息 | 付息入口=本 verse 参与面板杠杆模式（credit 路由）；余额行=Portfolio 资产区 Credit 清单；领取=Portfolio 待办区就地（限主链，非主链查看链禁用+切链提示——GCredit 为 uAsset 族全局资产，跨 Verse 通用；领取规则基线 spec 无条文，标 pending-manifest）；跨链→Portfolio BridgeDialog |
| 头寸总览 | 杠杆份额/债务额度/市场债务上限余量（SPEC-M13 读链）/付息记录（uAsset/积分分列）——落位=参与面板杠杆模式（asset-flows.md §0.3） |
| 风险披露区 | 损失上限=利息、无清算、失败全额退（playbooks.md:63）；利率=一次性比例非年化（polend.md:24-28） |

桌面：头寸总览顶 → 左操作面板（Tab：拆分合并/闪电兑换/赎回）右 GenesisCredit+披露。移动：总览→Tab 纵排→披露折叠。密度=全站最高。

## 3. 数据依赖

头寸/份额/上限=RPC 实时；YT 兑换报价=RPC（PT/POL 池 quoter）；赎回各步资格与到账预估=RPC；历史=Graph（B3 降级）。全部写操作经 Kernel batch（§6.3）；结算储备金**不露出**（决议 C1）。

## 4. URL 状态

`?tab=pol|vault`（+`&action=withdraw`=Vault 标签 Withdraw 页签初始视图）；六步向导步骤 URL 化（`&step=n`）与 `#position-{id}` 头寸锚点=未实装规范项。

## 5. 文案键

pol.invariant（1 POL = 1 PT + 1 YT）/ flash.exact-out（买入=精确拿到指定数量 YT）/ redeem.six-steps（六步完整退出）/ redeem.warning（领到凭证≠本金退出）/ leverage.rate-note（一次性创世利息比例，非年化）/ credit.burn-note（创世积分付息：结算时销毁——本页「积分」均指创世积分 GenesisCredit，首现全称）/ protection（C5 短标签+OB 原句展开）。

## 6. 全状态标注

A1 rendered-here；A3 rendered-here（错链禁写）；A4 rendered-here；A5–A12 delegated（交易中心；六步每步独立交易状态）；A13 rendered-here（头寸/报价骨架）；A14 rendered-here（零头寸→「未参与杠杆创世」+参与面板入口；YT 余额为零→买卖禁用）；A15 rendered-here；B1 rendered-here（市场暂停）；B2 rendered-here；B3 rendered-here（历史降级，操作不依赖）；B4 rendered-here。**解锁前 split/merge/flash 面板整体禁用+阶段说明**（SPEC-M7 门控）；解锁后 split/merge/flash 禁用（pol-splitter.md:16）。

## 7. 可点击主流程

> 阶段前置降级（URL 直达）：Refund 态=「创世失败·杠杆利息全额退」+退款引导（头寸语境无意义）；Genesis 态=拆合/闪电禁用（仅锁定期）+参与入口高亮。（写操作——已接 useTxCenter 真实写路径；六步向导在 Portfolio、步骤持久化未实装）

1. 拆分：输 POL 数→预览 PT+YT→确认→执行→到账
2. YT 买入：输目标 YT 数量+预算上限→报价（实付≤预算）→保护线→执行
3. 赎回：收益库两步异步（发起→等待→领取）；保护期完整退出=Portfolio Exit 向导逐步执行（每步独立确认+状态）
4. 失败必测：向导中断重入（规范项未实装）、保护线触发、拒签

## 8. 错误恢复

阶段门控违规（如解锁后拆分）：前置禁用（不可点）而非提交后报错；赎回中断：两步异步凭等待期状态恢复（六步向导步骤持久化=规范项未实装）；闪电兑换价差扩大：保护线拦截+重报；结算相关失败：保持锁定可重试口径（C9——不出现「解锁成功但结算失败」文案）。

## 9. 视觉证据

DESIGN.md 四轴；交易台密度（PD-06）；六步向导=进度指示器（线性、可回溯步骤状态）；数字 tabular-nums；红色语义仅损失场景；风险披露用警示条非弹窗（不打断）。

## 10. fixture 场景

`normal`/`zero-position`/`zero-balance`/`paused`/`index-lag`/`user-rejected`/`tx-failure`；页面特有数据变体见 fixture 记录：`fixtures/data/verses.json#verse-002|003`（锁定/解锁态门控）+`fixtures/data/transactions.json`（向导各步与拆合交易样本）；债务上限余量/积分余额=运行时读链展示。

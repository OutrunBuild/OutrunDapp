# Brief：Verse 详情页 · 交易台 + Liquidity 标签（Swap 与流动性）

- routes.json ID：R-04 子规范（`/memeverse/[verseId]` 单页；父规范=[verse-overview.md](verse-overview.md)）；决议 007（PD-06 分层语气：允许交易台密度）
- 依据：architecture §2/§6/§7；SPEC-M1 swap-flow.md、M2 swap-integration.md、M3 permit2.md、M4 yt-flash-swap.md（仅交易语境）、M5 uniswap-v4.md、M14 MemeverseUniswapHookUpgradeable.sol；OB:memeverse/hook.md
- 落位：Swap/K 线/统计条=单页交易台持久区（locked/unlocked 态）；流动性=同页 Liquidity 标签（四池=真源口径）；实现 `components/verse/verse-trade-desk.tsx`


## 1. 用户任务

- 目标用户：P3（结算）、P1（买入）、LP 角色（lifecycle.md:71）
- 用户任务：①Swap（Memecoin↔uAsset）②加减流动性（铸 POL 做 LP）③看懂费率构成与 LP 收益 ④查看 LP 费用/返佣
- 完成定义：成交确认（到账）；或流动性建立/移除确认
- 最重要的一个决策：**是否接受当前费率成交**（回归均衡付基础费；制造波动承担动态费——hook.md:39-40）

## 2. 核心组件

| 组件 | 职责 |
|---|---|
| Swap 面板 | 方向切换（Memecoin↔uAsset）/金额/报价（参考价+预估到账+费率预估）；**报价≠保证成交**提示（yt-flash-swap.md §5.5：报价只保证历史快照精确，不保证未来成交——spec 口径） |
| 费率构成展开 | 基础费+动态费（冲击累积）+开池衰减费（开池 50%→1%/15 分钟，hook.md:46）；EWVWAP 豁免效果表述（「让价格回归均衡的交易可豁免动态费」——机制词不上 UI，决议 007（EWVWAP 效果的精确表述）） |
| 滑点与下限 | **分语境预填默认值**（常态 0.5%〔Jupiter/老版 demo 同值〕；开池衰减期预填更高默认——低默认会连环 revert），可改；最低到账数量+截止时间（未设拒绝执行）保留。**口径：费率不额外吃滑点**——费在输入侧一次扣除、报价即费后到账量、无 fee-on-fee（swap-flow.md:49-66 一次选费+费后 delta 结算；uniswap-v4.md:70），滑点阈值作用于费后报价，覆盖的是报价→执行间的价格漂移与动态费状态漂移（动态费=per-address/per-pool state，重入防护即为此——swap-flow.md:159,243） |
| 快捷金额 | **Half / Max 按钮**（余额一半/全部快捷填入）〔letsbonk/Jupiter 实测+老版 demo 先例〕 |
| 流动性面板 | **四池选择器**（主池 Memecoin/uAsset 默认；POL/uAsset、PT/uAsset、PT/POL 可选）+ 加池/移除（Router `addLiquidity/removeLiquidity`，池无关，min 保护+deadline——SPEC-M5/M14：`beforeAddLiquidityLogic` 仅要求经 Router，不限池）；LP 份额与累计费用（费用领取=Hook `claimFeesCore` 执行入口；余额预览=Router `previewClaimableFees` 只读——swap-integration.md:189-196）；分成说明 65/35（有推荐人 65/25/10——uniswap-v4.md:102-104） |
| 推荐返佣 | 推荐码/链接携带（返佣归属展示） |
| 代币统计条 | 市值/流动性/24h 成交量/持有人数/总供应（Graph+主池价计算）——memecoin 交易信任信号〔市场实测 PU-009d/002d+老版 demo 先例（PU-000d 统计胶囊行）〕 |
| 合约地址 | CA 地址+复制按钮（图表区下方）〔老版 demo 先例〕 |
| K 线图 | Memecoin/uAsset 主池价格 K 线（OHLC）：粒度切换（1m/5m/1h/1d）；**保护窗区间标注为暂停交易段**（窗口内无成交）；成交懒加载；reduced-motion 下无动画只静态渲染；数据=Graph 聚合 swap 事件（B3 降级→隐藏历史段+提示） |
| 池信息卡 | 四池概览（TVL/24h 量）；选中池深度图/近期成交（Graph） |

桌面：Swap+K 线左（大）+池信息右；流动性 Tab 切换。移动：Tab（Swap/流动性/池信息）纵排，K 线 390px 折叠展开。密度=高（全站密度天花板之一，交易台密度允许——PD-06）。

## 3. 数据依赖

报价=RPC（quoter，客户端实时；失效重报）；费率预估=Hook 读链（动态费参数 owner 可调，**不写死默认值**——显示读链值）；池数据/K 线 OHLC/历史=Graph（RSC+B3 静默降级：K 线隐藏陈旧历史段、不假造蜡烛；粒度「同步中」标记=Q3 裁定的粒度可用性提示，非 B3 状态）；LP 份额/费用=RPC（实时）；返佣=推荐参数。

渲染边界：Swap/流动性表单=Client 岛；池信息 RSC。全部写操作经 Kernel 原子 batch（§6.3 固定顺序：approval→beginAccountSession→swap/swapWithPermit2→endAccountSession）；**会话由前端自动包裹、对用户不可见**（OB:memeverse/hook.md:73）——无显式 session UI，但需呈现「交易以智能账户原子执行」的信任说明。

## 4. URL 状态

交易台=详情页持久区（locked/unlocked 态自动可见）；流动性=`?tab=liquidity`；`?input=…&ref=…`（输入预填/推荐码进查询参数）；分享还原 tab 与输入预填。

## 5. 文案键

swap.rate-note（报价为参考价，不保证成交）/ fee.dynamic（动态费：让价格回归均衡的交易付基础费）/ fee.opening（开池期费率衰减中）/ lp.split（LP 费分成 65/35；有推荐人 65/25/10）/ approve.label（授权——界面只说「授权/授权扣取」，机制注记见 §2 与 glossary D 节）/ atomic.tx（一笔原子交易完成，失败整体回退）。

## 6. 全状态标注

A1 rendered-here（报价可看不可交易）；A3 rendered-here（错链禁交易）；A4 rendered-here（智能账户门槛——hook.md:73；**三分支**：普通 EOA→启用引导；C3 不匹配→「先替换」行内引导；已启用→直付）；A5–A7 delegated；A8–A12 delegated（交易中心：报价→审阅→状态中心全流程）；A13 rendered-here（报价/池数据骨架）；A14 rendered-here（零余额输入态+获取入口**按阶段指向**：创世期→参与面板资产入口；锁定/解锁期→Portfolio 面值兑换与跨链）；A15 rendered-here（报价失败重试）；B1 rendered-here（**保护期=交易时间门控**（publicSwapResumeTime），非合约暂停位：窗口内 Swap 禁用+说明；**移除流动性与赎回保持开放**；**加池保守禁用**〔spec 留有产品口子——state-machines:62-63〕；真正的 hook/launcher Pausable 暂停位另列文案「协议暂停」——genesis.md:45-48，六步退出第 2 步依赖此通道，不得一并禁用）；B2 rendered-here；B3 rendered-here（历史/深度降级，交易不依赖）；B4 rendered-here（回面板草稿保留）。

## 7. 可点击主流程

> 阶段前置降级（URL 直达）：Verse 在创世/退款态时无公开市场——交易台/标签不渲染，页面呈 Genesis 态组件+引导（四池在达标时才建立）。（写操作——原型只演示 ViewModel 状态，业务集成待实装；**不伪造链上成功**）

1. Swap：选方向→输金额→报价刷新→展开费率→设滑点下限→审阅卡（到账预估+授权链）→授权（如需）→签名→提交→确认→成交到账视图
2. 流动性：加池（双资产输入+比例校验）→审阅→执行→POL 到账；移除：输份额→预览底层→执行
3. 失败示例必测：滑点保护触发 revert、拒签、错链禁写

## 8. 错误恢复

报价过期（nonce/状态变化）：自动重报+提示重新确认（§6.3 simulation 与广播间变化必须重构重签）；滑点不足：明示实际差额+调整重试；池暂停：说明保护期窗口与恢复时间；余额不足：获取入口。

## 9. 视觉证据

DESIGN.md 四轴；交易台密度=P4 受众页（PD-06 分层）；数字全部 tabular-nums、等宽仅数据字段（决议 001-A）；费率构成用分层展开（默认收起，防新手过载）；TokenPair/AmountInput/TransactionReview 契约。

## 10. fixture 场景

`normal`/`zero-balance`/`wrong-network`/`paused`/`tx-failure`（slippage revert 样本=tx-006）/`index-lag`（K 线历史段降级）；页面特有数据变体见 fixture 记录：`fixtures/data/markets.json#mkt-001~004`（含开池衰减/保护窗暂停费率态与 K 线蜡烛、四池样本）。

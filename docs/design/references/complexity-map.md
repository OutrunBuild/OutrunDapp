# 信息复杂度地图（Stage-01 步骤 5 · 11 条路由）

> 生成方式：Explore 子代理全量阅读 OutrunBook `memeverse/`（13 文件）与 `outstake/`（7 文件）用户级文档后提取；密度判断逐条引用模块文档小节。
> 密度等级：低 / 中 / 高 / 极高。`[T]` = 数字型字段（tabular-nums 红线适用）。
> OutrunBook 与合约 spec 冲突时以 spec 为机制真相，冲突登记文末附注。

| 路由 | 密度 | 复杂操作 Top | 核心数据字段 | 依据（OutrunBook） |
|---|---|---|---|---|
| `/` 生态首页 | 低 | ①角色导览分流（发起人/创世参与者/质押·治理者）②三套引擎概念展示 ③uAsset 角色说明 | 概念名称、角色标签、导流入口；uAsset 三类锚定对象文字 | memeverse/README.md §三套引擎/§谁参与，怎么参与/§uAsset 在 Memeverse 里的角色；outstake/uasset.md §uAsset 是什么 |
| `/bridge` 跨链 | 中 | ①uAsset 跨链（系统报价消息费、6 位精度截断）②Memecoin/创世积分跨链（精确支付、防重放）③跨链质押落位核验（份额 vs 裸币） | 源/目标链、资产类型、发送金额[T]、消息费报价[T]、精度截断提示[T]、速率限额余量与恢复窗口[T]、三阶段状态（发送/到账/落位）、滞留标记、接收地址 | outstake/omnichain.md §速率限制/§已发跨链不受暂停影响；memeverse/omnichain.md §多链启动/§创世积分也跨链/§跨链的可靠性（三阶段失败表） |
| `/memeverse` 发现 | 中 | ①列表筛选进入（各链独立募资/建池/阶段）②创世进度对比（两门槛独立判定、预购不计入）③预购容量查看 | 阶段状态、链/治理链标记、普通创世资金[T]、杠杆利息[T]、预购资金与容量[T]、最低成功额度[T]、达标进度%[T]、截止倒计时、快速创世标记 | memeverse/lifecycle.md §阶段一览/§创世如何达标；memeverse/preorder.md §怎么参与 |
| `/memeverse/create` 创建 | 中 | ①设定创世规则（链、定价、最低额度）②指定治理链 ③快速创世开关 | 链多选、初始定价[T]、最低筹集额度[T]、注册锁定利率[T]、债务上限[T]、治理链、快速创世开关、发起截止 | memeverse/lifecycle.md §1. 创世；memeverse/omnichain.md §治理链；memeverse/polend.md §放大倍数由利率决定 |
| `/memeverse/[verseId]` 总览 | 高 | ①三口径资金追踪与达标判定 ②阶段推进触发（需交易触发，非自动）③角色×阶段领取矩阵（领 YT/费分成/LP 费/预购线性领取/退款） | 阶段状态机、三口径金额[T]、两门槛独立达标状态、365 天锁定剩余[T]、参与/YT 份额[T]、费分成累计[T]、预购可领与解锁进度[T]、24h 保护窗倒计时[T]、受益人地址 | memeverse/lifecycle.md §阶段 × 开放操作/§1~4 各阶段；memeverse/preorder.md §线性解锁；memeverse/polend.md §两种付息方式 |
| `/memeverse/[verseId]/trade` Swap/流动性 | **极高** | ①动态费率 Swap（基础 1%+逆向冲击+波动+短期冲击，硬顶 100%，EWVWAP 豁免，开池衰减）②加池铸 POL + LP 领费 ③烧 POL 赎回流动性（滑点/截止强制） | 四池价格与储备[T]、实时费率及分解[T]、开池衰减剩余[T]+倒计时、EWVWAP 豁免状态、滑点/最低到账/截止[T]、LP 份额与累积费[T]、费率分配[T]、推荐人地址、会话状态 | memeverse/hook.md §动态费率的组成/§EWVWAP 豁免/§开池初期高费率防抢跑/§费率怎么分/§谁可以发起交易；four-pools.md §四个池子；lifecycle.md §2/§4 |
| `/memeverse/[verseId]/pol` POL/PT/YT 工作台 | **极高** | ①YT Flash Swap 买卖（精确数量+支付上限/收到下限，原子执行，须智能账户会话）②POL⇄PT+YT 拆分/合并（1:1，仅锁定期）③解锁结算后赎回组合（PT 锚定赎回+YT 分剩余+烧 POL） | POL/PT/YT 余额[T]、YT 隐含价=POL−PT[T]（标注参考价非保证）、池市价深度[T]、最高支付/最低收到[T]、保护线与过期时限[T]、债务额度与付息比例[T]、结算回收/结余/缺口与储备金[T]、PT 锚定比率[T]、拆分合并可用状态 | memeverse/yt-flash-swap.md 全篇；pol-splitter.md §拆分/§结算后才能赎回；polend.md §到期怎么结算/§利息去了哪里；genesis.md §如何完整退出 |
| `/memeverse/[verseId]/stake` 质押 | 高 | ①质押换份额（缓冲机制）②异步两步赎回（价值固定→等待→执行，上限 5 笔）③委托投票权 | 质押数量[T]、份额余额与单价[T]、累计收益[T]、待执行赎回笔数（≤5）[T]、赎回等待倒计时[T]、委托状态与对象、有效票权[T]、gas 提示 | memeverse/memecoin-staking.md §怎么运作/§防操纵设计/§质押加委托，才有治理权 |
| `/memeverse/[verseId]/governance` 治理 | 高 | ①提案与投票（延迟/法定人数/超级多数）②周期激励闭环（触发结算→领取窗口）③国库支出提案（比例上限、链上执行） | 提案列表与状态、赞成/反对票数[T]、法定人数进度[T]、超级多数标记、周期编号与结算倒计时（90 天）[T]、国库余额[T]、奖励池[T]、个人票数占比与可领激励[T]、领取窗口倒计时[T]、启动期状态 | memeverse/dao-governance.md §周期激励/§国库/§DAO 参数速查 |
| `/portfolio` 统一资产（含嵌入动线） | **极高** | ①创世质押铸造 uAsset（面值、预览、上限回滚、滑点线）②PSM 兑换（四池 1:1，费率，额度/储备/粉尘回滚）③CDP 赎回（等值 uAsset+授权，部分赎回）④USR 储蓄（三族金库，份额单价，利率 0 未激活态） | uAsset 三类余额及分布链[T]、抵押资产与实时价值[T]、仓位债务额[T]、铸出/赎回量预览[T]、铸币上限余量[T]、滑点线[T]、PSM 方向/费率/报价[T]、USR 份额与单价[T]、族利率与激活状态、授权状态、暂停/冻结状态 | outstake/staking-modes.md §面值铸造/§赎回仓位/§铸币上限；psm.md §四个兑换池/§兑换操作；usr.md §三个金库/§存取操作；router.md §创世通道/§仓位赎回/§交易前先预览；sy-adapters.md §支持哪些协议 |
| `/account` 钱包与智能账户 | 中（硬前置） | ①智能账户会话包裹（原子开→执行→关）②代付与记名分离（付款人≠受益人）③gas 与操作可用性准备 | 钱包地址与类型、会话状态、各链原生余额[T]、各代币余额[T]、付款人 vs 受益人地址、授权清单、暂停状态提示 | memeverse/hook.md §谁可以发起交易；yt-flash-swap.md §保护与安全；polend.md §两种付息方式；outstake/router.md §直通 Memeverse |

**密度天花板**：`/trade`、`/pol`、`/portfolio`（步骤 6 方向候选的统一真实片段取 `/pol`；步骤 9 密度轴以此为上限校准）。

## /portfolio 嵌入动线（OutStake 品牌对用户隐藏）

1. **uAsset 获取-创世质押（CDP 门）**：生息资产按实时价值面值铸造；预览为估算非保证；触上限整笔回滚；适配器汇率异常只冻结铸造不冻结赎回。字段：资产种类（wstETH/aToken/sUSDS/sUSDe/slisBNB/asBNB 矩阵）、数量[T]、面值铸出预览[T]、仓位两要素（抵押/债务）[T]、上限余量[T]、滑点线[T]、授权状态。（outstake/staking-modes.md §面值铸造/§三个"没有"；sy-adapters.md §支持哪些协议；router.md §交易前先预览）
2. **uAsset 获取-PSM 兑换**：四池（USDC/UUSD、USDT/UUSD、ETH/UETH、BNB/UBNB）面值 1:1；费率默认 ~0.1%（上限 1%）；报价=执行；额度用满/储备不足/粉尘整笔回滚；暂停期双向不可用。（outstake/psm.md §四个兑换池/§兑换操作）
3. **USR 储蓄**：三族金库（suETH/suUSD/suBNB）；份额单价按族利率增长；利率 0（未激活）存取照常不增值；预算不足增长自动暂停（本金/已累积不变）；警告「勿直接转账进金库地址」。（outstake/usr.md §三个金库/§存取操作/§钱安全吗）
4. **CDP 债务赎回（open-term，无锁定）**：投入等值 uAsset+扣取授权拿回抵押含生息；跨链 uAsset 须先桥回原链（受速率限制）；部分赎回剩余仓位存续；赎回资产按适配器「可赎出成」矩阵。（outstake/staking-modes.md §三个"没有"/§赎回仓位；router.md §仓位赎回；omnichain.md §速率限制）

## 冲突/口径附注（登记，以合约 spec 为准）

1. 费率去向三处口径（hook.md §费率怎么分 / memecoin-staking.md §收益从哪来 / four-pools.md §辅助池手续费的归属）描述不同层级费率流向，未显式对账 35% 协议份额如何汇入收益库/国库——前端展示「手续费去向」前须与合约 spec 确认。
2. uasset.md §锚定称 PSM 用「USDC、USDT、ETH、BNB 等」（"等"暗示开放），psm.md 明确且仅四池——按 psm.md 四池为准，配置留扩展位。
3. OutrunBook 无 EIP-7702 表述（智能账户仅举 Safe 例）；7702 相关以 architecture.md/合约仓为准，路由命名为架构层假设。
4. lifecycle.md §创世如何达标「三口径不相加」——前端不得把普通创世资金/杠杆利息/预购资金加总展示为达标进度。

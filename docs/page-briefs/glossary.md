# Glossary（定稿）— 合约术语 ↔ zh 用户文案 ↔ en 用户文案

> brief 的文案键一律引本表；不得新造同义词。语言基调（PD-06）：分层语气——verse 详情页交易台与 POL/Vault 标签允许交易台密度，其余页面消费化；专有词保留英文+中文解释（OB glossary.md:3 政策）。
> 机制词不上 UI：Kernel、会话（session）、open-term、PSM、CDP、SY、EwVWAP、Permit2（界面只说「授权」）、drawUAsset（已删除，勿用）。

## A. 资产与供给（能力呈现，品牌隐藏——决议 C8：全部动作表述）

| 合约/机制术语 | zh 用户文案 | en 用户文案 | 备注 |
|---|---|---|---|
| uAsset（UETH/UUSD/UBNB） | uAsset（锚定型代币：UETH 锚定 ETH、UUSD 锚定 USD、UBNB 锚定 BNB；全链流通） | uAsset (anchored: UETH/UUSD/UBNB) | OB-沿用 |
| 锚定 | 锚定：1 枚 uAsset 始终对应 1 单位底层资产价值。**限定语必带**：UETH/UBNB 随 ETH/BNB 价格波动，是 ETH/BNB 计价的稳定凭证，不是法币稳定币（uasset.md:13-15） | anchored 1:1; UETH/UBNB track ETH/BNB, not fiat | OB-沿用 |
| 面值兑换（PSM 门） | **直接参与**（面板路径名；uAsset 直付与面值直兑为一路径，支付资产下拉区分）/ 面值兑换（独立语境）：储备资产与 uAsset 1:1 双向兑换，即换即结清，无仓位无债务 | Direct (pay uAsset or reserve at par) / par swap (1:1, instant, no position) | 决议 007；费率=兑换费（双向各约 0.1%，可调上限 1%，以界面显示为准） |
| 创世质押（CDP 门） | **质押参与**（面板路径名，同资产可有多个生息来源）/ 创世质押（机制语境）：存入生息资产按面值铸出等值 uAsset，抵押继续生息，留仓位随时可赎 | Stake / genesis staking | 决议 007（「更通俗一点，stake」）；三无：无利息、无清算、无到期 |
| 赎回（redeem） | 赎回：按比例双腿销债取回抵押生息资产（全赎=归还等值 uAsset；部分赎回剩余仓位存续）。**唯一减借路径，无增借入口**（drawUAsset 已删除，SPEC-S2 accounting.md:50） | Redeem (proportional two-leg; only debt-reduction path) | 决议 007 |
| 仓位（CDP position） | 仓位：记录你抵押的生息资产与未偿 uAsset 债务；大白话口径「无到期、当前零利率（治理可调）、无清算、随时可赎、需主动操作」 | Position (no maturity, redeem anytime manually) | PD-09 |
| 储蓄（USR） | 储蓄：闲置 uAsset 存入金库生息，随存随取 | Savings | 决议 007；三金库 suETH/suUSD/suBNB |
| suToken | 储蓄份额（suETH/suUSD/suBNB），份额价格随币种利率增长 | Savings share (suETH/suUSD/suBNB) | 决议 007 |
| 币种利率（usrRate） | 币种利率：未激活时存取照常、份额不增值（界面明示激活状态） | Asset-family rate | 决议 007 |
| 铸币上限 / stockCap | 铸造上限 / 兑换额度上限（额度用满该方向暂停） | Mint cap / swap capacity | OB-沿用+并条 |

## B. Memeverse 生命周期

| 合约/机制术语 | zh 用户文案 | en 用户文案 | 备注 |
|---|---|---|---|
| Verse | Verse（一个 Memecoin 社区的完整运行单元：创世→锁定→解锁） | Verse | 决议 007 |
| 创世（Genesis） | 创世：Memecoin 启动的初始阶段，用 uAsset 参与 | Genesis | OB-沿用 |
| 杠杆创世（POLend） | 杠杆创世：付一笔利息放大创世份额；损失上限=利息、无清算、创世失败利息全额退 | Leverage genesis (max loss = interest) | OB-沿用；利率=一次性创世利息比例，**非年化** |
| 借贷资金/债务上限 | 借贷资金 = 利息 ÷ 利率（用户已产生的、已注入创世的杠杆资金）；每个 Memecoin 有债务上限 | Borrowed funds = interest ÷ rate; per-meme cap | UI 命名=借贷资金（OB 原词 debt quota 暗示未使用配额，与参与即发生的语义不符；机制口径仍 OB） |
| 预购（Preorder） | 预购：创世期内以固定低费率提前锁定 Memecoin，线性解锁 | Preorder | OB-沿用；**窗口=创世期间**（决议 007 用户纠正）；容量=(普通资金+杠杆债务本金)×70%×容量比例 |
| 创世分配（拆两笔） | 创世+预购：同一笔资金转 uAsset 后拆成创世份额与预购份额两笔 | Split into genesis + preorder | 决议 007 |
| 最低成功额度 | 最低成功额度：普通资金或杠杆利息任一独立达标即成功（预购与债务本金不计入） | Minimum success threshold | OB-沿用 |
| 快速创世（Fast Genesis） | Fast Genesis：任一门槛达标即可提前结束创世，无需等到截止时间 | Fast Genesis | UI 命名与创建表单标签一致；机制 OB-沿用 |
| 创世退款 | 创世退款：未达标时资金全额退给参与记录的受益人 | Genesis refund | OB-沿用 |
| 锁定期 | 锁定期：创世达标后流动性锁定 365 天（合约硬约束，任何一方无法抽走） | Lockup (365 days, on-chain enforced) | OB-沿用；归类 Memeverse 节（C3 修正） |
| 四池 / 主池 / 辅助池 | 四池：达标时建立的四个流动性池——主池（Memecoin/uAsset，主交易市场）+ 辅助池（POL/uAsset、PT/uAsset、PT/POL） | Four pools (main + auxiliary) | OB-沿用+并条 |
| 解锁（Unlocked） | 解锁：锁定期满；解锁与结算在**同一笔交易**内原子完成，失败整笔回滚、保持锁定可重试 | Unlock (atomic with settlement) | C9 口径 |
| 24 小时保护期 | 24 小时保护期。**长文案用 OB 原句**（genesis.md:37,58）：「普通创世让 uAsset 本金在四池组合中守恒，并以新铸造的 Memecoin、YT 和手续费提供额外上行；成功解锁后，在 24 小时流动性保护期内完成完整退出，即可按份额恢复 uAsset 本金。」**短标签**：「本金守恒 · 24 小时保护期内可完整退出」；边界说明（期后市场风险、六步退出流程）入展开区 | 24-hour protection window | C5 决议（OB 原句）；窗口起点=实际解锁交易时间；窗口内四池暂停公开交易 |
| 结算 | 结算：解锁时协议统一回收资金、偿还债务、分配剩余（与解锁一笔交易） | Settlement | C9 |

## C. POL/PT/YT

| 合约/机制术语 | zh 用户文案 | en 用户文案 | 备注 |
|---|---|---|---|
| POL | POL：锁定流动性的所有权凭证 | POL | OB-沿用 |
| PT | PT：本金代币（POL 拆分而来，按固定比例锚定 uAsset；结算后按该固定比例赎回——用户文案不强调「非 1:1」，易生新歧义） | PT (principal token) | OB-沿用锚定口径（pol-splitter.md:23）；赎回按固定锚定比例=合约口径（source-map 对账） |
| YT | YT：收益代币（POL 拆分而来；杠杆资产，结算后按份额领残值） | YT (yield token) | OB-沿用 |
| 拆分 / 合并（split/merge） | 拆分 / 合并：1 POL ⇄ 1 PT + 1 YT（仅锁定期内） | Split / merge | OB-沿用 |
| 创世积分（GenesisCredit） | 创世积分：可跨链参与凭证，用于抵扣杠杆创世利息（锁定时销毁） | Genesis Credit | OB-沿用；UI 词加空格，机制/合约名仍连写 |
| YT 闪电兑换（YT Flash Swap） | YT 闪电兑换：锁定期内用 POL 买卖 YT（复用 PT/POL 池）；买入=精确到量，非花光预算 | YT Flash Swap (exact-out) | OB-沿用 |
| 结算残值 | 结算残值：结算后按所付利息比例分给杠杆参与者 | Settlement residual | OB-沿用 |

## D. 交易与费率

| 合约/机制术语 | zh 用户文案 | en 用户文案 | 备注 |
|---|---|---|---|
| 动态费率 | 动态费率：让价格回归均衡的交易付基础费；制造波动的交易按冲击累积加费 | Dynamic fee | OB-沿用；verse 详情页交易台允许交易台密度表述 |
| 开池衰减费 | 开池期费率：默认 50% 起、15 分钟内衰减到 1% | Opening fee decay | OB-沿用 |
| 授权（Permit2/approve） | 授权（界面只说「授权」或「授权扣取」） | Approve | 决议 007（Permit2 不上 UI） |
| 推荐返佣 | 推荐返佣：LP 费 65/35（有推荐人 65/25/10） | Referral share | OB-沿用 |
| 执行者奖励 | 执行奖励：任何人触发手续费分发，获主池 uAsset 费的 0.25%（当前默认） | Executor reward | OB-沿用 |
| 滑点保护 | 最低到账数量 + 截止时间（未设会被拒绝；报价≠保证成交） | Slippage protection | OB-沿用 |

## E. Staking 与治理

| 合约/机制术语 | zh 用户文案 | en 用户文案 | 备注 |
|---|---|---|---|
| 质押（Memecoin Staking） | 质押：把 Memecoin 存入收益库，赚持续收益 | Memecoin staking | OB-沿用 |
| 收益库（YieldVault） | 收益库：存入即时；赎回分两步——先申请，约 1 天后回来自助执行到账；≤5 笔待执行；申请即固定价值、票权消失 | Yield vault (async redemption) | OB-沿用 |
| 委托 | 委托：份额投票权委托给自己或代表（未委托=无票权，仍计入基数） | Delegation | OB-沿用 |
| 治理链 | 治理链：该 Memecoin 的质押、收益分配、DAO 投票所在链 | Governance chain | OB-沿用 |
| 周期激励 | 周期激励：周期结束需有人触发结算划拨（默认国库入账 25%）；窗口内主动领取，逾期并入国库不补发；**UI 读链显示真实周期值、文案不硬编码**（CYCLE_DURATION=合约常量、v1 固定 90 天，非部署参数——决议 007） | Epoch incentives (triggered, claim-windowed; length read on-chain) | PD-09/C4 |
| 超级多数/法定人数/启动期 | 超级多数 / 法定人数 / 启动期（部署后一段时期不能提案） | Supermajority / quorum / bootstrap | OB-沿用 |

## F. 跨链与账户

| 合约/机制术语 | zh 用户文案 | en 用户文案 | 备注 |
|---|---|---|---|
| 跨链三阶段 | 发送 / 到账 / 落位——三件事各自成败，不能混谈；份额到账才算质押生效 | Send / deliver / settle | OB-沿用；详情承载于交易中心（PD-10） |
| 速率限制 | 速率限制：短期异常大额暂卡（资金不丢）；已发出的仍会到账 | Rate limit | OB-沿用 |
| 尾数留存 | 跨链按 6 位小数传递，超出部分留在源链 | 6-decimal precision | OB-沿用 |
| 智能账户（EIP-7702） | 智能账户：在你自己的钱包地址上启用执行能力，不建新账户、不迁资产；每条链独立启用/替换/撤销 | Smart account (enable on your own address, per chain) | 决议 007 |
| 份额（消歧） | 三处「份额」必带限定词：**储蓄份额 / 收益库份额 / 创世份额** | savings / vault / genesis share | 决议 007 |

## 用词规则（全站强制）

1. 「到期」仅用于锁定期/预购窗口语境；CDP 仓位永远「无到期、随时可赎」（C7）。
2. 「无风险/本金守恒」短标签必须配 C5 定稿长文案入口；不得裸用 audience.md 省略版（C5）。
3. OutStake 品牌词不上 UI；全部动作/能力表述（C8）。
4. 「面值」用于兑换语境；退出保护期语境用「按份额恢复本金」（C5 讨论结论）。
5. 交易台密度词（滑点/费率/份额/深度）限 verse 详情页交易台、POL/Vault 标签及交易确认卡；其他页面用对应白话（PD-06）。

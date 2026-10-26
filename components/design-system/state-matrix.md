# 状态矩阵

> 路径以决议 014 后的现役路由为准（bridge/account 蓝图路由已作废；verse 子功能=详情页 tab）。（Stage-01 步骤 11 · 页面 brief 直接引用）

> 覆盖 architecture.md §1（原型全状态）、§6.2（账户九态）、§7（交易十一态）、§10（边界状态）、§11.2（测试矩阵账户态）、§15（模块完成状态）。页面 brief（阶段 2）按「路由 × 状态」引用本矩阵编号，不重复定义。
> 视觉语言全部走 tokens.css；文案消费化（决议 001-A）。

## 1. 连接与账户状态（§1 + §11.2）

| # | 状态 | 呈现要点 | 载体组件 |
|---|---|---|---|
| A1 | 未连接 Disconnected | 只读可浏览（任意查看链）；CTA `Connect wallet`；无自动弹窗 | account-menu / account-dialog |
| A2 | 连接中 Connecting | 钱包列表弹层+选中 spinner | account-menu / account-dialog |
| A3 | 普通外部 EOA | `Standard wallet`+升级引导（交易前一次性）；能力提示非阻断 | account-menu / account-dialog |
| A4 | Privy embedded EOA | 同 A3 语义，来源标注 `Outrun wallet`（命名走 §2 术语） | account-menu / account-dialog |
| A5 | 智能账户启用中（Authorization requested/signed、Delegation pending） | 步骤化文案+钱包内签名指引；期间 Swap 禁用原因显示 | account-menu / account-dialog |
| A6 | 已启用 Kernel delegated | `Smart account ready`+逐链徽章；交易中心走 Type-4 流程 | account-menu / account-dialog + tx-status |
| A7 | Unsupported delegation | 黄警示+`Replace to trade`；不提供继续入口（§14） | account-menu / account-dialog |
| A8 | 错误网络 | 触发器警示+网络对照说明+切换确认 | chain-selector-dialog |
| A9 | 替换/撤销委托中 | 步骤化状态+旧新实现对照 | account-menu / account-dialog |

## 2. 交易与签名流程（§1 + §7）

| # | 状态 | 呈现要点 |
|---|---|---|
| T1 | Preparing / Preflighting | 交易中心步骤 1-2；可取消 |
| T2 | Awaiting authorization（7702 授权签名） | 钱包指引文案；首启含授权含义说明（§14：目标实现/链/权限） |
| T3 | Simulating Type-4 transaction | 禁用提交；失败→解码错误+恢复（调参/重试/取消），禁止发送（§7） |
| T4 | Awaiting transaction signature | 明确与 T2 区分（两步签名各自可见） |
| T5 | Submitted / Confirming | hash+浏览器链接+gas；Pending>2min 提示（§13） |
| T6 | Confirmed | 回声确认 moment+结果摘要 |
| T7 | Reverted | 错误解码+恢复动作；明确「Swap 失败≠账户未启用」（§6.3） |
| T8 | Replaced / Cancelled | 终态说明+去向 |
| T9 | User rejected（拒签） | 非错误语气：「Request cancelled in your wallet」+重试入口 |
| T10 | 跨链 Message pending | 源链已确认+目标链未完成的双段状态；不重复发起（§7） |
| T11 | gas 不足 | 签名前阻断（§6.4）+原生币补充入口 |

## 3. 数据与页面状态（§1 + §10 + §15）

| # | 状态 | 呈现要点 |
|---|---|---|
| D1 | Loading | 骨架（保持结构）+ `aria-live` 宣布 |
| D2 | Empty（零余额/零仓位/无数据） | EmptyState 组件+行动引导 |
| D3 | Error（RPC 故障） | 内联错误+`Retry`；不吞错 |
| D4 | Paused（协议暂停） | 黄横幅（受影响操作禁用+原因）+只读不受影响 |
| D5 | Undeployed（未部署） | 结构化 `Not available on this chain yet`（禁零地址/占位地址，§5） |
| D6 | Index lag（subgraph 索引滞后） | 历史类区块空态 `Syncing — history unavailable in this snapshot`（唯一现役位=蜡烛图空态）；聚合数字由数据层等索引追平后收敛（写后刷新管线），界面不做「以链上读值为准」类提示 |
| D7 | 成功/失败终态（页面级） | 结果区+后续动作 |
| D8 | 测试网模式 | 持续可见测试网标识（§5） |

## 4. 路由 × 状态适用表（阶段 2 页面 brief 引用锚）

| 路由 | 必测状态集 |
|---|---|
| `/` | A1/A3/A6 · D1/D2/D3 · D8 |
| `/memeverse/explore` | A1 · D1/D2/D3/D6 · 搜索空结果 |
| `/memeverse/launch` | 表单校验态 · T2/T3 · D4（暂停期创建禁用） |
| `/memeverse/[verseId]` | VerseStage 四态 · 领取矩阵 · A6 前置 · D4/D5 |
| `/memeverse/[verseId]`（liquidity tab） | T 全集（动态费率分解）· A3 升级引导 · D5 |
| `/memeverse/[verseId]`（pol tab） | T2/T3/T4（会话包裹）· 密度 T1 局部 · D2/D6 |
| `/memeverse/[verseId]`（vault tab） | 异步两步赎回状态 · 委托状态 · 上限 5 笔提示 |
| `/memeverse/[verseId]`（dao tab） | 提案四态 · 领取窗口倒计时 · 启动期禁提 |
| `/portfolio` | 嵌入动线四线（铸造/PSM/USR/赎回）各自状态 · 跨链 BridgeDialog 发起/在途 · D2/D4/D6 · 密度 T1 局部 |
| `/referral` | A1 · D2（无推荐记录/无待领） · 逐币种待领领取 T2/T3 · 链接生成/复制反馈 |
| `/faucet` | A1 · D2（无可领） · 冷却中态（ClaimTooSoon 行内） · batchClaim 原子失败回滚 · UUSD 兑换（PSM quote 态） · D8 |

## 5. 状态文案规范（决议 001-A）

- 主动语态、动作命名贯穿流程（Publish→Published）；错误=发生了什么+怎么恢复，不道歉不含糊。
- 状态标签双语单语渲染（zh/en 各自完整），默认 en。
- 数字/时间/地址在状态中同样 data-numeric。

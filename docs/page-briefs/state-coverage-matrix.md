# State Coverage Matrix — 全状态 × 承载面交叉证明

> 图例：●=rendered-here（本页渲染可见布局）；○=delegated（全局面承载，本页可触发，括注承载面）；–=N/A。
> 每个状态至少一个 ● 或承载它的 ○；验收抽查建议行加粗（Wrong network/Kernel delegated/Index lag/User rejected）。
> 列=`/[verseId]` 含单页四标签（交易台/Liquidity/POL/Vault/DAO）。

## 矩阵

| 状态 | / | /memeverse/explore | /memeverse/launch | /memeverse/[verseId] | /portfolio | /referral | /faucet | GS |
|---|---|---|---|---|---|---|---|---|
| A1 Disconnected | ● | ● | ● | ● | ● | ● | ● | ●(GS-3) |
| A2 Connecting | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ●(GS-3) |
| **A3 Wrong network** | – | – | ● | ● | ● | ● | ● | ●(GS-1/2) |
| A4 Connected EOA | – | – | ○ | ●（三分支行内引导） | ●（EF 首次写） | ○ | ○ | ○ |
| A5 Smart enabling（GS-4 主承载；九态展开=架构层子机，账户面待实装） | – | – | ○ | ○ | ○ | ○ | ○ | ●(GS-4) |
| **A6 Kernel delegated** | – | ○ | ○ | ○ | ○ | ○ | ○ | ○（各写操作行内状态） |
| A7 Authorization | – | – | ○ | ○ | ○ | ○ | ○ | ●(GS-4) |
| A8–A12 交易状态 | – | – | ○ | ○ | ○ | ○ | ○ | ●(GS-4) |
| A13 Loading… | ● | ● | ● | ● | ● | ● | ● | ○ |
| A14 Empty | ● | ● | – | ● | ● | ●（无推荐记录空态） | ●（无可领） | – |
| A15 Error | ● | ● | ● | ● | ● | ● | ● | ○ |
| B1 Paused | – | – | – | ● | ● | – | ●（PSM 暂停传导） | – |
| B2 Undeployed | – | ●（过滤项禁用） | ●（链不可选） | ● | ● | ○ | ● | ●(GS-2) |
| **B3 Index lag >120s** | ●（指标「同步中」） | ● | ●（注册状态查询降级） | ● | ● | ○（流水 Graph 降级） | – | ○ |
| B4 User rejected | – | – | ● | ● | ● | ● | ● | ●(GS-4 草稿) |
| C1 External EOA | – | – | ○ | ○ | ○ | ○ | ○ | ●(GS-3) |
| C2 Embedded EOA | – | – | ○ | ○ | ○ | ○ | ○ | ●(GS-3) |
| C3 Unsupported delegation | – | – | ○ | ○（A4 语境三分支：先替换行内引导） | ○ | ○ | ○ | – |

无冲突检查：同一状态跨页语义一致（A3=禁写+切换引导；B3=标「同步中」且余额/授权/回执恒 RPC；B4=草稿保留；环境切换清空——GS-1 规则优先，见 global-interactions GS-4 草稿纪律）；A5 九态展开为架构层词汇（state-catalog §D），页面用 A 系规范名——词汇同源无漂移。

## 验收抽查行（可观察动作→期望结果）

- **A3 Wrong network**：verse 详情页持错链点「参与」→ 按钮禁用+原因说明+切换引导；期望：无签名请求发出。
- **A6 Kernel delegated**：已启用链发起写操作 → 行内已启用状态、不再请求 authorization；期望：交易直接走 Type-4。
- **B3 Index lag >120s**：/portfolio 断 Graph 或落后>120s → 聚合区标「同步中」，余额/待办（RPC）照常显示且数值不变；期望：无陈旧索引判定成功的路径。
- **B4 User rejected**：/memeverse/launch 提交时拒签 → 回表单，已填字段保留；期望：无错误弹窗定性为失败（拒签非错误）。

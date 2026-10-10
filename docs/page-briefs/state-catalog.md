# State Catalog — 全状态目录（唯一状态词汇源）

> brief 禁止发明同义词或在其他文件重定义状态；所有页面 brief 引用本目录的规范名。
> 来源（architecture.md）：§1 L27（15 态）、§6.2 L246-256（账户九态子机）、§10 L395 + L382/L475（4 态）、§11.2 L410（3 账户形态）。

## 使用规则（每个 brief 必须遵守）

每页对下列**每个**状态标两值之一：

- `rendered-here`：本页渲染该状态的可见布局（**必须跟括号布局说明**，哪怕五个字）
- `delegated`：由全局交互面承载（写明哪个面，如 GS-4 交易中心）
- 不适用写 `N/A(原因)`

只读页不渲染不适用的交易状态，但必须链接到全局交易中心/账户面的对应证据（brief 中写明链接目标）。

## A. 页面级全局状态（§1，15 态）

| # | 规范名 | 语义（用户可见结果） | 恢复动作 | aria-live | 主要承载面 |
|---|---|---|---|---|---|
| A1 | `Disconnected` | 未连接钱包；只读内容可见，写操作入口引导连接 | 点击「连接钱包」→ 钱包选择器（GS） | polite（状态条） | 全局（钱包选择器）+ 各页 |
| A2 | `Connecting` | 连接中过渡态；不得重复触发弹窗 | 自动完成或失败落 A1/Error；无用户动作 | polite | 钱包选择器 |
| A3 | `Wrong network`（与 B2 叠加时 **B2 优先**：先引导到已部署链，再对齐钱包链） | 当前查看链与钱包链不一致；**禁写**（写操作禁用并说明原因） | 用户切换钱包链或切换查看链（GS 查看链选择器） | assertive | 全局（各页写操作处） |
| A4 | `Connected EOA` | 钱包已连接但本链未启用智能账户 | 发起 EIP-7702 启用（首次写操作前行内引导） | polite | 首次写操作（行内引导） |
| A5 | `Smart account enabling` | 智能账户启用流程中（对应 §6.2 Authorization requested/signed、Delegation pending） | 完成签名→待上链确认；失败给出重试与原因 | assertive（进行中提示） | 交易中心 |
| A6 | `Kernel delegated` | 本链已启用智能账户（Kernel V3.3）；写操作走 Type-4 | 无需恢复；可替换/撤销（账户面，待实装） | polite | 各写操作（行内状态） |
| A7 | `Authorization` | EIP-7702 authorization 签名请求呈现（外部钱包弹窗或 Privy embedded signer） | 用户签署/拒绝；拒绝→`User rejected` | assertive | 交易中心（前置步骤） |
| A8 | `Signing` | 交易待签名（钱包内） | 用户签署/拒绝 | assertive | 交易中心 |
| A9 | `Submitting` | 已签名、广播提交中 | 自动流转；长时间无回执→重试查询入口 | polite | 交易中心 |
| A10 | `Confirming` | 链上确认中（含跨链源链确认，见 D8 之前不得称完成） | 自动流转；可查看交易详情 | polite | 交易中心 |
| A11 | `Success` | 操作成功；跨链操作=目标链最终事件后（区分源链回执） | 关闭/查看详情/回到发起页出口 | polite | 交易中心 + 发起页 toast |
| A12 | `Failure` | 操作失败；展示解码后的错误与原因 | 按错误模型给出的恢复动作（重试/调整参数/反馈） | assertive | 交易中心 + 发起页 |
| A13 | `Loading…` | 数据/页面加载中（骨架或占位，不假造数据） | 自动完成；超时→Error+重试 | polite | 各页 |
| A14 | `Empty` | 数据为空（零余额/零仓位/零列表）；给行动指引而非空白 | 页面给出下一步动作（如「浏览 Verse」） | polite | 各页 |
| A15 | `Error` | 数据/页面错误（RPC 故障等）；说明出了什么问题 | 重试/切换 RPC 入口/反馈 | assertive | 各页 |

## B. 业务边界状态（§10/§15，4 态）

| # | 规范名 | 语义 | 恢复动作 | aria-live |
|---|---|---|---|---|
| B1 | `Paused` | 目标池/模块暂停（合约暂停位）；写操作禁用并说明 | 等待恢复；可查看只读信息 | assertive（进入页面时） |
| B2 | `Undeployed` | 目标合约在当前链未部署（结构化 `undeployed`，禁零地址/占位符，architecture §8 L200） | 引导切换到已部署链或提示不可用 | assertive |
| B3 | `Index lag >120s` | Graph 索引落后超过 120 秒；静默降级（聚合历史数据稍旧，无用户可见状态——§9/§24 勘误口径） | **余额/授权/回执仍以 RPC 为准**（§9/§16）；自动重查 | –（无用户可见面） |
| B4 | `User rejected` | 用户在钱包拒签/拒绝 authorization；非错误，回发起页 | 回到发起步骤保留草稿参数（除非切换环境清空） | polite |

## C. 账户形态（§11.2 浏览器测试矩阵，3 形态）

> 形态是测试与展示维度的账户来源标注，与 §6.2 状态机正交。

| # | 规范名 | 语义 | 备注 |
|---|---|---|---|
| C1 | `External EOA` | 外部钱包 EOA（MetaMask 等）；authorization 由钱包 provider 签 | 能力不满足→保留读取+提示升级钱包（§6.2 L242） |
| C2 | `Embedded EOA` | Privy embedded EOA；Privy signer 完成签名；用户主动选择的独立账户入口 | L240/L242 |
| C3 | `Unsupported delegation` | code `0xef0100` 开头但 implementation 不匹配；须先替换 delegation | §6.2 L253/L291；只读保留 |

## D. 账户九态子机（§6.2 L246-256，逐字；架构层状态模型）

`Disconnected → Connected EOA → Authorization requested → Authorization signed → Delegation pending → Kernel delegated`；异常分支：`Unsupported delegation`、`Delegation replacement pending`、`Delegation revoked`。

- `A5 Smart account enabling` 展开为 `Authorization requested/signed + Delegation pending` 三步；`A7 Authorization` 对应签名请求呈现。账户九态语境用子机名，其他页用 A 系规范名。
- 当前无独立账户页：A4/A5/A6 由首次写操作行内引导与交易中心承载；逐链 delegation 矩阵、实现地址、codehash、撤销/替换入口属账户面（待实装）。
- UI 不得把「Swap 失败」解释为「智能账户未启用」（授权生效与执行失败独立，L273）。

## 与视觉/组件层的关系

- `components/design-system/state-matrix.md` 的路由×状态适用表继续有效（视觉/组件层）；本目录是 brief 的**词汇与语义**唯一源；两者状态名一致，冲突时以本目录+architecture 原文为准。
- 跨页可观察性由 `state-coverage-matrix.md` 统一证明（每个状态至少一个可观察承载面）。

# Brief：全局交互面（GS-01，非 URL 路由）

- routes.json ID：GS-01；决议 007（PD-10 跨链详情归交易中心；通知中心 v1 延后）
- 依据：architecture §2（修订后全局面句）/§5（链集/测试网）/§6（钱包）/§7（交易状态）/§9；product-intent.md §3

## 面板清单与规范

### GS-1 主网/测试网模式（未实装规划项）

- 切换控件不在线上：现行链选择器（GS-2）固定列**部署链集**（按 `deployments/*.json` 动态，不写死；当前=三测试链），测试网标识持续显示（§5）
- 规划口径保留：生产域名默认只显示三条主网，测试网由显式模式开启；**切换清空当前交易草稿与目标链，禁止跨环境复用签名或报价**（L196）
- 状态：独立于钱包链（与 A3 Wrong network 联动呈现）

### GS-2 链选择器（钱包链切换）

- 链集=deployments 动态读取（不写死，当前=三测试链）；切换=仅切钱包链，不写 URL、不切数据源（2026-09-24 用户裁定，登记于 component-contract.md；选择器读写账户中心 `chainId`）；discovery 的 `?chain=` 过滤归该页自有下拉，与本选择器独立；跨链操作（Portfolio BridgeDialog）源/目标链独立于本选择器
- 未部署内容（B2）在选择器中禁用+说明

### GS-3 钱包选择器

- Privy 登录/连接/linked wallets/活动钱包选择（§6.2 L240）；External/Embedded EOA 形态（§11.2）；能力检测（§6.2 L242：不足→保留读取+升级提示）
- 承载 A1/A2 及连接错误态

### GS-4 交易中心

- **交易状态统一承载=各流程动作弹窗（ActionDialogShell）+ 三步状态条 TxStatus**（无独立交易中心面板；A7–A12；A5 智能账户启用中展开视图以动作弹窗为主承载）：报价冻结→确认→签名→提交→确认→成功/失败；**签名前显示预计 gas（EIP-1559 三档 slow/market/fast，Chainlink nativeUsdFeed 估价）、原生币余额与不足补充入口；余额不足禁止请求 authorization 与签名**（§6.4 L283）
- 交易卡类型（UI 名）：批量交易（机制：Kernel batch）/ 首次启用+交易（机制：Type-4 带授权列表）/ 跨链发送 / **直签单笔（EOA 免审阅直发钱包——`routeWrite` 按钱包分派：内嵌钱包 Kernel type-4、外部钱包 EIP-5792 `wallet_sendCalls`）**。跨链卡内嵌阶段组件，**按交易类型区分**：纯转账（uAsset/创世积分）=两阶段（发送→到账）；质押类跨链=三阶段（发送→到账→落位，落位=份额到账）——PD-10；「查看消息详情」=GS-5 跨链消息详情
- 错误模型：嵌套 revert 统一解码到恢复动作（§6.3 L279）；「Swap 失败≠智能账户未启用」（L273）
- 草稿纪律：环境切换清空草稿（决议 GS-1）；拒签保留表单草稿（B4）

### GS-5 跨链消息详情（承载于 GS-4）

- 跨链阶段组件规范（与 Portfolio BridgeDialog 同源复用）：纯转账两阶段/质押类三阶段（见 GS-4）；各阶段独立成败；滞留态=「已发出未到账，资金不丢」+恢复路径按类型：纯转账=LayerZero 消息重试（自动推进，无 compose 帧、不适用 settlePendingCompose——interoperation-details.md:56,93）+「请求重试」手动入口（stored payload 的 retry 交易由用户付费发起——实装细节随 ABI 冻结）；质押类=手动恢复（settlePendingCompose，接收人可调——SPEC-M11 §4.3）

### GS-6 通知中心（**v1 延后**——决议 007）

- v1 不实现：待办提醒由 Portfolio ①可行动区 + 操作完成 toast 承接；架构条目保留，后续版本再评估（铃铛+列表形态）

### GS-7 中英文切换

- `/{locale}` 路径切换（zh/en，默认 en）；切换保留当前页面路径与查询参数；语言状态进 URL 非 cookie（可分享）；切换后整页单语渲染（决议 001-A/001-B）

> GS-4 状态流转已接 useTxCenter 真实写路径（Kernel type-4 直签 + EIP-1559 gas 三档 + 免审阅直发）；独立「交易中心」面板形态未实装。

## 状态承载汇总

A1/A2→GS-3；A3→GS-1/GS-2 联动各页写操作；A7–A12→GS-4；跨链三阶段→GS-5；B4→GS-4 草稿纪律。各页面 rendered-here 状态见各 brief §6；交叉可观察性由 [state-coverage-matrix.md](state-coverage-matrix.md) 统一证明。

## fixture 场景

`normal`/`tx-failure`/`user-rejected`/`wrong-network`；交易全状态推进与卡型样本见 `fixtures/data/transactions.json`（tx-001~007 含 type4 与跨链卡）；gas 不足拦截=GS-4 签名前规则（实装验证）；环境切换清空草稿/locale 切换保路径=GS-1/GS-7 行为规则（e2e 断言）。

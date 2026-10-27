# 领域组件契约（Stage-01 步骤 11 · 阶段 2/3 复用）

> ⚠️ 决议 005：本文所有**示例界面内容**（POL 字段、版面）仅为视觉演示，不代表产品 UI/UX；**可继承的是行为契约**（状态集/键盘/aria/文案规则/数字规则）。
> 约束：本契约只定义行为与状态，不接业务合约、不建 React 应用、不新增依赖。视觉全部引用 `components/design-system/tokens.css`（契约见 token-contract.md）。文案遵循决议 001-A（消费化语言，无极客符号；机制词按 §2 术语表）。
> 通用状态集（每个组件按适用子集实现）：default / hover / focus / active / disabled / loading / error / empty。
> 通用规则：数字字段一律 `[data-numeric]`（等宽+tabular-nums）；focus=青 2px 外环全站唯一；图标=lucide 体系命名；reduced-motion 见 motion-and-a11y.md。
> 输出收账框 a11y（field-head 标签+只读 output 行，§17-§26 通用）：field 容器 `role="group"`+`aria-labelledby`（React `useId`），head 标签 span 挂同 id；各 `<output>` 带组合 `aria-label`（字段标签文案+代币符号，同输入框组合式先例）——2026-10-03 模式补全（此前标签与数值行无程序化关联，读屏快捷导航/变更播报无名）；pol-split-merge 无输出区、pol-redeem-lp 走 dl dt/dd 语义，均不适用。正向断言层=`e2e/dialog-a11y.spec.ts`（2026-10-03 用户裁定开弹窗：locked /memeverse/2 覆盖池卡 Add/Remove+Mint/Flash Swap、unlocked /memeverse/3 覆盖 Mint/Redeem PT/YT+swap 卡页面级；断言取 DOM 自身组词不钉 copy）。

## 1. AmountInput（金额输入）

| 方面 | 契约 |
|---|---|
| 用途 | 任意代币金额输入（Swap/铸造/PSM/储蓄/赎回/质押） |
| 结构 | 标签 + 输入框（data-numeric）+ 余额行（`Balance: 12.4 USDC` + `Max` 按钮）+ 法币参考值（可选）。exact 链上余额的余额行=共享分档 `fmtTokenAmountExact`（`components/global/amount-format.ts`，2026-10-27 接入既有 Uniswap 口径——大数千分位两位小数，与派生金额行同档；源核实 Uniswap interface `tokenTxFormatter`）；输入框 Max 预填=全精度整串（Uniswap `toExact` 同款，2026-10-27 源核实 `CurrencyInputPanel.tsx`，门自愈不依赖显示截断） |
| 键盘 | 数字/小数点/退格；粘贴净化（去逗号空格）；↑↓ 步进 0.1；非法字符静默拒绝；多小数点折叠为首个点（共享实现 `sanitizeAmount`，`components/global/amount-input.ts`，2026-10-03 全部金额输入统一）；余额预填/Max 填充：exact 链上读数在位=`formatUnits`+`trimFractionZeros` 全精度整串，float 样本回退=`amountToInputString`（6 位精度**截断**整串——2026-10-27 由 `toFixed` 四舍五入改截尾，进位会让 Max 预填值高于真实余额、触发自身报错；禁裸 `String()`——小值科学计数法会被清洗错切） |
| 状态 | default；focus（青环）；disabled（来源资产未选）；error（超出余额/低于最小精度/dust 域）——余额不足错误文案=`Insufficient balance.`/`余额不足。`（`common.insufficientBalance`；2026-10-04 用户裁定：一行短句不带数值插值，废止旧例「Amount exceeds your balance」+`Use max` 恢复链接式），展示=字段行下 `FieldError`（role=alert / text-destructive，复用既有组件零新 CSS）+ 输入 `aria-invalid` 红边与 `aria-describedby` 关联；触发=balance 已知且 parsed>balance——2026-10-27 起优先 exact base 单位比较（`toBaseUnits(输入串, decimals)`>链上 raw wei，`trade-balances` exact 腿在位时；float64 表征余额有舍入面，禁止拿它当门），float 比较仅剩 fixture 样本回退与派生估值腿（余额 null 槽位态不触发；MAX 填入=余额即自愈清错）；多条约束（如 CDP 赎回 ≤debt+≤balance）错误行只报一条，其余上限保持静默门控 |
| 校验边界 | dust 域（PSM quote 返 0 不可执行、粉尘整笔回滚）→ 提示「Amount too small to convert」并禁用提交 |
| 大数边界 | 输入 `maxLength=40`（共享常量 `AMOUNT_MAX_CHARS`，与 `sanitizeAmount` 同居 `components/global/amount-input.ts`，2026-10-03 全部金额输入统一；float64 有效数字 ~17 位已覆盖）；派生金额/法币值绝对值分层降级（2026-10-27 改 Uniswap 数字规范口径，用户裁定「模仿 uniswap」）——0 显 `0`、(0,1e-5) 显 `<0.00001`（显示下限 `TOKEN_AMOUNT_DISPLAY_FLOOR`）、<1e4 六位有效数字裁尾零（`1,234.57`/`0.000123457`；Intl 设有效位后小数位约束失效，勿再设 `minimumFractionDigits`）、<1e15 千分位两位小数（交易金额不紧凑）、≥1e15 en-US 紧凑档（K/M/B/T 国际符号，zh 不再出万亿，同 `formatMarketCap` 口径）、≥1e21 科学记法（`4.36E40`），全展开千分位长串与裸 `toFixed` 科学计数法禁止进卡面；CSS 兜底截断省略加于纯数值槽位 `__output`/`__field-usd`/`__details dd`（2026-10-26 修订：详情行 dd 原先「不许截、靠格式化分层保界」——但 1e15 紧凑档以下的 toFixed(6) 串最长 24 位，在 ~225–360px 卡面内仍把 auto 网格轨道最小值顶爆卡面（swap 窄幅挤压静息爆卡、长数跨 1e15 档闪爆后自回落），dd 值槽一律 `min-inline-size:0`+尾部省略，格式化分层只保「不出现全展开千分位长串」）——共享实现 `fmtUsd`/`fmtTokenAmount`（`components/global/amount-format.ts`，2026-10-03 由 swap-panel/pol-mint/pool-add/pool-remove/pol-flash 五处逐份复制收敛为唯一实现）；代币单价（token-strip 价格；蜡烛图图例 OHLC/MA——2026-10-08 决议 019 扩域）走同文件 `fmtPrice` 市场口径——≥1 两位小数、<1 六位有效数字裁尾零、前导零 ≥4 下标记零（0.0000042→`0.0₅42`，下标=前导零总数；决议 019，取代 2026-09-23 固定 6 位小数+尾零灰显——固定小数位在极小价会吃有效位）。2026-09-23 demo 参照页 180 位数字溢出教训 |
| 图标 | 无（纯输入）；单位随 AssetSelector 联动 |
| aria | `aria-invalid` 于错误；错误文本 `aria-describedby` 关联。2026-10-04 余额不足校验全站落位：swap 卖出框、flash-swap（卖=超 YT 持仓、买=派生支付腿超 uAsset 余额）、pool-add 两腿、pool-remove LP、redeem-lp、mint 两腿、split-merge（merge 双输入共享 amount → 错误行只挂 YT 框后一处、两输入同标 aria）、redeem-pt-yt、vault stake/redeem、portfolio `AmountField`（bridge/PSM/CDP 赎回/USR 存取共用一处）、participation-panel 主金额+一键预购两字段（该面板有真实提交流，表单 onSubmit 门控同步并入；预购容量/杠杆额度等既有上限类错误优先显示、余额错误仅在其未命中时出，单错误行）；唯一非恒禁用 CTA（PSM Convert）门控并入该谓词。弹窗内余额错误 id 同走 useId（pool-add/pool-remove 每池卡一实例、redeem-pt-yt 每模式一实例，口径=§17 设置层 error id 防相撞；2026-10-08 由静态串统一改 useId；swap-panel/vault-actions/participation-panel 页面级单实例、id 结构唯一，保留语义静态 id） |

## 2. AssetSelector（资产选择）

| 方面 | 契约 |
|---|---|
| 用途 | 代币选择（uAsset 族/SY/Memecoin/POL/PT/YT/suToken） |
| 结构 | 触发按钮（图标+符号+余额）→ 弹出列表（搜索框+分组：常用/全部） |
| 键盘 | Enter/Space 开合；↑↓ 移动；Enter 选中；Esc 关闭；Tab 离开即关 |
| 状态 | default/hover/focus/disabled（无可选资产→EmptyState 内嵌）；loading（余额刷新，行内 spinner+骨架） |
| 数据规则 | 每行：图标+符号+名称+余额（data-numeric）；不可用资产（暂停/未部署）禁用并标注原因徽章 |
| aria | `role="listbox"` + `aria-activedescendant`；触发器 `aria-expanded` |

首个落地：Swap 卡双侧选择（§25）——受限集合变体（无「常用/全部」分组、↑↓ 走 DOM 焦点而非 activedescendant）；全量版（含分组/loading）待后续资产选择场景落地时补。

## 3. ChainSelector（链选择）

| 方面 | 契约 |
|---|---|
| 用途 | 查看链（未连接可用）与钱包链切换（写操作时） |
| 结构 | 触发器（链图标+短名+测试网徽章）→ 列表（六链分组：主网/测试网） |
| 行为 | 查看链=纯 UI 状态；切钱包链=点击确认后才发 `wallet_switchEthereumChain`，不自动切换（§5）；主网↔测试网切换清空交易草稿与目标链（§5）——需确认对话 |
| 状态 | default/hover/focus；当前链标 `Current`；错误网络=触发器黄色警示态+提示 |
| aria | 同 listbox 模式；测试网徽章文本化（非纯色块） |

## 4. TokenPair（代币对展示）

| 方面 | 契约 |
|---|---|
| 用途 | 交易对/池标识（如 SOLSTICE/UUSD、PT-SEP26/UUSD） |
| 结构 | 双图标叠加 + `AAA/BBB` + 可选期限徽章（`SEP-26`） |
| 状态 | default/hover（下划线）/focus；期限到期倒计时徽章（data-numeric，<72h 变 warning 色） |
| 规则 | 徽章用自然语言（`Ends in 2d 4h` / `2 天 4 小时后截止`），非极客缩写 |

## 5. VerseStage（生命周期阶段）

| 方面 | 契约 |
|---|---|
| 用途 | Verse 四阶段状态呈现（Genesis/Locked/Refund/Unlocked；参照 letsbonk 迁移横幅+four.meme 阶段指示器证据 PU-002d/PU-003t） |
| 结构 | 横向四节点指示器（当前阶段高亮黄）+ 阶段徽章 + 关键量化行（达标进度**双门槛独立**——普通创世资金/杠杆利息两门槛各自判定、预购资金不计入，三口径不相加、禁止单进度条合并） |
| 状态 | 每阶段=default；当前=黄高亮+描述文案；可结束创世时显示 `End Genesis` 按钮（需交易触发，lifecycle；触发后创世必然结束——达标→Locked、未达标→Refund）+ 倒计时（data-numeric） |
| 提示 | 阶段切换确认动效=回声确认（唯一品牌 moment）；reduced-motion=静态双描边 |
| aria | `aria-current="step"`；进度以文本并行输出（非纯视觉） |

## 6. PositionTable（仓位表）

| 方面 | 契约 |
|---|---|
| 用途 | 仓位/持仓列表（POL/PT/YT/CDP/suToken/Governance 各表） |
| 结构 | 表头（可排序）+ 行（44px T2；高密度区 36px T1）+ 行展开（审阅详情，PU-004 行展开证据） |
| 状态 | loading=骨架行（保持表头）；empty=EmptyState 内嵌；error=表顶错误条+重试；零余额/零仓位=空态变体文案 |
| 数据规则 | 全数字列 data-numeric 右对齐；地址/hash 截断+复制按钮（复制成功 toast）；涨跌色=success/danger token |
| 键盘 | 行 Tab 可达；Enter 展开/收起；排序按钮 `aria-sort` |
| 索引延迟 | 索引滞后由数据层收敛（写后刷新管线等索引追平再失效缓存）；表组件不做「以链上读值为准」类提示，历史类空态走 `Syncing — history unavailable in this snapshot`（现役位=蜡烛图） |

## 7. ActionDialogShell（动作弹窗确认）

| 方面 | 契约 |
|---|---|
| 用途 | 各写流程签名前的统一确认壳（`components/global/action-dialogs.tsx`）：弹窗内单段 Confirm → 钱包签名；简单直调流免审阅直发钱包（§34）。全站「灰标题+✕」弹窗族统一此壳（2026-10-27 用户裁定：POL 赎回 LP/PT-YT、拆分合并、Swap 代币选择、DAO 基金、Verse 分享 6 个手写 `pol-mint__head` 头部并入，CSS 解剖与视觉不变） |
| 结构 | `.pol-mint` 卡壳：标题距上缘 `--space-4`、侧底 `--space-5`（2026-10-27 用户裁定收一档；回执档 `compactTop` 再收一档 `--space-3`）；标题 `--text-title` 17px、✕ 图标 17px（用户裁定半档，`--text-title` 为 base/md 间角色档，与 swap 卡头题同规格）；变体 props=`glow`（ax-glow-card 签名，代币选择/DAO 基金/分享关）、`contentClass`（dao-fund-pop/verse-share-pop 自有皮肤）、`dataStage`（分享弹窗阶段皮肤钩子）、`titleClassName`（富标题）；报价/网络费等面板数据在开窗前取齐，弹窗一次渲染、不后补行（点击链路 RPC 预算纪律） |
| 状态 | 签名→确认→完成 三步条=`tx-status.tsx`（§8）；失败=错误块（人话原因+恢复动作：调整参数/重试/取消） |
| 规则 | 数字全部 data-numeric；授权变化按各流程需要呈现（「This gives … access to …」措辞） |
| aria | 交易状态 `aria-live` 由 §8 承担（assertive） |

## 8. TransactionStatus（交易中心状态）

| 方面 | 契约 |
|---|---|
| 用途 | 统一交易状态流（§7 十一态：Preparing→Preflighting→Awaiting authorization→Simulating→Awaiting signature→Submitted→Confirming→Confirmed/Reverted/Replaced/Cancelled） |
| 结构 | 步骤列表（当前步高亮）+ 关键事实行（hash/链/gas）+ 恢复动作 |
| 状态映射 | 见 state-matrix.md §3；跨链=`Message pending` 常驻直到目标链确认（源链 hash≠完成，§7） |
| 动效 | 步骤推进=状态反馈动效（非装饰）；Confirmed=回声确认 |
| aria | `aria-live="assertive"`（交易状态是关键信息）；每步文本化 |
| 原型落地 | `components/global/tx-status.tsx`（2026-10-01）：T4→T5→T6 三步条，create-form 确认注册信息 + participation-panel 确认参与信息共用；无钱包——签名/上链由前端定时模拟推进（≈1.6s/≈1.2s；驱动=两调用方各自内联的 tick 逻辑（无共享模块），`onConfirmed` 回调承载注册流开弹窗差异），无 hash/gas 故关键事实行省略；T6 展示：注册流=自动弹窗（`.pol-mint` 壳复用，「查看 Verse」CTA→样本 verse-021——新 verseId 链上才产生，生产=注册回执；用户裁定 2026-10-01）、参与流=内联 `.tx-success` 回声块（CTA→portfolio）；拒签 T9 模拟不含 |

## 9. AccountCapability（账户能力）

| 方面 | 契约 |
|---|---|
| 用途 | 账户类型与 7702 能力呈现（§6.2 九态：Disconnected→…→Kernel delegated/Unsupported delegation；§6.5 检测顺序） |
| 结构 | 状态徽章+自然语言描述+行动按钮 |
| 文案（消费化示例） | Disconnected=`Connect wallet`；Connected EOA=`Standard wallet · trading needs one-time upgrade`；Authorization requested=`Approve in your wallet`；Delegation pending=`Setting up…`；Kernel delegated=`Smart account ready`+逐链徽章；Unsupported=`This wallet links to an unknown contract. Replace it to trade.`（不提供"仍然继续"，§14） |
| 状态 | loading=检测中（`eth_getCode`）；error=RPC 失败重试；Swap 失败≠未启用（§6.3 语义区分显式文案） |
| 触发 | 升级入口=显式 CTA，不自动弹（§7）；EIP-6963 发现+固定钱包顺序（§7） |

## 10. EmptyState（空态）

| 方面 | 契约 |
|---|---|
| 用途 | 全站空态统一（零余额/零仓位/无历史/无提案/搜索无结果） |
| 结构 | 品牌锚小方块（CRT 纹理唯一许可位）+ 标题 + 一句引导 + 主行动按钮 |
| 文案例 | `No POL positions yet` + `Provide liquidity to earn fees` + `Browse memeverse`；错误恢复不归本组件（用 TransactionReview/error 块） |
| 状态 | default；loading 期间不显示（骨架先行）；i18n 双语各自完整 |

## 11. LifecycleTabs（生命周期导航 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | Explore 页按阶段过滤（Genesis / Locked / Unlocked 三 tab；无「全部」「退款」tab——2026-10-01 PD-07 勘误，跨阶段仅经搜索、退款态动线由 Portfolio 承接） |
| 实现 | `components/discovery/discovery-browser.tsx` → `nav.lifecycle-tabs > a[data-stage][data-active]`；样式 `app/globals.css .lifecycle-tabs*` |
| 结构 | 每项：`__mark` 色点（aria-hidden）+ `strong` 阶段名 |
| 状态 | default / hover / focus / active（`data-active` + `aria-current="page"`，底部 `--stage-color` 2px 线）；阶段色由 `data-stage` 映射，禁传色 |
| 行为 | 状态即 URL（`?stage=`），`<a>` 而非按钮；可分享、可后退；切 tab 保留目标阶段仍合法的排序、非法回落 createtime（2026-10-02 P2-5 裁定，href 构造统一走 `discovery-href.ts`、映射共享自 `sort-options.ts`） |
| 响应式 | ≤68rem 横向滚动（3 列 minmax grid）；≤54rem 负 margin 出血、去边框 |
| aria | `nav[aria-label]`；阶段名为文本，色点仅装饰 |

## 12. EconomyCard（经济体卡 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | Explore 结果网格中的 Verse 摘要，整卡可点进详情 |
| 实现 | `components/discovery/economy-card.tsx`（DiscoveryBrowser 编排渲染；整卡点击经 `onOpen` 回调由 browser 导航）→ `li > article.economy-card[data-stage]`（勘误：原登记误作 `a`，aria-label 在卡内链接上）；样式 `.economy-card*`、容器 `.economy-grid` |
| 结构 | `__header`（`__symbol` + `__identity` 名称/符号 + StageBadge）→ `dl.__facts`（通栏 footer：锁定/已解锁=国库资金+解锁时间，其余=累计募集+创世截止；值 `data-numeric`）→ `__signal`（按阶段切换：progress / liveMetrics（锁定与已解锁共用：Staking APY + Volume 24h + 参与人数三行读数，前两者 fixture 缺失显 unavailable 槽位）/ returningCapital） |
| 状态 | default；hover / focus-within 提升一档表面 + 青选择线；阶段色经 `--stage-color` 出现在主线（顶缘+色点），回声线经 `--stage-next`（=下一阶段色，2026-09-26 用户裁定双线规律：genesis 黄+品红 / locked 品红+青 / unlocked 青+黄；refund 终态橙+品红） |
| 规则 | 每卡只突出一个信号区；数字零 glow；进度用 `role="progressbar"` + 文本；链行数据源（2026-10-22）：onchain 构建=verse 注册真相 `omnichainIds`（对全链表解析，未解析 id 丢弃），fixture 构建（字段 null）=治理链优先的主网三链样本面；卡媒体 `/verses/<id>.svg` 仅 fixture 行有产物，onchain 行 404 时 onError 隐藏 img（空框=null 槽） |
| 响应式 | `.economy-grid` auto-fill；≤30rem `__facts` 堆叠、header 折行 |

## 13. PageIntro / StageTabs / SectionHeading（页面结构原子 · 已落地）

| 组件 | 实现 | 契约 |
|---|---|---|
| PageIntro | `.page-intro`（h1 + p ≤66ch，底部黄 2px + 品红 1px 回声；到顶栏间距 4px+24px=28px，2026-10-07 四个一级页统一） | 每页一次，唯一 h1 |
| StageTabs | `.stage-tabs a[data-active]`（56px，激活 = 顶部黄线 + 黄字 + 黄 inset） | 单页内阶段切换；与 LifecycleTabs 不同页混用 |
| SectionHeading | `signal-ui.tsx` 导出，`header.section-heading.ax-echo-bar`（`__row` = h2 + aside；description `<p>` 在行下、贴底边框；签名线锚定边框不随描述下沉，决议 014 几何化） | 每个 section 一个 h2，`aside` 放筛选/计数；`id?` 透传 h2 作为 `aria-labelledby` 目标（showcase 六区块 2026-10-03 由内容元素迁至 h2） |
| Verse 头部 | `.verse-hero`/`.verse-identity`（verse-page 内联） | （2026-09-22 用户裁定多轮定稿）symbol 大图形（约 198px）绝对定位左侧，文本列 padding 让位：①名称行=ticker 在前（数据等宽 `--text-num-lg`+主行动黄+大写字距+抖音式错版 text-shadow：青左上/品红右下 0.08em）+name 随后（`--text-lg` 无回声阴影，不抢戏）+徽章右推同行；②描述紧跟名称行（SPEC-M8 ≤255 字节→68ch 约四行）；③底行两端=链信息（左，label 样式：`--text-sm`+大写+0.08em 字距，与描述正文分层；组间 `--space-5`/组内 `--space-2`；链徽章数据源（2026-10-22）：onchain 构建=verse 注册真相 `omnichainIds`（首个=治理链，其余=spoke，无 spoke=整组不渲染），fixture 构建（字段 null）沿用 chains-fixture 样本三链面保 e2e 基线）+社交图标（右，同 flex 行天然同线）；社交=官方品牌图标（`brand-icons.tsx` simple-icons path：X/Discord/Telegram+lucide Globe），顺序 website→x→discord→telegram（repository SOCIAL_ORDER；fixture kind twitter 已改名 x）；「Economy overview」标签删除；hero 顶部无 padding（主容器 24px 唯一留白）；底部签名线随阶段双线规律（`data-stage` 驱动 `--stage-color` 主线 + `--stage-next` 回声，与 economy-card 上边缘同律，2026-09-26）；四项统计在右列 `.stats-panel` 新卡（Key metrics 2×2） |

## 14. ParticipationPanel（创世参与面板 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | Verse 详情页（`stage=genesis`）参与工作台：选择参与方式、输入金额、审阅后确认（原型不发交易） |
| 错链闸门（交易台全席） | **钱包链 ≠ verse 执行链时，面板 CTA 原位变「换链按钮」（2026-10-22 用户裁定；弹窗不得打开）**：`components/global/switch-chain-cta.tsx` 提供 `useVerseExecChain(governanceChain)`（fixture 治理链为主网 id，经 MAINNET_TO_TESTNET 映射到当前链集测试链）与 `SwitchChainCta`（**链图标在链名前**，2026-10-23 用户裁定）。全席接线：participation（表单主 CTA 位 `ax-ghost-cta lg`）、swap/四池加撤/Mint POL/Flash Swap 经 `DialogCta.switchChainTo`、Split/Merge、Redeem LP、Redeem PT/YT（弹窗内 CTA 位 `swap-panel__cta`）、vault（既有闸门，`switchCtaAlt` 换 `SwitchChainCta` outline）；交易台面板 `executionReady` 统一加 `!wrongChain`——错链时面板不发起任何链上读（同地址他链部署 revert InvalidVerseId）。**参与面板另有点击时实链核查**（2026-10-23）：wagmi/Privy 缓存 chainId 可陈旧（无人订阅 chainChanged），`ensureLiveChain()` 于表单提交/组包入口直读 provider `eth_chainId`，不符即翻转换链钮；换链经 `switchProviderChain`（provider 直发 `wallet_switchEthereumChain`，4902 自动 `wallet_addEthereumChain`），wagmi 仅兜底。**参与面板链闸门（2026-10-25 用户裁定，覆盖前款 participation 接线）**：创世参与按链独立结算，钱包链属于 `deployedChainIds`（真实落地集，与发现页同源）即在本链参与、不换链；只有落地集外才换链，目标=治理链已落地则治理链、否则落地集首链（`verseExecutionChains` 按链 id 升序，首链不受调用方顺序影响；`omnichainIds[0]` 是注册请求集，不得用于判定）。点击时 `getVerseSession({ chains: 落地集 })` 直接探 provider 实链：集外即翻转换链钮；组包链取 `session.chainId`，执行器按 `spec.expectedChainId` 路由，缓存 chainId 陈旧不会把 A 链 spec 交给 B 链钱包；审阅窗打开后钱包真实换链自动关窗重备。预购容量/聚合进度仍取治理链 canonical（数据作用域后续，链上 cap 兜底） |
| 审阅轮（决议 041，现行） | **TxReviewPanel 站内审阅站全站废除**：组件与 `.tx-review*` CSS 已删；所有动作弹窗（参与/Swap/四池/POL/金库/创建/Portfolio/保护窗）的 Confirm 即审阅终点，`executeSession`/`executeDirect` 直进钱包弹框；`startReview/cancelReview/confirm` API 退役，无限授权开关随之删除（approval 一律精确额度）；`spec.review` 仅作数据载荷、`reviewing` 恒 false。**嵌入式钱包的确认面**=各动作弹窗本身（其签名静默：type-4 走裸哈希签名+自广播，钱包侧无 UI）；签名后的进度=三步条 `TxStatus`（等待钱包签名→上链确认中→已上链），失败回可编辑态并保留输入。参与复核弹窗另含 **Gas 控件**（仅 embedded：三档+可编辑 gwei+预估费用，见 components.md；external 不渲染，插件自带）。**点击链路预算（现行）**：点确认先探 provider `eth_chainId`（错链闸门 + 执行链选址），再组 spec（一轮并行 allowance 读）并取完弹窗要画的网络费报价，**全部到手才开窗**——弹窗一次渲染完整，打开后不再出现后到的行（网络费后到顶一下卡片即为缺陷）；等待期由表单态承担（`resolving` 持续置位、CTA 禁用），失败/错链走降级错误行与换链钮；静态半（verse 元组/代币精度）在首次悬停或聚焦表单时预热，命中缓存时探测之外零读。 |
| 实现 | `components/verse/participation-panel.tsx`；样式 `app/globals.css .participation-form/.participation-toggle/.participation-toggle--mode/.participation-fixed-asset/.participation-review*` |
| 结构 | 模式层三项 ToggleGroup `.participation-toggle--mode`（普通创世/杠杆创世/预购——预购与创世同级，用户裁定 2026-09-21；顶层 tab 风格：无框透明底、激活=黄字+底部黄线，底边线兼作分割线（`ax-echo-bar` 签名线锚定其下），与路径分段框区分——2026-09-22 用户裁定；无可见字段标签，`aria-label`=「参与方式」；section 可见标题/描述删除——与右侧「当前可以做什么」完全重复，纲要由 sr-only h2 维持；**切模式即清空模式作用域输入**（主金额+预购金额+一键预购开关——同一 amount state 三模式含义不同（参与额/利息/预购额），2026-10-23 用户裁定；支付资产选择不清、无效符号由 routeAssets[0] 回落兜底））→（非预购）路径两项分段 ToggleGroup →（预购）Verse 级容量 ProgressMeter（已用/上限；见「预购面板」行）→ **支付资产+金额并排** `.participation-duo`（grid 两列等宽 1fr/1fr；用户裁定 2026-09-25：单字段各占一行太占空间，同日二次裁定两列等宽；小屏折单列；支付资产多选项=Select、唯一选项=固定值 `.participation-fixed-asset`；**预购模式支付资产同为下拉**——uAsset 直付+储备面值直兑，help 文案 uassetHelp/directHelp 随选切换；**stake=三格同行** `.participation-trio`（来源/参与资产/金额 grid 1fr 1fr 2fr，用户裁定 2026-09-25））→（非预购）一键预购开关+预购 **duo**（Pay with 下拉与主选择独立+预购金额 Input 并排 `.participation-duo`——用户裁定 2026-09-25）→ 表单提交槽（2026-10-24）：未连接=整颗换登录钮（`copy.common.connect` + WalletCards 图标、点击=`connectAction`（onchain 开钱包选择器、harness 切换模拟连接），表单草稿不清——Launch 提交槽同款；错链仍走原位换链钮先例 2026-10-22）；已连接=「确认参与」开**审阅弹窗**（2026-10-21 六次裁定：原内联卡太空，改 `ActionDialogShell`/`.pol-mint` 小弹窗浮于表单之上、表单不换面）；弹窗内=**台账行结构**（七次裁定：hairline 行（44px、label 左灰/mono 值右、上下边线成组），非浮动数字居中排）——「进入创世」组行值青、「你支付」组行值品牌黄+semibold；弹窗操作行=修改/确认双钮 `repeat(2, minmax(0, 1fr))` 网格等分占满整行（等宽+居中，2026-10-21 用户裁定，`.pf-card__actions` 同语法；≤30rem 折单列）；**Confirm 不可用态可解释**（2026-10-24，禁用无解释的死 Confirm 已否）：onchain 构建（`center.source='real'`）未连接钱包→Confirm 原位换 Connect 钮（`connectAction` 开登录选择器）；Confirm 点击时 live 链检失败（`liveWrongChain`，缓存链失真）或缓存错链→原位换链按钮（`SwitchChainCta`，`onSwitched` 复跑 `ensureLiveChain`）；路线未接线（`wiredKind=null`，如 preorder-only+储备支付、NATIVE 腿）→Confirm 不渲染、`__note` 全宽说明行替代（`copy.verse.reviewUnwired`，`{asset}`=当前支付资产）；harness/fixture 构建维持原双钮不做分支；关闭/X/Esc=resetReview 回表单 |
| 余额行 | 金额字段标签行 `.participation-field-head`（flex：标签居左、余额/Max 居右；主金额+一键预购金额两处——2026-10-04 补齐）：结构复用 `.swap-panel__balance/__max`（swap-panel 同款），字阶 13px + `--color-text-secondary`、Max 钮 `--text-xs`（2026-10-06 用户裁定放大、14px 嫌大定 13px；token 阶梯无 13px 档、随 swap-panel 一带裸 px 惯例；仅 `.participation-field-head` 作用域覆盖，swap 面板及各弹窗仍为原 12/11px）；对齐=**基线对齐**：`.participation-field-head` 与 `.swap-panel__balance` 均 `align-items: baseline`（2026-10-06 用户裁定字体字形层面高差；盒居中在混合字号/字重/字体（数字=`--font-data` mono）下必留 ~0.35px 字形差，基线对齐实测归 0.05px；`.swap-panel__balance` 改动为共享类、swap 面板及各弹窗内部三件套一齐基线化；先行 line-height 1.375 方案误诊已回滚）；数值=所选支付资产钱包余额（**2026-10-22 双模式（决议 037）**：onchain 连接态=经钱包 provider 客户端现读（2026-10-21 裁定「个人数值不走服务端」补迁至此——SSR 账号读退役、`getFixtureWalletBalances` onchain 恒空表；读取范围=支付选项全集合 uAsset+PSM 储备+credit，测试网 Mock 储备币照读）；fixture/e2e=`getFixtureWalletBalances` 样本表按符号跨链合计，基线不变；在途/逐币失败='--'）；Max 点击=填入全部余额；代币符号由相邻 Pay with 展示、余额行不重复（2026-10-04 裁定先例）；快照缺失符号（USDT、sy 资产）=「--」+ Max 禁用槽位态（swap-panel 同款） |
| 状态 | 杠杆模式：披露 `form-warning`「损失上限=所付利息 · 无清算 · 创世失败利息全额退」；fixture 缺利率/上限快照=null→不渲染解释句、提交禁用（null 不渲染，2026-10-05 用户裁定；2026-09-22 起快照齐备即全交互）；金额/预购金额为空提交 → `data-invalid` + FieldError；审阅态 `aria-live="polite"` |
| 杠杆面板 | 利息金额输入（标签切「利息金额」）；路径三项=用 uAsset 直付/面值直兑（PSM 储备转利息，无 CDP 仓位）/创世积分直付（`leveragedGenesisWithCredit` 锁定时销毁；杠杆无质押项）；实时预览=借贷资金数值（口径=利息÷利率，一次性比例非年化，**UI 只显 label+数值不显公式**——用户裁定 2026-09-25，`leverageDebtPreview` key 已删并入 `leverageDebtQuota`；`data-numeric`；**UI 词「借贷资金/Borrowed funds」=用户裁定 2026-09-25**——OB 原词 debt quota 暗示未使用配额，实为参与即发生的已用借贷资金；机制口径/代码标识符仍 debt quota）；债务上限余量（Debt cap headroom；2026-09-25 用户最终裁定沿用原词）=债务上限−已建债务（已收利息÷利率），超限→FieldError「超出债务上限——剩余可建额度 {quota}」+提交拦截（对照 stockCap 模式）；一键预购上限按借贷资金推导（容量=(普通资金+杠杆债务本金)×70%×容量比例）；审阅屏**分组化**（用户裁定 2026-09-25，可读性；同日二次裁定：组序=进创世在前、你支付在后，两组标题颜色区分）：头部 meta 条（参与方式 + 预购标记，如「普通创世 · 预购」；2026-10-24 用户裁定删除「支付资产 X」句——每条腿的符号已在台账行内，meta 重复是纯冗余；预购独立模式不重复「预购」）→「进入创世 ENTERS GENESIS」组（**标题与数值均青** `--accent-link`）=**双数字平级**（2026-10-21 用户裁定三次：预购金额与创世金额同级展示）——创世金额（普通=创世金额、杠杆=借贷资金）+（预购启用时）预购金额，台账行、金额行值青（七次裁定：弹窗内一律台账行非 hero 大数）；**2026-10-24 杠杆三行+值栈重做**（用户裁定）：杠杆模式组内=借贷资金→借贷利率→借贷利息（uAsset 口径=输入×(1−兑换手续费)，与 借贷资金=借贷利息÷利率 算术自洽）三行顺序展示。**值栈**（`__value`/`__fee`）：台账保持单一左轴与逐行 hairline，手续费不另起行、不缩进，而是作为父金额下方同列的第二行（右对齐、`--text-xs`、`--color-text-tertiary`）——派生成本贴着它所转换的数字，两条同名费用行靠空间归属消歧义，行高随内容增长（`padding-block: space-2`、`min-block-size: 0`、label 顶对齐金额行）。参数与费用值降次级（利率行 `__row--muted` 值 `--color-text-secondary`），青只留给进入创世金额行。利率行为普通参数行：标签 + 纯数字百分数，不附加「一次性」注记（2026-10-24 用户裁定该注记无信息量，已删文案与 `__qualifier` 类）。窄屏不拆台账：`≤30rem` 只保留 create-form 的平铺 dl 折列，`.participation-review__row` 恒两列（收据式 label/值配对才是可扫读形态）；预购资金主池开放后才买入、机制上非创世资金（展示裁定不改机制口径），preorder-only 无本组→「你支付 YOU PAY」组（标题**品牌黄**——2026-10-21 裁定：组标随行值同色，与进入创世「青标青值」对称成套）=**hero 总量行、无子项**（2026-10-21 裁定：支付金额=总量、下面不要子项）：「支付金额」=主支付+预购合计（台账行值**品牌黄 `--accent-primary`+semibold**——五次裁定，token 语义 "key readouts" 档；预购专用页行标=「预购金额」）——预购不在本组重复（四次裁定：平级数字在「进入创世」组）；异资产双腿=按腿两行各显代币（2026-10-24 用户裁定，推翻「主支付顶位」单资产假设：reserve/credit 利息腿+uAsset 预购腿=两代币两 approve），同资产仍合计单行；异资产腿行标用**按腿语义**（`reviewPayInterest`/`reviewPayPreorder`，普通路径首腿=`genesisPayLabel`）——预购金额已在「进入创世」组有平级行，同标同值重复会读成两条同一笔，换语义标签后「你支付」说明的是钱付作什么；黄保留给 CTA 与「你支付」行值；结构 `.participation-review__rows/__row(--genesis/--muted/--pay)/__value/__fee/__group/--genesis`（create-form 审阅仍 dl 平铺不受影响）；**成功态正文沿用收尾式**（`tx-success`：居中绿格 ✓ + 「参与成功」标 + 支付腿行（`__row--pay`，值 `--text-lg` 数据字体；多腿包进 `tx-success__rows` 单一块，行间取 44px 行节奏、无栅格间距，块上下留白相等——2026-10-24 用户裁定腿间距要缩小且对称）+ 满宽「查看资产组合」CTA），而**弹窗标题切为「参与成功」**（`reviewTitleDone`；2026-10-24 用户裁定：成功后标题不得仍写「确认参与信息」；正文版式保持原设计不动，不叠加「进入创世」组）；SourceRef 仅确认态渲染；审阅头部图标 32px 描边框+与标题居中对齐（对齐 §15 CurrentAction 先例，2026-09-25） |
| 接线矩阵 | 全路径通电（2026-10-24，资金矩阵真源=IOutrunRouter）：普通创世 uAsset 直付=launcher `genesis`；储备面值直兑=Router `genesisByPSM`（拉储备币、approve router）；质押=Router `genesisByToken`（拉 SP 可存资产；**SP 注册表链上读不写死**：`getStakeSources` 从 deployments `OutrunStakingPosition.*` 读 `SP.uAsset()` 按 verse 族过滤 + `SP.SY().getTokensIn()` 可存资产矩阵 + `previewStakeFromToken` 单位预览作 anchorValue（失败→面值 1 降级），按 verse 执行链取（`executionChainId`）、30s config 缓存、来源标签=实例键去前缀；无源=路由禁用不伪造）；杠杆 credit/uAsset 直付=POLend（`leveragedGenesisWithCredit`/`leveragedGenesis`），储备=Router `leveragedGenesisByPSM`；组合入口全走 Router（`genesisAndPreorder`/`leveragedGenesisAndPreorder`：创世腿随路径 `fundPsmInput`/`fundStakeInput`/`fundUAssetInput`/`fundCreditInput`，**预购腿恒 uAsset**——launcher preorder 只收 uAsset，故 preorder-only+储备支付保持禁用；异资产双腿=两 pull 两 approve）；NATIVE 腿不接；滑点下限传 0（value-parity 铸造+mock SY 1:1 包装，无滑点面）；审阅弹窗 targetContract=各分支实际 target（单腿 uAsset=launcher、杠杆 credit/uAsset=POLend、其余=router）；FUND_SOURCE 的 Psm=1/Stake=2 映射由 cast calldata golden 向量钉死（tests/unit/web3/session-actions.test.ts）。**交易链路三层回归（2026-10-25）**：①批次上链=tests/integration/batch-execution.test.ts（**资金矩阵全组合 16 条**：普通 2×2+杠杆 3×2 全部创世×预购腿组合+四单腿，BSC 分叉逐腿执行，断言账本精确增量/授权消耗/余额变动/同 token 合并单 approve 形态；ANVIL_URL 门控，注资=分叉巨鲸转账+PSM 面值铸造+水龙头 claimHeld，随机 burner 避开真链冷却；preorderByPSM 已随 2026-10-24 重部署（0xC4F8…3aa88，OutStake 2c033a8）上线并实测通过；**Router 重部署的对齐清单=deployments/manifest 四件套（地址/tx/block/codehash）+outstakeCommit 同步换+新实例注册表补配置（部署脚本只带 launcher/polend/PSM 注册；trustedSY/trustedSYForSP 须 owner 对逐 SP/SY 对补设，2026-10-25 已补齐三链 8 对并全矩阵实测）**）；②执行层边界=tests/unit/web3/fake-wallet.ts（**冻结**：只按 EIP-5792 规范+MetaMask 抓包写死，禁与执行层同改）+ executor-boundary.test.ts（请求序列/信封形状/失败归类逐一对表；曾拦下 500+0x0 回执误归 unknown 并已修复）；③真实页面=e2e/wallet-participation.spec.ts（playwright.wallet.config.ts 独立配置、WALLET_E2E 门控、retries=2 吸收 Privy iframe 抖动，**参数化 20 条变体全矩阵**：Standard/Leverage/Preorder 三模式×Direct/Stake/Credit 路由×uAsset/储备/credit 支付×预购开关与支付资产——每条=随机 burner 注资（巨鲸/水龙头）→注入 shim→Privy 登录（重试容错）→真实表单驱动→断言 sendCalls 信封（v2.0.0/**最小授权批形状**=逐变体 approve 腿数与目标白名单+action 解码进失败消息）+分叉账本精确增量；负面路径=拒签 Cancelled/-32603 与链上回滚 Reverted 终态、超限与余额不足客户端拦截、错链 CTA 翻转、同地址重复参与累积；页面不直连分叉，经 binding 桥执行（桥带回滚原因重放与执行错误落盘）） |
| 一键预购 | 开关开启才出现预购金额输入；**实时可预购上限**=创世资金按面值折算 uAsset×70%×容量比例（比例=`verse.preorderCapacityRatio`：onchain 构建=链上 `getLauncherParameters().preorderCapRatio` 读数（bps÷1e4，经 `lib/data/onchain-source.ts` 详情页 RPC overlay 注入），demo=fixture 样本；缺失=null→容量区不渲染、CTA 禁用）；上限随创世金额输入实时更新（`data-numeric`）；上限行标签后挂 ⊙ `.create-info` Tooltip（button 语义+aria-label，FieldInfo/SettingsTip 同范式）=公式文案 `preorderCapNote`（比例直接代入「×{ratio}%」、与上限计算同源，不写「capacity ratio (currently …)」长串——用户裁定 2026-10-23；触发器对齐=`.participation-form .create-info` 下沉 2px（synthetic baseline 上浮修正，`.swap-panel__details dt` 先例）；不带「以链上为准」类后缀，copy-and-i18n §2）；超限→FieldError「超出可预购上限——最多可预购 {cap}」+提交拦截（对照 stockCap 模式）；**verse 级剩余容量同样参与门控**（2026-10-25：此前一键预购只校验个人上限，个人上限可通过而 verse 剩余不足时链上 `InvalidLength` 回滚；现与预购 tab 同口径——剩余快照缺失=不门控/null 不渲染，超出→FieldError「超出预购容量——最多可预购 {cap}」+提交拦截）；提交校验两项均 >0。**金额精度契约（2026-10-25）**：界面金额分两层**全站共享基础件**：`lib/web3/base-units.ts`（单位层：typed 字符串→最小单位、整数显示截断、wad 百分比；零协议知识）与 `lib/web3/contract-formulas.ts`（公式层：PSM mint/redeem、预购上限、POLend 债务、stake 预览的整数镜像，逐条对应合约算式）；所有功能的报价/门控/执行金额都从这两层取，功能文件不得自写浮点金额（已接入参与面板与 faucet 兑换的到账/费率显示）——typed 字符串直接 `toBaseUnits`（无浮点往返，超出资产精度截断）、PSM 到账=`face*(1e18-tinWad)/1e18` 向下取整、预购上限=`funds×70%×ratioBps` 双取整、杠杆债务=`interest/rateWad`、stake 换算用链上 `previewStakeFromToken` 的整token预览精确乘除；显示用 `formatBaseUnits` 截断（永不向上进位，显示值绝不超过链上实际），上限/剩余容量/余额门控均按 uAsset 最小单位整数比较，剩余容量取链上 `previewPreorderCapacity`（不按浮点聚合重算）；原始 wad/bps 由数据层以字符串下发（RSC 可序列化），只读不到时才回退浮点样本 |
| 预购面板 | Verse 级容量进度条 ProgressMeter（标签「预购容量」，位于金额输入前）：容量=（普通创世资金+杠杆债务本金）×70%×容量比例（`MemeverseLauncherLib.preorderMaxCapacity`，真源口径同 glossary；债务本金=已收利息÷利率），已用=`verse.preorderRaised` 快照（合约 `PreorderState.totalFunds`）；容量随创世资金实时变化（合约 dev comment）；金额约束=剩余容量（容量−已用，先到先得、合约超 cap revert，`IMemeverseLauncher preorder`）→「可预购余量」FieldDescription+超限 FieldError「超出预购容量——最多可预购 {cap}」+提交拦截（对照杠杆 stockCap 模式）；比例或利率快照缺失=null→容量区不渲染+CTA 禁用（null 不渲染，2026-10-05 用户裁定） |
| 规则 | **路径决定支付资产**（用户裁定 2026-09-22；同日二次裁定合并直付与面值直兑）：直接参与=支付资产下拉「募集 uAsset（直付，默认首选）+ PSM 配对储备资产（面值即时兑换）」，说明文案随所选资产切换（**渲染于 Pay with 下拉下方**——用户裁定 2026-09-25：direct/credit/预购统一移至支付资产处，stake 路径说明仍随路由分段框；储备腿说明带链上 PSM 铸造费率 `tin`——费率未读到时回落面值句、不渲染费率行）；质押参与=**两级联动下拉**（用户裁定 2026-09-22）——先选「质押来源」（Lido/Aave…，读 `fixtures/data/yield-sources.json` registry，样本口径=OutrunBook vision.md 协议清单+OutStake adapters；**来源按本 Verse uAsset 族过滤**（来源 `anchor`=uAsset 符号去 U 前缀；用户裁定 2026-09-22：UETH verse 不出现 USD 族来源如 sUSDe）；切来源→参与资产组随之切换并回落首项，如 Lido→ETH/wstETH/stETH、Aave→ETH/aETH），再选「参与资产」——由 `getFixtureParticipationOptions(verse.raiseAsset)` 出口 `yieldSourceRegistry`，不写死；无选项路径项禁用；预购模式**金额仍按募集 uAsset 计价**、支付资产组与直付同款可选（uAsset 直付+储备面值直兑——用户裁定 2026-09-25）。审阅屏分组化见「杠杆面板」行（用户裁定 2026-09-25）；折算口径：质押路径 sy 资产按实时价值折算 uAsset——fixture `anchorValue` 样本率（OB:outstake/uasset.md:21 机制、:48 wstETH≈1.05 样本），direct 路径面值减 PSM 铸造费（储备腿到账=输入×(1−`tin`)，uAsset 腿面值；进入创世组 Genesis 金额即扣费后值、另附兑换手续费行；一键预购与预购腿同口径）；**折算一律出数值不显槽位**——sy 资产缺 `anchorValue` 快照时兜底面值 1（用户裁定 2026-09-25），一键预购上限同口径联动折算值。数字全部 `data-numeric`；一屏唯一黄 CTA（审阅按钮） |
| 密度 | 路径分段框行高=`--row-height`（44px，T2 表格档；2026-09-22 用户裁定自 T3 放松档 56px 收紧）；模式 tab 行高=`--control-height`（40px）；参与卡 padding-block-start=`--space-2`（8px，`.workbench-primary` 专属覆盖——用户裁定二次收紧；其余三边 16px）；面板无表头附加间距（`.participation-form` 不设 padding-block-start） |
| 「您的参与」槽（stats-panel） | 数据源双模式（2026-10-25 口径改为等价创世资金：预购资金不计入、杠杆利息按利率换算，`components/verse/my-participation-stat.tsx`；**2026-10-26 改全链合计**——创世逐链结算，本槽=verse 落地集上等价创世资金求和）：onchain 连接态双腿（钱包 provider 只服务当前链，兄弟链读不了）——钱包链腿=provider 现读两腿求和（launcher `userGenesisData` 标准资金 + POLend `getUserLeveragedDebt` 杠杆等价腿（链上完成 (真uAsset+credit 利息)×1e18÷interestRate 换算，POLendUpgradeable.sol:700-712；market 随 launch 注册，MemeverseLaunchImpl.sol:84，活跃 verse 不触发 InvalidState），`execution-reads.ts readGenesisParticipation`；`writeNonce`（本 tab 写确认）与 `visibilitychange`/`focus` 重读）；其余链腿=on-demand server action `readGenesisFundsByChain`（`lib/data/verse-reads.ts` → rpc `getAccountGenesisFunds`，逐链 multicall 同两腿公式，18-dec uAsset 基单位字符串；失败链不入 map）——任一腿未知='--' 槽位（不落部分和、不落「未参与」），全链真 0=「未参与」；钱包链腿优先于 action 同链值（更新鲜）；账号/链切换清空双腿再重读（全量重置白名单点）；fixture/e2e=participations fixture SSR 样本同口径换算（normal 行全额 + leverage 行÷ verse `leverageInterestRate` 快照（null 时计利息原值）、preorder 行剔除，`verse-page.tsx`）；dt 标签旁 ⊙ `.create-info` 悬停气泡（键盘可达，2026-10-25）文案=`verse.yourParticipationNote`（「按等价创世资金计。」/en 同义，用户裁定 2026-10-25 极简档、预购例外句删除）。同排「参与地址」=omni 合计：`verse.omniParticipantCount`（`getVerse` 对落地集逐链去重计数求和——跨链去重无身份可用，同 home metrics 口径；写后由中央层失效+预热收敛） |
| 退款结算面板（refund-settle） | 分腿数据源双模式（2026-10-24，`components/verse/refund-settlement.tsx`；修复前 onchain 构建恒走 `refundNone` 空态——SSR 分腿源同「您的参与」槽已退役）：onchain 连接态=客户端 `readGenesisLedger` 现读——标准资金/预订资金腿带一次性 `isRefunded` 旗标（认领不清账只翻旗标，MemeverseSettlementImpl.sol:61/79，已认领腿不渲染行）；杠杆利息腿按记账金额显示，其已认领态在 POLend 私有 `claimFlags`（`claimRefund` 只翻旗标不清账，POLendUpgradeable.sol:531）无视图暴露——待 ABI 出视图后收口；分腿全零/全认领=`refundNone`；错链/在途/读失败='--' 体；fixture/e2e=SSR 样本分腿（fixture 现无 refund 态 verse，渲染面=refundNone 不变）；「认领全部」CTA 维持 disabled 样本锚（真实退款接线=另立功能） |
| 写后刷新层（genesis-live） | **写确认后聚合数字立即刷新（2026-10-26 根因修复，纪律=docs/engineering/performance.md「写后刷新 = 双层管线」）**。根因：关闭弹窗的 `router.refresh()` 打在服务端 30s/60s stale-while-revalidate 缓存上（`onchain-source.ts cachedConfig` / `graph-repository.ts cached()`）——TTL 内当次渲染重放交易前数值，TTL 外也是先发旧值、后台 revalidation 落地后无再渲染，叠加 subgraph 索引滞后，即「有时刷新有时延迟」。**即时层**：`components/verse/genesis-live.tsx` `VerseLiveProvider`（挂 `verse-page.tsx` 创世分支，`dataChainId`=canonical 副本链 `verse.chainId`，阈值面板两表随之搬入 provider 内、经 `GenesisLiveMeters` 消费）持 `aggregates`+`writeNonce`；参与确认（`tx.display==='confirmed'`）即 `probe()`：经钱包 provider（与 receipt 同链同源）一轮并行读 launcher `totalNormalFunds`/`previewPreorderCapacity` + POLend `getLeveragedDebtInfo`（`execution-reads.ts readVerseAggregates`），覆盖面板可预购余量（exact 闸门同源换新）/预购容量表已用与剩余/杠杆 headroom（债务本金直读，不经浮点除）/阈值表标准资金与杠杆利息。「已预购总额」=链式单步容量公式反推：`deriveVersePreorderUsed`=`preorderCapacityCeilingBase(normal+debt, ratioBps)−remaining`（contract-formulas 新增单步式，与合约 `MemeverseLauncherLib.preorderMaxCapacity` 的 mulDiv 逐 wei 一致；两步 floor 版 `preorderCapBase` 会差 1 wei，禁用于状态反推）。约束（2026-10-26 二次改口径=**显示链跟随钱包**）：显示链=钱包实链（限 verse 落地集内，越集/断连回退 canonical `verse.chainId`）——`getVerse` 新增逐链行 `chainAggregates`（每条落地链 normal/leveraged/preorder/participantCount，found 已持有、零额外往返）作显示基线；连接态账号/链切换即发基线探针（进度条/面板跟链换数）；探针读数只在钱包实链 ∈ 落地集时落值（他链部署 revert InvalidVerseId）；非 canonical 链的「可预购余量」仅来自探针（SSR overlay 只读 canonical——非 canonical 视图下该 prop 不适用=槽位态，禁用他链数字顶替）；读失败保持基线值（null 不覆盖，无用户可见错误）；账号/链变化清空（全量重置白名单点）；连续写 latest-probe-wins（seq 递增丢弃过期读数）；「您的参与」槽以 `writeNonce` 为重读信号（原仅 `visibilitychange`/`focus`）。**中央层（2026-10-26 同日补齐，覆盖参与地址等 subgraph-only 字段与新写面）**：`WriteSpec.writeScope={kind:'verse',chainId,verseId}`（参与面板组包已声明）→ `use-tx-center` 于 `outcome==='confirmed'` 统一调 server action `refreshVerseAfterWrite`（`lib/data/write-refresh.ts`+`write-refresh-core.ts`，依赖注入可测，自动携带本笔 tx hash（dispatch 旁路 `lastHashRef`））：有界轮询等 subgraph 索引追平写入区块（`getWriteBlock`=rpc `getTransactionReceipt` 定位本笔区块，无 hash/读不到回退 `getSafeBlockNumber` 安全头——安全头目标在索引持续落后链头超过 finality lag 时会到有界超时后放行；`getIndexedBlock` 直查 `_meta` 不走缓存，≤6×1.5s；早失效=冷读把交易前数值重新入缓存并重置 TTL）→ `GraphRepository.invalidateVerse`（仅 verse 作用域条目：detail/detailLegs/raisedSums，列表聚合不动）+ `invalidateVerseConfig`（`verse-fin-<chain>-<id>`）双删（内存+磁盘 seed，`persisted-swr deleteSeed`）→ 预热 `getVerse` → `router.refresh()`——页面全部服务端数字（进度条/参与地址/参与门槛/未来新增字段）一次收敛，新写面只要声明 scope 即继承，无需自接线。 |


## 15. CurrentAction（当前行动卡 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | Verse 详情页副工作台（`workbench-secondary` 首位）：按阶段告知用户当下可做什么、解释阶段推进入口状态（`components/verse/verse-page.tsx` CurrentAction；样式 `.action-panel*`） |
| 创世文案四键五态 | 选态三维=达标 × Fast × 已到期（真源 lifecycle.md:51-55，达标→锁定、未达标→退款；文案为用户定稿）。四键覆盖五态——达标态（已到期 或 Fast 到期前）同为「现在即可推进」共用一条：①非 Fast 到期前（不分达标——到期解锁推进即可）=「创世进行中。到期后任何人可推进到锁定阶段。」②Fast 到期前未达标=「创世进行中。任一门槛达标，任何人即可立即推进到锁定阶段。」③已达标（已到期/Fast 到期前）=「已达标。任何人现在可推进到锁定阶段，推进前参与仍有效。」④未达标已到期=「未达标。任何人现在可推进到退款阶段，推进前参与仍有效。」；③④的「推进前参与仍有效」=黄昏区口径（决议 008：推进前参与仍计入判断）；到期态由服务端渲染钟判 `Date.now() >= endsAt`，不设专门 fixture 样本 |
| 按钮 | 创世推进钮客户端组件 `end-genesis-button.tsx` 直写 `MemeverseLauncher.changeStage(verseId)`（§34 无审阅直发钱包、无 title——数据层披露文案不进 UI，copy-and-i18n.md §2 同族禁令）。启用=Fast 已达标即点、或截止后（无论 Fast 与达标与否——达标→锁定、未达标→退款，lifecycle.md:51-55；非 Fast 达标也等截止；墙钟走秒解锁）；**按钮文案分两段**：被门住时（非 Fast 到期前 / Fast 未达标到期前）=倒计时（`advanceCountdown` 模板「{t}后可推进/Advance in {t}」+ `formatCountdown` 共享格式：天档日时/小时档时分/末档分钟——最低分钟级不读秒，pending 不显 0 分钟；`<72h warning 色/<24h danger 色`，`data-tone` 压 outline 桥 `!important`；`title` 挂通用「推进到下一阶段」——被门住时结果未定，不可点名阶段）；可触发时结果必然确定（达标→锁定、未达标→退款）——文案直点将进入的阶段「进入锁定阶段/Enter Locked」「进入退款阶段/Enter Refund」，弹窗标题同此；截止行已撤出关键数据卡，被门住的按钮是截止时间的唯一落点；落地集外钱包换 SwitchChainCta（同参与面板闸门——创世逐链结算）；点击链路唯一往返=eth_chainId 探链选址；spec 带 writeScope（verse）——确认后中央层刷新把整页翻出创世工作台；未连接=点开登录选择器；harness 构建保持 inert disabled（基线稳定）；组包失败=降级行 errorBody。非创世=「Connect to check eligibility」disabled+title=`noParticipation`（连钱包读资格——真实解释，保留）；locked 额外出行「触发费用分配」说明块 |
| 结构 | `.action-panel__head` 横排=阶段图标（32px 描边框，`--space-6`；2026-09-25 用户裁定框 40→32，内图形 `--text-md` 不缩）+「下一步」标题同行；下方正文/按钮/费用分配块纵向 `gap: var(--space-3)` |
| 规则 | 图标随阶段语义+阶段色（2026-09-22 用户裁定多轮：原 GitCommitHorizontal 常青框→沙漏→里程碑→`ChevronsRight` 双箭头，用户选定——下一步行动/现在就动）：genesis=双箭头/黄、locked=锁/品红、unlocked=盾/青、refund=退回/橙（token 同 stage-badge）；数字无；文案全走 `getCopy(locale)` 双语；与参与面板分工=面板管操作、本卡管阶段推进解释，不重复参与引导 |


## 16. CreateForm（创建 Memeverse 表单 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | `/memeverse/launch`（R-04，原 /launch、更早 /memeverse/create；2026-09-23 裁定并入 /memeverse/* 域）发起人表单：身份信息 → 社区链接（选填）→ 创世规则 → 侧栏报价 → 审阅（原型不发交易） |
| 实现 | `components/create/create-form.tsx` + `create-page.tsx`；样式 `app/globals.css .create-*`；读链参数快照 `fixtures/data/create-config.json`（经 `getFixtureCreateConfig`；缺失=null→不渲染+提交禁用） |
| 字段（demo 布局序） | Flash Genesis=**Switch 切换开关**（首项：标签+⊙+开关，base-ui Switch 内联；青=Fast 功能信号）→ logo/名称/Symbol 并排（logo 限 PNG/JPG/WebP、≤3 MB——`accept` 白名单+onChange 二次复核（2026-10-02 用户裁定 3 MB+文案含 WebP；真源不含此值，产品口径），超限/坏类型可见 FieldError、格式体积说明收 ⊙；name/symbol 1–31 字节，SPEC-M8 registration-details §3；错误文案承载字节规则，无可见 hint）→ 创世时长独立行（+「天」后缀；**唯一可见 hint**=「Must be between 1 and 3 days.」，demo 同款；区间来源收 ⊙ tooltip）→ 资金类型/治理链/Omnichains 三下拉（uAsset 白名单；治理链说明收 ⊙；Omnichains=base-ui `Select multiple`，空值显「Select Chains」，治理链必含不可取消——本链 fan-out fee=0 SPEC-M8 §9；**全部 SelectContent `alignItemWithTrigger={false} align="start"`**——弹层落触发器下方禁覆盖，Explore 同款；详情页 participation-panel 三个 Select 同步修）→ 描述（1–255 字节必填，`data-numeric` 字节计数器，textarea 加高至 ~112px）→ **Communities 折叠面板**（边框容器：表头+⊙+chevron；展开=4 输入两列、品牌图标在输入框内——Website URL/X handle/**Discord invite url**/Telegram handle；底部注记「All community links are optional.」——本系统无斜体用 tertiary）。**除时长 hint 外全部字段说明收进 ⊙ `.create-info` Tooltip**。**无初始定价/最低成功额度字段**（非注册参数，SPEC-M8 §3+demo 均无，2026-09-22 用户裁定；OB lifecycle.md:22 张力登记 source-map §6） |
| 校验时机 | **即时（2026-10-01 用户裁定：只改报错时机，name/symbol 不加计数器——计数器仅 desc 有）**：超字节上限（name/symbol >31、desc >255）输入过程中即报（值驱动，无需失焦）；必填缺失失焦后再报（未动过的字段不提前报警）；提交失败仍一次性全显。config=null 时失焦不报时长错误（提交已禁用，参数不可得≠输入错误）。desc 计数器维持现状不复用到 name/symbol |
| 锁定期 | **无输入**：`unlockTime = endTime + FIXED_LOCKUP_DURATION`（365 days 合约常量非参数，config-matrix §3:83）——无常驻「合约固定条款」块，展示=审阅卡「锁定期」行（`config.lockupDays` 天） |
| Symbol 占用 | 同 symbol 上一 verse **创世窗口未结束即锁定**（RegistrationCenter:178 `SymbolNotUnlock`；endTime=注册+durationDays×DAY :186=创世截止——LaunchImpl:311-322；窗口结束 nonce+1→新 uniqueId 即可复用 :189-195）。值驱动即时判定（同字节超限口径）+ 提交拦截；FieldError=`Symbol is temporarily taken. Please try again later.` / `Symbol 暂时被占用，请稍候再试。`——**不带解锁时刻与条件、不加 ⊙ 气泡**（2026-10-02 用户裁定）；可用=静默（无对勾、无计数器）。匹配=精确字节串（大小写敏感、不 trim——合约 mapping(string) 原始字节键；提交按 trim 后值拦截）。样本=`getFixtureOccupiedSymbols`（verses 快照 `stage='genesis'` 行派生，经 create-page 传入）；占用判定生产走链上读值（debounce 后 `previewRegistration`+`symbolRegistry` 读值，revert `SymbolNotUnlock` 解码兜底） |
| 报价 | 一行总额=逐条异链 fan-out（Center quoteSend，中心链目标 fee=0——SPEC-M8 §9「本链」主语=注册中心链，非治理链）+ 异链发起时 发起链→中心链 发送费（RegistrarOmnichain quoteRegister，fixture `remoteSendFee`）；「治理链=注册中心链」为样本场景假设（deployment.md §8 中心链归属[未知]，登记 create-config schema 注释）；quoteRegister 只回总和（AtLocal:56）不暴露逐链拆分——界面只呈现总额（#69）；旧 `quoteState='pending-manifest'` 警告已撤，该字段数据层残留、UI 不消费；随 Omnichains chips 即时重算；审阅卡复列（合计黄字） |
| 链感知 | 钱包连接链=报价「发起链」维度（2026-10-02 用户裁定进创建页）：连接链≠治理链（`GOVERNANCE_TESTNET` 测试网替身映射，vault 卡同款粘合层）→ Total 加 `remoteSendFee`、币种换发起链原生符号（§9 源链一笔支付）；**不显示跨链提示/横幅**——跨链是注册常态（连接链=治理链时只要有其他部署目标照样跨链），提示会造「仅此情况才跨链」歧义（2026-10-02 用户裁定）；未连接=按本链发起处理（vault 先例）。**0 态（Total=0，即本链发起且未选 Spoke）跨链费整块不显示**：卡头+总额+支付说明全隐、报价区仅剩 Launch 按钮，侧栏与审阅卡同口径；quoteEmpty（config 缺失）态不受影响（2026-10-02 用户裁定） |
| 状态 | 提交全量校验（participation 同模式：单次 invalid 标记+字段级 FieldError 不弹窗）；审阅态复用 `.participation-review`（`aria-live="polite"`）；确认=复用「确认原型状态」；返回修改表单保留 |
| 密度 | 控件/chips 40px（`--control-height`）；报价行 44px（`--row-height`）；FieldSet legend 带底边线分组；一屏唯一黄 CTA（Create ↔ 确认互斥出现） |


## 17. PolMintDialog（Mint POL 弹窗 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | Tokenization 标签 POL 卡 Mint 按钮触发的双币供给弹窗（`components/verse/pol-mint-dialog.tsx`；样式 `.pol-mint*` + 复用 `.swap-panel__*` 字段原语；2026-09-24 用户裁定：按钮改弹窗，功能参照 demo 双币供给弹窗、视觉按本站品牌适配） |
| 机制口径 | uAsset + memecoin 按主池配比供给，按实际加池量 1:1 铸 POL（`IMemeverseLiquidityImpl.sol:31` mintPOLToken：双侧 desired/min + deadline；pt-yt-splitter.md:251 POL:主池 LP=1:1）；阶段门=Locked/Unlocked 开放（state-machines.md:47，pol 标签仅这两态渲染） |
| 双侧联动 | 主池全范围两侧等值（OutrunBook pol-splitter.md §What POL is）：输入 memecoin 侧 → uAsset 侧 = 金额 × price；输入 uAsset 侧 → memecoin 侧 = 金额 ÷ price（price=`trade.tokenStats.price` fixture 蜡烛收盘；null 时输入互不联动、报价槽位） |
| 输出推导 | POL ≈ uAsset 侧 ÷ 当前主池价下的 uAsset/POL（全范围 LP 的 uAsset 腿=√主池价，按代币精度对齐；**不得用 `pol.uAssetPerPol` 推导输出**——它是结算时一次性登记的 PT 兑付锚点，主池价格一偏离，精确模式目标就超出双侧预算并回退 `InputAmountExceedsMaximum`）；提交目标=点击时 router `quoteExactAmountsForLiquidity` 现报价，按双侧预算取小后减滑点（`lib/web3/mint-pol.ts`）；Min. received = POL × (1−滑点)；Rate 行同 SwapPanel 主池口径；示意/链上读值/原型未接线类元文案一律不进 UI（含 title 悬浮）——内部开发原型，开发者不需要提示（2026-09-24 用户裁定） |
| 费率反转 | Rate 行挂 `.swap-panel__rate-flip` 幽灵钮（青功能信号，ArrowLeftRight 12px）：默认 `1 {meme} ≈ price {uAsset}`，点击翻 `1 {uAsset} ≈ 1/price {meme}`（toFixed(6)；price≤0/缺失时禁用）——Swap 卡同款同款态（2026-09-24 用户裁定，两处共用 CSS 与 copy.swapRateFlip） |
| 设置层 | 头部幽灵齿轮 → Popover 滑点 0.1/0.5/1%+自定义、截止 10/20/30min+自定义（唯一实现=共享设置层组件 `components/global/swap-settings.tsx`——2026-10-08 由 swap-panel/pol-mint/pool-add/pool-remove/pol-flash 五处逐份复制收敛（P0-2），预设常量随迁 `components/global/slippage-input.ts`；tip 文案为 mint 语境「铸造将回退」）；自定义滑点校验=§25 口径（2026-10-03 迁移：`getSlippageIssue`+FieldError，error id 走 useId，越界 Min. received/最大滑点行退 '--' 槽位）；deadline 自定义输入同轮迁移拍板 A 整分钟口径（`slippage-input.ts` 导出 `isWholeMinutes`：留点清洗 sanitizeAmount + 非整分钟 FieldError `deadlineWholeMinutes`，空/0 仍回退 1 分钟——既有行为保留；受控值 2026-10-08 改存 string 原样展示、推导经 `deadlineToNumber`——旧 number 状态在键入路径吞点使拍板 A 仅粘贴可达，P1-1 修） |
| 余额/Max | 输入卡=字段头（左 `mintSideMeme`/`mintSideUasset` 标签 + 右 `Balance: {formatAmount}`（`pol.myMemecoin`/`pol.myUAsset` fixture 样本，`data-numeric`）+ **Max 可点**（点击填入该侧全部余额并按池内配比推导另一侧，2026-09-24 用户裁定：造余额样本使 Max 可用；样本取值保证 meme×price ≤ myUAsset 不越界）；≈$ 换算行在输入下方（同 SwapPanel）；输出卡 Balance=`pol.myPol` fixture 真值 |
| CTA | 未连接=Connect Wallet 可点（`useAccountCenter` 全站共享开关；fixture 构建走 harness toggle、onchain 开选择器）；已连接=审阅→Type-4 会话执行（无执行条件时保持禁用，无伪造成交、无提示文案）；关闭=头部 ✕ / Esc / 遮罩外点（base-ui Dialog 内置） |
| 触发器 data-slot | `DialogTrigger render={<Button/>>` 的 props 合并会把 Button 的 `data-slot="button"` 覆写为 `dialog-trigger`，而主题桥皮肤（标签区「青色控制台」40px/青 tinted 描边等）按 `[data-slot='button']` 匹配——触发器必须显式传 `data-slot="button"` 钉回，否则与同排按钮皮肤不一致（2026-09-24 踩坑） |
| 文案 | `getCopy(locale).verseDesk`：mintDialogTitle/mintSupply/mintSideMeme/mintSideUasset/mintYouReceive/mintSettingsTitle/mintSlippageTip/mintDeadlineTip + 复用 balance/max/swapRate/minReceived/maxSlippage/slippageTolerance/transactionDeadline/swapCta；`common.close` 供 ✕ aria-label |


## 18. VaultActions（Yield Vault 操作卡 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | Verse 详情 Yield Vault 标签操作卡（`components/verse/vault-actions.tsx`；2026-09-24 用户裁定按 demo.outrun.build/memeverse 布局重设计：Tabs → Amount 卡 → Details 卡 → 全宽 CTA → 脚注；**2026-09-27 用户裁定改双列 `.vault-actions`**——原三标签单卡通栏把 swap 窄卡原语拉到 ~1100px 内容稀疏，改左列 Stake 常驻卡（`__bar-label` 静态卡头）+ 右列 Redeem/Withdraw 标签切换卡，列比/断点随 POL 先例 1.15:0.85、<1024px 退单列、双卡自然高；两列金额状态独立（`stakeAmount`/`redeemAmount` 不串值）；样式 `.vault-card*` + 复用 `.swap-panel__field/__details/__cta` 原语） |
| 机制口径 | vault 全部操作（stake/redeem/withdraw）走治理链（OutrunBook omnichain.md §The governance chain）；跨链质押=Memecoin 经 LayerZero 跨到治理链入库存份额（omnichain.md §Cross-chain staking）；赎回两步异步、REDEEM_DELAY=1 days（`MemecoinYieldVault.sol:22`）；跨链费=LayerZero 发送时报价、按源链原生币精确支付（omnichain.md §Cross-chain reliability），无 fixture 字段 → 明细行槽位 `--` + ⊙ 气泡 `crossFeeNote` |
| 链感知 | 连接网络 = header GS-2 链选择器**唯一入口**（2026-09-24 用户裁定：卡内网络芯片删除）——选择器读写账户中心 `chainId`（`useAccountCenter`，默认 chains[0]；仍写 URL `?chain=` 供 discovery 过滤）。vault 判定「在治理链」用治理链主网 id→测试网对应链映射（1→11155111/8453→84532/56→97，模拟粘合层非领域数值）：连接且不同 → Stake 进跨链模式（青 tinted 横幅 + Cross-chain fee 行 + CTA `stakeCrossCta` 跨链存入，禁用）、Redeem/Withdraw 的 CTA 变 `switchChainCta`「Switch to {治理链}」**可点**=switchChainAction 切到治理链对应测试网（非链上写，header 触发器同源联动）；切回后恢复正常 CTA（禁用） |
| 兑换率方向 | Stake 行 `1 {symbol} ≈ (1/assetsPerShare) {s-symbol}`、Redeem 行 `1 {s-symbol} ≈ assetsPerShare {symbol}`（demo 同向；到账=amount÷/× assetsPerShare） |
| 余额/Max | Redeem Balance=`staking.myShares` fixture 真值 + Max 可点填入；Stake Balance=`pol-positions.myMemecoin` 样本（样本账户本 verse memecoin 余额，2026-09-26 复用 POL Mint 供给侧样本）+ Max 可点填入，无 pol 记录→槽位 `--`+禁用 |
| 状态列表 | 赎回状态列表收进操作卡标签内（原 `.vault-panel__lists` 卡外双列已删）。页签序=Redeem / Pending / Withdraw；Pending 为独立页签（原挂 Redeem 标签尾会把右列撑高、左列 Stake 下方留大片空白）：`__status-head` 左 `panel-subtitle` 标题+右笔数（站点滚动条全站隐藏，笔数=溢出提示）；`.vault-card__list--scroll` 仅等待中逐笔：金额（memecoin 资产口径=链上 `lockedAssets`，份额在请求时已销毁；`--text-sm`−1px mono；≥1M 走 M/B 两位小数 `formatMarketCap`，以下保留千分位完整值）+ 请求日期（纯 `formatDay` 输出、UTC+8 口径，无前缀文案）+ 走秒倒计时 `remaining{t}`（`RedeemCountdown`：repository `remainingMs` 快照剩余起按墙钟每秒递减、到 0 停表——纯展示 tick 非链上写；黄纯文本 `data-state=waiting` 无框、nowrap 右锚——窄屏不得折成两行挤压左侧金额/日期；日期/倒计时 `--text-xs`）；四行封顶（max-block-size=4×`--status-row-height`（=`--row-height`+4px））内部滚动。Withdraw 标签头=Ready to Withdraw（仅已成熟逐笔：金额 + `readySince{date}`（=maturesAt 成熟日）+ `✓ ready` success 描边徽章 `data-state=ready`），后接 Total available 行→CTA；任一为空→该区 `--`；样式 `.vault-card__list/__list-main`（行高 `--row-height`+4px、hover 青 2px 选择线） |
| 委托（Q9） | Stake 明细行内 `Myself/Custom address` 选项（`.vault-actions__delegate-option[data-selected]`，青选中态），默认自己；选 Custom address → 明细卡与 CTA 之间出现地址输入卡（`.swap-panel__field` 原语，`data-numeric` 等宽，maxLength 42、输入去空白），非空且不匹配 `^0x[0-9a-fA-F]{40}$`（EVM 口径=治理链族 Ethereum/Base/BNB，大小写均收不校验 EIP-55）→ FieldError `delegateAddressError` + `aria-invalid`/`aria-describedby`，空值不报错；切回 Myself 收起输入卡、已输入值保留；CTA 维持禁用（原型纪律）；`Delegate to` 标签旁 ⊙ `.create-info` 气泡=delegateNote（2026-09-26 用户裁定：原正常态/跨链双态脚注删——委托说明收进气泡，卡底脚注仅跨链态留 crossNote，正常态无脚注，核验份额口径 omnichain.md:51） |
| CTA | 未连接=Connect Wallet 可点（全站共享开关）；已连接且治理链=操作 CTA 禁用、无解释文案（原型不伪造链上写；读值槽位类解释文案 2026-10-05 用户裁定全站废止）；一屏一个主 CTA——2026-09-27 双列裁定后：左列 Stake 走黄 `.swap-panel__cta` 通道（唯一主行动），右列 Redeem/Withdraw 的操作/未连接/切链 CTA 一律 outline 青档（同 POL 标签操作钮先例） |
| 文案 | `getCopy(locale).verseDesk`：crossBannerTitle/crossBannerSub/crossBannerBody/stakeCrossCta/switchChainCta/crossFee/crossFeeNote + 复用 amount/balance/max/exchangeRate/youReceive/youReceiveAfter24h/stakeCta/redeemCta/withdrawAll/delegate*（delegateNote=气泡）/crossNote + 状态列表 pendingTab/pendingRedeems/readyToWithdraw/readySince/remaining/ready（withdrawNote 脚注 2026-09-26 用户裁定删——CTA 与 Total 行已表意，冗余；redeemNote 脚注 2026-09-27 用户裁定删——UI 自明：到账行 (after 24h)+Pending 列表倒计时+Withdraw 标签已表意两步流，期间无收益无投票权不再复述） |


## 19. PT/YT 双生井（`.pol-twin` · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | Tokenization 标签 PT/YT 衍生卡（`verse-tab-panels.tsx` PolPanel 内）。沿革：换向器 `.pol-flow`（2026-09-25）与可领创世 YT 条 `.pol-claim` 于 2026-09-27 用户裁定删除；同日第二轮裁定 Balance 无用、重构为双生井；v3（2026-09-28 用户裁定「井纯读对称」）：井底无钮、机制等式升为井组头 `.pol-twin__equation`（`1 POL-<SYM> = 1 PT + 1 YT` mono 三级色+⊙ splitNote——一眼解释两井 USD 等值与三操作存在，与左 seam 分缝成「左符号右公式」）、操作统一井组下通栏；claim 机制 UI 入口随裁定撤销 |
| 井读数 | **账目行 label=名义价值（nominalValue 键）+⊙ ptNominalTip/ytNominalTip**（2026-09-28 用户裁定：须明示井显示的是名义价值而非市场价格——PT 的市场价在 PT/uAsset、PT/POL 池，YT 的市场价=闪电兑换隐含价）；值=纯数字（单位基准由井身份承载——值内不再带 `1 PT ≈` 前缀，一行一个语义中心；2026-09-28 二轮裁定）：PT 井 `{uAssetPerPol} {raiseAsset}` 固定兑付率（创世锁仓一次性登记——`MemeverseLiquidityImpl.sol:239`，locked/unlocked 皆已确定，非 1:1——2026-09-25 对账裁定；符号 v3 统一 `≈`——固定锚定语义由 ⊙ 承载，`=`/`≈` 微差读作笔误 2026-09-28 废弃）；YT 井 `1 YT ≈`（名义价值，**双腿形态**——2026-09-28 用户裁定，pol-splitter.md「YT 结算兑付=uAsset+Memecoin 两币」）：memecoin 主腿两阶段皆有（locked=推导：1 PT+1 YT=1 POL=M meme+U uAsset、PT 固定吃掉 uAsset 侧 → 残差名义=meme 侧=uAssetPerPol÷主池价；unlocked=结算样本 `{ytRedeemMemecoinPerUnit}`）+ uAsset 次腿同档同色（2026-09-28 用户裁定：双腿对等兑付口径，原次级色降一档废弃；两阶段皆 `+ {ytRedeemUAssetPerUnit}` 样本：unlocked=结算派生真值、locked=结算预估样本——2026-09-28 用户裁定造数看原型效果，gen-pol-yt-uasset-leg.mjs 锚 unlocked 量级 ≈uAssetPerPol 3–5%）；腿/价缺失='--'；美元回声行 `≈ ${腿×uAssetUsd}`（uAsset 计价；unlocked YT=(meme腿×price+uAsset腿)×uAssetUsd；缺样本=不渲染），hairline 上缘**左锚标签列起点**（v3：右挂孤行+死区废弃） |
| 钮位 | **无井底钮**（v3 2026-09-28：井=纯读对称，PT 井不再是无出口死终点）；操作统一井组下通栏 `pol-card__btns`：locked=[Flash Swap §26 | Split §20 | Merge §20] 三等宽、unlocked=[Redeem PT §21 | Redeem YT §21] 两等宽——跨阶段操作位置统一；余额展示在弹窗 Balance/Max；卡内中档 32px |
| 样式 | 抬升面仪器盒：surface-raised+hairline+对角双切 `--chamfer`，与分缝/章同语言；**满宽纵叠**（2026-09-27 当日第三轮裁定：并排井仅 ~174px 宽致多腿折行、钉底对齐又在矮井拉出死白），账目行=`__quote`（label 左/腿右同行，腿 16px mono），两井内容同构自然等高，无需媒体查询；**顶缘身份刻线**（v3）：`__well[data-token='pt']` 青 55% mix / `yt` 品红 55% mix（1px 回声管制内），开角双切自然截去顶线左端起段成内缩刻线 |
| 文案 | 「1 PT ≈」「1 YT ≈」为结构化 token 记法非 copy；ptTip/ytTip ⊙ 气泡不变；ptBalance/ytBalance/claimableYt/claimYt/claimYtEligibility 随裁定删除 |


## 20. PolSplitMergeDialog（Split/Merge 操作弹窗 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | PT/YT 井组下通栏操作行 locked 态钮 2/3 触发的操作弹窗（`components/verse/pol-split-merge-dialog.tsx`，`mode='split'/'merge'` 单组件两态；2026-09-26 用户裁定：两钮从恒禁用改弹窗做实际操作；2026-09-28 v3 从通栏第二/三枚随操作区统一迁移；壳/原语复用 `.pol-mint` + `.swap-panel__field/__details/__cta`，无新 class） |
| 机制口径 | Split=1 POL → 1 PT + 1 YT（`IPOLSplitter.sol:102`）、Merge=等额销毁 PT 与 YT 换回同额 POL（`:104`，同一 amount 两侧 burn）——严格 1:1，合约无滑点/无 deadline 参数 → **不设设置齿轮**（与 Mint 弹窗的结构差异=机制差异）；闸门仅 locked（unlocked 态由 §21 Redeem 钮接替，2026-09-27） |
| 联动/Max | split：单输入 POL、Max=全部 `myPol`；merge：PT/YT 双输入恒等额联动（单状态驱动两框），两框各挂 Max、同填 `min(myPt, myYt)`（Max 语义=最大可合并对数——单侧全额会破另一侧约束；2026-09-26 用户问「为何只有 YT 有 Max」后改双挂）；可填额 ≤0（merge=min(PT,YT)、split=`myPol`）→ Max disabled（2026-10-09 用户裁定「Max 按钮是坏的」：`amountToInputString(0)` 返回空串、点击零可见效果=死按钮观感；对齐 §22 pool-add 既有 null/≤0 禁用先例） |
| 估值 | 无换算行（2026-09-26 用户裁定删 split 输入 ≈$；PT/YT 本就无独立价样本） |
| 明细 | Rate 行与输出区删（2026-09-26 用户裁定第二轮：1:1 恒等，结果=输入的复述，冗余）——弹窗=输入+CTA |
| CTA | 同 Mint 弹窗：未连接=Connect Wallet 可点切换连接（`useAccountCenter`）；已连接=审阅→Type-4 会话执行（无执行条件时保持禁用，无伪造成交、无提示文案） |
| 触发器 data-slot | 同 §17 踩坑：`DialogTrigger` 显式 `data-slot="button"` 钉回，否则主题桥皮肤不匹配 |
| 文案 | `splitDialogTitle`/`mergeDialogTitle`（2026-09-26 新增）+ 复用 splitPol/mergePol/balance/max/swapCta/`common.close` |


## 21. PolRedeemPtYtDialog（Redeem PT/YT 操作弹窗 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | PT/YT 井组下通栏操作行 unlocked 态两钮触发的操作弹窗（2026-09-28 v3 从井底迁通栏；`components/verse/pol-redeem-pt-yt-dialog.tsx`，`mode='pt'/'yt'` 单组件两态；2026-09-27 用户裁定：unlocked 删 split/merge UI、补燃烧/赎回 PT/YT 功能；壳/原语复用 `.pol-mint` + `.swap-panel__field/__details/__cta`，无新 class） |
| 机制口径 | Redeem PT=`POLSplitterUpgradeable.sol:365` 销毁 PT 按创世锁仓一次性登记的固定比率兑回 uAsset（`_ptToUAsset:470`，比率=`mainPoolUAssetUsed/mainPoolPOLRawAmount`——`MemeverseLiquidityImpl.sol:239`，即 fixture `uAssetPerPol` 口径，非 1:1——2026-09-25 对账裁定）；Redeem YT=`:387` 销毁 YT 按份额领结算剩余池两币（uAsset+memecoin，每份率=池×份额/流通 YT，`:404-405`）。闸门仅 unlocked（unlock 自动 settle——`MemeverseSettlementImpl.sol:536-537`；locked 态不渲染赎回行）；合约无滑点/deadline → 不设设置齿轮 |
| 联动/Max | 单输入（PT 框余额=`myPt`、YT 框=`myYt`），Max=各自全额；销毁币余额 ≤0 → Max disabled（2026-10-09 同 §20 裁定：空串填充=死按钮观感）；props `price`/`uAssetUsd`（美元行换算源，同卡片井读数）；打开为空输入（2026-10-08 用户裁定：金额输入默认空 0.00，废除 2026-09-27 打开预填口径；清空/改数照常重算） |
| 明细 | 2026-09-27 第三轮参照图裁定改双框：输入框（label=burnLabel）+ Receive 独立框（同输入框款式、只读 `output`+代币章；PT=单框 uAsset 章、YT=双腿合一个框（memecoin 主腿在前与井读数同序、行间 hairline=`.swap-panel__field-row ~ .swap-panel__field-row` 仅多 row 时生效——单 Receive 标签管两腿，2026-09-27 第四轮裁定：双框版第二框空标签行观感残缺）；rate 缺样本=随空值 0.00）+ 每框下 ≈$ 美元行（2026-09-27 用户裁定补：uAsset 腿×uAssetUsd、memecoin 腿×主池价×uAssetUsd，样本缺→不渲染）——You receive 明细行随之删除（信息不重复；非 1:1 恒等、与 §20 删输出区裁定不冲突）：PT=`amount × uAssetPerPol {raiseAsset}`；YT=`amount × ytRedeemUAssetPerUnit {raiseAsset} + amount × ytRedeemMemecoinPerUnit {symbol}`（fixture `ytRedeem*PerUnit` 可选样本——仅 unlocked polp 记录携带；双缺=随空值 0.00）；note 行 2026-09-27 用户裁定两轮全删（先 PT 后 YT——等式/You receive 已示比率与产出，冗余；「以链上读值为准」标注 2026-10-05 用户裁定全站废止） |
| CTA | 同 §20：未连接=Connect Wallet 可点切换模拟连接；已连接=Redeem PT/Redeem YT 禁用（原型不伪造链上成交） |
| 触发器 data-slot | 同 §17 踩坑：`DialogTrigger` 显式 `data-slot="button"` 钉回 |
| 文案 | `redeemPt`/`redeemYt`（钮与弹窗标题同文案）+ `burnLabel`/`receiveLabel`（2026-09-27 双框化新增）+ 复用 balance/max/swapCta/`common.close`；屏幕术语按 OutrunBook「redemption/赎回」（pol-splitter.md §Redemption only after settlement），不写 Burn |


## 22. PoolAddLiquidityDialog（Add Liquidity 弹窗 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | Liquidity 标签池卡 Add Liquidity 钮触发的双币供给弹窗（`components/verse/pool-add-liquidity-dialog.tsx`；2026-09-27 用户裁定：钮文案 `Add liquidity`→`Add Liquidity` 且恒禁用改弹窗，同日再裁定池卡钮短文案 `Add`（`addLiquidityShort`，弹窗标题/CTA 仍全称），功能结构同 §17 Mint 弹窗；壳/原语复用 `.pol-mint` + `.swap-panel__field/__details/__cta`，无新 class；触发器行样式与卡内 32px 中档走 `.pool-card__actions` 组（2026-09-27 双钮裁定，见 §24）） |
| 机制口径 | 四池统一=router addLiquidity：双侧按池配比供给、铸 **LP 代币**给 to（`IMemeverseSwapRouter.sol`，双侧 desired/min+deadline）。**2026-09-27 用户裁定：Add Liquidity 收 LP 而非 POL**——主池按加池量 1:1 铸 POL 的 mintPOLToken 入口（`IMemeverseLiquidityImpl.sol:26-31`）归 Tokenization 标签 Mint 弹窗（§17），两入口机制分立 |
| 输出推导 | LP 铸得 = quote 侧 × `pool.lpPerQuote`（markets fixture 铸得率样本，totalSupply/R_quote v2 式口径、费累积使比率<1；`gen-market-lp-rate.mjs` 幂等生成，80 行全覆盖）；Min received = LP × (1−滑点)；缺样本池获得侧/Min received 才随空值 0.00/'--'（读值槽位 2026-10-05 用户裁定全站废止；2026-09-27 用户裁定：造样本出数不留空槽）；获得侧无 Balance 行（无 LP 余额 fixture）。**LP 名 = `{baseSymbol}/{quoteSymbol} LP`**（池卡交易对同口径 + LP 后缀，四池各得专名；v4 仓位制无 ERC20 LP 命名真源，展示层命名——2026-09-27 用户裁定不统称 "LP"） |
| 双侧联动 | 池配比 1 base=ratio quote：主池=`tokenStats.price`、POL/uAsset=fixture `marketPricePerPol` 样本；PT 两池=**锚定汇率推导样本**（2026-09-27 用户裁定造样本出数，不再不联动/'--'）：PT/uAsset 池 1 PT=`uAssetPerPol` uAsset（`MemeverseLiquidityImpl.sol:239` 固定兑付）、PT/POL 池再按 POL/uAsset 市场价折算 1 PT=`uAssetPerPol÷marketPricePerPol` POL；pol 记录缺失 → 退不联动/'--'；Rate flip 同 §17 |
| 余额/Max | 供给侧余额按池取 pol-positions 样本：主池=myMemecoin/myUAsset、POL/uAsset=myPol/myUAsset、PT/uAsset=myPt/myUAsset、PT/POL=myPt/myPol；pol 记录缺失（LiquidityPanel 接 `pol` 可空）→ 余额 '--'+Max 禁用；Max 点击填入该侧全额并按配比推导另一侧 |
| 估值 | ≈$ 换算行仅可推导侧显示：base 侧主池（×price）、POL 池（×marketPricePerPol）、PT 侧=锚定汇率（×uAssetPerPol）；quote 侧 uAsset 计价=1、PT/POL 池 quote=POL（×marketPricePerPol）；uAssetUsd 样本缺失全隐 |
| 设置层 | 同 §17：头部齿轮 Popover 滑点+deadline（共享组件 `components/global/swap-settings.tsx`，预设常量在 `components/global/slippage-input.ts`——2026-10-08 五处复制收敛（P0-2），swap-panel 不再充当共享常量模块；tip 为加池语境 `addLiquiditySlippageTip`/`addLiquidityDeadlineTip`）；自定义滑点校验同 §25 口径（2026-10-03 迁移，error id 走 useId——每张池卡一实例防 id 相撞） |
| CTA | 同 §17：未连接=Connect Wallet 可点切换模拟连接；已连接=Add Liquidity 禁用（原型不伪造链上成交，无提示文案） |
| 触发器 data-slot | 同 §17 踩坑：`DialogTrigger` 显式 `data-slot="button"` 钉回 |
| 文案 | `addLiquidityShort`（池卡钮短文案 `Add`，2026-09-27 裁定）+ `addLiquidity`（CTA 全称）/`addLiquidityDialogTitle`/`addLiquiditySettingsTitle`/`addLiquiditySlippageTip`/`addLiquidityDeadlineTip`（2026-09-27 新增）+ 复用 mintSupply/mintYouReceive/balance/max/swapRate/swapRateFlip/minReceived/maxSlippage/slippageTolerance/transactionDeadline/swapCta/`common.close` |


## 23. PolRedeemLpDialog（Redeem POL 弹窗 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | Tokenization 标签 POL 资产卡 Redeem 钮触发的赎回弹窗（`components/verse/pol-redeem-lp-dialog.tsx`；2026-09-27 用户裁定：恒禁用改弹窗，POL 赎回成主池 LP 代币；壳/原语复用 `.pol-mint` + `.swap-panel__field/__details/__cta`，无新 class） |
| 机制口径 | 销毁 POL 按主池构造 **1:1** 换回主池（memecoin/uAsset）LP 代币（`MemeverseLiquidityImpl.sol:861/888` `amountInLP=amountInPOL`——:841 注释；`IMemeverseLiquidityImpl.sol:64`）。unwrap=false LP 直转非价格敏感（`:850-852`）→ 合约无滑点/deadline，**不设设置齿轮**（unwrap=true 拆 memecoin+uAsset 两币的 6 参滑点入口不进原型）。闸门仅 unlocked（`:857/884` NotUnlockedStage；OutrunBook lifecycle.md:18/97 From Unlocked；fixture 域 pol 持仓仅 locked/unlocked，渲染域与旧 `!locked` 等价） |
| 联动/Max | 单输入（余额=`myPol`），Max=全额；打开为空输入（同 §21 2026-10-08 裁定） |
| 明细 | You receive 一行=`amount {MEME}/{uAsset} LP`（主池对口径 lpSymbol，同 §22/§24 惯例——链上 ERC20 全池静态同名 symbol `MLP`/name `Memeverse LP`（`SwapFacet.sol:313`），按池区分靠对口径；1:1 恒等但 POL→LP 代币身份不同、非 §20 输入复述 → 保留；机制恒等无槽位态、无 Rate/note/≈$ 行——§21 同款删冗余口径） |
| CTA | 同 §21：未连接=Connect Wallet 可点切换模拟连接；已连接=Redeem 禁用（原型不伪造链上成交） |
| 触发器 data-slot | 同 §17 踩坑：`DialogTrigger` 显式 `data-slot="button"` 钉回 |
| 文案 | `redeemPol`（钮/CTA 同文案）/`redeemPolDialogTitle`（2026-09-27 新增）+ 复用 youReceive/balance/max/swapCta/`common.close`；术语按 OutrunBook「redemption/赎回」（lifecycle.md:97 Burn POL to redeem） |


## 24. PoolRemoveLiquidityDialog（Remove Liquidity 弹窗 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | Liquidity 标签池卡 Remove 钮触发的移除流动性弹窗（`components/verse/pool-remove-liquidity-dialog.tsx`；2026-09-27 用户裁定：池卡新增 Remove 钮移除流动性、Add 同步短文案，双钮收进 `.pool-card__actions` 行尾组（flex+space-2+auto-margin，原 `.pool-card > button` 单钮规则退役）；壳/原语复用 `.pol-mint` + `.swap-panel__field/__details/__cta`，无新 class；触发器同走卡内 32px 中档） |
| 机制口径 | 四池统一=router removeLiquidity：burn **LP 代币**（uint128 liquidity）按池配比双侧取回，amount0Min/amount1Min+deadline（`IMemeverseSwapRouter.sol:292-300`，:308 "LP liquidity to burn"）——双侧 min 即滑点保护，保留设置齿轮（tip 为移除语境 `removeLiquiditySlippageTip`/`removeLiquidityDeadlineTip`）；自定义滑点校验同 §25 口径（2026-10-03 迁移，error id 走 useId，越界 minQuote/minBase 双值与最大滑点行同退 '--'）；deadline 整分钟校验同 §17 拍板 A |
| 输出推导 | §22 铸得反向：quote 取回 = burnLP ÷ `pool.lpPerQuote`、base 取回 = quote ÷ ratio（PT 两池 ratio=锚定推导样本，同 §22；pol 记录缺失随空值 0.00）；Min received 一行双值 `minBase {base} + minQuote {quote}`（对应合约双侧 min，各自仅可推导侧显示）；输出区排版=§21 单框单标签模式：base/quote 两腿合一个 `swap-panel__field`、单 mintYouReceive 标签管两腿（2026-10-03 对齐 2026-09-27 §21 参照图裁定——原双框双标签系复用 mint 壳漂移，行间 hairline 由 `.swap-panel__field-row ~ .swap-panel__field-row` 提供） |
| 输入侧 | 单输入=burn LP 数量（Balance/Max；余额=pol-positions `myLp` 四池样本——`gen-pol-my-lp.mjs` 幂等生成，量级锚=各侧持仓×供给比例×lpPerQuote）；pol 记录缺失 → '--'+Max 禁用；不预填（同 §22；2026-10-08 起全站金额输入打开一律空——§21/§23 打开预填口径同日废除） |
| Rate | 同 §22 池对汇率：1 base ≈ ratio quote（flip 反向）——赎回两币的池内配比（2026-09-27 用户裁定：不显示 LP↔quote 铸得率换算；同日裁定 PT 池配比出数不再 '--'） |
| 估值 | ≈$ 同 §22 口径：base 侧主池/POL 池市场价样本、PT 侧=锚定汇率 uAssetPerPol；quote 侧 uAsset=1、PT/POL 池 quote=POL（×marketPricePerPol）；uAssetUsd 缺失全隐 |
| CTA | 同 §22：未连接=Connect Wallet 可点切换模拟连接；已连接=Remove 禁用（原型不伪造链上成交） |
| 触发器 data-slot | 同 §17 踩坑：`DialogTrigger` 显式 `data-slot="button"` 钉回 |
| 文案 | `removeLiquidity`（钮/CTA 同文案）/`removeLiquidityDialogTitle`/`removeLiquiditySettingsTitle`/`removeLiquiditySlippageTip`/`removeLiquidityDeadlineTip`/`removeBurn`（输入侧标签，合约 burn 语义；2026-09-27 新增）+ 复用 mintYouReceive/balance/max/swapRate/swapRateFlip/minReceived/maxSlippage/slippageTolerance/transactionDeadline/swapCta/`common.close` |

## 25. SwapPanel 代币选择（Swap 卡双侧可选 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | Swap 卡输入/输出侧代币芯片（`.swap-panel__token--select` 幽灵描边钮：符号+下箭头，hover/focus 转青）点开选择弹窗（`components/verse/swap-token-select-dialog.tsx`；2026-09-27 用户裁定双侧可选）。弹窗结构=标题+✕+搜索+行列表（AssetSelector §2 变体），壳复用 `.pol-mint`；**受限集合不设「常用/全部」分组**、搜索按符号/名称过滤 |
| 可选集 | 用户裁定 2026-09-27：稳定侧=募集 uAsset + 其 PSM 配对储备（psm.json 按 uAssetId 过滤，`getFixtureParticipationOptions().reserves` 出口）；Meme 侧=memecoin/POL/PT（**YT 不入卡**——2026-09-27 方案 B 用户裁定：Flash Swap 是 POL↔YT 单通道工具且买卖均指定 YT 数量，卡的 exact-in 双侧配对模型无法表达，移入 §26 YT 井专属弹窗；同轮删除真源不支持的 uAsset↔YT 复合路由）。翻转钮只换方向（集合跟侧走：当前输入侧在稳定侧则弹稳定集）。**行名=代币本名**（2026-09-27 用户裁定：机制标签不得当名字显示——储备行=assets.json `name` canonical 名如 Ethereum/USD Coin（缺失回退 symbol），uAsset 行=mintSideUasset，memecoin=verse.name，POL/PT=polTag/ptFullName）。**无接线对行禁用**（onchain 构建）：2026-10-27 起储备行改为**可选**——Memeverse Router 新增 exact-in 储备腿入口 `swapExactInToReserve`（卖出：memecoin→uAsset swap + PSM 赎回，一次调用完成），买入方向由批次 `approve reserve→PSM、PSM.mint、approve uAsset→router、swap` 组合，两者都是 exact-in；`swapPairUnavailable` 因此只在部署缺 PSM 对或报价解析失败时出现；POL/PT 行 2026-10-27 起接线各自动池（POL↔uAsset、PT↔uAsset——router `getHookPoolKey` 通用池键+同一 `quoteSwap`/`swap` 管线，PT 地址=splitter `getPT` 每 verse 读一次缓存）；fixture 构建全行可选（基线不变）；当前已选即无接线对时 CTA 以同一原因文禁用。**Symbol 字体=展示字+单青错版回声**（2026-10-26 用户裁定美化代币符号字体与配色、不加图标）：芯片与选币行符号走 `--font-display`（Saira Condensed）semibold+0.04em 字距+`-1px -1px 0 --or-cyan` 硬边错位影（hero ticker 错版语言缩小版；品红小字禁——决议 015 只留青单侧；无模糊非 glow；数字仍归 `[data-numeric]` 等宽红线管辖）；图标维持既有两层——有官方/品牌资产的代币（uAsset 品牌章、储备官方图标）显图标、无资产品类（memecoin/POL/PT）二字徽章 |
| 报价口径 | 双层：**可执行对（uAsset↔memecoin/POL/PT，meme 腿各走自动池）连接态=live 报价**（`components/verse/swap-live-quote.ts` 经钱包 provider `quoteSwap`：输入 debounce 400ms、10s 定时刷新（tab 隐藏暂停、回前台即刷）、latest-wins、池键/decimals/会话走共享缓存只读一次；点击前按 quote key 验 TTL≤10s，键不符或过期才补读）——输出/最低到账（`minOutOf`=out×(1−滑点) 整数取整，与 spec `amountOutMinimum` 同式）/价格冲击全用链上值；**兑换费率行=同一 live 报价自带的 `feeBps`**（`quoteSwap` 一次 preview 同时定费率与量——`DynamicFeeFacet.quote` preview 与执行同式，无额外 RPC；动态费率无参考回退，无 live 报价='--' 槽位；2026-10-27 用户裁定以费率行替原 Max. slippage 明细行——滑点留在设置层齿轮）；**报价在途（去抖窗口/拉取中）=输出槽 pending spinner+CTA 锁「正在获取报价」，不回退线性换算**（2026-10-27 用户裁定「模仿 uniswap」：spot×输入 与深路由真实成交可差数量级，本地线性估算禁止当报价显示；仅读失败才回退）；**价格冲击=1−报价÷(同时钟现货×输入)−兑换费率**（2026-10-27 用户裁定「模仿 uniswap」：Uniswap `computeRealizedPriceImpact` 口径——参考与报价同一时钟、总量对总量（`spotReferenceOf`=单位现货×输入，`midPrice.quote(input)` 形状；review 修正：单位现货直除总量输出只在输入=1 时碰巧成立）、fee 剔除由费率行单列；参考=`readSwapSpotOutPerIn`（`execution-reads.ts`）在同一轮询 `Promise.all` 里读 hook `cachedLpTotalSupply`→router `quoteAmountsForLiquidity` 全区间推导（比率=当前 sqrtPrice 现货，与 SSR 交易台同式）；废原「SSR 页载参考换算」口径——参考随页冻结而报价实时，池价漂移会伪装成冲击（1 UUSD 误报 12.1% 案例）；现货腿失败只降冲击行='--'，报价本身不受影响）（clamped ≥0；固定 2 位小数、`>0` 且格式化为 `0.00` 时显 `<0.01%`（2026-10-27 用户裁定「模仿 uniswap」，`formatPercent` 第三参固定精度）；≥5% warning 黄 / ≥20% danger 红+**CTA 直接禁用（文案「价格影响过高/Price impact too high」，不进确认弹窗**；2026-10-27 用户裁定阈值 20%——宽于 Uniswap `BLOCKED_PRICE_IMPACT_NON_EXPERT` 的 15%，废原二次确认；无报价或无现货 '--'，硬编码假值已废）；**无 live 报价（断连/fixture/读失败）=SSR 参考价线性换算回退**：每代币 uAsset 计价——uAsset=1、储备=PSM 面值 1:1 平价（OutStake）、memecoin=主池价、POL=`marketPricePerPol`、PT=`marketPricePerPol×ptPricePerPol`（onchain 构建的市场价=真实链上数据非样本；fixture=样本面）；率=卖出价÷买入价，任一侧缺样本→'--' 槽位。**Rate 行文案 zh=汇率/en=Rate**（2026-10-27 用户裁定，废「参考价」）；**live 可用时值=报价 out÷输入**（费率与冲击已含入、随报价实时重算），无报价态才显参考换算率；**默认方向=输入侧代币在左**（`1 {sell} ≈ N {buy}`，随方向翻转钮跟随输入/输出侧；2026-10-26 用户裁定）；该行单行不折行（≤640 wrap 豁免+尾部省略兜底） |
| 余额/估值 | 行余额=uAsset/储备(myReserve 样本——2026-09-28 用户裁定造数，gen-pol-my-reserve.mjs 锚 myUAsset 20–60%，null 槽位)/myMemecoin/myPol/myPt；**onchain 构建连接态=钱包探针现读覆盖（`components/verse/trade-balances.ts`；断连/错链='--' 槽位、SSR 恒账号空；读走 Multicall3 依赖序三批（PT/YT+储备解析→LP 代币地址→余额/vault/队列）——~4 请求替代 20+ 并发 eth_call（≤50/批同服务端 §9.1 口径，allowFailure 逐腿 revert 不炸批，并发请求打限流正是余额瞬断根因）；探针失败隔离：可选腿（PT/YT 解析、PSM 储备、vault、LP）revert 只降级该腿不清空全卡，核心腿（memecoin/uAsset/pol）失败保 '--' 禁造 0，失败有界重试 3×4s——单腿瞬断不再整卡 '--' 钉死；PT/YT 与未建流动性的池 LP 代币均解析为零地址、按无合约同型降级；任何确认写（含他组件的）经 verse-write-signal 页级信号触发本批重读；provider 异步注册竞态=useActiveEip1193Provider 响应式订阅重触发（首跑静默返回不清重试的死亡路径已封））**；≈$ 换算两侧各按其 uAsset 计价×uAssetUsd（储备借平价等值）；**池侧价格随报价时钟**（2026-10-28 用户裁定：池侧 ≈$ 价=live 报价自带 `spotOutPerIn` 同钟推导——卖出=meme 腿现货、买入=其倒数；页载快照价与实时 out 跨钟相乘会把页面加载后的池价漂移伪装成美元增益/损失（1000 UUSD 买 meme 误显 9.06% 差、其中 7.7% 纯显示幻影案例）；参考态（无 live 报价）两侧仍走页载快照——参考换算两侧本就同钟；live 且现货腿失败=池侧 ≈$ 行不渲染（同冲击行 '--' 口径，禁 live out × 快照价混乘））；Max 只挂卖出侧（余额 null 禁用）；**打开为空输入**（2026-10-08 用户裁定：金额输入默认空 0.00，废除 2026-09-28 打开预填口径；翻转/换币保留输入） |
| 路径行 | 已删除（2026-10-26 用户裁定彻底删掉路径显示）：执行路径即本 verse 自有池，行与 `route/routePoolMain/routePoolPol/routePoolPt/routeLegPsm` 五键一并清除，确认弹窗同步无路径行 |
| CTA 状态机 | 按钮自身说明为何不可点（市场惯例+§14「死 Confirm 无解释已否」先例），优先级从高到低：错链=原位换链钮（DialogCta.switchChainTo）→未连接=Connect Wallet 可点→空输入=`swapEnterAmount`→超余额=`swapInsufficientBalance`（{symbol} 插值；字段错误行保留）→滑点越界=`swapInvalidSlippage`→无接线对=`swapPairUnavailable`→报价在途/解析中=`swapFetchingQuote`→执行中/弹窗开=Swap 禁用→就绪=Swap（冲击危险档=`swapHighImpact`「价格影响过高」**直接禁用**，2026-10-27 用户裁定，废原「仍要兑换」可点+弹窗二次确认）；fixture 构建有值态维持 Swap 禁用（原型纪律，基线稳定） |
| 确认流 | 点击=解析链上下文（共享缓存）→并行[报价 TTL 验 key 补读、allowance]→组 spec（approval 精确额度并入 7702 session batch——**无授权行**，spec.review.authorizationChange 恒 '—'；`writeScope={kind:'verse'}` 声明中央层刷新）→内嵌钱包等 gas 预估到位（`useGasQuote`；外部钱包 `wallet==='external'` 即刻开窗）才开**确认兑换弹窗**（ActionDialogShell 三态，参与复核弹窗同构）：①审阅态=**双腿兑换块** `.swap-review`（2026-10-27 用户裁定废五行等宽台账——太表格化：你付出腿（`.swap-review__label` 次级小标+`.swap-review__amount` lg 档数据字——值黄 semibold `.swap-review__pay`+`.ax-ticker` 符号）→`.pol-mint__arrow` 转换箭头→预计收到腿（同解剖，值青 `__receive`=`--accent-link`——同参与复核「进入创世」档，黄留给支付腿）+`__min` 最低到账保护副行（text-sm 三级）；**腿=单行左右锚定**（小标左/金额右，全部值与 meta 带/CTA 右缘共享一条右轨——用户裁定右半别空；窄卡整腿折行仍右锚）；**价格冲击不进弹窗**（同日用户裁定：危险档已在 CTA 层拦截、警示档看卡片明细行，`swapHighImpactNote` 键已删））→`.swap-review__meta` 安静 meta 带（顶缘单 hairline：费率行+`GasSummaryRow`（仅内嵌；点开整窗换面 `GasEditor`；带内去 ledger 底线））+修改/确认双钮（单点确认）；②进度态=TxStatus 三步条（弹窗为唯一进度面，执行中禁关）；③终态=标题切「兑换成功」+`.tx-success` 回声块（✓+**标题行 swapDoneTitle**（创世成功块同构）+你支付/获得两腿（`swapReceived`=获得——完成态禁「预计」措辞；金额=`fmtTokenAmount` 6 位小数、Symbol 走 `.ax-ticker` 展示字+青错版）+explorer tx 链接+关闭 CTA）；失败/拒签=错误行+返回审阅态保留上下文；卡片原内联 TxStatus 已移除；确认后清空输入+`settleTick` 定向重读余额（既有管线） |
| 设置层（滑点校验） | 头部齿轮 Popover 滑点预设 0.1/0.5/1% + 自定义；自定义校验域 **0.01–50%**（`components/global/slippage-input.ts` `getSlippageIssue`，行业惯例；2026-10-03 评审修——0 零容忍必回退、>100 时 (1−s/100) 推导出负数代币，原仅 ≥0 静默放行）：低于下界 → FieldError `slippageTooLow`、高于上界 → `slippageTooHigh`（`role=alert` + 输入 `aria-invalid`/`aria-describedby`，vault-actions 委托地址同款模式），越界期间 Min. received 行退 '--' 槽位、不静默夹紧改写输入；§17/§22/§24/§26 弹窗同构设置层 2026-10-03 同轮迁移本口径（共用 `getSlippageIssue`/`slippageErrorCopyKey`，error id 走 useId——池弹窗每卡一实例防 id 相撞；deadline 自定义输入 2026-10-03 拍板 A 迁移整分钟口径：留点清洗 sanitizeAmount + 非整分钟（如 1.5）FieldError `deadlineWholeMinutes`（校验=`components/global/slippage-input.ts` 导出 `isWholeMinutes`——2026-10-08 由 swap-panel 迁入，空/0 仍回退 1 分钟——既有行为保留，不再剥点把 1.5 静默变 15）；2026-10-08 P0-2 收敛：设置层 JSX（齿轮 Popover+SettingsTip）唯一实现=`components/global/swap-settings.tsx`（swap 卡+§17/§22/§24/§26 弹窗共用），受控值改存 string 原样展示、推导经 `slippageToNumber`/`deadlineToNumber`——旧 number 状态在键入路径吞点（0.25 静默变 25、1.5 变 15），拍板 A 就地报错仅粘贴可达，P1-1 修） |
| 键盘 | ↑↓ 行间循环移动焦点（ul 容器 onKeyDown；搜索框内箭头属文本光标不劫持）、Enter/Space=行钮原生选中、Esc=Dialog 原生关闭、焦点还原触发器；行 `role=option`+aria-selected、列表 `role=listbox` |
| 布局坑 | 行钮必须 `inline-size:100%`：button 默认收缩为内容宽会让三列 grid 的 1fr 中列失效、余额贴符号排（visual-judge 2026-09-27 抓出） |
| 文案 | `selectTokenTitle`/`tokenSearchPlaceholder`/`tokenNoResults` + 行名称复用 mintSideUasset/mintSideMeme/polTag/ptFullName（储备行名走 fixture 不走 copy；路径五键 `route/routePool*/routeLegPsm` 已随路径行删除）；CTA/弹窗键=`swapEnterAmount/swapInsufficientBalance({symbol})/swapInvalidSlippage/swapFetchingQuote/swapPairUnavailable/swapConfirmTitle(标题与确认 CTA 同文案)/swapDoneTitle/swapHighImpact/swapHighImpactNote({p})`，弹窗标签复用 flashYouPay/mintYouReceive/minReceived/flashFeeLabel（**priceImpact 已出弹窗**——2026-10-27 用户裁定，键仍归卡片明细行），卡片明细行标签=swapRate/priceImpact/minReceived/`swapFee`（2026-10-27 新增，替原 maxSlippage 行——该键仍被 §17/§22/§24 弹窗共用不删；**储备腿合并计费**：`swapFee` 单行显示「本次交易按输入币计的总成本」= Router 费 + PSM 面值兑换费，均由报价自身折算——Router 费读 `quoteSwap` 的 `estimatedLpFeeAmount`/`estimatedProtocolFeeAmount`（`protocolFeeOnInput=false` 时按 `protocolFee × userInput ÷ userNetOutput` 折回输入币），PSM 费取两端报价差（买=`amountIn − quoteMint`，卖=`swapOut − face(quoteRedeem)` 再按本笔汇率折回 meme），不读 `tin`/`tout` 固定值，改费后自动跟随；uAsset 直连时 PSM 项为 0，行值退化为 Router 费）；Gas/成功块复用 `verse.gas*`/`verse.revise`/`verse.txHash`/`common.close/back`（「原型演示」悬停注记 `swapActionNote` 已随真实交易接线删除）；搜索行=input 全局桥皮肤+左图标覆盖式（`.token-select__search [data-slot='input']`，勿加外框——桥带 !important 会双框打架，2026-09-27）；Rate 行 ⊙=`.swap-panel__details dt .create-info` 定 12px 档+space-1 间隙+vertical-align −2px（默认 14px 零间距贴字且 baseline 下沉，2026-09-28 修） |

## 26. PolFlashSwapDialog（Flash Swap 弹窗 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | Tokenization 标签 PT/YT 井组下通栏操作行 locked 态首钮触发（`components/verse/pol-flash-swap-dialog.tsx`；2026-09-27 方案 B 用户裁定：YT 交易从 Swap 卡移出进专属弹窗——POL↔YT 单通道 yt-flash-swap.md；2026-09-28 v3 从 YT 井底迁井组下通栏第一枚）。壳/原语复用 `.pol-mint` + `.swap-panel__field/__output/__details/__settings-toggle/__cta/__rate-flip` + `.vault-actions__bar`（模式条 tab 风；弹窗语境加 scoped 规则 `.pol-mint .vault-actions__bar`=两段等宽铺满——ToggleGroup 根收缩为内容宽，grid 拉伸不生效需 inline-size:100% 兜底），无新命名 class（panel-note 杠杆行 2026-09-28 删除）|
| 机制口径 | yt-flash-swap.md：复用 PT/POL 池流动性、单笔原子；**买卖均「指定 YT 数量」**（买=到手 y、支付 y−R 上限 Max paid；卖=收到 y−Q 下限 Min received）；费率=PT/POL 池动态费单次（杠杆成本结构：费按 PT 全腿计、本金只付差额）——Fee 行=**用户手续费率样本直读**（`pol.flashUserFeeRate`，相对用户支付额，谱系 0.3%–85% 覆盖 <1% 到极高——`gen-pol-flash-fee.mjs` 平方根分布；2026-09-28 用户裁定：费率=用户付的手续费、假数据不做推导链（首版从池费率×PT 价推导费额+有效百分比已废）；口径：池动态费（FEE_BASE_BPS=100 下限，DynamicFeeMath.sol:41）按 PT 全腿名义收取、用户只付差额（MemeverseYTFlashSwapRouter._executeBuy）→ 支付额基数上杠杆化，可 <1% 也可极高，费率吃掉成本或超上限时 InvalidBuyCost/MaxPOLInExceeded 回滚无法成交；markets.feeRate（池费率样本 1%–8%）保留备用不进本行；完整机制说明挂 ⊙=flashFeeNote）。**对手侧展示=uAsset 而非 POL**（2026-09-28 用户裁定：理解成本更低——前端按 POL/uAsset 池价折算组合，链上仍以 POL 成交） |
| UI 同构 | 上块=YT 驱动输入（买卖共用不翻转——真源两向都指定 YT 数量），下块=uAsset 派生只读（余额行=myUAsset）；模式条 Buy/Sell 只改下块标签（You pay / You receive）与保护行方向（Max paid / Min received）；模式条=vault 操作卡同款 ToggleGroup |
| 报价口径 | 线性参考（uAsset 计价）：1 YT ≈ (1−`ptPricePerPol`)×`marketPricePerPol` uAsset（隐含价 1 POL=1 PT+1 YT，经 POL/uAsset 池折算）；支付/收到 uAsset=YT 数量×隐含价；保护值=参考值×(1±滑点)；≈$=uAsset 腿×uAssetUsd；Rate 行 ⊙ 注明折算路径与「市场侧参考价非结算价值」 |
| 设置 | 只留滑点行（预设+自定义同 Swap 齿轮）：合约无 deadline 参数；真源的可选限价+到期属高级项不做（同 Split/Merge 删齿轮口径的镜像裁定）；自定义滑点校验同 §25 口径（2026-10-03 迁移：error id 走 useId，越界 buy(Max paid)/sell(Min received) 保护值均退 '--'） |
| 预填 | 打开为空输入（2026-10-08 用户裁定：金额输入默认空 0.00，废除 2026-09-27/28 预填口径）；模式切换保留输入、不自动填额（原切 Sell 空输入填全部 myYt 已废） |
| 闸门 | 仅 locked（井组下通栏行门控——locked 行首枚=Flash Swap、unlocked 行=Redeem PT/YT；解锁后 flash 通道关闭转结算赎回） |
| 警示 | 杠杆警示行已删（2026-09-28 用户裁定：`flashLeverageShort/Note` 键与 panel-note 行一并移除） |
| CTA | 未连接=Connect Wallet 可点切换模拟连接；已连接=Buy YT/Sell YT 禁用（原型不伪造链上成交） |
| 文案 | `flashSwap/flashBuy/flashSell/flashYouPay/maxPaid/flashSettingsTitle/flashRateTip/flashFeeLabel/flashFeeNote` + 复用 youReceive/balance/max/swapRate/swapRateFlip/minReceived/slippageTolerance/slippageTip/swapCta/`common.close` |


## 27. LinkButtonPlate（链接钮画皮承接层 · 已落地）

| 方面 | 契约 |
| --- | --- |
| 背景 | Chromium 不在 `:link`/`:visited` 子树光栅化 `paint()` 图像（元素/伪元素/后代全灭；href 增删实时切换复现，Chrome 151/153 有头无头一致；w3c/css-houdini-drafts#1178）。链接渲染的按钮（`render={<Link>/<a href>}`）画皮全灭只剩文字 |
| 结构 | `ui/button.tsx` 的 `nativeButton={false}` 分支自动包裹：`<span data-slot="button-plate" data-variant>` > 链接锚点。真 `<button>` 不包。调用点 JSX 无感 |
| 画皮归属 | plate（链接祖先，不在封杀范围）持 `paint(chamfer-border)`；锚点退化为文字层（`background: none !important`——现状画不出，将来上游修复后防双画） |
| 变体镜像 | plate 上 `data-variant` 镜像 default/outline；class 钩子（`.ax-ghost-cta`）经 `:has()` 镜像。**新增链接可用变体时须同步镜像 plate 规则（globals.css `[data-slot='button-plate']` 段）** |
| 交互 | hover/active/focus 照旧：hover 换肤走 plate `--cb-*`（过渡配方同基类）；active 下压由 plate `translate: 0 1px` 整体承接（锚点 cva 位移归零防 2px 叠加）；focus 走锚点全局青 outline（plate 收缩包裹，视觉盒一致） |
| 布局边界 | 包裹后 flex/grid 容器的**子项是 plate 不是锚点**——子项级属性（`flex:1`/`margin-inline-start:auto`/`align-self`）须写在 plate 上；锚点经 `flex-grow:1` 在满宽场景跟随。既有迁移：手机断点 `.home-final-cta__actions [data-slot='button-plate'] { flex: 1 1 100% }` |
| 使用处 | 首页 hero/页尾 CTA、docs 外链、portfolio 退款 CTA、discovery 空态 CTA（2026-09-28 落地，方案 C；A 静态回落被否——分数 DPR 边线质量分叉违背 09-26 实验室验收口径） |


## 28. DaoFundDialog（DAO 资金明细弹窗族 · 已落地）

| 方面 | 契约 |
| --- | --- |
| 用途 | DAO 标签四枚带 `>>>` 动态符（DaoDots）的可点数据芯片——当期国库/上期国库/未领取滚存/可领奖励——点开资金构成明细弹窗（`components/verse/dao-fund-dialog.tsx`；结构参照 demo.outrun.build/memeverse/26：标题+✕+Total Value+多资产行；2026-09-30 可领变体+底部 CTA） |
| 壳 | `DialogContent` 内必须包 `<div className="pol-mint">`——底色/描边光/padding 全在该层伪元素（雨夜材质），缺了弹窗透底只剩虚化遮罩（2026-09-30 修复透明 bug 时立此为契约）；内容 class `.dao-fund-pop__hero/__hero-main/__hero-meta`（读数带：20px `--text-lg` mono 大数（2026-10-03 用户裁定三轮 24→22→18 终定 20）+资产数 meta+顶缘青光渗）`__row/__list/__glyph/__token/__qty/__share/__track`（资产行+配比条=占总额比 2px 青填充，% 定宽右对齐；分隔线退位给配比条节奏）；进场=抬升淡入（`data-starting-style` translateY 8px+scale 0.985，reduced-motion 全局策略自动降级）——2026-09-30 质感升级 |
| 机制口径 | 可领奖励=多 token 按票权份额：`getClaimableReward(user)→(tokens[],rewards[])`（GovernanceCycleIncentivizerUpgradeable.sol:199）；未领取滚存并入国库不补发（下一次 finalize 清零 prevCycle.rewardBalances 并入当期国库——:376-380）；领取窗口=**结算窗口**（开=本周期 finalize、奖励仅结算时写入 :388-389；闭=下次 finalize；周期 endTime 到而结算未触发时领取 revert NoRewardsToClaim——claimReward 读 prevCycle :434-439）——2026-09-30 用户澄清口径，与 OB 叙事一致，对账关闭（source-map 对账区同日行）；明细只覆盖治理注册的代币注册表（treasuryTokenList/rewardTokenList，注册/注销 onlyGovernance、奖励代币须先注册为国库代币 :504、上限 50 :26；上期明细=finalize 过滤后的实际派生子集 :116——已注册∧余额>0∧有票） |
| 数据 | governance fixture `treasuryAssets/lastCycle.treasuryAssets/unclaimedAssets/claimableAssets`（S 级样本，`gen-verse-fixture-coverage.mjs` composeAssets 固定权重拆分，usdValue 之和锚各自总额 treasuryUAsset/remainingRewards/myClaimable；宇宙=ETH/USDC/USDT/DAI(+WBTC 国库)；null=无样本→芯片退普通 div 不渲染入口）；弹窗底部 `__note` 白名单注脚（`registeredAssetsNote`，2026-09-30 源码对账用户裁定统一一条——Governor 持有的未注册代币不入账不显示；2026-10-06 用户裁定改两弹窗：仅当期/上期国库保留，未领取滚存/可领奖励传 `showRegisteredNote={false}` 不显示） |
| CTA | 仅可领变体有底部通栏 `Claim Rewards`（`actionLabel` 槽 + `.swap-panel__cta` 皮肤）；**恒 disabled**——原型不伪造链上成交（同 §17/§26 口径），本仓 Button disabled 渲染与 enabled 一致，参照图的主钮观感保留；关闭=✕/Esc/遮罩外点 |
| 触发器 | 两变体（2026-10-05 用户裁定可领行触发面积收回按钮）：①整行触发（当期/上期国库、未领取滚存）=`DialogTrigger nativeButton={false} render={<div />} className="cycle-card__hit"`，children=原芯片 dt/dd——**类必须走 className prop**：本仓 `ui/dialog.tsx` 包装件自带 className，base-ui 合并时组件侧 className 会**替换** render 元素上的 className（写进 render 即静默丢弃——2026-10-05 修复，此前 hover 亮边/青描边/移动端整行按压反馈全部静默失效；TooltipTrigger 包装件不注入自有 className 故 render 写法可用）；②按钮触发（可领奖励）=`triggerButton` 槽 → `DialogTrigger data-slot="button" render={<Button variant="outline" size="sm"/>}`，`>>>`（DaoDots）移入按钮文案后、按钮可点开弹窗（原「disabled 钮+pointer-events-none 点击穿透」2026-09-30 范式退役）；无样本构成时调用方退普通 disabled 钮。整行触发布局随档位：>640px=KPI 芯片网格；≤640px=hairline 行（dt `display:contents` 提升、值右锚、`>>>` order 殿后，整行热区+按压 raised 反馈——2026-10-05 移动端重构补齐） |
| 结算窗口横幅 | `cycle-card__settle`（2026-10-05 用户裁定：触发结算钮不常驻）——渲染条件=`!finalized && cycleEndsAt ≤ now`（周期结束时间已到、未结算；RSC 渲染时求值）；青 tinted 功能信号条（vault 跨链横幅同解剖）内含 `settleOpen` 主文案 + FINALIZE outline 钮（12px/600/0.08em/大写字档、28px 桌面/32px 移动；钮后 ⊙ `.create-info` 气泡=finalizeNote + 按钮外 sr-only describedby——**说明不放横幅正文**（同日再裁定，沿用原 head-finalize tooltip 范式））；窗口期外整条不渲染（含已结算——结算后进入下一周期），桌面/移动同构；布局/触发语义见 components.md 移动端重构行 |
| 文案 | `getCopy(locale).verseDesk`：treasuryDetailsTitle/lastTreasuryDetailsTitle/unclaimedDetailsTitle/claimableDetailsTitle/totalValue/assetsLabel/registeredAssetsNote/claimRewards/settleOpen + `common.close` 供 ✕ aria-label |


## 29. PortfolioZoneTabs（移动端分区页签 · 已落地 · 018）

| 方面 | 契约 |
|---|---|
| 用途 | Portfolio 页 ≤54rem 分区导航：待办(n)/资产/仓位/凭证(n) 四页签一次显一区（移动端长滚动治理——旧版 390 全页 8122px 且表格横滚）；KPI 信号带窄视口让位页签角标（「摘要即导航」语义保留） |
| 实现 | `components/portfolio/portfolio-zone-tabs.tsx`（'use client'）→ `.pf-deck[data-zone][data-js]` > `nav.pf-zone-tabs`（ToggleGroup `__bar` + `__badge`）+ `[data-zone-wrap]` × 4；样式 `app/globals.css` 的 `.pf-deck/.pf-zone-tabs*/.pf-mrow*` |
| 结构 | 页签项=文本 + 可选 `__badge[data-tone]` 等宽计数（warning=待办、success=可领，0 不渲染）；分区映射与桌面序贯分组一致——①ActionZone ②Assets+Savings ③Positions+Vault（`.pf-zone-sub` 内）④Participations；全部分区常驻 DOM（RSC 直出） |
| 状态 | 激活=`[data-pressed]` 黄字 + 2px 底缘指示条（2026-10-07 用户裁定由 3px 减细）（verse-tabs__bar 同语法）；分区显隐仅 `[data-js]` 挂载标记存在时由 CSS 生效——SSR/无 JS 全可见（优雅降级） |
| 行为 | 页签点击=换区 + 滚动到分区顶（双 rAF 等 React 提交；`scroll-margin-block-start` 避开吸顶顶栏+页签条）；`#pf-*` 页内锚点（金库 signpost 卡 CTA 等）由 deck 事件委托接管换区+滚动（隐藏分区无盒模型，原生锚点跳转落空）；凭证区可领筛选=组件内客户端态 button（2026-10-08 用户裁定：`?claimable=1` URL 导航整页刷新被否，同仓位链筛选先例）；待办为空则待办页签与 wrap 不渲染；空数据整页退场（2026-10-15 用户裁定）：六区全空（actions/assets/usrSavings/cdp/vault/participations 皆零行）→ 页签 deck 整体不渲染、AssetsZone 零可桥接行与 ParticipationsZone 零行各自 return null（空态卡+CTA 删除，copy `empty/emptyCta` 已除名）、KPI 信号带全零与净值 hero $0 不渲染——连接后只剩页头标题/副题 + 唯一行动 `ExploreCta`（`components/global/connect-wallet-cta.tsx`：连接且全空时渲染——**照搬发现页无匹配范式** `.empty-state` + `h3`（display 字体+品红错位，copy `portfolio.exploreNote` 名词短语短文案）+ lg 号 `ax-ghost-cta` 去 `/memeverse/explore`（copy `portfolio.exploreCta`），槽距 `.pf-explore-empty` space-7，断连态仍是 ConnectWalletCta 的地盘）；仓位/金库表格 ≤54rem 隐藏、`.pf-mrow` 堆叠台账行接管（身份行 `--row-height` 触达 + 事实格 dt/dd，跨行 dd 盒共线）；**onchain 构建例外（2026-10-24，参与行同族修复）**：服务端六区恒空（账号读已退役），deck 壳在存在 genesis 态候选 verse（`participationCandidates`，`getChainVerses` 按 id 去重）时照常渲染（UserDataGate 连接后开闸），各分区仍各自空态自隐；ParticipationsZone 收 `candidates` 于连接态按钱包当前链两轮 multicall 活读分腿行（`readGenesisLedger` 同源三账+uAsset decimals；stake 参与标记链上不可辨——账目只记到账 uAsset，质押徽章=fixture 样本标记；locked/unlocked 持仓行（POL/PT/YT）无客户端读基础设施、维持 fixture 样本面）；`ExploreCta` 条件=服务端 `!hasZoneData` **且** live 参与面不存在（`components/global/live-participations.ts`：ParticipationsZone 扫描完成发布有无行、ExploreCta 经 `useLiveParticipations` 订阅隐藏——onchain 客户端活数据不再误判「全空」，连接后零参与时 explore 卡照常渲染，原已知偏差消除）；空分区包装层折叠（`globals.css`：`.pf-zone-group`/`.pf-zone-sub` 无元素子节点、`.pf-deck__tail` 两 sub 皆空 → `display:none`——onchain 构建下空区不花 48px 群距，三只空包装叠出的 ~144px 空洞消除，同族先例=≤54rem tail-yield 规则；移动端激活区规则特异性更高、页签行为不变；fixture 全 populated 零变化） |
| 响应式 | ≤54rem 页签条吸顶于顶栏下（`--space-8`+1px 偏移、stage-tabs 全出血负边距、surface-header+blur）；≥54rem 页签条 display:none、deck=透明布局层（桌面渲染零变化，翻转实验逐像素验证） |
| aria | `nav[aria-label]`（copy `portfolio.tabs.group`）；ToggleGroup 互斥单选（base-ui `data-pressed`）；计数在文本流内随标签朗读 |


## 30. AssetActionsSheet（资产底部操作面板 · 已落地 · 018 补充 1）

| 方面 | 契约 |
|---|---|
| 用途 | 移动端资产行去按钮化（018 补充 1）：行=纯台账单线，链分布数值与 Convert/Bridge 动作收进底部面板；桌面行内按钮照旧（hit 层 display:none） |
| 实现 | `components/portfolio/portfolio-dialogs.tsx` → `AssetActionsSheet`；原语 `components/ui/sheet.tsx`（base-ui Dialog 底部锚定变体：Esc/外点/焦点圈闭/焦点还原内置，底缘安全区）；样式 `.pf-asset-row__hit` / `.pf-asset-sheet*` |
| 结构 | hit 层=整行透明触发面（`nativeButton={false} render={<div/>}`，aria-label=「{symbol} · 资产操作」）；面板=`.pol-mint` 卡壳（DialogTitle+✕）+ 链分布台账行（链标+链名 ｜ mono 金额，44px）+ CTA 行（children=Convert/Bridge 弹窗触发器，等宽） |
| 状态 | 进出场=translateY+opacity 枚举属性；遮罩复用 dialog-backdrop（bg 虚化）皮肤 |
| 行为 | **任务弹窗叠在面板之上（iOS 栈式）**——嵌套弹窗树住在面板内容内，点击 CTA 时收起面板会连坐卸载刚打开的弹窗（禁「点击即关面板」）；Esc 先关顶层任务弹窗、面板保留承载上下文；触发器不可双栖——桌面行内按钮与面板 CTA 为两套独立实例各自开合 |
| 响应式 | 仅 ≤54rem hit 层可见；面板 max-inline-size 30rem 居中 |
| aria | SheetTitle（symbol）+ ✕ aria-label（common.close）；hit 层 aria-label 组合式（符号+资产操作）；base-ui Dialog 全套 aria 内置 |


## 31. VerseShare（Verse 分享组+弹窗 · 已落地 · 023）

| 方面 | 契约 |
|---|---|
| 用途 | Verse 详情页传播出口（参照 jasonrale/Outrun-Frontend 同名功能）：hero 右上角「提示符+分享钮」双图标钮组 + 分享弹窗（Copy link / Share on X） |
| 实现 | `components/verse/verse-share.tsx`（client）；原语 base-ui Dialog + Tooltip（触屏点按开气泡走 ui/tooltip.tsx 内建护栏）；样式 `.verse-share*` / `.verse-share-card*`（globals.css）；壳复用 `.pol-mint` |
| 结构 | 挂点=hero `verse-identity__badges`（titlerow 右端；2026-10-06 用户裁定 hero 阶段徽章删除让位，FastGenesis 徽章保留同容器）；**单礼物钮=分享按钮本体**（Share2 退役，023 补充 7；无边框幽灵钮：悬停/触点出随机 1/4 促销语 tooltip side=top、点击开弹窗——TooltipTrigger 经 render 披在 DialogTrigger 上，一颗钮两触发器）；**颜色=阶段主色 `--stage-color`**（023 补充 16：genesis 黄/locked 品红/unlocked 青/refund 橙，hover 提亮 mix；hero 源=`.verse-hero[data-stage]`、弹窗源=DialogContent `data-stage`+`.verse-share-pop` 入共享阶段组）；弹窗=标题行（标题+礼物图形=返佣说明 tooltip 触发器（info 符号退役，礼物兼任提示符，颜色=阶段主色，023 补充 16）+✕）→ 项目卡（**Premium dark 三件套凹板**（023 补充 15 终态）：面内纵向渐变（raised→混 12% 品红深档 surface，底部呼应壳层灯）+ 双 background-clip 渐变描边（border-strong→border）+ 顶缘受光 `inset 0 1px 0 --scanline-white`；无切角无伪元素、退出材质组——「盒中盒双材质」为杂乱根源（补充 4/11/12 补丁洗撤销）；弹窗视觉表达收拢到壳层单一环境灯（`.verse-share-pop .pol-mint::after` 低位深品红 12% 长尾升起）；monogram 底=对角渐变（raised→inset）+顶缘受光+text-secondary 灰调；symbol 首 2 字 monogram 缩略位（raised+hairline，**stretch+aspect-ratio：边长=右列内容高**，023 补充 14 消 thumb 下空白）+ 品牌字标成品 Logo 96px（`public/brand/BRAND-01-wordmark-transparent-480.png`（决议 025 衍生变体），禁改色/拉伸/裁切；用户裁定 symbol 换字母 logo）+ **symbol 28px display（0.06em 品红错位回声）与 name 同行基线对齐**（`__idrow`，023 补充 14；flex-wrap 兜底：meta 列不足同行最小宽时 name 换到 symbol 下一行——460 档 meta=198px 已是 SWHL 级名字零余量临界，卡内换行不许顶出卡缘）+ 描述 2 行截断（meta 列组距 8px）+ JOIN US 品红 tinted 徽章）→ 双 CTA（**复用全站标准组件范式**，023 补充 19 终态：Share on X=`variant=default`+`.ax-ghost-cta` 黄色非实心钮（hover 填黄黑字，同 home/create/参与面板）；Copy link=纯 `variant=outline` 原味——补充 17/18 的手搓 important 覆盖全部撤销）——弹窗 460px 档 |
| 状态 | 双图标钮 1.5s 循环抖动（±2.5px、70% 处回正静默）——motion 契约 infinite 装饰例外（决议 023），`prefers-reduced-motion` 自动停抖、零 glow；Copy link 点击=✓Copied 1600ms 回落（复制行为经 `useCopy`（components/global/use-copy.ts）与 CopyAddress/ReferralLinkPanel 共享唯一实现） |
| 行为 | 复制=`navigator.clipboard.writeText(window.location.href)`；X=`twitter.com/intent/tweet`（text=随机 1/5 推文模板 `{symbol}` 替换 + url=当前页，新开标签）；随机文案在开启瞬间定值（onOpenChange 换 index）——SSR/水合不参与；触发源恒 general（无 intro 祝贺段）；成交后自动弹**不接线**（原型 CTA 恒 disabled 不伪造成交，同 PolMintDialog 契约） |
| 响应式 | 全档=titlerow 右端（badges 容器 margin-auto 右推；≤640px 旧「徽章行左锚」覆盖随阶段徽章删除退役——折行时分享组随行右悬）；弹窗 `min(460px, 94vw)` 居中；**项目卡 ≤30rem 媒体对象头重排**（窄视口下「边长=右列高」机制把 meta 挤到不足 idrow 同行宽（390 实测 thumb 156px vs meta 96px）文本顶穿卡缘；改网格：monogram 96px（=logo 宽）左柱与 logo/idrow 并置、desc/cta 通栏、meta `display:contents` 升格网格项、thumb 压基础 stretch 为 center 保方形——idrow 两行换行时右柱高过 96px） |
| aria | 双图标钮 aria-label（shareLabel/shareHintLabel）；DialogTitle=分享标题；✕ aria-label=common.close；抖动纯装饰不进 live region |
| 文案权限 | 返佣说明=OutrunBook `ecosystem/flywheel.md` 口径（推荐返佣出自协议交易费份额）；en 推文模板照搬参考仓、zh 新写（copy-and-i18n 双语纪律） |


## 32. Referral 页（/referral 推荐返佣 · 已落地 · 2026-10-07）

| 方面 | 契约 |
|---|---|
| 用途 | 推荐返佣页（R-12，2026-10-07 用户裁定四项；同日 v3 行业共识骨架：统计簇→链接→待领→运作→tabs 历史，依据 ReferralRock/Webtonic 转化指南 + GMX/Jupiter/Binance 同构——统计簇首屏一组、链接前置、三步居后、双 tab 收尾；**同日 v4 用户裁定运作上移一格**：统计簇→链接→运作→待领→tabs 历史，弃「三步居后」） |
| 实现 | `components/referral/referral-page.tsx`（RSC）+ `referral-link-panel.tsx`（client，复制）+ `referral-history-tabs.tsx`（client，`ReferralHistory` verse-tabs 双签+Friends 计数）；数据=`getFixtureReferral()`（fixtures/data/referral.json，sourceRef M15）；样式 `.ref-*`（globals.css），复用 `.action-panel`/`.pf-panel`+`.pf-claim-row`+`.pf-panel__bar`/`.verse-tabs`/`.pf-table` 原语；统计簇=pf-panel 内 4 格 hairline 分列（首格 Total Earned 28px 主读数、余 16px；≤54rem 2×2 十字 hairline）；卡片节奏（2026-10-07 用户裁定）=五卡各自独立、无分组，卡间一律 space-6。**onchain SSR（2026-10-21 用户裁定：个人数值不占服务端资源）**：恒 accountless——`referrerRebateBps` 为全局 hook 配置，零地址读等价、走 30s SWR config 缓存（key `referral-97`，boot warmup 已覆盖）；per-referrer pending/历史保持空（graph 未接线），客户端接线时另行登记 |
| 链接 | `<origin>/ref/<短码>`：URL 由 RSC 从 host 头定值传入（SSR 即完整值，无水合闪变；localhost 判 http、其余 https）；短码=fixture 样本位（2026-10-07 用户裁定沿用 demo 短码样式——链上无 code→地址注册表，生产映射方案待定，与 G8 冲突已知悉）；`/ref/<code>` 落地路由与 swap 侧 ref 接线本期不做 |
| 状态 | 链接面板=**单行链接井 + 右端嵌入式复制图标钮**（2026-10-07 用户裁定：删 Share on X 与独立 Copy Link 大钮，参照图改版）——复制钮=页内唯一黄主行动（黄图标、hover 通电纯黄+黑图标，黄档通道；`aria-label` 恒为 copyLink），点击→✓ 图标 1600ms 回落+copied 态青图标（复制行为经 useCopy 与 CopyAddress/VerseShare 共享唯一实现）；URL 显示层拆 scheme/host/路径三段中段截断（host 段省略号、`/ref/短码`段恒可见——窄视口可读性；复制写完整 URL）；**≤54rem v2（2026-10-07 用户拍板第二版）**：动作主角——井降级为无框证据行（等宽 text-sm 二级灰、完整 URL 含 scheme——同日裁定撤隐 scheme，用户判「链接不完整」），复制由全宽实心黄切角 `__cta`（Button default 通道 40px，成功态 ✓+「已复制/Copied」1600ms）接管，井内嵌图标钮 display:none 出 a11y 树（每档恰一个触发器、黄主行动唯一）；Claim=outline **恒禁用**（原型不伪造成交，PolMintDialog/VerseShare 同契约——G 源：hook `claimRebate` 逐币 pull、无批量，operations.md:665）；待领零项整区不渲染（Portfolio 零项先例）；待领行=代币图标前置（`TokenIconMark` 28px + symbol/链名，2026-10-08 用户裁定（20→24→28 两轮加大）；Portfolio 激励行无图标，`.pf-claim-row` 共享模板不动、`.ref-pending` 作用域加首列；图标↔symbol 列距 16→12（2026-10-08 裁定，amount↔actions 有效 24 由 __actions 内距 8→12 补偿保住）；≤30rem 四区显式 areas（icon/id/amount/actions——基类同断点给子元素绑过 grid-area，作用域必须显式对齐否则孤儿命名生隐式空轨）、≤30rem 双行布局（2026-10-08 用户裁定重排：首行=图标+身份居左、金额两行右锚，次行=Claim 平铺整行自适应（2026-10-08 三次裁定：右对齐→居中→整行）、actions 列距补偿内距归零）、≤20rem 同整行；行悬停效果移除（2026-10-08 用户裁定——只读台账、Claim 恒禁用，无交互可预告） |
| 数据口径 | G：默认 rate=1000bps（总费 10%）、分账 LP65/协议(35−rate)/你 rate、in-kind 逐币、按链独立、自推荐合法（M5/M14/M15 + OB hook.md/flywheel.md）；**推荐关系=被推荐人注册时绑定、已注册用户点链接不重绑**（2026-10-07 用户裁定——链上 hook 无 referee 绑定，绑定由应用层实现，文案已按此口径）；S：全部数值为 fixture 样本（≈$ 沿用 assets usdSample；friends 明细链上无依据=索引器口径样本；rate 展示值生产读 `referrerRebateBps()`）；无「以链上读值为准」类文案（全站禁用） |
| 双签 | `.verse-tabs` 卡壳+通栏页签头复用（黄字+2px 指示条语法）；客户端态无 URL 参数（历史视图非可分享状态，PortfolioZoneTabs 同口径）；两面板表 RSC 渲染经 children 传入 |
| 表格 | `.pf-table`：**Transactions（2026-10-07 参照重设计，用户裁定）=Transaction(缩略 txid, th+`.ref-tx__mono`)/Commission(返佣=纯数额+`TokenIconMark` 16px **取代符号文本**（图标在数额后），`.ref-tx__rebate` 行内组，悬停 `Tooltip` 出 Symbol（Network 列链徽同款 `aria-label`+TooltipContent）——2026-10-08 用户裁定三轮定形；移动端 `.ref-mrow__gain` 行首=数额+图标（触屏无悬停，无气泡）))/Network(`ChainLogoMark` 16px 居中，`Tooltip` 悬停出链名——pf-asset-row 同款 `aria-label`+TooltipContent 先例)/Referred Address(缩略, `.ref-tx__mono`)/Time(`RelativeTime` 相对时间, `data-numeric` 右锚)**；参照实测对齐：文字列左锚、Time 右锚、图标列居中；`RelativeTime`=client 件（`relative-time.tsx`，RSC 传 now：服务端首帧即相对时间、水合零差异——「日期→相对」闪变已根除 2026-10-07；挂载后按客户端 Date.now() 重算，e2e 冻结时钟下确定，分钟粒度无定时器）；Friends（数据格统一数据字体 mono，2026-10-07 裁定）=Address(th, 纯文本缩略 `.ref-tx__mono` 无复制钮——CopyAddress 移除)/Joined/Volume/Earned（数字列 `data-numeric` 右对齐）；空态 `.empty-state`（tx 空带 explore ghost CTA） |
| aria | 分区 SectionHeading `aria-labelledby`；KPI 带 `aria-label`；分账条 `role="img"` + 图例文本并行（不只靠颜色）；复制钮成功态文本可见 |
| 响应式 | 统计簇 ≤54rem 2×2 十字 hairline；链接卡 ≤54rem v2 动作主角（标题→证据行（无框、完整 URL 含 scheme）→全宽黄 CTA；≥54rem 行布局+井内嵌图标钮，全宽时原文完整）；三步 ≥54rem 三列 hairline / 以下纵排；双签走共享 `.verse-tabs` 移动档两列单行（en 签 2026-10-07 用户裁定缩短 Transactions/Friends——卡头已供 Referral History 语境，原 Referral Transactions/Referred Friends 在半宽格 ≤375px 触碰/重叠，zh 短签不受影响）；双表 ≤49rem 横滚表格让位 `.pf-mrows` 台账行（决议 018 同构，2026-10-07：流水行=返佣额领衔+相对时间右锚/facts=被推荐·网络（链名常显）/txid 通栏；friends 行=地址+贡献额/facts=加入·交易量（ref-dim 降噪）；断点=ref-tx min 700px 实测契合边界 ≥788px——860 平板档保留表格、非 54rem 一刀切）；>49rem 表格 `.pf-table-wrap` 横滚（仅极窄桌面窗口出现） |


## 33. UserDataGate（用户数据闸门 · 已落地 · 2026-10-08）

| 方面 | 契约 |
|---|---|
| 用途 | 无用户参与态（2026-10-08 用户裁定）：账户中心未连接（`useAccountCenter`）时不渲染子树——数据卡片整体隐藏而非零值展示/空态占位；机制介绍类内容不归闸门管辖（referral 运作方式+分账条留在闸门外常显） |
| 配套 CTA | `ConnectWalletCta`（`components/global/connect-wallet-cta.tsx`，同日补充裁定）：闸门的对偶面——未连接时渲染黄色主行动，点击=头部 WalletControl 同一连接开关，连接后整块消失；样式=header 钱包钮同款 ax-ghost-cta 幽灵皮（透明机身+黄描边黄字，同日二轮裁定），壳层 flex 水平居中；Portfolio 页头下默认 space-7 / Referral 机制卡下方传 `connect-cta--ref` 落卡片 space-6（二轮裁定落位）；Launch 表单 submit 位同款按钮在 create-form 内联（断连时整颗替换 Launch submit、原 ax-ghost-cta 槽位皮不变，表单字段照常可填、连接不重置草稿；同日裁定「Launch 页显示连接钱包按钮而非 Launch 按钮」） |
| 实现 | `components/global/user-data-gate.tsx`（client，`useMockWallet().connected` 三态）；与 PortfolioZoneTabs/ReferralHistory 同构：RSC 渲染的面板经 children 传入、本组件只切换显隐；SSR 与首帧客户端快照恒为未连接（无水合闪变），连接切换为纯客户端重渲染、零网络请求 |
| 管辖范围 | Portfolio：KPI 带（pf-kpi）+ 净值 hero（pf-hero）+ 四分区 deck（PortfolioZoneTabs 整体，断连时页面只剩页头标题+副题——该页全部为数据卡，裁定后果已明示）；Referral：统计簇（ref-stats）+ 邀请链接（ref-link，用户专属短码随数据同隐）+ 待领（ref-pending）+ 历史（ref-history）。首页/发现/详情/创建页不接闸门 |
| 登记 | 单测防线 `tests/unit/user-data-gate.test.ts`（SSR 断言卡面类名缺席/机制段与连接 CTA 在场）；e2e `*-disconnected` 基线条目锁默认态（数据泄漏回断连页面即基线红），`connectWallet` 旗标条目保持连接态全量基线覆盖（portfolio/referral/launch 三路由） |

## 34. Faucet 页（/faucet 测试网水龙头 · 已落地 · 2026-10-09）

| 方面 | 契约 |
|---|---|
| 用途 | 测试网代币获取页（六功能）：三 mock 币每日领取（USDC/sUSDS/aUSDC）+ 一键领取（batchClaim）+ PSM 面值兑换双向（Get UUSD=USDC→UUSD / Back to USDC=UUSD→USDC）。参照物=旧 demo 水龙头按钮组+Get UUSD 弹窗两图（功能映射，视觉按本站语言）。Get UUSD 机制口径=**PSM（UUSD 唯一获取路径）**——2026-10-09 用户核对合约后自纠终值「只能通过 PSM 获得 UUSD，水龙头领取的其余生息资产直接走 stakeForGenesis」（当日三轮：PSM→质押铸造→回归 PSM，中间轮作废） |
| 机制口径 | G：claim 每 token 24h 一次（`Faucet.sol:43` `ClaimTooSoon`）、日限一次性全额 mint（deploy 脚本 addToken 1,000,000×1e18/币，三 mock 均 18-dec，source-map S10/S11）；batchClaim 前端只传可领集合（合约按传入数组原子执行，任一冷却中整笔回滚）；PSM=面值 1:1 双向、tin/tout 费率、mint 受 stockCap headroom、redeem 受池储备、无滑点/deadline 参数（S8）；生息资产（sUSDS/aUSDC）不经 UUSD——直接 `stakeForGenesis` 进创世（router-and-user-flows §4：唯一铸造入口 SP.stakeForGenesis、铸出 uAsset 与 genesis 需求严格绑定；卡片说明文案带出此去向）。S：费率展示值（0.10% 每向）/headroom/余额/冷却剩余=fixtures/data/faucet.json 样本 |
| 实现 | `components/faucet/faucet-page.tsx`（RSC）+ `faucet-claims.tsx`（client，含 UUSD 兑换行）+ `faucet-swap-dialog.tsx`（client）；数据=`getFaucet()`；样式 `.fc-claims`（globals.css），复用 `.pf-panel`/`.pf-claim-row`/`.ref-nameplate`/`.token-select__badge`/`.ax-ghost-cta` 原语 |
| 台账面板 | **单一面板**（2026-10-09 四轮：两卡合并——用户裁定「这就是个水龙头」，卡面零机制解释，费率/额度细节收进弹窗）：铭牌行 tokensTitle（Testnet Tokens/测试网代币）+ claimsNote（每 24 小时重置）→ 三领取行（下条）→ hairline 分隔的**一键领推行** `.fc-claims__batch`（全部代币/All tokens 加粗+batchNote 两行 + 右 Batch Claim/Connect outline sm）→ footer=**UUSD 兑换入口** `.fc-claims__foot`（UUSD 品牌章 20px + UUSD + swapFrom 短语（`{a}` 占位=`__asset` 原子单元「14px USDC 章+符号」inline-flex 不可断行，2026-10-09 用户裁定加内联图标；裸 img 首版在窄容器折成独行已废）+ Get UUSD 黄色幽灵钮 sm=页内唯一黄，弹窗触发器）。2026-10-09 五轮：一键领取与 Get UUSD 换位（批量归数据组尾、UUSD 归页脚漏斗出口）、删 `1 : 1` 行读数（swapRate 键删，弹窗内 Rate 行保留）；六轮：UUSD 章光学配平（0=读低、-2.5px=读高，终值 -2px 过冲）；七轮（用户裁定「USDC 再放大、UUSD 与 USDC 同大对齐」）：**双章统一 18px**、USDC 章内联单元 `vertical-align:-5px` 钉位（inline-flex baseline 取自 img 底缘会骑到行上方）+swapFrom `{a}` 占位；八轮微调（各下 0.5px/UUSD 右 1px）；九轮终稿：**双章互齐锁线**（对邻文各自配平会因粗体/灰字光学中心不同而互差 2px——用户抓出；USDC 章 img 上提 2px，实测双章中心同 553.0、互差 0.0） |
| 领取行 | 图标（TokenIconMark 28px——USDC/sUSDS/aUSDC 三币 2026-10-09 起全有官方图标；`.token-select__badge` 二字徽章保留为无图标品类回落）+ symbol/name + 日限读数（`data-numeric`）+ 连接态冷却行（Ready=success / `Ready in {t}`=warning，t=en `21h 25m`、zh `21 小时 25 分`——小时+分钟档，staticDuration 日粒度不适合 ≤24h 域）+ Claim（outline sm）。行只读：Claim 恒禁用、hover 中和（ref-pending 2026-10-08 同口径）。冷却=fixture `cooldownRemainingMs` 按墙钟每秒递减（vault `RedeemCountdown` 同口径纯展示 tick 非链上写），到 0 转 Ready；未连接不渲染冷却行（无用户归属）。**onchain 模式（2026-10-15 阶段 5 接线）：`cooldownRemainingMs=null`（链上无 getter/事件，2026-10-14 用户裁定）→ 冷却槽位不渲染（类型放宽 `number\|null`，fixture 模式恒有值渲染不变）；日限/headroom/费率=RPC 真读数（Faucet.tokenInfos/PSM tin·tout·stockCap−netMinted）** |
| 行动条 | 见「台账面板」行——一键领推行（断连=Connect 可点切换连接/连接=Batch Claim 按 claim() probe 可领集合执行）+ 页脚 UUSD 入口（恒可点开弹窗，连接态由弹窗 CTA 承接） |
| 发送形态 | **直接 EOA 写、免站内审阅（2026-10-22 用户裁定，决议 036）**：`begin/endAccountSession` 只给 Router 写用——Faucet.claim 直接 mint、无需 account session。点 Claim 经 `executeDirect` 直进钱包弹框，无站内审阅面板（领水无输出/费用/授权变化，九项面板全是噪音；钱包弹框已展示 To/网络/费用）。单币=claim(token) 直调 Faucet；多币=`faucetBatchClaimCall`（Faucet.batchClaim，合约侧原子）；`use-tx-center` direct 分支（**免站内模拟、同字段直签广播**，2026-10-22 二轮用户裁定：点击直弹钱包，必败交易由钱包自身预检拦截——确认框内红色警告或拒发，强签=链上 revert 烧微量测试网 gas；余额不重复校验，钱包预检拒收空账户）；站内反馈=faucet 进度/成功弹窗对（2026-10-26 用户裁定，推翻 036「站内无进度 UI」与 047b「进度窗内 Close 钮」形态）：执行期=独立三步条进度弹窗（`FaucetTxProgressDialog`，**无任何按钮、永远倒数第二**），confirmed 自动换面「领取成功」弹窗（**站内通用 `TxSuccessDialog`**：✓章+双色题+每币回执台账行+explorer 哈希行+Close，最后一个弹窗），取消/回退留在进度弹窗由壳层 ✕ 关闭；失败仍走 `txErrorText` 页内状态块与解析失败红字 FieldError。**冷却期按钮禁用（2026-10-22 用户裁定「没 ready 就不可点」）：confirmed 回执当刻对本次领取的行写入乐观冷却 `now+24h`（`FAUCET_COOLDOWN_S`）锁定 Claim，随后 lastClaimed 重读单调合并不倒退——lastClaimed 链上只增不归零，滞后区块读到 0/旧值不允许把已知冷却打回 Ready，杜绝「回执后 RPC 滞后→行假 Ready→重复点击被钱包预检静默拦截」** |
| 兑换弹窗 | 触发=Get UUSD（ax-ghost-cta **size sm**——四轮合并后落 UUSD 行 actions 列，与 Claim 钮同行高；页内唯一黄）；壳=共享 `ActionDialogShell/AmountField/DetailRows/DialogCta`（`components/global/action-dialogs.tsx`）：方向 chips（Get UUSD / Back to USDC）+ 金额字段（Balance/Max/余额不足 FieldError）+ 明细（Rate 方向化 `1 USDC = 1 UUSD` / Fee（方向对应 tin/tout）/ You receive=输入×(1−费率) / Mint capacity left 仅 Get 方向）+ CTA（未连接=Connect 可点；已连接=输入有效且 executionReady 时点击接 PSM 管线，不再恒定禁用）。**免站内审阅（2026-10-22 用户裁定，决议 037）**：弹窗四行明细已承载 Rate/Fee/You receive/Mint capacity left，点击后经 `usePsmSwap.start(..., { skipReview: true })` → `use-tx-center.executeSession` 直进钱包确认（session batch 保留 approval+mint 同批原子性），不渲染 `TxReviewPanel`、无无限授权/撤销控件（审批默认精确额度），进度=独立三步条进度弹窗（`FaucetTxProgressDialog` 叠于本弹窗之上，**无任何按钮、永远倒数第二**；2026-10-26 用户裁定，废止 047a「弹窗内嵌三步条」形态——钱包自身弹框已构成反馈，内嵌条对所有钱包重复），confirmed 自动换面获取/兑回成功弹窗（**站内通用 `TxSuccessDialog`**：✓章+双色题+付出/到账两腿回执行+explorer 哈希行+Close，最后一个弹窗），成功另以余额变化并存感知、取消保留输入、失败 FieldError 留在本弹窗。**钱包路由**：`use-tx-center` 经 `lib/web3/write-route.ts` 的 `routeWrite` 按钱包分派——Privy 内嵌钱包走 Kernel type-4（approval+mint 同批）；外部钱包（MetaMask 等）走 EIP-5792 `wallet_sendCalls`（PSM spec 的 `calls` 两腿原样进钱包，升级确认在钱包弹窗内完成，不签 authorization）；探索失败或无 `calls` 时返回 `unsupported`，弹窗内 `FieldError` 展示 `wallet.account.callsUnsupported`（「当前钱包暂无法完成这笔交易」）并禁用 CTA，不伪装成用户取消、不谎称需升级钱包。轮询 `wallet_getCallsStatus` 超时保持 Confirming…（返回 pending，不判取消），关闭弹窗 `reset()` 清态；执行失败（回退/RPC/gas）展示 `wallet.errors.txFailed`。Portfolio Convert 弹窗与参与/Swap/四池等动作弹窗同槽同判据，经同一路由按钱包分派（`errorKind` 展示 wallet-unsupported）。模式切换保留输入；打开为空输入（2026-10-08 全站口径）；无滑点/deadline 参数→不设设置齿轮。**余额来源（2026-10-21 用户裁定：个人数值不占服务端资源，SSR 只带 accountless 值）**：连接态=弹窗打开时经钱包 provider 现读 PSM `uAsset()/reserveToken()` 两侧 `balanceOf`（在途/失败=null→AmountField `--`，null 不渲染纪律）；未连接=服务端 accountless 值（onchain=0、fixture=样本，fixture/e2e 基线不变）；`getFaucet` 恒走 30s SWR config 缓存（key `faucet-97`），连接态 claim 可领探测本就在客户端（faucet-claims） |
| aria | 面板 `aria-labelledby`（h2）；chips `role="group"`+`data-selected`；数字全 `data-numeric`；弹窗 base-ui Dialog 内置 focus 圈闭/还原；✕=common.close |
| 导航 | navItems 增 `faucet`（Droplets 图标）→ 侧栏+移动底栏（底栏 6 格，grid 列数同步 5→6）；marketing 顶栏第 5 项（编号 05，决议 024 自动序号）；copy `common.faucet` 双语 |
| e2e | `e2e/pages.ts`：faucet/faucet-disconnected（en 三档）+ zh-faucet/zh-faucet-disconnected（zh 移动档）；导航扩项波及全站既有基线→全量重录（`--update-snapshots=all`） |

## 35. ProtectionExitDialog（保护窗 Exit 弹窗 · 已落地 · 2026-10-09）

| 方面 | 契约 |
|---|---|
| 用途 | Portfolio ①待办区保护窗卡 Exit 钮触发的页内退出弹窗（`components/portfolio/protection-exit-dialog.tsx`；2026-10-09 用户裁定：卡 CTA 由跳 verse 页改页内弹窗，用户可选 POL 赎回为 LP 或直接拆成 memecoin+uAsset；壳/原语复用 `ActionDialogShell/AmountField/DetailRows/DialogCta`，模式 chips=`.pf-dialog__chips`，无新 class）。上下文由 portfolio-page 预取（`ProtectionExitContext`：verse+pol+主池价+uAssetUsd）；fixture 缺 pol 行的 protection 项不进映射 → 卡片回落跳 verse 页（ActionZone 内旧 Link 保留） |
| 机制口径 | =`redeemMemecoinLiquidity` 两 overload（`MemeverseLiquidityImpl.sol:851/870`）：**LP 模式**=unwrap=false，POL 1:1 换主池 LP 直转（`_redeemCore:889` `amountInLP=amountInPOL` by main-pool construction；非价格敏感、合约无滑点参数→**无齿轮**，§23 同口径）；**拆币模式**=unwrap=true，LP 现场拆 memecoin+uAsset，6 参强制 amount0Min×2+deadline（3 参 unwrap 直接 `SlippageProtectionRequired`——:852-854；OutrunBook lifecycle.md:103「must set a minimum output amount and a deadline」）→ SwapSettings 齿轮（slippage+deadline）+ Min received/Max slippage 明细行（§24 同款）。闸门 Stage.Unlocked（`:891`）——保护窗卡本身即 unlocked-in-window，卡片可见即可开弹窗。输出腿序=memecoin 主腿在前+uAsset 腿（§21 井读数同序） |
| 输出推导 | uAsset 腿=量×`uAssetPerPol`；memecoin 腿=量×`uAssetPerPol`÷主池价（candles 末收盘=repository `currentPrice` 同链；池价比 pro-rata 推导，价样本缺→0.00 槽）；≈$ 回声=§21 换算源（uAsset 腿×uAssetUsd、memecoin 腿×价×uAssetUsd，样本缺→行不渲染）；Min received=双腿×(1−slippage)，滑点越界期双值与 Max slippage 行同退 '--'（§25 口径）；slippage 默认 0.5、deadline 默认 10（§24 先例默认） |
| 输入侧 | 单输入=POL 数量（Balance/Max，余额=`myPol`）；打开为空输入（2026-10-08 全站口径）；余额不足短句由 AmountField 兜（2026-10-04 裁定）；模式切换保留输入（ConvertDialog 同款） |
| CTA | 未连接=Connect Wallet 可点切换模拟连接；已连接=Exit now 禁用（原型不伪造链上成交）；触发器=卡底 outline 钮同位替换（`DialogTrigger` 显式 `data-slot="button"` 钉回，§17 踩坑） |
| 文案 | `portfolio.action.exit*` 十键双语（exitTitle/exitModeLp/exitModeSplit(`{m}`+`{u}` 插值)/exitReceive/exitCta/exitMinReceived/exitMaxSlippage/exitSettingsTitle/exitSlippageTip/exitDeadlineTip，2026-10-09 新增）；卡 CTA 仍 `ctaProtection` |
| e2e | 弹窗关闭态像素=卡底钮同位同款，portfolio 七基线复跑全绿未重录；打开态=基线外交互态，Playwright 截图五态人工核对（en LP/拆币填数、zh 拆币、mobile 390） |

## 36. LoginDialog（登录弹窗 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | 全站唯一登录入口（Google / X / MetaMask 三行，邮箱 OTP 已退役） |
| 结构 | 品牌章 32px + 可见标题 + 副题一行 + 三行纵排（官方自托管 SVG 18px + 文案 + 上次使用徽章）；MetaMask 未安装时该行退为回退入口（移动端 universal link 进 App 内浏览器，桌面端下载页） |
| 状态 | default；X 登录失败=行内短错 + Retry 真重试（重跑上次点的同一家；无上次目标时仅清错，按钮不隐藏）；OAuth 跳转中整列禁用防重入 |
| 断开 | 显式断开=断全部 live 连接（wagmi 无参 disconnect 只断当前连接，多连接残留即假连接），best-effort 断全后必 logout（失败不断成半登出，`catch` 吸收 + `finally` 清旗标）；真正退出社交路径的是断全（地址清空）+ 两弹窗/恢复的自动回链门，清徽章（`forgetLastLogin`）只是显示卫生。`disconnect-guard`（`lib/web3/disconnect-guard.ts`：内存+storage 双层 `outrun:disconnecting` 旗标，隐私模式退化到内存）覆盖整个 leave 窗口，弹窗两 effect（OAuth-link + returning）与会话恢复共三处消费。登出中均不自动回链（`authenticated` 门 + 同旗标门），登出后重开弹窗只见三行不再闪关。单测 `disconnect-guard.test.ts` + `wallet-selector-dialog.test.ts` + `account-dropdown.test.ts` + `login-session-restore.test.ts` 锁定 |
| 顶栏显示 | Google 名（无名取邮箱）、X @username（无取 name）、MetaMask 取地址截断；身份标签只在 onchain 构建挂载 |
| aria | 行钮可达名=行文案；错误行 role=alert；图标装饰 aria-hidden |

## 37. 写链路基建（components/global/）

| 模块 | 职责 |
|---|---|
| `use-tx-center.ts` | 全站写流中枢：`executeDirect`（免审阅直签，§34）/ `executeSession`（Kernel 会话批）→ `lib/web3/write-route.ts` `routeWrite` 按钱包分派（内嵌钱包=type-4、外部钱包=EIP-5792 `wallet_sendCalls`，无 `calls` 返回 unsupported）；`outcome === 'confirmed'` 时按 spec 的 `writeScope` 统一调 `refreshVerseAfterWrite`（中央层刷新，lib/data/write-refresh.ts） |
| `write-session.ts` | 点击链路会话缓存：`prefetchVerseSession` 首次交互预热（verse 元组/部署表/token decimals），`getVerseSession`/`getTokenDecimals` 点击时命中缓存；同落地链+verse+account 在途解析并发合并 |
| `genesis-live.tsx` | `VerseLiveProvider`：交易确认（`tx.display === 'confirmed'`）或账号/链切换时经钱包 provider 定向探针重读（`writeNonce` 信号），读数只在钱包实链 ∈ verse 落地集时落值、失败保持基线（null 不覆盖）——见 §14 |
| `use-psm-swap.ts` | PSM 面值兑换写路径（`skipReview: true` 免审阅直达钱包，§34） |
| `execution-reads.ts` | 执行链链上读（verse registry、池键、quote、token 状态），全部经活跃钱包 provider（客户端路径无服务端密钥），reader 接口可在无链环境单测 |
| `live-participations.ts` | Portfolio 参与区客户端在场的存在性 store：onchain 构建下参与区经钱包 provider 读行，向页级 ExploreCta 发布「是否扫到行」——全分区空态门（SSR hasZoneData 在 onchain 构建结构性为空） |

## 附：组件间通用交互契约

- 弹层（AssetSelector/ChainSelector/交易中心）：Esc 关闭、焦点圈闭（focus trap）、关闭后焦点还原触发器。
- 所有异步动作：进行中可取消或明确不可取消；完成后 toast + 内联状态双通道。
- 复制：`navigator.clipboard` 写入 + 内联 ✓ 1600ms 回落（共享实现 `useCopy`（components/global/use-copy.ts）；无 toast、无失败回退为当前有意口径，2026-10-08 附则对账）。
- 地址/hash/symbol/长文本：截断统一 `0x1234…abcd`（共享实现 `formatHex`，signal-ui）；悬停提示与复制钮随各组件裁定、非全站强制（referral 两表纯文本缩略，CopyAddress/链接面板/分享弹窗带复制钮）。
- 交易反馈面归属（2026-10-26 用户裁定，**全站已落地**）：站内确认=各流程动作弹窗（明细行+网络费在窗内）；弹窗序列纪律=三步条进度弹窗独立于动作弹窗、**无按钮、永远倒数第二**（`TxProgressDialog`，`components/global/tx-progress-dialog.tsx`，`.tx-progress-body`），confirmed 后以成功弹窗收尾——**成功 UI 全站唯一=`TxSuccessDialog`（`components/global/tx-success-dialog.tsx`，参与创世回执解剖：✓章+双色题+回执台账行+explorer 哈希行+CTA），不得另起成功面**；confirmed→成功窗开门闩=`useTxSuccessGate`（`components/global/use-tx-success.ts`：捕获哈希/链→开窗→reset，回执腿由各调用方点击时快照、窗体常驻评审态在下）。已接线清单：faucet claim+Get UUSD、参与创世、verse Swap 确认、创建注册、portfolio Bridge/Convert/CDP 赎回/USR 存取/保护期退出、POL 铸造/闪电兑换/赎回 LP/赎回 PT·YT/拆分合并、池增删流动性、金库三动作、Claim Center、End Genesis——共 18 个写流；错误两桶（可恢复 FieldError / 终态失败块）；Gas 控件仅嵌入式钱包路径，外部钱包不渲染。签名终端层（站内独立签名确认面）曾试行并整体撤销，勿再引入。

## TokenIconMark（uAsset 代币图标，2026-10-07 定稿）

| 方面 | 契约 |
|---|---|
| 用途 | 代币资产身份图标：uAsset 族（UUSD/UETH/UBNB，含 Credit 前缀匹配）=品牌章；储备/原生（BNB/ETH/USDC/USDT）=官方**代币**图标（CoinGecko/Trust Wallet 代币资产源，全部落 `public/tokens/`；ETH=蓝圆白菱代币图标，勿用 `public/chains/` 灰阶链徽——链徽归链属语义，2026-10-07 用户纠错；第三方资产不套品牌章）；`components/global/token-icons.tsx`，`hasTokenIcon(symbol)` 谓词供混合列表降级判断；2026-10-09 扩 sUSDS/aUSDC——sUSDS=Sky 官方 CoinGecko 收录资产（assets.coingecko.com coins/52721，绿币白 S，250px PNG）；aUSDC=Aave 官方 `@aave/aave-ui-kit` 内嵌组合标（USDC+Aave 徽标 256 SVG，Aave 自家 aToken 客户端合成口径） |
| 制式 | v3.1 印章：黄地圆 `--logo-yellow` #FCEE0A + 品红字 `--logo-magenta-bright` #FF06B5，纯双色平涂、无边框角标渐变；几何=官方标轮廓追踪（ETH/BNB，`script/token-icons/extract-glyphs.py`）+ 对标调轻 $（UUSD 手绘）；构造/审计全记录 `docs/design/token-icons/README.md` |
| 辉光 | 品牌章允许辉光——token 图标属品牌资产层，豁免于「数据层文本零 glow」约束（零 glow 只辖数字/数据文本） |
| 资产 | `public/tokens/<t>.svg`（512 viewBox 主形）+ `<t>-256.png`（Trust Wallet 上架格式，`script/token-icons/export-png.mjs` 透明底导出）；改几何走 `script/token-icons/build.mjs` 重跑，禁手改 SVG |
| 接入位 | Portfolio 资产行 tile（20px，替代旧链徽/$ 文本占位——链徽只表达链属，2026-10-07 定稿换装）；Swap 选币器行（28px：uAsset=品牌章、BNB/ETH/USDC/USDT=官方图标，2026-10-07 用户指漏 BNB 后补；memecoin/POL/PT/YT 无图标品类保持二字文本徽章）；链徽仍归链分布行/跨链弹窗/Network 列（链属语义不变）；/faucet 领取行（sUSDS/aUSDC，2026-10-09） |
| 降级 | 未知 symbol 返回 null（谓词 false 时调用方渲染自身兜底，如选币器文本徽章）；无 alt（装饰性，aria-hidden 用法与 ChainLogoMark 同契约） |

## CandleChart 懒加载（lightweight-charts，2026-10-08）

| 方面 | 契约 |
|---|---|
| 用途 | lightweight-charts（~74KB gzip，verse 路由唯一重型 dep）不进路由 eager chunk，页面水合/交互不被它阻塞（裁决定案；运行时探针否决了 RSC 消费端 `next/dynamic` 不带 ssr:false 的方案——SSR 渲染真实内容时边界随根一起水合拆不出；带 ssr:false 则丢 SSR 外壳+占位跳动） |
| 实现 | `components/verse/candle-chart.tsx` 图表 init effect 内 `import('lightweight-charts')`（模块缓存使 locale 重建等重复 import 零成本）；顶层对 lightweight-charts 仅 `import type`；库就位建表后 `chartReady` 置 true、cleanup 置 false |
| 契约 | 三个消费 chart refs 的 effect（喂入/fitContent、无限左滑订阅、十字线订阅）deps 必须挂 `chartReady`；喂入 effect 顶部 `if (!candleSeriesRef.current) return` 整跑守卫——`firstDataRef`/`restoreRangeRef` 等标志的消耗不走 `?.`，图表未就位时必须跳过整跑，否则「首次挂载 fitContent / 视口恢复」标志被空转跑提前吃掉；chunk 加载失败走 `.catch` console.error，图表区保持空态不留 unhandled rejection |
| 已知边界 | init effect deps = `[locale, hasData]`（hasData=series 非空 ⇒ holder 在 DOM）：数据后到/细粒度空态往返（fineCandles 缺失）自动建/拆图表，不再留僵尸 chart；残余：该往返重建后初始视口为库默认而非 fitContent（firstDataRef 一次性、重建不重置，2026-10-08 拍板接受——schema 不强制 candlesFine 齐备，此路径随 fixture 完备度可达） |



## 38. ClaimCenter（领取中心 · 第五签 · 已落地 · 2026-10-26）

| 方面 | 契约 |
|---|---|
| 用途 | Verse 详情页第五签 Claim Center（locked/unlocked；`components/verse/claim-center.tsx` + 纯派生 `claim-rows.ts`；样式 `.claim-center/.claim-card/.claim-tab-badge/.claim-confirm`）：四张领取卡=预购解锁 / 创世 YT / 辅助池分成 / LP 费（2×2 卡格、≤640 单列；池卡壳+POL 井读数解剖），per-user 面唯一的集中领取出口（brief verse-overview「领取/退款中心」的领取半边；退款半边仍是退款态 `.refund-settle` 整区） |
| 行数据 | 预购解锁：可领=`claimablePreorderMemecoin(verseId)`（msg.sender-scoped，eth_call from-address）、已领=`userPreorderData[1]`；线性解锁进度=时间口径 (now−结算时刻)÷时长，**ERC-7201 存储槽直读 + subgraph 双源对照**（OZ SlotDerivation 双重 keccak 基槽 `0xe4d6…8f500`；`preorderVestingDuration`@+11、`preorderStates[verseId].settlementTimestamp`@entry+2；第二源=`readVerseLockedAt` subgraph stage-change 权威时间戳）——双源偏差 ≤1h 才渲染进度槽，第二源缺失或坏槽位=槽缺席不渲染（用户数据纪律裁定：坏读数宁可不出数，禁止出错数）；回归资产=`tests/unit/data/claim-center-net.test.ts`（RUN_NET_REPRO 门控实链测试，锁死「viem multicall 不拆 from、作用域读必须独立 readContract」的静默零值坑）。创世 YT：`totalNormalClaimableYT×userFund÷totalNormalFunds`（SettlementImpl.sol:100 同式）、一次性 `normalYTClaimed` flag。辅助池分成：`normalFeeStates×userFund÷totalNormalFunds−userNormalFeeClaims` 双币腿（uAsset+PT）。LP 费：`swapRouter.previewClaimableFees(memecoin,uAsset,owner)`（主池口径，fee0/fee1 币序按池 key 地址序贴 symbol；辅池留后续层） |
| 卡规则 | 解锁中可领 0 的预购仓位保卡（已领+进度可见、CTA disabled）；一次性 YT 领后卡删；多币腿=非零腿优先作主读数、余腿「+ 腿」次行同色同权；卡全空=空态文案；LP 费逐池=首版仅主池；**单批多活读取 + 逐槽降级**（用户两轮裁定合成：性能=全部 ABI 读并入一次 `client.multicall(allowFailure:true)` 批处理——15 次 eth_call 收敛为 1 批 + 1 个 msg.sender 作用域独立 `readContract`（**viem multicall 不拆 from**——带 `account` 的调用若进 aggregate3，msg.sender 失真为 multicall 合约、作用域读静默返回 0，实盘踩坑后改为显式独立调用）+ 2 次 `eth_getStorageAt`，两波往返；独立性=批内逐槽 status 决定各卡降级，任何一槽 revert 只掉自己那张卡；仅 verse 代币地址为共享前置，YT 与分成共享 pro-rata 公式基数（genesis fund÷total normal funds，机制决定））；读态=「正在读取可领项…」、失败/超时（20s deadline）=独立失败文案，聚焦/切页自动重读（MyParticipationStat 先例）。领取钮 outline 满宽钉底（黄不进此面板） |
| 交互 | 确认弹窗一步（用户裁定 2026-10-26）：弹窗即审阅面（行标题+金额台账 hairline 行+领取 CTA）→ §29 直写（`tx.executeDirect`）→ TxStatus 三步态同弹窗内切换，不套第二层弹窗；写腿=claimPreorderCall / claimNormalYTCall / claimNormalFeesCall（launcher）、claimLpFeesCall（hook `claimFeesCore`——LP 费所有权严格从 msg.sender 派生，recipient 仅转发地址）；LP 腿点击时经 `readPoolKey(memecoin,uAsset)` 解 hook 地址；writeScope=verse（确认后双层刷新）；弹窗关闭/成功后 provider refresh 重读 entitlements |
| 链与账户 | 实盘读走钱包 provider 于钱包当前落地链（EndGenesis 同口径——领取在哪条链参与就在哪条链发起；跨链合计=后续层，MyParticipationStat 服务端腿家族）。错链=SwitchChainCta；未连接=连接引导行（tab 常驻无徽章）；账号/链切换=读态重置（'--' 槽，不造假「无可领」） |
| 徽章 | 第五签计数徽章 `.claim-tab-badge`（青、FastBadge 边框族）：连接+读毕+有可领行才渲染（解锁中 0 可领不计入——无事可做不提醒）；fixture 构建不渲染徽章（样本行非本人数据） |
| Fixture | `polPositionSchema` 扩 7 个 optional 领取腿（claimablePreorder/claimedPreorder/preorderProgress/claimableUAssetFee/claimablePtFee/claimableLpMeme/claimableLpUAsset；verse-002/003 样本等比缩尺）——fixture 构建=SSR 样本行+惰性 CTA（不造假执行，e2e 基线）；onchain 构建账户无关 SSR 恒 null，连接后客户端读值 |
| 深链 | `?tab=claim`（`VERSE_TAB_KEYS` 白清单第五键）——portfolio 待办领取行的出口落点（该深链行尚未接，登记于 portfolio.md 出口规则） |

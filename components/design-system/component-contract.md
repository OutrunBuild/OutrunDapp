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
| 结构 | 标签 + 输入框（data-numeric）+ 余额行（`Balance: 12.4 USDC` + `Max` 按钮）+ 法币参考值（可选） |
| 键盘 | 数字/小数点/退格；粘贴净化（去逗号空格）；↑↓ 步进 0.1；非法字符静默拒绝；多小数点折叠为首个点（共享实现 `sanitizeAmount`，`components/global/amount-input.ts`，2026-10-03 全部金额输入统一）；余额预填/Max 填充一律 `amountToInputString`（6 位精度整串，禁裸 `String()`——小值科学计数法会被清洗错切） |
| 状态 | default；focus（青环）；disabled（来源资产未选）；error（超出余额/低于最小精度/dust 域）——错误文案例「Amount exceeds your balance」+ 恢复链接 `Use max` |
| 校验边界 | dust 域（quote 返 0 不可执行，complexity-map PSM 行）→ 提示「Amount too small to convert」并禁用提交 |
| 大数边界 | 输入 `maxLength=40`（共享常量 `AMOUNT_MAX_CHARS`，与 `sanitizeAmount` 同居 `components/global/amount-input.ts`，2026-10-03 全部金额输入统一；float64 有效数字 ~17 位已覆盖）；派生金额/法币值绝对值分层降级——≥1e15 Intl 紧凑记法（`39,226T`/`39,226万亿`；注意 compact 超大值不省略，会退化成全量数字+单位后缀）、≥1e21 科学记法（`4.3585E40`），全展开千分位长串与裸 `toFixed` 科学计数法禁止进卡面；CSS 兜底截断省略仅加于纯数值槽位 `__output`/`__field-usd`（详情行 dd 是文案不许截，靠格式化分层保界）——共享实现 `fmtUsd`/`fmtTokenAmount`（`components/global/amount-format.ts`，2026-10-03 由 swap-panel/pol-mint/pool-add/pool-remove/pol-flash 五处逐份复制收敛为唯一实现）。2026-09-23 demo 参照页 180 位数字溢出教训 |
| 图标 | 无（纯输入）；单位随 AssetSelector 联动 |
| aria | `aria-invalid` 于错误；错误文本 `aria-describedby` 关联 |

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
| 规则 | 徽章用自然语言（`Ends in 2d 4h`），非极客缩写 |

## 5. VerseStage（生命周期阶段）

| 方面 | 契约 |
|---|---|
| 用途 | Verse 四阶段状态呈现（Genesis/Locked/Refund/Unlocked；参照 letsbonk 迁移横幅+four.meme 阶段指示器证据 PU-002d/PU-003t） |
| 结构 | 横向四节点指示器（当前阶段高亮黄）+ 阶段徽章 + 关键量化行（达标进度**双门槛独立**，禁止单进度条合并——complexity-map 附注 4） |
| 状态 | 每阶段=default；当前=黄高亮+描述文案；可触发阶段推进时显示 `Advance stage` 按钮（需交易触发，lifecycle）+ 倒计时（data-numeric） |
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
| 索引延迟 | lag>120s → 表头同步徽章 `Syncing · 2m behind`（warning 色）+ 数据以 RPC 为准提示（§9.2） |

## 7. TransactionReview（交易审阅）

| 方面 | 契约 |
|---|---|
| 用途 | 签名前统一审阅（§7：目标链/账户/合约/函数语义/输入/最小输出/费用/gas/授权变化） |
| 结构 | 摘要头（动作名+TokenPair）+ 明细行（可展开，Jupiter 范式 PU-005）+ 费率分解区（动态费率四项展开，complexity-map /trade）+ 主/次按钮 |
| 状态 | default；loading=`Simulating…`（Type-4 模拟中，禁用按钮+行内状态）；simulation 失败=错误块（解码后 custom error 人话+恢复：调整参数/重试/取消）；禁用条件=余额不足 gas/授权缺失/报价过期（`Quote expired → Refresh quote`） |
| 规则 | 审阅数字全部 data-numeric；价格保护线/滑点/截止必显；授权变化单独区块（`This gives the pool access to …` 措辞） |
| aria | 审阅区 `aria-live="polite"` 于状态变化 |

## 8. TransactionStatus（交易中心状态）

| 方面 | 契约 |
|---|---|
| 用途 | 统一交易状态流（§7 十一态：Preparing→Preflighting→Awaiting authorization→Simulating→Awaiting signature→Submitted→Confirming→Confirmed/Reverted/Replaced/Cancelled） |
| 结构 | 步骤列表（当前步高亮）+ 关键事实行（hash/链/gas）+ 恢复动作 |
| 状态映射 | 见 state-matrix.md §3；跨链=`Message pending` 常驻直到目标链确认（源链 hash≠完成，§7） |
| 动效 | 步骤推进=状态反馈动效（非装饰）；Confirmed=回声确认 |
| aria | `aria-live="assertive"`（交易状态是关键信息）；每步文本化 |
| 原型落地 | `components/global/tx-status.tsx`（2026-10-01）：T4→T5→T6 三步条，create-form 注册审阅 + participation-panel 参与审阅共用；无钱包——签名/上链由前端定时模拟推进（≈1.6s/≈1.2s），无 hash/gas 故关键事实行省略；T6 展示：注册流=自动弹窗（`.pol-mint` 壳复用，「查看 Verse」CTA→样本 verse-021——新 verseId 链上才产生，生产=注册回执；用户裁定 2026-10-01）、参与流=内联 `.tx-success` 回声块（CTA→portfolio）；拒签 T9 模拟不含 |

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
| 实现 | `discovery-browser.tsx` → `li > a.economy-card[data-stage][aria-label]`；样式 `.economy-card*`、容器 `.economy-grid` |
| 结构 | `__header`（`__symbol` + `__identity` 名称/符号 + StageBadge）→ `dl.__facts`（通栏 footer：锁定/已解锁=国库资金+解锁时间，其余=累计募集+创世截止；值 `data-numeric`）→ `__signal`（按阶段切换：progress / liveMetrics（锁定与已解锁共用：Staking APY + Volume 24h + 参与人数三行读数，前两者 fixture 缺失显 unavailable 槽位）/ returningCapital） |
| 状态 | default；hover / focus-within 提升一档表面 + 青选择线；阶段色经 `--stage-color` 出现在主线（顶缘+色点），回声线经 `--stage-next`（=下一阶段色，2026-09-26 用户裁定双线规律：genesis 黄+品红 / locked 品红+青 / unlocked 青+黄；refund 终态橙+品红） |
| 规则 | 每卡只突出一个信号区；数字零 glow；进度用 `role="progressbar"` + 文本 |
| 响应式 | `.economy-grid` auto-fill；≤30rem `__facts` 堆叠、header 折行 |

## 13. PageIntro / StageTabs / SectionHeading（页面结构原子 · 已落地）

| 组件 | 实现 | 契约 |
|---|---|---|
| PageIntro | `.page-intro`（h1 + p ≤66ch，底部黄 2px + 品红 1px 回声） | 每页一次，唯一 h1 |
| StageTabs | `.stage-tabs a[data-active]`（56px，激活 = 顶部黄线 + 黄字 + 黄 inset） | 单页内阶段切换；与 LifecycleTabs 不同页混用 |
| SectionHeading | `signal-ui.tsx` 导出，`header.section-heading.ax-echo-bar`（`__row` = h2 + aside；description `<p>` 在行下、贴底边框；签名线锚定边框不随描述下沉，决议 014 几何化） | 每个 section 一个 h2，`aside` 放筛选/计数；`id?` 透传 h2 作为 `aria-labelledby` 目标（showcase 六区块 2026-10-03 由内容元素迁至 h2） |
| Verse 头部 | `.verse-hero`/`.verse-identity`（verse-page 内联） | （2026-09-22 用户裁定多轮定稿）symbol 大图形（约 198px）绝对定位左侧，文本列 padding 让位：①名称行=ticker 在前（数据等宽 `--text-num-lg`+主行动黄+大写字距+抖音式错版 text-shadow：青左上/品红右下 0.08em）+name 随后（`--text-lg` 无回声阴影，不抢戏）+徽章右推同行；②描述紧跟名称行（SPEC-M8 ≤255 字节→68ch 约四行）；③底行两端=链信息（左，label 样式：`--text-sm`+大写+0.08em 字距，与描述正文分层；组间 `--space-5`/组内 `--space-2`）+社交图标（右，同 flex 行天然同线）；社交=官方品牌图标（`brand-icons.tsx` simple-icons path：X/Discord/Telegram+lucide Globe），顺序 website→x→discord→telegram（repository SOCIAL_ORDER；fixture kind twitter 已改名 x）；「Economy overview」标签删除；hero 顶部无 padding（主容器 24px 唯一留白）；底部签名线随阶段双线规律（`data-stage` 驱动 `--stage-color` 主线 + `--stage-next` 回声，与 economy-card 上边缘同律，2026-09-26）；四项统计在右列 `.stats-panel` 新卡（Key metrics 2×2） |

## 14. ParticipationPanel（创世参与面板 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | Verse 详情页（`stage=genesis`）参与工作台：选择参与方式、输入金额、审阅后确认（原型不发交易） |
| 实现 | `components/verse/participation-panel.tsx`；样式 `app/globals.css .participation-form/.participation-toggle/.participation-toggle--mode/.participation-fixed-asset/.participation-review*` |
| 结构 | 模式层三项 ToggleGroup `.participation-toggle--mode`（普通创世/杠杆创世/预购——预购与创世同级，用户裁定 2026-09-21；顶层 tab 风格：无框透明底、激活=黄字+底部黄线，底边线兼作分割线（`ax-echo-bar` 签名线锚定其下），与路径分段框区分——2026-09-22 用户裁定；无可见字段标签，`aria-label`=「参与方式」；section 可见标题/描述删除——与右侧「当前可以做什么」完全重复，纲要由 sr-only h2 维持）→（非预购）路径两项分段 ToggleGroup →（预购）Verse 级容量 ProgressMeter（已用/上限；见「预购面板」行）→ **支付资产+金额并排** `.participation-duo`（grid 两列等宽 1fr/1fr；用户裁定 2026-09-25：单字段各占一行太占空间，同日二次裁定两列等宽；小屏折单列；支付资产多选项=Select、唯一选项=固定值 `.participation-fixed-asset`；**预购模式支付资产同为下拉**——uAsset 直付+储备面值直兑，help 文案 uassetHelp/directHelp 随选切换；**stake=三格同行** `.participation-trio`（来源/参与资产/金额 grid 1fr 1fr 2fr，用户裁定 2026-09-25））→（非预购）一键预购开关+预购 **duo**（Pay with 下拉与主选择独立+预购金额 Input 并排 `.participation-duo`——用户裁定 2026-09-25）→ 审阅卡 |
| 状态 | 杠杆模式：披露 `form-warning`「损失上限=所付利息 · 无清算 · 创世失败利息全额退」；fixture 缺利率/上限快照=null→显「以链上读值为准」槽位+提交禁用（2026-09-22 起快照齐备即全交互）；金额/预购金额为空提交 → `data-invalid` + FieldError；审阅态 `aria-live="polite"` |
| 杠杆面板 | 利息金额输入（标签切「利息金额」）；路径三项=用 uAsset 直付/面值直兑（PSM 储备转利息，无 CDP 仓位）/创世积分直付（`leveragedGenesisWithCredit` 锁定时销毁；杠杆无质押项）；实时预览=借贷资金数值（口径=利息÷利率，一次性比例非年化，**UI 只显 label+数值不显公式**——用户裁定 2026-09-25，`leverageDebtPreview` key 已删并入 `leverageDebtQuota`；`data-numeric`；**UI 词「借贷资金/Borrowed funds」=用户裁定 2026-09-25**——OB 原词 debt quota 暗示未使用配额，实为参与即发生的已用借贷资金；机制口径/代码标识符仍 debt quota）；债务上限余量（Debt cap headroom；2026-09-25 用户最终裁定沿用原词）=债务上限−已建债务（已收利息÷利率），超限→FieldError「超出债务上限——剩余可建额度 {quota}」+提交拦截（对照 stockCap 模式）；一键预购上限按借贷资金推导（容量=(普通资金+杠杆债务本金)×70%×容量比例）；审阅屏**分组化**（用户裁定 2026-09-25，可读性；同日二次裁定：组序=进创世在前、你支付在后，两组标题颜色区分）：概要两行（参与方式/Pay with）→「进入创世 ENTERS GENESIS」组（**标题与数值均青** `--accent-link`）=折算/借贷后 uAsset 行（普通=创世金额、杠杆=借贷资金；预购资金主池开放后才买入→preorder-only 无本组）→「你支付 YOU PAY」组（标题 secondary 灰）=实付代币行（杠杆=利息金额；普通=支付金额；+预购金额行；**支付项同资产时出加粗「支付合计」行**，异资产不硬凑）；黄保留给 CTA；结构 `.participation-review__rows/__row/__group/--genesis`（create-form 审阅仍 dl 平铺不受影响）；审阅头部图标 32px 描边框+与标题居中对齐（对齐 §15 CurrentAction 先例，2026-09-25） |
| 一键预购 | 开关开启才出现预购金额输入；**实时可预购上限**=创世资金按面值折算 uAsset×70%×容量比例（`verse.preorderCapacityRatio` fixture 快照，缺失=null→仅显「以链上读值为准」槽位）；上限随创世金额输入实时更新（`data-numeric`）；超限→FieldError「超出可预购上限——最多可预购 {cap}」+提交拦截（对照 stockCap 模式）；提交校验两项均 >0 |
| 预购面板 | Verse 级容量进度条 ProgressMeter（标签「预购容量」，位于金额输入前）：容量=（普通创世资金+杠杆债务本金）×70%×容量比例（`MemeverseLauncherLib.preorderMaxCapacity`，真源口径同 glossary；债务本金=已收利息÷利率），已用=`verse.preorderRaised` 快照（合约 `PreorderState.totalFunds`）；容量随创世资金实时变化（合约 dev comment）→ 注「以链上实时值为准」；金额约束=剩余容量（容量−已用，先到先得、合约超 cap revert，`IMemeverseLauncher preorder`）→「可预购余量」FieldDescription+超限 FieldError「超出预购容量——最多可预购 {cap}」+提交拦截（对照杠杆 stockCap 模式）；比例或利率快照缺失=null→槽位「预购容量待链上读值」+CTA 禁用（对照 leverageRateSlot） |
| 规则 | **路径决定支付资产**（用户裁定 2026-09-22；同日二次裁定合并直付与面值直兑）：直接参与=支付资产下拉「募集 uAsset（直付，默认首选）+ PSM 配对储备资产（面值即时兑换）」，说明文案随所选资产切换（**渲染于 Pay with 下拉下方**——用户裁定 2026-09-25：direct/credit/预购统一移至支付资产处，stake 路径说明仍随路由分段框）；质押参与=**两级联动下拉**（用户裁定 2026-09-22）——先选「质押来源」（Lido/Aave…，读 `fixtures/data/yield-sources.json` registry，样本口径=OutrunBook vision.md 协议清单+OutStake adapters；**来源按本 Verse uAsset 族过滤**（来源 `anchor`=uAsset 符号去 U 前缀；用户裁定 2026-09-22：UETH verse 不出现 USD 族来源如 sUSDe）；切来源→参与资产组随之切换并回落首项，如 Lido→ETH/wstETH/stETH、Aave→ETH/aETH），再选「参与资产」——由 `getFixtureParticipationOptions(verse.raiseAsset)` 出口 `yieldSourceRegistry`，不写死；无选项路径项禁用；预购模式**金额仍按募集 uAsset 计价**、支付资产组与直付同款可选（uAsset 直付+储备面值直兑——用户裁定 2026-09-25）。审阅屏分组化见「杠杆面板」行（用户裁定 2026-09-25）；折算口径：质押路径 sy 资产按实时价值折算 uAsset——fixture `anchorValue` 样本率（OB:outstake/uasset.md:21 机制、:48 wstETH≈1.05 样本），direct 路径面值 1:1 直兑；**折算一律出数值不显槽位**——sy 资产缺 `anchorValue` 快照时兜底面值 1（用户裁定 2026-09-25），一键预购上限同口径联动折算值。数字全部 `data-numeric`；一屏唯一黄 CTA（审阅按钮） |
| 密度 | 路径分段框行高=`--row-height`（44px，T2 表格档；2026-09-22 用户裁定自 T3 放松档 56px 收紧）；模式 tab 行高=`--control-height`（40px）；参与卡 padding-block-start=`--space-2`（8px，`.workbench-primary` 专属覆盖——用户裁定二次收紧；其余三边 16px）；面板无表头附加间距（`.participation-form` 不设 padding-block-start） |


## 15. CurrentAction（当前行动卡 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | Verse 详情页副工作台（`workbench-secondary` 首位）：按阶段告知用户当下可做什么、解释阶段推进入口状态（`components/verse/verse-page.tsx` CurrentAction；样式 `.action-panel*`） |
| 创世文案四态 | 按双口径达标+Fast Genesis 分派（真源 lifecycle.md:53-55，2026-09-22 文案重写）：①常规（未达标未截止）=「创世开放参与中。截止后任何人可触发阶段推进。」②非 Fast 已达标=「成功门槛已达标——创世将进入锁定。阶段推进待创世截止后触发。」③Fast 未达标=「任一门槛达标，任何人即可触发阶段推进——无需等到截止。」④Fast 已达标=「任何人现在即可触发阶段推进，提前结束创世。」；旧第二句「截止后参与仍计入判断」属黄昏区口径（决议 008），只在截止后未推进态成立，当前 fixture 无该态样本、不常驻渲染 |
| 按钮 | 创世=「触发阶段推进」outline disabled+title「Sample data — the clock does not advance」（原型时钟固定，全站原型按钮不发交易）；非创世=「Connect to check eligibility」disabled；locked 额外出行「触发费用分配」说明块 |
| 结构 | `.action-panel__head` 横排=阶段图标（32px 描边框，`--space-6`；2026-09-25 用户裁定框 40→32，内图形 `--text-md` 不缩）+「What you can do now」标题同行；下方正文/按钮/费用分配块纵向 `gap: var(--space-3)` |
| 规则 | 图标随阶段语义+阶段色（2026-09-22 用户裁定多轮：原 GitCommitHorizontal 常青框→沙漏→里程碑→`ChevronsRight` 双箭头，用户选定——下一步行动/现在就动）：genesis=双箭头/黄、locked=锁/品红、unlocked=盾/青、refund=退回/橙（token 同 stage-badge）；数字无；文案全走 `getCopy(locale)` 双语；与参与面板分工=面板管操作、本卡管阶段推进解释，不重复参与引导 |


## 16. CreateForm（创建 Memeverse 表单 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | `/memeverse/launch`（R-04，原 /launch、更早 /memeverse/create；2026-09-23 裁定并入 /memeverse/* 域）发起人表单：身份信息 → 社区链接（选填）→ 创世规则 → 侧栏报价 → 审阅（原型不发交易） |
| 实现 | `components/create/create-form.tsx` + `create-page.tsx`；样式 `app/globals.css .create-*`；读链参数快照 `fixtures/data/create-config.json`（经 `getFixtureCreateConfig`；缺失=null→「以链上读值为准」槽位+提交禁用） |
| 字段（demo 布局序） | Flash Genesis=**Switch 切换开关**（首项：标签+⊙+开关，base-ui Switch 内联；青=Fast 功能信号）→ logo/名称/Symbol 并排（logo 限 PNG/JPG/WebP、≤3 MB——`accept` 白名单+onChange 二次复核（2026-10-02 用户裁定 3 MB+文案含 WebP；真源不含此值，产品口径），超限/坏类型可见 FieldError、格式体积说明收 ⊙；name/symbol 1–31 字节，SPEC-M8 registration-details §3；错误文案承载字节规则，无可见 hint）→ 创世时长独立行（+「天」后缀；**唯一可见 hint**=「Must be between 1 and 3 days.」，demo 同款；区间来源收 ⊙ tooltip）→ 资金类型/治理链/Omnichains 三下拉（uAsset 白名单；治理链说明收 ⊙；Omnichains=base-ui `Select multiple`，空值显「Select Chains」，治理链必含不可取消——本链 fan-out fee=0 SPEC-M8 §9；**全部 SelectContent `alignItemWithTrigger={false} align="start"`**——弹层落触发器下方禁覆盖，Explore 同款；详情页 participation-panel 三个 Select 同步修）→ 描述（1–255 字节必填，`data-numeric` 字节计数器，textarea 加高至 ~112px）→ **Communities 折叠面板**（边框容器：表头+⊙+chevron；展开=4 输入两列、品牌图标在输入框内——Website URL/X handle/**Discord invite url**/Telegram handle；底部注记「All community links are optional.」——本系统无斜体用 tertiary）。**除时长 hint 外全部字段说明收进 ⊙ `.create-info` Tooltip**。**无初始定价/最低成功额度字段**（非注册参数，SPEC-M8 §3+demo 均无，2026-09-22 用户裁定；OB lifecycle.md:22 张力登记 source-map §6） |
| 校验时机 | **即时（2026-10-01 用户裁定：只改报错时机，name/symbol 不加计数器——计数器仅 desc 有）**：超字节上限（name/symbol >31、desc >255）输入过程中即报（值驱动，无需失焦）；必填缺失失焦后再报（未动过的字段不提前报警）；提交失败仍一次性全显。config=null 时失焦不报时长错误（提交已禁用，参数不可得≠输入错误）。desc 计数器维持现状不复用到 name/symbol |
| 锁定期 | **无输入**：`unlockTime = endTime + FIXED_LOCKUP_DURATION`（365 days 合约常量非参数，config-matrix §3:83）——无常驻「合约固定条款」块，展示=审阅卡「锁定期」行（`config.lockupDays` 天） |
| Symbol 占用 | 同 symbol 上一 verse **创世窗口未结束即锁定**（RegistrationCenter:178 `SymbolNotUnlock`；endTime=注册+durationDays×DAY :186=创世截止——LaunchImpl:311-322；窗口结束 nonce+1→新 uniqueId 即可复用 :189-195）。值驱动即时判定（同字节超限口径）+ 提交拦截；FieldError=`Symbol is temporarily taken. Please try again later.` / `Symbol 暂时被占用，请稍候再试。`——**不带解锁时刻与条件、不加 ⊙ 气泡**（2026-10-02 用户裁定）；可用=静默（无对勾、无计数器）。匹配=精确字节串（大小写敏感、不 trim——合约 mapping(string) 原始字节键；提交按 trim 后值拦截）。样本=`getFixtureOccupiedSymbols`（verses 快照 `stage='genesis'` 行派生，经 create-page 传入）；占用判定以链上读值为准（生产=debounce 后 `previewRegistration`+`symbolRegistry` 读值，revert `SymbolNotUnlock` 解码兜底） |
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
| 输出推导 | POL ≈ uAsset 侧 ÷ `pol.uAssetPerPol`（fixture 样本线性推导）；Min. received = POL × (1−滑点)；Rate 行同 SwapPanel 主池口径；示意/链上读值/原型未接线类元文案一律不进 UI（含 title 悬浮）——内部开发原型，开发者不需要提示（2026-09-24 用户裁定） |
| 费率反转 | Rate 行挂 `.swap-panel__rate-flip` 幽灵钮（青功能信号，ArrowLeftRight 12px）：默认 `1 {meme} ≈ price {uAsset}`，点击翻 `1 {uAsset} ≈ 1/price {meme}`（toFixed(6)；price≤0/缺失时禁用）——Swap 卡同款同款态（2026-09-24 用户裁定，两处共用 CSS 与 copy.swapRateFlip） |
| 设置层 | 头部幽灵齿轮 → Popover 滑点 0.1/0.5/1%+自定义、截止 10/20/30min+自定义（复用 `.swap-settings` 原语与 swap-panel 导出的预设常量；tip 文案为 mint 语境「铸造将回退」）；自定义滑点校验=§25 口径（2026-10-03 迁移：`getSlippageIssue`+FieldError，error id 走 useId，越界 Min. received/最大滑点行退 '--' 槽位）；deadline 自定义输入同轮迁移拍板 A 整分钟口径（swap-panel 导出 `isWholeMinutes`：留点清洗 sanitizeAmount + 非整分钟 FieldError `deadlineWholeMinutes`，空/0 仍回退 1 分钟——既有行为保留） |
| 余额/Max | 输入卡=字段头（左 `mintSideMeme`/`mintSideUasset` 标签 + 右 `Balance: {formatAmount}`（`pol.myMemecoin`/`pol.myUAsset` fixture 样本，`data-numeric`）+ **Max 可点**（点击填入该侧全部余额并按池内配比推导另一侧，2026-09-24 用户裁定：造余额样本使 Max 可用；样本取值保证 meme×price ≤ myUAsset 不越界）；≈$ 换算行在输入下方（同 SwapPanel）；输出卡 Balance=`pol.myPol` fixture 真值 |
| CTA | 未连接=Connect Wallet 可点（`useMockWallet` 全站共享开关）；已连接=Mint 禁用（原型不伪造链上成交，无任何提示文案）；关闭=头部 ✕ / Esc / 遮罩外点（base-ui Dialog 内置） |
| 触发器 data-slot | `DialogTrigger render={<Button/>>` 的 props 合并会把 Button 的 `data-slot="button"` 覆写为 `dialog-trigger`，而主题桥皮肤（标签区「青色控制台」40px/青 tinted 描边等）按 `[data-slot='button']` 匹配——触发器必须显式传 `data-slot="button"` 钉回，否则与同排按钮皮肤不一致（2026-09-24 踩坑） |
| 文案 | `getCopy(locale).verseDesk`：mintDialogTitle/mintSupply/mintSideMeme/mintSideUasset/mintYouReceive/mintSettingsTitle/mintSlippageTip/mintDeadlineTip + 复用 balance/max/swapRate/minReceived/maxSlippage/slippageTolerance/transactionDeadline/swapCta；`common.close` 供 ✕ aria-label |


## 18. VaultActions（Yield Vault 操作卡 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | Verse 详情 Yield Vault 标签操作卡（`components/verse/vault-actions.tsx`；2026-09-24 用户裁定按 demo.outrun.build/memeverse 布局重设计：Tabs → Amount 卡 → Details 卡 → 全宽 CTA → 脚注；**2026-09-27 用户裁定改双列 `.vault-actions`**——原三标签单卡通栏把 swap 窄卡原语拉到 ~1100px 内容稀疏，改左列 Stake 常驻卡（`__bar-label` 静态卡头）+ 右列 Redeem/Withdraw 标签切换卡，列比/断点随 POL 先例 1.15:0.85、<1024px 退单列、双卡自然高；两列金额状态独立（`stakeAmount`/`redeemAmount` 不串值）；样式 `.vault-card*` + 复用 `.swap-panel__field/__details/__cta` 原语） |
| 机制口径 | vault 全部操作（stake/redeem/withdraw）走治理链（OutrunBook omnichain.md §The governance chain）；跨链质押=Memecoin 经 LayerZero 跨到治理链入库存份额（omnichain.md §Cross-chain staking）；赎回两步异步、REDEEM_DELAY=1 days（`MemecoinYieldVault.sol:22`）；跨链费=LayerZero 发送时报价、按源链原生币精确支付（omnichain.md §Cross-chain reliability），无 fixture 字段 → 明细行槽位 `--` + ⊙ 气泡 `crossFeeNote` |
| 链感知 | 连接网络 = header GS-2 链选择器**唯一入口**（2026-09-24 用户裁定：卡内网络芯片删除）——选择器读写 mock 钱包 `chainId`（`useMockWallet`，默认 chains[0]=Ethereum Sepolia 11155111；仍写 URL `?chain=` 供 discovery 过滤）。vault 判定「在治理链」用治理链主网 id→测试网对应链映射（1→11155111/8453→84532/56→97，模拟粘合层非领域数值）：连接且不同 → Stake 进跨链模式（青 tinted 横幅 + Cross-chain fee 行 + CTA `stakeCrossCta` 跨链存入，禁用）、Redeem/Withdraw 的 CTA 变 `switchChainCta`「Switch to {治理链}」**可点**=mock switchChain 切到治理链对应测试网（非链上写，header 触发器同源联动）；切回后恢复正常 CTA（禁用） |
| 兑换率方向 | Stake 行 `1 {symbol} ≈ (1/assetsPerShare) {s-symbol}`、Redeem 行 `1 {s-symbol} ≈ assetsPerShare {symbol}`（demo 同向；到账=amount÷/× assetsPerShare） |
| 余额/Max | Redeem Balance=`staking.myShares` fixture 真值 + Max 可点填入；Stake Balance=`pol-positions.myMemecoin` 样本（样本账户本 verse memecoin 余额，2026-09-26 复用 POL Mint 供给侧样本）+ Max 可点填入，无 pol 记录→槽位 `--`+禁用 |
| 状态列表 | 2026-09-26 用户裁定参照 demo 两图：赎回状态列表收进操作卡标签内（原 `.vault-panel__lists` 卡外双列删除，卡外恒显=设计不对）。Redeem 标签尾=Pending Redemptions（`pendingRedeems` 仅等待中逐笔：金额 mono + `redeemedOn{date}`（`formatDay` 纯日期，Dec 25, 2024 形态、UTC+8 口径）+ 走秒倒计时 `remaining{t}`（`RedeemCountdown`：repository `remainingMs` 快照剩余起按墙钟每秒递减、到 0 停表——纯展示 tick 非链上写；黄纯文本 `data-state=waiting` 无框））；Withdraw 标签头=Ready to Withdraw（仅已成熟逐笔：金额 + `readySince{date}`（=maturesAt 成熟日）+ `✓ ready` success 描边徽章 `data-state=ready`），后接 Total available 行→CTA→note；任一为空→该区 `--`；样式 `.vault-card__list/__list-main`（hover 青 2px 选择线） |
| 委托（Q9） | Stake 明细行内 `Myself/Custom address` 选项（`.vault-actions__delegate-option[data-selected]`，青选中态），默认自己；选 Custom address → 明细卡与 CTA 之间出现地址输入卡（`.swap-panel__field` 原语，`data-numeric` 等宽，maxLength 42、输入去空白），非空且不匹配 `^0x[0-9a-fA-F]{40}$`（EVM 口径=治理链族 Ethereum/Base/BNB，大小写均收不校验 EIP-55）→ FieldError `delegateAddressError` + `aria-invalid`/`aria-describedby`，空值不报错；切回 Myself 收起输入卡、已输入值保留；CTA 维持禁用（原型纪律）；`Delegate to` 标签旁 ⊙ `.create-info` 气泡=delegateNote（2026-09-26 用户裁定：原正常态/跨链双态脚注删——委托说明收进气泡，卡底脚注仅跨链态留 crossNote，正常态无脚注，核验份额口径 omnichain.md:51） |
| CTA | 未连接=Connect Wallet 可点（全站共享开关）；已连接且治理链=操作 CTA 禁用 + title `onChainSlot`（原型不伪造链上写）；一屏一个主 CTA——2026-09-27 双列裁定后：左列 Stake 走黄 `.swap-panel__cta` 通道（唯一主行动），右列 Redeem/Withdraw 的操作/未连接/切链 CTA 一律 outline 青档（同 POL 标签操作钮先例） |
| 文案 | `getCopy(locale).verseDesk`：crossBannerTitle/crossBannerSub/crossBannerBody/stakeCrossCta/switchChainCta/crossFee/crossFeeNote + 复用 amount/balance/max/exchangeRate/youReceive/youReceiveAfter24h/stakeCta/redeemCta/withdrawAll/delegate*（delegateNote=气泡）/crossNote/onChainSlot + 状态列表 pendingRedeems/readyToWithdraw/readySince/redeemedOn/remaining/ready（withdrawNote 脚注 2026-09-26 用户裁定删——CTA 与 Total 行已表意，冗余；redeemNote 脚注 2026-09-27 用户裁定删——UI 自明：到账行 (after 24h)+Pending 列表倒计时+Withdraw 标签已表意两步流，期间无收益无投票权不再复述） |


## 19. PT/YT 双生井（`.pol-twin` · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | Tokenization 标签 PT/YT 衍生卡（`verse-tab-panels.tsx` PolPanel 内）。沿革：换向器 `.pol-flow`（2026-09-25）与可领创世 YT 条 `.pol-claim` 于 2026-09-27 用户裁定删除；同日第二轮裁定 Balance 无用、重构为双生井；v3（2026-09-28 用户裁定「井纯读对称」）：井底无钮、机制等式升为井组头 `.pol-twin__equation`（`1 POL-<SYM> = 1 PT + 1 YT` mono 三级色+⊙ splitNote——一眼解释两井 USD 等值与三操作存在，与左 seam 分缝成「左符号右公式」）、操作统一井组下通栏；claim 机制 UI 入口随裁定撤销 |
| 井读数 | **账目行 label=名义价值（nominalValue 键）+⊙ ptNominalTip/ytNominalTip**（2026-09-28 用户裁定：须明示井显示的是名义价值而非市场价格——PT 的市场价在 PT/uAsset、PT/POL 池，YT 的市场价=闪电兑换隐含价）；值=纯数字（单位基准由井身份承载——值内不再带 `1 PT ≈` 前缀，一行一个语义中心；2026-09-28 二轮裁定）：PT 井 `{uAssetPerPol} {raiseAsset}` 固定兑付率（创世锁仓一次性登记——`MemeverseLiquidityImpl.sol:239`，locked/unlocked 皆已确定，非 1:1——2026-09-25 对账裁定；符号 v3 统一 `≈`——固定锚定语义由 ⊙ 承载，`=`/`≈` 微差读作笔误 2026-09-28 废弃）；YT 井 `1 YT ≈`（名义价值，**双腿形态**——2026-09-28 用户裁定，pol-splitter.md「YT 结算兑付=uAsset+Memecoin 两币」）：memecoin 主腿两阶段皆有（locked=推导：1 PT+1 YT=1 POL=M meme+U uAsset、PT 固定吃掉 uAsset 侧 → 残差名义=meme 侧=uAssetPerPol÷主池价；unlocked=结算样本 `{ytRedeemMemecoinPerUnit}`）+ uAsset 次腿同档同色（2026-09-28 用户裁定：双腿对等兑付口径，原次级色降一档废弃；两阶段皆 `+ {ytRedeemUAssetPerUnit}` 样本：unlocked=结算派生真值、locked=结算预估样本——2026-09-28 用户裁定造数看原型效果，gen-pol-yt-uasset-leg.mjs 锚 unlocked 量级 ≈uAssetPerPol 3–5%）；腿/价缺失='--'；美元回声行 `≈ ${腿×uAssetUsd}`（uAsset 计价；unlocked YT=(meme腿×price+uAsset腿)×uAssetUsd；缺样本=ax-slot 槽位），hairline 上缘**左锚标签列起点**（v3：右挂孤行+死区废弃） |
| 钮位 | **无井底钮**（v3 2026-09-28：井=纯读对称，PT 井不再是无出口死终点）；操作统一井组下通栏 `pol-card__btns`：locked=[Flash Swap §26 | Split §20 | Merge §20] 三等宽、unlocked=[Redeem PT §21 | Redeem YT §21] 两等宽——跨阶段操作位置统一；余额展示在弹窗 Balance/Max；卡内中档 32px |
| 样式 | 抬升面仪器盒：surface-raised+hairline+对角双切 `--chamfer`，与分缝/章同语言；**满宽纵叠**（2026-09-27 当日第三轮裁定：并排井仅 ~174px 宽致多腿折行、钉底对齐又在矮井拉出死白），账目行=`__quote`（label 左/腿右同行，腿 16px mono），两井内容同构自然等高，无需媒体查询；**顶缘身份刻线**（v3）：`__well[data-token='pt']` 青 55% mix / `yt` 品红 55% mix（1px 回声管制内），开角双切自然截去顶线左端起段成内缩刻线 |
| 文案 | 「1 PT ≈」「1 YT ≈」为结构化 token 记法非 copy；ptTip/ytTip ⊙ 气泡不变；ptBalance/ytBalance/claimableYt/claimYt/claimYtEligibility 随裁定删除 |


## 20. PolSplitMergeDialog（Split/Merge 操作弹窗 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | PT/YT 井组下通栏操作行 locked 态钮 2/3 触发的操作弹窗（`components/verse/pol-split-merge-dialog.tsx`，`mode='split'/'merge'` 单组件两态；2026-09-26 用户裁定：两钮从恒禁用改弹窗做实际操作；2026-09-28 v3 从通栏第二/三枚随操作区统一迁移；壳/原语复用 `.pol-mint` + `.swap-panel__field/__details/__cta`，无新 class） |
| 机制口径 | Split=1 POL → 1 PT + 1 YT（`IPOLSplitter.sol:102`）、Merge=等额销毁 PT 与 YT 换回同额 POL（`:104`，同一 amount 两侧 burn）——严格 1:1，合约无滑点/无 deadline 参数 → **不设设置齿轮**（与 Mint 弹窗的结构差异=机制差异）；闸门仅 locked（unlocked 态由 §21 Redeem 钮接替，2026-09-27） |
| 联动/Max | split：单输入 POL、Max=全部 `myPol`；merge：PT/YT 双输入恒等额联动（单状态驱动两框），两框各挂 Max、同填 `min(myPt, myYt)`（Max 语义=最大可合并对数——单侧全额会破另一侧约束；2026-09-26 用户问「为何只有 YT 有 Max」后改双挂） |
| 估值 | 无换算行（2026-09-26 用户裁定删 split 输入 ≈$；PT/YT 本就无独立价样本） |
| 明细 | Rate 行与输出区删（2026-09-26 用户裁定第二轮：1:1 恒等，结果=输入的复述，冗余）——弹窗=输入+CTA |
| CTA | 同 Mint 弹窗：未连接=Connect Wallet 可点切换模拟连接（`useMockWallet`）；已连接=Split/Merge 禁用（原型不伪造链上成交，无提示文案） |
| 触发器 data-slot | 同 §17 踩坑：`DialogTrigger` 显式 `data-slot="button"` 钉回，否则主题桥皮肤不匹配 |
| 文案 | `splitDialogTitle`/`mergeDialogTitle`（2026-09-26 新增）+ 复用 splitPol/mergePol/balance/max/swapCta/`common.close` |


## 21. PolRedeemPtYtDialog（Redeem PT/YT 操作弹窗 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | PT/YT 井组下通栏操作行 unlocked 态两钮触发的操作弹窗（2026-09-28 v3 从井底迁通栏；`components/verse/pol-redeem-pt-yt-dialog.tsx`，`mode='pt'/'yt'` 单组件两态；2026-09-27 用户裁定：unlocked 删 split/merge UI、补燃烧/赎回 PT/YT 功能；壳/原语复用 `.pol-mint` + `.swap-panel__field/__details/__cta`，无新 class） |
| 机制口径 | Redeem PT=`POLSplitterUpgradeable.sol:365` 销毁 PT 按创世锁仓一次性登记的固定比率兑回 uAsset（`_ptToUAsset:470`，比率=`mainPoolUAssetUsed/mainPoolPOLRawAmount`——`MemeverseLiquidityImpl.sol:239`，即 fixture `uAssetPerPol` 口径，非 1:1——2026-09-25 对账裁定）；Redeem YT=`:387` 销毁 YT 按份额领结算剩余池两币（uAsset+memecoin，每份率=池×份额/流通 YT，`:404-405`）。闸门仅 unlocked（unlock 自动 settle——`MemeverseSettlementImpl.sol:536-537`；locked 态不渲染赎回行）；合约无滑点/deadline → 不设设置齿轮 |
| 联动/Max | 单输入（PT 框余额=`myPt`、YT 框=`myYt`），Max=各自全额；props `price`/`uAssetUsd`（美元行换算源，同卡片井读数）；打开即预填全部余额（2026-09-27 用户裁定：空输入 You receive 摆 0.00 观感差——打开就用样本余额示全额兑付预估，清空/改数照常重算） |
| 明细 | 2026-09-27 第三轮参照图裁定改双框：输入框（label=burnLabel）+ Receive 独立框（同输入框款式、只读 `output`+代币章；PT=单框 uAsset 章、YT=双腿合一个框（memecoin 主腿在前与井读数同序、行间 hairline=`.swap-panel__field-row ~ .swap-panel__field-row` 仅多 row 时生效——单 Receive 标签管两腿，2026-09-27 第四轮裁定：双框版第二框空标签行观感残缺）；rate 缺样本=框内 ax-slot）+ 每框下 ≈$ 美元行（2026-09-27 用户裁定补：uAsset 腿×uAssetUsd、memecoin 腿×主池价×uAssetUsd，样本缺→不渲染）——You receive 明细行随之删除（信息不重复；非 1:1 恒等、与 §20 删输出区裁定不冲突）：PT=`amount × uAssetPerPol {raiseAsset}`；YT=`amount × ytRedeemUAssetPerUnit {raiseAsset} + amount × ytRedeemMemecoinPerUnit {symbol}`（fixture `ytRedeem*PerUnit` 可选样本——仅 unlocked polp 记录携带；双缺=整行 ax-slot 槽位）；note 行 2026-09-27 用户裁定两轮全删（先 PT 后 YT——等式/You receive 已示比率与产出，冗余；「以链上读值为准」标注由 ax-slot 槽位承载） |
| CTA | 同 §20：未连接=Connect Wallet 可点切换模拟连接；已连接=Redeem PT/Redeem YT 禁用（原型不伪造链上成交） |
| 触发器 data-slot | 同 §17 踩坑：`DialogTrigger` 显式 `data-slot="button"` 钉回 |
| 文案 | `redeemPt`/`redeemYt`（钮与弹窗标题同文案）+ `burnLabel`/`receiveLabel`（2026-09-27 双框化新增）+ 复用 balance/max/swapCta/`common.close`；屏幕术语按 OutrunBook「redemption/赎回」（pol-splitter.md §Redemption only after settlement），不写 Burn |


## 22. PoolAddLiquidityDialog（Add Liquidity 弹窗 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | Liquidity 标签池卡 Add Liquidity 钮触发的双币供给弹窗（`components/verse/pool-add-liquidity-dialog.tsx`；2026-09-27 用户裁定：钮文案 `Add liquidity`→`Add Liquidity` 且恒禁用改弹窗，同日再裁定池卡钮短文案 `Add`（`addLiquidityShort`，弹窗标题/CTA 仍全称），功能结构同 §17 Mint 弹窗；壳/原语复用 `.pol-mint` + `.swap-panel__field/__details/__cta`，无新 class；触发器行样式与卡内 32px 中档走 `.pool-card__actions` 组（2026-09-27 双钮裁定，见 §24）） |
| 机制口径 | 四池统一=router addLiquidity：双侧按池配比供给、铸 **LP 代币**给 to（`IMemeverseSwapRouter.sol`，双侧 desired/min+deadline）。**2026-09-27 用户裁定：Add Liquidity 收 LP 而非 POL**——主池按加池量 1:1 铸 POL 的 mintPOLToken 入口（`IMemeverseLiquidityImpl.sol:26-31`）归 Tokenization 标签 Mint 弹窗（§17），两入口机制分立 |
| 输出推导 | LP 铸得 = quote 侧 × `pool.lpPerQuote`（markets fixture 铸得率样本，totalSupply/R_quote v2 式口径、费累积使比率<1；`gen-market-lp-rate.mjs` 幂等生成，80 行全覆盖）；Min received = LP × (1−滑点)；缺样本池获得侧/Min received 才走 ax-slot/'--' 槽位（2026-09-27 用户裁定：造样本出数不留空槽）；获得侧无 Balance 行（无 LP 余额 fixture）。**LP 名 = `{baseSymbol}/{quoteSymbol} LP`**（池卡交易对同口径 + LP 后缀，四池各得专名；v4 仓位制无 ERC20 LP 命名真源，展示层命名——2026-09-27 用户裁定不统称 "LP"） |
| 双侧联动 | 池配比 1 base=ratio quote：主池=`tokenStats.price`、POL/uAsset=fixture `marketPricePerPol` 样本；PT 两池=**锚定汇率推导样本**（2026-09-27 用户裁定造样本出数，不再不联动/'--'）：PT/uAsset 池 1 PT=`uAssetPerPol` uAsset（`MemeverseLiquidityImpl.sol:239` 固定兑付）、PT/POL 池再按 POL/uAsset 市场价折算 1 PT=`uAssetPerPol÷marketPricePerPol` POL；pol 记录缺失 → 退不联动/'--'；Rate flip 同 §17 |
| 余额/Max | 供给侧余额按池取 pol-positions 样本：主池=myMemecoin/myUAsset、POL/uAsset=myPol/myUAsset、PT/uAsset=myPt/myUAsset、PT/POL=myPt/myPol；pol 记录缺失（LiquidityPanel 接 `pol` 可空）→ 余额 '--'+Max 禁用；Max 点击填入该侧全额并按配比推导另一侧 |
| 估值 | ≈$ 换算行仅可推导侧显示：base 侧主池（×price）、POL 池（×marketPricePerPol）、PT 侧=锚定汇率（×uAssetPerPol）；quote 侧 uAsset 计价=1、PT/POL 池 quote=POL（×marketPricePerPol）；uAssetUsd 样本缺失全隐 |
| 设置层 | 同 §17：头部齿轮 Popover 滑点+deadline（复用 `.swap-settings` 与 swap-panel 预设常量；tip 为加池语境 `addLiquiditySlippageTip`/`addLiquidityDeadlineTip`）；自定义滑点校验同 §25 口径（2026-10-03 迁移，error id 走 useId——每张池卡一实例防 id 相撞） |
| CTA | 同 §17：未连接=Connect Wallet 可点切换模拟连接；已连接=Add Liquidity 禁用（原型不伪造链上成交，无提示文案） |
| 触发器 data-slot | 同 §17 踩坑：`DialogTrigger` 显式 `data-slot="button"` 钉回 |
| 文案 | `addLiquidityShort`（池卡钮短文案 `Add`，2026-09-27 裁定）+ `addLiquidity`（CTA 全称）/`addLiquidityDialogTitle`/`addLiquiditySettingsTitle`/`addLiquiditySlippageTip`/`addLiquidityDeadlineTip`（2026-09-27 新增）+ 复用 mintSupply/mintYouReceive/balance/max/swapRate/swapRateFlip/minReceived/maxSlippage/slippageTolerance/transactionDeadline/swapCta/onChainSlot/`common.close` |


## 23. PolRedeemLpDialog（Redeem POL 弹窗 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | Tokenization 标签 POL 资产卡 Redeem 钮触发的赎回弹窗（`components/verse/pol-redeem-lp-dialog.tsx`；2026-09-27 用户裁定：恒禁用改弹窗，POL 赎回成主池 LP 代币；壳/原语复用 `.pol-mint` + `.swap-panel__field/__details/__cta`，无新 class） |
| 机制口径 | 销毁 POL 按主池构造 **1:1** 换回主池（memecoin/uAsset）LP 代币（`MemeverseLiquidityImpl.sol:861/888` `amountInLP=amountInPOL`——:841 注释；`IMemeverseLiquidityImpl.sol:64`）。unwrap=false LP 直转非价格敏感（`:850-852`）→ 合约无滑点/deadline，**不设设置齿轮**（unwrap=true 拆 memecoin+uAsset 两币的 6 参滑点入口不进原型）。闸门仅 unlocked（`:857/884` NotUnlockedStage；OutrunBook lifecycle.md:18/97 From Unlocked；fixture 域 pol 持仓仅 locked/unlocked，渲染域与旧 `!locked` 等价） |
| 联动/Max | 单输入（余额=`myPol`），Max=全额；打开即预填全部余额（同 §21 2026-09-27 裁定） |
| 明细 | You receive 一行=`amount {MEME}/{uAsset} LP`（主池对口径 lpSymbol，同 §22/§24 惯例——链上 ERC20 全池静态同名 symbol `MLP`/name `Memeverse LP`（`SwapFacet.sol:313`），按池区分靠对口径；1:1 恒等但 POL→LP 代币身份不同、非 §20 输入复述 → 保留；机制恒等无槽位态、无 Rate/note/≈$ 行——§21 同款删冗余口径） |
| CTA | 同 §21：未连接=Connect Wallet 可点切换模拟连接；已连接=Redeem 禁用（原型不伪造链上成交） |
| 触发器 data-slot | 同 §17 踩坑：`DialogTrigger` 显式 `data-slot="button"` 钉回 |
| 文案 | `redeemPol`（钮/CTA 同文案）/`redeemPolDialogTitle`（2026-09-27 新增）+ 复用 youReceive/balance/max/swapCta/`common.close`；术语按 OutrunBook「redemption/赎回」（lifecycle.md:97 Burn POL to redeem） |


## 24. PoolRemoveLiquidityDialog（Remove Liquidity 弹窗 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | Liquidity 标签池卡 Remove 钮触发的移除流动性弹窗（`components/verse/pool-remove-liquidity-dialog.tsx`；2026-09-27 用户裁定：池卡新增 Remove 钮移除流动性、Add 同步短文案，双钮收进 `.pool-card__actions` 行尾组（flex+space-2+auto-margin，原 `.pool-card > button` 单钮规则退役）；壳/原语复用 `.pol-mint` + `.swap-panel__field/__details/__cta`，无新 class；触发器同走卡内 32px 中档） |
| 机制口径 | 四池统一=router removeLiquidity：burn **LP 代币**（uint128 liquidity）按池配比双侧取回，amount0Min/amount1Min+deadline（`IMemeverseSwapRouter.sol:292-300`，:308 "LP liquidity to burn"）——双侧 min 即滑点保护，保留设置齿轮（tip 为移除语境 `removeLiquiditySlippageTip`/`removeLiquidityDeadlineTip`）；自定义滑点校验同 §25 口径（2026-10-03 迁移，error id 走 useId，越界 minQuote/minBase 双值与最大滑点行同退 '--'）；deadline 整分钟校验同 §17 拍板 A |
| 输出推导 | §22 铸得反向：quote 取回 = burnLP ÷ `pool.lpPerQuote`、base 取回 = quote ÷ ratio（PT 两池 ratio=锚定推导样本，同 §22；pol 记录缺失才退 ax-slot）；Min received 一行双值 `minBase {base} + minQuote {quote}`（对应合约双侧 min，各自仅可推导侧显示）；输出区排版=§21 单框单标签模式：base/quote 两腿合一个 `swap-panel__field`、单 mintYouReceive 标签管两腿（2026-10-03 对齐 2026-09-27 §21 参照图裁定——原双框双标签系复用 mint 壳漂移，行间 hairline 由 `.swap-panel__field-row ~ .swap-panel__field-row` 提供） |
| 输入侧 | 单输入=burn LP 数量（Balance/Max；余额=pol-positions `myLp` 四池样本——`gen-pol-my-lp.mjs` 幂等生成，量级锚=各侧持仓×供给比例×lpPerQuote）；pol 记录缺失 → '--'+Max 禁用；不预填（推导链复杂，同 §22；§21/§23 的打开预填仅恒等单输入） |
| Rate | 同 §22 池对汇率：1 base ≈ ratio quote（flip 反向）——赎回两币的池内配比（2026-09-27 用户裁定：不显示 LP↔quote 铸得率换算；同日裁定 PT 池配比出数不再 '--'） |
| 估值 | ≈$ 同 §22 口径：base 侧主池/POL 池市场价样本、PT 侧=锚定汇率 uAssetPerPol；quote 侧 uAsset=1、PT/POL 池 quote=POL（×marketPricePerPol）；uAssetUsd 缺失全隐 |
| CTA | 同 §22：未连接=Connect Wallet 可点切换模拟连接；已连接=Remove 禁用（原型不伪造链上成交） |
| 触发器 data-slot | 同 §17 踩坑：`DialogTrigger` 显式 `data-slot="button"` 钉回 |
| 文案 | `removeLiquidity`（钮/CTA 同文案）/`removeLiquidityDialogTitle`/`removeLiquiditySettingsTitle`/`removeLiquiditySlippageTip`/`removeLiquidityDeadlineTip`/`removeBurn`（输入侧标签，合约 burn 语义；2026-09-27 新增）+ 复用 mintYouReceive/balance/max/swapRate/swapRateFlip/minReceived/maxSlippage/slippageTolerance/transactionDeadline/swapCta/onChainSlot/`common.close` |

## 25. SwapPanel 代币选择（Swap 卡双侧可选 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | Swap 卡输入/输出侧代币芯片（`.swap-panel__token--select` 幽灵描边钮：符号+下箭头，hover/focus 转青）点开选择弹窗（`components/verse/swap-token-select-dialog.tsx`；2026-09-27 用户裁定双侧可选）。弹窗结构=标题+✕+搜索+行列表（AssetSelector §2 变体），壳复用 `.pol-mint`；**受限集合不设「常用/全部」分组**、搜索按符号/名称过滤 |
| 可选集 | 用户裁定 2026-09-27：稳定侧=募集 uAsset + 其 PSM 配对储备（psm.json 按 uAssetId 过滤，`getFixtureParticipationOptions().reserves` 出口）；Meme 侧=memecoin/POL/PT（**YT 不入卡**——2026-09-27 方案 B 用户裁定：Flash Swap 是 POL↔YT 单通道工具且买卖均指定 YT 数量，卡的 exact-in 双侧配对模型无法表达，移入 §26 YT 井专属弹窗；同轮删除真源不支持的 uAsset↔YT 复合路由）。翻转钮只换方向（集合跟侧走：当前输入侧在稳定侧则弹稳定集）。**行名=代币本名**（2026-09-27 用户裁定：机制标签不得当名字显示——储备行=assets.json `name` canonical 名如 Ethereum/USD Coin（缺失回退 symbol），uAsset 行=mintSideUasset，memecoin=verse.name，POL/PT=polTag/ptFullName） |
| 报价口径 | 原型参考价线性换算：每代币 uAsset 计价——uAsset=1、储备=PSM 面值 1:1 平价（OutStake）、memecoin=主池价、POL=`marketPricePerPol`、PT=`marketPricePerPol×ptPricePerPol`（PT/POL 池样本，`gen-pol-pt-price.mjs` 锚 yt-flash-swap.md 示例 PT≈0.9 POL）；率=卖出价÷买入价，任一侧缺样本→'--' 槽位 |
| 余额/估值 | 行余额=uAsset/储备(myReserve 样本——2026-09-28 用户裁定造数，gen-pol-my-reserve.mjs 锚 myUAsset 20–60%，null 槽位)/myMemecoin/myPol/myPt；≈$ 换算两侧各按其 uAsset 计价×uAssetUsd（储备借平价等值）；Max 只挂卖出侧（余额 null 禁用）；**打开即预填默认卖出侧（uAsset）全部余额**（空输入 0.00/'--' 观感差——2026-09-28 用户裁定，§21/Flash Swap 同规；翻转/换币保留输入） |
| 路径行 | 随所选对组词：储备腿前缀 `PSM`；meme=主池、POL=POL/uAsset 池、PT=PT/uAsset 池；` → ` 连接（原静态 `routeValue` 键删除） |
| 设置层（滑点校验） | 头部齿轮 Popover 滑点预设 0.1/0.5/1% + 自定义；自定义校验域 **0.01–50%**（`components/global/slippage-input.ts` `getSlippageIssue`，行业惯例；2026-10-03 评审修——0 零容忍必回退、>100 时 (1−s/100) 推导出负数代币，原仅 ≥0 静默放行）：低于下界 → FieldError `slippageTooLow`、高于上界 → `slippageTooHigh`（`role=alert` + 输入 `aria-invalid`/`aria-describedby`，vault-actions 委托地址同款模式），越界期间 Min. received 与最大滑点行退 '--' 槽位、不静默夹紧改写输入；§17/§22/§24/§26 弹窗同构设置层 2026-10-03 同轮迁移本口径（共用 `getSlippageIssue`/`slippageErrorCopyKey`，error id 走 useId——池弹窗每卡一实例防 id 相撞；deadline 自定义输入 2026-10-03 拍板 A 迁移整分钟口径：留点清洗 sanitizeAmount + 非整分钟（如 1.5）FieldError `deadlineWholeMinutes`（校验=本文件导出 `isWholeMinutes`，空/0 仍回退 1 分钟——既有行为保留，不再剥点把 1.5 静默变 15）） |
| 键盘 | ↑↓ 行间循环移动焦点（ul 容器 onKeyDown；搜索框内箭头属文本光标不劫持）、Enter/Space=行钮原生选中、Esc=Dialog 原生关闭、焦点还原触发器；行 `role=option`+aria-selected、列表 `role=listbox` |
| 布局坑 | 行钮必须 `inline-size:100%`：button 默认收缩为内容宽会让三列 grid 的 1fr 中列失效、余额贴符号排（visual-judge 2026-09-27 抓出） |
| 文案 | `selectTokenTitle`/`tokenSearchPlaceholder`/`tokenNoResults`/`routePoolMain/routePoolPol/routePoolPt/routeLegPsm` + 行名称复用 mintSideUasset/mintSideMeme/polTag/ptFullName（储备行名走 fixture 不走 copy）；搜索行=input 全局桥皮肤+左图标覆盖式（`.token-select__search [data-slot='input']`，勿加外框——桥带 !important 会双框打架，2026-09-27）；Rate 行 ⊙=`.swap-panel__details dt .create-info` 定 12px 档+space-1 间隙+vertical-align −2px（默认 14px 零间距贴字且 baseline 下沉，2026-09-28 修） |

## 26. PolFlashSwapDialog（Flash Swap 弹窗 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | Tokenization 标签 PT/YT 井组下通栏操作行 locked 态首钮触发（`components/verse/pol-flash-swap-dialog.tsx`；2026-09-27 方案 B 用户裁定：YT 交易从 Swap 卡移出进专属弹窗——POL↔YT 单通道 yt-flash-swap.md；2026-09-28 v3 从 YT 井底迁井组下通栏第一枚）。壳/原语复用 `.pol-mint` + `.swap-panel__field/__output/__details/__settings-toggle/__cta/__rate-flip` + `.vault-actions__bar`（模式条 tab 风；弹窗语境加 scoped 规则 `.pol-mint .vault-actions__bar`=两段等宽铺满——ToggleGroup 根收缩为内容宽，grid 拉伸不生效需 inline-size:100% 兜底），无新命名 class（panel-note 杠杆行 2026-09-28 删除）|
| 机制口径 | yt-flash-swap.md：复用 PT/POL 池流动性、单笔原子；**买卖均「指定 YT 数量」**（买=到手 y、支付 y−R 上限 Max paid；卖=收到 y−Q 下限 Min received）；费率=PT/POL 池动态费单次（杠杆成本结构：费按 PT 全腿计、本金只付差额）——Fee 行=**用户手续费率样本直读**（`pol.flashUserFeeRate`，相对用户支付额，谱系 0.3%–85% 覆盖 <1% 到极高——`gen-pol-flash-fee.mjs` 平方根分布；2026-09-28 用户裁定：费率=用户付的手续费、假数据不做推导链（首版从池费率×PT 价推导费额+有效百分比已废）；口径：池动态费（FEE_BASE_BPS=100 下限，DynamicFeeMath.sol:41）按 PT 全腿名义收取、用户只付差额（MemeverseYTFlashSwapRouter._executeBuy）→ 支付额基数上杠杆化，可 <1% 也可极高，费率吃掉成本或超上限时 InvalidBuyCost/MaxPOLInExceeded 回滚无法成交；markets.feeRate（池费率样本 1%–8%）保留备用不进本行；完整机制说明挂 ⊙=flashFeeNote）。**对手侧展示=uAsset 而非 POL**（2026-09-28 用户裁定：理解成本更低——前端按 POL/uAsset 池价折算组合，链上仍以 POL 成交） |
| UI 同构 | 上块=YT 驱动输入（买卖共用不翻转——真源两向都指定 YT 数量），下块=uAsset 派生只读（余额行=myUAsset）；模式条 Buy/Sell 只改下块标签（You pay / You receive）与保护行方向（Max paid / Min received）；模式条=vault 操作卡同款 ToggleGroup |
| 报价口径 | 线性参考（uAsset 计价）：1 YT ≈ (1−`ptPricePerPol`)×`marketPricePerPol` uAsset（隐含价 1 POL=1 PT+1 YT，经 POL/uAsset 池折算）；支付/收到 uAsset=YT 数量×隐含价；保护值=参考值×(1±滑点)；≈$=uAsset 腿×uAssetUsd；Rate 行 ⊙ 注明折算路径与「市场侧参考价非结算价值」 |
| 设置 | 只留滑点行（预设+自定义同 Swap 齿轮）：合约无 deadline 参数；真源的可选限价+到期属高级项不做（同 Split/Merge 删齿轮口径的镜像裁定）；自定义滑点校验同 §25 口径（2026-10-03 迁移：error id 走 useId，越界 buy(Max paid)/sell(Min received) 保护值均退 '--'） |
| 预填 | 打开即预填全部 myYt（两模式同规——§21 先例；2026-09-28 用户裁定 Buy 也预填，空输入 0.00/-- 观感差）；模式切换保留输入 |
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
| 数据 | governance fixture `treasuryAssets/lastCycle.treasuryAssets/unclaimedAssets/claimableAssets`（S 级样本，`gen-verse-fixture-coverage.mjs` composeAssets 固定权重拆分，usdValue 之和锚各自总额 treasuryUAsset/remainingRewards/myClaimable；宇宙=ETH/USDC/USDT/DAI(+WBTC 国库)；null=无样本→芯片退普通 div 不渲染入口）；四弹窗底部 `__note` 白名单注脚（`registeredAssetsNote`，2026-09-30 源码对账用户裁定统一一条——Governor 持有的未注册代币不入账不显示） |
| CTA | 仅可领变体有底部通栏 `Claim Rewards`（`actionLabel` 槽 + `.swap-panel__cta` 皮肤）；**恒 disabled**——原型不伪造链上成交（同 §17/§26 口径），本仓 Button disabled 渲染与 enabled 一致，参照图的主钮观感保留；关闭=✕/Esc/遮罩外点 |
| 触发器 | `DialogTrigger nativeButton={false} render={<div className="cycle-card__hit"/>}`，children=原芯片 dt/dd——KPI 网格布局不变；芯片内嵌 disabled 按钮须加 `pointer-events-none`（原生 disabled 钮吞点击、触发器收不到——2026-09-30 踩坑；可领行的领取钮保留原位，点击穿透开明细弹窗，动作在弹窗 CTA） |
| 文案 | `getCopy(locale).verseDesk`：treasuryDetailsTitle/lastTreasuryDetailsTitle/unclaimedDetailsTitle/claimableDetailsTitle/totalValue/assetsLabel/registeredAssetsNote/claimRewards + `common.close` 供 ✕ aria-label |


## 附：组件间通用交互契约

- 弹层（AssetSelector/ChainSelector/交易中心）：Esc 关闭、焦点圈闭（focus trap）、关闭后焦点还原触发器。
- 所有异步动作：进行中可取消或明确不可取消；完成后 toast + 内联状态双通道。
- 复制：`navigator.clipboard` + 成功 toast「Copied」+ 失败回退选中文案。
- 地址/hash/symbol/长文本：截断规则统一（`0x1234…abcd`），悬停完整值（title）+复制按钮。

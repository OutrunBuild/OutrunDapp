# 领域组件契约（Stage-01 步骤 11 · 阶段 2/3 复用）

> ⚠️ 决议 005：本文所有**示例界面内容**（POL 字段、版面）仅为视觉演示，不代表产品 UI/UX；**可继承的是行为契约**（状态集/键盘/aria/文案规则/数字规则）。
> 约束：本契约只定义行为与状态，不接业务合约、不建 React 应用、不新增依赖。视觉全部引用 `components/design-system/tokens.css`（契约见 token-contract.md）。文案遵循决议 001-A（消费化语言，无极客符号；机制词按 §2 术语表）。
> 通用状态集（每个组件按适用子集实现）：default / hover / focus / active / disabled / loading / error / empty。
> 通用规则：数字字段一律 `[data-numeric]`（等宽+tabular-nums）；focus=青 2px 外环全站唯一；图标=lucide 体系命名；reduced-motion 见 motion-and-a11y.md。

## 1. AmountInput（金额输入）

| 方面 | 契约 |
|---|---|
| 用途 | 任意代币金额输入（Swap/铸造/PSM/储蓄/赎回/质押） |
| 结构 | 标签 + 输入框（data-numeric）+ 余额行（`Balance: 12.4 USDC` + `Max` 按钮）+ 法币参考值（可选） |
| 键盘 | 数字/小数点/退格；粘贴净化（去逗号空格）；↑↓ 步进 0.1；非法字符静默拒绝 |
| 状态 | default；focus（青环）；disabled（来源资产未选）；error（超出余额/低于最小精度/dust 域）——错误文案例「Amount exceeds your balance」+ 恢复链接 `Use max` |
| 校验边界 | dust 域（quote 返 0 不可执行，complexity-map PSM 行）→ 提示「Amount too small to convert」并禁用提交 |
| 大数边界 | 输入 `maxLength=40`（float64 有效数字 ~17 位已覆盖）；派生金额/法币值绝对值分层降级——≥1e15 Intl 紧凑记法（`39,226T`/`39,226万亿`；注意 compact 超大值不省略，会退化成全量数字+单位后缀）、≥1e21 科学记法（`4.3585E40`），全展开千分位长串与裸 `toFixed` 科学计数法禁止进卡面；CSS 兜底截断省略仅加于纯数值槽位 `__output`/`__field-usd`（详情行 dd 是文案不许截，靠格式化分层保界）。2026-09-23 demo 参照页 180 位数字溢出教训 |
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
| 用途 | Explore 页按阶段过滤（All / Genesis / Locked / Unlocked / Refund） |
| 实现 | `components/prototype/discovery-browser.tsx` → `nav.lifecycle-tabs > a[data-stage][data-active]`；样式 `app/globals.css .lifecycle-tabs*` |
| 结构 | 每项：`__mark` 色点 + `__copy`（`strong` 阶段名 + `small` 一句说明）+ `__count[data-numeric]` |
| 状态 | default / hover / focus / active（`data-active` + `aria-current="page"`，底部 `--stage-color` 2px 线）；阶段色由 `data-stage` 映射，禁传色 |
| 行为 | 状态即 URL（`?stage=`），`<a>` 而非按钮；可分享、可后退 |
| 响应式 | ≤68rem 压缩说明；≤54rem 横向滚动 |
| aria | `nav[aria-label]`；计数为文本，不靠色点传达 |

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
| SectionHeading | `signal-ui.tsx` 导出，`header.section-heading.ax-echo-bar`（`__row` = h2 + aside；description `<p>` 在行下、贴底边框；签名线锚定边框不随描述下沉，决议 014 几何化） | 每个 section 一个 h2，`aside` 放筛选/计数 |
| Verse 头部 | `.verse-hero`/`.verse-identity`（verse-page 内联） | （2026-09-22 用户裁定多轮定稿）symbol 大图形（约 198px）绝对定位左侧，文本列 padding 让位：①名称行=ticker 在前（数据等宽 `--text-num-lg`+主行动黄+大写字距+抖音式错版 text-shadow：青左上/品红右下 0.08em）+name 随后（`--text-lg` 无回声阴影，不抢戏）+徽章右推同行；②描述紧跟名称行（SPEC-M8 ≤255 字节→68ch 约四行）；③底行两端=链信息（左，label 样式：`--text-sm`+大写+0.08em 字距，与描述正文分层；组间 `--space-5`/组内 `--space-2`）+社交图标（右，同 flex 行天然同线）；社交=官方品牌图标（`brand-icons.tsx` simple-icons path：X/Discord/Telegram+lucide Globe），顺序 website→x→discord→telegram（repository SOCIAL_ORDER；fixture kind twitter 已改名 x）；「Economy overview」标签删除；hero 顶部无 padding（主容器 24px 唯一留白）；底部签名线随阶段双线规律（`data-stage` 驱动 `--stage-color` 主线 + `--stage-next` 回声，与 economy-card 上边缘同律，2026-09-26）；四项统计在右列 `.stats-panel` 新卡（Key metrics 2×2） |

## 14. ParticipationPanel（创世参与面板 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | Verse 详情页（`stage=genesis`）参与工作台：选择参与方式、输入金额、审阅后确认（原型不发交易） |
| 实现 | `components/prototype/participation-panel.tsx`；样式 `app/globals.css .participation-form/.participation-toggle/.participation-toggle--mode/.participation-fixed-asset/.participation-review*` |
| 结构 | 模式层三项 ToggleGroup `.participation-toggle--mode`（普通创世/杠杆创世/预购——预购与创世同级，用户裁定 2026-09-21；顶层 tab 风格：无框透明底、激活=黄字+底部黄线，底边线兼作分割线（`ax-echo-bar` 签名线锚定其下），与路径分段框区分——2026-09-22 用户裁定；无可见字段标签，`aria-label`=「参与方式」；section 可见标题/描述删除——与右侧「当前可以做什么」完全重复，纲要由 sr-only h2 维持）→（非预购）路径两项分段 ToggleGroup →（预购）Verse 级容量 ProgressMeter（已用/上限；见「预购面板」行）→ **支付资产+金额并排** `.participation-duo`（grid 两列等宽 1fr/1fr；用户裁定 2026-09-25：单字段各占一行太占空间，同日二次裁定两列等宽；小屏折单列；支付资产多选项=Select、唯一选项=固定值 `.participation-fixed-asset`；**预购模式支付资产同为下拉**——uAsset 直付+储备面值直兑，help 文案 uassetHelp/directHelp 随选切换；**stake=三格同行** `.participation-trio`（来源/参与资产/金额 grid 1fr 1fr 2fr，用户裁定 2026-09-25））→（非预购）一键预购开关+预购 **duo**（Pay with 下拉与主选择独立+预购金额 Input 并排 `.participation-duo`——用户裁定 2026-09-25）→ 审阅卡 |
| 状态 | 杠杆模式：披露 `form-warning`「损失上限=所付利息 · 无清算 · 创世失败利息全额退」；fixture 缺利率/上限快照=null→显「以链上读值为准」槽位+提交禁用（2026-09-22 起快照齐备即全交互）；金额/预购金额为空提交 → `data-invalid` + FieldError；审阅态 `aria-live="polite"` |
| 杠杆面板 | 利息金额输入（标签切「利息金额」）；路径三项=用 uAsset 直付/面值直兑（PSM 储备转利息，无 CDP 仓位）/创世积分直付（`leveragedGenesisWithCredit` 锁定时销毁；杠杆无质押项）；实时预览=借贷资金数值（口径=利息÷利率，一次性比例非年化，**UI 只显 label+数值不显公式**——用户裁定 2026-09-25，`leverageDebtPreview` key 已删并入 `leverageDebtQuota`；`data-numeric`；**UI 词「借贷资金/Borrowed funds」=用户裁定 2026-09-25**——OB 原词 debt quota 暗示未使用配额，实为参与即发生的已用借贷资金；机制口径/代码标识符仍 debt quota）；债务上限余量（Debt cap headroom；2026-09-25 用户最终裁定沿用原词）=债务上限−已建债务（已收利息÷利率），超限→FieldError「超出债务上限——剩余可建额度 {quota}」+提交拦截（对照 stockCap 模式）；一键预购上限按借贷资金推导（容量=(普通资金+杠杆债务本金)×70%×容量比例）；审阅屏**分组化**（用户裁定 2026-09-25，可读性；同日二次裁定：组序=进创世在前、你支付在后，两组标题颜色区分）：概要两行（参与方式/Pay with）→「进入创世 ENTERS GENESIS」组（**标题与数值均青** `--accent-link`）=折算/借贷后 uAsset 行（普通=创世金额、杠杆=借贷资金；预购资金主池开放后才买入→preorder-only 无本组）→「你支付 YOU PAY」组（标题 secondary 灰）=实付代币行（杠杆=利息金额；普通=支付金额；+预购金额行；**支付项同资产时出加粗「支付合计」行**，异资产不硬凑）；黄保留给 CTA；结构 `.participation-review__rows/__row/__group/--genesis`（create-form 审阅仍 dl 平铺不受影响）；审阅头部图标 32px 描边框+与标题居中对齐（对齐 §15 CurrentAction 先例，2026-09-25） |
| 一键预购 | 开关开启才出现预购金额输入；**实时可预购上限**=创世资金按面值折算 uAsset×70%×容量比例（`verse.preorderCapacityRatio` fixture 快照，缺失=null→仅显「以链上读值为准」槽位）；上限随创世金额输入实时更新（`data-numeric`）；超限→FieldError「超出可预购上限——最多可预购 {cap}」+提交拦截（对照 stockCap 模式）；提交校验两项均 >0 |
| 预购面板 | Verse 级容量进度条 ProgressMeter（标签「预购容量」，位于金额输入前）：容量=（普通创世资金+杠杆债务本金）×70%×容量比例（`MemeverseLauncherLib.preorderMaxCapacity`，真源口径同 glossary；债务本金=已收利息÷利率），已用=`verse.preorderRaised` 快照（合约 `PreorderState.totalFunds`）；容量随创世资金实时变化（合约 dev comment）→ 注「以链上实时值为准」；金额约束=剩余容量（容量−已用，先到先得、合约超 cap revert，`IMemeverseLauncher preorder`）→「可预购余量」FieldDescription+超限 FieldError「超出预购容量——最多可预购 {cap}」+提交拦截（对照杠杆 stockCap 模式）；比例或利率快照缺失=null→槽位「预购容量待链上读值」+CTA 禁用（对照 leverageRateSlot） |
| 规则 | **路径决定支付资产**（用户裁定 2026-09-22；同日二次裁定合并直付与面值直兑）：直接参与=支付资产下拉「募集 uAsset（直付，默认首选）+ PSM 配对储备资产（面值即时兑换）」，说明文案随所选资产切换（**渲染于 Pay with 下拉下方**——用户裁定 2026-09-25：direct/credit/预购统一移至支付资产处，stake 路径说明仍随路由分段框）；质押参与=**两级联动下拉**（用户裁定 2026-09-22）——先选「质押来源」（Lido/Aave…，读 `fixtures/data/yield-sources.json` registry，样本口径=OutrunBook vision.md 协议清单+OutStake adapters；**来源按本 Verse uAsset 族过滤**（来源 `anchor`=uAsset 符号去 U 前缀；用户裁定 2026-09-22：UETH verse 不出现 USD 族来源如 sUSDe）；切来源→参与资产组随之切换并回落首项，如 Lido→ETH/wstETH/stETH、Aave→ETH/aETH），再选「参与资产」——由 `getPrototypeParticipationOptions(verse.raiseAsset)` 出口 `yieldSourceRegistry`，不写死；无选项路径项禁用；预购模式**金额仍按募集 uAsset 计价**、支付资产组与直付同款可选（uAsset 直付+储备面值直兑——用户裁定 2026-09-25）。审阅屏分组化见「杠杆面板」行（用户裁定 2026-09-25）；折算口径：质押路径 sy 资产按实时价值折算 uAsset——fixture `anchorValue` 样本率（OB:outstake/uasset.md:21 机制、:48 wstETH≈1.05 样本），direct 路径面值 1:1 直兑；**折算一律出数值不显槽位**——sy 资产缺 `anchorValue` 快照时兜底面值 1（用户裁定 2026-09-25），一键预购上限同口径联动折算值。数字全部 `data-numeric`；一屏唯一黄 CTA（审阅按钮） |
| 密度 | 路径分段框行高=`--row-height`（44px，T2 表格档；2026-09-22 用户裁定自 T3 放松档 56px 收紧）；模式 tab 行高=`--control-height`（40px）；参与卡 padding-block-start=`--space-2`（8px，`.workbench-primary` 专属覆盖——用户裁定二次收紧；其余三边 16px）；面板无表头附加间距（`.participation-form` 不设 padding-block-start） |


## 15. CurrentAction（当前行动卡 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | Verse 详情页副工作台（`workbench-secondary` 首位）：按阶段告知用户当下可做什么、解释阶段推进入口状态（`components/prototype/verse-page.tsx` CurrentAction；样式 `.action-panel*`） |
| 创世文案四态 | 按双口径达标+Fast Genesis 分派（真源 lifecycle.md:53-55，2026-09-22 文案重写）：①常规（未达标未截止）=「创世开放参与中。截止后任何人可触发阶段推进。」②非 Fast 已达标=「成功门槛已达标——创世将进入锁定。阶段推进待创世截止后触发。」③Fast 未达标=「任一门槛达标，任何人即可触发阶段推进——无需等到截止。」④Fast 已达标=「任何人现在即可触发阶段推进，提前结束创世。」；旧第二句「截止后参与仍计入判断」属黄昏区口径（决议 008），只在截止后未推进态成立，当前 fixture 无该态样本、不常驻渲染 |
| 按钮 | 创世=「触发阶段推进」outline disabled+title「Sample data — the clock does not advance」（原型时钟固定，全站原型按钮不发交易）；非创世=「Connect to check eligibility」disabled；locked 额外出行「触发费用分配」说明块 |
| 结构 | `.action-panel__head` 横排=阶段图标（32px 描边框，`--space-6`；2026-09-25 用户裁定框 40→32，内图形 `--text-md` 不缩）+「What you can do now」标题同行；下方正文/按钮/费用分配块纵向 `gap: var(--space-3)` |
| 规则 | 图标随阶段语义+阶段色（2026-09-22 用户裁定多轮：原 GitCommitHorizontal 常青框→沙漏→里程碑→`ChevronsRight` 双箭头，用户选定——下一步行动/现在就动）：genesis=双箭头/黄、locked=锁/品红、unlocked=盾/青、refund=退回/橙（token 同 stage-badge）；数字无；文案全走 `getCopy(locale)` 双语；与参与面板分工=面板管操作、本卡管阶段推进解释，不重复参与引导 |


## 16. CreateForm（创建 Memeverse 表单 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | `/memeverse/launch`（R-04，原 /launch、更早 /memeverse/create；2026-09-23 裁定并入 /memeverse/* 域）发起人表单：身份信息 → 社区链接（选填）→ 创世规则 → 侧栏报价/固定条款 → 审阅（原型不发交易） |
| 实现 | `components/prototype/create-form.tsx` + `create-page.tsx`；样式 `app/globals.css .create-*`；读链参数快照 `fixtures/data/create-config.json`（经 `getPrototypeCreateConfig`；缺失=null→「以链上读值为准」槽位+提交禁用） |
| 字段（demo 布局序） | Flash Genesis=**Switch 切换开关**（首项：标签+⊙+开关，base-ui Switch 内联；青=Fast 功能信号）→ logo/名称/Symbol 并排（name/symbol 1–31 字节，SPEC-M8 registration-details §3；错误文案承载字节规则，无可见 hint）→ 创世时长独立行（+「天」后缀；**唯一可见 hint**=「Must be between 1 and 3 days.」，demo 同款；区间来源收 ⊙ tooltip）→ 资金类型/治理链/Omnichains 三下拉（uAsset 白名单；治理链说明收 ⊙；Omnichains=base-ui `Select multiple`，空值显「Select Chains」，治理链必含不可取消——本链 fan-out fee=0 SPEC-M8 §9；**全部 SelectContent `alignItemWithTrigger={false} align="start"`**——弹层落触发器下方禁覆盖，Explore 同款；详情页 participation-panel 三个 Select 同步修）→ 描述（1–255 字节必填，`data-numeric` 字节计数器，textarea 加高至 ~112px）→ **Communities 折叠面板**（边框容器：表头+⊙+chevron；展开=4 输入两列、品牌图标在输入框内——Website URL/X handle/**Discord invite url**/Telegram handle；底部注记「All community links are optional.」——本系统无斜体用 tertiary）。**除时长 hint 外全部字段说明收进 ⊙ `.create-info` Tooltip**。**无初始定价/最低成功额度字段**（非注册参数，SPEC-M8 §3+demo 均无，2026-09-22 用户裁定；OB lifecycle.md:22 张力登记 source-map §6） |
| 锁定期 | **无输入**：`unlockTime = endTime + FIXED_LOCKUP_DURATION`（365 days 合约常量非参数，config-matrix §3:83）——侧栏「合约固定条款」仅展示数值与说明 |
| 报价 | 注册费+异链部署费（fixture 样本；`quoteState='pending-manifest'` 显 `.form-warning`「报价结构以冻结 ABI 后为准」）；币种=治理链原生符号；随 Omnichains chips 即时重算；审阅卡复列（合计黄字） |
| 状态 | 提交全量校验（participation 同模式：单次 invalid 标记+字段级 FieldError 不弹窗）；审阅态复用 `.participation-review`（`aria-live="polite"`）；确认=复用「确认原型状态」；返回修改表单保留 |
| 密度 | 控件/chips 40px（`--control-height`）；报价行 44px（`--row-height`）；FieldSet legend 带底边线分组；一屏唯一黄 CTA（Create ↔ 确认互斥出现） |


## 17. PolMintDialog（Mint POL 弹窗 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | Tokenization 标签 POL 卡 Mint 按钮触发的双币供给弹窗（`components/prototype/pol-mint-dialog.tsx`；样式 `.pol-mint*` + 复用 `.swap-panel__*` 字段原语；2026-09-24 用户裁定：按钮改弹窗，功能参照 demo 双币供给弹窗、视觉按本站品牌适配） |
| 机制口径 | uAsset + memecoin 按主池配比供给，按实际加池量 1:1 铸 POL（`IMemeverseLiquidityImpl.sol:31` mintPOLToken：双侧 desired/min + deadline；pt-yt-splitter.md:251 POL:主池 LP=1:1）；阶段门=Locked/Unlocked 开放（state-machines.md:47，pol 标签仅这两态渲染） |
| 双侧联动 | 主池全范围两侧等值（OutrunBook pol-splitter.md §What POL is）：输入 memecoin 侧 → uAsset 侧 = 金额 × price；输入 uAsset 侧 → memecoin 侧 = 金额 ÷ price（price=`trade.tokenStats.price` fixture 蜡烛收盘；null 时输入互不联动、报价槽位） |
| 输出推导 | POL ≈ uAsset 侧 ÷ `pol.uAssetPerPol`（fixture 样本线性推导）；Min. received = POL × (1−滑点)；Rate 行同 SwapPanel 主池口径；示意/链上读值/原型未接线类元文案一律不进 UI（含 title 悬浮）——内部开发原型，开发者不需要提示（2026-09-24 用户裁定） |
| 费率反转 | Rate 行挂 `.swap-panel__rate-flip` 幽灵钮（青功能信号，ArrowLeftRight 12px）：默认 `1 {meme} ≈ price {uAsset}`，点击翻 `1 {uAsset} ≈ 1/price {meme}`（toFixed(6)；price≤0/缺失时禁用）——Swap 卡同款同款态（2026-09-24 用户裁定，两处共用 CSS 与 copy.swapRateFlip） |
| 设置层 | 头部幽灵齿轮 → Popover 滑点 0.1/0.5/1%+自定义、截止 10/20/30min+自定义（复用 `.swap-settings` 原语与 swap-panel 导出的预设常量；tip 文案为 mint 语境「铸造将回退」） |
| 余额/Max | 输入卡=字段头（左 `mintSideMeme`/`mintSideUasset` 标签 + 右 `Balance: {formatAmount}`（`pol.myMemecoin`/`pol.myUAsset` fixture 样本，`data-numeric`）+ **Max 可点**（点击填入该侧全部余额并按池内配比推导另一侧，2026-09-24 用户裁定：造余额样本使 Max 可用；样本取值保证 meme×price ≤ myUAsset 不越界）；≈$ 换算行在输入下方（同 SwapPanel）；输出卡 Balance=`pol.myPol` fixture 真值 |
| CTA | 未连接=Connect Wallet 可点（`useMockWallet` 全站共享开关）；已连接=Mint 禁用（原型不伪造链上成交，无任何提示文案）；关闭=头部 ✕ / Esc / 遮罩外点（base-ui Dialog 内置） |
| 触发器 data-slot | `DialogTrigger render={<Button/>>` 的 props 合并会把 Button 的 `data-slot="button"` 覆写为 `dialog-trigger`，而主题桥皮肤（标签区「青色控制台」40px/青 tinted 描边等）按 `[data-slot='button']` 匹配——触发器必须显式传 `data-slot="button"` 钉回，否则与同排按钮皮肤不一致（2026-09-24 踩坑） |
| 文案 | `getCopy(locale).verseDesk`：mintDialogTitle/mintSupply/mintSideMeme/mintSideUasset/mintYouReceive/mintSettingsTitle/mintSlippageTip/mintDeadlineTip + 复用 balance/max/swapRate/minReceived/maxSlippage/slippageTolerance/transactionDeadline/swapCta；`common.close` 供 ✕ aria-label |


## 18. VaultActions（Yield Vault 操作卡 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | Verse 详情 Yield Vault 标签操作卡（`components/prototype/vault-actions.tsx`；2026-09-24 用户裁定按 demo.outrun.build/memeverse 布局重设计：Tabs → Amount 卡 → Details 卡 → 全宽 CTA → 脚注；样式 `.vault-card*` + 复用 `.swap-panel__field/__details/__cta` 原语） |
| 机制口径 | vault 全部操作（stake/redeem/withdraw）走治理链（OutrunBook omnichain.md §The governance chain）；跨链质押=Memecoin 经 LayerZero 跨到治理链入库存份额（omnichain.md §Cross-chain staking）；赎回两步异步、REDEEM_DELAY=1 days（`MemecoinYieldVault.sol:22`）；跨链费=LayerZero 发送时报价、按源链原生币精确支付（omnichain.md §Cross-chain reliability），无 fixture 字段 → 明细行槽位 `--` + ⊙ 气泡 `crossFeeNote` |
| 链感知 | 连接网络 = header GS-2 链选择器**唯一入口**（2026-09-24 用户裁定：卡内网络芯片删除）——选择器读写 mock 钱包 `chainId`（`useMockWallet`，默认 chains[0]=Ethereum Sepolia 11155111；仍写 URL `?chain=` 供 discovery 过滤）。vault 判定「在治理链」用治理链主网 id→测试网对应链映射（1→11155111/8453→84532/56→97，模拟粘合层非领域数值）：连接且不同 → Stake 进跨链模式（青 tinted 横幅 + Cross-chain fee 行 + CTA `stakeCrossCta` 跨链存入，禁用）、Redeem/Withdraw 的 CTA 变 `switchChainCta`「Switch to {治理链}」**可点**=mock switchChain 切到治理链对应测试网（非链上写，header 触发器同源联动）；切回后恢复正常 CTA（禁用） |
| 兑换率方向 | Stake 行 `1 {symbol} ≈ (1/assetsPerShare) {s-symbol}`、Redeem 行 `1 {s-symbol} ≈ assetsPerShare {symbol}`（demo 同向；到账=amount÷/× assetsPerShare） |
| 余额/Max | Redeem Balance=`staking.myShares` fixture 真值 + Max 可点填入；Stake Balance=`pol-positions.myMemecoin` 样本（样本账户本 verse memecoin 余额，2026-09-26 复用 POL Mint 供给侧样本）+ Max 可点填入，无 pol 记录→槽位 `--`+禁用 |
| 状态列表 | 2026-09-26 用户裁定参照 demo 两图：赎回状态列表收进操作卡标签内（原 `.vault-panel__lists` 卡外双列删除，卡外恒显=设计不对）。Redeem 标签尾=Pending Redemptions（`pendingRedeems` 仅等待中逐笔：金额 mono + `redeemedOn{date}`（`formatDay` 纯日期，Dec 25, 2024 形态、UTC+8 口径）+ 走秒倒计时 `remaining{t}`（`RedeemCountdown`：repository `remainingMs` 快照剩余起按墙钟每秒递减、到 0 停表——纯展示 tick 非链上写；黄纯文本 `data-state=waiting` 无框））；Withdraw 标签头=Ready to Withdraw（仅已成熟逐笔：金额 + `readySince{date}`（=maturesAt 成熟日）+ `✓ ready` success 描边徽章 `data-state=ready`），后接 Total available 行→CTA→note；任一为空→该区 `--`；样式 `.vault-card__list/__list-main`（hover 青 2px 选择线） |
| 委托（Q9） | Stake 明细行内 `Myself/Custom address` 选项（`.vault-actions__delegate-option[data-selected]`，青选中态），默认自己；选 Custom address → 明细卡与 CTA 之间出现地址输入卡（`.swap-panel__field` 原语，`data-numeric` 等宽，maxLength 42、输入去空白），非空且不匹配 `^0x[0-9a-fA-F]{40}$`（EVM 口径=治理链族 Ethereum/Base/BNB，大小写均收不校验 EIP-55）→ FieldError `delegateAddressError` + `aria-invalid`/`aria-describedby`，空值不报错；切回 Myself 收起输入卡、已输入值保留；CTA 维持禁用（原型纪律）；`Delegate to` 标签旁 ⊙ `.create-info` 气泡=delegateNote（2026-09-26 用户裁定：原正常态/跨链双态脚注删——委托说明收进气泡，卡底脚注仅跨链态留 crossNote，正常态无脚注，核验份额口径 omnichain.md:51） |
| CTA | 未连接=Connect Wallet 可点（全站共享开关）；已连接且治理链=操作 CTA 禁用 + title `onChainSlot`（原型不伪造链上写）；一屏一个主 CTA（黄色 `.swap-panel__cta` 通道） |
| 文案 | `getCopy(locale).verseDesk`：crossBannerTitle/crossBannerSub/crossBannerBody/stakeCrossCta/switchChainCta/crossFee/crossFeeNote + 复用 amount/balance/max/exchangeRate/youReceive/youReceiveAfter24h/stakeCta/redeemCta/withdrawAll/delegate*（delegateNote=气泡）/redeemNote/crossNote/onChainSlot + 状态列表 pendingRedeems/readyToWithdraw/readySince/redeemedOn/remaining/ready（withdrawNote 脚注 2026-09-26 用户裁定删——CTA 与 Total 行已表意，冗余） |


## 19. PolFlow（拆分⇄合并换向器 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | Tokenization 标签 PT/YT 衍生卡底部操作区（`verse-tab-panels.tsx` PolPanel 内；样式 `.pol-flow*`，容器 `.pol-card__actions--flow`；2026-09-25 用户裁定：补 merge + 草稿公式行升级终端仪器盒——推翻早期「Merge 按钮移除」简化） |
| 机制口径 | Split=`IPOLSplitter.sol:102`（1 POL → 1 PT + 1 YT）；Merge=`:104`（等额销毁 PT+YT，1:1 换回 POL）；同闸门仅 locked（unlock/settled 后 `AlreadyUnlocked`，POLSplitterUpgradeable.sol:268；OutrunBook lifecycle.md:16、pol-splitter.md:16） |
| 状态 | locked→两钮可点弹操作窗（PolSplitMergeDialog §20，2026-09-26 用户裁定）；非 locked→两钮恒禁用 + title=splitClosed（链上已关），note 行=splitClosed（locked 态 note 行 2026-09-25 裁定删） |
| 结构 | 两行=两向：`__dir` 方向符章（分叉=split/镜像汇聚=merge，aria-hidden）+ `__eq` 等式（`__tok` 单色次级——2026-09-25 用户裁定三 token 身份色太花/光污染，身份由资产行代币章承载；运算符三级；整条 `data-numeric`）+ 动作钮；不钉底、紧跟 claim 行（stretch 等高下钉底会拉出空白） |
| 文案 | `getCopy(locale).verseDesk`：splitPol/mergePol/splitNote/splitClosed/mergeNote（等式为结构化 token 标记，非整句 copy） |


## 20. PolSplitMergeDialog（Split/Merge 操作弹窗 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | 换向器两钮 locked 态触发的操作弹窗（`components/prototype/pol-split-merge-dialog.tsx`，`mode='split'/'merge'` 单组件两态；2026-09-26 用户裁定：两钮从恒禁用改弹窗做实际操作；壳/原语复用 `.pol-mint` + `.swap-panel__field/__details/__cta`，无新 class） |
| 机制口径 | Split=1 POL → 1 PT + 1 YT（`IPOLSplitter.sol:102`）、Merge=等额销毁 PT 与 YT 换回同额 POL（`:104`，同一 amount 两侧 burn）——严格 1:1，合约无滑点/无 deadline 参数 → **不设设置齿轮**（与 Mint 弹窗的结构差异=机制差异）；闸门仅 locked（unlocked 态按钮不弹窗、保持禁用） |
| 联动/Max | split：单输入 POL、Max=全部 `myPol`；merge：PT/YT 双输入恒等额联动（单状态驱动两框），两框各挂 Max、同填 `min(myPt, myYt)`（Max 语义=最大可合并对数——单侧全额会破另一侧约束；2026-09-26 用户问「为何只有 YT 有 Max」后改双挂） |
| 估值 | 无换算行（2026-09-26 用户裁定删 split 输入 ≈$；PT/YT 本就无独立价样本） |
| 明细 | Rate 行与输出区删（2026-09-26 用户裁定第二轮：1:1 恒等，结果=输入的复述，冗余）——弹窗=输入+CTA |
| CTA | 同 Mint 弹窗：未连接=Connect Wallet 可点切换模拟连接（`useMockWallet`）；已连接=Split/Merge 禁用（原型不伪造链上成交，无提示文案） |
| 触发器 data-slot | 同 §17 踩坑：`DialogTrigger` 显式 `data-slot="button"` 钉回，否则主题桥皮肤不匹配 |
| 文案 | `splitDialogTitle`/`mergeDialogTitle`（2026-09-26 新增）+ 复用 splitPol/mergePol/balance/max/swapCta/`common.close` |


## 附：组件间通用交互契约

- 弹层（AssetSelector/ChainSelector/交易中心）：Esc 关闭、焦点圈闭（focus trap）、关闭后焦点还原触发器。
- 所有异步动作：进行中可取消或明确不可取消；完成后 toast + 内联状态双通道。
- 复制：`navigator.clipboard` + 成功 toast「Copied」+ 失败回退选中文案。
- 地址/hash/symbol/长文本：截断规则统一（`0x1234…abcd`），悬停完整值（title）+复制按钮。

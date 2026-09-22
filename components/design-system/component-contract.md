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
| 结构 | `__header`（`__symbol` + `__identity` 名称/符号 + StageBadge）→ `dl.__facts`（链、创建时间等，值 `data-numeric`）→ `__signal`（按阶段切换：progress / livePrice / poolLiquidity / returningCapital；含 `__signal-label`、值、`__signal-note`）→ `__open` 箭头 |
| 状态 | default；hover / focus-within 提升一档表面 + 青选择线；阶段色经 `--stage-color` 只出现在顶缘与色点 |
| 规则 | 每卡只突出一个信号区；数字零 glow；进度用 `role="progressbar"` + 文本 |
| 响应式 | `.economy-grid` auto-fill；≤30rem `__facts` 堆叠、header 折行 |

## 13. PageIntro / StageTabs / SectionHeading（页面结构原子 · 已落地）

| 组件 | 实现 | 契约 |
|---|---|---|
| PageIntro | `.page-intro`（h1 + p ≤66ch，底部黄 2px + 品红 1px 回声） | 每页一次，唯一 h1 |
| StageTabs | `.stage-tabs a[data-active]`（56px，激活 = 顶部黄线 + 黄字 + 黄 inset） | 单页内阶段切换；与 LifecycleTabs 不同页混用 |
| SectionHeading | `signal-ui.tsx` 导出，`header.section-heading.ax-echo-bar`（`__row` = h2 + aside；description `<p>` 在行下、贴底边框；签名线锚定边框不随描述下沉，决议 014 几何化） | 每个 section 一个 h2，`aside` 放筛选/计数 |
| Verse 头部 | `.verse-hero`/`.verse-identity`（verse-page 内联） | （2026-09-22 用户裁定多轮定稿）symbol 大图形（约 198px）绝对定位左侧，文本列 padding 让位：①名称行=ticker 在前（数据等宽 `--text-num-lg`+主行动黄+大写字距+抖音式错版 text-shadow：青左上/品红右下 0.08em）+name 随后（`--text-lg` 无回声阴影，不抢戏）+徽章右推同行；②描述紧跟名称行（SPEC-M8 ≤255 字节→68ch 约四行）；③底行两端=链信息（左，label 样式：`--text-sm`+大写+0.08em 字距，与描述正文分层；组间 `--space-5`/组内 `--space-2`）+社交图标（右，同 flex 行天然同线）；社交=官方品牌图标（`brand-icons.tsx` simple-icons path：X/Discord/Telegram+lucide Globe），顺序 website→x→discord→telegram（repository SOCIAL_ORDER；fixture kind twitter 已改名 x）；「Economy overview」标签删除；hero 顶部无 padding（主容器 24px 唯一留白）；四项统计在右列 `.stats-panel` 新卡（Key metrics 2×2） |

## 14. ParticipationPanel（创世参与面板 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | Verse 详情页（`stage=genesis`）参与工作台：选择参与方式、输入金额、审阅后确认（原型不发交易） |
| 实现 | `components/prototype/participation-panel.tsx`；样式 `app/globals.css .participation-form/.participation-toggle/.participation-toggle--mode/.participation-fixed-asset/.participation-review*` |
| 结构 | 模式层三项 ToggleGroup `.participation-toggle--mode`（普通创世/杠杆创世/预购——预购与创世同级，用户裁定 2026-09-21；顶层 tab 风格：无框透明底、激活=黄字+底部黄线，底边线兼作分割线（`ax-echo-bar` 签名线锚定其下），与路径分段框区分——2026-09-22 用户裁定；无可见字段标签，`aria-label`=「参与方式」；section 可见标题/描述删除——与右侧「当前可以做什么」完全重复，纲要由 sr-only h2 维持）→（非预购）路径两项分段 ToggleGroup → 支付资产字段（多选项=Select；唯一选项=固定值 `.participation-fixed-asset`，不渲染选择器）→（预购）Verse 级容量 ProgressMeter（已用/上限；见「预购面板」行）→ 金额 Input →（非预购）一键预购开关+预购金额 Input → 审阅卡 |
| 状态 | 杠杆模式：披露 `form-warning`「损失上限=所付利息 · 无清算 · 创世失败利息全额退」；fixture 缺利率/上限快照=null→显「以链上读值为准」槽位+提交禁用（2026-09-22 起快照齐备即全交互）；金额/预购金额为空提交 → `data-invalid` + FieldError；审阅态 `aria-live="polite"` |
| 杠杆面板 | 利息金额输入（标签切「利息金额」）；路径三项=用 uAsset 直付/面值直兑（PSM 储备转利息，无 CDP 仓位）/创世积分直付（`leveragedGenesisWithCredit` 锁定时销毁；杠杆无质押项）；实时预览=债务额度（利息÷利率，一次性比例非年化，`data-numeric`）；债务上限余量=债务上限−已建债务（已收利息÷利率），超限→FieldError「超出债务上限——剩余可建额度 {quota}」+提交拦截（对照 stockCap 模式）；一键预购上限按债务额度推导（容量=(普通资金+杠杆债务本金)×70%×容量比例）；审阅卡出行=利息金额（支付资产计）+债务额度（uAsset 计） |
| 一键预购 | 开关开启才出现预购金额输入；**实时可预购上限**=创世资金按面值折算 uAsset×70%×容量比例（`verse.preorderCapacityRatio` fixture 快照，缺失=null→仅显「以链上读值为准」槽位）；上限随创世金额输入实时更新（`data-numeric`）；超限→FieldError「超出可预购上限——最多可预购 {cap}」+提交拦截（对照 stockCap 模式）；提交校验两项均 >0 |
| 预购面板 | Verse 级容量进度条 ProgressMeter（标签「预购容量」，位于金额输入前）：容量=（普通创世资金+杠杆债务本金）×70%×容量比例（`MemeverseLauncherLib.preorderMaxCapacity`，真源口径同 glossary；债务本金=已收利息÷利率），已用=`verse.preorderRaised` 快照（合约 `PreorderState.totalFunds`）；容量随创世资金实时变化（合约 dev comment）→ 注「以链上实时值为准」；金额约束=剩余容量（容量−已用，先到先得、合约超 cap revert，`IMemeverseLauncher preorder`）→「可预购余量」FieldDescription+超限 FieldError「超出预购容量——最多可预购 {cap}」+提交拦截（对照杠杆 stockCap 模式）；比例或利率快照缺失=null→槽位「预购容量待链上读值」+CTA 禁用（对照 leverageRateSlot） |
| 规则 | **路径决定支付资产**（用户裁定 2026-09-22；同日二次裁定合并直付与面值直兑）：直接参与=支付资产下拉「募集 uAsset（直付，默认首选）+ PSM 配对储备资产（面值即时兑换）」，说明文案随所选资产切换；质押参与=**两级联动下拉**（用户裁定 2026-09-22）——先选「质押来源」（Lido/Aave…，读 `fixtures/data/yield-sources.json` registry，样本口径=OutrunBook vision.md 协议清单+OutStake adapters；**来源按本 Verse uAsset 族过滤**（来源 `anchor`=uAsset 符号去 U 前缀；用户裁定 2026-09-22：UETH verse 不出现 USD 族来源如 sUSDe）；切来源→参与资产组随之切换并回落首项，如 Lido→ETH/wstETH/stETH、Aave→ETH/aETH），再选「参与资产」——由 `getPrototypeParticipationOptions(verse.raiseAsset)` 出口 `yieldSourceRegistry`，不写死；无选项路径项禁用；预购模式固定按募集 uAsset 计价。审阅卡按激活路径出行（创世金额/预购金额）；数字全部 `data-numeric`；一屏唯一黄 CTA（审阅按钮） |
| 密度 | 路径分段框行高=`--row-height`（44px，T2 表格档；2026-09-22 用户裁定自 T3 放松档 56px 收紧）；模式 tab 行高=`--control-height`（40px）；参与卡 padding-block-start=`--space-2`（8px，`.workbench-primary` 专属覆盖——用户裁定二次收紧；其余三边 16px）；面板无表头附加间距（`.participation-form` 不设 padding-block-start） |


## 15. CurrentAction（当前行动卡 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | Verse 详情页副工作台（`workbench-secondary` 首位）：按阶段告知用户当下可做什么、解释阶段推进入口状态（`components/prototype/verse-page.tsx` CurrentAction；样式 `.action-panel*`） |
| 创世文案四态 | 按双口径达标+Fast Mode 分派（真源 lifecycle.md:53-55，2026-09-22 文案重写）：①常规（未达标未截止）=「创世开放参与中。截止后任何人可触发阶段推进。」②非 Fast 已达标=「成功门槛已达标——创世将进入锁定。阶段推进待创世截止后触发。」③Fast 未达标=「任一门槛达标，任何人即可触发阶段推进——无需等到截止。」④Fast 已达标=「任何人现在即可触发阶段推进，提前结束创世。」；旧第二句「截止后参与仍计入判断」属黄昏区口径（决议 008），只在截止后未推进态成立，当前 fixture 无该态样本、不常驻渲染 |
| 按钮 | 创世=「触发阶段推进」outline disabled+title「Sample data — the clock does not advance」（原型时钟固定，全站原型按钮不发交易）；非创世=「Connect to check eligibility」disabled；locked 额外出行「触发费用分配」说明块 |
| 结构 | `.action-panel__head` 横排=阶段图标（40px 描边框，`--control-height`）+「What you can do now」标题同行；下方正文/按钮/费用分配块纵向 `gap: var(--space-3)` |
| 规则 | 图标随阶段语义+阶段色（2026-09-22 用户裁定多轮：原 GitCommitHorizontal 常青框→沙漏→里程碑→`ChevronsRight` 双箭头，用户选定——下一步行动/现在就动）：genesis=双箭头/黄、locked=锁/品红、unlocked=盾/青、refund=退回/橙（token 同 stage-badge）；数字无；文案全走 `getCopy(locale)` 双语；与参与面板分工=面板管操作、本卡管阶段推进解释，不重复参与引导 |


## 16. CreateForm（创建 Memeverse 表单 · 已落地）

| 方面 | 契约 |
|---|---|
| 用途 | `/launch`（R-04，原 /memeverse/create）发起人表单：身份信息 → 社区链接（选填）→ 创世规则 → 侧栏报价/固定条款 → 审阅（原型不发交易） |
| 实现 | `components/prototype/create-form.tsx` + `create-page.tsx`；样式 `app/globals.css .create-*`；读链参数快照 `fixtures/data/create-config.json`（经 `getPrototypeCreateConfig`；缺失=null→「以链上读值为准」槽位+提交禁用） |
| 字段（demo 布局序） | Flash Genesis=**Switch 切换开关**（首项：标签+⊙+开关，base-ui Switch 内联；青=Fast 功能信号）→ logo/名称/Symbol 并排（name/symbol 1–31 字节，SPEC-M8 registration-details §3；错误文案承载字节规则，无可见 hint）→ 创世时长独立行（+「天」后缀；**唯一可见 hint**=「Must be between 1 and 3 days.」，demo 同款；区间来源收 ⊙ tooltip）→ 资金类型/治理链/Omnichains 三下拉（uAsset 白名单；治理链说明收 ⊙；Omnichains=base-ui `Select multiple`，空值显「Select Chains」，治理链必含不可取消——本链 fan-out fee=0 SPEC-M8 §9；**全部 SelectContent `alignItemWithTrigger={false} align="start"`**——弹层落触发器下方禁覆盖，Explore 同款；详情页 participation-panel 三个 Select 同步修）→ 描述（1–255 字节必填，`data-numeric` 字节计数器，textarea 加高至 ~112px）→ **Communities 折叠面板**（边框容器：表头+⊙+chevron；展开=4 输入两列、品牌图标在输入框内——Website URL/X handle/**Discord invite url**/Telegram handle；底部注记「All community links are optional.」——本系统无斜体用 tertiary）。**除时长 hint 外全部字段说明收进 ⊙ `.create-info` Tooltip**。**无初始定价/最低成功额度字段**（非注册参数，SPEC-M8 §3+demo 均无，2026-09-22 用户裁定；OB lifecycle.md:22 张力登记 source-map §6） |
| 锁定期 | **无输入**：`unlockTime = endTime + FIXED_LOCKUP_DURATION`（365 days 合约常量非参数，config-matrix §3:83）——侧栏「合约固定条款」仅展示数值与说明 |
| 报价 | 注册费+异链部署费（fixture 样本；`quoteState='pending-manifest'` 显 `.form-warning`「报价结构以冻结 ABI 后为准」）；币种=治理链原生符号；随 Omnichains chips 即时重算；审阅卡复列（合计黄字） |
| 状态 | 提交全量校验（participation 同模式：单次 invalid 标记+字段级 FieldError 不弹窗）；审阅态复用 `.participation-review`（`aria-live="polite"`）；确认=复用「确认原型状态」；返回修改表单保留 |
| 密度 | 控件/chips 40px（`--control-height`）；报价行 44px（`--row-height`）；FieldSet legend 带底边线分组；一屏唯一黄 CTA（Create ↔ 确认互斥出现） |


## 附：组件间通用交互契约

- 弹层（AssetSelector/ChainSelector/交易中心）：Esc 关闭、焦点圈闭（focus trap）、关闭后焦点还原触发器。
- 所有异步动作：进行中可取消或明确不可取消；完成后 toast + 内联状态双通道。
- 复制：`navigator.clipboard` + 成功 toast「Copied」+ 失败回退选中文案。
- 地址/hash/symbol/长文本：截断规则统一（`0x1234…abcd`），悬停完整值（title）+复制按钮。

# 设计决策日志（Stage-01）

> 人工决策记录：每条含决策语句（用户原话要点）、约束效力范围、证据引用。AI 不得代选、不得事后改写。

> 收录标准（2026-10-10 用户裁定，极简口径）：只登记仍生效、且无法从当前代码与设计系统文档直接恢复的裁定。过程轮次、像素微调、已被后续裁定取代或已完全落地于代码/文档的记录不入册；既有过程轮次已清除（git 历史可溯）。

## 决策 001 · 风格方向锁定（2026-09-15，步骤 8）

- **决策**：锁定 `direction-01 暗端信号台`（cyberpunk 主导 / synthwave 作光）。
- 用户原话要点：「D1，但是当前的 D1 有个问题，就是终端风格偏极客，但是我们的用户有各种各样的背景，所以 UI 设计不要太极客化了，要像个日常消费产品，但是也不要因此而丢失风格主体。」
- **伴随决议 A（去极客化，约束至 token/组件/页面全链）**：
  1. 等宽字收窄到纯数据字段（数字/地址/hash/时间戳）；导航、按钮、正文、标题一律常规无衬线
  2. 移除极客符号：`KERNEL V3.3`、`DELEGATED ✓`、小写等宽命令式导航（`pol-desk`）等——换成消费者语言（自然语言标签+图标；账户/会话状态用日常文案）
  3. 斜切按钮收敛为小切角（≤8px），不再大面积 clip-path
  4. 微文案去术语化（遵循 architecture.md §2：SY/CDP/PSM 等机制词仅必要时出现且经阶段 2 术语表）
  5. 消费品级亲和：字号/留白/悬停反馈/人话错误文案；错误信息给恢复动作不给堆栈腔
  6. **风格主体保留不动**：黑底 `#0A0A10`、黄主光 `#FCEE0A`、品红回声 `#FF06B5`、青功能色、回声确认签名交互、数据层无 glow 高对比
- **伴随决议 B（双语呈现方式修正）**：「双语是指页面可以切换中/英文（默认英文），不是说在一个页面同时显示双语。」
  - 效力：每页单语言，`/{locale}` 路由切换；原型/对比/规格片段不再中英混排；D1 相关文档中"双语层叠"类表述按此作废
  - 冲突裁决（2026-09-15 用户裁定）：**默认 locale = 英文（`/` → `/en`）**。architecture.md §2 现文「默认 `/zh`」需修订——阶段 1 不修改架构文件，本裁决登记在案，architecture.md 的修订由用户在架构修订窗口执行；阶段 1/2/3 产物一律按「单语言渲染 + zh/en 切换 + 默认 en」执行
- **证据**：`docs/design/review/v0-revisions/outrundapp-vercel-d{1,2,3}-{desktop,mobile}.png`（六图，revision 链 r2 `fc2d2358…`）；三方向内容等价验证（progress 步骤 7 行）；D1 证据链 VS-002/VS-007/VS-004/BRAND + Jupiter 审阅范式（direction-01.md）
- 签名：approved by Jasonrale（经 stage-01 handoff 审批生效，2026-09-17）

## 决议 002 · 主色/强调色延伸（2026-09-15，步骤 9）

- **决策**：`P2 冷石墨`。表面 `#12141B`（冷灰阶），正文 `#E6E9F0` 15.14:1 / 次级 `#9AA3B5` 7.25:1 / 三级 `#8791A4` 5.80:1，成功 `#35E08E` 10.69:1，危险 `#FF5468` 5.89:1（页面 SSR 实测标注）。品牌锚（黄/品红/青/站点黑）不变。
- 用户原话：「P2 + T2 + 字标确认」
- 依据：去极客化决议 001-A（冷表面+柔和反馈=日常消费感）+ 无障碍实测全 AA/AAA；拒绝项：P1（保留为对照）、P3（图标双编码移交步骤 11 组件契约统一处理，不在色彩层叠加）
- 证据：`axis-p2.png`、SSR HTML 实测（progress 步骤 9 修正行）、revision r3 `22cd6f4b…`
- 签名：approved by Jasonrale（经 stage-01 handoff 审批生效，2026-09-17）

## 决议 003 · 信息密度（2026-09-15，步骤 9）

- **决策**：`T2 均衡`——表格行高 44px · 正文 14px（页面 recommended default；/portfolio、/pol 局部允许向 T1 收，营销页允许向 T3 放）
- 依据：complexity-map 密度天花板 + ecosystem/audience.md 多背景用户 + 决议 001-A 消费品定位
- 证据：`axis-full-base.png`（对照 `axis-full-compact.png`/`axis-full-relaxed.png`）
- 签名：approved by Jasonrale（经 stage-01 handoff 审批生效，2026-09-17）

## 决议 004 · 字标锁定（2026-09-15，步骤 9）

- **决策**：`docs/design/brand/` OUTRUN 字标 + OR monogram 确认为唯一字标基准，不重绘。红线核验通过：96px 宽过（净空 ≥12px）、150px 过、导航高 24px 实测宽 93.3px<96px → 该高度必须用 symbol（logo-spec「<150px 优先 symbol」规则）；浅底用 mono 版；禁止改色/拉伸/裁切
- 证据：axis-choice 页 Axis 3 实测区块（SSR HTML）+ brand/logo-spec.md §3
- 签名：approved by Jasonrale（经 stage-01 handoff 审批生效，2026-09-17）

## 决议 005 · 阶段 1 UI/UX 片段定性（2026-09-17，用户裁定）

- **决策**：阶段 1 产出的所有界面片段（comparison.html 的 /pol 片段、v0 direction-choice/axis-choice 页面、token-preview 与 component-contract-preview 中的 POL 示例）**不代表实际产品**——其 UI/UX 实际上不符合产品需求，是错误的；它们只作为**视觉设计参考**（方向/色板/密度/token/组件状态语言的载体）。
- **效力**：阶段 2 页面 brief **不得**以这些片段的 IA、布局、字段编排为产品依据；产品 UX 真相 = architecture.md §2 + OutrunBook + complexity-map.md + 阶段 2 brief 本身。片段中出现的字段值虽引源自 complexity-map（引源真实），但编排是视觉演示。
- **可继承物（不受本决议影响）**：tokens.css、token-contract、组件**行为**契约（状态/键盘/aria/数字规则）、motion/a11y 契约、状态矩阵（源自 architecture 的状态要求）、四轴决策本身。
- 用户原话要点：「这个阶段画的 UI/UX（例如 POL 工作台）不代表实际产品……只是作为视觉设计参考」。
- 签名：approved by Jasonrale（经 stage-01 handoff 审批生效，2026-09-17）

## 决议 006 · 架构修订窗口：OutStake 基线推进 + 默认 locale 落地（2026-09-17，阶段 2 步骤 1）

- **背景**：阶段 2 步骤 1E fail-fast 核验发现 OutStake HEAD=`731541109f058e6df1dc042d8fa65b8221e12bcb` ≠ architecture §19 基线 `73c9b163…`（领先 2 commit，已推 origin/main）。只读核验（`docs/page-briefs/baseline-check-failed.md`，444 存证）：两 commit diff 仅 `script/harness/slither-baseline.json` + `test/upgradeable/SYAdaptersUpgradeable.t.sol`，不触及 `docs/spec/` 与 `src/`，spec 事实无差异。
- **决策**（用户会话裁决「基线+默认en（推荐）」「我代改（推荐）」，Agent 据授权代改）：
  1. architecture.md §19/§21：OutStake 基线推进到 `7315411…`（新增 §21 修订记录；§20 为 2026-09-14 历史记录不动）；
  2. architecture.md §2：默认 locale `/zh` → `/en`——落地已批决议 001-B（2026-09-15 用户裁定默认英文，当时架构修订挂起）；本窗口顺带落地，避免 routes.json 与已批决议矛盾、避免二次重签；
  3. 阶段 2 runbook 断言行与 `/zh` 引用同步（步骤 1 fail-fast 块、步骤 2 redirectAlias、步骤 11 验收点、验收门）。
- **后果（已告知并接受）**：architecture hash 变化 → stage-01 handoff（v1.0.0，approved）按 §19 规则判 superseded，不改写；阶段 1 审批证据以 **v1.1.0** 重新生成（approval-payload architectureHash 更新、manifest 重出、handoff 重签）；设计系统产物本身自 v1.0.0 批准以来零内容变化。
- 签名：approved by Jasonrale（会话明确授权，2026-09-17）

## 决议 007 · 阶段 2 产品拍板（2026-09-17，逐项会话裁决）

步骤 5 全量裁决（11 项 PD + 9 条对账 + 术语表），逐项问答记录于会话；Agent 未预选任何默认值。缩写：OB=OutrunBook@da1f10e5，SPEC-M/S=合约 spec（source map M/S 条目）。

### 参与与动线

- **PD-01+PD-05（参与面板）**：普通创世为默认首屏，显眼按钮切换到视觉更强的杠杆创世面板。普通面板=资产输入驱动：路径「直接参与」（PSM 门，一稳定资产唯一）与「质押参与 · {生息来源品牌}」（CDP 门，同资产可多个 SP）同级呈现；单路径自动选中，双门可达时显式选择收益权衡（质押=抵押生息+仓位可赎 vs 直接=即换即结清最轻）。机制词（PSM/CDP/门）不上 UI。杠杆面板=输入利息额+支付资产（uAsset/创世积分/储备资产自动兑换），实时预览债务额度与上限，披露「损失上限=利息、无清算、失败全额退」。用户要点原话：「PSM 门和 CDP 门是同级别的入口」「一个稳定资产只有一个 PSM 门，但可能有多个 CDP 门」「CDP，PSM 这些说法不要暴露给普通用户」。
- **预购分配器**：创世与预购同窗口（用户纠正：预购窗口期就是创世期间，lifecycle.md:10-18 一致）。参与面板内置创世↔预购分配（资金转 uAsset 后拆两笔），容量实时校验，端点=仅创世/仅预购；两行分账入审阅卡。
- **PD-03**：一步为正典（参与面板内铸造/兑换原子直进创世=合约门机制；非创世语境两步天然存在）。
- **PD-04**：USR 完整进 v1（三金库存取+份额/利率+未激活态照常显示）。
- **PD-11**：前端 UI 不做代付入口（合约 genesisUser 能力保留，后续版本可加）。

### 页面结构

- **PD-02+PD-08（Portfolio）**：三分区=①可行动（待领取/待执行赎回/保护窗倒计时/跨链在途滞留提醒→深链 /bridge）②仓位与储蓄（CDP 赎回+USR 存取就地展开；uAsset 资产行内「存入储蓄」快捷入口）③凭证（POL/PT/YT 按兑付时间线分组）。删跨链历史与交易历史（交易历史归全局交易中心）。用户要点原话：「跨链这个就不用写在 Portfolio 里了，历史交易也没有什么展示的意义」。
- **PD-07（首页/发现页）**：`/`=产品落地页（用户裁定：「域名首页就是单纯的产品介绍页和一些吸引人的关键指标，以及一些背景信息」）：一句话定位→双模块介绍→三档路径卡→营销指标带（总锁定 uAsset、Verse 总数、累计参与地址）→资产说明/背景→CTA；无个性化摘要。发现页=阶段 tab（创世中默认/锁定中/已解锁/全部）+阶段内排序（创世中=进度/剩余时间/规模；锁定中=距解锁/规模；已解锁=交易热度/规模）+过滤（治理链/资产族）+搜索；阶段为分组维度不跨阶段混排（用户指出混排与过滤自相矛盾）。app 子域拆分=阶段 3 基础设施议题。
- **PD-09**：CDP 仓位大白话「无到期、无利息、无清算、随时可赎、需主动操作」；治理周期读链显示实际配置值+倒计时（不写死 OB 示例 90 天）。
- **PD-10**：跨链消息详情承载于**交易中心**（三阶段组件）；/bridge=发起+历史简表（行点击跳交易中心）。通知中心 **v1 不做**（用户：「一上来不要做太复杂」）：待办靠 Portfolio 可行动区+toast；架构 §2 条目标注延后。
- **PD-06**：分层语气（/trade、/pol 交易台密度，其余消费化；专有词英文+中文解释）。

### 对账 C1–C9

C1 结算储备金按 spec 窄口径且 UI 不露出 · C2 建池剩余资金不展示 · C3 术语归类修正（流动性锁定期→Memeverse 节）· C4 已随 PD-09（读链）· C5 无风险表述用 OB 原句（genesis.md:82）长文案+短标签「本金守恒 · 24 小时保护期内可完整退出」，边界说明入展开区 · C6 已随 PD-03 · C7 「到期」仅限锁定期/预购语境，CDP 永远「无到期」· C8 OutStake 全改动作表述，FAQ 不复用品牌问答，OB 不改 · C9 解锁/结算原子口径（一笔交易，失败保持锁定可重试，无中间态文案）。

### 补充裁决（11E 签字前，2026-09-17）

- **R-07 路由更名**：`/pol` → `/yield`（收益）——用户裁决「就叫 yield 吧」；earn/vault 弃用（vault 撞 YieldVault 收益库）、leverage 覆盖不全。§4 `features/pol` 代码目录不随改；本文历史条目中的 /pol 为当时路由名，不回改。
- **勘误（深审，2026-09-17）**：PD-09/C4 裁决时 Agent 提供的依据称治理周期 CYCLE_DURATION 为「部署时可配置参数」——经基线 spec+代码核实为**合约常量（v1 固定 90 天，GovernanceCycleIncentivizerUpgradeable.sol:25）**。裁决意图（UI 读链显示真实值、不硬编码文案）不变并保留；「按 Verse 配置各异」的表述作废。已同步 verse-governance/glossary/invariants/routes.json。

### 术语表

全部新造词确认；修正一处：「抵押参与」→**「质押参与」**（用户：「更通俗一点，stake」；与 OB「创世质押」同词根；en=Stake）。机制词不上 UI：Kernel/会话/open-term/PSM/CDP/SY/EwVWAP/Permit2（界面只说「授权」）。

### 架构修订（本窗口内，均用户授权）

§2 `/portfolio` 行（删跨链消息/交易历史）+ §2 `/` 行（落地页定位）+ §2 全局交互面通知中心标注 v1 延后；均已记入 architecture §21。

- 签名：approved by Jasonrale（阶段 2 步骤 5 逐项会话裁决，2026-09-17）

## 决议 008 · 治理工具外置 Tally + 老版 demo 参考采纳（2026-09-17，11E 签字前）

- **治理创建/执行走 Tally**（用户裁决）：Outrun v1 不自研治理工具；「创建提案」「执行提案」在 Tally DAO 完成（外链），DApp 治理页保留浏览/投票/触发结算/领取激励/国库，并从链上回显创建与执行结果（「已执行」为显示态）。红队修复轮（self-review-03 F1）新增的站内创建表单/执行按钮作废（superseded）；routes.json R-09 tx 由〔提案/投票/执行〕改为〔投票〕。Tally 域名与 CSP 依赖登记 pending-manifest（阶段 4）。architecture §2 治理行文字仍真（提案/执行状态为展示项），不需修订。
- **老版 demo 详情页参考**（用户：可参考、勿直接模仿，功能已大不同）：捕获 demo.outrun.build/memeverse/26/detail → `docs/design/references/product-ux/PU-000d-detail-desktop.png`（sha256 前缀 0091d8c2）。结构参考采纳=统计胶囊行/价格+24h 涨跌/滑点默认 0.5%+Max/社交图标行/CA 复制（恰为市场对标 M1/M2/M3/M5 的自家先例）；老版「Liquidity/POL/Yield/DAO 内嵌详情页 tab」IA 不采纳（维持独立子路由裁定）。
- **M1-M5 全部采纳**：依据=用户 demo 指向（隐含认可，11E 抽查可否决）+市场实证+老版先例；M4 为 PD-02/PD-10 承接补全。次优先 6 项登记阶段 3。
- 签名：approved by Jasonrale（2026-09-17 会话裁决）

### 补充裁决（用户复核，2026-09-17）

- **F2 黄昏区**：推翻保守禁用——截止已过但阶段推进未触发时，链上仍 Genesis，参与面板**保持可用**（「仍在创世阶段」即产品逻辑），提示「参与仍计入成功判定」+「触发阶段推进」入口高亮。发现页「待推进」末位排序保留。
- **M4 已否决撤回**：已完成交易持久历史不显示（用户：非产品功能、无实际意义）。全局交互面维持「在途/待确认卡」；PD-02/PD-10 中「交易历史归全局交易中心」收窄为「执行中交易跟踪」。
- **滑点-费率口径**：费率（当前 1% base+动态）在报价内一次扣除、无 fee-on-fee（swap-flow.md:49-66、uniswap-v4.md:70），滑点 0.5% 阈值作用于费后到账量，不被费率占用；其覆盖对象=报价→执行间的价格漂移与动态费状态漂移（开池衰减期预填更高默认的依据）。已写入 verse-trade 滑点行。
- **老版 board 发现页参考**（用户：按不同阶段展示不同信息，仅参考）：捕获 `docs/design/references/product-ux/PU-000e-board-desktop.png`+渲染 DOM。采纳=发现页按阶段 tab 明示字段集（创世中=双口径进度+距截止；锁定中=解锁时间+距解锁；已解锁=价格+涨跌+交易热度）；不采纳=Normal/Flash 模式切换、创世期 Market Cap 展示。
- **M5 明确确认**（2026-09-17）：创建表单社交链接选填（Website/X/Telegram）维持落地；M1/M2/M3 同轮复核未否决，维持采纳。市场对标五项处置闭环（M1/M2/M3/M5 采纳、M4 否决）。

## 决议 009 · v1 触发模式：前端 permissionless 入口，不建 keeper（2026-09-18，用户裁决）

- **裁决**：v1 不建运营 keeper；链上全部触发口（三种 `changeStage` 迁移、手续费分发、治理 `finalizeCurrentCycle`）由**前端 permissionless 入口**承接，用户/利益相关者触发。
- **激励闭环依据**（讨论已核）：Genesis→Refund（参与者拿回本金）/Genesis→Locked（资金变 LP/POL）/Locked→Unlocked（解锁赎回+swap 恢复）均为利益相关者强动机；费分发有 0.25% 执行者奖励自持（lifecycle.md:75，pending 费托管不没收——settlement-and-fees.md:59-70）；治理 finalize 由领取人自触发（划拨三条件缺一不划——governance-yield-details.md:332；不触发则周期不推进、领取窗口不关闭——:337）。
- **长尾滞留风险已接受**：无人触发的 Verse 停留在过期状态——保护窗锚定 changeStage 交易时刻（非 unlockTime）、费 pending 无衰减、finalize 窗口无上限，均为延迟无损失。
- **前端入口落点**：verse-overview.md「触发阶段推进」（黄昏区高亮）+「触发费分发」（可触发状态+预估奖励）；verse-governance.md 周期激励卡「触发结算（任何人）」。
- keeper（分链策略：便宜链全跑/主网轻迁移）作为**未来运营选项**登记，不进 v1 范围。
- 签名：approved by Jasonrale（2026-09-18 会话裁决）

## 决议 010 · 重开审美设计窗口：回到上轮 v0 产出后的节点重做视觉锚定（2026-09-18，用户裁决）

- **背景**：阶段 3 步骤 1 的 v0 全页面初版观感被用户判「和阶段 1 示例页不一样、审美太保守」。诊断：D1 方向与 token 链完整，但决议 001-A「去极客修订」压缩了终端质感，叠加产品页密度与决议 005（示例页=视觉载体≠产品 UI），初版观感收敛过度。
- **裁决**：重开审美设计窗口——回到上一轮 v0 design-review 任务完成后的下一步（方向/强度选择→蒸馏 DESIGN.md/tokens/契约）重做；**决议 001-A 的去极客强度重议**（方向本身仍是 D1 暗端信号台家族：黑底/黄主光/品红回声/青 focus 不变）。生成强度分档供用户选择。
- **不动**：阶段 2 全部 UX 产物（13 brief、routes.json、state-catalog、glossary、fixtures、决议 007~009）；可读性红线中的无障碍部分（对比度/focus/键盘/reduced-motion/tabular-nums）维持；决议 005「示例=视觉载体」语义维持。
- **链路影响**：重锚定后 DESIGN.md/tokens.css/契约变更 → 阶段 1 manifest 重出+handoff 重签；decision-log 变更 → 阶段 2 冻结链同步重出；stage-3 v0-input 包（manifest 944a2551…）作废待重建。UX 产物 hash 不变。
- 签名：approved by Jasonrale（2026-09-18 会话裁决）

### 决议 010 勘误与收口（2026-09-18）

- **诊断勘误**（用户纠正）：初版「保守」的根因**不是去极客化走错**——去极客方向（消费产品信息结构）正确且保留；错在执行把**复古未来主义风格做弱了**。本次修正=复古未来主义强化，非撤回去极客。
- **新锚定证据**：用户在 v0 会话 outrundapp-2（chat Hx801oxBK6Z）迭代完成，部署 `https://outrun-phi.vercel.app/`；Agent 捕获桌面/移动截图（`review/v0-revisions/r10-aesthetic-*.png`）+ 部署 CSS 提取（`review/r10-css-extract.css`），revision 已登记 round-00-revisions.json（r10）。
- **蒸馏结果**（DESIGN.md §1/§4、tokens.css、token-contract.md、motion-and-a11y.md 同步）：签名层七件=HUD 青网格（44/22px 双层）/品红错位回声轨（侧栏+标题条 -72px 位移回声）/CRT 扫描线（3-4px·2% 白 screen）/信号脉冲（steps 1.4s）/斜切体系（UI 8px+大卡 12px 双角）/glow 分层开关（`[data-glow=on]`，off 全站 AA）/CTA 品红内衬+青 protocol 芯片。渐变禁令例外收窄为签名纹理层；去极客结构（等宽仅数据/无终端符号/人话文案）不变；可读性红线全部维持（纹理 alpha ≤9%，叠层不参与文本对比）。
- **斜切上限修订**：001-A「≤8px」→ 010「UI 8px+大卡 12px 对角双切」（r10 实测 KPI 卡 12px 双切成立）。
- **链路**：阶段 1 manifest/handoff 重签 v1.4.0；decision-log 变更牵动阶段 2 冻结链重签 v1.1.0；v0-input 包重建；阶段 2 UX 产物 hash 不变。

### 决议 010 审计修正（2026-09-18，用户要求自查）

对 r10 部署 CSS 全量对账后发现并修正：**① 字体身份遗漏（重大）**——r10 已定终选字体：display=Saira Condensed（窄体 600/700）、body=IBM Plex Sans、data=IBM Plex Mono、中文 Noto Sans SC（next/font 自托管）；原蒸馏误保留 Archivo/Public Sans 临时栈。D2/D3 遗留字体变量（Outfit/Inter Tight/JetBrains Mono/Space Grotesk/Source Sans 3）无消费者，不采纳。**② alpha 换算错 3 处**——网格外层实为 #00f0ff09（≈3.5%，误写 9%）、内层 #00f0ff06（≈2.4%，误写 6%）、品红洗色 #ff06b50e（≈5.5%，误写 6%）；tokens 改用部署精确 8 位 hex。**③ 漏收签名元素 5 项**——斜切中档 10px（表格/卡片容器）、卡片青 tinted 描边 #00f0ff38+KPI 顶缘青 inset 光 #00f0ff2e、KPI 卡面 #14141Ce0、CTA hover 亮黄 #FFF45C、斜杠分隔记号（5px+12px 斜切端）及 tab 顶部黄线/生命周期黄 inset 条。**④ 误述 2 处**——protocol 芯片为 skew(-8deg) 平行四边形（非斜切角）；导航斜切实测 7px（≤8px 档）。注：部署正文色继承 --foreground #FAFAFA，冻结 token --color-text #E6E9F0（15.14:1 实测）保留不改（同族近似且对比更优）。修正后阶段 1 manifest/handoff v1.4.0 hash 重出；v0-input 包重建。

## 决议 011 · v0 产出范围缩减：3 代表页+设计系统，其余 Agent 仓库实现（2026-09-18，用户裁定·成本）

- **裁定**：v0 成本过高，其产出止于 3 个模式代表页（Verse 详情/发现页/首页，另含设计系统实现）；其余 8 条路由、应用壳、全局交互面与全部工程化由 Agent 在仓库内直接实现。
- **runbook 偏离登记**（stage-03 步骤 1）：原「v0 生成 11 路由全页面初版+完整导出」修订为「v0 产出 3 代表页+设计系统作为视觉/结构参照；`v0-export` 范围=该产出；11 路由全页面由步骤 2-4 在仓库完成」。步骤 1 完成标准中「v0 预览显示 11 条路由」相应改由「仓库实现+步骤 8 三浏览器矩阵」满足。
- v0-input 包角色不变（真相束），visual-anchor 依旧有效。
- 签名：approved by Jasonrale（2026-09-18 会话裁决）

## 决议 012 · 追认 v0 会话「细节精修设计系统」（2026-09-19，Agent 提请·用户授权迁移即追认）

- **编号消歧**：v0 会话内自编号「011 细节精修」与本日志决议 011（v0 范围缩减）撞号——v0 的精修追认为**决议 012**，历史引用已在迁移时统一改口径。
- **追认内容**（产出=v0 repo HEAD c14bf77）：①DESIGN.md §3.1 组件视觉语法五层（Shell/Signal panel/Data surface/Action control/State）+签名 8「精修纪律」（环境层低对比/结构层一处一强调/数据层零 glow；霓虹线收敛为黄 2px 主信号+品红 1px 错位回声，`--line-accent`/`--line-echo`）；②CTA/生命周期品红内衬 3px→2px；③`--label-tracking` 0.045em；④component-contract §11-13（LifecycleTabs/EconomyCard/PageIntro/StageTabs/SectionHeading 契约）；⑤可执行设计系统目录 `docs/design-system/`（6 文件：README/foundations/components/patterns/copy-and-i18n/agent-workflow——真相源层级+任务导航+Agent 工作流）。
- **深审补充吸收**（本轮 Review 发现的遗漏）：§11-13 契约与 docs/design-system/ 首迁时漏收，现已补齐；v0 移除 shadcn/tailwind.css 依赖后，组件所需的 7 个 data-* custom variants 已内联进 globals（附来源注释）。
- v0 的 DESIGN.md/PRODUCT.md 其余内容与我方冻结真相一致（PRODUCT 0 diff；DESIGN 仅上述精修+一处 mojibake 由本地正确文本保留）。
- 签名：approved by Jasonrale（2026-09-19「剩下的工作你来干吧」+「按照最佳实践迁移」授权范围内的迁移追认）

## 决议 013 · 字阶全量上调（可读性，2026-09-20，用户裁定「全部执行」）

- **背景**：首页全量文本节点审计（1440px 实测）发现三档问题——机制区 capitalLabel 11px 低于 001-A 硬线；参与路径卡描述 12px 低于硬线（6 处阅读文本）；正文 14px 合规但低于业界舒适值（16px）。
- **裁定**：用户对 A（违规修复）/B（正文上调 16）/C（标签 11→12）三档方案批复「全部执行」。
- **新字阶**：`--text-xs` 11→12、`--text-sm` 12→14、`--text-base` 14→16、`--text-md` 16→18（保持与 base 层级差）；lg 20/xl 28/num-lg 22 不变。全站密度随之下降一档。
- **附带修复**：`.home-mechanism__sources > strong`（capitalLabel 长句）由 xs 改挂 sm；token-contract.md 第 9 条硬线同步改写。
- **001-A 关系**：001-A 定义的「中文正文 ≥14px」硬线保留为下限语义，基准由 013 上调至 16px。

## 决议 014 · 顶栏地平线签名重设计：几何化错位回声 + 连接态点火（2026-09-21，用户授权「最优雅最不无聊就怎么修」）

- **背景**：`.product-topbar::after` 原为「青 128px + 品红 -72px 位移箱影」同线拼接——两段同亮度、同扫描线、硬拼缝，被用户反馈"像设计一半"；右端锚点（space-7）与钱包按钮右缘（space-5 padding 缘）错位 24px。
- **重设计**（母题不变——错位回声仍是品牌签名，改其几何执行）：
  1. **青信号渐变消隐**：右端锚定 `--space-5`（= 顶栏 padding 缘 = 钱包按钮右缘），`linear-gradient(to left)` 自 `--or-cyan` 全亮经 42% 至透明——衰减即终点，不再有生硬端头；连接点=光源的隐喻。
  2. **品红回声几何化**：`::before` 下移 1px 扫描线（`calc(-2 * var(--line-echo))`）+ 左移滞后 `--space-6`、长度减半、52% 透明度渐变——真色散的"异扫描线残像"，消除同线拼缝；`--echo-offset` 的箱影用法在本元素退役（`.ax-echo-bar` 标题条暂保留原执行，待后续统一）。
  3. **连接态点火**：待机（未连接）= 64px 暗轨（opacity .4）无回声；连接后青线延展 `--space-8×4` 全亮 + 回声浮现，`--motion-base/--ease-out` 过渡（reduced-motion 下 transition:none）。状态源为钱包控件 `aria-pressed`，经 `:has()` 上探，零 TSX 改动。
  4. **断点**：≤54rem 锚点随顶栏内边距缩至 `--space-3`，动作区补 `margin-inline-start: auto`（与 30rem 一致，修旧版动作区悬空）；≤30rem 点火长度减半。
- **验证**：tsc/prettier 通过；agent-browser 1280/860/390 双态 + /zh 390 截图，DOM 实测按钮右缘=padding 缘（848/378）与线端重合；首轮视觉审 1280 双态 pass，二审确认对齐。
- **token 影响**：无新 token；`--echo-offset` 仍有 `.ax-echo-bar` 消费，不删。
- 签名：用户 2026-09-21 会话内明确授权 Agent 自行定案（「你觉得最优雅，最不无聊的设计该是什么就怎么修」）

## 2026-09-25 · 杠杆术语：债务额度（Debt quota）→ 借贷资金（Borrowed funds）

- **范围**：杠杆创世 UI 文案（表单实时预览、审阅屏出行；`copy.ts` `leverageDebtQuota`/`leverageDebtPreview` en+zh）。非品牌方向变更，Agent 据用户裁定执行后留痕。
- **决策**：OB 原词 debt quota 的「额度/quota」暗示未使用的配额，与机制语义不符——参与时即全额 mint 注入创世，是用户已产生、已使用的借贷资金。UI 改称「借贷资金 / Borrowed funds」；**机制口径与代码标识符（debt quota、Debt quota=interest÷rate 公式）不变**，「债务上限（Debt cap）/剩余可建额度」家族不动（那里才是真正的余量语义）。glossary.md B 节对账行同步。
- 用户原话要点：「Debt quota 的命名更像是一个未使用的额度，但是现在不是未使用的东西啊，而是用户已产生的债务，已使用的借贷资金」；前一轮已提出「站在用户的角度，这应该是借贷的资金」。
- **验证**：tsc/prettier 通过；杠杆审阅屏浏览器目检（利息金额+借贷资金两行）。

## 决议 015 · 品红分层管辖：平面禁令改三层（2026-09-25，用户裁定「执行」）

- **背景**：决议 010/012 将品红定为「错位回声」并写成对品红的全球无条件管辖，但系统演进中品红已被数据语义层合法使用（生命周期 locked 阶段色、POL 仪表名义 datum 等），条文（配对回声）与实际（发丝级独立强调）漂移，合规长期靠变通维持（datum 只能做 1px 构造体操即例证）。用户裁定：该纪律限制创作自由、适用面太大、不合理。
- **诊断**：规则诞生于品牌铬层且在该层有效，但被写成平面禁令后蔓延到它没有管辖依据的数据语义层——信息设计中品红的合法性来自语义分工与可辨性，与「回声配对」无关。规则需要不断豁免/追认/变通才能维持，合规成本本身即规则形状错误的信号。
- **决策**：平面禁令改为**三层管辖**：
  1. **品牌铬层**（产品壳、签名元素、CTA chrome）：维持现行纪律——1–2px 错位线/内衬、小徽章、≥20px 大字或图形；
  2. **数据语义层**（`data-stage` 阶段色、图表系列、仪表 datum 等语义标记）：按数据层规则管辖——语义全站一致（locked 恒品红）、对比达标、数据墨水克制但**允许面填充**（图表系列、阶段徽章按数据编码需要）；不要求回声配对；
  3. **营销叙事层**（营销壳、hero、活动页）：最大自由度，品红大字/图形/渐变时刻允许，逐例人工过。
- **全层禁令保留**：正文与小字号禁用（对比 5.19~5.89:1 档）；不与黄（主行动）青（功能）争语义；禁三色同填同一控件。
- **效力**：修订 010/012 品红条款的**适用面**（回声签名保留于铬层，不废除；同日「按钮边缘统一」决议中按钮底缘不再用品红回声的既成事实不受影响）。同步 DESIGN.md 不变项/色彩表/Action control 行、token-contract.md 第 3 条、docs/design-system/README.md 硬约束 #4、.agents/skills/outrun-design-system/SKILL.md。v0 侧同名 skill 需人工同步（不在本仓管辖）。

## 2026-10-01 · 信号失真凭用户提示词重做落地（`.ax-fault-title`，新会话执行）

- **背景**：用户携回滚后固化的全新提示词开新会话重做。口径：静态层=青/品红双色错位虚影（黄不参与、不引入红绿）；动态层=赛博朋克信号故障美学（像素撕裂/色彩分离/扫描线噪点/滚卷抖动黑屏），关键是「突然花掉」——短促爆发其余完全干净，失真必须成体系，文字主体不能乱飞；技术路线授权 Agent 自设计，排版神圣不动。
- **决议**：新类 `.ax-fault-title` + `__dup`（aria-hidden 空载体 span），副本文本走 `data-dup` + `content:attr()` 伪元素——**零重复 DOM 文本节点**（读屏/选中/SEO 均无副本，较前四轮的实体 span 副本更干净）。静态层=青/品红 0.06em 对角错位 text-shadow（与 `.ax-glitch-text` 同值同形制；create 页由其双类规则 0-2-0 重申同值，动效类只补 position 锚点）。动态层=**一套失真例程**（回应「有逻辑性」裁定）：通道失谐 3 帧（±0.09→0.13em+换位）→ 扫描带撕裂下扫（带位自上而下=滚卷读法，translateX ≤0.07em + scaleX ≤1.4）→ 同带双色反移色闪（锚定于文字的「色块」，不设随机散块）→ 单帧黑屏 70ms（白核唯一变化=opacity，**transform 全程锁定，字母永不飞、主体永不晃**）→ 0.4 残影回锁。10s 周期两爆窗（主窗 1.4s 起 0.7s 弧 / 微窗 6.3s 起 0.21s 弧），70ms 帧 `steps(1,end)` 硬切，间隔 4.3/3.6s 不规则，静默期 ~93%。熄灭纪律：每窗末帧显式还原 opacity/transform/clip-path 三件套；动画仅在 `prefers-reduced-motion: no-preference` 内声明（叠加 tokens.css 全局策略双保险）；副本基态 opacity:0 + text-shadow:none + pointer-events:none + user-select:none——e2e animation:none 与 reduced-motion 下只剩静态 echo。
- **实现坑（新）**：create 页 h1 在 flex 收缩下盒宽 172px ≠ 文字宽 470px（居中溢出），副本 transform-origin 锚盒缘会把 scaleX 后的溢出文字甩出 ±100px（首版实速帧可见）——改 `transform-origin: center`（单行/折行/溢出三种盒型下都与文字中心重合）后收敛为 ±70px 内锚定拖丝。
- **验证纪律（10-01 回滚条要求全履行）**：① 静态闸 tsc/check:design/prettier 全绿；② WAAPI `getAnimations({subtree:true})` pause+currentTime 定相位，10s 每 35ms 采样 286 点断言 0 违例（静默期副本全隐/白核满亮、黑帧恰 70ms、副本最长连续可见 630ms、周期接缝一致；禁 animationDelay 遵守）；③ 克隆节点 11 相位胶片条逐相人工读弧（分离→撕裂→黑→回锁→微闪）；④ **实速录屏硬门槛**：ffmpeg 逐帧亮度/色度统计定位爆窗（explore 页主窗 21 帧=0.7s、黑屏 3 帧≤100ms、爆后干净 4.3s 与帧表吻合），explore 与 create 双页各录 13s（>全周期）实速观看——爆窗短促、无字母飞出、闪烁成体系；⑤ en/zh × 三页截图过目（zh 直接走 `/zh` 前缀）；⑥ e2e 基线再生成（explore ×3 视口 + zh-explore mobile 实际写入，portfolio/launch 静息差 <1% 容差内；全套 21 passed）。
- **登记**：components.md 新增「标题信号失真」条目；motion-and-a11y.md 装饰动效两枚→三枚、infinite 禁令加标题失真例外。
- **token 影响**：无增删。

## 2026-10-01 · PD-07 勘误：发现页阶段 tab 无「全部」「退款」（用户裁定「全部 tab 是错误的，无法查看全部」「退款 tab 也是错的」）

- **背景**：管线评审引 PRODUCT.md 路由表「阶段 tab（创世中默认/锁定中/已解锁/全部）」提议补「全部」tab；深审补记另有「退款」tab。用户裁定两者皆错。
- **决议**：发现页阶段 tab 仅三个——创世中（默认）/锁定中/已解锁。阶段为分组维度、不跨阶段混排，无「全部」视图，跨阶段浏览仅经搜索（搜索词存在时越过阶段过滤）；退款态 Verse 的动线由 Portfolio 页承接，发现页内经搜索可达。三 tab 实现自始正确，无需改代码。
- **文档同步勘误**：PRODUCT.md 路由表 #3；`docs/page-briefs/product-intent.md`（R-03 段）；`docs/page-briefs/memeverse-discovery.md`（阶段 tab 行、排序切换行、URL 状态、fixture 覆盖注记）。连带清理：`copy.ts` `common.stages.all`（en/zh）为不可达孤儿键，经批准删除；`stages.refund` 保留（StageBadge 退款徽章在用）。
- **token 影响**：无增删。

## 2026-10-01 · 首页证明带 KPI 数字豁免等宽红线（用户裁定「选B」）

- **背景**：评审发现 `.home-proof-band__item strong`（app/globals.css）以 `font-family: var(--font-display)` 覆盖 `[data-numeric]` 的 `--font-data` 等宽规则，证明带三个数字（Total value locked 19.69M / Deployed economies 20 / Participants 3）实际渲染为 Saira Condensed 展示体，违反「数字字段必须等宽 + tabular-nums」红线，且是全站唯一既无裁定注释、又未登记的数字字体例外。
- **决议**：保留现状（评审报告二选一中的 B 案）——证明带数字维持展示体，正式豁免等宽红线。代码不改；globals.css 该规则处补裁定注释（与全站其他例外体例一致），本条即出处。
- **对比证据**：会话内 dev server 实机对比（computed font 实测：现状 Saira Condensed vs 注入等宽预览 IBM Plex Mono，2x 放大截图并排）：等宽版数字占固定宽度、更宽更「仪表盘读数」，营销展示张力下降；展示版与 band 标签同字体、视觉一体。等宽不挤破版式（数字格内居中），差距是气质取舍非优劣。用户在「A 删覆盖服从红线 / B 保展示补登记」间拍板 B。
- **效力范围**：仅首页 `.home-proof-band__item strong` 三个数字；全站其余数字字段等宽红线不变。
- **token 影响**：无增删。

## 2026-10-02 · 决议 016 · Portfolio 四分区重设计（P0-1 兑现 + 五项产品裁定，会话逐项裁决）

- **背景**：管线评审 P0-1——决议 007 PD-02+PD-08 拍板的 Portfolio 三分区只兑现退款（`portfolio-page.tsx` 仅「退款中」一节），副标题承诺与页面交付矛盾；样本账户 verse-001 创世参与 12,000 在整页不可见。本轮重设计经会话逐项拍板后实现。
- **裁定 1（三分区→四分区，修订 PD-02/PD-10）**：①待办 ②资产与跨链 ③仓位与储蓄 ④参与凭证。**跨链功能并入 Portfolio 为页内功能**（发起弹窗 + 在途状态 + 滞留就地恢复），v1 无 /bridge 独立页（PD-10 的 /bridge 路由与「跨链在途→深链 /bridge」出口规则作废；在途/滞留=当前状态可见、完成即隐——「删跨链历史」与 M4 否决维持）。用户原话要点：「跨链功能也应该放在 Portfolio 页面作为一个功能，而不是放在其他的地方」。
- **裁定 2（OutStake 仓位展示 + 叙事互链）**：质押参与创世同笔交易开出 OutStake 仓位（PD-01/PD-03 口径），③区以「质押仓位」展示（机制词 CDP 不上 UI），fixture 新增 `participations.route`（direct|stake）与 `positions.openedFor` 两字段、part-001 改 stake 样本——④创世中行显「质押参与」徽章、③仓位卡显「来自 {verse} 创世参与」，链路闭合。用户原话要点：「用户在通过 Stake 参与创世时会产生 OutStake 的仓位」。
- **裁定 3（PSM 用户面命名「1:1 转换」）**：brief 旧词「面值兑换」否决——「面值」是债券纸面语言且按钮名词化即术语腔；更实际的缺陷是撞词：交易台 CTA 已名「兑换/Swap」（swapTitle），同词必须同义。定名 **「1:1 转换 / 1:1 convert」**（OB psm.md 自用 conversions 语言；UETH↔ETH 非稳定币对，禁「稳定互换」类名）。psm.json 配对数据驱动弹窗（费后到账/额度余量/双向）。
- **裁定 4（待办区判据=「逾期有后果」+ 同类跨 Verse 聚合）**：无截止的可领收益（YT 等）不进①区（情绪寄存器分离——混放稀释紧急信号）；有截止的周期激励与已成熟的收益库赎回**同类多 verse 聚合为单卡、聚合卡显最近截止**（fixture 激励可领 20 verse / 待执行 20 verse，逐卡即爆区）；窗口已过的激励不展示（已并入国库、无动作可做）。④区以「只看可领 (n)」URL 筛选（?claimable=1，发现页 ?stage= 同款）承接明细。
- **裁定 5（布局与页级签名）**：纵向四区全宽序贯（brief §2 桌面两列布局偏离——凭证表 20 行×6+列塞窄栏必然挤坏，形态随内容：待办=卡横排、资产=同构行清单、仓位=异构卡网格+同构表、凭证=阶段分组表）；页级签名=**信号状态行**（页头下四段锚点链接：待办/可领/在途/滞留，语义色点+等宽计数，摘要即导航）。用户原话要点：「站在专业设计师的角度深度思考……高级的审美，恰到好处的布局，清晰的页面可读性与可交互性，以及网站视觉一致性」。
- **fixture 造样本授权（Q2/Q3/Q7）**：新增 `balances.json`（样本账户链×资产余额，11 行）；`usr-vaults` 增 `myShares`；manifest/fixture-hashes 同步重出。三仓库机制口径不变，数值为样本。
- **效力**：PD-02/PD-10 中被本决议覆盖的条目以本决议为准（brief `portfolio.md`/`bridge.md` 的同步勘误待冻结窗口，暂以本条为真源登记）；token 无增删（全部复用既有语义色/间距/切角 token）。
- **验证**：tsc --noEmit / vitest 86 passed / check:design 0 命中 / check-fixture-boundary --source / check-architecture 全绿；agent-browser 计算样式断言（截止色阶边条 #FF5468、单黄 CTA、信号四色点、表格右对齐、移动无横向溢出——grid blowout 已修：`.pf-vouchers__group min-inline-size:0`）；en/zh × desktop/mobile 截图过 presentations:visual-judge 3/3 pass；e2e 视觉基线 portfolio 三档重录后全套 21 passed（a11y 零新增违规）。
- 签名：approved by Jasonrale（2026-10-02 会话逐项裁决：「确认」收口 Q2–Q7）

## 2026-10-02 · 三列卡 zoom:0.8 登记为已知密度妥协（P1-2 登记类收口，用户裁定「做」）

- **背景**：P1-2 评审指出 ≥80rem 三列 `.economy-card` 整卡 `zoom: 0.8`（globals.css 三列断点）比例失调——内部版式按宽卡设计后整体缩到列宽，缩放后字号/间距不对应任何 token 档位，报告将其归为登记类（需人工决议，非顺手小修）。
- **决议**：接受保留，登记为已知妥协。理由：① zoom 使卡头逻辑内容宽 = 列宽/0.8（≈1.25×），是 2026-10-01 卡头 flex-wrap + 严格字形截断修复的配合条件——单独移除会让挤压与换行触发面扩大，移除的正路是三列专属窄卡 token 版式（字号/间距/切角整体降档重排），工程量大，当前不做；② 同轮四方案对比（修复前/报告建议 anywhere 断行+市值省略/现方案/两段式）确认现方案维持，报告建议不采（词内断行排版质量差、市值省略先吃量级字母 B/M/K），两段式候选挂起不改（触发面小：39 卡 fixture 仅 3 张 name 超 12 字形，wrap 逐项换行只掉徽章不掉市值）。
- **效力**：globals.css ≥80rem 断点的 `zoom: 0.8` 保留；后续评审不再将其作为待修复项重复报告；未来若要移除，须走新决议并同步落地三列窄卡 token 版式，禁止单独删除（会加重卡头挤压）。
- **验证**：纯登记，无代码变更；对照演示为 /tmp 独立页（不入库），依据链 = P1-2 台账 + f0563ea（卡头 wrap+截断）+ 本日志 2026-10-01 三条卡头条目。
- **token 影响**：无增删。

## 决议 017 · 收益组合页设计质量轮（2026-10-05 用户拍板单 Q1–Q7 按推荐执行）

用户立场：登记状态≠质量状态——「已有的设计系统不代表就是对的，因为不够高级，不够有质感，不够精彩，不够优雅，不够清晰易读」。逐项诊断（信息层级/材质/排版坡度/节奏/数字纪律）后拍板：

- **Q1 净值 hero**：组合页头新增总价值主读数（`--text-num-xl` 28px mono 新档，唯一消费位）+ 三段分配微条（钱包 `--color-text` / 储蓄 `--color-text-tertiary` / 待领 `--color-success`，3px、零动画零新库，构成明细 sr-only）；口径=钱包+储蓄+金库待领（fixture usdSample/currentPrice 样本折算，`readyUsd` 视图字段）；24h 涨跌数据缺，不做。
- **Q2 面板材质归一**：`.pf-panel`/`.pf-card`/凭证组面板接入「雨夜材质」签名组静态两伪元素（湿边描边+卡面光渗/角洗/噪点+外投影悬浮）；**hover 通电不随入**——数据层零 glow 纪律，行级 hover 已承担交互反馈；待办警报卡保持素面（紧急信号不与材质争）。自身 clip-path 移除（会剪投影与伪元素），切角由伪元素承担（.pol-mint 同解剖）。
- **Q3 表格**：`pf-table` 行高钉 `--row-height-compact` 36px（token 在案未接线，原为 padding 涌现值）；字号经 013 已是 text-sm 14px，无需再动。
- **Q4 KPI 计数档**：全站钉 `--text-md` 18px（pf-kpi 原样，verse 芯片 dd 15px→18px，终结并存）。
- **Q5 标签降噪**：`pf-table` 列头从「大写+间距+semibold」降为 text-xs 次级正常大小写——大写+间距语法只保留面板铭牌行一层，同面板双层大写互抢。
- **Q6 三组节奏**：行动→钱（资产+储蓄，储蓄前移）→仓位（仓位+金库+凭证）；组间距 `--space-9` 96px 新档、组内 `--space-7` 48px、行动组贴页头 `--space-7`；区块标题→首内容统一 16px（撤两处叠层 margin）。
- **Q7 数字纪律**：`formatAmount` compact 分支恒两位小数（min=max=2）——终结 45K/122.83K/2.1K 同列混排；全站生效（explore 卡读数同步重录）。
- **随行卫生**：组头计数档对齐铭牌 text-xs；弹窗触发钮惰性 `size="sm"` 清除（全局桥托平 40px，sm 为死代码）；④凭证组面板化（材质随 .pf-panel，阶段主线改面板首 child `<i>`——伪元素位被材质占用）。
- 登记同步：token-contract §1/§3、foundations §2/§3（含 013 字阶勘误——文档曾滞留 11/12/14 旧值）、components.md Portfolio 各行。
- 签名：approved by Jasonrale（2026-10-05 会话拍板「先按推荐开工」）

### 决议 017 补充 2 · hero 口径如实化与样本量级回归（2026-10-05 用户质询「你确定算的准确吗」→ 按推荐修）

- **审计结论**：算术无误（DOM=公式输出，$530,589,600.61=钱包 390,296,324.00+储蓄 140,292,537.20+待领 739.41），但三处失真：①量级荒谬——balances/usr-vaults 样本按行级视觉密度撰写（125,000 UETH 等），从未按可加总设计，hero 加总后聚焦暴露；②样本折算值给分位精度=伪准确；③"Total Value" 名不符实（不含 CDP 抵押、POL/PT/YT/LP 凭证、页脚 reserve）。
- **决议（按推荐）**：Q1-A=fixture 减值到真人量级：钱包 ≈$59.6K（UETH 9.5/UUSD 13,000/UBNB 15+Credit 族）+ 储蓄 ≈$23.4K（suETH 3.5 份/suUSD 7,200/suBNB 8 份）+ 待领 $739（staking 未动，占比随分母回升 ≈1%）≈ **$83.7K**；reserve 页脚同步减值（USDC 2,500/ETH 0.9/BNB 1.6）保同屏协调。Q2-A=label 改 **Liquid Assets/流动资产**（只承诺钱包+储蓄+待领；扩口径待价源齐再议）。Q3=0 值段不画、舍入 0% 图例项不渲染。
- 随行：manifest 重哈希；staking/positions/pol-positions 不动（verse-21 基线无连锁）。
- 签名：approved by Jasonrale（2026-10-05 会话裁定「按推荐修」）

## 2026-10-05 · 决议 018 · Portfolio 移动端重设计（用户需求「移动端 UI 目前非常差劲，完全重新设计」）

- **背景**：390px 现状=全页纵向单流（旧基线高 8122px），无页内导航；仓位/金库表 `min-inline-size 640px` 靠面板内横向滚动（旧移动基线宽 652px=页面实际横向溢出 262px）；领取表 20 行密集数字矩阵。方案 Q1/Q2 两问用户未答，按计划内推荐执行（计划批准即拍板）。
- **裁定（四项）**：
  1. **导航模型=吸顶分区切换页签**：≤54rem 顶栏下吸顶四分段「待办(n)/资产/仓位/凭证(n)」，一次只显示一个分区（业界组合页移动端通行做法）；KPI 信号带窄视口让位页签角标——「摘要即导航」语义保留、计数常驻可视（016 裁定 5 的移动端承接形态）；激活语法=verse-tabs__bar 同款（黄字+3px 底缘指示条）+ surface-header/blur + stage-tabs 全出血负边距先例；断点范围=≤54rem（与底部导航档一致，tablet-860 随之）。
  2. **仓位/金库表格移动端换堆叠台账行**（`.pf-mrow`：身份行 `--row-height` 44px 触达 + 事实格 dt/dd 储蓄卡同语法、复用列头文案零新键）——修订 016 补充 4「仓位=面板+表格」口径效力=仅桌面（verse 页「≤54rem 表格↔行卡互换」仓库先例）。
  3. **hero 窄视口左锚升页头主读数**（右对齐是桌面双栏平衡语）；领取表/资产行/凭证行两行堆叠节奏维持（既有 ≤54rem/≤30rem 规则）。
  4. **桌面零变化**：deck=透明布局层（页签条 display:none、`.pf-zone-sub` gap=组内 gap 同档保 017 三组节奏）；翻转实验证明新旧结构 1280 渲染逐像素一致（唯一差异=待办卡走秒时钟）。
- **实现要点**：`PortfolioZoneTabs` 客户端组件——分区全常驻 DOM（RSC 直出）、显隐仅 `[data-js]` 挂载后由 CSS 生效（SSR/无 JS 全可见优雅降级）；`#pf-*` 页内锚点（金库 signpost 卡 CTA）由 deck 事件委托接管换区+滚动（隐藏分区无盒模型，原生锚点失效）；`?claimable=1` 深链 SSR 初值落凭证页签；待办空则待办页签不渲染；copy 新增 `portfolio.tabs.*` 五键（en/zh）；零新 token、零新依赖。
- **桌面基线漂移说明（非本改动）**：portfolio-desktop-1280 旧基线 5639px 与实际 5711px 差 72px，翻转实验证明新旧结构渲染一致——漂移源自上一会话 017 补充 2（fixture 减值）后未重录基线；本轮三档基线一并重录。旧移动基线宽 652px 反证旧版横向溢出，新版 390px 归零、页高 8122→2475（默认待办页签）。
- **登记同步**：components.md 新增 deck 行 + hero/KPI/③区行补记；component-contract.md §29（PortfolioZoneTabs 行为契约）。
- **验证**：tsc / vitest 115 / check:design 0 / check:contrast / check-fixture-boundary --source / prettier 全绿；Playwright 断言 33/33（390 无横向溢出、页签切换/默认待办、吸顶 y=65=顶栏 64+1px、`?claimable=1` 落凭证、待办卡 `#pf-vault` 锚点换区、en/zh 页签文案、桌面四分区全显+表格在位+移动行隐藏+无溢出）；移动台账行跨行对齐实测（9 行 dd 盒 left/right 全等共线）；视觉模型评审页签条/角标/下划线/hero 对齐 pass（其报的「±1-2px 锯齿」经盒量测证伪）；e2e portfolio 三档基线重录（changed 模式）后全套 25 passed。
- **token 影响**：无增删。
- 签名：approved by Jasonrale（2026-10-05 计划批准；Q1/Q2 未答按推荐执行）

### 决议 018 补充 1 · ②资产行移动端去按钮化（2026-10-05 用户反馈「Asset 的表感觉布局不优雅，不好看」）

- **背景**：018 落地后移动端资产行仍带行内 Convert/Bridge 按钮换行右对齐 + 链分布数值芯片——按钮壳把行节奏拉乱（行高随链数/按钮数不齐）、链徽+小数字读成数据倾倒（用户截图圈定）。
- **决议（钱包类 App 通行范式：行=纯台账、动作入底部面板）**：移动端行=单线纯台账（链徽 tile ｜ 符号+链徽标行 ｜ 总量 22px+≈$ 副行）；链分布数值与动作全部收进**底部操作面板**——整行 hit 层触发（DaoFundDialog 整卡 hit + 嵌套弹窗同款先例），面板=`.pol-mint` 卡壳 + 链分布 44px 台账行（链标+链名 ｜ mono 金额）+ Convert/Bridge CTA 等宽行。任务弹窗叠在面板之上（iOS 栈式）——**不可点击时收起面板**（嵌套弹窗树随面板内容卸载，收面板会连坐熄灭刚打开的弹窗）；Esc 先关顶层、面板保留承载上下文。桌面 ≥54rem hit 层 display:none、行内按钮照旧——触发器不可双栖，桌面按钮与面板 CTA 为两套独立实例各自开合。
- **新增**：`components/ui/sheet.tsx`（shadcn 清单允许加装的 sheet 手工内联——base-ui Dialog 管线复用：Esc/外点/焦点圈闭/焦点还原，仅锚定改底部+底缘安全区，遮罩槽复用 dialog-backdrop 皮肤，进出场枚举 transform/opacity）；copy 键 `assets.sheetLabel`（en 'Asset actions'/zh '资产操作'，hit 层可访问名「{symbol} · 资产操作」）。
- **验证**：tsc / vitest 115 / check:design 0 / check:contrast / boundary / architecture / prettier 全绿；Playwright 断言 16/16（390 无溢出、行内按钮与链数值清零、行高归一 71±1px、点行开面板、链分布在位、Bridge 叠层打开、Esc 先关顶层面板保留、面板 Esc 可关、zh 标题、桌面按钮可见+hit 隐藏+链数值在位）；视觉模型评审（新版式行距均匀/左右缘对齐/面板贴底/边距对称/无重叠截断均无缺陷项）；e2e 三档基线**零变化**（默认待办页签不含资产区、桌面资产行像素未动）——全套 25 passed。
- **token 影响**：无增删。
- 签名：approved by Jasonrale（2026-10-05 用户反馈驱动，Agent 执行后留痕）

### 决议 018 补充 2 · ③仓位/金库移动行版式修正（2026-10-05 用户反馈「Staked Positions 的表头布局不优雅；Yield Vault 卡片里的内容不优雅，不和谐」）

- **根因**：①仓位铭牌行「Staked position · 9」与 owed 聚合（`425.50 UETH · 219,500.00 UUSD`）同 flex 行硬挤，390 下 owed 中途折断、中点悬空；②金库移动行事实格 `auto-fit minmax(9rem)`——390 落成「份额|年化」+赎回孤格（值+小标签堆叠比兄弟格高，构图失衡），860 平板摊成 4 列留空；③链标 16px 与行文字基线差 2-3px。
- **决议**：①铭牌行 ≤54rem 两行制——「铭牌+计数」一行、owed 聚合独立成行右锚（数字=右缘锚点，族内 nowrap 不变）；②事实格钉死 `repeat(2, minmax(0,1fr))` 两列（auto-fit 弃用——列数随视口漂移是失衡根源），金库赎回状态通栏独占一行（`grid-column: 1/-1`）且值+小标签改内联基线（`1.83K MOON  Ready to withdraw` 一行，消除孤格高度差）；③链标 16→20px、来源名 text-sm→text-md（与金库行 verse 同档）。
- **验证**：tsc / check:design 0 / vitest 115 / contrast / boundary / prettier 全绿；Playwright 断言 14/14（390+860 双档：无溢出、owed 独立行且右缘贴 padding 锚、事实格恒 2 列、赎回通栏左缘=事实格左缘、内联基线 bottoms 差 ≤1px、桌面表格在位/移动行隐藏）；视觉模型评审铭牌两行/两列对齐/通栏层级/整体节奏各项无缺陷；e2e 三档基线零变化（仓位/金库移动行不在默认待办页签截图内、桌面 CSS 零接触）——全套 25 passed。
- **token 影响**：无增删。
- 签名：approved by Jasonrale（2026-10-05 用户反馈驱动，Agent 执行后留痕）

### 决议 018 补充 4 · ④凭证筛选芯片窄屏溢出修复（2026-10-05 用户反馈「右上角的 Claimable only 有点溢出移动端屏幕了」）

- **根因**：`.section-heading__row` 默认 nowrap，④凭证区筛选芯片组（All / Claimable only）与标题同行——390 恰好满格（行宽 366==366 零余量），375 类窄屏直接把 "Claimable only" 推出右缘。③仓位区 2026-10-04 已为同类问题加过「标题行可换行 + aside 限宽」补丁（决议 016 补充 4），④凭证区漏配。
- **决议**：补丁选择器扩入 `.pf-vouchers`（两条规则与仓位区合并书写）；全宽度生效（wrap 仅在内容超行时参与，桌面零影响——仓位区同款先例）。
- **验证**：Playwright 360/375/390 三档——窄屏芯片组换行到标题下方（filter 独立行、右缘 ≤ 内容锚），390 维持同行；zh 375 无溢出；tsc / check:design 0 / prettier 全绿；e2e 三档基线零变化（凭证页签不在默认待办页签截图内）——全套 25 passed。
- **token 影响**：无增删。
- 签名：approved by Jasonrale（2026-10-05 用户反馈驱动，Agent 执行后留痕）

### 决议 018 补充 6 · ①金库 signpost 卡 CTA 折行居中（2026-10-05 用户裁定「移动端这里的 withdraw 按钮需要居中」）

- **根因**：金库可取出卡底栏（hint 句 + Withdraw 钮）≤30rem 折行后按钮独占一行、落在行首——`flex-wrap: wrap` 只管折行不管独行对齐。
- **决议**：`.pf-action[data-kind='vault'] .pf-action__foot > :last-child` 在 ≤30rem 加 `margin-inline: auto`——auto margin 在同行（space-between 无自由空间）零影响、独行时吸收全部自由空间=居中；保护窗卡底栏（KV+按钮同行）不受波及（实测按钮 left 264 同行钉右）。
- **验证**：390 实测按钮中心 195==底栏中心 195、无溢出、保护窗卡零变化；check:design 0 / prettier 绿；mobile-390 基线 `=all` 重录（按钮位移 ~0.37% 低于 1% 容差）、tablet/desktop 零变化；全套 e2e 25 passed。
- **token 影响**：无增删。
- 签名：approved by Jasonrale（2026-10-05 用户裁定）

## 2026-10-05 · 决议 019 · 代币单价格式化改市场口径（用户裁定「确认，按推荐方案来」）

- **背景**：token-strip 价格沿 2026-09-23「toFixed(6) 固定 6 位小数+尾随零缩小灰显」裁定。用户质询移动端灰色尾零可读性（「用户不一定看得懂，市场最佳实践是什么」）。核对市场实践：主流=有效位格式化+裁尾随零（Uniswap/Coinbase/CMC 显 `$0.0042` 不显 `$0.004200`）；极小值下标记零（币安/Capital.com/TradingView/`@haqq/format-number-with-subscript-zeros`：`0.0000042`→`0.0₅42`，下标=小数点后前导零总数）；尾零仅右对齐表格（订单簿）保留，单点价格无产品保留。固定 6 位小数另有精度缺陷：`0.0000421.toFixed(6)` 吃掉有效位只剩 `$0.000004`（当前 fixture ~0.004 未触发，机制上是雷）。
- **方案**：`fmtPrice` 唯一实现（`components/global/amount-format.ts`，无 locale 参中英同形）——≥1 两位小数法币惯例（`$1.20`）；<1 六位有效数字裁尾零（`0.004200`→`$0.0042`）；前导零 ≥4（价格 <0.0001）下标记零（`0.000042`→`$0.0₄42`）。token-strip 落点 `SplitPrice` 只留货币符缩小降级（`__price-sign` 保留），`__price-tail` 类与 CSS 撤销。
- **验证**：`tests/unit/amount-format.test.ts` 新增 fmtPrice 组钉死三档+边界（3 前导零不切下标/进位回落/0 兜底）；tsc、vitest 全套 119 绿、`check:design`、prettier 绿；全套 e2e 25 passed——verse-21=genesis 期无交易台，价格条不在其基线内，零漂移（`=all` 复核无可写）；上屏核验 dev `/memeverse/14`：`$0.00759`，灰尾零 span 消失（受影响 verse 共 7 个：10/14/24/26/29/30/34，均无 e2e 基线页）。
- **token 影响**：无新增；`token-strip__price-tail` 为撤销非新增。
- 签名：approved by Jasonrale（2026-10-05 用户裁定）

### 决议 020 · 移动端顶栏三控件降档 40→36px（用户裁定「移动端这三个按钮的大小可以稍微缩小一点点」）

- **背景**：README §3 #9 控件高 40px `--control-height` 为全局硬约束；≤54rem 移动档顶栏的链选择（`.chain-dialog__trigger`）/语言（`.locale-menu__trigger`）/钱包（`.wallet-control`）三钮沿 40px 在手机档视觉占比偏大（用户截图反馈）。
- **方案**：≤54rem 媒体块内三钮 `min-block-size` 降为 `calc(var(--control-height) - var(--space-1))` = 36px；钱包钮加 `!important` 对冲 `[data-slot='button']` 的 40px `!important` 基线（同 verse 移动档 CTA 先例）；钱包定宽 160px 不动（「图标+截断地址」宽度预算）；桌面档（>54rem）仍 40px。双壳（product-topbar / marketing-header）同享。
- **token 影响**：无增删；`--control-height` 本体 40px 不动，36px 仅移动档局部档位。
- **验证**：Playwright 实测 390px 档三钮 boundingRect 全 36px（钱包 160px 定宽不变）、1280px 档全 40px；`check:design`、prettier 绿；受影响 mobile/tablet 基线 14 张 `--update-snapshots=all` 重录（desktop 三张零变化未触碰）；全套 e2e 25 passed（首轮 2 个 desktop a11y 失败=负载 flake，隔离重跑全绿）；重录后复跑零重写（基线稳定）。
- 签名：approved by Jasonrale（用户裁定）

### 决议 020 补充 1 · 移动档三控件再降 36→32px + 钱包钮删绿点（用户裁定「再稍微缩小一点点，同时连接钱包按钮里的绿色圆点也删掉」）

- **降档**：≤54rem 三钮 `min-block-size` 再降一档 36→32px（`calc(var(--control-height) - var(--space-2))`，卡内中档同档位）；其余口径（钱包定宽 160px、桌面 40px、双壳同享）不变。
- **删绿点**：`.wallet-control` 已连接态的 `.status-dot[data-tone=success]` 实例删除（wallet-control.tsx）；连接信号由顶栏签名线（`:has([aria-pressed='true'])`）承接。`.status-dot` 基类保留（design-system showcase 样张在用）；≤18.75rem 档 `:not(.status-dot)` 选择器随之简化为 `> span`。
- **token 影响**：无增删。
- **验证**：Playwright 实测 390px 档三钮全 32px、连接态无绿点、1280px 档全 40px；mobile/tablet 基线 14 张 `--update-snapshots=all` 重录（绿点不在基线内——基线为未连接态，仅降档像素生效）；全套 e2e 25 passed；`check:design`、prettier、tsc、vitest 绿。
- 签名：approved by Jasonrale（用户裁定）

### 决议 020 补充 2 · 语言钮移动档转纯图标（用户裁定「移动端这个按钮的文案只显示 文/A 的图标就行了」）

- **方案**：≤54rem 档 `.locale-menu__trigger` 仅隐藏文本 span，只留 Languages 图标+chevron（首版误删 chevron，用户裁定「没让你删箭头」后纠正保留）——display:none 不进 acc name，组件 `aria-label=languageLabel` 承接可访问名；原 `white-space: nowrap` 随文本隐藏退役。文本隐藏从 ≤18.75rem 上移为全移动档，极窄档内冗余规则删除、注释改口径。
- **token 影响**：无增删。
- **验证**：Playwright 实测 dev 390px 档语言钮仅剩图标（40×32、可访问名 Language 在位——水合后 span/chevron 均被 CSS 隐藏）、1280px 档文案照旧；e2e 生产构建下 useSearchParams 挂起期本就渲染图标 fallback，像素与基线一致、`=all` 复核零重写（基线无需变更）；全套 e2e 25 passed；`check:design`、prettier、tsc 绿。
- 签名：approved by Jasonrale（用户裁定）

### 决议 020 补充 3 · 顶栏三钮移动档等距（用户裁定「三个按钮之间的间距要相等」）

- **病灶**：≤54rem 右推力（`margin-inline-start: auto`）挂在动作区上，弹性空隙全部落在 链钮|语言 之间（390px 实测 58px vs 语言|钱包 4px）。
- **方案**：右推挪到链钮（恢复基类 `margin-inline-start: auto` 语义），动作区撤 margin-auto；链|语言|钱包间隙统一吃顶栏 `gap: space-2`（动作区 gap 同步 space-1→space-2）；钱包仍是末个 flex 项贴 padding 缘，签名线锚点对齐不受影响。≤30rem 块内重复的 actions margin-auto 一并删除（会把空隙插回 语言|钱包 之间）。
- **token 影响**：无增删。
- **验证**：Playwright 实测 390/320/860px 档链|语言、语言|钱包间距均 8px 相等、零横向溢出（320px 顶栏正好满宽）；`pf-action__clock` 320px 溢出为上一会话页面侧未提交改动遗留，与顶栏无关、不在本决议范围。
- 签名：approved by Jasonrale（用户裁定）

### 决议 020 补充 4 · 钱包钮移动档定宽 160→152px（用户裁定「连接钱包按钮的宽度稍微缩小一点点」）

- **缩量依据**：删绿点（补充 1）富余的预算正好回收——地址「0x1111…0001」实测 110px（IBM Plex Mono 16px），160 档余量仅 4px；直接缩宽会吃掉地址。方案=定宽 `calc(var(--control-height) * 4 - var(--space-2))` = 152px + 内距 space-3→space-2 联动，152 档余量与 160 档持平（4px），地址完整。
- **范围**：≤54rem 双壳统一（高度降档同款 unscoped 手段）；桌面档定宽 160px 不动；≤18.75rem 图标态退 auto 不变。
- **token 影响**：无增删。
- **验证**：Playwright 实测 390px 双壳连接/未连接态均 152px、地址零裁切、三钮间距 8px 等距不变、1280px 档 160px 不动；`check:design`、prettier、tsc 绿。
- 签名：approved by Jasonrale（用户裁定）


### 决议 020 补充 7 · 顶栏高度回调 48→52px + 双壳（营销/产品）完全统一（用户裁定「高度有点小了，可以稍微回调一下；另外所有其他页面的 Header 高度、按钮这些得一致啊」）

- **背景**：补充 6 的 48px 用户反馈偏小；且营销壳与产品壳顶栏此前高度/控件档各自为政（营销 48、产品桌面 56/移动 64；控件营销 32、产品桌面 40/移动 32），跨页不一致。
- **方案**：新 token `--topbar-height: 52px`（tokens.css 密度组）双壳唯一顶栏高——52 = 36px 控件 + 上下各 8px 网格；顶栏三控件（链/语言/钱包）桌面档统一 36px（`calc(var(--control-height) - var(--space-1))`，020 原始档位；供给走基类+≤54rem 移动档 32px 既有级联，删除补充 6 的营销壳私有档规则，杜绝再漂移）；钱包钮宽桌面 160px（基类定宽回归）/移动 152px（020 补充 4 档不变）；`.marketing-header` 纵向零内距改与产品壳同写法（此前 padding-block 8px 致 36+16+1=53px 与产品壳 52px 差 1px）；`.marketing-nav__link` 命中区 36px；字标 96→108.8px 宽（≈28px 高，仍距决议 004 的 96px 下限留量）；`.marketing-main` 视口补偿 calc 换 `--topbar-height`。页面内（表单/CTA 等）控件仍 40px `--control-height` 不变。
- **token 影响**：+`--topbar-height: 52px`（token-contract.md 密度行与家族清单已登记）。
- **验证**：Playwright 实测 1280/860/390px × 营销壳/产品壳（explore、portfolio）九组：header 全部恰 52px、桌面控件 36/钱包 160、移动控件 32/钱包 152、零横向溢出；全套 e2e `--update-snapshots=all` 重录后复跑零重写；vitest、check:design、prettier 绿。
- 签名：approved by Jasonrale（用户裁定）
### 决议 021 · Portfolio 六分区头签名线（青线+品红回声）移除（用户裁定「收益组合页，每张卡上的这条青色与红色相间的线删掉」）

- **对象**：决议 014 的 `.ax-echo-bar` 标题条签名线（`::after` 青渐变线右端锚定 + `::before` 品红回声下移 1px 左移滞后）——Portfolio 页每个分区头（`SectionHeading`）底缘各一条，即用户所指「卡上青红相间的线」。
- **方案**：CSS 作用域退役——`:is(.pf-actions,.pf-assets,.pf-positions,.pf-savings,.pf-vault,.pf-vouchers) > .ax-echo-bar::before/::after { content: none }`；只影响组合页六分区，Verse 详情页/showcase 等其余 `SectionHeading` 签名线不动（已实测 verse 页伪元素仍渲染）。卡片本体「雨夜材质」湿边描边**不受影响**（首轮误删该层，已完整回滚：选择器组、两处注释、components.md 面板原语行均复原）。
- **token 影响**：无增删。
- **登记**：components.md `SectionHeading` 行加组合页豁免注。
- **验证**：组合页分区头区域像素扫描青/品红零命中；湿边描边回位（面板顶缘 B-R≈132）；verse 页 `::before/::after` content 仍为 ""；portfolio 三档基线 `--update-snapshots=all` 重录 3 passed，基线扫描 echo 尺寸（250–500px）青段零命中、湿边行回位；`check:design`、prettier 绿。
- 签名：approved by Jasonrale（用户裁定）

### 决议 022 · 待办警报卡窄卡头行堆叠——本仓首个 @container（用户裁定「移动端，随着屏幕缩小，Liquidity Protection Window 里的内容会被截断，优化这个卡片的布局设计」）

- **病灶**：`.pf-action__head`=铭牌+倒计时 side-by-side，`__clock` nowrap num-lg mono（en「Ends in 15:05:59」≈208px）；卡宽随 auto-fit 列数漂移（1280 三列=329px 反窄于 390 单列=364px、320 档=294px）——≤~414px 卡内铭牌挤成多行、≤~360px 时钟溢出卡缘截断且页面横向滚动。
- **方案**：`.pf-action` 加 `container-type: inline-size`（视口断点管不住卡内布局，按卡片自身宽度裁定；本仓首个容器查询，Tailwind v4 同代浏览器基线内）+ `@container (width < 23.75rem)`（content-box 计，外宽 ≳414px 维持原布局）head 转上下堆叠：铭牌整行不换行、倒计时整行独占——数字仍是主角且更醒目，280px 档卡（内容 246px）也容得下 208px 时钟。桌面宽卡（480 单列 454px 等）side-by-side 语法不变。
- **token 影响**：无增删。
- **验证**：320/390/480/860/1280 五档实测 `overflows:false`、docOverflow:false（修复前 320 档双 true）；320/390/1280 卡头堆叠、480/860 维持并排（content-box 阈值所致，860 两列卡 410px 外宽=376px 内容恰入堆叠档）；portfolio 三档基线 `--update-snapshots=all` 重录 3 passed；`check:design`、prettier 绿。
- **登记**：components.md ①待办区行同步卡头堆叠语法。
- 签名：approved by Jasonrale（用户裁定）

### 决议 023 · Verse 详情页分享功能 + 分享组循环抖动例外（用户裁定「verse 详情页新增分享功能……分享按钮与提示符号是在可快速抖动的吸引注意力」）

- **对象**：verse 详情页传播出口——参照 `jasonrale/Outrun-Frontend`（`memeverse-social-share.tsx` + 详情页分享组）与用户四张截图（双圆钮、带尾提示 tooltip、模态分享卡）。
- **方案**：hero 页头右缘 `.verse-identity__footaside`（社交+分享动作簇）挂「提示符+分享钮」双图标钮——视觉与社交链接钮同族（描边幽灵图标钮、hover 转青）；分享钮开 `.verse-share-pop` 弹窗（`.pol-mint` 壳）：monogram 项目卡 + Copy link（黄主 CTA，✓Copied 1600ms）+ Share on X（outline，twitter intent 随机 1/5 双语推文模板）；返佣说明文案口径=OutrunBook `ecosystem/flywheel.md`（推荐返佣出自协议交易费份额）。
- **抖动例外**：两图标钮 1.5s 循环 ±2.5px 水平抖动（70% 回正、~30% 静默）——motion 契约「infinite 仅骨架/spinner/标题失真」的用户裁定第四例外；`prefers-reduced-motion: no-preference` 包裹（`ax-fault-title` 同款先例）自动停抖，零 glow 纯位移。
- **不接线项**：成交后自动弹分享（参考仓 genesis/stake/claim 触发源）不做——本仓原型 CTA 恒 disabled 不伪造成交；紫粉蓝渐变/圆角胶囊不进站，视觉换皮 token 体系（礼物图形与 JOIN US 胶囊=品红回声 chrome 层；黄主 CTA 唯一留给 Copy link）。
- **token 影响**：无增删（复用 space/text/color 既有 token；`ui/tooltip.tsx` 增 `side` 转发到 Positioner）。
- **登记**：components.md §6 Verse 分享组行；component-contract.md §31；motion-and-a11y.md 装饰动效第四枚 + infinite 白名单。
- 签名：approved by Jasonrale（用户裁定）

### 决议 023 补充 4 · 分享弹窗二轮精装：字标 Logo + 项目卡接雨夜材质（用户裁定「还是不好看啊，而且 logo 换成字母 logo」）

- **Logo 换字标**：`BRAND-04-symbol` → `BRAND-01-wordmark-transparent.png`（字母 logo，kicker 位 96px 宽=顶栏 157px 的约 6 折；成品纪律沿用）。
- **项目卡重做**：补充 3 的 worklet tint 画皮退役（实测盒中盒+平 tint 显浑浊），接入「雨夜材质」签名卡静态两伪元素（材质组选择器扩编 `.verse-share-card::before/::after`，同 017 数据面口径不随 hover 通电）；monogram 缩略位 40%→32%、raised 无边软板；meta 列组距 4→8px；弹窗 420→460px 档——420 档 meta 列被挤到 183px 是上一轮「不好看」的主因（实测放宽后 237px）。
- **token 影响**：无增删。
- **验证**：双档构图量化探针（meta 237px/无横向溢出）+ 截图目检；`check:design`、tsc 绿；verse 三档基线 `=all` 重录。
- 签名：approved by Jasonrale（用户裁定）

### 决议 023 补充 7 · Share2 分享图标退役，单礼物钮兼任分享按钮（用户裁定「干脆把分享图标删了，礼物图标作为分享按钮」）

- **方案**：hero 分享组收敛为单颗礼物钮——`TooltipTrigger` 经 `render` 直接披在 `DialogTrigger` 上（base-ui 组合范式，悬停/触点出随机促销语气泡、点击开分享弹窗，一颗钮两触发器）；Share2 glyph 与 `__hint` 类退役，`__button` 独享幽灵钮样式+抖动+16px glyph（Gift）；aria-label=shareLabel。
- **孤儿清理**：copy `shareHintLabel`（en/zh）随提示符独立身份消失退役。
- **弹窗标题行**：礼物=返佣说明 tooltip 触发器不变（补充 6 口径）。
- **token 影响**：无增删。
- **验证**：探针断言悬停气泡（促销语）+点击开弹窗+Esc 关闭链路；`check:design`、tsc 绿；verse 三档基线 `=all` 重录。
- 签名：approved by Jasonrale（用户裁定）

### 决议 023 补充 10 · 全站扫描线层提升 body 级，弹窗与页面同一张膜（用户裁定「这些卡片不能用同一个组件吗？你自己单独写的很乱」）

- **纠正**：补充 9 的机制诊断对了一半（横纹真身=全站 .ax-scanlines，非 canvas grid）但药方错了——卡内塞局部副本=双重曝光（弹窗整体平的、唯独内卡一层条纹，贴感强烈），用户驳回「比草稿都难看」。
- **方案（单一组件）**：`.ax-scanlines` 从壳层末尾（app-shell 两分支各一）提升为 `app/layout.tsx` body 末尾唯一实例——body 级 z-overlay(1000) 盖住包括 dialog portal（z-50）在内的全部内容，页面与弹窗吃同一张膜；卡内局部副本 `__scanlines` 整体删除；内卡皮肤回归材质组同款规则零自定义（「用同一个组件」的字面落地：横纹一个组件、材质一组规则）。
- **影响面**：原先不吃膜的无壳路由（design-review 等内部工具）现在也吃膜——「全站层」名副其实；页面像素应零漂移（同一绘制结果，仅挂载点移动）。
- **token 影响**：无增删。
- **验证**：探针双点位（弹窗标题带出现 4px 周期膜、内卡单层膜与标题带同幅）+ e2e 全量（基线预期零重写）；`check:design`、tsc 绿。
- 签名：approved by Jasonrale（用户裁定）

### 决议 023 补充 13 · 分享弹窗推倒重做：单一环境光 + 安静凹板（用户裁定「之前的改动要撤销……深度思考完全推到重做，专业设计师角度，设计感/和谐/优雅」）

- **诊断**：弹窗杂乱根源=表面过多且各自为政——壳与内卡双层材质面板（盒中盒双切角）+ 补充 11/12 两层补丁洗 + 暖紫 thumb + 青边 X 钮：460px 内 6 种表面、4 种色相，无主次。
- **撤销**：补充 11/12 全部补丁（壳底 30% 洗、卡底 26% 洗、thumb 18% tint、X 钮 raised 面板）删除。
- **重做（one stage, one spotlight）**：
  1. **舞台唯一**：弹窗壳仍是全站签名「雨夜材质」面板，其上叠一盏平滑环境灯——低位深品红极淡升起（`--logo-magenta-dark` 12% → 50% 长尾消隐）：全弹窗均匀打亮、无死黑下半、无可见洗带（对照被撤的 30%/38% 短带）。
  2. **内卡退位**：退出材质组（wet-edge/切角/实底面板全去），改安静 inset 凹板（`--color-surface-inset` + hairline）——杂志引文块式内容容器，与壳零竞争；thumb 回中性 raised + hairline。
  3. **色相收敛**：全场只剩品红（gift/symbol 回声/JOIN US 三处小面积签名）+黄（Copy link 唯一主 CTA）+中性灰阶；X 钮显式锁灰（`--cb-bg: transparent` + `--cb-border: border`）。
- **token 影响**：无增删。
- **验证**：双档截图目检（单层舞台+凹板+色相收敛成立）；`check:design`、tsc 绿；e2e 全量 25 passed 零基线重写。
- 签名：approved by Jasonrale（用户裁定）

### 决议 023 补充 14 · 卡内布局二轮：symbol+name 同行、thumb 边长随右列高（用户裁定「name 和 symbol 放在同一行。左边的图片保持正方形，边长得和右边的文本区域高度对齐」）

- **方案**：① symbol+name 合入 `.verse-share-card__idrow` 基线行（`align-items: baseline`、gap-3）；② 卡容器 `align-items: stretch` + thumb `flex: 0 0 auto; align-self: stretch; aspect-ratio: 1`——正方形边长由 stretch 高度（=右列内容高）经 aspect-ratio 反推宽度，thumb 下方空白消失。
- **token 影响**：无增删。
- **验证**：双档 boundingBox 实测 thumb 156×156 与 meta 列 y 区间逐像素重合（390/1280 同值）；`check:design`、tsc 绿；e2e 清掉中断遗留的残留 4188 server（pid 1524776，档案 e2e-stale-server-poisons-baseline 的污染源）后全量 25 passed。
- 签名：approved by Jasonrale（用户裁定）

### 决议 023 补充 15 · 内卡 Premium dark 三件套（用户裁定「卡片背景纯黑灰色，太无聊……更优雅更高级，但不光污染」；研究 Linear/Vercel 配方后 token 化）

- **研究**：业界 premium dark 卡配方（[csstools.io neumorphism 亮度守则](https://csstools.io)、[snippets.heymitul.com Linear/Vercel 式渐变描边+inset 阴影](https://snippets.heymitul.com)、[codefronts.com 双 background-clip 渐变描边](https://codefronts.com)）收敛为三件套：低强度面内渐变、渐变描边（上亮下暗 1px）、顶缘受光（白 3–6%）。
- **方案（全 token，零新增）**：① 卡面 `linear-gradient(180deg, raised → 混 12% --logo-magenta-dark 的 surface)`——底部呼应壳层环境灯色相（同一 token 同一档），无带；② 渐变描边=双 background-clip（padding-box 面渐变 + border-box `border-strong→border` 描边渐变，border: transparent）；③ 顶缘受光 `inset 0 1px 0 var(--scanline-white)`（2% 白 token 守 3–6% 区间下沿）；④ thumb 对角渐变（raised→inset 160deg）+ 顶缘受光 + monogram 转 text-secondary（灰调更收敛）。
- **对照**：上一版纯 inset 平板（补充 13）→ 有受光维度的暖调面板；品红只以 12% 混入面底+描边沿用既有边 token——无光污染。
- **token 影响**：无增删。
- **验证**：2x 截图目检（渐变/受光/描边层次成立、无带）；`check:design`、tsc 绿；e2e 全量 25 passed 零基线重写。
- 签名：approved by Jasonrale（用户裁定）

### 决议 023 补充 16 · 礼物图标按阶段主色（用户裁定「不同阶段的礼物图标颜色改成对应阶段的主色调，黄色，红色，青色」）

- **方案**：hero 分享钮与弹窗标题 gift 统一吃全站阶段变量 `--stage-color`——genesis=黄（`--accent-primary`）/ locked=品红（`--accent-echo`，即用户所指红）/ unlocked=青（`--or-cyan`）/ refund=橙（`--color-warning`）。hero 源=祖先 `.verse-hero[data-stage]`（economy 卡同源映射，零新增）；弹窗 portal 自持源——`DialogContent` 挂 `data-stage={verse.stage}`，`.verse-share-pop` 扩入共享阶段组 `:is()` 四档选择器。hover=stage 色提亮（`color-mix 72% + --color-text`，替代原 cyan——青语义留给链接/focus）。
- **token 影响**：无增删。
- **补充修正（同日用户反馈「弹窗 gift 成白色」）**：HMR 旧组件树无 `data-stage` 时 `var(--stage-color)` 失效回落继承=标题白——两处加兜底（hero 回落 text-secondary、gift 回落品红=16 前品牌色），缺源场景恒不为白（探针实测移除 data-stage → rgb(255,6,181)）。
- **验证**：三阶段探针取色（verse-21=rgb(252,238,10) 黄 / verse-2=rgb(255,6,181) 品红 / verse-3=rgb(0,240,255) 青 + verse-4 橙，hero 与弹窗一致、含 hover 态）；verse 三档基线 `=all` 重录。
- **并行编辑注记**：本轮 `copy.ts` 于 21:02 被并行会话修改（杠杆创世文案重写等 121+/67-，含一次瞬态 `preorder.term` 类型错误），zh-home/en-home 等基线随之过时——全部基线 `--update-snapshots` 重录后全量 25 passed 两连绿（非本决议内容，登记备查）。
- 签名：approved by Jasonrale（用户裁定）

### 决议 023 补充 19 · 撤 18 手搓块，复用全站标准黄色非实心钮 `.ax-ghost-cta`（用户裁定「仓库里不是有很多黄色按钮吗？用的不是同一个组件吗？怎么你还能改错」）

- **纠正**：补充 18 在 outline variant 上手搓 `!important` 黄描边块——重复造轮子。仓库早有标准范式：`variant="default"` + `className="ax-ghost-cta"`（变体镜像 584-601：透明底+黄描边+黄字，hover 填黄黑字；discovery/home/create/verse 参与面板等处处在用，连 link 形态都有 button-plate 镜像）。
- **终态**：Share on X=`.verse-share-card__x ax-ghost-cta`（零自定义 CSS，补充 18 的 important 块整段删除）；Copy link=纯 `variant="outline"` 原味（cyan-mix 描边即全站 outline 语言，补充 17 的 border-strong 覆盖一并删除——两次覆盖都在对抗组件系统，错在没先找现成范式）。
- **token 影响**：无增删。
- **验证**：computed 探针（非 hover 黄描边黄字、hover 填黄 rgb(252,238,10)+黑字，与全站 ghost-cta 行为一致）；2x 截图目检；`check:design`、tsc 绿；e2e 全量 25 passed。
- 签名：approved by Jasonrale（用户裁定）

### 决议 015 补充 · 返佣分账条三色改品牌黄/红/青（用户裁定「我说的是我们品牌的的黄红青」）

- **方案**：`/referral` 运作卡分账条（WHERE EACH SWAP FEE GOES）三段改品牌三色（logo-spec themed symbol 同源 `--or-yellow/--or-red/--or-cyan`）——LP 65%=黄 `--accent-primary`(#FCEE0A)、Protocol 25%=红 `--accent-echo`(#FF06B5；即品牌变量 `--or-red`，token 名 logo-magenta-bright)、You 10%=青 `--or-cyan`(#00F0FF)（图例色点同步）；取代 015 原映射（LP=text-tertiary/Protocol=accent-echo/You=accent-primary）在本消费位的适用——Protocol 品红与 015 原判一致，本裁定新增 LP 黄与 You 青。015 数据语义系列其余消费位（data-stage 阶段色等）不动。
- **边界注记**：青色限界（§2.4 链接/focus 专用、禁大面积色块）在本消费位开例外面——You 段≈71×8px 小图形填充非大面积色块，用户裁定品牌青入列。
- **token 影响**：无增删（两版误修撤销：首版误加 `--color-info #4C8DFF`、二版误用反馈族 `--color-danger`——品牌红=logo-spec `--or-red` #FF06B5，本仓 token 名 `--logo-magenta-bright`/`--accent-echo`）。
- **验证**：2x 截图目检（黄/红/蓝三段+图例点）；`check:design`、tsc 绿；referral 基线 `=all` 重录。
- 签名：approved by Jasonrale（用户裁定）

## 决议 024 · 首页导航终端索引 + 文案提亮（2026-10-07 用户拍板：方案「终端索引」+ 配色「提亮一档」）

- **方案**：`.marketing-nav` 三入口每枚前置终端索引序号 `01/02/03`（`.marketing-nav__index`：mono `--font-data`、`--text-xs`、`--label-tracking` 字距、静止三级灰、悬停转黄 `--accent-primary`；`aria-hidden` 装饰编号不进可访问名，TSX 由 map+padStart 生成）；文案色提亮一档 `--color-text-secondary`→`--color-text`（悬停文字提亮随之退役——悬停信号=斜切芯片浮现+序号转黄双通道）；字号维持 16px（2026-10-06 裁定）。
- **口径放宽**：001-A「等宽仅数据字段」对**装饰性编号**放行（序号非数据读数、非正文；用户在方案选项中拍板放行）。等宽用于正文/标签的禁令不变。
- **token 影响**：无增删（`--label-tracking` 为既有 token 启用消费）。
- **验证**：Playwright 实测 label #E6E9F0/16px、序号 IBM Plex Mono/三级灰、悬停序号 #FCEE0A；header 52px、nav 368px、1280/1024 零溢出；home 三档 + zh-home 基线 `=all` 重录；vitest（含新序号断言）、check:design、prettier 绿。
- 签名：approved by Jasonrale（用户裁定）

## 2026-10-08 · 无用户参与态：组合/推荐两页数据卡整体隐藏（用户裁定）

- **背景**：此前两页不读钱包连接态——头部显示 Connect 的同时正文渲染满屏样本数据（「未连接但满屏数据」）。用户裁定：无用户参与时推荐页保留机制介绍、只去掉推荐相关数据；收益组合页同样无相关数据；没有数据的卡片不显示（不做零值占位/空态卡）。
- **方案**：新增 `UserDataGate`（client 闸门，`useMockWallet().connected` 三态，RSC children 传入只切显隐）。Portfolio 隐藏 pf-kpi + pf-hero + 四分区 deck（断连时只剩页头标题+副题）；Referral 隐藏 ref-stats/ref-link/ref-pending/ref-history 四卡，ref-how（运作方式+分账条）闸门外常显；机制率 10% 属机制常量不随隐藏。SSR/首帧恒为未连接快照，无水合闪变。
- **token 影响**：无增删。
- **登记**：component-contract §33；e2e PAGES `connectWallet` 旗标（portfolio/referral/zh-referral 走连接态基线）+ `*-disconnected` 三档基线锁定断连默认态（闸门失效数据泄漏即红）；单测 `tests/unit/user-data-gate.test.ts` SSR 类名缺席/在场断言。
- 签名：approved by Jasonrale（用户裁定）

## 2026-10-08 · 无用户参与态补行动入口：两页黄色连接 CTA + Launch 页换连接钮（用户裁定）

- **背景**：同日「无用户参与态」裁定落地后，组合页断连只剩页头标题+副题、推荐页剩机制介绍——两页均无任何行动入口；Launch 页断连时主按钮仍是 Launch（提交进审阅流），与未参与语义矛盾。
- **方案**：新增 `ConnectWalletCta`（闸门对偶面：未连接渲染黄色主行动=Button default 实心黄+WalletCards 图标+copy.common.connect，点击=头部钱包同一 mock 开关，连接后整块消失）。Portfolio 页头下默认 space-7；Referral 传 `connect-cta--ref` 占链接卡首卡槽位（卡片 space-6）；≤54rem 全宽（ref-link__cta 同惯例）。Launch 表单 submit 位断连时整颗换成同款（create-submit 满宽 size lg），表单字段照常可填、连接不重置草稿。
- **token 影响**：无增删。
- **登记**：components.md「无用户参与连接 CTA」行；component-contract §33 补配套 CTA 行；e2e launch 加 `connectWallet` 旗标+`launch-disconnected` 断连条目（launch 断连态从此有基线锁）；单测 CTA 在场断言。
- 签名：approved by Jasonrale（用户裁定）

## 2026-10-08 · 笨重标题整改：A 档七处降档 + Noto 600/Plex 700 字重补档（用户裁定「①+②全做」）

- **背景**：referral 三标题四轮裁定暴露系统性问题——Noto Sans SC 仅载 400/500/700/900，全站 `font-weight: 600` 的中文按字体匹配规则升档渲染成 700 粗块（en 走 IBM Plex Sans 真 600 正常），display 族大号中文标题最显笨重。全站审计定档：A 档 7 处大标题（18–44px display 600 中文）同病；B 档（全站按钮 label/全局 h2,h3/12px 中文标签族/「参与成功」标题）同根因但字号小；表头 `th` 与裸 `strong` 走 UA bold（请求 700）反向不一致——zh 命中真 700、en Plex 无 700 落 600。
- **方案（① A 档降档，referral 四轮裁定语法延伸，逐处预览拍板）**：`.panel-title`（verse 面板标题）→body 16px/500/text-secondary；`.pol-mint__title`（全部 verse 弹窗标题共用）→body 18px/500/主白；`.swap-panel__head h2`（交易台卡头）→body 16px/500/text-secondary；`.section-heading h2`（portfolio 区头）→body 20px/500/主白；`.home-hero__title-lead`（首页 hero 引导行）→body 16px/500/text-secondary + label-tracking（kicker 化，原 zh 专属 0.65em 覆盖随固定字号删除）；`.home-section__heading h2`/`.home-final-cta h2`（首页区头/终章）→body 500、clamp(20px, 3vw, 32px)；`.site-footer__statement`（页脚宣言）→body 500、clamp(20px, 2.35vw, 32px)。display 族自此仅余页面 h1、hero 主题行、空态大标题（有意 700 展示粗体）。
- **方案（② 字重补档）**：`fonts.ts` Noto Sans SC 补 `'600'`——B 档全组恢复真实 semibold，中英按钮/标签字重一致；IBM Plex Sans 补 `'700'`——en 侧表头/裸 strong 命中真粗体与 zh 对齐。400/500/600/700 四档梯度双语闭合。
- **token 影响**：无增删（仅字体装载清单与既有规则取值变化）。
- **验证**：七处前后对比预览逐项拍板（本决议前一轮）；全量 e2e 基线重录（`--update-snapshots=all`）。
- **同日纠偏（二轮定稿）**：落地后用户仅驳回 hero 引导行一处——「让一次共识，成为」kicker 化后 16px 贴 60px 主标题失衡（元素特写预览没暴露整页语境问题）。`.home-hero__title-lead` 单独恢复原 display 0.7em/600（含 zh 0.65em 特判回填），粗块由 ② Noto 600 补档消解；区头/终章/页脚宣言降档与 #1–#4 模块级降档全部维持。
- 签名：approved by Jasonrale（用户裁定）

## 2026-10-08 · fixture 层重复推导意见 wontfix（迁移时消解，用户裁定「执行」处置）

- **背景**：code review 意见——`lib/data/fixture-repository.ts` `getSnapshot()` 无缓存，30 个 `getFixture*` 各自全量重推；portfolio 页同请求重复取数（`getFixtureVaultRows` ×3 等），verse 页重复调 `getFixtureParticipations`、每调 `getFixtureVerseTrade` 用随机游走重造 8760 根蜡烛、refund 块 N+1；次级 `verse-trade-desk.tsx` 对页面已取的 `polPosition`/`participationOptions` 再取一次（同值双源）。
- **裁定（wontfix）**：①正确性无风险——蜡烛随机游走为确定性 PRNG（FNV-1a 种子 + mulberry32，`fixture-repository.ts:510-517`），重复调用产出逐根一致，不存在同请求数据对不上；②21 verses 规模毫秒级、RSC 每请求一次，无可感知代价；③`fixture-repository` 本就是三层边界中唯一合法消费方=刻意的替换缝，链上真数据接入时整体替换——现在包 `react.cache` 是届时直接扔掉的代码，且真数据需要的是跨请求缓存（revalidate/SWR 类），请求内去重不对症。
- **迁移注意（唯一带走项）**：真数据接入时统一取数入口、消除双源——verse-trade-desk 再取 `polPosition`/`participationOptions` 的模式在真数据下变成两次独立 RPC，可能读到不同链上状态。
- **token 影响**：无增删；无组件/契约登记（「其余不记」）。
- 签名：approved by Jasonrale（2026-10-08 用户裁定）

## 决议 025 · 字标交付分辨率衍生变体 480px（2026-10-08，用户裁定「开始修复」）

- **背景**：adjudicate-finding 裁决 TRUE PROBLEM（high）——`public/brand/BRAND-01-wordmark-transparent.png`（2048×527，223427 B）在 `images.unoptimized`（next.config.ts，原型阶段避免 sharp 依赖）下 resize/srcset 全旁路，三个消费点（壳层字标 `app-shell.tsx`、首页 footer `home-page.tsx`、verse 分享卡 `verse-share.tsx`）以 `priority` 直出母版；最大渲染 160 CSS px（footer clamp 封顶），DPR3 物理封顶 480px，冷首屏品牌载荷 ~250KB 中字标占 223KB（4.9~14.5× 过量）。意图层核验：2048 直出无任何决议/契约登记背书——config 注释仅登记 sharp 规避、决议 004 锁识别与红线不锁交付分辨率、`git log -L` 证实 Brand 组件自原型基线原样继承。
- **决策**：母版不动（004 红线不受影响——衍生为等比缩放（480 宽精确等比高 123.5156，像素网格取整 123，0.42% 纵向亚感知），非改色/拉伸/裁切），从母版等比衍生 `public/brand/BRAND-01-wordmark-transparent-480.png`（480×123 RGBA，LANCZOS+optimize，56223 B）供全部三消费点引用（`src`+`width/height` 同步 480/123）；480px 覆盖全部消费点 DPR≤3。母版保留于 public/brand/（印刷/大尺寸场景真源）；`component-contract.md` verse-share 登记行路径同步。
- **token 影响**：无增删；CSS 零改动（渲染尺寸全由既有类控制）。
- **验证**：tsc 全树绿、prettier 绿（三个消费点）；视觉=渲染尺寸不变，e2e 基线预期亚像素级差异低于 1% 容差（并入下轮基线重录核对）。
- 签名：approved by Jasonrale（2026-10-08 用户裁定「开始修复」）

## 决议 026 · 死代码清剿：三个生而死符号删除 + next-intl 依赖退役（2026-10-08，用户裁定「开始修复」）

- **背景**：adjudicate-finding 裁决（3 sampler 一致收敛 + Layer 2 coverage-diff/意图层核查）——`signal-ui.tsx` `formatDuration` 与 `SlashMark`、`ui/popover.tsx` `PopoverModalContent` 为基线移植「生而死」符号（git 全史零消费者；formatDuration 的登记用例已由 action-zone 本地 `staticDuration` 另行实现，PopoverModalContent 的遮罩居中角色出生即被 Dialog 取代且组件契约从未登记它）；`next-intl` 全仓零 import，其 §3 登记角色（「App Router 中英文路由与消息格式化」）已被落地架构取代（proxy 方案 C + `copy.ts` `getCopy`，copy-and-i18n.md §1-2 normative 登记），搁置的接线步骤无执行记录=登记漂移。zod（`fixtures/schema.ts` 活引用，claim 扫描范围漏 fixtures/）与 `@tanstack/react-query`（§3 目标栈按计划预装、角色未被取代）经裁决不属死依赖，不动。
- **方案**：删 `formatDuration` 与 `SlashMark`（signal-ui.tsx）+ `globals.css` `.slash-mark` 孤儿块；删 `PopoverModalContent` 定义与导出（components.md §2 Popover 契约本就未含它，删除后代码与契约对齐）；`pnpm remove next-intl`（连带 25 个传递包）+ 同变更删 checker ALLOWLIST 行与 architecture.md 三处登记（主路径摘要栈清单、§3 依赖表 i18n 行、§5 溯源行）。登记同步：copy-and-i18n.md §3「时长」行、components.md §3 `SlashMark`/`formatDuration` 两行、design-system/README.md 真相源清单。倒计时 warning 色规则不受影响（copy-and-i18n.md §3 独立条目，action-zone `deadlineTone` 实现）。时长格式化现实=action-zone 本地 `staticDuration`（locale 盲 `2d 4h`，与原登记 zh「2 天 4 小时」分歧）——按裁决 A1 不扩大射程，zh 时长本地化如有需要另立裁定。
- **token 影响**：无增删；三个符号/依赖全史零消费，零视觉变化，e2e 基线不受影响。
- **验证**：tsc --noEmit 全树绿；check-architecture-compliance OK；vitest 152/152；prettier 绿（九个触及文件）。
- 签名：approved by Jasonrale（2026-10-08 用户裁定「开始修复」）

## 2026-10-08 · 决议 025 补充 1 · symbol 交付分辨率衍生变体 96px（用户裁定「走方案1」）

- **背景**：fix-review 复审字标修复时登记的 pre-existing 同类项——`BRAND-04-symbol-transparent.png`（512×382，27348 B）唯一代码消费点 `app-shell.tsx` Brand compact 分支以 `priority` 直出，渲染恒 32px（`--space-6`），DPR3 物理封顶 96px，512 固有=5.3× 过量。用户裁定同配方处置。
- **决策**：母版不动，等比衍生 `BRAND-04-symbol-transparent-96.png`（96×72 RGBA，LANCZOS+optimize，8708 B；精确等比高 71.625，像素网格取整 72，0.52% 纵向亚感知——同类取整口径见 025 主文），compact 分支 `src`+`width/height` 同步 96/72。母版与 `BRAND-04-symbol-color-512.png`（layout.tsx favicon 用，非 `<Image>` 渲染路径）保留。`foundations.md` §9 补交付分辨率指引（界面消费勿直引母版，防复发）。
- **token 影响**：无增删；CSS 零改动。
- **验证**：tsc 全树绿、prettier 绿、vitest 全量；e2e 三档视口实跑复核（见本条落地当轮记录）。
- 签名：approved by Jasonrale（2026-10-08 用户裁定「走方案1」）

## 决议 027 · 待办区时长 zh 本地化：staticDuration 接 locale 分支（2026-10-08，用户裁定「zh 本地化」）

- **背景**：决议 026 fix-review PASS 后登记的 pre-existing minor 发现——`action-zone.tsx` `staticDuration` locale 盲，zh 模板「{t}后截止」把英文片段夹进中文句子（实渲染「2d 4h后截止」）；026 删除死符号 `formatDuration` 时其 §3 zh 形态登记（「2 天 4 小时」）一并退役，本决议接续拍板。范围核验：全站 d/h 形态时长产出点仅 `staticDuration` 一处（<24h 走秒倒计时 DeadlineClock/RedeemCountdown 均为纯数字 `HH:MM:SS`；TokenPair 契约示例无代码实现；verse-tab 用 locale 感知 `formatDay`）。
- **方案**：`staticDuration(remainingMs, locale)` 加 zh 分支 `${days} 天 ${hours} 小时`（en 维持紧凑 `2d 4h`），两调用点（保护窗卡 hero、周期激励行）传 locale。登记回填：copy-and-i18n.md §3 恢复「时长」行（指向 action-zone 内联实现，非共享导出）；component-contract.md §4 徽章规则行补 zh 示例「2 天 4 小时后截止」。
- **token 影响**：无增删。
- **验证**：tsc 全树绿；vitest 152/152；prettier 绿（三个触及文件）。e2e：ZH_PAGES 原未覆盖 zh portfolio（无既有基线可漂移）——补 `zh-portfolio` 连接态条目（`e2e/pages.ts`，zh 只锁移动端一张随 §3.2 口径），清 `.next-e2e` 全新构建首轮写入基线，页面快照实证 zh 时长渲染「3 天 13 小时后截止」等、复跑绿；en portfolio 连接/断连六条对既有基线零漂移（同轮实测决议 026 零视觉变化主张）。
- 签名：approved by Jasonrale（2026-10-08 用户裁定「zh 本地化」）

## 决议 028 · 字体装载清单死档修剪：Noto Sans SC −900 / Saira Condensed −800（2026-10-08，用户裁定「确认处理」）

- **背景**：fix-review 低危项 adjudicate-finding 裁决 UNPROVEN（意图层不定：foundations §2 枚举 5 档 vs 2026-10-08 补档裁定叙事「400/500/600/700 四档梯度双语闭合」），用户拍板收敛。`fonts.ts` 两处零消费死档：Noto Sans SC 900（font-black / font-weight:900 / 内联 fontWeight / bolder 全站零命中；请求域 400–700 且四档全真值，永不为最近匹配；出处=决议 012 补充 2 v0 整包采纳「Noto +900」，从未被单独裁定，补档 891af3b 只加 600 未修剪）与 Saira Condensed 800（同零命中；foundations §2 display 行登记仅 600/700，800 从未入登记，出处同 v0 整包采纳「Saira +800」）。影响=产物死 @font-face（旧构建实测 Noto 900 计 101 条 unicode-range 拆分，裁决轮采样）+ woff2 部署载荷；preload:false 下浏览器永不匹配下载、运行时零成本。
- **方案**：`fonts.ts` Noto weight 去 `'900'`（终态 `['400','500','600','700']`，与补档裁定「四档梯度双语闭合」口径对齐）；Saira weight 去 `'800'`（终态 `['600','700']`，与 foundations §2 既有登记对齐——display 行登记本就无 800，无需改）；`foundations.md` §2 中文行枚举同步 400/500/600/700 + 去档注记。同轮另办（非设计变更、不另立决议）：action-zone 保护窗常量单源化——`PROTECTION_WINDOW_MS` 由 `fixture-repository.ts` 导出（带 genesis.md:43 源注），删除 `action-zone.tsx` 本地 `WINDOW_MS` 重定义，余量条分母与数据层窗口同源。
- **token 影响**：无增删（仅字体装载清单变化）。
- **验证**：tsc --noEmit 全树绿；e2e 三档视口全量实跑 46 passed / 0 failed / 32 skipped（既有跳过口径不变；900/800 全站零消费，删除零视觉 diff 实证）；.next-e2e 产物 CSS `font-weight:900`/`800` 归零、600/700 在位。
- 签名：approved by Jasonrale（2026-10-08 用户裁定「确认处理」）

## 决议 029 · 刷新样式闪变处理：画皮预水合装载落地；字体 optional 实验被用户否决回撤 swap（2026-10-09）

- **背景**：用户报告刷新时多页面先初始样式再闪成最终样式、字体尤甚。诊断（隔离构建插桩实证）：① `display: 'swap'` 零阻塞期下，字体只要晚于首帧就先画后备再换装；且 **Next 对动态路由段不下发 next/font 的 preload 链接**（归因过程与差分证据链见「遗留」项勘误——本站全部产品路由 `app/[locale]/**` 皆动态段，拉丁字体也退化为惰性拉取；Noto Sans SC 另有 4 字重 × 113 分片 = 452 个 unicode-range face，preload 本就不可行）。② 按钮画皮 Paint Worklet 的 `addModule` 原在 `PaintSkin` useEffect 里跑（等 React 水合），注册前 `paint()` 光栅化为空——按钮裸奔后补描边（headless 实测 600ms+ 未置位）。
- **落地（保留）**：`app/layout.tsx` body 首子位新增 nonce 内联脚本（nonce 取 `proxy.ts` 注入的 `x-nonce` 请求头；全站本就动态渲染，读 headers 无新增降级），随 HTML 解析同步执行 `--dpr` 初值 + `addModule`，语义与组件一致（`__paintBooted` 先置再注册、resolve/reject 均打 `data-paint-ready`）；`paint-skin.tsx` 以 `window.__paintBooted` 守卫去重（内联被 CSP 拦截时组件兜底原路径），保留 resolution MQ 追踪。实测暖载注册 247ms 抢在首帧 248ms 前（原路径 600ms+）。
- **否决（同轮回撤）**：字体四家族 `display: 'swap'`→`'optional'` 的消闪实验被用户实见否决——optional 错过 100ms 阻塞期即整页锁死 metric 后备、永不换装；开发态（dev server 静态资源不缓存，每次刷新都冷加载）与任何绕缓存的刷新（Ctrl+Shift+R、新 profile）都常态性错过，用户刷新后看到系统黑体冒充 Noto Sans SC。已全量回撤 swap；e2e 为 optional 加的 shoot() 双载一并回撤。**教训入册：勿再以改 display 值「消闪」**。
- **遗留（待另行拍板）**：字体刷新闪变未解。**归因勘误（2026-10-09 用户质证「有严谨的证据链吗」后差分补证）**：初版「manifest `[project]/` 前缀 vs 相对路径查找恒不命中」机制**作废**，初版引用的上游 [vercel/next.js#95449](https://github.com/vercel/next.js/issues/95449)（pageExtensions 类）与本缺陷**不对应、撤回**。修正后的证据链（vanilla 最小复现，同 next@16.3.3、同字体、同 fonts.ts 间接层）：① 静态路由 `app/page.tsx` → preload 链接**正常下发**（同 `[project]/` 键运行时匹配成功，机制本身健全）；② fonts.ts 间接层（T1）/ CSP+nonce proxy（T2）单变量引入均不影响下发；③ 单变量引入**动态路由段** `app/[locale]/page.tsx` → 复现消失（200 真页面、无 preload，无 proxy 也复现）；④ 混合路由同构建同服务器：`/`（静态）有、`/en`（动态）无——排除「manifest 未加载」，锁定动态段查找失败；⑤ manifest 自身含动态路由键与字体文件（构建侧有 preload 意图，排除「by design 不预载」）；⑥ next@16.4.0 复测：**未修**（静态有、动态无）；⑦ dev（turbopack）静态/动态**从不下发**字体 preload（dev 固有行为，dev 闪变无 preload 解）。压缩产物内具体错配字符串未拆（`next start` 实际运行 `dist/compiled/next-server/app-page*.runtime.prod.js` 打包副本，源码级 CJS/ESM 文件非运行真身；差分已足归因，不再深挖）。候选路径=运行时读 next-font-manifest 手发 preload 链接（仅惠及拉丁 6 文件，CJK 分片无解）/ 向上游提交动态路由差分复现 / 接受现状。

### 决议 029 补充 · 遗留项第一层落地：FontPreloadLinks 运行时补发字体 preload（2026-10-09，用户质证「不可能没有解决方案」）

- **方案**：新增 `components/design-system/font-preload.tsx`（挂根 layout body 首子位）——运行时读 Next 构建产物 `next-font-manifest.json`（键=路由、值=应预载 woff2；仅拉丁 `.p.` 文件，Noto `preload:false` 本就不在清单），取全路由并集以 `<link rel="preload" as="font" crossorigin="anonymous">` 补发（React 自动提升入 head）。绕过 Next 动态路由段不下发 preload 的缺陷；哈希 URL 全部来自清单、零硬编码；`.next` 为 dev(3000) 与生产预览(4175) 共用，按 `NODE_ENV` 先取 `dev/server/` 或 `server/` 清单（取错会预载到旧构建的 404 哈希——实测踩过）；清单缺失/不可读=静默回退 Next 原生行为。mtime 记忆化，dev 热改字体后清单刷新自动跟。
- **实测**：dev（webpack）暖刷新 latin 字体 FCP 前就绪（fonts.check@FCP=true，en/zh 两页、零 console 错——此前 dev 从不预载、必输首帧）；隔离生产构建（NEXT_DIST_DIR，未触碰 .next）暖刷新 en 页 latin@FCP=true、zh 页 latin+CJK 双 true（FCP 300-340ms、逐帧采样无回落）、preload 链接随 HTML 下发且 URL 实取 200。e2e 全量本轮被并行会话 faucet 轮打断（e2e/pages.ts 与快照被其中途改写，运行只执行到 1 用例）；本组件对渲染零影响（preload 只提前取回、不改绘制路径），此前两轮 57 passed / 0 failed 已覆盖画皮+swap 基线，待并行轮落定后随其 e2e 一并回归。
- **边界**：CJK 452 分片 preload 不可行（清单本就无 Noto），本层只保拉丁 6 文件；dev 冷首访仍可能后到（无缓存+dev 中间件慢），但 swap 保证最终真值。
- **登记**：foundations.md §2 加载链路段同步。
- 签名：approved by Jasonrale（2026-10-09 用户质证推动）

### 决议 029 补充 2 · 遗留项第二层落地：中文 Noto 子集变体自托管（2026-10-09，用户裁定「继续」）

- **方案**：`fonts.ts` 移除 next/font 的 Noto 声明（452 个 unicode-range 分片=刷新闪变主源、不可预载），改为全站文案子集的**自托管变体单文件**：`scripts/build-cjk-font.mjs` 抽取 copy.ts+fixtures 全部中文字符（849 字含标点/全角/ASCII 保底），pyftsubset 把 NotoSansCJKsc-VF（notofonts 官方，wght 100-900）切为单 woff2（362KB，产物按内容哈希命名 public/fonts/noto-sc-subset.*.woff2 + 覆盖清单 json + `cjk-subset.ts` 单一 href 源）；`font-preload.tsx` 内联 `@font-face`（家族名沿用 'Noto Sans SC'，tokens.css 字体栈零改动）+ **zh 路由才预载**（en 页无 CJK 消费，省 362KB）；`next.config.ts` 给 /fonts/* 加 immutable 头（哈希名保证安全）；proxy matcher 排除 fonts/（否则静态文件被 locale rewrite 吞成 404——与 paint/ 同款坑）。纪律：**文案变更后必须 `pnpm build:cjk-font`**，`pnpm check:cjk-font`（含 --self-test 闸自检）对账「源文案字符 ⊆ 子集覆盖」，漏跑即红；闸已按仓内惯例包进 vitest 契约闸门（`tests/unit/contract-gates.test.ts` 第四项）——`pnpm test` 一条命令即拦，pre-push 与 CI（.github/workflows/ci.yml）自动覆盖，无需手动记得跑。
- **性能账（实测）**：字体 CSS 377KB→13KB（-96%，405 条 Noto 分片规则清零、render-blocking 直接受益）；zh 首帧字体就绪——dev 暖刷新 latin+CJK 双 true@FCP、隔离生产 zh FCP 204ms 双 true、零 console 错；en 预载维持 6 拉丁文件无 CJK。变体实例化字形与 Google 静态档理论同源（zh e2e 基线 diff 待全量轮确认，见验证）。
- **边界**：冷首访/绕缓存刷新仍是「362KB 网络下载 vs 首帧」竞态（preload 起跑最早；叠加 display:'fallback' 可消，未拍板维持 swap）；子集=现有文案字符，用户输入生僻字退系统字体（同行混排）——接受（兜底选项=加常用 3500 字表，每档 +~350KB，未采纳）。
- **token 影响**：无增删（'Noto Sans SC' 家族名与字重档不变；600 中文档位约束随变体轴消解，foundations §2 已注记）。
- **登记**：foundations.md §2 中文字行+加载链路改写；tokens.css 字体角色注释注记供给源。
- **验证**：tsc/prettier/check:design 绿；check:cjk-font 常规+自测双绿；vitest 全量 190/190（含新增契约闸门第四项）；dev+隔离生产探针如上；e2e——桌面档全量通过，tablet/mobile 两档首轮被并行 faucet 会话杀服务器（全部失败=ERR_CONNECTION_REFUSED 连接拒绝、零像素 diff，环境互踩非渲染问题），并行轮落定后聚焦补跑 mobile-390 19 passed（**含全部 zh 基线、零重录**——变体字形与既有基线像素兼容）+ tablet-860 12 passed。
- 签名：approved by Jasonrale（2026-10-09 用户裁定「继续」）

### 决议 029 补充 3 · 中文子集 @font-face display swap→fallback（2026-10-09，用户裁定「改」）

- **裁定**：冷首访竞态收尾——`font-preload.tsx` 内联 CJK `@font-face` 的 `font-display` 由 `swap` 改 `fallback`（100ms 阻塞期 + 3s 换装期）：暖刷新/WiFi·5G 冷访窗口内字体必到，首帧即 Noto 零闪；4G 冷访先隐身 ≤0.1s → 后备 → 3s 内换装（比 swap「立刻错字体再换」晚出场、对的时机更多）。**拉丁侧（fonts.ts next/font）维持 swap 不动**——6 文件 94KB 预载后几乎必进窗口，且 fonts.ts 的 display 值历属裁定敏感区（optional 前科，值域变更一律走裁定）。
- **验证**：dev 下发 `font-display:fallback` 实证；tsc/prettier 绿；mobile-390 视觉档（含全部 zh 基线）**三连跑 19 passed / 0 failed**（首轮 1 次出现 2 failed，每轮含全新构建+服务器即等价复现该条件三遍全绿，定性为本会话已两见的环境 flake 非渲染非确定性；基线零重录）。
- **token 影响**：无增删。
- 签名：approved by Jasonrale（2026-10-09 用户裁定「改」）

## 决议 014 · 11 路由蓝图作废，产品收敛为现役 5 路由（2026-09-21，用户裁定）

- **裁定**：routes.json（阶段 2 冻结）规划的 11 条路由蓝图**作废**——bridge/account 等页面永远不会实现，该设计是错误的。产品路由收敛为当前现役 5 条：`/`（首页）、`/memeverse`（发现）、`/memeverse/launch`（创建）、`/memeverse/[verseId]`（详情）、`/portfolio`（组合）+ `/referral`（推荐）+ `/design-system`（设计系统，非产品页）。
- **影响**：①routes.json 及其 fixturePath 映射作为历史冻结记录保留，不再作为实现依据；②场景协议（步骤 5）收缩为纯瞬态截图钩子（loading/empty/error/index-lag），paused/zero-balance 等 19 个数据变体场景随蓝图作废移除（scenario.ts 收缩，states.json 冻结文件保留为历史记录）；③依赖已作废路由的 brief 条目（bridge/account/verse-trade 等）一并失效。
- **与决议 011 关系**：011 是范围缩减（v0 只做 3 页），014 是路由规划本身作废——现役路由以实际部署为准。

## 2026-10-09 · governance 可领样本越权裁剪全量回滚（用户裁定「这明显是犯错了」）

- **背景**：bfa11c9（017 补充 2 收尾轮）把 12 个 verse（013/014/024/025/026/028–034）的 `lastCycle.myClaimable` 归零并删除 `claimableAssets` 构成（其中 024/025/026/028/030/031 连 `lastCycle.myVotes` 一并清零）。017 补充 2 原文只裁定钱包/储蓄/页脚 reserve 减值（「staking/positions/pol-positions 不动」），从未授权裁 governance 可领——commit message 的「governance fixture trimmed accordingly」属执行层越权引申。后果：①DAO 卡可领按钮按 2026-10-05 降级分支退恒禁用钮（本仓 Button disabled 渲染与 enabled 一致，无视觉提示），可领明细弹窗消失；②组合页①待办区 12 行周期激励行静默消失；③数据自相矛盾——6 个 verse 有票权（myVotes>0）且有未领奖励（unclaimedAssets 在）却 myClaimable=0，违反「可领=票权份额」机制口径（GovernanceCycleIncentivizerUpgradeable.sol:199）。
- **裁定**：该裁剪是错误，全量回滚。逐字段恢复至 bfa11c9^ 数值（字段级 diff 证实其余全等，整文件 revert 即精确回填）；`myClaimable`/`claimableAssets`/`myVotes` 三字段同复，恢复后 20/20 verse「票>0 ⇔ 可领>0 ⇔ 构成在位、usdValue 之和锚 myClaimable」全自洽。manifest 确定性重建；按部署纪律 kill-by-PID 重启 3000/4175 预览。
- **量级说明**：恢复后可领回到裁剪前量级（弹窗总额 $9K–$92K/verse）。不与 017 补充 2 冲突——hero 口径=钱包+储蓄+金库待领，governance 可领不在其中；如日后要治理奖励也做人级量级，须另立保留自洽性的等比缩尺决议（禁止再以归零/删构成为手段）。
- **验证**：tsc / vitest 188/188 / fixture boundary --source 全绿；实测 verse 26/13/33/2 弹窗（$91,786/$57,535/$52,777/$28,500）、组合页待办 17 行激励行回归（20 verse−3 窗口已过）；e2e 41 passed，portfolio 基线 7 文件 `=all` 重录（desktop 5528→5926px；disconnected 漂移=顶栏场景切换芯片，属并行进行中的 scenario 工作、同树不可避免，其落地轮复验），explore 基线红=scenario 工作所属、非本轮范围。
- **残留（未裁定）**：Button disabled 与 enabled 渲染一致的观感坑——降级禁用钮无任何视觉提示，本次仅回数据未改渲染；是否灰显另议。
- 签名：approved by Jasonrale（2026-10-09 用户裁定「这明显是犯错了」）

## 决议 016 · runbook 流程退役（2026-10-09，用户裁定「过时、冗余、可删」）

- **裁定**：`docs/runbooks/` 整目录删除（三个 stage runbook 已执行完毕；11 路由蓝图部分随决议 014 失效）。progress.md 逐条登记、哈希链重签、双签/证据包流程一并退役。
- **替代工作方式**（轻量化，适用于后续所有阶段）：用户提意见/需求 → Agent 实现 → 门禁（tsc/vitest/prettier/boundary）→ 用户验收。正式裁定仍进本日志；历史溯源以本日志 + git 历史为准。
- **保留的活文档**：`docs/design/decision-log.md`（唯一裁定记录）、`docs/prototype/flow-matrix.md`（验收清单）、`product-acceptance.md`/`stage-03-handoff.md`（阶段 3 冻结记录）。

## 决议 030 · docs/prototype 证据包清理（2026-10-10，用户裁定「删，包括 v0-export/ 也删了」）

- **裁定**：`docs/prototype/` 清理——删除 `csp/`、`scenario/`、`screenshots/`（round-00+final 两轮快照）、`v0-export/`（含 `v0-export.sha256`/`v0-revision.txt` 元文件）、`v0-input/`；17M → 72K，备份 `/tmp/prototype-removed-20261010/`。孤儿脚本 `scripts/build-prototype-input-manifest.mjs` 已随 e10bbf0 移除；`tsconfig.json` exclude 与 `eslint.config.mjs` ignores 同步去 v0 引用。
- **依据**：v0 循环 2026-09-20 导入后即结束（96 项打磨全在仓内），产品已于 2026-10-09 全量验收；csp/场景证据的消费 checker 已随轻量化裁定删除，截图证据可由 git 历史 + e2e 视觉基线复现。决议 016 保留清单（flow-matrix / product-acceptance / stage-03-handoff / decision-log）全部不受影响。
- **有意失配登记**：`docs/prototype/freeze-artifacts.sha256` 与 `stage-03-handoff.md` 为验收时点历史快照，此后不再对账磁盘——manifest 中 csp/scenario/screenshots 条目及已删脚本条目均为「快照时存在」的历史记录。
- **验证**：tsc / vitest / architecture compliance / lint / prettier（触碰文件）全绿。

## 决议 031 · v0 证据孤儿脚本移除（2026-10-14，用户裁定「动」）

- **裁定**：删除 `scripts/record-v0-revision.mjs` 与 `scripts/build-design-input-manifest.mjs`。两者服务对象（v0 输入清单构建与修订记录流）已随决议 030 证据清理终止，仓内无任何消费方——唯一引用是设计冻结清单生成器的枚举表，随本决议同步移除；冻结清单重生成。
- **依据**：v0 循环 2026-09-20 结束、产品 2026-10-09 全量验收（决议 030 同一依据链）；不可到达脚本=死件，留看守名单里只会制造假维护面。
- **验证**：check-design-freeze 重生成后全过；全仓引用扫描零残留。

## 决议 032 · docs/design 过程考古树清理（2026-10-14，用户裁定「没必要留着了，反而冗余」）

- **裁定**：删除 `docs/design/` 下过程证据树与根部过程文档——references(40)/directions(7)/direction-seeds(3)/archive(3) + 8 个根部过程文档（approval-payload/diff-round-01/round-00-anchor/self-review-01/qa-round-00/skill-evidence/stage-01-handoff/stage-02-inputs），共 92 文件；备份 `/tmp/design-removed-20261014/`（175 份，含 review 全树与 brand 初删误纳）。冻结清单重生成（183→113 项）。
- **保留例外**：`brand/`（正式品牌资产库：logo-spec/favicon 全套/正反单色符号多尺寸导出——app 侧无副本，为唯一资产源；初版误纳删除、实物核验后恢复，用户质疑触发）、`logo-variants/`（探索设计稿，用户裁定「可能还有些用处」暂留）、`references/complexity-map.md + aesthetic-learning.md + aesthetic-principles.md`（DESIGN.md:78/:80、component-contract.md:17/:59/:80、brief-template.md:21 活引用——复审以相对路径盲区补恢复）、`review/r10-css-extract.css`（DESIGN.md:9 与 tokens.css:14 活引用，token 值提取证据——同轮补恢复）、`review/token-preview.{html,png}`（DESIGN.md:85 活引用）、`token-icons/`（app 图标组件与 component-contract.md 活引用）、decision-log.md、final-artifacts.sha256、根 DESIGN/PRODUCT、docs/design-system（不在本辖区）。
- **看护面变更**：`token-icons/` 此前是看护盲区，本决议纳入冻结清单（活设计资产）；check-design-freeze 头注释的 retention-log 指针随 references/ 缩减改指 decision-log。
- **验证**：check-design-freeze 113/113 全过 + --self-test 双谓词全对；悬空引用复审（补扫相对路径与裸文件名盲区）零残留。
- **补充（2026-10-14 用户裁定「symbol_logo 可以删掉，另外其他的图片需要重命名得更专业，而不是用编号」）**：删 `logo-variants/or-monogram/concepts/symbol_logo.png`（`04–06` Symbol 的 raster 源稿；矢量资产构造参数完整记录于 logo-spec §6/§9，权威形态不受影响，回收=git 历史），or-monogram/ 空目录一并移除；其余 9 文件按内容重命名去编号——g10-final-black→wordmark-master（logo-spec 与 brand/README 引用同步）、g10-final-4k→wordmark-master-raw（未净化原始渲染）、g29-final-black→wordmark-alternate-neon-ribbed、g30-geo→wordmark-alternate-geometric-color、g30-wordmark.png/.svg→wordmark-alternate-geometric-mono/.svg、g30-mono-mask→wordmark-alternate-geometric-mask、g30-mono-raw.svg→wordmark-alternate-geometric-trace、g31-final-black→wordmark-alternate-arcade。冻结清单重生成（113→112 项）。
- **补充二（2026-10-14 用户裁定「references/review 早就过时——现行设计=v0+本地改良，纯本地初版已弃」+逐文件复核）**：删 `references/aesthetic-learning.md`/`aesthetic-principles.md`（VS-001~009 拆解=纯本地设计时代产物，证据图已删、结论蒸馏于 DESIGN.md §1/§7）与 `review/token-preview.{html,png}`（09-17 生成，早于 r10 对账修正——无 Saira 字体身份与修正后 alpha，与现行 tokens.css 不一致）。DESIGN.md §8 拆解条目、§9 token 产出与 `directions/direction-01.md` 指针同步清理；motion-and-a11y.md §3 验证入口改指 `pnpm test:e2e`（token-preview/component-contract-preview 两个手工基线页均已于本决议初轮删除——初轮悬空复审漏网，本轮补清）。`review/r10-css-extract.css` 与 `references/complexity-map.md` 留待拍板（复核发现：前者是 v0 会话 r10 部署 CSS=决议 010 溯源链上现行 token 的提取证据，非纯本地初版；后者 11 路由框架过时但 component-contract 三处规范引用在位）。冻结清单重生成（112→108 项）。
- **补充三（2026-10-14 用户裁定「仓库内容要自洽——规则内联，不外指」）**：删 `references/complexity-map.md`（11 路由密度表=决议 014 作废蓝图）。三处规范引用按自洽口径内联进 component-contract.md 正文、不再外指：dust 域补「粉尘整笔回滚」语义；双门槛独立展开为「普通创世资金/杠杆利息两门槛各自判定、预购不计入、三口径不相加」；费率四项点名「基础 1%·逆向冲击·波动·短期冲击，硬顶 100%」。brief-template.md 密度依据字段改为字段数+操作数分级自述；DESIGN.md §8 复杂度地图条目移除；references/ 目录随清空移除。冻结清单重生成（108→107 项）。
- **补充四（2026-10-14 用户裁定「r10-css-extract.css 删」）**：删 `review/r10-css-extract.css`（v0 r10 部署 CSS 提取件、决议 010 对账底账——纯证据无消费者，按 030 口径 git 历史回收；tokens.css 头注释引用已随并行 token 重构先行消失，DESIGN.md:9 证据链改指本日志决议 010）；`review/` 目录随清空移除。冻结清单重生成（107→106 项）。
- **补充五（2026-10-14 用户裁定「采纳可优化点并执行」）**：①冻结闸门升级为双向——新增 `scripts/design-freeze-trees.mjs` 作为写入器/检查器共享树范围（.DS_Store/.mimosa 跳过规则同源），check-design-freeze 对「树内未登记文件」报 `FREEZE UNLISTED`（.mimosa 泄漏事件暴露的单向盲区；--self-test 增第五谓词，brand/ 探针实测拦截）；生成器收敛到共享模块并移除 references/review 死树目与 stage-01-handoff 死排除项。②DESIGN.md §8「交易 UX 来源」条目随分类源全灭整节移除，原 §9 顶替为 §8（内外零编号引用，实测）。③logo-spec §6 管线声明对齐仓库现实：`logo-vectorize/` 脚本从未入库（`script/` 仅 token-icons/），本节参数表保留为重建依据。④`.prettierignore` 清 references/visual、product-ux、inbox、logo-*、runbooks/references、generate-logo-* 六条死条目（均系被 `docs` 总忽略包含或指向已删文件）。暂缓项：eslint ignores 的 `docs/design/review/**` 与 check-design-bare-values 排除表三死目录——两文件正被并行会话注释英文化中，待其落地后另行小提交；`scripts/check-runtime.mjs` 与 `scripts/bootstrap-pnpm.mjs` 同因并行改动移出看守范围（本轮用户裁定「不把并行会话的改动提交」——清单哈希必须与入库内容一致，否则 CI freeze drift；两脚本为基础设施件、非设计资产，并行扫落地后可复入）。冻结清单重生成（106→105 项，+共享模块−两脚本）。

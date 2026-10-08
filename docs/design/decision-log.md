# 设计决策日志（Stage-01）

> 人工决策记录：每条含决策语句（用户原话要点）、约束效力范围、证据引用。AI 不得代选、不得事后改写。

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

### 决议 012 补充（二次深审，2026-09-19）

- **悬空 token 修复（8 个）**：v0 精修在 globals 消费但从未定义的变量——`--line-accent`（补 2px）/`--line-echo`（1px）（精修纪律的数值落地；此前 calc(var(未定义)) 使 CTA 品红内衬/PageIntro 底线等签名 box-shadow 整条失效）、`--color-surface-header`（#14161FE6）/`--color-surface-navigation`（#101219F2）（§3.1 半透明表面）、`--color-border-signal-strong`（#00F0FF5C）、`--inset-light-yellow`（#FCEE0A2E）、`--shadow-header`（结构阴影）、`--font-weight-semibold`（600）。全部按契约先进 tokens.css；悬空引用扫描归零。
- **路径修正**：docs/design-system/agent-workflow.md 引用的 v0 平台侧 skill 路径（v0_memories/team/skills/impeccable）→ 本地 `.agents/skills/impeccable`。仓库内确认无 v0 新增 skill 文件（v0 的 impeccable 挂在平台侧；本地本有同款）。
- **.gitignore 合并**：v0 运行时三条目+Next 产物域。

### 决议 012 补充 2（v0 同步批次 e4e0c74，2026-09-20）

- **同步内容**（3 commits：c8c669e/82ed328/e4e0c74）：①仓库级设计系统 skill `.agents/skills/outrun-design-system/SKILL.md`（53 行：读取顺序/不可豁免规则速记/交付前验证/登记义务/跨工具链路由）+ 根 `AGENTS.md`（跨工具 Agent 入口）；②生产字体声明迁入 `components/design-system/fonts.ts`（与我方迁移殊途同归，采纳其更全版本：Saira +800/IBM Plex Mono +600/Noto +900、CJK preload:false、`productFontClassName` 聚合导出；layout 改用聚合类）；③状态点 BEM 修饰类→`data-tone` 属性（app-shell/wallet-control 各 2 处+globals 规则）；④活体展示页 `/{locale}/design-system`（showcase.tsx 191 行——token 色彩/字阶/组件/阶段色全量回归面，零 fixture 领域数据）；⑤docs/design-system 四文件修正（层级表+字体源/展示页行、`next lint` 移除适配本仓 ESLint、impeccable 检测器说明改为本仓已装、命名规范 data-* 注记）。
- **不适配项**：v0 侧「项目未配置 ESLint」表述（本仓已配 eslint 10 flat）与「impeccable 仅 v0 环境」表述（本仓自带 .agents/skills/impeccable）——均已按本仓事实改写。
- v0-export 重新归档至 e4e0c74（150 文件+hash 清单重出）。

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

### 决议 014 补充（双壳统一，2026-09-21，用户裁定「不该统一吗」）

- 签名线扩展至营销壳 `.marketing-header::before/::after`（首页此前无线）：语义依据——该线是钱包连接状态信号，凡顶栏有钱包控件即应有。规则与产品壳共用（基础内边距同为 space-5，锚点选择器合并）；断点差异：产品壳锚点 54rem 缩至 space-3，营销壳 30rem 缩至 space-3（各自跟随壳内边距）。reduced-motion 降级同步覆盖。
- 首页验证注意：Next dev 对 globals.css 懒编译，改后首次截图可能命中旧 chunk——截图前先在浏览器确认规则已下发（getComputedStyle(el,'::after').content 或样式表扫描）。

### 决议 014 追记 · 标题条签名统一（2026-09-21，用户授权「开始修」）

- `.ax-echo-bar` 退役箱影执行（青实线 + `--echo-offset` 品红 box-shadow 同线拼接），改用本决议顶栏同一几何：青线贴区块底边框、右端锚定内容缘（`inset-inline-end: 0`）、`--space-8×4` 渐变消隐；品红回声 `::before` 下移 1px 扫描线（`calc(-2 * var(--line-echo))`）+ 左移滞后 `--space-6`、长度减半（`--space-8×2`）、52% 透明度渐变；≤30rem 长度减半（与顶栏一致）。
- 顺带修复布局碰撞：`SectionHeading` 长描述把 echo 线拉到描述最后一行高度、压住正文（`align-items: end` 下沉）——描述 `<p>` 移出标题行（新 `.section-heading__row` 只含 h2 + aside），签名线锚定 `border-block-end`，与描述长度解耦。
- **token 影响**：`--echo-offset` 消费点清零，token 删除（014 正文「不删」的前提不再成立）；`foundations.md` §5、`component-contract.md` §13 同步登记。
- 验证：tsc/prettier 通过；verse-page（创世详情页，长描述场景）与 showcase 全部 SectionHeading 三档视口复验。

## 2026-09-23 · 品红回声轨道光晕强度微调

- **范围**：`--glow-echo-rail`（定义 `components/design-system/tokens.css`，唯一消费 `app/globals.css` `.product-sidebar` box-shadow）。
- **决议**：导航栏右缘品红线光晕 `0 0 14px rgba(255, 6, 181, 0.7)` → `0 0 12px rgba(255, 6, 181, 0.55)`；线本体（1px `--accent-echo` 边框）不动。用户指令「稍微减弱一点点，但不要减太多」，非品牌方向变更，Agent 执行后留痕。
- **验证**：`pnpm build` 通过；prod 4175 重启后 2x 放大截图确认线本体完整、光晕收窄约 21% 且明显暗于线体。

## 2026-09-25 · 杠杆术语：债务额度（Debt quota）→ 借贷资金（Borrowed funds）

- **范围**：杠杆创世 UI 文案（表单实时预览、审阅屏出行；`copy.ts` `leverageDebtQuota`/`leverageDebtPreview` en+zh）。非品牌方向变更，Agent 据用户裁定执行后留痕。
- **决策**：OB 原词 debt quota 的「额度/quota」暗示未使用的配额，与机制语义不符——参与时即全额 mint 注入创世，是用户已产生、已使用的借贷资金。UI 改称「借贷资金 / Borrowed funds」；**机制口径与代码标识符（debt quota、Debt quota=interest÷rate 公式）不变**，「债务上限（Debt cap）/剩余可建额度」家族不动（那里才是真正的余量语义）。glossary.md B 节对账行同步。
- 用户原话要点：「Debt quota 的命名更像是一个未使用的额度，但是现在不是未使用的东西啊，而是用户已产生的债务，已使用的借贷资金」；前一轮已提出「站在用户的角度，这应该是借贷的资金」。
- **验证**：tsc/prettier 通过；杠杆审阅屏浏览器目检（利息金额+借贷资金两行）。

## 2026-09-25 · 按钮边缘统一：删机加工斜面（顶缘 inset 光 + 底缘 inset 暗 + 品红底缘回声）

- **范围**：`app/globals.css` 主题桥按钮段全部 box-shadow 边缘规则——基类 `[data-slot='button']`（顶青光 0.1/底黑 0.45）、default 黄板（顶白高光 0.3/底 2px 品红回声及其 :active 档）、`.swap-panel__cta` 与 `.ax-ghost-cta`（顶黄光 0.22/底黑 0.45，含 hover 顶白光 0.25、禁用顶黄光 0.1）、outline hover（顶青光 0.2/底黑 0.45）、禁用基类（顶青光 0.05）。非按钮元素（KPI 芯片顶缘青光、tab 黄指示条、POL 仪表、输入框等）的 inset 不在范围，维持各自登记。
- **决议**：用户裁定斜面光感（上亮下暗、底缘异色）不好看，按钮四向边缘一律同色。全部删除，基类钉 `box-shadow: none !important`（兼压 cva `focus-visible:ring-3`/`aria-invalid:ring` 工具类，与 `.ax-glow-cta` 先例同模式；focus 仍走 `tokens.css` 全局青 2px outline，不受影响）。default 黄板随之失去顶白高光与底缘品红回声——品红回声语言保留于 `.ax-glow-cta` 背板错位与徽章，按钮底缘不再使用。hover/active/disabled 反馈保留（bg/border/color 换档 + cva translate-y-px），仅去光感。
- **token 影响**：无 token 增删；被删值均为字面 rgba，非 token。
- 用户原话要点：「这种设计不好看，应该统一所有边缘颜色一致」（起因：Launch 页主 CTA、创世详情 Review participation/Revise amount/Confirm prototype state 下边缘偏暗，确认全站按钮同规则）。

## 决议 015 · 品红分层管辖：平面禁令改三层（2026-09-25，用户裁定「执行」）

- **背景**：决议 010/012 将品红定为「错位回声」并写成对品红的全球无条件管辖，但系统演进中品红已被数据语义层合法使用（生命周期 locked 阶段色、POL 仪表名义 datum 等），条文（配对回声）与实际（发丝级独立强调）漂移，合规长期靠变通维持（datum 只能做 1px 构造体操即例证）。用户裁定：该纪律限制创作自由、适用面太大、不合理。
- **诊断**：规则诞生于品牌铬层且在该层有效，但被写成平面禁令后蔓延到它没有管辖依据的数据语义层——信息设计中品红的合法性来自语义分工与可辨性，与「回声配对」无关。规则需要不断豁免/追认/变通才能维持，合规成本本身即规则形状错误的信号。
- **决策**：平面禁令改为**三层管辖**：
  1. **品牌铬层**（产品壳、签名元素、CTA chrome）：维持现行纪律——1–2px 错位线/内衬、小徽章、≥20px 大字或图形；
  2. **数据语义层**（`data-stage` 阶段色、图表系列、仪表 datum 等语义标记）：按数据层规则管辖——语义全站一致（locked 恒品红）、对比达标、数据墨水克制但**允许面填充**（图表系列、阶段徽章按数据编码需要）；不要求回声配对；
  3. **营销叙事层**（营销壳、hero、活动页）：最大自由度，品红大字/图形/渐变时刻允许，逐例人工过。
- **全层禁令保留**：正文与小字号禁用（对比 5.19~5.89:1 档）；不与黄（主行动）青（功能）争语义；禁三色同填同一控件。
- **效力**：修订 010/012 品红条款的**适用面**（回声签名保留于铬层，不废除；同日「按钮边缘统一」决议中按钮底缘不再用品红回声的既成事实不受影响）。同步 DESIGN.md 不变项/色彩表/Action control 行、token-contract.md 第 3 条、docs/design-system/README.md 硬约束 #4、.agents/skills/outrun-design-system/SKILL.md。v0 侧同名 skill 需人工同步（不在本仓管辖）。

## 2026-09-26 · 青档按钮（outline 变体）描边提亮 36% → 50% → 60%

- **范围**：`app/globals.css` `[data-slot='button'][data-variant='outline']` resting 描边（补登记：2026-09-25 同段「全站去底」——outline resting 灰底改透明、禁用同去底并 22%→32%，当时未入册）。hover 全亮纯青、禁用 32% 档不变。
- **决议**：用户两轮裁定提亮：36%（`--color-border-signal-strong`）→ 50%（2026-09-25）→ 60%（2026-09-26，「再提亮一点点」）。按钮局部 `color-mix(in srgb, var(--or-cyan) 60%, transparent)`，不动 `--color-border-signal-strong` token——同 token 的 KPI 芯片/卡片/输入/导航消费者不跟随。档序：禁用 32% < resting 60% < hover 100%。
- **token 影响**：无 token 增删。
- **验证**：dev + 4175 生产预览计算样式实测 outline 四边 `rgba(0, 240, 255, 0.6)`；截图目检。

## 2026-09-26 · 按钮两项：禁用视觉档全删；corner-shape 换轨尝试撤销（斜切形态保持原版）

- **背景**：用户三问——Add liquidity 右缘偏暗 → 实测根因=按钮基类 clip-path 切角使元素走解析路径栅格化，1px 描边失去整像素对齐（同按钮四边 53%–100% 强度不等、随视口宽度漂移）→ 用户裁定「删除禁用档状态」+「没被禁用的按钮也有边缘亮度不一致」。
- **决议 1（禁用视觉档全删，生效）**：`globals.css` 删 `[data-slot='button']:disabled`、`[data-variant='outline']:disabled`、`.swap-panel__cta/.ax-ghost-cta:disabled`、`.swap-panel__max:disabled`、`.swap-panel__rate-flip:disabled` 五段；`ui/button.tsx` cva 摘 `disabled:opacity-50`。disabled 属性保留，仅承担交互门控（不可点/aria），hover/title 照旧；state-matrix 的禁用语义为行为层不受影响。
- **决议 2（corner-shape 换轨，已撤销）**：曾按「边缘像素统一」目标把 clip-path 换为 border-radius+corner-shape:bevel（实验证明可令四边满强度单像素），过程两错：首版误切四角（原版仅左上+右下对角双切）；修正后仍改变角部渲染——corner-shape 使描边沿对角线走，原版 clip-path 的斜切是「裸切无描边」。用户裁定撤销，按钮切角保持原版 clip-path 实现，边缘亮度随亚像素抗锯齿漂移为 clip-path 固有代价、接受现状（与卡片/芯片同待遇，未单独处理）。涉及基类、`.ax-glow-cta` 伪元素、`.back-to-top`，全部逐字恢复原文；渲染与原版逐像素 diff=0。
- **token 影响**：无增删。
- 用户原话要点：「删除禁用档状态，根本没有禁用的按钮」「而且没被禁用的按钮也有边缘亮度不一致的问题」「直接回滚回去重做」「根本没有回滚到之前的样子」。

## 2026-09-26 · 卡片/芯片拆同边双笔叠画：删顶缘青 inset 光（2026-09-25 按钮决议延伸到非按钮件）

- **背景**：用户报 Stake 卡输入框下边缘比其他边粗且亮（截图像素实测：底边=亮青 #00f0ff5c 档 + 暗青两行叠带，顶边单行）。诊断：`border: 1px signal 描边` + `box-shadow: inset 0 1px 0 青` 两笔贴着画在同一边缘，非整数 DPR（Windows 150%，DPR=1.5）下各 1px 抗锯齿拆行，糊成 2-3 行不同亮度的青带；叠加 clip-path 亚像素漂移（前一条决议的固有代价）放大观感。样式层四边本一致（DPR=1 实测单行纯色均匀）。
- **决议（用户裁定「先做第2条」=拆双笔叠画，同边单笔）**：`globals.css` 删 13 处与描边同边的顶缘青 inset 光，保留描边单笔——`.threshold-panel`（唯一 `--inset-light-cyan` 消费者）、`.token-strip__chips div`、`.kpi-chips>div/.liquidity-panel__overview>div/.vault-panel__stats>div/.dao-panel__stats>div`（KPI 芯片合并规则）、`.pool-card`、`.pol-card`、`.vault-card`、`.dao-panel__tally`、`.cycle-card` 与 `[data-current]`、`.vault-panel__lists li`（hover 保留 2px 左选择线，仅删顶光）、`.pol-gauge`/`.pol-gauge__readout`/`.pol-flow`（仪器盒家族）。**保留**：`.pol-gauge` 下陷刻度槽（上暗下亮=sunken 建模，仪表内部件）与 `.pol-gauge__mark`（8×14 读数头）——刻意的立体语言，非卡面描边叠画；`.trade-chart/.swap-panel/.verse-tabs` 雨夜材质 `::after` 顶缘光渗（整面渐变镀膜，非 1px 描边叠线）。
- **token 影响**：无增删；`--inset-light-cyan`（#00f0ff2e）自此无消费者，定义保留待后续清理决议。
- **登记**：globals.css 注释（pol-card/vault-card/pol-gauge/pol-flow/读数牌/KPI 芯片）、DESIGN.md 视觉语言 #7 与布局 KPI 带行、docs/design-system/components.md 交易台/四标签容器行同步。
- **残余接受**：拆双笔后卡/芯片边缘仍存在 clip-path 亚像素亮度漂移（前条决议既定接受项）；本决议消除的是「双笔叠画糊带」这一层放大器。
- 用户原话要点：「是Stake 卡片里的输入框」「有没有根治的办法，不让缩放影响？」「先做第2条」。

## 2026-09-26 · 阶段双线规律：卡面上边缘回声线=下一阶段色（genesis 黄+品红 / locked 品红+青 / unlocked 青+黄）

- **背景**：用户报发现页 Locked 卡上边缘颜色「不对，没有规律」——此前回声线恒品红，Genesis 卡呈黄+品红而 Locked 卡呈品红+品红（两线同色）、Unlocked 卡呈青+品红，环不闭合。
- **决议（用户裁定规律）**：主线=当前阶段色，回声线=下一阶段色，沿阶段环 genesis→locked→unlocked→回环：genesis 黄+品红 / locked 品红+青 / unlocked 青+黄；refund 为终态无下一阶段，回声保持品牌品红（橙+品红）。
- **落点**：`globals.css` 阶段变量组增 `--stage-next`（选择器组扩为 `:is(.economy-card, .back-to-top, .verse-hero)[data-stage]`），`.economy-card::after` 回声线 `background` 改 `var(--stage-next, var(--accent-echo))`；`.verse-hero` 底部签名线同律（主线 `--stage-color`、回声 `--stage-next`，`verse-page.tsx` hero 根加 `data-stage`）——详情页与卡片同步。
- **决议 015 关系**：卡面阶段线属数据语义层（②），回声线在此承担语义（下一阶段预告）而非铬层回声纪律；铬层恒品红回声（顶栏签名线、`page-intro` 等）不变。`.action-panel` 顶部黄线=主行动信号（黄唯一主行动），不跟阶段、不加回声。
- **token 影响**：无 token 增删（复用 `--accent-primary`/`--accent-echo`/`--or-cyan`/`--color-warning`）；组件级新变量 `--stage-next` 已登记 components.md / component-contract.md。
- **验证**：tsc --noEmit 通过；发现页三 tab + 详情页 locked/unlocked 视觉复核（主线/回声两色按环取色）。

## 2026-09-26 · 按钮家族描边换 Paint Worklet 画皮（实验室 F 区验收通过，用户裁定「点头，就这样吧」）

- **背景**：同日早前裁定「接受 clip-path 亚像素漂移现状」后，用户要求继续探索；实验室页（/design-review/edge-pipeline）A–F 七轮实测：worklet 路线边线恒单线、无鬼影行、亮度下限 52%（clip-path 实测 28%+鬼影行/双行）；F 区真按钮解剖（含 hover 换肤）用户眼睛验收通过。canvas 路线两档（细版横边发虚/墨量版厚一档）被否。
- **决议**：全部 `[data-slot='button']`（default/outline/.swap-panel__cta/.ax-ghost-cta）描边+切角改由 Paint Worklet 绘制（`public/paint/chamfer-border.js`，`background: paint(chamfer-border)`）：worklet 画切角填充+四边发丝线；`--cb-bg/--cb-border` 皮肤变量经 `@property`（<color>）注册可平滑过渡（hover 换肤走 CSS 变量，transition-property 列入）；`components/design-system/paint-skin.tsx` 挂根 layout 负责 addModule + `--dpr` 同步（resolution MQ 重建监听）。
- **豁免两员**：`.ax-glow-cta` 自带 clip-path（品红/黄伪元素背板需裁形，自身描边透明无 AA 问题）；`.discovery-browser .back-to-top` 单角切角几何不同，其 0-2-0 !important 边框/底色天然压过基类画皮。
- **回落**：`@supports not (background: paint(...))` 恢复原 clip-path+border 基类（变体仅保文字色）——本仓生产口径 Chromium，回落只求不破形。
- **清除**：`.swap-panel__cta` 的 `--primary/--primary-foreground` 降噪通道（画皮后无消费者）。
- **token 影响**：无增删；`--cb-bg/--cb-border` 为 @property 注册的皮肤变量（非设计 token）。
- **实测**（4175 生产、DPR 1.5、真 .swap-panel__cta）：左右=满强度单列、顶=单行、底≈两行半强度（worklet 特征行为，下限 54%）；home/explore/launch/portfolio 四页按钮全部 paint() 且可交互。
- 用户原话要点：「点头，就这样吧」。

## 2026-09-26 · 补充：按钮 hover 换肤不再排除 disabled（用户发现「Add liquidity 没有悬停」）

- **诊断**：Add liquidity 等原型写操作按钮带 `disabled` 属性（交互门控，不伪造链上写入），而 hover 规则自旧 clip-path 时代即挂 `:hover:not(:disabled)`——disabled 钮悬停不变样是旧制遗留，非画皮回归；与同日「禁用视觉档全删（disabled 与 enabled 渲染像素一致）」裁定精神冲突（看着活着却无悬停反馈）。
- **决议**：按钮六条 hover 规则（default/outline/.swap-panel__cta/.ax-ghost-cta/.ax-glow-cta 及其 ::after）摘除 `:not(:disabled)`——disabled 钮获得与 enabled 一致的悬停换肤（画皮变量经 @property 平滑过渡，worklet 重绘）；`:active` 仍限 enabled（点击反馈保留给真可点件）。
- **验证**（4175 生产）：鼠标移入 disabled 的 Add liquidity——`:hover` 命中，`--cb-border`→纯青、`--cb-bg`→青 8% tinted、文字→青。
- 用户原话要点：「没有悬停 hover 吗？我说的是 add liquidity 按钮」。

## 2026-09-30 · DESIGN.md 追注清理 + 定稿纪律收紧（用户裁定「做」）

- **范围**：7 处时间点追注改写为现行规则或删除——KPI/卡片顶缘青 inset 光两处（改写为现行约束「同边单笔」，why 保留）、按钮 Paint Worklet 日期、决议 010 勘误叙事（保留「去极客≠去风格」口径）、决议 013 原值叙事、头部追认链、`--accent-primary` 对比勘误叙事（勘误全文存档于 `scripts/check-design-contrast.mjs` 文件头）。
- **决议**：定稿正文只反映最新状态，变更叙事（已删/已改 + 日期）只进本 log；条款写入 `docs/design-system/README.md` §5 变更规则与 DESIGN.md 头部。
- **token 影响**：无增删（当日另有 §2 表 accent-link 13.06:1 / accent-echo 5.21:1 补实测值、accent-primary 勘误 15.15→15.22，数值复算全表其余吻合）。

## 2026-09-30 · 一级页标题错版扩面 + 信号失真动效（用户裁定「加上多色错位效果，再加一些动效，类似于信号失真的那种晃动感觉」）

- **背景**：用户要求一级页标题美化——多色错位 + 信号失真式晃动。静效 `.ax-glitch-text`（决议见 2026-09-22）已有先例（verse ticker/Explore symbol/创建页标题），动效与本契约「装饰动效仅两枚（决议 010）」冲突，本次用户裁定扩为三枚。
- **决议**：① 错版静效扩面——发现页/收益组合页 page-intro 标题挂 `.ax-glitch-text`（复用 2026-09-22 类，无新色无新类；黄不参与，白+青+品红维持原裁定配对，不触「同一控件三色同填」负面项——主字形恒白，青/品红仅错位回声）；② 新增第三枚装饰动效**标题信号失真** `.ax-glitch-text[data-signal='live']`——7s 周期两段干扰窗（约 0.35s 主 + 0.14s 次），青/品红交叉换位+横向错帧（≤0.11em）+轻 skew（≤0.8deg），`steps(1,end)` 硬切丢帧感，静默帧与静态错位逐像素一致；③ 范围限发现/收益组合/创建三个 page-intro 页头；首页 hero 双色 lead+accent 营销字有独立裁定，错版白主字会盖 accent 色，不参与（用户可再裁）。
- **落点**：`globals.css` 增 `@keyframes ax-signal-jitter` 与 data-signal 规则（裹 `prefers-reduced-motion: no-preference`，叠加 tokens.css 全局装饰动效全停双保险）；`discovery-page.tsx`/`portfolio-page.tsx`/`create-page.tsx` h1 挂类与属性；`.discovery-intro h1` 一行上限 28ch→30ch（等宽+大写+0.08em 字距后 27 字符 en 标题加宽，保住「一行放下」原裁定）。
- **与既有纪律的关系**：决议 015 不变（品红 ≥20px 大字错位回声本就获准）；glow 纪律不触（text-shadow 实心 0 blur 非发光，标题非 `data-numeric`）；决议 010 例外化由本条承担，motion-and-a11y.md「两枚」段与 infinite 禁令同步改写；e2e 动效冻结（reduced-motion + animation:none 双保险）下基线取静默帧，无闪烁风险。
- **token 影响**：无增删。
- **登记**：components.md 增「标题信号失真」条目并改写错版字效应用面。

## 2026-09-30 · 补充：标题信号失真两轮改版（用户裁定「字体不需要调那么大…原来的字体就挺好的」「信号失真不是这种感觉…我想要的是突然花掉的那种感觉」）

- **改版一（字体）**：一级页标题不再借 `.ax-glitch-text`（等宽+大写+0.08em 字距的 ticker 皮肤视觉上偏大偏宽）；新类 `.ax-glitch-title` 只上青/品红双色 0.06em 错位 text-shadow，字体/字号/大小写全部沿用页头原排版。create 标题同步从 `.ax-glitch-text` 移到 `.ax-glitch-title`（三页头一致；ticker/Explore symbol 不变）。`.discovery-intro h1` 一行上限回 28ch（原字体度量）。
- **改版二（动效）**：`ax-signal-jitter`（持续轻晃）废弃，换 `ax-signal-scramble`——「突然花掉」式：8s 周期，主干扰窗约 0.6s（白核 color:transparent 熬灭 + 青/品红大分离 ≤0.34em 与单通道残留交替）+ 微干扰窗约 0.16s（两帧快闪），`steps(1,end)` 硬切；静默帧=基础错位，标题常态可读；reduced-motion 全停不变。
- **登记**：components.md「标题信号失真」条目与 motion-and-a11y.md 第三枚描述同步改写；token 无增删。

## 2026-09-30 · 再补充：信号失真定为「画面撕裂、横向拉成丝」（用户裁定「要突然花掉，就像画面撕裂的那种感觉，画面被横向拉成丝的感觉，重点不是晃来晃去，晃只是结果」）

- **定调**：前两版（整体错位晃动 / 白核熄灭+大分离）都被否——用户要的是撕裂：画面沿横向被切成带、各带被横向拉走拉长（拉丝）；晃只能是撕裂的副产物，不允许为了晃而晃。
- **实现**：text-shadow 无法切片，改双层副本结构——h1 内叠两层 `aria-hidden` 彩色文字副本（`.ax-glitch-title__layer-cyan` 向左拉 / `__layer-echo` 向右拉，transform-origin 分列左右缘），干扰帧内 `clip-path: inset(带% 0 0)` 横切带 + `translateX(0.2–0.62em) + scaleX(1.4–3.2)` 横向抻长拉走，带位逐帧跳变且青/品红错开；白核（h1 本体）只在个别帧掉带（自身 clip 走带）或整帧熄灭（color:transparent），自身位移压到 ≤0.04em。8s 周期：主窗约 0.6s（约 7 撕裂帧）+ 微窗约 0.16s，`steps(1,end)` 硬切。静息帧与上一版完全一致（副本层 opacity:0，只留 0.06em 双色错位），e2e 基线取静息帧不受影响。
- **约束**：副本层必须 `aria-hidden` + `pointer-events:none` + `text-shadow:none`；黄不参与；reduced-motion 全停。
- **登记**：components.md / motion-and-a11y.md 同步改写；token 无增删。

## 2026-10-01 · 信号失真推倒重做：四特征故障艺术（用户提供完整美学描述，前三版作废）

- **背景**：前三版（整体晃动 / 白核熄灭大分离 / 纯横带撕裂）连续被否（「什么乱七八糟的」）；用户提供完整美学参照——数码故障与像素撕裂（横/纵拉伸断裂+闪烁色块）、色彩分离（RGB 通道错位、多重虚影）、扫描线与噪点（CRT 质感）、画面滚卷与抖动（滚卷/高频抖动/瞬间黑屏）；意境=High Tech Low Life、信息过载、真实性动摇。
- **决议**：旧 `ax-signal-*` 全删，重写为 `ax-sig-fault-*` 五组动画，标题内 4 层 aria-hidden 副本——
  1. 像素撕裂：青/品红副本 clip-path **横带**（translateX 0.12–0.4em + scaleX 1.8–2.4 拉走抻长）与**纵条**（translateY ±0.1–0.16em + scaleY 1.9–2.6 拉断）双向交替，带位/方向逐帧跳变；
  2. 色彩分离：全像帧青 -0.12em/品红 +0.14em 错位 + 白色 `__layer-ghost` 重影（多重虚像）；RGB 按品牌通道对映射为青/品红 anaglyph 读法（色板纪律：不加红绿，黄不参与）；
  3. 色块爆闪：`__artifact` 实心矩形（青/品红交替）单帧跳现于标题面随机位；
  4. 滚卷黑帧：白核 translateY 行进（-0.14→-0.34→-0.6em）+ 过冲断带（clip）+ 白重影跟随滚卷；瞬间黑帧（整题 opacity 0）每窗 ≤2 帧；叠加高频抖动帧。
  8s 周期**四个不规则干扰窗**（主崩坏弧 0.62s 起 0.4s / 微闪 3.42s / 滚卷闪 5.74s / 单帧毛刺 7.1s，间隔 2.8/2.3/1.35/1.5s，打破节拍器感），`steps(1,end)` 硬切；扫描线=全站 `.ax-scanlines` 既有静态层，不重复实现。**熄灭纪律**：每个亮起 keyframe 后 ≤80ms 内必须显式熄灭帧（steps(1,end) 挂亮到下一声明帧；首版即因末窗漏熄灭帧导致残影/色块冻结约 2s——用户所见「崩坏」主因，已修）。
- **验证纪律**：静帧抽样不够——①程序化时间线审计：WAAPI `getAnimations({subtree:true})` pause+currentTime 定格，8s 每 40ms 采样 200 点，断言静默期全静止/无 >120ms 挂亮/黑帧 ≤100ms（首版审计出 0 违例前先抓出挂亮 bug——注意别用 animationDelay 定相位，运行中动画改 delay 不重置相位，全是假阳性）；②克隆节点 11 相位胶片条一张截图人工读弧线（分离→撕裂→黑→滚卷→黑→多重残影→微噪）。
- **不变量**：静息帧=0.06em 双色错位、字体/字号/大小写沿用页头原排版；reduced-motion 全停（静息即全效果）；e2e animation:none 时副本层 opacity:0，基线干净；黑帧为瞬时装饰帧，常态标题恒完整可读。
- **登记**：components.md / motion-and-a11y.md 同步改写；token 无增删。

## 2026-10-01 · 标题信号失真全部回滚（用户裁定「全部删掉，给我全新的提示词，我到新会话去重做」）

- **背景**：第四版实速播放下字母飞出、闪烁散乱无逻辑（用户原话：「闪的到处都是」「字母都飞哪去了」「失真效果是有逻辑性质吗」）。四轮均未实速录屏验证（本机无 ffmpeg，`agent-browser record` 不可用），静帧+WAAPI 审计代替了连续观感确认——这是验证方法的根本缺口，非实现细节问题。
- **决议**：删除 `.ax-glitch-title` 全套（类、4 副本层结构、5 组 `ax-sig-fault-*` keyframes，globals.css 共 445 行）；`discovery-page.tsx`/`portfolio-page.tsx` h1 回纯 `<h1>`，`create-page.tsx` 回 2026-09-22 裁定的 `.ax-glitch-text`；components.md 删「标题信号失真」条目、错版字效条目回原文；motion-and-a11y.md 回「装饰动效两枚、infinite 仅限骨架与 spinner」。本日上方四条实现史留档不删。
- **后续**：重做凭用户持有的全新提示词在**新会话**进行；提示词固化了四轮否决史的全部教训（排版不动/字母不飞/逻辑叙事/短爆长静/熄灭纪律/实速验证硬门槛）。
- **token 影响**：无增删。

## 2026-10-01 · 信号失真凭用户提示词重做落地（`.ax-fault-title`，新会话执行）

- **背景**：用户携回滚后固化的全新提示词开新会话重做。口径：静态层=青/品红双色错位虚影（黄不参与、不引入红绿）；动态层=赛博朋克信号故障美学（像素撕裂/色彩分离/扫描线噪点/滚卷抖动黑屏），关键是「突然花掉」——短促爆发其余完全干净，失真必须成体系，文字主体不能乱飞；技术路线授权 Agent 自设计，排版神圣不动。
- **决议**：新类 `.ax-fault-title` + `__dup`（aria-hidden 空载体 span），副本文本走 `data-dup` + `content:attr()` 伪元素——**零重复 DOM 文本节点**（读屏/选中/SEO 均无副本，较前四轮的实体 span 副本更干净）。静态层=青/品红 0.06em 对角错位 text-shadow（与 `.ax-glitch-text` 同值同形制；create 页由其双类规则 0-2-0 重申同值，动效类只补 position 锚点）。动态层=**一套失真例程**（回应「有逻辑性」裁定）：通道失谐 3 帧（±0.09→0.13em+换位）→ 扫描带撕裂下扫（带位自上而下=滚卷读法，translateX ≤0.07em + scaleX ≤1.4）→ 同带双色反移色闪（锚定于文字的「色块」，不设随机散块）→ 单帧黑屏 70ms（白核唯一变化=opacity，**transform 全程锁定，字母永不飞、主体永不晃**）→ 0.4 残影回锁。10s 周期两爆窗（主窗 1.4s 起 0.7s 弧 / 微窗 6.3s 起 0.21s 弧），70ms 帧 `steps(1,end)` 硬切，间隔 4.3/3.6s 不规则，静默期 ~93%。熄灭纪律：每窗末帧显式还原 opacity/transform/clip-path 三件套；动画仅在 `prefers-reduced-motion: no-preference` 内声明（叠加 tokens.css 全局策略双保险）；副本基态 opacity:0 + text-shadow:none + pointer-events:none + user-select:none——e2e animation:none 与 reduced-motion 下只剩静态 echo。
- **实现坑（新）**：create 页 h1 在 flex 收缩下盒宽 172px ≠ 文字宽 470px（居中溢出），副本 transform-origin 锚盒缘会把 scaleX 后的溢出文字甩出 ±100px（首版实速帧可见）——改 `transform-origin: center`（单行/折行/溢出三种盒型下都与文字中心重合）后收敛为 ±70px 内锚定拖丝。
- **验证纪律（10-01 回滚条要求全履行）**：① 静态闸 tsc/check:design/prettier 全绿；② WAAPI `getAnimations({subtree:true})` pause+currentTime 定相位，10s 每 35ms 采样 286 点断言 0 违例（静默期副本全隐/白核满亮、黑帧恰 70ms、副本最长连续可见 630ms、周期接缝一致；禁 animationDelay 遵守）；③ 克隆节点 11 相位胶片条逐相人工读弧（分离→撕裂→黑→回锁→微闪）；④ **实速录屏硬门槛**：ffmpeg 逐帧亮度/色度统计定位爆窗（explore 页主窗 21 帧=0.7s、黑屏 3 帧≤100ms、爆后干净 4.3s 与帧表吻合），explore 与 create 双页各录 13s（>全周期）实速观看——爆窗短促、无字母飞出、闪烁成体系；⑤ en/zh × 三页截图过目（zh 直接走 `/zh` 前缀）；⑥ e2e 基线再生成（explore ×3 视口 + zh-explore mobile 实际写入，portfolio/launch 静息差 <1% 容差内；全套 21 passed）。
- **登记**：components.md 新增「标题信号失真」条目；motion-and-a11y.md 装饰动效两枚→三枚、infinite 禁令加标题失真例外。
- **token 影响**：无增删。

## 2026-10-01 · 信号失真 v5 被否，v6 撕裂本体+越界封死重做（用户裁定「都他妈闪到导航栏去了，而且完全不是我想要的效果……你需要完全重做」）

- **背景**：v5（上条）实速下拖丝甩进左侧导航栏，且通道虚影绕完白字微动=装饰不成立——用户重申口径：横向像素拉伸/断裂做在画面本体上、伴随闪烁色块、系统将崩的紧迫感。
- **v5 两宗罪**：① 拖丝越界——scaleX 拖丝向两侧延伸（explore 左对齐标题旁即侧栏，左伸直接上导航栏）；② 无失真感——白核零参与，彩色副本小位移微闪，读作「描边彩光」而非「数据故障」。
- **v6 决议**：新类 `.ax-fault-title` + 双载体 `__chroma`（青/品红）/`__rip`（白撕裂层）。**撕裂做在字形本体**：撕裂帧 core 用多边形豁口把该带从本体切走（带内 echo 一并切走），`__rip::before` 白色带内容右移 0.26–0.3em 补位=内容真的被移走，青/品红同带异位 0.18–0.42em×拉伸 ≤2.6 叠加 RGB 分离；拉丝色块帧=细带 scaleX 3.2–3.6 拖成实色拖丝条；单帧黑屏 50ms；0.45 残影回锁。整题（h1 本体）transform 仍全程锁定——只有局部带撕，主体永不飞。10s 周期两爆窗（主 1.4s 起 ~0.45s 弧 / 微 6.3s 起 ~0.1s 弧），帧长 50ms `steps(1,end)`，静默期 ~95%。
- **越界封死（双保险）**：① `inline-size: fit-content` 把 h1 盒收敛到文字盒（治 create 页 flex 收缩盒 172px≠文字 470px 的病根；静息像素中性，e2e 基线零变化验证）；② h1 `clip-path: inset(-0.25em -0.5em)` 硬裁剪。**封锁纪律（本次实现期抓出的关键坑）**：动画一旦声明 clip-path，静态封锁即被 keyframe 值全程接管——首版 v6 的 core 豁口多边形只挖带无外边界=封锁形同虚设（WAAPI 审计 `h1ClipAlways:'none'` 当场抓获，未等录屏）；修复=外边界焊进 core 每一条 keyframe：基态帧=inset 本身、豁口帧=包裹盒挖带多边形，缺口即越界。撕裂带只向右位移（左对齐页旁即导航栏，永不向左）。
- **验证**：① 静态闸全绿；② WAAPI 400 采样×3 层 0 实违例（封锁 clip 全程 ∈ {inset 包裹盒, 带边界多边形}、无左移、无纵移、黑屏恰 [1600,1650)）；③ **三页实速录屏各 13s**，ffmpeg 逐帧定位完整主弧后 30fps 全帧逐帧读（每帧 33ms）：撕裂在字形上（字形中段横断错位+锚定拖丝）、拖丝右延到封界即断、黑屏 2 帧、回锁即恢复，侧栏与顶栏在全部 90 帧中零伪迹；④ e2e 21 passed 基线零变化（v6 静息中性）。录像留档 `/tmp/v6-{explore,create,portfolio}.webm` 交用户实速复核。
- **登记**：components.md「标题信号失真」条目改写为 v6。
- **token 影响**：无增删。

## 2026-10-01 · PD-07 勘误：发现页阶段 tab 无「全部」「退款」（用户裁定「全部 tab 是错误的，无法查看全部」「退款 tab 也是错的」）

- **背景**：管线评审引 PRODUCT.md 路由表「阶段 tab（创世中默认/锁定中/已解锁/全部）」提议补「全部」tab；深审补记另有「退款」tab。用户裁定两者皆错。
- **决议**：发现页阶段 tab 仅三个——创世中（默认）/锁定中/已解锁。阶段为分组维度、不跨阶段混排，无「全部」视图，跨阶段浏览仅经搜索（搜索词存在时越过阶段过滤）；退款态 Verse 的动线由 Portfolio 页承接，发现页内经搜索可达。三 tab 实现自始正确，无需改代码。
- **文档同步勘误**：PRODUCT.md 路由表 #3；`docs/page-briefs/product-intent.md`（R-03 段）；`docs/page-briefs/memeverse-discovery.md`（阶段 tab 行、排序切换行、URL 状态、fixture 覆盖注记）。连带清理：`copy.ts` `common.stages.all`（en/zh）为不可达孤儿键，经批准删除；`stages.refund` 保留（StageBadge 退款徽章在用）。
- **token 影响**：无增删。

## 2026-10-01 · 信号失真 v6 被否（设计感不足），v7 依市场范式重排编舞（用户裁定「你能不能参考一下市场最佳实践啊？设计感不行」）

- **背景**：v6 机械合格（越界已封死、撕裂在字形上）但观感不对——每帧只撕一条整齐带、自上而下太规律、副本位移单调、品红实色盖白核，读作「工程演示」不像「数据坏了」。用户要求参考市场最佳实践。
- **对标**（CSS-Tricks 经典 glitch 范式 + CodePen/教程共识，见 sources：css-tricks.com/glitch-effect-text-images-svg、freefrontend、alvarotrigo、tiny.cloud 教程）：① 爆发期**多步连击**、每步 1–3 条细散带（3–10% 高、位置乱序）——故障感来自密度非幅度；② 副本层每步**极性交替** ±2–6px；③ **`mix-blend-mode: screen`** 让通道重组——彩色只在暗底显形、与白字重叠处自然归白（根治 v5「品红盖白核」）；④ 短促爆发+长时间静默；⑤ aria-hidden 层 + reduced-motion 兜底。
- **v7 决议**：保留 v6 全部硬纪律（封锁 clip+fit-content、外边界焊进 keyframe、整题 transform 恒锁、data-dup 零重复文本、40ms 熄灭三件套），重排编舞——主弧 8 步×40ms：split（通道 ±0.08em 全像）→ 撕裂A/B（core 豁口切带 + 白 rip 带位移补位 + 青/品红细散带乱序极性交替）→ 湍流帧（`filter:url(#fault-turb-a)`：feTurbulence baseFrequency `0 0.55` 每条扫描线随机水平位移 ±7px = 信号撕裂质感，defs 挂 app/layout.tsx `.ax-fault-defs`）→ 拉丝连击（细带 scaleX 3.4–3.8）→ 黑屏 1 帧 → 回锁+轻湍流（turb-b scale 3.5 稳定余颤）；微窗 3 步。chroma 层 `mix-blend-mode:screen` + h1 `isolation:isolate`。静默期 ~96%。
- **实现事故留档**：sed 行号跨 prettier 格式化失效，keyframes 被插进 `.verse-hero` 规则体内（嵌套 @keyframes 非法整段丢弃、verse-hero 规则体一度丢失）——已脚本修复（keyframes 提回顶层、verse-hero 恢复），e2e 20 passed 佐证无附带损伤。教训：对 prettier 后的文件做行号手术前必须重新 grep 行号。
- **验证**：静态闸全绿；WAAPI 审计（帧表探针+400 采样）0 实违例（黑屏恰 [1600,1640)、封锁全程在场、位移界内；微窗换位 -0.10em 为设计内极性交替）；三页实速录屏 13s，爆窗段 30fps 全帧逐帧读——split→密集撕裂→湍流腐蚀帧→黑屏→回锁弧线成立、侧栏/顶栏全程零伪迹；e2e 21 passed 基线零变化。录像 `/tmp/v7-{explore,create,portfolio}.webm` 交用户实速裁决。
- **token 影响**：无增删。

## 2026-10-01 · 首页证明带 KPI 数字豁免等宽红线（用户裁定「选B」）

- **背景**：评审发现 `.home-proof-band__item strong`（app/globals.css）以 `font-family: var(--font-display)` 覆盖 `[data-numeric]` 的 `--font-data` 等宽规则，证明带三个数字（Total value locked 19.69M / Deployed economies 20 / Participants 3）实际渲染为 Saira Condensed 展示体，违反「数字字段必须等宽 + tabular-nums」红线，且是全站唯一既无裁定注释、又未登记的数字字体例外。
- **决议**：保留现状（评审报告二选一中的 B 案）——证明带数字维持展示体，正式豁免等宽红线。代码不改；globals.css 该规则处补裁定注释（与全站其他例外体例一致），本条即出处。
- **对比证据**：会话内 dev server 实机对比（computed font 实测：现状 Saira Condensed vs 注入等宽预览 IBM Plex Mono，2x 放大截图并排）：等宽版数字占固定宽度、更宽更「仪表盘读数」，营销展示张力下降；展示版与 band 标签同字体、视觉一体。等宽不挤破版式（数字格内居中），差距是气质取舍非优劣。用户在「A 删覆盖服从红线 / B 保展示补登记」间拍板 B。
- **效力范围**：仅首页 `.home-proof-band__item strong` 三个数字；全站其余数字字段等宽红线不变。
- **token 影响**：无增删。

## 2026-10-01 · 信号失真 v8 节奏调优（用户反馈「动画有点太快……时间间隔降低一点点，更频繁一些」）

- **决议**：仅调时序不改编舞——① 帧长 40ms→60ms/步（每态在 30fps 屏上占 ~2 帧，此前单帧闪过不可读）；② 周期 10s→8s、窗口前移（主窗 15%=1.2s、微窗 55%=4.4s），首爆 1.2s、窗间隔 ~2.7s/3.5s（v7 为 ~4.9s/5.1s），爆发更频繁且保持不规则；静默期 ~93%。黑屏 60ms（≤100ms 纪律不变）。
- **验证**：WAAPI 审计 0 违例（黑屏恰 [1500,1560)、封锁全程在场、静默期全净、各相位按谱）；三页实速录屏，explore 全帧差分定位三次爆发 1.03/4.00/9.03s 与帧表吻合，主弧 30fps 逐帧读——每态可读、弧线完整、零越界。e2e visual 20 passed（静息像素不变）。
- **流程教训（第三次踩同一坑，入库备忘）**：WAAPI 审计 pause 线上动画后必须 `play()` 恢复再录屏——本次又录到一次冻结页（YAVG 全平坦即判据），教训已写入 agent-browser 记忆。
- **token 影响**：无增删。

## 2026-10-01 · 信号失真 v8.1 移动端降档（用户反馈「移动端故障都偏离标题的文本老远了，你有录屏检查过吗」）

- **背景**：此前所有录屏验证均为桌面 1280 视口，移动端从未实速检查——用户质询成立。390px 实测（WAAPI 冻结撕裂帧截图）：balance 断行后首行 "Explore" 仅 ~130px 而 h1 盒 254px，桌面编舞的细带高倍拉丝锚在盒子裁剪缘（+0.5em），拖丝飘离短行文字 ~140px 悬在空白上——伪影锚「盒子」不锚「短行文字」，桌面盒≈文字故不可见。
- **决议**：≤30rem 换 `ax-fault-*-m` 移动特化编舞（时间窗与桌面 v8 相同）：去掉拉丝连击与湍流帧（小字号上噪且必飘），只留小位移局部撕裂——位移 ≤0.12em、scale ≤1.25，主弧 4 态（split/撕裂A/黑屏/回锁）微弧 3 态；封锁内边界同步收紧 ±0.2em 且焊进 core-m 每条 keyframe 形状。桌面（>30rem）规则零改动（animationName 实测切对）。
- **验证**：390px 冻结帧拖丝贴字；移动端实速录屏 11s，三次爆发 0.9/4.0/8.9s，主弧 30fps 逐帧读——撕裂贴字形、黑屏 2 帧、回锁干净、全程零飘浮；桌面 1280 回归四动画名不变；e2e visual 20 passed（移动静息基线不变）。
- **token 影响**：无增删。

## 2026-10-01 · Explore 卡头仅留 Symbol + flex-wrap（用户裁定「我在想把 Name 删掉，只保留 Symbol 怎么样？」→「确认」）

- **背景**：移动端 390 卡头文字重叠（`Chrono` 压 `市值$50.40M`、徽章被 `overflow:hidden` 裁切），根因 = 卡头单行 flex 无换行：市值 `nowrap+shrink-0`（2026-09-23 单行裁定副作用）+ 双徽章（Fast Genesis+创世中）`shrink-0` 合计 ~470px 超过 390 可用宽 ~326px，identity `min-inline-size:0` 无截断保护被压塌、不可断行单词直接盖到市值上；自 `5bbac09` 建卡头即存在，桌面 3 列窄卡（~414px）同病（BWOT/CBULL 基线已重叠），仅因 `zoom:0.8` 不显眼。
- **对照取舍**：三方案截图对照（`tmp-compare/`）后拍板——① 容器查询 480px 阈值被否：桌面 3 列卡全部 <480 一律折行，为修两张卡重排 11 张；② 保留 name 的 `flex-wrap` 版被否：第一行仍有名称折行观感；③ 拍板「仅 Symbol + flex-wrap」组合。另硬事实：双徽章+市值 ~470px 纯 Symbol 也放不下，flex-wrap 不可省。
- **决议**：① 卡头只留 Symbol 加粗 glitch 标题链接，name 进链接 `aria-label`（详情页全名、搜索按名称均不变）；② `.economy-card__header` 加 `flex-wrap: wrap`（市值/徽章放不下整组换行）；③ 详情页/资产组合页 symbol+name 并列不动（宽度充裕、全名有叙事价值）；④ 已知取舍：真实链上 ticker 可重名，卡片层消歧靠详情页兜底。
- **验证**：tsc --noEmit / check:design / vitest 70 passed 全绿；e2e explore 三档 + zh 移动基线重录后复跑 4 passed——单徽章卡全档恢复单行，双徽章卡（BWOT/CBULL）窄卡下市值+徽章两行整齐无重叠。
- **token 影响**：无增删。

## 2026-10-01 · 卡头恢复 Name（12ch 截断省略）+ Fast Genesis 文案简称 Fast（用户裁定「恢复 Name，但是 Name 的显示需要有一个最大长度限制，超出的部分替换成...」「Fast Genesis 的文案改成 Fast，简化一下」）

- **背景**：上一条「仅 Symbol」落地后用户再裁定——ticker 主导保留，但全名叙事不舍弃；且双徽章卡徽章文案过长是挤压源之一。
- **决议**：① 卡头恢复 Name，`.economy-card__name` 以 `max-inline-size: 12ch + text-overflow: ellipsis` 截断（CSS 截断保完整文本可及性；12ch 保证最坏组合下首行仍容 Symbol+Name+市值；ch 按「0」字宽计量，现行 fixture 名 ≤13 窄字符全部放行不咬合，超长名才截断）；② `copy.ts` 四处 `fastGenesis` 徽章/筛选项 label → `Fast`（en/zh 同；`fastGenesisNote` 说明文字保留全称不变）；③ 上一条的 `flex-wrap` 与本条截断互为冗余防线，均保留。
- **验证**：tsc / check:design / vitest / prettier 全绿；e2e explore 三档 + zh 移动基线重录复跑 4 passed——全档卡头统一「Symbol+Name+市值」一行 / 徽章一行（含桌面 3 列与单徽章卡，Name 回归后的自然形态），无重叠；Fast 徽章 en/zh 生效。
- **token 影响**：无增删。

## 2026-10-01 · 卡头 Name 缩档下缘对齐 + Symbol 限 5 字符（用户反馈「怎么 Name 的位置跑到上面去了？Name 的字体大小可以稍微缩小一点，字体的下边缘对齐 Symbol 的下边缘；Symbol 也需要长度限制，最多显示 5 个字符」）

- **根因**：Name 上浮 = `.economy-card__name` 的 `overflow:hidden` 使 inline-block 基线按 CSS2.1 规范退化为盒底缘（不再走文字基线），文字被抬升约一个下伸部高度。
- **决议**：① Name 字号 `text-md`→`text-sm` 缩一档，`vertical-align: text-bottom` 把盒底贴回父级下伸线，与 Symbol 字形下缘齐平（盒位实测 bottom 完全相等）；② Symbol JS 截断 `slice(0,5)+'…'`、全称进链接 `aria-label`——不用 CSS `ch` 限宽：glitch 字体 letter-spacing 0.08em 下 `5ch` 会把 5 字符 symbol 切成 4+`…`，字符数语义只有 JS 精确；仅 Explore 卡头生效，详情页 hero symbol 不动。
- **验证**：390 视口 DPR3 盒位量测 symbol/name bottom 相等；3x 截图下缘齐平；tsc / check:design / vitest / prettier 全绿；e2e explore 三档+zh 移动基线重录复跑 4 passed（fixture symbol 全 4 字符，截断对现行数据零像素影响）。
- **token 影响**：无增删。

## 2026-10-01 · 卡头截断收紧为严格字形数（用户裁定「Symbol 和 Name 我都要更严格的」）

- **决议**：省略号计入额度——Symbol `slice(0,4)+'…'`（≤5 字形）、Name 由 CSS `12ch` 宽度截断改为 TSX `slice(0,11)+'…'`（≤12 字形；`ch` 按「0」字宽计量，窄字形下 12ch 装得下 13+ 字符，字符数语义只有 JS 精确）。Name 改 JS 截断后拆除 inline-block/overflow/ellipsis/text-bottom 机械（overflow 基线退化补偿已无对象），回归自然行内基线，CSS 仅留 `text-sm` 字号。
- **验证**：tsc / check:design / vitest 70 passed / prettier 全绿；e2e explore 三档+zh 移动基线重录复跑 4 passed——fixture 内 Bitwave Otter/Solar Hamster（13 字符）如实截断为 `Bitwave Ott…`/`Solar Hams…`，短名不受影响。
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

### 决议 016 补充 · 面板化重排（同日二轮，用户反馈「不要流水帐、面板要有清晰分隔」）

- **背景**：首版四分区实现把全部内容压成同一种形态（描边盒 + 裸行直接铺在页面背景上），分区之间只有间距无边界——资产区读成流水账、两张 20 行表与页面融为一体，用户反馈要求「高度可读性、设计感、面板间清晰分隔、不要像整体难以区分」。
- **决议（全部回归 DESIGN §3.1 既有面板语法，零新 token）**：分区 = SectionHeading + **具名面板**——②余额=Data surface 面板（nameplate 铭牌行 + 行式清单 + 不可跨链资产压缩进面板页脚）；在途/滞留=**Signal panel**（青 tinted 描边，状态面板语法）；③收益库存单=Data surface 面板 + 紧凑表；④阶段组=顶缘 2px 阶段主线面板（复用 2026-09-26 阶段变量组，selector 组扩入 `.pf-vouchers__group`）；筛选=Signal 面板芯片（筛选语法）；页级信号行升格为 **KPI 状态带**（12px 对角双切 + 表面 inset + 青描边，§4 KPI 带版型，page-intro flex 收缩经 `:has()` 放开首块）；表格行 hover 落 Data surface 规定行为（抬升一档 + 首列 2px 青选择线）。①待办保持悬浮警报卡（紧急内容不上容器——面板密度会稀释紧急信号，形态对比本身承担分区识别）。
- **登记**：components.md Portfolio 六行同步改写；copy 键 signals 改裸标签 + groupLabel、assets 增 balancesLabel/readonlyLabel。
- **验证**：tsc（唯一错误来自外部并行会话在飞的 app-shell 重构，非本改动面）/ check:design 0 命中 / en-zh-desktop-mobile 四截图过 presentations:visual-judge 3/3 pass（专项断言：面板可辨起止、KPI 单行全宽、表格行数与铭牌计数一致、移动无溢出）。
- 签名：approved by Jasonrale（2026-10-02 会话反馈驱动，Agent 执行后留痕）

### 决议 016 补充 2 · 仓位/储蓄/收益金库拆分 + 金库列纠错（用户裁定「头寸，储蓄，收益金库不要放在一起显示，单独拆开」）

- **背景**：用户质询「收益库存单里的待执行/可领取激励是什么？根本没有这个功能」。经下合约层核实（本轮补课）：**MemecoinYieldVault.sol 上没有任何激励函数**——周期激励属治理侧 GovernanceCycleIncentivizerUpgradeable.sol:433 `claimReward()`，把它渲染进金库表=把 DAO 功能伪装成金库功能；「待执行/Execute」是自造词，合约动作=requestRedeem（MemecoinYieldVault.sol:334，锁仓停息）→ REDEEM_DELAY → redeem/withdraw 领回（:358/:425），产品语言（vault-actions）=Redeem/Withdraw。旧表两列作废。
- **决议**：① ③位拆为三个独立分区（按用户点名顺序）——**质押仓位**（OutrunStakingPositionUpgradeable.sol:152 `stakeForGenesis` 原子开仓+:217 `redeem`）/ **储蓄**（OutrunUSRVaultUpgradeable.sol:152-170 存取+:177 `usrRate`）/ **收益金库**（份额/价值/7日年化 + 赎回状态：等待中 N 笔 / 可取出绿字=claimableRedeemRequest 口径:500；行操作深链 verse 金库页签——金库属 Memeverse 域，完整 Redeem/Withdraw 流程住在 verse 页，与 CDP/USR 的就地展开形成域二分）；② 周期激励只出现在①待办聚合卡（PD-02 明文项），聚合卡 CTA 深链最近截止 verse（新增 focusVerseId）；③ 待办金库卡文案改产品词（Vault withdrawals ready/收益库可取出 + Withdraw/去取出，CTA 锚 #pf-vault）；④ 储蓄卡利率三态补齐渲染（Earning/生息中标签此前有键无渲染）。
- **fixture 影响**：FixtureVaultRow 删 incentive 字段（激励数据只服务待办聚合，从 getFixtureGovernanceState 直接取）。
- **验证**：tsc/check:design/vitest 112 绿；zh 断言 无「待执行/可领激励」、三分区标题在位；en 断言 旧标题清零 + Earning 在位；visual-judge 复验（首轮 3 FAIL 抓出 en 标题静默替换失败 + stateActive 未渲染，均已修）；e2e 基线重录全套 passed。
- 签名：approved by Jasonrale（2026-10-02 会话裁定，Agent 执行后留痕）

### 决议 016 补充 3 · 仓位卡四项收敛（用户裁定）

1. **删「Opened for {name} genesis」来源行**——无实际意义；repository 的 `openedFor` 暴露随之移除（fixture 字段与 schema 保留为机制出处登记，无消费方）。
2. **sUSDe→UUSD 锚族修正**：pos-002 的 yieldSource「Ethena」在 yield-sources registry 无条目（悬空引用），锚族推导曾回落到字面 'UAsset'；补 `ysrc-003 Ethena（anchor=USD，assetIds=[asset-022 sUSDe]）`，Borrowed 单位现正确显示 UUSD。fixture manifest/hashes 已重出。
3. **删卡片五件套短标签**（无到期·无利息·无清算·随时可赎）——用户认可判断：事实行+Redeem 按钮已承载语义，五连否定是噪音；PD-09 大白话全口径保留在赎回弹窗（cdpPlainFull）。cdpSource/cdpPlain 两文案键删除。
4. **en 分区标题 Title Case**：Staked Positions / Yield Vault / Assets & Cross-Chain（zh 不受影响）。
- 验证：tsc/vitest 112 绿；en/zh 浏览器断言（卡片三行内容=铭牌/事实/生息来源、UUSD 正确、标题大小写到位）；e2e 基线重录全套 passed。
- 签名：approved by Jasonrale（2026-10-02 会话逐条裁定）

### 决议 016 补充 4 · ②资产区五项收敛（用户裁定）

1. **按钮文案**：「1:1 convert」→「Convert」（弹窗标题与 convertNote 保留 1:1 披露——动作词归按钮，机制归弹窗）；zh 同步「转换」。
2. **删 Save 按钮**：存入储蓄入口与③储蓄区冗余；AssetRowView.usr 字段与页内接线随之移除。
3. **uAsset 全链属性核验（保留 Bridge）**：OutrunOFTUpgradeable.sol:5 继承 LayerZero OFTCoreUpgradeable；OB outstake/uasset.md:33「follows the LayerZero OFT standard and moves 1:1 across chains」——uAsset 与 GenesisCredit 均为 OFT，Bridge 保留有据。
4. **删 Non-bridgeable 页脚**：储备/原生（USDC/ETH/BNB）余额与本产品无关，repository 出表口径收窄为 uasset+credit；PSM Convert 弹窗 Redeem 侧 Max 数据改由新 getter `getFixtureReserveBalances()` 供给（储备不再是资产、仍是兑换对手盘）。
5. **资产行重设计（去草稿化）**：链分布改为入嵌底芯片（surface-inset+边框+xs 记号），总量移到行右缘作等宽大数锚点（text-lg data 字体），行结构=资产标识 | 链芯片 | 总量 | 动作——「在哪」居左、「多少+操作」居右，消除总量与链数值同排裸奔的流水感。
- credit 文案简化：「Claim on the home chain, then transfer freely.」/「主链领取后可自由转链。」
- 验证：tsc/check:design/vitest 112 绿；en 断言（Save/Non-bridgeable/USDC 清零、Convert/新 credit 文案在位、total=IBM Plex Mono 20px）；移动 390 无横向溢出；e2e 基线重录全套 25 passed。
- 签名：approved by Jasonrale（2026-10-02 会话逐条裁定）

### 决议 016 补充 4 · 质押仓位卡网格→面板+表格（2026-10-04 用户裁定）

- **背景**：用户质询「如果存在大量的头寸该如何显示？需要设计完备的组件，而不是显示三张卡片就完事」。仓位事实集合同构（链/抵押/债务/生息来源/唯一动作），行数随参与创世线性增长；卡片网格在 10+ 行时既扫不动也比不了，且三卡片布局本就是设计系统负面清单 §3.10 禁项。
- **决议**（Q1–Q4 四项逐项拍板，会话问答）：① 形态=`.pf-panel` + `.pf-table`（复用金库表语法，行 hover=Data surface 行为，动作列 Redeem 链接触发既有弹窗，`CdpRedeemDialog` 增 `appearance='link'`）——合约 `redeem(positionId)` 逐仓操作、无批量（OutrunStakingPositionUpgradeable.sol:217），逐行动作是机制正确的；② 默认排序=债务降序（最大敞口优先；合约 Position 无时间戳，「按新近」真源无数据不可做）；③ 链筛选=`.pf-positions__filter` 芯片组，`?chain=<chainId>` URL 状态（凭证区 `?claimable=1` 同款零客户端态），数据跨 ≥2 链才渲染；④ 铭牌行=计数+按锚族债务合计（`__owed`，族序=合计降序）；⑤ 行内 `__short` 余额不足警示小字（钱包 uAsset < 该仓债务时，开弹窗前分诊）。分页/虚拟滚动明确不做（不藏数据，50 行≈2200px 纵向滚动可接受）；「来自 {verse} 创世参与」不复活、五连否定短语不回行内（补充 3 裁定维持）。窄视口芯片组宽于标题行：`.pf-positions` 标题行可换行 + aside 限宽（visual-judge 首轮抓出 390px 页级横向溢出后修复）。
- **fixture**：positions.json 3→9 行（同链多仓/同锚族聚合/Lido+Aave+Ethena 全覆盖；新增行遵守 schema 面值平价不变量与六链白名单；原三行及 scenario 标签不动）；manifest 重出。
- **效力**：修订决议 016 裁定 5 中「仓位=异构卡网格」的形态归属（储蓄仍为卡网格）；`.pf-card[data-type='cdp']` 分支退役，`.pf-card` 仅储蓄在用。
- **验证**：tsc / vitest 112 / check:design 0 / check-fixture-boundary --source / prettier 全绿；浏览器断言（9 行债务降序、合计 425.5 UETH · 219,500 UUSD、?chain=8453 → 3 行 Base、Short 15,000 UUSD 在位、zh 全键对应）；e2e portfolio 三档基线重录。
- 签名：approved by Jasonrale（2026-10-04 会话四项问答逐项拍板）

### 决议 016 补充 4 二轮修订 · 对齐/文案/筛选交互（2026-10-04 用户反馈三点）

- **反馈原话要点**：「这些都没有对齐啊」「Short 15,000 UUSD 又是啥东西啊？」「标签筛选切换的时候怎么整个页面都要重新刷新？应该只刷新 Staked Position 卡片」。
- **修订**：① 数字列表头右对齐随数据——`.pf-table th[data-numeric]` 规则本在，仓位表（抵押/借入）与金库表（份额/价值/7日年化）表头补 `data-numeric`，表头锚数据列尾；② `__short` 文案去交易黑话：en `Short {n} {u}` → `Needs {n} more {u} to redeem`，zh → `还差 {n} {u} 才能赎回`（语义=钱包该 uAsset 余额不足赎回此仓，开弹窗前分诊）；③ 链筛选从 `?chain=` URL 导航改为组件内客户端态（`useState` + `button[aria-pressed]`，瞬时切换只换表格内容与铭牌合计——URL 态整页刷新被否；芯片外观与凭证区 selector 组共享，交互模式分叉：button 客户端态 vs a URL 态）。`chainFilter` prop 与路由 `?chain` 参数链路撤除。
- **验证**：tsc / vitest / check:design / prettier 全绿；浏览器断言（表头右对齐、按钮切换零导航、en/zh 新文案）；e2e portfolio 三档基线重录。
- 签名：approved by Jasonrale（2026-10-04 会话反馈驱动，Agent 执行后留痕）

### 决议 016 补充 4 三轮修订 · 链列图标化（2026-10-04 用户裁定「Chain 直接显示一个图标，悬停气泡显示链名称」）

- **决议**：链列文本 → `ChainLogoMark` 官方链 logo 图标钮（`components/global/chain-icons` Trustwallet 资产，chainId 1/8453/56 均有映射），链名退为悬停 tooltip（复用 `components/ui/tooltip` base-ui 原语 + `[data-slot='tooltip-content']` 全局切角气泡皮肤，零新 token）；SR 可访问名走 Trigger `aria-label={chainName}`（img alt="" 无声）。触达面：桌面 hover、键盘 focus 亦弹 tooltip（base-ui 行为）、读屏读 aria-label；触屏无 hover 时链名不可见=已知取舍（图标官方可辨，筛选芯片带链名全文）。
- **验证**：tsc / vitest 112 / check:design 0 / prettier 全绿；浏览器断言（9 图标 16px 渲染、真实鼠标 hover 弹出「Ethereum」气泡、aria-label 在位）；e2e portfolio 三档基线重录。
- 签名：approved by Jasonrale（2026-10-04 会话裁定，Agent 执行后留痕）

### 决议 016 补充 4 四轮修订 · 两处解释性文案删除（2026-10-04 用户裁定）

- **删除 1（赎回弹窗大白话句）**：弹窗 `panel-note`「No maturity, no interest, no liquidation. Redeem anytime — …」（zh：无到期、无利息、无清算…）整句删除，`cdpPlainFull` 文案键（en/zh）与渲染行移除。修订决议 016 补充 3 裁定 3「PD-09 大白话全口径保留在赎回弹窗」的承载——用户裁定该句无存在价值；机制口径（无到期/无利息/无清算）真源不变，仅不再上 UI。
- **删除 2（行内余额不足提示）**：`__short`「Needs {n} more {u} to redeem / 还差 {n} {u} 才能赎回」整组删除（渲染、计算、copy 键、CSS 规则）——二轮才改过文案，用户仍裁定没意义；赎回余额校验只住在弹窗内（AmountField balance 上限）。
- **验证**：tsc / vitest / check:design / prettier 全绿；浏览器断言（弹窗无该句、行内无提示、弹窗开启正常）；e2e portfolio 三档基线重录（首行高度随提示删除回落）。
- 签名：approved by Jasonrale（2026-10-04 会话裁定，Agent 执行后留痕）

### 决议 016 补充 4 五轮修订 · 列宽分配（2026-10-04 用户裁定「Chain 列宽度太大，优化各列宽确保最佳视觉效果」）

- **根因**：`.pf-table` 为 `inline-size:100%` 的 auto 布局表，剩余宽度被引擎均摊到所有列——16px 图标的链列被撑到数百像素，数值列右缘彼此远离，行内阅读动线散架。
- **决议（一版被否）**：colgroup 数据列收内容宽（链列 3rem、其余 1%）、来源列吸走全部松弛——数据块居左、Redeem 钉右缘。用户否决：「中间这么大空白」——松弛全塞一列=单条空隙带，构图不成立。
- **决议（二版）**：`.pf-positions .pf-table` 改 `table-layout: fixed` 比例分配——链列 `__col-chain` 3.5rem 定宽、抵押/借入各 28%、动作 8rem、来源列吸剩余。空白拆散进列内，但暴露新问题：Source 文本与 Borrowed 数字仅隔 24px，文本列与数值列贴死=分组错误（用户三INPUT轮反馈）。
- **决议（三版，现行）**：列序重排 Chain|Source|Collateral|Borrowed|Redeem——「在哪居左（链+来源），多少+操作居右（数值+动作）」，决议 016 补充 6 资产行同款分组语义。两组成构图：左组（图标+文本 36px 同组间距）· 组间呼吸带（source 右松弛）· 右组（数字右对齐成块 24px 贴动作）。2000px 实测内容间距 36/369/24；visual-judge 判定 ledger composition 成立、harmony acceptable 四档全过。
- **决议（三版微调，同日用户两点指令）**：① Chain→Source 间距 36px 偏紧→`__col-chain` 3.5rem→4.5rem（实测 54px）；② 数值块左移→`__col-act` 8rem→12rem（数字右缘→Redeem 链接 24px→96px）。两档视口几何一致（2000/1280 实测相同 gutters），visual-judge 复验 harmony acceptable「no mis-proportion remaining」（右块占表宽 ~50-53%，classic ledger rhythm）。注意：页面壳层有 max-width（2000 视口下表格实际 1230px 居中），列宽比例以表宽为基准。
- **决议（三版加幅，同日用户裁定「看着没变化，幅度要大一些」）**：链列 4.5rem→**7rem**（图标→Source 54→92px）、动作列 12rem→**18rem**（数字→Redeem 96→191px）、抵押/借入 28%→25% 腾移。暴露 fixed 布局边界：<64rem 视口面板容不下列宽和（720px>640px 滚动表宽），source 列被硬裁成负宽、文字叠印（visual-judge 抓出）→ 增加窄视口回退：`@max-width 64rem` 恢复 auto 布局由 min-content 保护，面板内横向滚动均摊。桌面三段间距 92/345/191（2000px），1280px 下 92/184/191 近均衡；visual-judge 五档复验全过（2000/1280/860/390/zh390）。
- **决议（三版二轮加幅，用户再裁「看着没变化」）**：链列 7rem→**10rem**（图标→Source 92→**144px**）、动作列 18rem→**21rem**（数字→Redeem 191→**240px**）、抵押/借入 25%→20%。1280 视口 source 列 113px 仍容「Ethena」单行（预算边界：chain+act 定宽和 ≤ 表宽 54%-92px）。visual-judge 实测 144/240px 判「4-10x 旧版，并排一眼可见；luxury spacing, not detached」两档全过。
- **排查记录（用户连续两轮「没变化」的疑似根因）**：`.next` 生产构建停在 10-02 06:47（两天前）；4175 生产预览未起。Agent 侧所有测量均来自 dev:3000（turbopack 热更新）确认改动在位。本轮已 `pnpm build` 重建生产并重启 4175 预览（页面含新列宽类）——若用户看的是 4175 或旧 tab，需刷新后才反映最新布局。
- **决议（三版微调，同日用户指令「Borrowed 和 Source 列稍微往右移动一点点」）**：① Source 列内边距 12→24px（文本右移 12px，chain 间距不动，表头同步）；② 动作列 21rem→19rem（数值块右移 33px，数字→Redeem 240→207px）。visual-judge 两档复验 pass（两组成构图完好、Borrowed→Redeem 207px「clearly separated」）；e2e portfolio 三档基线重录；生产 .next 同步重建、4175 预览重启。
- **决议（三版三轮：用户指令「Borrowed 回调一点、Collateral 往左移动一点」+ 前置指令「Source/Borrowed 右移幅度大一些」）**：① Source 列 padding 落定 `var(--space-8)`=64px（累计右移 ~50px；曾试 calc 双倍 128px——gap1 飙到 256px 破坏前轮比例，回退）；② 动作列 14rem→**17rem**（Borrowed 回调，数字→Redeem 127→175px）；③ **Collateral 列独立收窄 20%→17%**——两数值列右缘错开（2000 视口 246px/1280 视口 203px 阶梯），数字→Redeem 与 Collateral→Borrowed 通道均衡。visual-judge 判「intentional dual-axis ledger alignment, not a mis-alignment bug」（两列各自 9 行共线 + 表头 1px 对齐 + 单位不同本属独立台账）；静态闸全绿；e2e 三档基线重录；生产重建、4175 重启。
- **决议（三版四轮：用户指令「Collateral 列继续左移」）**：Collateral 列 17%→15% **并加列内右内边距 `var(--space-6)`**（纯缩列宽会被 source auto 列吃掉——列尾不动、数字纹丝不动；padding 直推数字左移 44px），错开 246→**291px**（2000）/243px（1280，列宽随表收窄通道压缩但结构完好）；Borrowed 22%/Redeem 175px 不动。1280 视口 coll 列 152px ≥ 数字 109+边距 36=145（4px 余量，无溢出）。visual-judge 两档 pass（「no crowding on either side」「ledger reading holds」）；静态闸全绿；e2e 重录；生产重建、4175 重启。
- **决议（三版五轮：用户指令「再左移一点点，稍微一点点就行」）**：≥90rem 宽屏 Collateral 右内边距 32→48px（`calc(space-6+space-4)`，数字再左移 16px→右缘 1132）；**1280 视口刻意不动**（列宽 152px 已无余量，任何全局加大都会溢出——宽屏加档用媒体查询，不抬基础值）。visual-judge 两档 pass（2000 落点 1130 与目标 1132 一致、表头对齐；1280 与已批准版逐像素一致无回归）；e2e 25 passed；生产重建、4175 重启。
- **验证**：tsc / vitest / check:design / prettier 全绿；DOM 实测列宽（2000px：56/344/344/357/128；1280px：56/284/284/263/128）；visual-judge 四档复验（2000/1280/390/zh390）；e2e portfolio 三档基线重录。
- 签名：approved by Jasonrale（2026-10-04 会话裁定，Agent 执行后留痕）

### 决议 016 补充 6 · ②资产行精雕（2026-10-02 用户反馈「无聊、草率、字号间距没精雕」）

- **对标**：Phantom/Rainbow/Zerion 组合页资产行公共形态——左侧资产视觉锚 + 符号，右缘两行堆叠（数量为主、法币值为辅），元数据退为安静第二行。
- **落法（全部系统内素材）**：40px 单角切链徽瓷片（主链=最大余额链，Signal 边+inset 面）作行锚；符号 text-md 下链分布降为 xs 裸记号第二行；右缘堆叠=总量（--text-num-lg 22px KPI 读数档等宽）+法币折算（usdSample 首次上行，「≈ $381.30M」）或 credit 领取说明；固定轨宽 `16ch 200px` 保证各行数字右缘共线（行=独立 grid，auto 列随按钮数漂移——Genesis Credit 行曾右移 100px）。
- **移动端坑**：chains 嵌在 id 内（符号下第二行），旧模板给它设独立 grid-area——幽灵命名区把它推进 id 的隐式第二列（实测 x=195 vs 81，与隐式列宽 110+gap 严丝合缝）；模板简化为两行、删幽灵 area 规则后四行芯片左缘全部对齐 81px。
- **验证**：tsc/check:design 绿；DOM 实测（四行 chainsX=81、totalRight==actionsRight==365——judge 报的 14px 按钮缘差为切角画皮的视觉收窄，盒边相等）；visual-judge 桌面 pass/移动两轮收敛；e2e 基线重录 25 passed。
- 签名：approved by Jasonrale（2026-10-02 会话反馈驱动，Agent 执行后留痕）

### 决议 016 补充 7 · ③储蓄卡重做（2026-10-04 用户反馈「视觉效果无聊、文案意义不明、可读性差」）

- **背景**：储蓄卡与 CDP 卡同构的 label/value 堆叠——利率渲染成裸数字（`formatPercent` 调用点漏补 `%`，显示「5 Earning」）；`42,000 suETH` 份额行是全卡唯一无标签裸行；四行信息挤在 xs/base 两档无层级。两路市场调研（Sky/Spark/Aave/Ethena/Morpho + Lido/银行利率卡，报告存会话记录）共识：仓位卡主数字=存款价值、利率=带限定词的事实行、状态用文案本身表达（Ethena "Not earning"）、份额兑换率配解释句（Aave 界面原文句式）；usrRate 按秒复利与 Sky DSR/SSR 同公式，APY 术语有先例。
- **决议（Q1–Q4 用户逐项否决：都是没什么意义的数据——零新增 fixture 数据，纯呈现层）**：① 主数字块 `__holding`：存款价值升 `__hero`（22px data 档，资产行右缘总量同款），副行 `__sub`=法币折算（usdSample 经 repository 视图层透出，缺失隐藏——资产行同款槽位）+ 份额凭证记号（带「份额/shares」词）；② 利率行=`%`+`__unit` 年化单位+三态标签（Earning/Not earning/`__flag` Rate capped 带 title 机制提示）；③ `__note` 三态语义句各一句（生息=按秒计息来自协议注资预算/未激活=份额暂不增值存取照常/封顶=增长暂停本金已计不受影响——全部 OutrunBook usr.md 口径）；④ 铭牌行链名加 ChainLogoMark（资产行同源）；⑤ 分区副标题改用户话；⑥ 存取弹窗加 shareNote 凭证解释句（「{share} 是存款凭证——取出返还本金+已计利息」）；⑦ `formatPercent` 三处调用点补 `%`（储蓄卡/收益表 7日年化/转换弹窗费率）；`.pf-card__meta`/`__source` 随卡网格退役删除（最后消费方消失）。
- **效力**：修订补充 2 中储蓄卡「事实 dl+meta」结构登记；「储蓄仍为卡网格」维持（补充 5）。
- **验证**：tsc / vitest 112 / check:design 0 / check-fixture-boundary --source 全绿；e2e portfolio 三档基线重录 + visual-judge。
- 签名：approved by Jasonrale（2026-10-04 会话裁定「1-4 都不加，都是没什么意义的数据」后授权实现）
- **同日二轮裁定（交付后用户复审）**：① dt 标签 Rate→**APY**（zh「年化」）；② 未激活态显 **0%**（灰），不再显示 Not earning；③ 状态词全删——Earning/生息中、Rate capped/利率受限 chip、`cappedHint`「都没什么意义」；④ 三句 `__note` 语义句全删。利率行收敛为「APY 标签 + % 数值二态」（rateActive→绿 %，否则灰 0%）；capped 不再上 UI（fixture/repo 字段保留，显示层不消费）。撤销补充 2「三态标签补齐渲染」中状态词部分与本补充一轮的 ②③ 两项；copy 键 `rate`/`rateUnit`/`stateActive`/`stateInactive`/`stateCapped`/`cappedHint`/`note*` 删除，`apy`/`sharesWord`/`shareNote` 保留；CSS `.pf-card__state`/`__unit`/`__flag`/`__note` 退役，`.pf-card__facts [data-state='inactive']` 灰新增。存取弹窗利率行同步（APY/0%），shareNote 凭证句不在删除清单、保留。
- 二轮验证：tsc / vitest 112 / check:design 0 全绿；e2e portfolio 三档基线重录。
- **同日三轮裁定（复审截图圈注「18,500 suUSD shares 位置不舒服」+ 弹窗文案删除）**：① 份额从副行移入事实格——`__facts` 改双列（APY | Shares/份额 并排，label 上 value 下），副行只留 `≈ $` 法币折算（价值表述归主数字旁，份额=独立持仓事实归事实区，消除份额数字与主数字同行撞车）；② 存取弹窗 `shareNote` 凭证解释句删除（en/zh 键删，二轮「保留」口径作废）；`sharesWord` 键改名 `sharesLabel`（en 'Shares' 作 dt 标签）。CSS：`__facts` 双列 grid、`__sub` 收窄为单行文本。

### 决议 016 补充 8 · 删②在途 Signal panel（2026-10-04 用户裁定）

- **背景**：用户出示在途卡截图（sent/stranded 未终结消息列表）裁定「跨链卡删掉」。
- **决议**：②资产与跨链区只留余额面板；在途 Signal panel 整体退役。语义分工：sent=无需行动，不占版面；stranded=有后果项，仍由①待办区 stranded 卡承接（Recover 弹窗不变）。KPI 状态带四段→三段：在途段删除；滞留段锚点 `#pf-assets`→`#pf-actions`（滞留卡唯一所在地）。跨链弹窗（Bridge/Convert/Stranded）与 `?claimable`/`?chain` 筛选不受影响。
- **效力**：`.pf-panel--signal` 变体与 `.pf-transit*` 全组规则退役（最后消费方消失）；copy 键 `inTransitTitle`/`stageSent`/`stageStranded`/`signals.inTransit` 删除，`inTransitSafe`/`recoverCta` 保留（滞留弹窗在用）；`getFixturePortfolioSignals` 删 `inTransit` 字段。修订决议 016 中「在途=Signal panel」归属；PD-02/M4「delivered/settled 历史不展示」口径不变。
- **fixture 影响**：无（bridge messages 数据保留，仅视图层不再出在途计数；manifest 不动）。
- **token 影响**：无增删（`--color-border-signal` 仍有 pf-kpi 等消费方）。
- **验证**：tsc / vitest 112 / check:design 0 / check-fixture-boundary --source / prettier 全绿；e2e portfolio 三档基线重录。
- 签名：approved by Jasonrale（2026-10-04 会话裁定）

## 2026-10-02 · 三列卡 zoom:0.8 登记为已知密度妥协（P1-2 登记类收口，用户裁定「做」）

- **背景**：P1-2 评审指出 ≥80rem 三列 `.economy-card` 整卡 `zoom: 0.8`（globals.css 三列断点）比例失调——内部版式按宽卡设计后整体缩到列宽，缩放后字号/间距不对应任何 token 档位，报告将其归为登记类（需人工决议，非顺手小修）。
- **决议**：接受保留，登记为已知妥协。理由：① zoom 使卡头逻辑内容宽 = 列宽/0.8（≈1.25×），是 2026-10-01 卡头 flex-wrap + 严格字形截断修复的配合条件——单独移除会让挤压与换行触发面扩大，移除的正路是三列专属窄卡 token 版式（字号/间距/切角整体降档重排），工程量大，当前不做；② 同轮四方案对比（修复前/报告建议 anywhere 断行+市值省略/现方案/两段式）确认现方案维持，报告建议不采（词内断行排版质量差、市值省略先吃量级字母 B/M/K），两段式候选挂起不改（触发面小：39 卡 fixture 仅 3 张 name 超 12 字形，wrap 逐项换行只掉徽章不掉市值）。
- **效力**：globals.css ≥80rem 断点的 `zoom: 0.8` 保留；后续评审不再将其作为待修复项重复报告；未来若要移除，须走新决议并同步落地三列窄卡 token 版式，禁止单独删除（会加重卡头挤压）。
- **验证**：纯登记，无代码变更；对照演示为 /tmp 独立页（不入库），依据链 = P1-2 台账 + f0563ea（卡头 wrap+截断）+ 本日志 2026-10-01 三条卡头条目。
- **token 影响**：无增删。

## 2026-10-04 · Launch 页 Fees 卡并入表单卡（用户裁定「右半边卡片合并到左半边卡片的 Communities 下方」）

- **背景**：`/memeverse/launch` 沿用 demo 双栏（左表单卡 + 右 Fees 报价侧栏，`.verse-workbench` 共规则 1.22fr/0.78fr）；≤68rem 侧栏另收敛为 sticky 迷你费用条（2026-10-01 裁定）。用户裁定右卡并入左卡 Communities 下方。
- **决议**：`.create-layout` 退单列，右列侧栏退役。报价头（复用 `.action-panel__head/__icon`）/总额行/支付说明/Launch CTA 顺排进表单卡尾部新分区 `.create-launch-foot`（顶边框 1px 分隔，review dl 同语言）；`.create-submit` 由 80% 居中改吃满卡宽。review 步同并：无侧栏，费用总额本就在审阅 dl 行内，支付说明（quotePaidNote）补到 dl 之下防信息丢失。连带退役：sticky 迷你费用条全套（`--launch` 修饰、`__label-main/__label-compact` 换档、≤54rem 让位规则）——移动端 CTA 回归表单流底部，`.product-main` 既有底部预留承接固定底导航。
- **效力**：修订 components.md 创建页工作台行；`.workbench-secondary` 基类仍归 verse 页 CurrentAction 使用，不受影响；报价语义（quoteRegister 总额一行、0 态只留 CTA、SPEC-M8 §9 支付口径）不变。
- **token 影响**：无增删。
- **验证**：tsc / lint / check:design / check:contrast / vitest 全绿；e2e launch 三档基线重录。
- 签名：approved by Jasonrale（2026-10-04 会话裁定）

### 决议 016 补充 9 · ④凭证区余额语义/对齐/样本参差化（2026-10-05 用户逐项裁定）

- **背景**：用户连续质询 ④区「POL/PT/YT/LP 是什么、是不是这个账户的」——持仓行五列裸数字无单位无归属；数字列表头左对齐与右对齐数据错位（补充 4 二轮同修漏网凭证表）；20 行 × 4 币种全部非零、锁定行 claimable 全 0 而解锁行全正的「一眼假」分布；另裁定「1 YT ≈ 0.0231 UETH」小字删除。
- **决议（小字删除明示裁定；其余四项用户「其他的按推荐先来」授权）**：
  1. **「1 YT ≈」hint 删除**：渲染块 + `ytRedeemHint` 文案键（en/zh）+ `FixtureVoucherRow.holdings.ytRedeemUAssetPerUnit` 字段及映射移除；`FixturePolPosition` 同名字段保留（verse 页兑回弹窗/井读数在用）。可领格只剩绿色 +数字。
  2. **对齐补齐**：④区数字列表头（Participating/Genesis Endtime/POL/PT/YT/LP/Claimable）补 `data-numeric`，Claimable 单元格同步——`.pf-table th[data-numeric]` 规则本在（补充 4 二轮），凭证表漏网。
  3. **余额语义**：分区副标题改写（en: Balances of the vouchers you hold in each verse…/zh: 您在各个 verse 持有的凭证余额…）；列头保机制词不带余额前缀。
  4. **样本参差化（pol-positions.json，manifest 重出）**：`myPt` 仅 verse-003/verse-010 非零（标准参与不被动发放 PT——pol-splitter.md「Who actually receives PT / YT」，账户仅此两 verse 拆分过 POL）；`claimableYt` 按已登记口径（Stage≥Locked 一次性——MemeverseSettlementImpl.sol:88，schema 注释本已正确、偏差在数据侧）修数据：锁定行 verse-002/010/025 未领（1830/1420/1050 样本），解锁行 verse-012/014/029/031 归零（早已领完）——可领 = 3 锁定 + 6 解锁 = 9 verse，「只看可领」筛选恢复跨阶段语义。
- **效力**：`FixtureVoucherRow.holdings` 塌缩为五字段（pol/pt/yt/claimableYt/lp）；components.md ④区行同步；schema 注释未动（口径本已正确）。
- **验证**：tsc / vitest 115 / check:design 0 / prettier / check-fixture-boundary --source 全绿；portfolio 三档基线重录 + 全套 e2e + visual-judge（本条登记后执行）。
- 签名：approved by Jasonrale（2026-10-05 会话逐项裁定）

### 决议 016 补充 10 · ④凭证区行版式重做（2026-10-05 用户裁定「这他妈是产品 UI 吗？几个字母加个表格就是 UI 了？有一点可读性吗？」）

- **背景**：补充 9 对齐修复后的字母表头数字矩阵被整体否决——POL/PT/YT/LP 裸表头 + 五列代币计数是把合约存储直接倒给用户：读不出是余额、读不出单位归属、读不出下一步动作。
- **决议**：废除表内表格，行版式按本页资产行成熟 ledger 节奏重做（`.pf-voucher-row`）：40px 切角字母 tile 视觉锚｜身份（symbol+name，创世行随路径/类型徽章）+ 构成行（mono 安静第二行、单位行内嵌「15.25K POL」、零值省略——「0」噪音与表头随表格一并消亡；创世行构成槽=截止日）｜右缘主数字（创世=参与额 22px data 档；持仓=可领 YT success 绿同档——可领由一列升格为行主数字；无可领=灰 `--`）｜行尾动作链接。锁定行加预计解锁日副行（凭证头新暴露 `unlockAt`=创世截止+365d，MemeverseRegistrationLib.sol:14 合约常量）。无表头行，列语义由内容自承载。copy 键 `genesisParticipating`/`claimableCell` 删除，`endsOn`/`unlocksOn` 新增；本区时间格式 `formatStamp`→`formatDay`。
- **效力**：`.pf-vouchers__group` 内不再使用 `.pf-table`（pf-table 组规则归③仓位/金库表专用）；`FixtureVoucherRow.verse` 增 `unlockAt` 字段。
- **验证**：tsc / vitest 115 / check:design 0 / check:contrast / prettier / check-fixture-boundary --source / design:detect 全绿零命中；dev 断言（21 行、9 绿 pill、凭证区无 table 元素、构成行与解锁副行在位）；portfolio 三档基线重录 + 全套 e2e 25 passed + visual-judge 三视口 3/3 pass（右缘共线、层级、与资产行语言一致、390 无溢出）。
- 签名：approved by Jasonrale（2026-10-05 用户裁定驱动重做，Agent 执行后留痕）

### 决议 016 补充 11 · ④区三项收尾裁定（2026-10-05 用户裁定）

1. **构成行不显示 LP**：四池 LP 合计不进构成行（`MakeupLine` 只出 POL/PT/YT）；`FixtureVoucherRow.holdings.lp` 字段随之移除（无消费方；fixture `myLp` 与 verse 页弹窗 `FixturePolPosition.myLp` 不动）。
2. **创世行 CTA「Open genesis/去参与」删除**（用户裁定语义不准确）：对一条已有参与记录的行，「去参与」读作再参与邀请——CTA 收敛为二值：可领=Claim，否则=Manage（`participateCta` 键删除，en/zh）。
3. **「Sample data — the clock does not advance / 示例数据 · 时间不会推进」页脚删除**：①待办区与④区两处 `panel-note` 一并删除（用户引文案本身；`portfolio.action.fixedAnchor` 键删除。verse 页 `verse.fixedAnchor` 是独立键，禁用按钮 title 在用，不动）。
- **验证**：tsc / vitest 115 / check:design 0 / prettier 全绿；dev 断言（MOON 行 CTA=Manage、构成行无 LP、两处 panel-note 清零）；portfolio 三档基线重录 + 全套 e2e 25 passed + visual-judge 三视口 3/3 pass。
- 签名：approved by Jasonrale（2026-10-05 会话逐项裁定）

### 决议 016 补充 12 · ④组头铭牌对齐纠错（2026-10-05 用户截图圈注「阶段显示在这不舒服」）

- **根因**：`.pf-vouchers__group-head span` 裸 span 选择器把计数右推的 `margin-inline-start:auto` 同时命中 StageBadge（同为 span）——两个 auto margin 均分自由空间，徽章被顶到行中悬置。
- **决议**：选择器收窄为 `span[data-numeric]`——组头回归页面既有铭牌 grammar（`.pf-panel__bar` 同款：徽章锚左=扫描起点，计数退右缘 meta）。
- **验证**：dev 断言三组头 badge-first+计数（1/10/10）；check:design/prettier 绿；portfolio 三档基线重录 + 全套 e2e 25 passed + visual-judge 三视口 3/3 pass（与 Assets/Vault 铭牌语法一致）。
- 签名：approved by Jasonrale（2026-10-05 用户截图圈注驱动，Agent 执行后留痕）

### 决议 016 补充 13 · ④行身份只显 symbol（2026-10-05 用户裁定「只显示 Symbol，不显示名字，不然看着有点杂乱」）

- **决议**：凭证行身份链接去掉 verse 全名（Moon Verse 等），只留粗体 symbol——与③金库行既定裁定「行身份=verse 符号即可」（补充 4）同口径。tile 字母章、构成行、右缘主数字、动作链接不变。
- **验证**：tsc/prettier 绿；dev 断言全名清零；portfolio 三档基线重录 + 全套 e2e 25 passed + visual-judge 三视口 3/3 pass（21 行仅 symbol、Staked 徽章随行、其余无回归）。
- 签名：approved by Jasonrale（2026-10-05 会话裁定）

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

### 决议 017 补充 1 · hero 分配条图例化（2026-10-05 用户反馈「怎么下面还有一个类似进度条的东西」→ 三方案中选 B）

- **问题**：三段连续无标注的条体落进「加载进度」affordance，用户无法自明——构成条的设计意图（钱在哪/多少待行动）没有传达。
- **决议（方案 B）**：段间 2px 断缝 + 条下可见图例（色点映射段色 + 类别 + 占比，`__legend/__legend-item/__dot--*`）；图例即构成的可访问文本，sr-only 方案与 copy `totalSr` 废弃，新增 `legendWallet/legendSavings/legendReady`。
- 签名：approved by Jasonrale（2026-10-05 会话裁定「B」）

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

### 决议 018 补充 3 · 凭证页签英词修正 Vouchers→Joined（2026-10-05 用户裁定「voucher 这个词感觉很少见」）

- **依据**：OutrunBook 全库零次使用 "voucher"（日常语义=代金券，DeFi 语境罕见）；真源词族=participation/join（"Standard, leveraged, and Preorder participation"、vault 区副标题原文 "in the communities you joined"）。018 落地时页签短词系 Agent 自选，非真源词——本条修正。
- **选词**：`Joined`（en 页签）——日常词、6 字符四等分页签订宽单行、全阶段准确（创世中=已参与、锁定后=仍是你参与的社区）；`Participations` 与桌面标题一致但 14 字符放不下；`Genesis` 与区内 Genesis/Locked/Unlocked 阶段组名递归打架。zh 页签「凭证」为常用词维持不动（en/zh 为同区短标签非逐字互译，区全称 Participations/参与凭证 不变）。
- **验证**：390 页签条渲染「To-do 14 / Assets / Positions / Joined 9」四项单行 44px；e2e 基线重录走 `--update-snapshots=all`（换词仅 ~0.09% 像素差低于 1% 容差，changed 模式会静默跳过——吸顶页签条在 fullPage 基线里被钉在 top 位、确实在图内，经裁图核实后重录）；mobile-390/tablet-860 基线重录（新基线裁图验证 Joined 9 在位）、desktop-1280 零变化；全套 e2e 25 passed + vitest 115。
- **token 影响**：无增删。
- 签名：approved by Jasonrale（2026-10-05 用户裁定）

### 决议 018 补充 4 · ④凭证筛选芯片窄屏溢出修复（2026-10-05 用户反馈「右上角的 Claimable only 有点溢出移动端屏幕了」）

- **根因**：`.section-heading__row` 默认 nowrap，④凭证区筛选芯片组（All / Claimable only）与标题同行——390 恰好满格（行宽 366==366 零余量），375 类窄屏直接把 "Claimable only" 推出右缘。③仓位区 2026-10-04 已为同类问题加过「标题行可换行 + aside 限宽」补丁（决议 016 补充 4），④凭证区漏配。
- **决议**：补丁选择器扩入 `.pf-vouchers`（两条规则与仓位区合并书写）；全宽度生效（wrap 仅在内容超行时参与，桌面零影响——仓位区同款先例）。
- **验证**：Playwright 360/375/390 三档——窄屏芯片组换行到标题下方（filter 独立行、右缘 ≤ 内容锚），390 维持同行；zh 375 无溢出；tsc / check:design 0 / prettier 全绿；e2e 三档基线零变化（凭证页签不在默认待办页签截图内）——全套 25 passed。
- **token 影响**：无增删。
- 签名：approved by Jasonrale（2026-10-05 用户反馈驱动，Agent 执行后留痕）

### 决议 018 补充 5 · ④凭证区两处文案收敛（2026-10-05 用户裁定「Claimable only 的 only 是不是可以删掉」+「这段文案简化一下」）

- **筛选芯片去 only**：`Claimable only`→`Claimable`、`只看可领`→`可领`——筛选项用形容词即可（only 冗余），且与 KPI 信号带既有标签（signals.claimable=Claimable/可领）完全对齐，少一套词；深链 `?claimable=1` 激活态与计数 `(9)` 不变。
- **分区副标题简化**：en `Balances of the vouchers you hold in each verse — participations while genesis runs, then the POL/PT/YT/LP they turned into, grouped by stage.` → `Your genesis participations — POL/PT/YT balances after unlock.`；zh `您在各个 verse 持有的凭证余额——创世中是参与记录，锁定后就是参与变成的 POL/PT/YT/LP，按阶段分组。` → `你的创世参与——解锁后就是 POL/PT/YT 余额。`。随行修正两处失真：① LP 出列——构成行自补充 11 起只显 POL/PT/YT，旧句的 LP 是滞留登记；②「grouped by stage/按阶段分组」删除——阶段分组由组头徽章自明，文字复述是噪音；「vouchers/voucher」词退场与补充 3 同向。所有权语义（Your/你的）保留（016 补充 9 的裁定目的不变）。
- **验证**：375 双语深链渲染 `All | Claimable (9)`/`全部 | 可领 (9)` 且激活态正确、无溢出；en/zh 副标题上屏核实；prettier 绿；desktop-1280 基线两轮 `=all` 重录（两处均为 sub-threshold 文字差，changed 模式会静默跳过；mobile/tablet 基线不含凭证区零变化）；全套 e2e 25 passed + vitest 115。
- **token 影响**：无增删。
- 签名：approved by Jasonrale（2026-10-05 用户裁定，Agent 执行后留痕）

### 决议 018 补充 6 · ①金库 signpost 卡 CTA 折行居中（2026-10-05 用户裁定「移动端这里的 withdraw 按钮需要居中」）

- **根因**：金库可取出卡底栏（hint 句 + Withdraw 钮）≤30rem 折行后按钮独占一行、落在行首——`flex-wrap: wrap` 只管折行不管独行对齐。
- **决议**：`.pf-action[data-kind='vault'] .pf-action__foot > :last-child` 在 ≤30rem 加 `margin-inline: auto`——auto margin 在同行（space-between 无自由空间）零影响、独行时吸收全部自由空间=居中；保护窗卡底栏（KV+按钮同行）不受波及（实测按钮 left 264 同行钉右）。
- **验证**：390 实测按钮中心 195==底栏中心 195、无溢出、保护窗卡零变化；check:design 0 / prettier 绿；mobile-390 基线 `=all` 重录（按钮位移 ~0.37% 低于 1% 容差）、tablet/desktop 零变化；全套 e2e 25 passed。
- **token 影响**：无增删。
- 签名：approved by Jasonrale（2026-10-05 用户裁定）

### 决议 018 补充 7 · ①待办区 zh 副标题重写（2026-10-05 用户裁定「可读性不够，AI 味严重，并且还有分号」）

- **原文**：`限时窗口排在前，错过有代价；下面的领取清单会跳到对应社区操作。`——两处违规：分号踩 2026-09-26 禁令；「限时窗口排在前/错过有代价」电报体对仗压缩（zh-copy-no-telegraphese 口径）。
- **新文**：`排在前面的要尽快处理，错过会有实际损失。下面的激励和退款点开就能去对应社区领取。`——两个自然短句、动词落人（要尽快处理/点开就能去…领取）、语义不变（紧急在前有代价 + 清单行跳 verse）。en 不动（无违规、语义兼容）。
- **验证**：zh 上屏核实；prettier 绿；zh 组合页不在 e2e 基线集（ZH_PAGES=zh-home/zh-explore）——三档基线零变化、全套 25 passed。
- **token 影响**：无增删。
- 签名：approved by Jasonrale（2026-10-05 用户裁定）

### 决议 018 补充 8 · ①待办区 zh 副标题二轮重写（2026-10-05 用户裁定「太口语化；不是口语化就没 AI 味，要设身处地思考用户应该看到什么」）

- **AI 味病灶复盘**（一轮「排在前面的要尽快处理，错过会有实际损失。下面的激励和退款点开就能去对应社区领取。」被否）：① 空泛动词（处理）；② 布局旁白（排在前面的/下面的——页面顺序自明，念出来是废话）；③ 翻译腔（对应社区=the corresponding community）；④ 假亲切口语（点开就能去…领取=LLM 保姆腔，比电报体更重的 AI 味）。口语化与 AI 味是两个独立轴。
- **重写原则**：只陈述用户需要被告知的两件事实——分区收录判据（有期限、逾期损失）与清单形态（一行一个社区、动作在社区页），不催促、不旁白。
- **定稿**：`过了期限就会损失的项都收在这里。激励与退款一行一个社区，点击前往领取。`
- **验证**：zh 上屏核实；prettier 绿；zh 组合页不在 e2e 基线集——三档基线零变化。
- 签名：approved by Jasonrale（2026-10-05 用户裁定）

## 2026-10-05 · verse-21 视觉基线漂移收口（非代码变更，登记留痕）

- **现象**：本日 20:1x 起 verse-21 mobile/tablet 对基线失败（390 高 1873→1927，+54px），此前本会话多轮 e2e 全绿。
- **排查**：dev:3000 现渲 == e2e actual（均 1927）——真实漂移非环境 flake；根因=上一会话未提交收尾改动（017 Q7 `formatAmount` compact 恒两位小数 + 017 补充 2 fixture 减值，触点 `signal-ui.tsx`/`fixtures/data/*.json` 为 verse 页共享依赖）使 verse-21 变高，但彼时只重录了 portfolio 基线。此前被掩盖的机制：e2e 增量构建一直复用未重建的 verse 路由 chunk（匹配旧基线），本日 `copy.ts`（verse 页共享）编辑触发该 chunk 重建后漂移暴露——与 portfolio-desktop 72px 漂移（决议 018 已登记）同类，均为上一会话收尾未重录的遗留。
- **处置**：现渲视检无硬性缺陷（数字口径变化正常换行）；verse-21 mobile/tablet 基线 `=all` 重录（desktop 实测未漂移零变化）；全套 e2e 25 passed。
- 签名：approved by Jasonrale（2026-10-05 Agent 排查收口留痕）

### 决议 018 补充 8 二轮修订 · 待办区 zh 副标题三轮定稿（2026-10-05 用户裁定「还是有点口语化，要简洁优雅专业」）

- **二轮稿**（`过了期限就会损失的项都收在这里。激励与退款一行一个社区，点击前往领取。`）仍被判口语——「都收在这里」「点击前往领取」是叙述/指令腔。
- **定稿**：`限时窗口逾期将造成损失。激励与退款按社区列示，进入各社区页领取。`——陈述句、名词前置、无指令动词、无布局旁白；「按社区列示」/「进入各社区页领取」为金融产品正式语域。
- **验证**：zh 上屏核实；prettier 绿；zh 组合页不在 e2e 基线集——基线零变化、全套 25 passed。
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


### 决议 020 补充 5 · 营销壳顶栏高度 64→56px + 字标等比缩小（用户裁定「Header 的高度可以稍微缩小一点」）

- **背景**：同日首页顶栏改造（三段布局 + 文字导航 + 网络切换器入列）后用户提出高度收窄；64px 对三控件（40px）档距偏松。
- **方案**：`.marketing-header` `min-block-size` `--space-8`(64) → `--row-height-relaxed`(56)——即 40px 控件 + 上下各 8px 基线网格，恰为 T3 营销档行高（patterns.md 营销壳放行 T3）；`.marketing-main` 视口补偿 calc 同步换 token；`.marketing-brand .brand-wordmark` 等比缩至 124×32px（2048×527 原比例，仅营销壳作用域，产品壳侧栏字标不受影响）；`.marketing-nav` 项距 32→24px（`--space-5`，与 56px 档密度匹配）。产品壳顶栏（`--space-8`）不动。
- **token 影响**：无增删。
- **验证**：Playwright 实测 1280/860/390px 档 header 56px、字标 124×32、零横向溢出（≤1023 导航照常收纳、390 芯片纯图标）；home 三档 + zh-home mobile 基线 `--update-snapshots=all` 重录并像素抽验；全套 e2e、vitest、check:design、prettier 绿。
- 签名：approved by Jasonrale（用户裁定）

### 决议 020 补充 6 · 营销壳顶栏高度再收 56→48px + 控件随栏降档（用户裁定「Header 高度可以再缩小一点；Header 里的按钮也需要跟随适配和谐的视觉比例」）

- **背景**：补充 5 落地 56px 后用户再次收窄，并明确按钮需随栏位等比适配（40px 控件在 48px 栏内占比失衡）。
- **方案**：`.marketing-header` `min-block-size` → `--space-7`(48) = 32px 控件 + 上下各 8px 网格；营销壳作用域内三控件统一降 32px（`calc(var(--control-height) - var(--space-2))`，与 020 补充 1 移动档同档位——`.marketing-header` 前缀作用域，产品壳桌面档 40px 不动）；钱包钮宽 160→152（020 补充 4 档位，152×32 比例与移动档一致）、`!important` 对冲 `[data-slot='button']` 40px 基线；`.marketing-nav__link` 命中区同步 40→32；字标 124→96px 宽（≈24.7px 高，压在决议 004 的 96px 字标下限——再低即须换 symbol，本档保留字标维持营销壳品牌完整）；`.marketing-main` 视口补偿 calc 同步 `--space-7`。
- **token 影响**：无增删。
- **验证**：Playwright 实测 1280/1024/860/390px 档 header 49px（48+1px 底边框）、三控件全 32px、钱包 152px 宽、字标 96×25、零横向溢出（≥1024 导航在位、≤1023 照常收纳）；home 三档 + zh-home mobile 基线 `--update-snapshots=all` 重录；全套 e2e、vitest、check:design、prettier 绿。
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

### 决议 023 补充 1 · hero 阶段徽章删除、分享组上移右上角并去边框（用户裁定「右上角的阶段标志删掉，没什么实际意义，把分享按钮放在右上角，同时去除按钮的边框」）

- **阶段徽章删除**：verse hero `verse-identity__badges` 内 `StageBadge` 移除——阶段信号已由数据面（生命周期/统计条）承担，右上角让位分享组；`FastBadge` 保留同容器（Fast Genesis 是行为差异标志非阶段镜像）；`StageBadge` 原语不动（Explore 卡/Portfolio 凭证组头/lifecycle 等处仍在用）。
- **分享组上移**：`.verse-share` 从 hero footrow 右缘（原 `__footaside` 动作簇，该 wrapper 随本次退役）移入 titlerow `__badges` 容器（margin-auto 右推=hero 右上角原徽章位）；移动端徽章行折行左锚后分享组单独右锚（`__badges .verse-share { margin-inline-start: auto }`）。
- **去边框**：`__hint/__button` 双图标钮 `border` 退役（hover 转青保留）——视觉重量让给抖动本身，与描边社交钮族的混排不再。
- **token 影响**：无增删。
- **登记**：components.md Verse 分享组行、component-contract.md §31 结构/响应式同步。
- 签名：approved by Jasonrale（用户裁定）

### 决议 023 补充 2 · 移动端徽章行左锚覆盖随阶段徽章删除退役（023 补充 1 落地修正）

- **病灶**：≤640px 旧覆盖 `.verse-identity__badges { margin-inline-start: 0 }`（服务阶段徽章折行左锚、防孤悬右缘真空）在徽章删除后误伤分享组——titlerow 未折行时分享组跟在标题后（390px 实测右缘离卡边 56px），右上角语义失真。
- **方案**：覆盖规则与补充 1 首版的 `.verse-share` 单独右锚补丁一并删除，基础 `margin-auto` 右推全档生效；折行时分享组随行右悬（孤行真空顾虑随徽章删除作废）。
- **验证**：390px 实测分享组 boundingBox 右缘贴内容右缘；`check:design`、tsc 绿；verse 三档基线 `=all` 重录 3 passed。
- 签名：approved by Jasonrale（用户裁定）

### 决议 023 补充 3 · 分享弹窗精装：品牌 Logo 进卡 + 项目卡升档（用户裁定「分享窗口需要带上品牌 Logo……而不是 Outrun 字母。设计还需要美化一些，精美高级一些，适配品牌形象」）

- **品牌 Logo**：项目卡 kicker 位「OUTRUN」字母退役，换 `public/brand/BRAND-04-symbol-transparent.png` 成品 symbol（next/image，24px 高，禁改色/拉伸/裁切纪律沿用；alt=Outrun 同 app-shell Brand 口径）。
- **项目卡升档**：容器套按钮同款 chamfer-border worklet 画皮（TL/BR 对角裸切+发丝边）——底=`color-mix(surface-raised 88%, 品红 12%)` 暗 tint（营销叙事层低饱和回声）、边=border-strong，`@supports not` 退 border+clip-path（按钮 fallback 同款）；monogram 缩略位升 raised 底+strong 边；symbol 28px display 加 `0.06em` 品红错位回声（`.empty-state h1` 同款文字级语言，≈1.7px 落 1–2px 契约内）；JOIN US 胶囊加 12% 品红 tinted 底。
- **不进站项**：参考仓紫粉蓝渐变字/渐变钮/圆角胶囊维持禁入（负面清单）；黄主 CTA 唯一性不变。
- **token 影响**：无增删（color-mix 组合现有 token）。
- **登记**：component-contract.md §31 结构行、components.md 分享组行同步。
- 签名：approved by Jasonrale（用户裁定）

### 决议 023 补充 4 · 分享弹窗二轮精装：字标 Logo + 项目卡接雨夜材质（用户裁定「还是不好看啊，而且 logo 换成字母 logo」）

- **Logo 换字标**：`BRAND-04-symbol` → `BRAND-01-wordmark-transparent.png`（字母 logo，kicker 位 96px 宽=顶栏 157px 的约 6 折；成品纪律沿用）。
- **项目卡重做**：补充 3 的 worklet tint 画皮退役（实测盒中盒+平 tint 显浑浊），接入「雨夜材质」签名卡静态两伪元素（材质组选择器扩编 `.verse-share-card::before/::after`，同 017 数据面口径不随 hover 通电）；monogram 缩略位 40%→32%、raised 无边软板；meta 列组距 4→8px；弹窗 420→460px 档——420 档 meta 列被挤到 183px 是上一轮「不好看」的主因（实测放宽后 237px）。
- **token 影响**：无增删。
- **验证**：双档构图量化探针（meta 237px/无横向溢出）+ 截图目检；`check:design`、tsc 绿；verse 三档基线 `=all` 重录。
- 签名：approved by Jasonrale（用户裁定）

### 决议 023 补充 5 · 分享项目卡底纹换 K 线图横纹（用户裁定「内部卡片的背景换成和 K 线图一样的横纹背景」）

- **方案**：项目卡材质 `::after` 上叠横向网格线层——1px 青 `rgba(0, 240, 255, 0.1)`、行距 `--grid-size-outer` 44px（与 K 线网格节奏同档）；顶光渗/品红角洗/噪点镀膜保留。覆盖规则置于材质组之后按源序生效（同特异度）。
- **两处工程事实**：① K 线 grid 用的 `--grid-cyan-inner`（2.4% alpha）在 200px 小卡上低于可感知阈值（外层 3.5% 同样不可见；实测 K 线图观感行亮 +3 ≈ 10% 青）——线强取 0.1 literal（材质伪元素 rgba literal 为既有手法，顶光渗 0.07/湿边 0.5 同源）；② 覆盖规则初版误置于材质组之前，同特异度被组规则压掉——顶光渗渐变吃到新 `background-size` 后每 44px 平铺产生「假横纹」（渐变带非 1px 线），迁移到组规则之后修正。
- **token 影响**：无增删。
- **验证**：计算样式首层=横纹 gradient ✓；2x 截图像素扫描线心 44px（@1x）等距、行亮 +3 可见；`check:design`、tsc 绿；verse 三档基线 `=all` 重录。
- 签名：approved by Jasonrale（用户裁定）

### 决议 023 补充 6 · 提示符统一换礼物图形（用户裁定「这里的提示符号换成礼物图标……窗口里的提示符号也换成礼物图标，以后鼠标悬停在礼物图标上就弹出提示气泡」）

- **hero 分享组**：`__hint` 触发器 glyph Info→Gift（14px），抖动/促销语 tooltip/触屏护栏/无边框幽灵钮样式不变。
- **弹窗标题行**：原双图标（info tooltip 触发器 + 静态品红礼物）合并为单一礼物图标——`verse-share-card__gift` 兼任返佣说明 tooltip 触发器（品红 chrome 底色、hover 转青=pol-mint__close 弹窗幽灵图标语言）；`__info` 类与 Info glyph 退役。
- **token 影响**：无增删。
- **验证**：悬停双礼物位 tooltip 内容断言（促销语/返佣说明）+ 弹窗全流程冒烟；`check:design`、tsc 绿；verse 三档基线 `=all` 重录。
- 签名：approved by Jasonrale（用户裁定）

### 决议 023 补充 7 · Share2 分享图标退役，单礼物钮兼任分享按钮（用户裁定「干脆把分享图标删了，礼物图标作为分享按钮」）

- **方案**：hero 分享组收敛为单颗礼物钮——`TooltipTrigger` 经 `render` 直接披在 `DialogTrigger` 上（base-ui 组合范式，悬停/触点出随机促销语气泡、点击开分享弹窗，一颗钮两触发器）；Share2 glyph 与 `__hint` 类退役，`__button` 独享幽灵钮样式+抖动+16px glyph（Gift）；aria-label=shareLabel。
- **孤儿清理**：copy `shareHintLabel`（en/zh）随提示符独立身份消失退役。
- **弹窗标题行**：礼物=返佣说明 tooltip 触发器不变（补充 6 口径）。
- **token 影响**：无增删。
- **验证**：探针断言悬停气泡（促销语）+点击开弹窗+Esc 关闭链路；`check:design`、tsc 绿；verse 三档基线 `=all` 重录。
- 签名：approved by Jasonrale（用户裁定）

### 决议 023 补充 8 · 分享项目卡背景回归材质组本体，补充 5 自定义横纹层废弃（用户裁定「分享弹窗里内部卡片的背景你搞的什么乱七八糟的……一样的代码啊，K线图卡片的背景」）

- **纠正**：补充 5 把「和 K 线图一样的横纹」实现为卡面自定义 44px 青横纹层——误读。K 线图截图里的横纹是**图表 canvas 内部 grid**（lightweight-charts horzLines），K 线卡片本体背景=「雨夜材质」组同款（verse 详情页各卡共用）。自定义横纹叠在材质+弹窗壳双材质上显浑浊（用户驳回「乱七八糟」）。
- **终态**：`.verse-share-card::after` 覆盖规则整段删除，卡片只吃材质组选择器（补充 4 已扩编）——与 `.trade-chart`/`.swap-panel`/`.pol-mint` 同一份规则、零自定义；计算样式 `::before`/`::after` 与 `.trade-chart` 逐字节一致（已断言）。
- **token 影响**：无增删。
- **验证**：getComputedStyle 双伪元素全等断言 ✓；`check:design`、tsc 绿；verse 三档基线 `=all` 重录。
- 签名：approved by Jasonrale（用户裁定）

### 决议 023 补充 9 · 卡面横纹真身=全站 .ax-scanlines 层，弹窗内卡以同配方重建（用户裁定「这些卡片里不都有这种横纹吗？是怎么实现的，你用一样的代码啊」）

- **机制查明**：页面各卡的「横纹」不是卡片 CSS——是全站 `.ax-scanlines` CRT 扫描线层（tokens.css:159，`fixed inset-0` + `mix-blend-mode:screen` + 3px 透明/1px `--scanline-white` repeating 渐变），作为外壳末子元素盖在全部页面内容（含各卡）之上；**Dialog portal 到 body，渲染于该层之外，弹窗内容吃不到扫描线**——这就是弹窗内卡与页面各卡的观感差异来源。补充 8「横纹=图表 canvas grid」的结论作废（canvas grid 是另一回事，密度与色都不同）。
- **方案**：分享内卡加 `__scanlines` 子元素（`aria-hidden`、`pointer-events:none`），absolute inset:0 + 与 tokens.css 全站层**同一配方**（同 token 同色阶同 stops 同 screen 叠层）；卡片背景维持材质组规则零自定义。差分实测：全站层（侧栏 bg 采样）4px@1x 周期、线行 +5 亮度；内卡本地层同周期同幅（叠于顶光渗梯度之上）。
- **token 影响**：无增删（--scanline-white 既有）。
- **验证**：双点位行亮度序列对比（周期/幅值一致）；`check:design`、tsc 绿；verse 三档基线 `=all` 重录。
- 签名：approved by Jasonrale（用户裁定）

### 决议 023 补充 10 · 全站扫描线层提升 body 级，弹窗与页面同一张膜（用户裁定「这些卡片不能用同一个组件吗？你自己单独写的很乱」）

- **纠正**：补充 9 的机制诊断对了一半（横纹真身=全站 .ax-scanlines，非 canvas grid）但药方错了——卡内塞局部副本=双重曝光（弹窗整体平的、唯独内卡一层条纹，贴感强烈），用户驳回「比草稿都难看」。
- **方案（单一组件）**：`.ax-scanlines` 从壳层末尾（app-shell 两分支各一）提升为 `app/layout.tsx` body 末尾唯一实例——body 级 z-overlay(1000) 盖住包括 dialog portal（z-50）在内的全部内容，页面与弹窗吃同一张膜；卡内局部副本 `__scanlines` 整体删除；内卡皮肤回归材质组同款规则零自定义（「用同一个组件」的字面落地：横纹一个组件、材质一组规则）。
- **影响面**：原先不吃膜的无壳路由（design-review 等内部工具）现在也吃膜——「全站层」名副其实；页面像素应零漂移（同一绘制结果，仅挂载点移动）。
- **token 影响**：无增删。
- **验证**：探针双点位（弹窗标题带出现 4px 周期膜、内卡单层膜与标题带同幅）+ e2e 全量（基线预期零重写）；`check:design`、tsc 绿。
- 签名：approved by Jasonrale（用户裁定）

### 决议 023 补充 11 · 分享弹窗底部暖色洗 + Share on X 升实面板（用户裁定「下半部分颜色有点太黑了……让人有分享的欲望」）

- **病灶**：按钮行直接坐在弹窗壳深色面上，壳面光洗全在上半（顶缘青渗+品红角洗）——下半死黑；Share on X 为 outline 透明底，在深面上读作黑洞。
- **方案**：① `.verse-share-pop .pol-mint::after` 增底缘上升暖洗（`--logo-magenta-dark` 30% → 透明 38%）——参照稿紫色弹底的本站色板等价物（品红营销叙事层，promo 弹窗逐例豁免、scope 限分享弹窗不涉其它 pol-mint 消费方）；② `.verse-share-card__x` 经 worklet 皮肤变量升 raised 实面板（`--cb-bg: surface-raised` + border-strong）——黄主 CTA 唯一性不变。
- **token 影响**：无增删（color-mix 组合既有品牌锚）。
- **验证**：底缘行亮度 28→43（暖洗生效）；弹窗不在视觉基线内，e2e 全量 25 passed 零重写；`check:design`、tsc 绿。
- 签名：approved by Jasonrale（用户裁定）

### 决议 023 补充 12 · 分享内卡下半暖洗 + monogram 去黑（用户裁定「我说的是内部的这张卡片」（下半太黑））

- **纠正**：补充 11 把「下半太黑」理解成弹窗壳按钮区——用户实指内卡（.verse-share-card）下半：材质光洗全在卡面上半（顶缘青渗 26% 渐隐），下半近半无光死黑；monogram 缩略位 raised 底在卡面上读作近黑方块。补充 11 的壳底暖洗保留（整体构图不变）。
- **方案**：① `.verse-share-pop .verse-share-card::after`（0,2,0 特异度防材质组源序压制——补充 5 的坑）增底缘上升深品红洗（26% → 透明 42%，壳底同配方族）；② monogram 缩略位底色 raised 混 18% `--logo-magenta-dark`（近黑方块→暖紫灰板）。
- **token 影响**：无增删（color-mix 组合既有品牌锚）。
- **验证**：内卡截图目检（下半暖调、JOIN US 在暖底上跳出）；`check:design`、tsc 绿；e2e 首轮 7 passed 为环境 flake（源码未变），重跑 25 passed 定案零基线重写。
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

### 决议 023 补充 17 · Copy link 转非实心 outline（用户裁定「Copy link 按钮的样式改成非实心的样式」）

- **方案**：Copy link `variant="outline"`（撤黄色实心）——worklet 皮肤变量显式锁 `--cb-bg: transparent` + `--cb-border: border-strong`（比 Share on X 的 border 高一档，非实心前提下保留主次层级）；双 CTA 均为 outline 幽灵面板。
- **连带语义**：「黄=弹窗内唯一主 CTA」纪律随之失效——弹窗内不再有实心钮，黄退场，色相=品红（签名）+中性灰阶；contract/components 同步。
- **token 影响**：无增删。
- **验证**：截图目检（双 outline、描边档差可辨）；✓Copied 回落实测正常（授 clipboard-write 权限）；`check:design`、tsc 绿。
- 签名：approved by Jasonrale（用户裁定）

### 决议 023 补充 18 · Share on X 转黄描边非实心钮（用户裁定「把 Share on X 按钮的样式改成黄色非实心按钮」）

- **方案**：Share on X=黄描边+黄字（`--cb-border/--cb-border: var(--accent-primary)`、`color: var(--accent-primary)`，hover=8% 黄 tinted raised 底）——黄回场为分享主层级；Copy link 保持中性（描边 border-strong、字 text-secondary）作次层级。
- **工程事实**：outline variant 在 globals.css 609 起有 `color: text-secondary !important` + 青描边 important 通道——普通声明被压制（首改实测 computed 仍 text-secondary）。按 `swap-panel__cta` 先例走同通道 `!important` + `.verse-share-card__actions` 前缀 (0,3,0) 同特异度后位压制（含 hover 态）；Copy link 同法修正描边（此前 cyan-mix 默认描边漏网）。
- **token 影响**：无增删。
- **验证**：computed 探针（x color/border=rgb(252,238,10)、copy hover border=rgb(58,63,82)）+ 2x 截图目检；`check:design`、tsc 绿；e2e 全量 25 passed（zh-explore 环境 flake 单跑即绿）。
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

## 2026-10-07 · 错版字效应用面收敛：create 标题摘除 `.ax-glitch-text`（用户裁定「摘掉 create h1 上的 ax-glitch-text」）

- **背景**：四个一级页标题核对时发现唯一 create（Consensus Launch）还挂着 2026-09-22 裁定的 `.ax-glitch-text` ticker 皮肤（IBM Plex Mono/semibold/大写/0.08em 字距），其余三页（发现/收益组合/推荐）均为 Saira Condensed 展示字体——四页字体不一致的根源。沿革：2026-09-30 改版一用户曾以「字体不需要调那么大…原来的字体就挺好的」裁定一级页标题摘掉该皮肤，但 2026-10-01 动效四连败整体回滚时 create 被恢复回 2026-09-22 状态（`.ax-fault-title` 随后叠加上去），皮肤残留至今。本次用户裁定摘除，与 09-30 字体裁定方向一致。
- **方案**：`create-page.tsx` h1 `ax-glitch-text ax-fault-title` → `ax-fault-title`。排版回落 `.page-intro h1` 上下文（`--font-display`/700/`--display-tracking`/原文大小写），四个一级页标题排版统一。静态青/品红 echo 与动画均由 `.ax-fault-title` 独供（原双类规则「create 由 0-2-0 重申同值」随之失效，无视觉损失）；`ax-fault-title` 的 v8 编舞、封锁纪律、reduced-motion 回退零改动。
- **登记**：components.md 错版字效条目应用面去 create 标题、标题信号失真条目静态层描述改「create 曾由双类重申」；globals.css `.ax-glitch-text` 头注释共用面同步。ticker/Explore 卡 symbol 两处共用面不动。
- **token 影响**：无增删。
- **验证**：tsc 绿；`check:design` 裸值 0 命中；prettier 绿（4 触点文件）；e2e launch 三档基线 `=all` 重录（desktop/tablet 差异低于 1% 容差被 changed 模式跳过，按已知坑定向 `=all` 强制重写，mobile 重录后像素抽验=混合大小写 Saira Condensed）；全量 29 passed / 16 skipped 两连绿。
- 签名：approved by Jasonrale（用户裁定）

## 2026-10-07 · 一级页页头到顶栏间距统一 16px（用户裁定「4个页面的 h1 与 Header 之间的间距需要缩小一点，并且统一一致」）

- **背景**：四个一级页 h1 到顶栏的间距不一致——create 16px（product-main 8 + 页头 8，2026-09-30 裁定收紧），发现/收益组合/推荐 40px（24+16）。用户裁定缩小并统一。
- **方案**：统一到 create 既有值 16px（唯一被裁定过的紧凑值，三页缩小、create 不动、无页面变大）：① `.product-main:has(> .create-intro)` 顶部收窄规则扩面为 `:has(> .page-intro, > .discovery-intro)`（四个一级页页头均为 product-main 直接子）；② `.page-intro` padding-block-start `--space-4`→`--space-2`；③ `.discovery-intro` 同步（bottom 维持各自原值：page-intro `--space-5`/discovery-intro `--space-4`/create-intro `--space-4` 不动，本裁定只管顶部）。design-system 镜像页（showcase 亦用 `.page-intro`）随规范联动属预期。
- **登记**：components.md 页面引言条目、component-contract.md PageIntro 行补间距口径。
- **token 影响**：无增删。
- **追记（同日用户反馈「16px 太小了，增大一点」）**：页头顶部 padding 回 `--space-4`（合计 8+16=24px，四页仍统一；create-intro 的 padding 覆盖随之瘦身为仅 `padding-block-end`，顶部随默认）。首轮 16px 基线作废重录。
- **终值（同日两轮）**：用户在 dev 疑「看不到变化」，跳 `--space-7` 56px 做可见性验证（确认为浏览器旧标签假象，HMR 静默断连）；用户确认可见后裁定回调——页头顶部 padding 定 `--space-6`，32px 态后再微调一轮：主容器 `--space-1` 4px + 页头 `--space-6` 24px，**终值 28px**（28 不在 token 刻度上，用 4+24 组合避免裸值），56/24/32px 中间态基线作废。
- **验证**：`check:design` 裸值 0 命中；prettier 绿；e2e changed 模式重录恰 14 张（explore/portfolio/referral/design-system ×3 + zh-explore/zh-referral mobile），launch 三档 mtime 未动= create 逐像素不变的回归护栏，home/verse 不受影响；全量 29 passed / 16 skipped 两连绿。
- **e2e 事故记录（追记轮重录时）**：追记轮 update run 收尾时 zh-referral mobile 基线抢拍到 1859px 异常帧（高负载下 `fonts.ready` 早于 zh 字体实际 swap 完成，fallback 度量入了基线）；浏览器 5 连测证明页面确定性 1852px（en 1893px 同样稳定），孤立重录基线=1852 后单测三连绿+全量 29 passed。同类抢拍复发时按「孤立重录+高度对比」处置。
- 签名：approved by Jasonrale（用户裁定）



## 2026-10-07 · 推荐页分账条图例按条宽分布（用户裁定方案「1」）

- **背景**：用户报告 `/referral` 运作卡分账条「青色线段位置比品红低一点点，不自己看都看不出来」。排查（Playwright 布局盒三视口×五档缩放 + 两张用户截图逐列亚像素边缘测量）证明三段渲染几何逐列对齐（差 <0.1px、硬边）——非渲染缺陷；青段降亮 80% 试验（后还原）无效，排除亮度错觉。根因为**上下文不对称视觉错觉**：条上方全宽 hairline+左对齐 label 提供单侧强水平参考，下方图例原为左聚排，右侧（品红/青段下方）无锚点，凝视判读时右段顶边系统性读低（视觉模型消融矩阵：同几何合成条在无文字/上下对称文字/仅下文字配置判读对齐；左上近距文字+左下远距文字配置复现「顶边略低、底边对齐、右段显窄」，与用户描述一致）。
- **方案**：`.ref-split__legend` 增 `justify-content: space-between`（保留 flex-wrap 与 gap）——图例三项沿条宽分布，You 10% 右缘对齐青段右缘，右侧获得水平参考锚；中项落位条宽居中、不严格对位品红段（锚定目的已达成，接受）。hairline/label 不动（2026-10-07 既有裁定不受影响）。
- **登记**：components.md Referral 页 `.ref-split` 条目补图例分布口径。
- **token 影响**：无增删。
- **验证**：图例三项实测 x 范围 LP 0-49 / Protocol 449-530 / You 930-986（bar 宽 986、青段 887-986，右缘对齐）；基线像素抽验图例三色点 x≈254/704/1184（青点贴面板右缘）；check:design 裸值 0 命中；e2e referral 三档 + zh-referral mobile 基线 `=all` 重录（4 passed）。
- 签名：approved by Jasonrale（用户裁定）

## 2026-10-07 · 分账条图例分布方案回退（用户实测无效+图例被弄乱，「本来是左对齐的」）

- **回退**：`.ref-split__legend` 撤 `justify-content: space-between`，还原左聚排；components.md 相应口径回退；referral 基线再重录。
- **排查终态**（软件层全部排除，均有实测证据）：布局盒（三视口×五档缩放 top/height 全等）、光栅行（用户两张截图逐列亚像素边缘差 <0.1px 且硬边）、亮度假说（用户 80% 降亮实测无效）、上下文锚定假说（图例分布实测无效，随之证伪）、扫描线层（0deg 水平纹、相位与 x 无关）、图例点对位（色点不在段下方）。存疑二候选均在用户硬件/感知侧：①面板物理——Diamond Pentile OLED 绿子像素晶格相对红蓝晶格错位约半子像素，青（绿+蓝）发光以绿晶格为主、品红（红+蓝）以红蓝晶格为主，同一帧缓冲 y 在物理发光面上错位，截图不可见；②色彩视觉重量错觉——蓝青系视知觉「重」读作下沉，色相驱动、与亮度弱相关（降亮无效相容）。判别实验=色对测试页（含红绿对/同色对照/左右换序消位置偏置）+异屏对照。
- 签名：approved by Jasonrale（用户裁定）

## 2026-10-07 · referral 统计簇移动端去 ≈ 前缀（用户裁定）

- **背景**：用户报告移动端 `/referral` KPI 卡（2×2 统计簇）不需要 ≈ 符号——Earned/Pending 两格美元估值读数「≈ $1,284.50 / ≈ $96.20」，卡片档符号添噪。
- **方案**：`≈ ` 包 `.ref-stats__approx` span，≤54rem（2×2 卡形态断点，与十字 hairline 同档）`display: none`；桌面 ≥54rem 四列横排保留 ≈（估值语义仍在）。待领行 USD 换算（`≈ $…`）与桌面读数不在本次范围。
- **登记**：components.md Referral 页 `.ref-stats` 条目补 2×2 形态去前缀口径。
- 签名：approved by Jasonrale（用户裁定）

## 2026-10-08 · 组合页金库 signpost 卡 CTA 平铺整卡（用户裁定「withdraw 按钮的宽度应该自适应平铺整张卡片」，取代 018 补充 6 居中）

- **背景**：≤30rem 金库可取出卡底栏（hint 句 + Withdraw 钮）折行后按钮独行，018 补充 6 裁定为 `margin-inline: auto` 居中；用户实测后改裁定平铺整卡宽。
- **方案**：同选择器 `.pf-action[data-kind='vault'] .pf-action__foot > :last-child` 的 `margin-inline: auto` 改 `inline-size: 100%`——按钮 `inline-flex` + `justify-center`，满宽后 label 仍水平居中；保护窗卡底栏（KV+按钮同行）选择器不触达、不受波及。
- **token 影响**：无增删。
- 签名：approved by Jasonrale（用户裁定）

## 2026-10-08 · 组合页六分区间距统一 48px（用户裁定「每个部分之间的间距应该统一一致」，取代 017 Q6 三组节奏）

- **背景**：桌面六分区序贯流间距交替 96/48/96/48/48（017 Q6 三组节奏：行动→钱→仓位，组间 `--space-9` 96px > 组内 `--space-7` 48px 承担分组识别）；用户判读为不一致，要求各部分间距统一。移动端页签内同症：money 页签内 assets→savings 32px、positions 页签内 positions→vault 48px（`.pf-zone-sub` gap 未随 018 移动档下调）。
- **方案**：桌面 `.pf-zone-group` margin-block-start `--space-9`→`--space-7`，六分区全序列（页头→①→②→③→④）统一 48px；≤54rem `.pf-zone-sub` gap 补齐 `--space-6` 32px、`.pf-zone-group` margin `--space-8`→`--space-7` 48px（页签条→首分区与待办页签 48px 对齐）；≤30rem `.pf-zone-sub` gap 补齐 `--space-5` 24px、margin 行随基档等值删除。组识别语义撤除——六分区平权、节奏本身即层级。
- **token 影响**：无增删；`--space-9` 退为保留档（仅存 verse-share-card 宽度类消费位），token-contract §1 该行补记。
- **登记**：components.md Portfolio KPI 带/deck 两行、component-contract §29 分区映射措辞、`portfolio-page.tsx`/`portfolio-zone-tabs.tsx`/globals.css 注释同步。
- 签名：approved by Jasonrale（用户裁定）

## 2026-10-08 · 导航 referral 图标 Gift→Users + account 占位项删除（用户裁定）

- **背景**：主导航 referral 项用 lucide `Gift`，语义偏「奖励/礼包」不达「邀请」——市场惯例 crypto 产品 invite 入口主流是「人」系图标（Telegram/PayPal/Revolut 与 OKX/Binance/Bitget 的 invite 均为双人/加人形态），Gift 路线属奖励钩子型消费产品（Robinhood 送股、Coinbase）。且侧栏 `UserRound` 语义归属「账户」，`UserPlus` 会与之混淆。
- **方案**：referral 图标 `Gift`→`Users`（双人=「我和我邀请的人」，与单人形状可区分）；account 占位项（`available: false`，`/account` 路由本不存在）从 `navItems` 整体删除，`copy.common` 两语言 label 同步移除；单测 `current="account"` 禁用分支用例随之退役、renderShell 联合类型换 `referral`。顶栏 marketing-nav R-12 后已为四入口，components.md 两处「三入口/01-03」残留口径一并更正（01–04）。
- **token 影响**：无增删。
- **验证**：`tsc --noEmit` 绿；app-shell 单测 4/4；e2e 三档视口基线 `--update-snapshots=all` 重录 29 passed，像素抽验确认新基线含真实差异；不属品牌方向/色板/字体/密度，按导航构成裁定登记。
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

## 2026-10-08 · 连接 CTA 二轮纠偏：ax-ghost-cta 皮 + 居中 + 推荐页落机制卡下方（用户裁定）

- **背景**：一轮实现用了 Button default 实心黄切角+左锚、推荐页放机制卡上方；用户纠偏「应该黄色无边框的那种，和 header 里的样式一样」「位置应该居中」「推荐页的按钮应该在 How it work 下方」。
- **方案**：按钮换 ax-ghost-cta 幽灵皮（透明机身+黄描边黄字+hover 通电，header 钱包钮/原 Launch submit 同款；皮挂组件 className，闸门壳不动）；`.connect-cta` 壳加 flex 居中；推荐页 CTA 从首卡槽位移至机制卡（ref-how）下方、卡片 space-6 不变；Launch 表单 submit 位连接钮同步挂回 `ax-ghost-cta create-submit`（原 Launch 槽位皮原样）。
- **token 影响**：无增删。
- **验证**：断连三路由基线重录+目验（皮/居中/落位与裁定一致）。
- 签名：approved by Jasonrale（用户裁定）

## 2026-10-08 · 笨重标题整改：A 档七处降档 + Noto 600/Plex 700 字重补档（用户裁定「①+②全做」）

- **背景**：referral 三标题四轮裁定暴露系统性问题——Noto Sans SC 仅载 400/500/700/900，全站 `font-weight: 600` 的中文按字体匹配规则升档渲染成 700 粗块（en 走 IBM Plex Sans 真 600 正常），display 族大号中文标题最显笨重。全站审计定档：A 档 7 处大标题（18–44px display 600 中文）同病；B 档（全站按钮 label/全局 h2,h3/12px 中文标签族/「参与成功」标题）同根因但字号小；表头 `th` 与裸 `strong` 走 UA bold（请求 700）反向不一致——zh 命中真 700、en Plex 无 700 落 600。
- **方案（① A 档降档，referral 四轮裁定语法延伸，逐处预览拍板）**：`.panel-title`（verse 面板标题）→body 16px/500/text-secondary；`.pol-mint__title`（全部 verse 弹窗标题共用）→body 18px/500/主白；`.swap-panel__head h2`（交易台卡头）→body 16px/500/text-secondary；`.section-heading h2`（portfolio 区头）→body 20px/500/主白；`.home-hero__title-lead`（首页 hero 引导行）→body 16px/500/text-secondary + label-tracking（kicker 化，原 zh 专属 0.65em 覆盖随固定字号删除）；`.home-section__heading h2`/`.home-final-cta h2`（首页区头/终章）→body 500、clamp(20px, 3vw, 32px)；`.site-footer__statement`（页脚宣言）→body 500、clamp(20px, 2.35vw, 32px)。display 族自此仅余页面 h1、hero 主题行、空态大标题（有意 700 展示粗体）。
- **方案（② 字重补档）**：`fonts.ts` Noto Sans SC 补 `'600'`——B 档全组恢复真实 semibold，中英按钮/标签字重一致；IBM Plex Sans 补 `'700'`——en 侧表头/裸 strong 命中真粗体与 zh 对齐。400/500/600/700 四档梯度双语闭合。
- **token 影响**：无增删（仅字体装载清单与既有规则取值变化）。
- **验证**：七处前后对比预览逐项拍板（本决议前一轮）；全量 e2e 基线重录（`--update-snapshots=all`）。
- **同日纠偏（二轮定稿）**：落地后用户仅驳回 hero 引导行一处——「让一次共识，成为」kicker 化后 16px 贴 60px 主标题失衡（元素特写预览没暴露整页语境问题）。`.home-hero__title-lead` 单独恢复原 display 0.7em/600（含 zh 0.65em 特判回填），粗块由 ② Noto 600 补档消解；区头/终章/页脚宣言降档与 #1–#4 模块级降档全部维持。
- 签名：approved by Jasonrale（用户裁定）

## 2026-10-08 · 决议 019 补充 1 · fmtPrice 扩域到蜡烛图图例 OHLC/MA（用户裁定「扩域」）

- **背景**：交易台蜡烛图图例 OHLC/MA 五处沿 `toFixed(6)` 定长（96ced79），属 e107c48 口径收敛射程（「有 fmtTiered 副本的五处」）外的残留，2026-10-08 fix-review 以 P1（minor）登记路由。决议 019 的 fmtPrice 登记射程仅 token-strip，图例外延无真源，按纪律列 Q 待拍板，用户裁定扩域。机制核对：markets.json 全部 36,480 个价格样本 ∈[0.0037, 0.0525]，toFixed(6) 无精度损失、fixture 钳死无溢出——扩域收益=去尾零市场风格统一（`0.014200`→`0.0142`），代价=图例数值长短不齐（定长对齐让位，已知悉）。
- **方案**：`candle-chart.tsx` 图例 OHLC o/h/l/c 与 MA 五处 `toFixed(6)`→`fmtPrice`（无 locale 参，中英同形）；`amount-format.ts` fmtPrice 头注与 `component-contract.md` §1 大数边界行射程同步为「token-strip + 蜡烛图图例」。涨跌幅行 `change.toFixed(2)%` 不在本决议射程（§3 百分比表归口，待另拍板）。
- **token 影响**：无增删。
- **验证**：tsc 全树绿、vitest 138/138、prettier 绿；candle-order.test.ts 不钉图例格式零冲突。图例视觉变化并入本轮欠账的 e2e 基线重录（vault/flash/图例一起 `--update-snapshots=all`）。
- 签名：approved by Jasonrale（2026-10-08 用户裁定）

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

### 决议 018 补充 9 · ④分区代码词汇 vouchers→participations（2026-10-08 用户裁定「vouchers 这个单词有歧义，换一个」）

- **背景**：补充 3 已把 voucher 词族逐出可见文案（en 页签 `Joined`、区标题 `Participations`、副标题改写——依据=OutrunBook 全库零次使用 voucher、真源词族 participation/join），但代码词汇层残留：`VouchersZone`/`FixtureVoucherRow`/`getFixtureVoucherRows`、CSS `.pf-vouchers`/`.pf-voucher-row`（globals.css 45 处选择器）、分区键 `'vouchers'`、锚点 `#pf-vouchers`、copy 键 `portfolio.vouchers`。用户裁定换词。
- **选词**：`participations`——补充 3 登记的区全称（Participations/参与凭证）即真源词族名词形；fixture 源数据本名 `getFixtureParticipations()`（行视图以 Row 后缀区分）。
- **方案**：词族全量替换（含大写形态，11 文件）：组件 `ParticipationsZone`/`ParticipationRow`+文件 `participations-zone.tsx`、类型 `FixtureParticipationRow`、getter `getFixtureParticipationRows`、CSS `.pf-participations`/`.pf-participation-row`（含 positions-zone 借用的 `__none` 共享选择器）、分区键/`data-zone-wrap`/badges/children `'participations'`、锚点 `#pf-participations`（KPI href+ANCHOR_ZONES+components.md 登记）、copy 键 `portfolio.participations`。可见文案值零变化（Joined/已参与/Participations 不动）；zh 文档词「参与凭证」不动。登记同步：components.md（4 处 class 引用）、component-contract.md §29、page-briefs/portfolio.md（`?section=` 枚举字面——该参数本无实现，纯登记面）。历史决议/critique 存档不改（decision-log 14 处历史提及保留）。
- **token 影响**：无增删（class 改名不附样式变化）。
- **验证**：tsc --noEmit 全树绿；vitest 183/183；check:design 0 命中；fixture boundary --source OK；prettier 绿；e2e 基线无需重录（class/键名/锚点 id 不进渲染输出，页签 aria-label 与文案值未动）。
- 签名：approved by Jasonrale（2026-10-08 用户裁定「vouchers 这个单词有歧义，换一个」）

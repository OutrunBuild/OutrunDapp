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

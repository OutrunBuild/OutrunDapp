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

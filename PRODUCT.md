# Outrun DApp 产品真相骨架（初稿 · Stage-01 步骤 1）

> 状态：骨架。唯一架构真相源为 `docs/architecture.md`（§1、§2、§10、§18）。
> 本文件只登记范围与约束，不预选视觉方案。

## 1. 产品用户

固定引用 OutrunBook `ecosystem/audience.md`，不凭空画像：

- Memecoin 社区核心：公平抗 rug 启动、杠杆创世、DAO 治理。
- DeFi 用户 / 收益农夫：uAsset 统一出口、创世质押铸 uAsset、PSM 兑换、USR 储蓄。
- 稳定币 / uAsset 使用者：UETH/UUSD/UBNB 跨链媒介。
- 杠杆 / 进阶玩家：无清算杠杆创世、PT/YT 拆分。
- Memecoin 发起人 / 项目方：一键多链启动、四池流动性、Staking 与 DAO 基建。

共性：需求与资金流经 uAsset。

## 2. 路由范围（11 条，architecture.md §2，2026-09-14 IA 修订后）

URL scheme（2026-09-22 方案 C，用户裁定）：`en` 无前缀（`proxy.ts` 内部 rewrite 到 `/en/**`，URL 不显露），`zh` 带 `/zh` 前缀，**默认 `en`**，裸 `/` 即 en 落地页（rewrite，非 307）。下表路径为 en 形态。memeverse 子域命名（2026-09-23 用户裁定）：创建页 `/memeverse/launch`、发现页 `/memeverse/explore`，详情页 URL 用数字段（= 链上 uint256 verseId 口径，fixture 行 id 如 `verse-021` 不进 URL）；旧地址由 `proxy.ts` 307 收敛。

| # | 路由 | 职责 |
|---|---|---|
| 1 | `/` | 产品落地页（决议 007）：产品介绍（双模块闭环）、三档参与路径、营销指标带（总锁定 uAsset/Verse 总数/累计参与地址）、支持资产说明、CTA；无个性化摘要 |
| 2 | `/bridge` | 全链资产：uAsset/GenesisCredit 跨链报价、限额、费用、消息状态、历史 |
| 3 | `/memeverse/explore` | 发现：阶段 tab（创世中默认/锁定中/已解锁）+阶段内排序+治理链/资产族过滤+搜索+参与规模（决议 007：阶段为分组维度，不跨阶段混排；「全部」tab 系原文笔误，2026-10-01 用户勘误删除；2026-09-23 原 `/memeverse` 收敛于此） |
| 4 | `/memeverse/launch` | 创建：注册参数、symbol 校验、多链选择、费用报价、提交、跨链注册状态（2026-09-23 原 `/memeverse/create`→`/launch` 改名） |
| 5 | `/memeverse/[verseId]` | Verse 总览：生命周期、Genesis、Preorder、退款、领取、四池、时间、权益；`verseId` 为数字段（链上 uint256 口径） |
| 6 | `/memeverse/[verseId]/trade` | Swap 与流动性：普通 Swap、Permit2、加减流动性、LP 费用、返佣、动态费率 |
| 7 | `/memeverse/[verseId]/yield` | 收益（Yield）：杠杆创世、创世积分付息/退款、split/merge、YT 闪电兑换、settlement 和赎回；PT/YT 凭证管理 |
| 8 | `/memeverse/[verseId]/stake` | Memecoin Staking：存入、赎回请求、领取、收益、跨链 Staking、委托状态 |
| 9 | `/memeverse/[verseId]/governance` | DAO 治理：提案、投票、投票权、周期奖励、国库、执行状态 |
| 10 | `/portfolio` | 三分区（决议 007）：①可行动（待领取/待执行赎回/保护窗倒计时/跨链在途提醒→/bridge）②仓位与储蓄（CDP 赎回（redeem 唯一减借）+USR 存取）③凭证（POL/PT/YT 兑付时间线）；六链余额、GenesisCredit、奖励；无跨链历史/无交易历史 |
| 11 | `/account` | 钱包与智能账户：已连接钱包、活动账户、逐链 EIP-7702 状态、实现地址、启用替换撤销 |

撤出三条（`/outstake`、`/outstake/[market]`、`/positions`）的能力按 §2 裁定并入参与动线与 `/portfolio` 条目，不单独成行。导航文案不得出现 OutStake 字样。

全局交互面：主网/测试网模式、查看链选择器、钱包选择器、交易中心（跨链消息详情承载于此，三阶段组件）、通知中心（v1 延后——Portfolio 可行动区+toast 承接）、中英文切换（决议 007）。

> 产品事实层 = `docs/page-briefs/product-intent.md`（定稿，决议 007）；本表为聚合视图，冲突时以产品事实层为准。参与面板（普通创世默认+杠杆切换+预购分配器）、动线挂载与术语见 `docs/page-briefs/{product-intent,glossary}.md` 与 decision-log 决议 007。

## 3. 双语（决议 001-B 修订）

- 单语言渲染：每页只显示一种语言，`zh`/`en` 切换，**默认 `en`**（2026-09-17 架构修订落地默认 en；2026-09-22 方案 C 定形：en 无前缀、zh 带 `/zh` 前缀、裸 `/` 为 en，语言切换走 `components/prototype/routes.ts` 的 `localePath`，决议 001-B/006）。
- 禁止同页混排双语标签；两种语言分别做全量验证与溢出测试，禁止只验证一种后推断另一种可用。

## 4. 全状态

原型必须覆盖（architecture.md §1 + §10）：未连接、连接中、错误网络、普通 EOA、智能账户启用中、已启用智能账户、授权、签名、提交、确认、成功、失败、Loading、Empty、Error；零余额、零仓位、未部署、暂停、RPC 故障、索引延迟（lag >120s）、用户拒签。

## 5. fixture 边界

- 原型数据用符合真实产品规则的确定性 fixture。
- fixture 不得进入生产数据路径（`fixtures/` 与生产构建隔离，阶段 1 不接入 ABI/RPC/Privy/真实交易）。

## 6. 原型阶段门

- 覆盖全部 11 路由与全局交互面；1440px + 390px；双语；全状态；主流程可点击；无静态拼图、空按钮、占位页、lorem。
- 每轮设计反馈维护“本轮关闭的差异项”；连续两轮无有效关闭则停下人工对齐。

## 7. 参考分栏

- 视觉审美参考：只用于风格学习（步骤 3/4）。
- 交易 UX 参考：只用于信息密度、状态反馈、审阅流程约束（步骤 5），不推导视觉语言。
- **阶段 1 的界面片段（comparison/axis-choice 等）不是产品 UX 依据（决议 005）**——本文件的 11 路由职责与阶段 2 brief 才是。

## 8. 决策状态（阶段 2 步骤 5 更新）

四轴锁定（决议 001~004）：方向 D1 暗端信号台（去极客修订）/ 色板 P2 冷石墨 / 密度 T2 均衡 / 字标 brand/ 包唯一基准；视觉真相见 DESIGN.md（定稿）。决议 005：阶段 1 界面片段仅视觉参考。决议 006：架构修订窗口（基线推进+默认 locale 落地）。决议 007：阶段 2 产品拍板全量（11 PD+9 对账+术语表；参与面板/落地页/三分区 Portfolio/阶段 tab/交易中心承载跨链详情/通知中心延后/无代付入口）。路由裁定（2026-09-22/23，用户）：URL 方案 C（en 无前缀/zh 前缀）与 memeverse 子域命名（`launch`/`explore`、数字 `verseId`），登记于 AGENTS.md 与 `components/prototype/routes.ts`。

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

## 2. 路由范围（真相源=`docs/page-briefs/routes.json`）

URL scheme：`en` 无前缀（`proxy.ts` 内部 rewrite 到 `/en/**`，URL 不显露），`zh` 带 `/zh` 前缀，**默认 `en`**，裸 `/` 即 en 落地页（rewrite，非 307）。memeverse 子域命名：创建页 `/memeverse/launch`、发现页 `/memeverse/explore`，详情页 URL 用数字段（= 链上 uint256 verseId 口径，fixture 行 id 不进 URL）；旧地址由 `proxy.ts` 307 收敛。

现行 7 条产品路由（职责与动线详见 routes.json 与各页面 brief）：`/`（落地页）、`/memeverse/explore`（发现）、`/memeverse/launch`（创建）、`/memeverse/[verseId]`（详情单页四标签 liquidity/pol/vault/dao）、`/portfolio`（资产与活动，含跨链 BridgeDialog——v1 无独立 /bridge、无 /account 页，账户面=组件级弹窗）、`/referral`（推荐返佣）、`/faucet`（测试网水龙头）；另有内部工具页 `/design-system`（不进导航）。

全局交互面：主网/测试网模式（未实装）、查看链选择器、钱包选择器、动作弹窗+三步状态条（跨链消息详情承载于此，三阶段组件）、通知中心（v1 延后——Portfolio 待办区+toast 承接）、中英文切换（决议 007）。

> 产品事实层 = `docs/page-briefs/product-intent.md`（定稿，决议 007）；本表为聚合视图，冲突时以产品事实层为准。参与面板（普通创世默认+杠杆切换+预购分配器）、动线挂载与术语见 `docs/page-briefs/{product-intent,glossary}.md` 与 decision-log 决议 007。

## 3. 双语（决议 001-B 修订）

- 单语言渲染：每页只显示一种语言，`zh`/`en` 切换，**默认 `en`**（架构修订落地默认 en；方案 C 定形：en 无前缀、zh 带 `/zh` 前缀、裸 `/` 为 en，语言切换走 `components/global/routes.ts` 的 `localePath`，决议 001-B/006）。
- 禁止同页混排双语标签；两种语言分别做全量验证与溢出测试，禁止只验证一种后推断另一种可用。

## 4. 全状态

原型必须覆盖（architecture.md §1 + §10）：未连接、连接中、错误网络、普通 EOA、智能账户启用中、已启用智能账户、授权、签名、提交、确认、成功、失败、Loading、Empty、Error；零余额、零仓位、未部署、暂停、RPC 故障、索引延迟（lag >120s）、用户拒签。

## 5. fixture 边界

- 原型数据用符合真实产品规则的确定性 fixture。
- fixture 不得进入生产数据路径（`fixtures/` 与生产构建隔离，阶段 1 不接入 ABI/RPC/Privy/真实交易）。

## 6. 原型阶段门

- 覆盖全部 7 条产品路由与全局交互面；三档冻结视口（1280×800 / 860×900 / 390×844）；双语；全状态；主流程可点击；无静态拼图、空按钮、占位页、lorem。
- 每轮设计反馈维护“本轮关闭的差异项”；连续两轮无有效关闭则停下人工对齐。

## 7. 参考分栏

- 视觉审美参考：只用于风格学习（步骤 3/4）。
- 交易 UX 参考：只用于信息密度、状态反馈、审阅流程约束（步骤 5），不推导视觉语言。
- **阶段 1 的界面片段（comparison/axis-choice 等）不是产品 UX 依据（决议 005）**——本文件的 11 路由职责与阶段 2 brief 才是。

## 8. 决策状态（阶段 2 步骤 5 更新）

四轴锁定（决议 001~004）：方向 D1 暗端信号台（去极客修订）/ 色板 P2 冷石墨 / 密度 T2 均衡 / 字标 brand/ 包唯一基准；视觉真相见 DESIGN.md（定稿）。决议 005：阶段 1 界面片段仅视觉参考。决议 006：架构修订窗口（基线推进+默认 locale 落地）。决议 007：阶段 2 产品拍板全量（11 PD+9 对账+术语表；参与面板/落地页/分区 Portfolio/阶段 tab/跨链详情承载/通知中心延后/无代付入口）。路由裁定：URL 方案 C（en 无前缀/zh 前缀）与 memeverse 子域命名（`launch`/`explore`、数字 `verseId`），登记于 AGENTS.md 与 `components/global/routes.ts`。

# 阶段 2 输入清单（Stage-01 → Stage-02 页面 brief 与 fixture）

> ⚠️ **首要警告（决议 005）**：阶段 1 的界面片段（comparison.html / v0 direction-choice / axis-choice / 各 preview 中的 POL 示例）**不代表产品 UI/UX**——勿抄其 IA、布局、字段编排。产品 UX 从下述真相文件重新推导。
>
> 阶段 2（`docs/runbooks/stage-02-page-briefs-fixtures.md`）从这里取输入。全部路径为仓库相对路径；本清单被 final-artifacts.sha256 冻结。

## 1. 设计真相（每份 brief 的视觉依据）

- `DESIGN.md`（定稿：D1 去极客修订 / P2 冷石墨 / T2 均衡 / 字标锁定；红线与负面清单）
- `components/design-system/tokens.css` + `token-contract.md`（唯一样式来源；brief 引用 token 名而非色值）
- `components/design-system/component-contract.md`（10 组件的**行为**契约：状态/键盘/aria/数字规则——brief 直接引用；其示例内容是视觉演示，非产品依据〔决议 005〕）
- `components/design-system/state-matrix.md`（§4 路由×状态适用表——每条路由的必测状态集）
- `components/design-system/motion-and-a11y.md`（唯一品牌 moment 与 a11y 硬规则）

## 2. 产品真相

- `PRODUCT.md`（11 路由表、全局交互面、单语切换默认 en、全状态、fixture 边界、阶段门）
- `docs/architecture.md` §2（含 2026-09-14 IA 修订与嵌入动线裁定；默认 locale 已于 2026-09-17 修订为 `/en`——决议 001-B 落地 + 决议 006，见 architecture §21）

## 3. 每路由信息密度依据

- `docs/design/references/complexity-map.md`（11 路由密度/复杂操作 Top/字段类型[T]/OutrunBook 引源；/portfolio 嵌入动线四线；4 条冲突附注——brief 涉及费率去向时必须先对账合约 spec）

## 4. 决策与证据链（brief 引用来源 ID 时用）

- `docs/design/decision-log.md`（001~004）
- `docs/design/references/source-register.json`（VS-001~009；brief 禁引 PU-* 作视觉来源）
- `docs/design/references/aesthetic-principles.md`（borrow/adapt/须关闭清单 D）

## 5. 术语与文案

- 决议 001-A：消费化文案；机制词按 architecture §2（uAsset/suToken 可见，SY/CDP/PSM 仅必要时且经阶段 2 术语表定稿——**阶段 2 首项决策**：资产动线嵌入位置与呈现，其后 USR-v1、Genesis 双路径呈现、治理时间口径、POLend payer/user）
- OutrunBook 冲突处理：叙事以 OutrunBook 为准、机制以合约 spec 为准（§20）

## 6. 阶段 2 起点验证

- 运行时：`node scripts/check-runtime.mjs --strict`（当前 OK）
- 工作区：尚无 package.json → 阶段 2 按其 runbook 建工作区并冻结 package/lockfile（bootstrap 脚本已就位）
- v0：阶段 2 如需新研究轮，重生成输入包（round-00 仅研究轮，不得当最终输入）

## 7. 移交的未决事项（非阻断）

- F7 字体加载策略（阶段 3 实现约束）
- architecture.md §2 默认 locale 修订：**已完成 2026-09-17**（决议 006，架构修订窗口内落地，见 §21）
- v0 revision 稳定 ID（如 v0 后续提供，追加记录即可，不动既有链）

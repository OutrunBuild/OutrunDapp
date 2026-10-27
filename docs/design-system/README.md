# Outrun 设计系统（唯一 UI 规范入口）

> 面向所有后续开发者与 Agent。开始任何 UI 工作前先读本页，再按任务读对应章节。
> 品牌决策、对比度实测与视觉世界定义来自 `DESIGN.md` 与 `docs/design/decision-log.md`（决议 001~012）；本目录只做**系统化与可执行化**，不重新做决策。

## 0. 一句话

**暗端信号台 · 复古未来主义全浓度，但信息结构是日常消费产品。** 黄是唯一主行动光，青是功能与 focus，品红只做 1–2px 错位回声；数字一律等宽 + tabular-nums 且零 glow。

## 1. 真相源层级（冲突时上层胜）

| 层 | 文件 | 说明 |
|---|---|---|
| 决策 | `docs/design/decision-log.md` | 人工签署的决议，AI 不得代改 |
| 视觉真相 | `DESIGN.md` | 世界观、色板、字体、密度、负面清单 |
| Token 实现 | `components/design-system/tokens.css` | 唯一 token 源，页面/组件不得裸写颜色、字号、间距 |
| Token 契约 | `components/design-system/token-contract.md` | 命名、角色与禁用规则 |
| 主题桥接 | `app/globals.css`（`@theme inline` 与 `:root`） | 把 token 映射到 shadcn 语义变量（`--primary`、`--ring` 等） |
| 组件契约 | `components/design-system/component-contract.md` | 领域组件的状态/键盘/aria/文案行为 |
| 状态与动效 | `components/design-system/state-matrix.md`、`motion-and-a11y.md` | 异步状态映射、reduced-motion 策略 |
| 字体源 | `components/design-system/fonts.ts` | 生产字体唯一声明处，`tokens.css` 组合成 `--font-*` 角色 |
| 活体展示页 | `/{locale}/design-system` → `components/design-system/showcase.tsx` | 全部 token 与已登记组件的回归面，改样式先看这里 |
| 本目录 | `docs/design-system/*.md` | 基础、组件索引、页面模式、文案、工作流 |

## 2. 章节导航（按任务读）

| 任务 | 读 |
|---|---|
| 选颜色 / 字号 / 间距 / 形状 / 阴影 / 断点 | [foundations.md](./foundations.md) |
| 用现成组件、写新组件、判断该用哪个 | [components.md](./components.md) |
| 搭新页面、布局、响应式、空态/加载态 | [patterns.md](./patterns.md) |
| 写文案、双语、数字与日期格式 | [copy-and-i18n.md](./copy-and-i18n.md) |
| 开工前检查、交付前验证 | [agent-workflow.md](./agent-workflow.md) |
| 跨工具链 Agent 入口 | 仓库根 `AGENTS.md`（任何 Agent 工具都会读到）+ `.agents/skills/outrun-design-system/SKILL.md` |
| 领域组件（金额输入、资产选择、交易审阅等）的行为 | `components/design-system/component-contract.md` |

## 3. 十条硬约束（任何页面不得豁免）

1. 只用 token：`var(--color-*)`、`var(--space-*)`、`var(--text-*)`、Tailwind 语义类（`bg-primary`、`text-muted-foreground`）。禁止 `#hex`、`px` 裸值、`bg-blue-500` 之类原始色。
2. 黄 `--accent-primary` 是唯一主行动色；每个视口内主 CTA 只有一个。
3. 青 `--or-cyan` 只用于链接、focus、功能信号（live 点、选择线、tinted 描边）；禁大面积青色块。
4. 品红 `--accent-echo` 分层管辖（决议 015）：品牌铬层（壳/签名/CTA chrome）只做回声——1–2px 错位线、内衬、徽章、≥20px 大字或图形；数据语义层（阶段色/图表系列/仪表 datum）按数据规则用——语义一致、对比达标、可面填充、不要求回声配对；营销叙事层可大用，逐例人工过。正文与小字号全层禁用。
5. 所有数字字段（价格、余额、数量、时间戳、地址、hash）加 `data-numeric`，禁止对数据文本加 glow。
6. glow 仅通过 `.ax-glow-*` 挂在结构记号上，由 `[data-glow]` 统一开关；关闭后全站仍须 AA。
7. focus 全站唯一：青 2px 外环（`:focus-visible` 已全局定义），组件不得自定义其它 focus 样式。
8. 斜切三档：UI 件 ≤8px `--chamfer`；面板 10px `--chamfer-panel`；KPI/特征卡 12px `--chamfer-card`。切角容器圆角 = 0；不要同时圆角 + 切角。
9. 表格行高 44px `--row-height`，控件高 40px `--control-height`；中文正文 ≥14px。
10. 负面清单：蓝→紫→青渐变、无依据装饰渐变、居中三卡片、默认 Inter、emoji 图标、未定制 shadcn 主题、数据层发光、同一控件三色同填。

## 4. 目录结构

```
DESIGN.md                                  视觉真相（定稿）
docs/design/decision-log.md                人工决议链
docs/design-system/                        本目录：可执行系统
components/design-system/tokens.css        token 唯一源
components/design-system/*.md              契约（token/component/state/motion）
app/globals.css                            主题桥接 + 页面级 class（.product-shell、.economy-card 等）
components/ui/*                            shadcn 基础件（base-ui 版：button/input/select/field/label/separator/dialog/dropdown-menu/popover/sheet/switch/textarea/toggle/toggle-group/tooltip）
components/global/signal-ui.tsx         系统原子：StageBadge / SectionHeading / ProgressMeter / 格式化函数
components/global/app-shell.tsx         OutrunShell：产品壳与营销壳
components/global/copy.ts               双语文案字典（getCopy）
public/brand/                              字标与符号成品（禁改色/拉伸/裁切）
```

## 5. 变更规则

- 新增视觉值：先加 token 到 `tokens.css` 并在 `token-contract.md` 登记角色，再使用。
- 新增可复用组件：领域件放 `components/<域>/`（verse/home/discovery/create/portfolio/referral/faucet）、跨页共享放 `components/global/`、基础件放 `components/ui/`，并在 [components.md](./components.md) 登记公开 API、状态与禁忌。
- 新增页面级 class：放 `app/globals.css`，命名 `block__element`，状态用 `data-*`（`data-active`、`data-stage`、`data-open`），不用修饰类叠加。
- 触及品牌方向、色板、字体角色、密度的变更 = 需要新决议，写入 `decision-log.md` 并由人工签署后才可实施。
- `DESIGN.md` 定稿正文只反映最新状态：变更叙事与时间点注记（「已删/已改 + 日期」式）只进 `decision-log.md` 对应条目，正文禁追注；现行约束连同其 why 直接写正文。
- 本目录登记文件（components.md 各表、patterns.md 等）同守此则：条目=现行状态**单一版本**，更新=改写原条目、不追加重复行；日期、轮数、被否候选编年只进 `decision-log.md`，条目内至多保留一句禁令或 rationale。`pnpm check:design-docs` 拦截 §6 模式名重复与超长单行（§6 沿革已按此口径清扫）。

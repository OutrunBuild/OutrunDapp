# 动效与无障碍契约（Stage-01 步骤 11）

## 1. Motion 契约

### 唯一品牌 moment：回声确认（echo-confirm）

- 定义：确认/成功态主元素上，品红 `--accent-echo` 错位副本（+3px,+2px）闪现一次，时长 ≤`--motion-fast` 120ms，`--ease-out`。
- 触发位：交易 Confirmed（T6）、阶段推进完成（VerseStage）、领取成功。
- reduced-motion 降级：静态双描边（黄+品红 1px 双 outline），无任何位移/闪烁。
- 全局 reduced-motion 策略（tokens.css）：装饰 animation 全停；状态反馈 transition 保留但仅限非位移属性（opacity/色/边框/阴影）且 ≤100ms——位移与布局过渡自动失效。回声确认属装饰层，降级为双描边。
- 决议 010 起**装饰性动效共三枚**：回声确认 + 信号脉冲（live 指示青点 steps(2) 1.4s 脉冲——live 数据源在场的信号语义）+ 标题信号失真（`.ax-fault-title`，2026-09-30 用户裁定例外化；8s 周期短促爆窗，静默期 ~93% 完全干净，契约细节见 docs/design-system/components.md 同名条目与 decision-log 2026-10-01）；其他一切动效必须服务状态反馈。CRT 扫描线/HUD 网格为静态纹理层，非动效。决议 023 增第四枚：**分享组抖动**（`.verse-share__hint/__button`，1.5s 循环 ±2.5px 水平抖动、70% 处回正静默 ~30%——用户当次明示「可快速抖动的吸引注意力」；`prefers-reduced-motion: no-preference` 包裹自动停抖、零 glow、纯装饰不承载状态）。

### 状态反馈动效（允许清单）

| 动效 | 参数 | 用途 |
|---|---|---|
| 骨架屏脉动 | opacity .6→1，1.2s 循环 | D1 Loading（reduced-motion：静态骨架） |
| 步骤推进 | 高亮位移 200ms `--ease-out` | TransactionStatus（reduced-motion：直接切换） |
| 弹层进出 | 120ms fade+8px 位移 | 选择器/交易中心（reduced-motion：纯 fade 120ms） |
| hover 过渡 | ≤120ms（背景/边框/下划线） | 行、按钮、链接 |
| focus 环 | 无动效（即时） | 全站 |

### 禁止

- 入场编排（多元素错峰进场）、滚动视差、循环装饰动画、未绑定状态的动画、大面积 glow 呼吸。
- `animation-iteration-count: infinite` 仅限骨架、spinner、标题信号失真（周期循环爆窗，8s）与分享组抖动（决议 023）。

## 2. 无障碍契约（architecture §10 全量落地）

### 键盘

- 全部交互件 Tab 可达、Shift+Tab 逆序；可见 focus（青 2px 外环+2px offset，`:focus-visible`）。
- 弹层：focus trap、Esc 关闭、关闭后焦点还原触发器。
- 列表/选择器：↑↓ 导航 + Enter 选中 + `aria-activedescendant`。
- 表格行展开：Enter 切换；排序表头按钮 + `aria-sort`。
- 无键盘陷阱；无大于一屏的 Tab 链。

### 屏幕阅读器

- 异步状态：`aria-live="polite"`（数据/表单），交易状态用 `assertive`（T 系）。
- 图标按钮：可访问名称（`aria-label` 或可见文本）；纯装饰图标 `aria-hidden`。
- 状态徽章（阶段/生命周期/账户）：文本化（颜色非唯一载体——决议 002 拒绝 P3 后的补偿性规则：徽章恒带文本）。
- 数字变化（KPI 刷新）：不进 live region（避免噪音），完整值可聚焦获取。

### 触控与目标

- 控件触控目标 40×40px（`--control-height`，高于 WCAG 2.5.8 AA 24px 底线；44=行高 T2，行内控件天然达标）。纯图标钮（`.create-info` ⊙）视觉 14px、命中区经 `::before` 外扩至 24×24；tile 容器（Communities 社交块）以整块为触达面，内部输入框高度属视觉非触达。移动端底部 tab ≥48px。
- 间距不小于 8px 分离相邻目标。

### 对比与可读性

- 全部 token 色实测 AA/AAA（DESIGN.md §2 表）；大字号 ≥3:1。
- 数据层零 glow；品红仅 ≥20px/图形；`prefers-reduced-motion` 全局降级（tokens.css 已内置）。
- 中文正文 ≥14px；`/{locale}` 单语渲染，双语各自完整（含状态文案）。

### 双语溢出

- zh/en 各自布局验证；按钮/徽章/状态标签按最长语言设计（en 通常更长），禁止固定宽度截断文本；溢出测试为阶段 3 Playwright 必测项（§11.2）。

## 3. 验证入口（阶段 3 前手工基线）

- token-preview.html：Tab 走查 focus 环唯一性。
- component-contract-preview.html：本文件契约的黑盒检查页（键盘走查/状态文案/reduced-motion 模拟）。

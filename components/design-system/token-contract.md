# Token 契约（Stage-01 步骤 10）

> `tokens.css` 是全站唯一颜色/字体/间距/动效来源。本文件定义命名、来源、使用边界。任何页面/组件不得裸写颜色、字号、间距、阴影值。

## 1. 人工决策溯源（decision-log.md）

| Token 组 | 决议 | 锁定值 |
|---|---|---|
| 品牌锚 6 色 + 站点黑 | 001/004（brand/logo-spec.md） | `--logo-yellow #FCEE0A` 等，页面不得覆盖、不得改色 |
| 表面/文本/反馈 | 002 P2 冷石墨 | `--color-surface #12141B`；正文 `#E6E9F0` 15.14:1；成功 `#35E08E`；危险 `#FF5468` |
| 密度 | 003 T2 均衡 | 行高 44px / 正文 14px；T1(36)/T3(56) 仅限注明的局部区域；`--topbar-height` 52px 顶栏双壳统一高（020 补充 7） |
| 字标 | 004 | brand/ 包唯一基准；字标 ≥96px 宽，<150px 用 symbol；浅底 mono；禁改色/拉伸/裁切 |
| 方向与去极客 | 001 + 001-A | 等宽仅数据字段；无 KERNEL/DELEGATED 等符号；文案消费化 |
| 复古未来主义签名层 | 010（r10 提取） | HUD 网格（44/22px 青线）/品红回声轨（-72px 位移回声）/CRT 扫描线/信号脉冲 1.4s/斜切三档（≤8/10/12px）/glow 分层开关 `[data-glow=on]`/卡片青 tinted chrome/字体身份（Saira Condensed+IBM Plex Sans/Mono） |
| 字阶与间距新档 | 017（2026-10-05） | `--space-9` 96px（页面级分区组间距，组间 > 组内承担分组识别；**2026-10-08 用户裁定组合页组距统一为 `--space-7`，本档退为保留、仅存宽度类消费位**）；KPI 计数档全站钉 `--text-md`（终结 pf-kpi 18 / verse 芯片 15 并存；**例外 2026-10-06 用户裁定**：Yield Vault 概览、DAO 概览+周期卡 dd 18→16 稍缩小，与各自移动档 hairline 行 dd 16 归一——globals.css 共享 KPI dd 规则后的 scoped 覆盖段） |

## 2. 使用边界（硬规则）

1. **数据层文本零 glow**：`text-shadow`/发光禁止用于数字、表格、正文；glow 仅结构记号与强调层（导航激活条/斜切记号/CTA/卡片青微光），由 `[data-glow=on]` 统一开关，off 全站仍 AA（010 修订——r10 部署实测该开关体系）。
2. **tabular-nums 强制**：一切数字字段（价格/收益率/余额/数量/百分比/区块/时间戳）必须 `--font-data` + `tabular-nums`（`[data-numeric]` 类或等价机制）。
3. **品红分层管辖**（决议 015，修订 010/012 适用面）：①品牌铬层（壳/签名/CTA chrome）=回声纪律——1–2px 错位线/内衬、小徽章、≥20px 大字或图形；②数据语义层（`data-stage` 阶段色、图表系列、仪表 datum 等）=数据规则——语义全站一致（locked 恒品红）、对比达标、数据墨水克制、允许面填充、不要求回声配对；③营销叙事层（营销壳/hero/活动）=大字/图形/渐变时刻允许，逐例人工过。全层不变：正文与小字号禁用（对比 5.19~5.89:1 档）、不与黄/青争语义。
4. **青色限界**：链接与 focus ring 专用；禁大面积色块（logo-spec §2）。
5. **单一 focus 语言**：`:focus-visible` 2px `--or-cyan` 外环，全站唯一，不得自造。
6. **渐变禁令**（负面清单，010 例外清单收窄）：渐变不得作按钮默认装饰、不得使用日落渐变（D2 桥接物未采纳）；**例外**=010 签名纹理层（HUD 网格线、主区品红 135° 角部洗色 `--echo-wash-magenta`、CRT 扫描线）——仅限 tokens.css `.ax-*` 签名层定义的纹理，组件不得自造渐变。
7. **斜切三档体系**（010 修订）：UI 件 ≤ `--chamfer` 8px；表格/卡片容器单角 `--chamfer-panel` 10px；KPI/斜杠记号对角双切 `--chamfer-card` 12px（`clip-path`，切角容器圆角=0）。
8. **双语文案**：页面单语言渲染，zh/en 经 `localePath()` 切换（对外 URL：en 无前缀、zh 带 `/zh` 前缀，默认 en；决议 001-B）；禁止同页混排双语标签。
9. **字号硬线**：中文正文基准 `--text-base` 16px、阅读文本 ≥ `--text-sm` 14px、标签 ≥ `--text-xs` 12px（决议 013 全量上调：11/12/14/16 → 12/14/16/18；001-A 的 ≥14px 硬线由 013 收紧）。
10. **reduced-motion**：唯一装饰动效「回声确认」（120ms 品红错位闪烁）降级为静态双描边；其余动效仅服务状态反馈。

## 3. 命名约定

- `--color-*` 语义色（bg/surface/text/feedback/border）
- `--accent-*` 强调语义（primary/echo/link）
- `--shadow-{raised,header}` 抬升层接触阴影（数据层文本零 glow 边界见 §2.1）
- `--swatch-well` 样张井（design-system showcase 色样恒定背衬，P1-2 修复；亮度窗口实算取值，深色系样张对井 ≥3:1 显形）
- `--logo-*`/`--or-cyan`/`--site-black` 品牌锚（只读）
- `--font-{display,body,data}`、`--text-{xs..xl}`、`--space-{1..9}`、`--row-height*`、`--topbar-height`、`--z-*`
- `--text-num-lg 22`：数字读数语义档（mono 消费；组合页头净值 hero 读数用 `--text-xl`）
- `--color-surface-{header,navigation,kpi}`：顶栏（≈90%）/侧栏导航（≈95%）/KPI 卡面（≈88%）三个专用半透明面
- `--cta-hover`：主 CTA hover 亮黄
- `--grid-cyan-{inner,outer}` / `--grid-size-{inner,outer}`：HUD 网格线颜色与线距（内/外两档）
- `--scanline-white`：CRT 扫描线叠加色（≈2% 白）
- `--signal-pulse-duration`：live 青点脉动周期（1.4s steps(2)）
- `--inset-light-{cyan,yellow}`：KPI 顶缘内衬光（青/黄两变体，同 alpha 档）
- `--font-weight-semibold`：强调字重 600
- `--display-title` 展示档字号（h1/营销大标题唯一字号源，`clamp(30px, 1em+22px, 44px)`，1em 随使用点继承解析、16px 上下文≈38px；DESIGN.md §3 + foundations.md §2 钉死口径）。角色专用尺寸 token，**不在 `--text-*` 字阶梯内**——展示档不得以 `--text-xl` 等档位 token 替代（2026-10-04 showcase 样张失真裁决后补登）
- 组件只引用上述 token；新需求先扩 token 再用（阶段 2 起 PR 审查项）

## 4. 字族（010 终选，r10 部署实证）

`--font-display=Saira Condensed`（窄体复古未来主义，600/700）、`--font-body=IBM Plex Sans`、`--font-data=IBM Plex Mono`、中文 Noto Sans SC——均经 next/font 自托管（满足自托管约束），非默认 Inter。display 窄体大标题是 010 复古未来主义强化的组成部分；正文/导航/按钮仍为常规无衬线（去极客结构）。D2/D3 方向遗留字体变量无消费者，禁引入。

## 5. 变更流程

token 修改 = 设计真相变更：走 decision-log 新决议或步骤 13 差异轮；禁止实现期顺手改值。

# 页面模式（Patterns）

> 跨页面的组合方式。所有模式都以 `OutrunShell` 为外层，页面只负责 `main` 内部内容。

## 1. 两种壳

| 壳 | 触发 | 结构 | 密度 | 模式（impeccable） |
|---|---|---|---|---|
| 营销壳 | `current="home"` | `.marketing-header`（字标 + `.marketing-nav` 三入口 ≥1024 + 状态簇/语言/钱包）→ `main.marketing-main.ax-hud-inner` | 可放宽到 T3（56px） | Persuade |
| 产品壳 | 其它 | `.product-sidebar` + `.product-canvas`（`.product-topbar` + `main.product-main`）+ `.mobile-navigation` | T2 默认 44px；/pol、/portfolio 可收 T1 | Operate |

## 2. 产品页标准骨架

```
<main.product-main>
  .page-intro                  h1 + 一句说明（≤66ch）+ 可选 aside 行动
  [阶段/视图导航]              .lifecycle-tabs 或 .stage-tabs（一页只用一种）
  [工具条]                     .discovery-tools：搜索 + 筛选 + 清除
  <section aria-labelledby>    SectionHeading + 内容（表格 / 卡片网格 / 面板）
  <section>…                   每个 section 一个 SectionHeading
  [空态 / 加载态 / 错误态]     见 §5
</main>
```

规则：
- 一页一个 `h1`（在 `.page-intro`），section 用 `h2`（SectionHeading），卡内用 `h3`。
- 一屏一个黄主 CTA；工具条中的按钮是 `outline`。
- 环境层（网格、扫描线、回声轨）已由壳提供，页面禁止再叠纹理或渐变背景。

## 3. 已落地的页面组合

### 3.1 Explore（`components/discovery/discovery-page.tsx` + `discovery-browser.tsx`）

`.discovery-intro` → `.lifecycle-tabs`（All + 四阶段，带计数）→ `.discovery-tools`（搜索 / 链筛选 ToggleGroup / 清除）→ `.discovery-results`（header 计数 + `.economy-grid` 卡片）→ 无结果 `.empty-state`。
- 阶段过滤是 URL 状态（`?stage=`、`?chain=`、`?q=`），tab 是 `<a aria-current>`，可分享、可后退。
- `aria-busy` 挂在 `.discovery-browser` 根，过渡期内不用骨架替换整页。

### 3.2 Verse 详情（`verse-page.tsx` + `verse-lifecycle.tsx` + `participation-panel.tsx`）

`.verse-hero`（身份 + StageBadge + 计时）→ `.stage-tabs` → `.verse-workbench`（`.workbench-primary` 表单/面板 + `.workbench-secondary` 门槛/时间线）。
- 双门槛用两个 `ProgressMeter`，禁合并进度条。
- 参与表单遵循 component-contract §1 AmountInput 与 §7 TransactionReview。

### 3.3 首页（`home-page.tsx` + `mechanism-primer.tsx`）

`.home-hero`（display 标题黄字重音 + 主 CTA）→ `.home-engine`/`.home-mechanism`（三引擎图解）→ `.home-final-cta`。
- 营销页允许更大留白与 T3，但禁：居中三卡片模板、渐变 hero、图标 emoji。

## 4. 布局原语

| 需求 | 做法 |
|---|---|
| 主 + 侧栏 | Grid `grid-template-columns: minmax(0,1fr) <侧栏宽>`；≤68rem 退单列（参考 `.discovery-layout`） |
| 卡片网格 | `.economy-grid` 式 `repeat(auto-fill, minmax(<min>, 1fr))`，54rem/30rem 减列 |
| 工具条 | Flex + `gap: var(--space-3)`，`flex-wrap: wrap`；移动端改抽屉（`data-open`） |
| KPI 带 | Grid 4 列，切角 `--chamfer-card`，青 inset 顶光；≤30rem 2×2 |
| 表格 | `.verse-table-wrap` 容器，`overflow-x: auto`，≤30rem 冻结首列 |
| 内容宽度 | 正文 `max-inline-size: 66ch`；数字表格不设 ch 限制 |

## 5. 四态区（每个数据区块都要有）

| 态 | 表现 | 禁忌 |
|---|---|---|
| loading | 保留表头/标题，行用 Skeleton；根 `aria-busy` | 整页 spinner、闪动整块 |
| empty | `.empty-state`：品红描边小方块 + 标题 + 一句引导 + 一个主行动 | 空白、仅一行灰字 |
| error | 区块顶部 Alert（danger 描边）+ 人话原因 + 恢复动作（重试/调整） | 堆栈腔、无恢复动作 |
| stale | 表头旁 warning 徽章 `Syncing · 2m behind`，数据以 RPC 为准提示 | 静默显示旧数据 |

交易流状态映射见 `components/design-system/state-matrix.md §3`。

## 6. 响应式检查表

- 三档断点（68rem / 54rem / 30rem）各截图一次；390px 宽为移动基线。
- 侧栏消失后主导航在 `.mobile-navigation`，页面不得依赖侧栏存在。
- 触控命中 ≥40px（`--control-height`）；行内链接命中区用 `min-block-size`。
- 中文与英文分别测溢出：`copy.ts` 两语言长度差异大，标签容器要 `min-inline-size: 0` + `truncate` 或允许换行。

## 7. 新页面自检

1. 用了 `OutrunShell`？导航 `navItems` 与 `copy.common` 都加了？
2. `.page-intro` 只有一个 h1？
3. 全部数字 `data-numeric`？
4. 一屏一个黄 CTA？青只在链接/focus/信号？品红只 1–2px？
5. 四态都有？
6. 三档断点截图？中英各一次？
7. 没有裸色、裸 px、`transition: all`、自定义 focus？

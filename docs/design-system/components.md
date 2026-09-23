# 组件索引（Components）

> 先查这里，再决定"复用 / 组合 / 新建"。领域组件（AmountInput、AssetSelector、TransactionReview 等）的**行为契约**在 `components/design-system/component-contract.md`，本页登记的是**已落地的公开实现**与页面级 class。
> 项目 shadcn 配置：`base` 原语（非 radix）、Tailwind v4、图标 `lucide-react`、别名 `@/`。因此自定义触发器用 `render` 而非 `asChild`，菜单项回调用 `onClick`。

## 1. 决策树

1. 是不是数字、地址、时间？→ 直接用格式化函数 + `data-numeric`（§4）。
2. 有没有 shadcn 基础件？→ `components/ui/`（§2）；缺的用 `pnpm dlx shadcn@latest add <name>`，加完检查是否吃到 `@theme` 桥接的语义色。
3. 是系统原子（徽章、区块标题、进度、分隔记号）？→ `components/prototype/signal-ui.tsx`（§3）。
4. 是页面骨架？→ `OutrunShell`（§5）。
5. 是已有页面级模式（生命周期导航、经济体卡、空态、表格）？→ 复用 `globals.css` 中的 class（§6）。
6. 以上都没有 → 新建，并按 README §5 登记。

## 2. 基础件 `components/ui/`

| 组件 | 导入 | 关键 API | 系统约定 |
|---|---|---|---|
| Button | `@/components/ui/button` | `variant: default/outline/secondary/ghost/destructive/link`；`size: xs/sm/default/lg/icon*` | `default` = 黄主 CTA，一屏一个；次行动用 `outline`/`secondary`；图标用 `data-icon="inline-start|inline-end"`，不加尺寸类；加载态 = `disabled` + Spinner，无 `isLoading` |
| Input | `@/components/ui/input` | 原生 input 属性 | 数字输入加 `data-numeric inputMode="decimal"`；错误加 `aria-invalid` |
| Label / Field | `@/components/ui/label`、`@/components/ui/field` | `FieldGroup` `Field` `FieldLabel` `FieldDescription` `FieldError` `FieldSet` `FieldLegend` | 表单布局只用 `FieldGroup + Field`，禁 `div + space-y`；校验：`Field[data-invalid]` + 控件 `aria-invalid` |
| Select | `@/components/ui/select` | `Select` `SelectTrigger` `SelectContent` `SelectGroup` `SelectItem` | `SelectItem` 必须在 `SelectGroup` 内 |
| ToggleGroup / Toggle | `@/components/ui/toggle-group` | `type="single|multiple"` | 2–7 个互斥选项（链筛选、视图切换）；不要循环 Button 自管激活态 |
| Popover | `@/components/ui/popover` | `Popover` `PopoverTrigger`（支持 `render`）`PopoverContent`（Positioner 锚定） | 锚定小弹层；Esc/外点关闭、焦点回触发器内置；内容不得为表单密集区（Menu typeahead 干扰，表单场景用 Dialog） |
| Dialog | `@/components/ui/dialog` | `Dialog` `DialogTrigger`（支持 `render`）`DialogContent`（遮罩+居中卡） | 遮罩 `bg-black/60` + 居中 `max-w-sm` 卡；Esc/外点关闭、focus trap、焦点回触发器内置；表单设置类弹层（如 Swap 滑点/截止）用此形态（2026-09-23 用户裁定，demo 参照） |
| Slider | `@/components/ui/slider` | `value/onValueChange/min/max/step` | 杠杆倍数等；旁边必须有 `data-numeric` 文本读数 |
| Switch | `@/components/ui/switch`（base-ui Switch 内联） | `checked/onCheckedChange` | 二态切换；皮肤走全局 `[data-slot='switch']`（方轨方钮，checked=青轨道，青=功能信号）；创建页 Fast Genesis 首用 |
| Separator | `@/components/ui/separator` | `orientation` | 替代 `<hr>` 与 `border-t` div |
| DropdownMenu | `@/components/ui/dropdown-menu` | `DropdownMenu` `DropdownMenuTrigger` `DropdownMenuContent` `DropdownMenuItem` `DropdownMenuLinkItem`（base-ui Menu 封装；`LinkItem` 的 `render` 挂 `<Link>` 做导航项） | 视觉走消费方 class（如 `.locale-menu__*`）；键盘/Esc/焦点管理由原语负责 |
| Tooltip | `@/components/ui/tooltip` | `Tooltip` `TooltipTrigger` `TooltipContent`（base-ui Tooltip 封装；`Trigger` 可 `render` 成非按钮元素） | 悬停气泡；皮肤挂全局 `[data-slot='tooltip-content']`（抬升面 + `--chamfer` 切角）；键盘 focus 同样触发；禁放关键操作指令 |

尚未安装但系统允许直接添加（会自动吃到主题）：`badge`、`dialog`、`sheet`、`popover`、`table`、`tabs`、`skeleton`、`spinner`、`empty`、`alert`、`sonner`、`command`、`scroll-area`。添加后如需品牌形态（切角、青描边）用 `className` 挂系统 class，不改组件内部颜色。

## 3. 系统原子 `components/prototype/signal-ui.tsx`

| 导出 | 签名 | 用途 | 规则 |
|---|---|---|---|
| `StageBadge` | `{ stage: VerseStage; locale }` | 阶段徽章，`.stage-badge[data-stage]` 切角 + 色点 | 阶段色由 data-stage 决定，不传颜色；genesis 变体=不透明黄描边 + 黄 tinted 底（`color-mix` 低 alpha；描边不用 60% alpha token——半像素渲染下会拆行发花），locked/unlocked/refund 维持 inset 底 + 默认描边 |
| `FastBadge` | `{ label }` | Fast Genesis 徽章，`.fast-badge` 切角 + 青色点 | 青=功能信号；仅创世期且链上 fastGenesis 标记为真时展示，不作阶段色 |
| `SectionHeading` | `{ title; description?; aside? }` | 区块标题（h2）+ `.ax-echo-bar` 青线与品红回声 | 每个 `section` 一个；`aside` 放筛选/计数 |
| `ProgressMeter` | `{ label; value(%); amount; threshold; locale }` | 单门槛进度条，含 `role="progressbar"` 与文本并行 | 双门槛必须两条独立 meter，禁合并 |
| `SlashMark` | — | 斜杠分隔记号（`aria-hidden`） | 仅装饰 |
| `formatAmount(value, locale, compact?)` | → string | 金额，<1 保留 6 位，否则 2 位 | 输出放 `data-numeric` 容器 |
| `formatPercent(value, locale)` | → string | 百分比 1 位小数 | 同上，自己拼 `%` |
| `formatDate(iso, locale)` | → string | 中等日期 + 短时间，UTC | 同上 |
| `formatDuration(from, to, locale)` | → string | `2d 4h` / `2 天 4 小时` | 倒计时 <72h 用 warning 色 |

`SourceRef` 与 `LayoutNotes` 返回 `null`，是内部审阅占位，不在产品界面使用。

## 4. 数字与数据显示规则

- 容器加 `data-numeric`（或 `.num`）：自动等宽 + tabular-nums。
- 表格数字列右对齐；地址截断 `0x1234…abcd` + `title` 全值 + 复制按钮。
- 涨跌：`--color-success` / `--color-danger`，并带符号文本（不只靠颜色）。
- 零 glow、零渐变、零斜体。

## 5. 页面骨架 `components/prototype/app-shell.tsx`

```tsx
import { OutrunShell } from '@/components/prototype/app-shell'

<OutrunShell locale={locale} current="discover" accountAddress={addr} accountSourceRef={ref}>
  {children}
</OutrunShell>
```

- `current="home"` → 营销壳（`.marketing-header` + `.marketing-main`）；其它 → 产品壳（`.product-shell`：侧栏 `.product-sidebar.ax-echo-rail` + `.product-canvas.ax-hud-inner` + 顶栏 `.product-topbar` + 底部 `.mobile-navigation`）。
- 壳已包含：skip link、`lang` 属性、`data-glow="on"`、HUD 网格、扫描线、状态簇（live 点 + 网络）、语言切换、钱包控件。页面内**不要**再放这些。
- 新路由加入导航：编辑 `navItems`（`key/href/icon/available`）并在 `copy.ts` 的 `common` 加标签；`available:false` 会渲染禁用项并 `title` 提示。

## 6. 页面级模式 class（`app/globals.css`）

| 模式 | 根 class | 结�� | 状态 | 用于 |
|---|---|---|---|---|
| 页面引言 | `.page-intro` | `h1` + `p`（≤66ch），底部黄 2px + 品红 1px 回声 | — | 每个产品页顶部一次 |
| 阶段 tab | `.stage-tabs` | `a[data-active]` × N，56px 高，激活 = 顶部黄线 + 黄字 + 黄 inset | `data-active` | 单页内阶段切换（Verse 详情） |
| 生命周期导航 | `.lifecycle-tabs` | `nav > a[data-stage][data-active]` × 3，`__mark` 色点 / `strong` 阶段名 | `data-stage`、`data-active`、`aria-current="page"` | Explore 页市场阶段过滤（Genesis/Locked/Unlocked；Refund 是结算态移交 Portfolio，仅搜索可达） |
| Portfolio 退款区块 | `.portfolio-refunds` | `h2` + `__sub` + `__list > __row`（`__identity` 标题链接 + StageBadge → `__facts` 参与金额/创世截止 → 主 CTA） | 零可领取项不渲染整块 | Portfolio 页：我参与过且已进入退款的组合 |
| Refund 结算面板 | `.refund-settle` | `h2` + `__participations`（普通/杠杆/预购金额 + `__total` 合计，黄字）+ 一键领取主 CTA（原型 disabled）；无参与记录仅 `__empty` | 仅 `stage=refund` 渲染，替代工作台/资金池/时间线 | Verse 详情页退款态（大幅精简后的唯一行动面） |
| Verse 链署名行 | `.verse-identity__chains`（+ `__chain` 触发器） | hero meta 内：「治理链」文字 + 图标、`Spoke 链` 文字 + 图标组（口径与 Explore 卡一致 = 治理链外的主网链）；两类链统一为仅图标，悬停气泡显链名 | 链图标 16px；悬停 `[data-slot='tooltip-content']` 气泡 | Verse 详情页 hero |
| Verse hero 主标题 | `.verse-identity h1` | 页面主标题品红错位回声（`text-shadow: 0.06em`，与 `.empty-state h1` 同一「背板错位」文字级语言） | 品红仅限 ≥20px 大字（h1 为 `--display-title` 档）；不加 glow | Verse 详情页 hero |
| 发现工具条 | `.discovery-tools` | `.discovery-search`（`InputGroup` 语义：输入 + Button）+ `.mobile-filter-toggle[aria-expanded][aria-controls]` + `.discovery-filters[data-open]`（链/排序 Select + `.discovery-order-toggle` 升降序方钮） | `data-open` | 搜索 + 链筛选 + 排序方向切换 + 清除 |
| 结果区 | `.discovery-results` | `.economy-grid` 直接跟随工具条；≥80rem 三列（卡内 `zoom: 0.8` 整卡等比缩放），54–80rem 两列，≤54rem 单列 | `aria-busy` 于根 | 列表页结果 |
| 无限滚动 | `.economy-grid-sentinel` 哨兵 + `.back-to-top` 回顶悬浮钮 | IntersectionObserver 每批 6 张（3 列 × 2 行）；回顶钮青色功能信号（40px 方形切角，hover 抬升 + 青底加深），滚动 >480px 出现，reduced-motion 时跳转不带平滑 | 哨兵触底前 320px 预加载 | 结果 ≥ 一批时挂哨兵 |
| 经济体卡 | `.economy-card[data-stage]` | 三行 grid：`__header`（通栏：Symbol 加粗 + Name 标题链接 + StageBadge）→ `__media`（方形封面链接，左栏垂直居中）+ `__body`（`__chains` Omnichain 图标行 + `__signal` 创世为 `__thresholds` 普通杠杆 OR 组、锁定与已解锁共用 Staking APY/Volume (24h)/参与人数三行 `__thresholds` 读数（复用 `__item` 行、无轨道；参与人数=fixture `participants` 参与地址数快照，2026-09-23 用户裁定卡片不展示描述、两阶段卡内容一致，已解锁原实时价格口径废弃）、退款为退款路径资金；预购容量为独立 `.economy-meter`）→ `__facts` 通栏 footer（大写小标签 + 等宽数值；锁定/已解锁=国库资金+解锁时间，其余=累计募集+创世截止） | `data-stage` 驱动 `--stage-color`；hover 提升一档；整卡点击跳转（守卫：拖选文字/内部链接与按钮除外），封面与标题为真实链接可中键新开；链图标带 `[data-slot='tooltip-content']` 悬停气泡 | Explore 卡片；每卡最多一个信号区突出 |
| 空态 | `.empty-state` | `h3/p` + 主行动，块内水平垂直居中、文字居中 | — | 零结果/零仓位；加载中不显示 |
| 数据表 | `.verse-table-wrap > table.verse-table` | 44px 行，数字列右对齐，`tbody tr:hover/focus-within` 提升表面 + 青选择线 | `aria-sort` 于排序表头 | 仓位/池列表；≤30rem 横滚冻结首列 |
| 状态簇 | `.status-cluster` | `__live`（`.ax-signal-dot` + 文本）+ `__network` | — | 顶栏；页面内用 `__count` 复用同样式 |
| 顶栏签名线 | `.product-topbar::before/::after` + `.marketing-header::before/::after`（决议 014 + 补充） | 双壳统一：青信号贴底边框、右端锚定 padding 缘（=钱包按钮右缘）向左渐变消隐；品红回声下移 1px 扫描线 + 左移 32px 滞后、更短更暗 | 连接态点亮：`:has(.wallet-control[aria-pressed='true'])` → 青线 256px 全亮 + 回声；待机 64px 暗轨无回声 | 凡顶栏有钱包控件即有此线；≤30rem 点火长度减半、锚点随壳内边距（产品壳 54rem、营销壳 30rem 缩至 space-3） |
| 状态点 | `.status-dot(--success)` | 6px 圆点 | 修饰类 | 侧栏账户态 |
| 数字输入 | `.numeric-input` | Input + `data-numeric` | `aria-invalid` | 金额输入（见 component-contract §1） |
| 表单警示 | `.form-warning` | 文本 + 恢复动作链接 | — | 超额、dust、报价过期 |
| 信号面板 | `.action-panel` / `.threshold-panel` / `.stats-panel` | 冷石墨表面 + 青 tinted 描边 + 单斜切 | — | 工作台面板；只在可交互或关键状态提升信号强度 |
| 关键数据卡 | `.stats-panel` + `.verse-stats`（2×2 网格） | verse 头部统计迁入（创世截止/参与地址/预计市值/您的参与） | 仅 verse 详情页右列；数字 `data-numeric` | 见 component-contract §13 Verse 头部行 |
| 行动卡图标 | `.action-panel__head` + `.action-panel__icon[data-stage]` | 头部横排（图标+标题同行，gap space-3）；40px 描边框内阶段语义图形（genesis=双箭头快进/locked=锁/unlocked=盾/refund=退回） | 框与图形随阶段色（同 stage-badge token：黄/品红/青/橙；2026-09-22 用户裁定多轮：原常青 git 节点→沙漏→里程碑→双箭头 `ChevronsRight`（用户选定，下一步行动/现在就动），缩至 40px） | verse 详情页行动卡（component-contract §15） |
| 错版字效 | `.ax-glitch-text` | 抖音式 glitch：白主字形+青左上/品红右下双向 text-shadow（0.06em 随字号缩放）+数据等宽字体+semibold+大写+0.08em 字距；字号不入类 | 双类选择器抬优先级（压 `.page-intro h1` 等）；应用=verse ticker/Explore 卡 symbol/create 标题（用户裁定 2026-09-22） | 全站品牌强调字 |
| 卡片徽章组 | `.economy-card__badges` | 卡头右侧徽章容器（FastBadge + StageBadge） | `inline-flex` + `gap`，不放操作控件 |
| 卡头市值快照 | `.economy-card__cap` | Explore 卡头中段（名称与徽章之间）**单行**块：小标签（marketCap 文案）+ `formatMarketCap` 数值（`$` 前缀美元口径 + B/M/K 固定两位小数，用户裁定 2026-09-23：单行、美元展示、不随 locale 换算亿/万；样本数值=fixture `projectedMarketCap` 快照，生产以链上价×供应量计算为准）；null 不渲染 | 整块 `nowrap` + `flex-shrink: 0`，数值 `data-numeric`；全部阶段卡片渲染 |
| Fast Genesis 状态行 | `.threshold-panel__fast[data-reached]` | 成功判定卡内 Fast Genesis 说明；达标后 `data-reached='true'` 转青 | 仅 fastGenesis 创世 verse 渲染；达标态复用「待推进」口径 |
| 创建页工作台 | `.create-layout` + `.create-form/.create-row(--logo,--2,--3)/.create-logo(__box,__actions)/.create-fast(-row)/.create-info/.create-label-row/.create-counter/.create-links/.create-suffix/.create-disclosure(__trigger,__label)/.create-quote(__row,__row--total)/.create-term(__head,__note)` | 双栏不对称 grid（与 `.verse-workbench` 共规则，68rem 退单列）；表单布局逐行对齐老版 demo：Flash Genesis 紧凑开关首项（`.create-fast` fit-content，压过 Field `*:w-full`）→ logo 靶位/名称/Symbol 三列 → 创世时长独立行（+「天」后缀，唯一可见 hint）→ 资金类型/治理链/Omnichains 三下拉（`Select multiple`，治理链必含不可取消，空值显「Select Chains」placeholder）→ 描述（字节计数）→ Community 折叠行；字段说明一律收进标签旁 ⊙ `.create-info` 悬浮提示（base-ui Tooltip，span render），不在版面占位；品牌 SVG 须 CSS 约束尺寸；报价行 44px dl；锁定期固定值展示（合约常量，无输入） | `/memeverse/launch`（R-04，原 /launch、更早 /memeverse/create） |
| 交易台持久区 | `.verse-desk`（≥1024px 双栏 1.9:1.1，图左 Swap 右；以下退单列） | `.verse-desk__main` = `.trade-chart` **统计条+K线单卡**（2026-09-23 用户裁定合并；顶缘 1px 青 inset 光：卡内 `.token-strip`（`__price[data-trend]` 涨跌色 + **有效位分层**：`__price-sign` 货币符/`__price-tail` 尾随零 0.62em 次级色、有效位 28px semibold（2026-09-23 用户裁定）+ `__chips` MC/Liq/Vol/Pop/TS 胶囊（美元前缀，KPI 芯片语言：对角双切+顶缘青光）+ `__ca`/`__copy`（CA 复制胶囊 8px 单切，青字））→ `.candle-chart`（`__bar` 右对齐粒度钮（学币安，1m–1w 全档可选，细粒度走 `candlesFine` 原生/粗粒度从 1h 聚合 96 根；无数据粒度 disabled 标「同步中」，B3）+ `__svg` 蜡烛（`.candle--up/--down` success/danger）+ 右缘 `__axis` 高/中/低价刻度））；`.verse-desk__side` = `.swap-panel`（`__head` 展示字标题+幽灵齿轮 `__settings-toggle` → **锚定下拉** `.swap-settings`（Popover Positioner 对齐触发器右下，288px 定宽，`__row/__options[data-selected]/__custom` 滑点 0.1/0.5/1.0% 与截止 10/20/30min 预设+自定义带单位后缀；2026-09-23 用户裁定：下拉弹层，非居中弹窗））；`__field/__flip/__details`（费率/价格影响/最低到账/最大滑点（实时值）/路径；未输金额时整块隐藏，无占位文案）+`__cta`） | `data-trend`/`data-selected`/`aria-expanded`；仅 locked/unlocked 渲染 | Verse 详情页（头卡下方、标签区上方，全标签共享） |
| 四标签容器 | `.verse-tabs` + `__bar`（ToggleGroup tab 风：透明底、激活=黄字+底 2px 黄线）+ `__panel[data-tab]` | 四面板 RSC children 由 `VerseTabs` 客户端切换显隐；面板根：`.liquidity-panel`（`__overview` + `__pools > .pool-card[data-pool]`）、`.pol-panel`（`__stats`（市场价/名义价值并排）+ `__wallet` + `__actions > .pol-action` 阶段门控操作卡）、`.vault-panel`（`__stats` + `__grid`（左 `.vault-actions`（`__bar` 三段 + `__field/__delegate-option[data-selected]/__preview`）右 `__lists`（待赎回/可提取 `li[data-state]`）+ `__cross`）、`.dao-panel`（`__head`（`__stats` + `__tally` 外链卡）+ `__cycles > .cycle-card[data-current]`）；通用 `.panel-note`（辅助说明）与 `.ax-slot`（青色「以链上读值为准」槽位文本）。**2026-09-23 赛博卡片皮肤两轮**（$impeccable 复审）：①面板标题 `.panel-title.ax-echo-bar`（Saira Condensed 22px 大写+底部青信号签名线/品红回声）、次级 `.panel-subtitle`；②四面板 `__overview/__stats > div` 统一 **KPI 芯片**语言（≥108px、`--chamfer-card` 12px 对角双切、青 tinted 描边+顶缘 1px 青 inset 光、dt 11px 大写次级、dd mono 15px）；③**桌面级卡签名表面**（`.trade-chart`/`.swap-panel`/`.verse-tabs` 三卡共用 `::before` 信号带：青 45° 斜线网 rgba(0,240,255,.1) 10px + 左上品红洗 rgba(255,6,181,.16) 46% 渐隐，128px 高向下 mask 渐隐、数据区零纹理；`::after` 左上 2px 青 L 角标；顶缘青 inset 0.32 / 底缘品红回声 inset 0.28；clip-path 建层叠上下文故 `z-index:-1` 落于内容之下）；`.pool-card` hover 青描边+抬升底+展示字交易对+三列 hairline 分隔数据；`__lists li` hover 内嵌 2px 青选择线+大写状态徽章；`.cycle-card` 30px 行高 hairline 分隔 dl、`[data-current]` 青描边+顶缘光 | `data-tab`/`data-pool`/`data-selected`/`data-state(ready|waiting)`/`data-current` | Verse 详情页 locked/unlocked（替代旧成功判定/当前可以做什么/指标卡三块，Q1 裁定） |
| 四标签容器 | `.verse-tabs` + `__bar`（ToggleGroup tab 风：透明底、激活=黄字+底 2px 黄线）+ `__panel[data-tab]` | 四面板 RSC children 由 `VerseTabs` 客户端切换显隐；面板根：`.liquidity-panel`（`__overview` + `__pools > .pool-card[data-pool]`）、`.pol-panel`（`__stats`（市场价/名义价值并排）+ `__wallet` + `__actions > .pol-action` 阶段门控操作卡）、`.vault-panel`（`__stats` + `__grid`（左 `.vault-actions`（`__bar` 三段 + `__field/__delegate-option[data-selected]/__preview`）右 `__lists`（待赎回/可提取 `li[data-state]`）+ `__cross`）、`.dao-panel`（`__head`（`__stats` + `__tally` 外链卡）+ `__cycles > .cycle-card[data-current]`）；通用 `.panel-note`（辅助说明）与 `.ax-slot`（青色「以链上读值为准」槽位文本） | `data-tab`/`data-pool`/`data-selected`/`data-state(ready|waiting)`/`data-current` | Verse 详情页 locked/unlocked（替代旧成功判定/当前可以做什么/指标卡三块，Q1 裁定） |

命名规范：`block__element`，状态用 `data-*` 属性，不做修饰类堆叠。示例：`.status-dot` 的语义色通过 `data-tone="success | warning | danger | neutral"` 表达，映射在 `globals.css` 中集中维护。

活体契约：`/{locale}/design-system`（`components/design-system/showcase.tsx`）逐区块渲染色彩角色、字体角色、Button 变体、StageBadge / status-dot、ProgressMeter、Field + Input、空态。只允许使用系统 token 与已登记组件，改动全局样式后先看这一页有无回归；该路由 `noindex`。

## 7. 组件间通用契约（摘自 component-contract 附录）

- 弹层：Esc 关闭、focus trap、关闭后焦点回触发器（shadcn Dialog/Sheet/Popover 已内置）。
- 异步：进行中可取消或明确不可取消；完成后 toast + 内联状态双通道。
- 复制：`navigator.clipboard` + toast「Copied」+ 失败回退选中。
- 图标按钮必须有 `aria-label`；装饰图标 `aria-hidden`。
- 状态集：default / hover / focus / active / disabled / loading / error / empty，按适用子集实现，并在 state-matrix.md 对齐。

## 8. 常见错误

| 错误 | 正确 |
|---|---|
| `className="bg-[#FCEE0A]"` | `bg-primary` 或 `var(--accent-primary)` |
| 卡片同时 `rounded-xl` + `clip-path` | 切角容器圆角 0 |
| 数字用 `font-mono` 但没 `tabular-nums` | 用 `data-numeric` |
| 自写 `outline: 2px solid yellow` focus | 删除，用全局青环 |
| `transition: all` | 列举属性 |
| 阶段颜色写在组件 props | 用 `data-stage` 走 CSS 映射 |
| 一屏两个黄按钮 | 次行动改 `outline`/`secondary` |
| 品红做按钮底 | 品红只做 1–2px 内衬或徽章 |
| `space-y-4` | `flex flex-col gap-4` |
| 手写空态 div | `.empty-state` 或 shadcn `Empty` |

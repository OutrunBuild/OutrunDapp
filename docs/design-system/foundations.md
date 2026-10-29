# 基础（Foundations）

> 所有值来源于 `components/design-system/tokens.css`；这里只解释角色与用法，不另定义值。对比度为 `DESIGN.md §2` 实测（on `--color-surface`）。

## 1. 色彩

### 1.1 角色表

| 角色 | Token | Tailwind 语义类 | 用法 | 禁忌 |
|---|---|---|---|---|
| 页面底 | `--color-bg` `#0A0A10` | `bg-background` | 站点底、HUD 网格底色 | 不做卡片底 |
| 表面 | `--color-surface` `#12141B` | `bg-card` | 面板、表格、卡片默认底 | — |
| 抬升表面 | `--color-surface-raised` `#171A23` | `bg-secondary` / `bg-popover` | 弹层、hover 提升一档、激活 tab | 不叠两档以上 |
| 内嵌表面 | `--color-surface-inset` `#0D0F15` | `bg-muted` | 代码/地址块、tab 轨道、徽章底 | — |
| 正文 | `--color-text` `#E6E9F0` 15.14:1 | `text-foreground` | 标题、正文、表格主列 | — |
| 次级 | `--color-text-secondary` `#9AA3B5` 7.25:1 | `text-muted-foreground` | 说明、标签、表头 | — |
| 三级 | `--color-text-tertiary` `#8791A4` 5.80:1 | — | 占位、辅助计数 | 不做正文 |
| 主行动 | `--accent-primary` `#FCEE0A` | `bg-primary text-primary-foreground` | 主 CTA、导航激活、tab 顶线、关键读数 | 一屏一个主 CTA |
| 功能/链接 | `--accent-link` = `--or-cyan` `#00F0FF` | `text-ring` / `ring-ring` | 链接、focus、live 点、选择线、tinted 描边 | 禁大面积、禁做按钮填充 |
| 回声 | `--accent-echo` `#FF06B5` | — | 1px 错位线、CTA 内衬、徽章、≥20px 大字 | 禁正文、禁填充 |
| 成功 | `--color-success` `#35E08E` | — | 涨、确认 | 不替代黄 |
| 危险 | `--color-danger` `#FF5468` | `text-destructive` | 跌、错误、Reverted | — |
| 预警 | `--color-warning` `#F4B74A` | — | 同步延迟、倒计时 <72h、Refund 阶段 | — |
| 边框 | `--color-border` / `--color-border-strong` | `border-border` / `border-input` | 默认 1px / hover 与激活 | — |
| 信号描边 | `--color-border-signal(-strong)` | — | Signal panel 青 tinted 描边 | 只在可交互/关键面板 |
| 黄描边 | `--color-border-accent` | — | Genesis 徽章、强调条 | — |
| disabled | `--color-disabled-bg` / `--color-disabled-border` | `bg-accent` | 禁用控件底/描边 | — |

### 1.2 阶段色（VerseStage）

`data-stage` / `--stage-color` 驱动，四阶段固定映射，任何组件不得改：

| 阶段 | 色 |
|---|---|
| genesis | `--accent-primary` 黄 |
| locked | `--accent-echo` 品红 |
| unlocked | `--or-cyan` 青 |
| refund | `--color-warning` 橙 |

已实现载体：`.stage-badge[data-stage]`、`.lifecycle-tabs a[data-stage]`、`.economy-card[data-stage]`、`.verse-lifecycle__step--{genesis,locked,unlocked}`（首页生命周期段前三步，`--stage-color` 传递；第四步 Normal Operation 非 VerseStage，用 `--color-success` 表示保护期结束后稳态）。

### 1.3 三色分工口诀

黄 = 行动，青 = 功能，品红 = 回声。同一控件最多两色且品红只能是 1–2px。

## 2. 字体

| 角色 | 变量 | 字体 | 用途 |
|---|---|---|---|
| display | `--font-display` | Saira Condensed 600/700 | 页面 h1、hero 主题行与引导行、空态大标题（笨重标题整改：面板/弹窗/卡头/区头/页脚宣言标题降档 body，hero 引导行恢复 display）；`font-size: var(--display-title)`（clamp 30–44px），`letter-spacing: var(--display-tracking)` |
| body | `--font-body` = `font-sans` | IBM Plex Sans 400/500/600/700 | 正文、导航、按钮、表头、面板/区头/弹窗标题 |
| data | `--font-data` = `font-mono` | IBM Plex Mono + `tabular-nums` | 仅数字/地址/hash/时间戳，通过 `data-numeric` 或 `.num` |
| 中文 | `--font-noto-sc`→家族名 `'Noto Sans SC'` | Noto Sans SC 子集变体（100–900 单文件） | 作为三者的回退链；供给源=自托管子集（决议 029 补充 2，`scripts/build-cjk-font.mjs` 产物 public/fonts/noto-sc-subset.*.woff2，`font-preload.tsx` 内联 @font-face+zh 路由预载，覆盖对账 `pnpm check:cjk-font`——**文案变更后必须 `pnpm build:cjk-font`**，新字不重切会退系统字体）；字重全档由变体轴覆盖（原「须含 600」约束随之消解）；900 零消费不预载（决议 028） |

加载链路：拉丁三家族 `next/font` 在 `components/design-system/fonts.ts` 声明（`--font-d1-display` Saira Condensed、`--font-d1-body` IBM Plex Sans、`--font-plex-mono`），`app/layout.tsx` 挂到 `<html>`；中文不进 next/font（决议 029 补充 2：452 分片不可预载是刷新闪变主源，改为自托管子集变体，见 §2 表中文行）；`tokens.css` 组合成 `--font-display/--font-body/--font-data`。**不要在别处再次声明这些字体**。装载策略：拉丁 `display: 'swap'` 为基线、display 值历属裁定敏感区（`optional` 消闪实验已被实见否决——开发态/绕缓存刷新下整页锁死后备字体，已回撤，勿再自作主张改值「消闪」）；中文子集 @font-face=`fallback`（决议 029 补充 3：100ms 阻塞期收冷首访竞态，4G 冷访先隐 ≤0.1s 再后备再换装）。刷新闪变两段根治（决议 029 及补充）：拉丁=Next 对动态路由段不下发 preload（差分实证，16.4.0 未修）→ `font-preload.tsx` 读 next-font-manifest 补发；中文=子集变体单文件 + zh 路由预载（public/fonts/ 走 immutable 头，proxy matcher 已排除 fonts/）。

字阶（013 上调后真值）：`--text-xs 12` / `--text-sm 14` / `--text-base 16`（基准） / `--text-md 18` / `--text-lg 20` / `--text-xl 28` / `--text-num-lg 22`（KPI 读数；组合页头净值 hero 读数用 `--text-xl`）。
标签字距：`--label-tracking 0.045em`（大写小标签用）。

规则：等宽字**不得**用于导航、按钮、标题、正文（决议 001-A）。中文正文 ≥14px。

## 3. 间距与密度

- 8px 基线：`--space-1 4` / `-2 8` / `-3 12` / `-4 16` / `-5 24` / `-6 32` / `-7 48` / `-8 64` / `-9 96`（页面级分区组间距，017）。
- 密度：`--row-height 44`（默认 T2）/ `--row-height-compact 36`（仅 /pol、/portfolio 高密度区）/ `--row-height-relaxed 56`（营销、tab 轨道、新手区）。控件高 `--control-height 40`。
- 布局优先级：Flex + `gap` 为主，二维用 Grid；禁 `space-x/y-*`；绝对定位仅装饰伪元素。

## 4. 形状与深度

| 类别 | Token | 用于 |
|---|---|---|
| 圆角 | `--radius-sm 6` / `--radius-md 10` | 非切角的小控件（input、pill） |
| 切角 UI | `--chamfer 8` | 徽章、按钮、导航件（实测 7–8px） |
| 切角面板 | `--chamfer-panel 10` | 表格容器、卡片容器单角 |
| 切角特征 | `--chamfer-card 12` | KPI 带、斜杠记号双角 |
| 线 | `--line-accent 2` / `--line-echo 1` | 黄主信号线 / 品红回声线 |
| 结构阴影 | `--shadow-raised` / `--shadow-header` / `--shadow-dialog` | 深度，纯黑阴影，无彩色 |
| 信号 glow | `--glow-nav-active` / `--glow-cta` / `--glow-card-cyan` / `--glow-echo-rail` | 只经 `.ax-glow-*` + `[data-glow=on]` 使用 |

切角写法示例（来自 `.stage-badge`）：

```css
clip-path: polygon(0 0, calc(100% - var(--chamfer)) 0, 100% var(--chamfer), 100% 100%, 0 100%);
```

切角容器 `border-radius: 0`。阴影与 glow 分离：结构用阴影，信号用 glow，不叠加在同一元素。

## 5. 环境层（签名装饰，只此一处定义）

| class | 作用 | 挂载位置 |
|---|---|---|
| `.ax-hud` | 44px 青网格底 | 站点根 `.outrun-site` |
| `.ax-hud-inner` | 22px 加密网格 + 品红 135° 角部洗色 | `main` / `.product-canvas` |
| `.ax-scanlines` | CRT 静态扫描线，`pointer-events:none`；body 级 z-overlay（023 补充 10：自壳层末尾提升，弹窗 portal 同膜） | `app/layout.tsx` body 末尾（唯一实例），`aria-hidden` |
| `.ax-echo-rail` | 侧栏右缘品红回声轨 | `.product-sidebar` |
| `.ax-echo-bar` | 标题条几何化回声：青信号贴底边框渐变消隐（`::after`）+ 品红回声下移 1px/左移滞后/长度减半（`::before`，决议 014 统一） | `.section-heading` |
| `.ax-signal-dot` | live 青点 steps(2) 1.4s 脉冲 | 状态簇、结果计数 |
| `.ax-glow-nav` / `.ax-glow-card` | 分层 glow | 导航激活项 / 信号卡 |

规则：环境层低对比、结构层一处一强调、数据层零 glow（011 精修纪律）。新页面直接复用，不新建纹理。

## 6. 动效

- 时长：`--motion-fast 120ms`（hover/颜色）、`--motion-base 200ms`（展开/位移）；缓动 `--ease-out`。
- 签名动效仅两枚：**回声确认**（确认态 120ms 品红错位闪烁）与**信号脉冲**（`.ax-signal-dot`）。其余动效只做状态反馈，不做装饰。
- `prefers-reduced-motion: reduce` 已全局处理：动画归零、过渡只保留 opacity/color/background/border/box-shadow/outline。组件不需要再写降级，但**不得**依赖位移动画传达状态。
- 过渡属性要列举（`transition: color …, background-color …`），禁 `transition: all`。

## 7. 断点与响应式

`app/globals.css` 全局收敛使用 `max-width` 四档（移动优先地收敛桌面布局；`1023px` 是代码既有的 lg 收敛档，与 Tailwind 断点边界对齐，不计入新增档位）：

| 断点 | 像素 | 发生什么 |
|---|---|---|
| `68rem` | ≤1088px | 产品壳收窄；`.discovery-layout` 退单列；筛选栏 `.filter-rail` 转横向；`.lifecycle-tabs`/`.discovery-tools` 压缩 |
| `1023px` | ≤1023px | 营销 header 文字导航隐藏，header 收成品牌 + 右对齐 actions 两列；`.pol-panel__grid`/`.vault-actions` 退单列 |
| `54rem` | ≤864px | 侧栏隐藏 → `.mobile-navigation` 底部 tab；`.mobile-filter-toggle` 出现，`.discovery-filters[data-open]` 抽屉；`.economy-grid` 减列 |
| `30rem` | ≤480px | 品牌切 symbol；表格横滚冻结首列；`.economy-card__facts` 堆叠；中文 h1 缩放 |

另有页面级档位已登记在 components.md 组件索引：`≤640px`（Verse 详情移动端重构）、`≤49rem`（Referral 移动台账）、`≤18.75rem`（极窄档）。

新页面必须在 68rem / 54rem / 30rem 三档各截一张图验证（见 agent-workflow.md）；页面级档位随页面一并验证。新增断点须先在 components.md 登记，再落代码。

## 8. 层级

`--z-base 0` / `--z-raised 10` / `--z-sticky 100`（product-topbar、mobile-navigation）/ `--z-overlay 1000`（扫描线、弹层）/ `--z-toast 1100`。shadcn 弹层自带堆叠，不手写 z-index。

## 9. 品牌资产

`public/brand/`：`BRAND-01-wordmark-*`（≥96px 宽用字标）、`BRAND-04-symbol-*`（<150px 用 symbol）。透明版用于深底，onblack 版用于导出。禁改色、拉伸、裁切、加 glow。交付分辨率用决议 025 衍生变体（`*-480.png` / `*-96.png`），界面消费勿直引母版（`images.unoptimized` 下无 resize）。图标库：`lucide-react`，禁 emoji。

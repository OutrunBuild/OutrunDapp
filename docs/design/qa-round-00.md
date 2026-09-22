# QA Round-00（Stage-01 步骤 12 · 2026-09-17）

> 审查对象：visual-moodboard.html、product-ux-board.html、token-preview.html、component-contract-preview.html、tokens.css 及三份契约。
> 方法：四个指定 Skill 全部执行（证据见 skill-evidence.md）+ 可编程实测（对比度计算、规则 grep、双视口截图 qa-desktop/qa-mobile.png）。
> 结论：**0 P0 / 0 P1**；P2×3、P3×4 全部编号在案并指定后续动作。未关闭 P0/P1 → 不阻断验收门；P2/P3 进入步骤 13 差异轮处理。

## 审查健康分（impeccable audit 五维，静态契约工件口径）

| # | 维度 | 分 | 关键发现 |
|---|---|---|---|
| 1 | Accessibility | 3 | 焦点/live region/键盘契约齐备；预览工件存在 alt/禁用对比缺口（F2/F3） |
| 2 | Performance | 3 | 零依赖静态件、无布局抖动源；字体加载策略属阶段 3（R7） |
| 3 | Responsive | 3 | token 网格 390 适配；PositionTable 预览件在 390 有横向溢出风险（F6） |
| 4 | Theming | 4 | 全 token 驱动、暗色 color-scheme、无裸色（预览件内联演示值均来自 token） |
| 5 | Implementation Integrity | 4 | 无套版漂移模式（校准检查见下）；系统意图连贯 |
| **合计** | | **17/20 Good** | |

## 校准检查（frontend-design：反 AI 套版三默认）

- 非「奶油底+衬线+赤陶」✓；「近黑底+单霓虹」默认的判别：本系统为**三色信号语义**（黄主光/品红回声/青功能各司其职）+ 回声错位签名 + 品红限界规则，非单 accent 极简，判**不落入**默认②；非报版 hairline 默认③ ✓。来源链可溯（VS-002/007/004+BRAND）✓。
- 去极客修订（001-A）进一步拉开与「终端风模板」的距离。

## 发现清单（唯一编号 + 严重度 + 证据 + 后续动作）

| # | 严重度 | 发现 | 证据 | 后续动作 |
|---|---|---|---|---|
| F1 | P2 | disabled 按钮文字对比 4.25:1（`--color-text-tertiary #8791A4` on `#2A2E3D`），低于自定 AA 红线 4.5:1（WCAG 对 disabled 豁免，但我们红线更严） | node 实测（qa 记录） | 步骤 13：disabled 态改 `--color-text-secondary` 或提亮底 `#2E3242` |
| F2 | P2 | `product-ux-board.html` 17 张 `<img>` 全部无 `alt`（证据板非产品 UI，但违反 web-guidelines 图片规则） | grep 17/0 | 步骤 13 补 `alt`（描述=figcaption 摘要） |
| F3 | P2 | 两个预览件 `href="#"` 死链演示（web-guidelines：锚点做导航需真实目标） | grep 1+1 | 步骤 13 改 `<button>` 或加 `role="link"` 说明 |
| F4 | P3 | 预览件无 skip-link、无 `theme-color` meta（guidelines 导航/暗色项）——静态契约件可豁免，产品必须 | grep 0 | 记入阶段 3 页面 brief 必选项 |
| F5 | P3 | `visual-moodboard.html` 11 img 均 `alt=""`（装饰性空 alt 可接受，但 index 页 18/18 有实 alt，两板不一致） | grep | 步骤 13 统一：证据图给描述性 alt |
| F6 | P3 | component-contract-preview 的 PositionTable 卡在 390px 无横滚容器（产品契约已规定横滚+冻结首列，预览件自身未演示） | qa-mobile.png 代码检查 | 步骤 13 预览件加 `overflow-x:auto` 演示 |
| F7 | P3 | 字体加载策略（preload+font-display swap、CDN preconnect）未在契约中成文（guidelines 排版/性能项） | skill 对照 | 并入阶段 3 实现约束清单（skill-evidence R 区） |

## 来源分类复核（阶段验收门关键项）

- 视觉 board 仅含 VS-001~009 + BRAND，全部带 source-id ✓；无产品 UX 站入视觉板 ✓（PU-000~009 仅在 product-ux-board）✓
- 旧版 demo（PU-000）已标「过时产物非真相源」✓；direction-choice/axis-choice 证据链（revision r2/r3）完整 ✓

## web-guidelines 合规快照（本次实测项）

tabular-nums ✓（token+预览全数字列）· `…` 省略号 ✓（错误文案）· aria-live（polite/assertive 分级）✓ · `:focus-visible` 唯一 focus ✓ · reduced-motion 全局降级 ✓ · `color-scheme: dark` ✓ · 按钮/链接语义（产品契约规定，预览件 F3 例外）· hover 态存在 ✓ · 主动语态文案 ✓ · 数字列 `text-align:right` ✓

## vercel-react-best-practices（阶段 3 实现约束，非本轮测试声明）

记录以下规则为阶段 3 硬约束（静态契约未做性能测试，不虚报）：`async-parallel`（并行拉取六链数据）、`bundle-barrel-imports`（lucide 直接路径导入）、`server-serialization`（ViewModel 最小化传入 client）、`rerender-no-inline-components`、`rendering-conditional-render`、`client-swr-dedup`→TanStack Query 对应、`rendering-content-visibility`（长列表）。完整规则文件按需读取。

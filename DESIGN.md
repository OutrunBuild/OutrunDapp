# Outrun DApp 设计真相（定稿 · Stage-01 步骤 10；决议 010 强化；决议 012 精修追认 2026-09-19）

> 状态：**定稿**（视觉真相源）。唯一架构真相源为 `docs/architecture.md`。
> **可执行设计系统入口：`docs/design-system/README.md`**（基础/组件索引/页面模式/文案/Agent 工作流）。本文件定义「是什么」，该目录定义「怎么用」。
> 决策链：`docs/design/decision-log.md`（决议 001~010）。**决议 005：本文件示例片段（/pol 演示等）仅为视觉载体，不代表产品 UI/UX**——产品 UX 以阶段 2 brief 为准。token 唯一源：`components/design-system/tokens.css`（契约：`token-contract.md`）。

## 1. 视觉世界（决议 010 强化版）：暗端信号台 · 复古未来主义全浓度

- **方向**：cyberpunk 主导，synthwave 作光（黄主光 `#FCEE0A` + 品红回声 `#FF06B5` + 青功能 `#00F0FF`，BRAND 错位回声机制为融合桥）。证据链：VS-002/007/004 + BRAND + r10 部署提取（`review/r10-css-extract.css`，部署 `outrun-phi.vercel.app`）。
- **气质（决议 001-A 去极客结构保留；决议 010 勘误：此前执行把复古未来主义做弱了——去极客≠去风格）**：日常消费产品的信息结构（常规无衬线正文/导航/按钮、人话文案、等宽字仅数据字段），但**复古未来主义装饰层全浓度**：
  1. **HUD 网格底纹**：全站青色网格（44px 外层 `rgba(0,240,255,.09)`，主区加密 22px `.06`）+ 主区品红 135° 角部渐隐洗色
  2. **品红错位回声轨**：侧栏右缘 1px 品红线+glow；标题条青线与 -72px 位移品红回声线（`--echo-offset`）——错位回声作为结构元素
  3. **CRT 扫描线**：全站 3-4px 周期 3-4% 白 `screen` 叠层（`pointer-events:none`）
  4. **信号脉冲**：live 指示青点 steps(2) 1.4s 脉冲（reduced-motion 降级为静态双描边）
  5. **斜切三档体系**：UI 件 ≤8px（导航实测 7px）/ 表格+卡片容器 10px 单角 / KPI+斜杠记号 12px 对角双切（`clip-path`，切角容器圆角=0）
  6. **glow 分层开关**：`[data-glow=on]` 属性统一控制（导航激活黄 glow/斜切记号/CTA 黄 drop-shadow/卡片青微光）；**off 时全站完全可读**（红线不变）
  7. **CTA 品红内衬**（inset 底缘 2px——`--line-echo`，hover 变亮黄 `#FFF45C`）、青 protocol 芯片（skew(-8deg) 平行四边形）、斜杠分隔记号（5px 横条+12px 斜切端）、卡片青 tinted 描边+KPI 顶缘青 inset 光、tab 激活=顶部黄 2px 线、生命周期卡黄 inset 2px 强调条
  8. **精修纪律（决议 012）**：环境层低对比、结构层一处一强调、数据层零 glow；粗重全宽霓虹线收敛为「黄 2px 主信号（`--line-accent`）+ 品红 1px 错位回声（`--line-echo`）」，面板只在可交互或关键状态时提升信号强度
- **不变**：黑底 `#0A0A10` 家族、黄唯一主光、品红仅回声层/大字号/图形、青仅功能/focus、数据层文本零 glow（glow 只照结构记号与强调层，不照数据文本）。

## 2. 色彩（决议 002 P2 冷石墨，实测对比度）

| 角色 | Token | 值 | 对比（on surface） |
|---|---|---|---|
| 底 | `--color-bg` | `#0A0A10` | 品牌锚 |
| 表面 | `--color-surface` | `#12141B` | — |
| 正文 | `--color-text` | `#E6E9F0` | 15.14:1 AAA |
| 次级/三级 | `--color-text-secondary/tertiary` | `#9AA3B5`/`#8791A4` | 7.25 / 5.80:1 |
| 主强调 | `--accent-primary` | `#FCEE0A` | 15.15:1（唯一主光） |
| 回声 | `--accent-echo` | `#FF06B5` | 仅大字号(≥20px)/徽章/图形 |
| 链接/focus | `--accent-link` | `#00F0FF` | 链接与 focus 专用，禁大面积 |
| 成功/危险/预警 | `--color-success/danger/warning` | `#35E08E`/`#FF5468`/`#F4B74A` | 10.69 / 5.89 / 10.27:1 |
| 抬升/内嵌表面 | `--color-surface-raised/inset` | `#171A23`/`#0D0F15` | 同族冷灰两档 |
| disabled 底/描边 | `--color-disabled-bg/border` | `#2A2E3D`/`#2A4A52` | 次级文 on disabled 底 5.32:1 |
| 边框 | `--color-border(-strong)` | `#262A38`/`#3A3F52` | — |

品牌锚（`--logo-magenta-*` 四档、`--site-black`）原样来自 `logo-spec.md`，页面不得覆盖。

## 3. 字体与密度（决议 001-A / 003 T2）

- 角色（010 终选，r10 部署已定，next/font 自托管）：display=**Saira Condensed**（窄体复古未来主义大标题，600/700，clamp(30px,1em+22px,44px)+tracking .015em）/ body=**IBM Plex Sans**/ data=IBM Plex Mono+`tabular-nums`/ 中文 Noto Sans SC。D2/D3 遗留字体（Outfit/Space Grotesk 等）不采纳。约束不变：非默认 Inter。
- 字阶：11/12/**14 基准**/16/20/28px；KPI 读数 22px。
- 密度：表格行高 **44px**（T2）；T1 36px 仅 /pol、/portfolio 高密度区；T3 56px 仅营销/新手区。控制高度 40px。
- 间距 8px 基线网格（`--space-1..8`）。

### 3.1 组件视觉语法（决议 012）

- **Shell**：`--color-bg` + 低对比 HUD 网格；sticky header 使用独立半透明表面与结构阴影，不叠彩色 glow。
- **Signal panel**：冷石墨表面 + 1px 青 tinted 描边 + 单一斜切；只在 KPI、筛选、工作台与状态面板使用。
- **Data surface**：中性边框、tabular-nums、零 glow；hover 只提升一档表面并出现 2px 青色选择线。
- **Action control**：黄表示主行动、青表示功能/focus、品红仅作为 1-2px 回声内衬；禁三色同时填充同一控件。
- **State**：成功绿、危险红、预警橙仅表达状态；不可替代黄/青/品红的品牌角色。

## 4. 布局与签名交互

- 骨架：侧栏导航（自然语言标签+图标，激活=黄竖线+黄字+黄 glow[glow on]+品红右缘回声轨）+ 主区（HUD 网格底+品红角部洗色 → 面包屑+网络胶囊（青线+-72px 品红回声）→ KPI 带（12px 对角双切、青 inset 顶光、分隔线分格）→ 工作台表格（选中行青 inset 竖条+底线）→ 审阅卡（可展开）→ 四态区）。390px：侧栏收底部 tab、KPI 2×2、表格横滚冻结首列。
- 签名动效两枚（决议 010）：**回声确认**——确认态主元素 120ms 品红错位闪烁（保留）；**信号脉冲**——live 数据源青点 steps 脉冲。reduced-motion → 全部降静态双描边。其余动效仅状态反馈。全站 CRT 扫描线为静态叠层（非动效）。
- 字标（决议 004）：brand/ 包唯一基准；≥96px 宽用字标、<150px 用 symbol、浅底 mono、禁改色/拉伸/裁切。favicon/PWA 用 `brand/05-favicon/`、`06-app-icon/` 成品。

## 5. 可读性红线（全程有效）

1. 数字字段（价格/收益率/余额/数量/区块/时间戳）一律 `--font-data` + tabular-nums。
2. 正文 ≥4.5:1、大字 ≥3:1（当前实测全 AAA/AA，见 §2）。
3. 数据层文本零 glow（glow 仅结构记号与强调层：导航激活条/斜切/CTA/卡片青微光，由 `[data-glow]` 统一开关）；关 glow 全站仍 AA。
4. focus=青色 2px 外环（全站唯一）；motion 尊重 reduced-motion；图标按钮有名称；异步状态有恢复动作。
5. 中文正文基准 16px（013 上调：原 ≥14px 硬线）、标签 ≥12px；中英分别溢出测试。

## 6. 双语（决议 001-B）

单语言渲染 + `/{locale}`（zh/en）切换，**默认 en**（`/`→`/en`；architecture §2 修订挂起至架构修订窗口）。禁止同页混排双语。

## 7. 负面清单（不豁免）

蓝→紫→青 hero 渐变；无依据装饰渐变（渐变禁作背景/按钮默认，D2 日落渐变未采纳）；居中三卡片；默认 Inter；emoji 图标；未定制 shadcn 主题；数据层发光文字；大面积青色块。

## 8. 参考分类

- 视觉审美来源（VS-001~009 + BRAND）与拆解：`references/aesthetic-learning.md` / `aesthetic-principles.md`（borrow/adapt/禁复制 + 须关闭清单）。
- 交易 UX 来源（PU-000~009 + V0-URLS）：只约束信息结构与流程，禁推导视觉。
- 复杂度地图（11 路由密度/字段/引源）：`references/complexity-map.md`。

## 9. 依据与产出索引

- 决策：`decision-log.md`（001 方向/002 色板/003 密度/004 字标，签名行待用户亲填）
- Token：`components/design-system/tokens.css` + `token-contract.md` + `docs/design/review/token-preview.html/png`
- 方向文档：`directions/direction-01.md`（含锁定后修订节）
- 依据：architecture.md §1/§2/§3/§10/§14/§18；Skill：frontend-design（SHA256 `1608ea77…b3f45dd`）

# V0 TASK — round-00 研究轮任务书

> 你（v0）在 Stage-01 中的角色：**高保真渲染引擎**。决策来自仓库研究链，渲染保真来自你。

## 你要做什么（步骤 8：design-review/direction-choice）

在同一 `outrun-dapp-prototype` 项目的 `design-review/direction-choice` 页面，把 `directions/direction-01.md`、`direction-02.md`、`direction-03.md`（决策详情见 `comparison.html` 决策规格书）渲染为**三个产品级保真的方向候选**，各自复刻同一真实片段（/pol 工作台）：

- 导航（含品牌侧栏语义）
- KPI 带：结算回收 12,580.44 UUSD / 结算结余 312.08 / 结算缺口 0.00 / PT 锚定比率 0.9871
- 持仓表：SEP-26（4,200.00 PT / 1,860.50 YT / 0.0131 POL / 2026-09-30）、DEC-26（8,900.00 / 2,410.00 / 0.0208 / 2026-12-31）
- YT Flash Swap 审阅：卖出 4,800.00 YT、最低收到 95.50 POL、最高支付 0.22 POL、保护线 0.0199 POL（-4.2%）、过期时限 120s
- 状态：Loading（模拟 Type-4 交易）/ Empty（暂无仓位）/ Error（报价失效+重新报价恢复动作）/ 按钮 disabled（会话未开启）
- 双语：中文为主、英文注（两种语言都完整可读，不得只做一种）

同时提供 1440px 与 390px 两个视口。

## 锁定与自由

**🔒 不可更改（决策层）**
- 每方向规格书（comparison.html）中所有 🔒HARD 项：色彩角色与色值、对比度边界、字体角色分工、信息结构与密度、签名交互定义与 reduced-motion 降级、融合约束（主导/从属/桥接/禁组合）
- 品牌锚：`assets/BRAND-01-wordmark-onblack.png`、`assets/BRAND-04-symbol-color-512.png`（色值与用法按 `docs/design/references/user-sources.md` C 节与 brand spec）
- 可读性红线：数据数字 tabular-nums；数据层无 glow 仍 AA（对比度实测值见规格书）；键盘 focus 可见；reduced-motion 尊重

**🟢 你的发挥空间（执行层）**
- 字族具体选择（禁默认 Inter；训练高频字族可用但需在生成说明里给出一句理由）
- 间距节奏、圆角、光影/elevation 体系、组件质感、hover 微交互
- 把线框密度翻译成真实版面的全部排版判断

## 负面清单（全程有效，风格需要不豁免）

蓝→紫→青 hero 渐变；无品牌/层级依据的装饰性渐变（渐变不得作背景/按钮默认装饰，D2 营销层 hero 除外）；居中三卡片堆叠；emoji 代替图标；未定制 shadcn 默认主题；数据层发光文字。

## 联网参考

你可以联网：按 `docs/design/references/V0-URLS.md` 的对照表访问活站点（含观察目标与对应路由；无法访问的站已标注，用包内截图）。

## 资产边界

- `assets/USR-INBOX-*` 为 reference-only 研究素材：**不得嵌入生成页面**，只作风格理解上下文
- 品牌资产仅可用上列两件成品图；不得改色、变形、重组
- 外部站点截图（visual/、product-ux/）是证据档案，不是可复用素材

## 产出要求

三个方向内容等价、视觉系统差异可辨、每个方向的来源链（主导 source-id）在页面可见标注。生成后由仓库侧截图、hash 入链（round-00-revisions.json），人工在此页做方向签名——你不做选择，只做渲染。

# 交易 UX 研究 v2（Stage-01 步骤 5 · 深度修订 2026-09-15 晚）

> 修订缘由：v1 只有营销首屏被用户否决。v2 覆盖**产品内页**（代币详情/交易台/工作台），含用户手动补给的 four.meme 截图与 Outrun 旧版 demo（过时产物，非真相源）。
> 铁律不变：全部站点只作「交易 UX 参考」——列表排序/过滤、表单、生命周期状态、审阅步骤、风险提示、错误恢复、移动端折叠。禁止推导色板/字体/品牌语言；截图禁入 visual-moodboard。
> 捕获：headless-shell + swiftshader（1440×900，reduced-motion，locale en-US/zh-CN）；交互导航用有头 quick-visit 发现深页 URL。hash 见 board 注脚。

## 模块〇 · Outrun 旧版 demo（过时产物，非真相源）→ 仅作历史参照

- **PU-000** `demo.outrun.build/memeverse/26/detail`（desktop `80070ac7…c872e` / mobile `5a5aa290…10c9f`，双语 zh 捕获，完整渲染）。**定位（用户裁定 2026-09-15）：上一版本过时产物，与现行产品差异很大，仅个别相似点，不作为官方真相源**；真相源仍为 architecture.md + OutrunBook。以下观察只取「上一版做过的 UX 选择」这一历史参照价值，任何与 OutrunBook/complexity-map 冲突之处以后者为准：
  - IA 三段式：返回→核心交易区（左 K 线 + 右 Swap）→详情 Tab 区（Overview/Liquidity/POL/Yield Vault/DAO 五 Tab——对应我们 /memeverse/[verseId] 的子页面族）。
  - Swap 面板：滑点齿轮设置 + 连接钱包 CTA + 价格影响/最低收到/路由的审阅行结构（与 Jupiter 同构——团队已采用行业审阅范式）。
  - 成熟期状态以数据维度隐式表达（MC/Liq/Vol/Pop/TS 指标条 + 7d/30d/All 周期切换），无显式生命周期标签。
  - demo 全局导航露出「OutStake/OutSwap/FFLaunch/Memeverse/Referral」——为 2026-09-14 裁定前的旧 IA（现行裁定：OutStake 品牌隐藏）。此处仅说明其为旧版，不构成现行产品冲突；阶段 1 按裁定执行。
  - demo 路由 `/memeverse/26/detail` ≠ 我们 IA 的 `/memeverse/[verseId]`——参照结构不参照路由。

## 模块一 · Memecoin LaunchPad → /memeverse、/create、/[verseId]（Preorder/退款/领取）

- **PU-002d letsbonk 代币详情/交易页**（`ffcb57b3…5ea8`，完整渲染）：
  - **生命周期状态显式化**：「This token has migrated」横幅 + Market Cap Progress 100%（Current=$60,415.66 = Target）——bonding→graduated 两态都有专属呈现位（横幅=状态宣告，进度条=量化）。
  - 交易卡：Buy/Sell Tab、滑点（5% 默认）、Half/Max 快捷键、余额行；图表区（birdeye 嵌入）在无头下未加载——真实用户侧正常，属捕获限制。
  - 对应 Outrun：Genesis/Locked/Refund/Unlocked 四态需要同级显式状态位（complexity-map 路由 5），且达标进度是**双门槛独立**不可单进度条照抄。
- **PU-003 four.meme 全套**（用户换 IP 后 2026-09-15 程序捕获恢复；此前仅用户手动截图）：
  - **PU-003r `/en/ranking` 列表**（desktop `5e6d1bf4…4aed02` / mobile `dc47c9ee…a10a0d6`）：**表格型列表**（非卡片）——代币标识/价格/**24h 涨跌带色**/市值/流动性/**进展（progression）列** + 筛选器；对照 /memeverse 发现页：表格密度高于 letsbonk 卡片网格，两档密度都有实例。
  - **PU-003t `/en/token/0x2c3a…f7db` 详情/交易页**（`0dcbf8d7…637089`）：双栏（K 线+订单簿+交易对信息 / 交易卡）+ **四阶段生命周期指示器**（创建→拉升→解决→迁移，当前阶段高亮）——LaunchPad 业界最完整的阶段呈现，直接对照 Outrun 四阶段（Genesis→Locked→(Refund)→Unlocked）。
  - **PU-003c `/en/create-token` 创建表单**（`fb1b4d4b…da666a`）：字段集与 /memeverse/create 注册参数（链多选/定价/最低额度/治理链）同族，可迁移字段分组方式。
  - **PU-003u 用户手动截图**（`f2633c8b…fe61`，保留）：另一代币的详情页实例（买卖 Tab+滑点+实时费率 1% Fee 提示+可展开审阅）。
  - PU-003 落地页（`dbae7679…ee9f10`）：营销首屏，仅信息架构旁证。
- **PU-001 pump.fun：blocked-capture（三轮证据）**——根页×2 与 /explore 均因 websocket 实时流挂起；有头 DOM 事实已存：欢迎插页（Continue 门）+ 产品导航（/explore 列表、swap.pump.fun、/live）。结构结论只用 DOM 事实，视觉留 blocked。**观察重心（用户裁定）：/explore 列表**（列/卡设计、排序过滤、生命周期状态、创建入口）；swap.pump.fun 仅一个交易框、与 Jupiter 参照重复，不作为观察目标。
- **PU-008 sunpump.meme**（`5b8374dd…05d8`，完整渲染，runbook 备用）：列表+创建入口的补充样本（LaunchPad 模块第三站）。
- **PU-009/PU-009d ponsfamily.com**（**用户手动截图 2026-09-15**（`313642c9…02d27` 列表 / `3bae39d0…21ba` 详情）+ DOM 事实取证；程序截图 blocked×4：后端升级期+实时行情）：
  - `/launchpad` 列表（PU-009 视觉确认）：Explore/Forum/Analytics 三区导航、⌘K 全局代币搜索、**Create/Graduated 以 Tab 切换且带数量徽章**——状态筛选+计数组合直接对照 /memeverse 阶段过滤（lifecycle 四态+数量徽章）。卡片网格：图标/名称/价格/**24h 涨跌带色**/市值/**毕业进度条**/创作者头像（与 four.meme 表格型构成两档密度实例）。
  - 代币详情（PU-009d 视觉确认）：双栏——左 K 线（1m~1D 周期）+ 订单簿/最近成交（bid/ask 双列**深度条**）；右统计卡（价格/24h/市值/流动性/供应/Holders）+ 交易卡。**Market/Limit/Orders 三 Tab**：市价=金额+滑点+确认；限价=价格+数量+**有效期**；**Orders Tab=挂单列表**（价格/数量/状态/取消）——挂单管理的完整呈现位。页顶常驻 **bonding→graduated 两阶段进度指示器**（高亮+百分比）。
  - 「Degraded performance」降级横幅：后端升级期的**降级状态 UX 实例**——横幅置顶、说明原因、不断功能——对照 Outrun 的索引延迟（lag>120s）与 PSM 额度用尽等降级态呈现（complexity-map 附注）。
  - 视觉证据缺口的补偿：URL 已入 V0-URLS（v0 联网可访问）。

## 模块二 · PT/YT 与收益结构（Pendle）→ /pol、/portfolio

- **PU-004** Pendle markets（同 v1）：到期日一级维度 + APY/价格列 + 移动端卡片化。深度补充：demo（PU-000）的 POL/Yield Vault Tab 证明团队预期 /pol 能力以 Tab 族组织——Pendle 的「到期分组列表」与 Outrun「单 Verse 内期限表」粒度不同，取其**列设计**不取其信息架构。

## 模块三 · Swap 与交易审阅（Jupiter + demo 内置）→ /trade 与嵌入动线

- **PU-005** Jupiter（同 v1）：双输入+Max+可展开审阅（价格影响/路由/费用/滑点 0.5%）。
- **PU-000 demo**：Outrun 自有 Swap 审阅行（价格影响/最低收到/路由）已同构 Jupiter 范式——阶段 1 直接沿用该审阅行结构，叠加动态费率分解（complexity-map /trade 行的四费率展开）。

## 模块四 · 质押仪表盘（Jito）→ /portfolio、/stake

- **PU-006** jito.network 指标页（同 v1）：TVL/APY 大数字+趋势。
- **PU-006d** `/staking`（`17d24f84…55ca`，完整渲染）：Liquid staking 主张页 + CTA（质押操作在 app 子域需钱包）。仪表盘数据结构以 PU-006 为准；注意 hero-metric 套版警示（负面清单）——Outrun 用表格为主、指标卡为辅。

## 模块五 · CDP 仓位与储蓄（Spark）→ /portfolio 嵌入（PSM/USR/赎回）

- **PU-007** spark.fi 营销 hero（同 v1）：Borrow/Save 双 CTA + 利率历史曲线组件。
- **PU-007d** app.spark.finance Savings 工作台（`2c9632ead…f8c9`，完整渲染）：**多资产 APY 看板**（USDC 3.60/USDT 3.50/USDS 3.60/ETH 1.45/PYUSD 3.60）+ 每资产 TVL 与 Deposit cap——直接参照 USR 三族金库（suETH/suUSD/suBNB）的利率呈现，Outrun 需增「族利率 0=未激活」态与存款上限=铸币上限语义对齐（outstake/usr.md §三个金库、staking-modes.md §铸币上限）。

## 移动端折叠通则（v2 复核）

列表→卡片行（PU-002/004 mobile）；hero 压缩+透视网格省略；demo mobile（PU-000-mobile）确认三段式 IA 在 390px 退化为单列流+底部操作区。

## 分类自检

- 无色板/字体/风格结论 ✓；截图仅存 `product-ux/` 与 board，与 visual-moodboard 物理隔离 ✓（demo 视觉同样不作为方向来源）✓
- blocked/partial/用户手动/仅DOM事实 均如实标注（pump.fun blocked×3、ponsfamily 程序 blocked×4 但用户手动截图补齐、four.meme 程序+用户双证据、letsbonk 图表嵌入未渲染）✓
- 每条观察标注对应 Outrun 路由 ✓；PU-000 已降级为「旧版过时产物，非真相源」，观察仅取历史参照价值 ✓

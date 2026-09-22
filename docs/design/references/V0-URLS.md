# v0 联网参考 URL 清单（V0-URLS）

> v0 可联网。上传包内的截图是保底证据（v0 抓取不稳定时用）；本清单是**带观察目标**的活链接。只提取 UX 结构与流程；视觉方向仍只来自包内 `visual/` 研究链与决策规格书。

## 模块对照表

| # | URL | 类型 | 观察目标 | 对应 Outrun 路由 |
|---|---|---|---|---|
| 0 | https://demo.outrun.build/memeverse/26/detail | **旧版过时产物（非真相源，仅历史参照）** | 三段式 IA、五 Tab、Swap 审阅行、移动端退化——只作「上一版的选择」参考；与现行产品差异大，冲突处以架构文档+OutrunBook 为准；勿复刻导航命名（OutStake 为裁定前旧 IA） | /memeverse/[verseId] 全族 |
| 1 | https://www.letsbonk.fun/ | LaunchPad | 过滤标签行、卡片网格、进度条 | /memeverse |
| 1d | https://www.letsbonk.fun/token/GMvCfcZg8YvkkQmwDaAzCtHDrrEtgE74nQpQ7xNabonk | LaunchPad 详情 | 迁移横幅（状态宣告）、MC 进度 100%、Buy/Sell Tab、滑点、Half/Max | /memeverse/[verseId] + /trade |
| 1p | https://www.ponsfamily.com/launchpad | LaunchPad | Explore/Forum/Analytics 三区、⌘K 搜索、**Create/Graduated 生命周期筛选（带数量）**、降级性能横幅（降级态实例） | /memeverse |
| 1pd | https://www.ponsfamily.com/launchpad/0x39dBED3a2bd333467115dE45665cC57F813C4571 | LaunchPad 详情 | Market/Limit/Orders 三交易模式 Tab、Dexscreener/GeckoTerminal/Contract/Pool 生态链接组 | /memeverse/[verseId] + /trade |
| 1m | https://four.meme/en/ranking | LaunchPad 列表（four.meme，换 IP 后可访问） | 表格型代币列表：价格/涨跌/市值/流动性/进展列、筛选器 |
| 1md | https://four.meme/en/token/0x2c3a8ee94ddd97244a93bc48298f97d2c412f7db | LaunchPad 详情 | 四阶段生命周期指示器、K 线+订单簿+交易卡双栏 |
| 1mc | https://four.meme/en/create-token | 创建表单 | 字段分组、提交与费用呈现 |
| 1f | https://pump.fun/explore | LaunchPad 列表（pump 主参照） | 代币列表结构：列/卡设计、排序与过滤、生命周期状态呈现、创建入口（有欢迎插页 Continue 需先点掉）；swap.pump.fun 仅是一个交易框，与 Jupiter 重复，不必看 | /memeverse |
| 2 | https://app.pendle.finance/ | PT/YT | 到期日一级维度、APY/价格列、行展开 | /pol、/portfolio |
| 3 | https://jup.ag/ | Swap | 双输入+Max、可展开审阅（价格影响/路由/费用/滑点） | /trade + 嵌入动线 |
| 4 | https://www.jito.network/ | 质押 | TVL/APY 指标卡结构（注意 hero-metric 套版警示） | /portfolio、/stake |
| 5 | https://app.spark.finance/ | 储蓄 | 多资产 APY 看板 + TVL + Deposit cap | /portfolio 嵌入（USR 三族金库） |

## 我们的抓取工具无法截图（v0 的正常浏览器可以访问，列入上表；此处仅说明证据缺口）

- pump.fun：websocket 实时流致无头截图挂起（PU-001 blocked×3，DOM 事实见 study）——**v0 联网访问无碍**
- ponsfamily.com：后端升级期 + 实时行情，无头截图挂起（DOM 事实已记入 study）——**v0 联网访问无碍**

## 无法访问（防护墙，证据在包内截图）

- thefwa.net：Cloudflare 前置（VS-007 截图在包内）

## 视觉审美来源（风格学习用，不是 UX）

见包内 `visual/visual-source-index.html`：9 个已核实来源（VS-001 The Midnight … VS-009 Radical Icons）带原始 URL 与观察目标。风格结论以 `aesthetic-principles.md` 为准，勿从这些站自行发明新原则。

# Brief：`/`（产品落地页）

- routes.json ID：R-01；决议 007（落地页定位）
- 依据：architecture §2；OB:vision.md、ecosystem/business-model.md:5-8、ecosystem/playbooks.md:7-11、ecosystem/audience.md；source map §5.3
- 产品事实层：product-intent.md R-01
- 实现：`components/home/home-page.tsx`（RSC）

## 1. 用户任务

- 目标用户：**陌生访客**（首次到达，无钱包也可完整浏览）；回访用户经导航直达内页
- 用户任务：①3 秒明白这是什么（Hero 定位）②判断可信度（证据带指标）③看懂双模块机制（引擎卡+机制入门段）④看懂生命周期（教育段）⑤进入产品（CTA）
- 完成定义：点击 CTA 进入 `/memeverse/explore` 或外跳文档
- 最重要的一个决策：**要不要进产品**（Hero 主 CTA 与收尾 CTA 双出口；CTA 落发现页创世视图=有意漏斗）

## 2. 核心组件

| 组件 | 职责 | 实现锚点 |
|---|---|---|
| SiteFooter | 品牌字标+一句话陈述；Protocol 组（发现页链接、#engines、#lifecycle 锚点）；Resources 组（OutrunBook 文档、GitHub 外链）；社交位（X/Discord/Telegram 根域名占位——官方账号链接待定，GitHub 真链）；© 2026+tagline | `home-page.tsx` SiteFooter |
| Hero 定位区 | 标题（lead+accent 两段式，accent 多行折行渲染、句号单独着色）+副文案+主 CTA（→`/memeverse/explore`） | `.home-hero` |
| 证据带（proof band） | 3 个数字：总锁定（$ 缩写格式）、已部署 Verse 数、累计参与地址数；`data-numeric` 数字语义 | `.home-proof-band` + `formatMarketCap` |
| 引擎卡带（#engines） | 双引擎卡（title/description/note 三层：断言句+好处+机制注脚）；公平发射口径=供应全部在池内、无池外份额、三种参与同一套规则、未达标全额退款 | `.home-engine-strip`/`.home-engine` |
| 机制入门段 | 营销文案分层（note=提炼钩子、desc=好处背后的 why）；POL 与权益注解（glosses） | `MechanismPrimer`（`mechanism-primer.tsx`） |
| 生命周期教育段（#lifecycle） | 四阶段教育叙事+术语注解（复用机制段 POL/权益 gloss） | `VerseLifecycle`（`verse-lifecycle.tsx`、`term-gloss.tsx`） |
| 收尾 CTA 区 | 主 CTA（→`/memeverse/explore`）+ 文档 CTA（→OutrunBook GitHub 外链） | `.home-final-cta` |

桌面/移动由 `home-*` 布局类响应式承载；密度=低（落地页下限档）。

## 3. 数据依赖

| 数据 | 当前来源 | 生产来源 | 降级行为 |
|---|---|---|---|
| 总锁定 / Verse 数 / 参与地址 | `getFixtureSnapshot().homeMetrics`（fixtures） | Graph（RSC 聚合） | 数值带骨架或「—」+重试；不阻塞首屏 |

渲染边界：整页 RSC；CTA 为链接（Link/`<a>`）无客户端数据交互；OutrunShell 导航内含全局钱包按钮（Client 岛）。

## 4. URL 状态

无查询参数；锚点 `#engines`、`#lifecycle`（页内导航）；en canonical `/`（proxy 内部 rewrite 到 /en/**），zh `/zh`；裸 `/en/**` 由 proxy 307 收敛。

## 5. 文案键（components/global/copy.ts `home.*`，双语；术语引 glossary.md）

`titleLead`/`titleAccent`/`sub`/`primaryCta`；`kpiBand.{label,tvl,memecoins,users}`；`enginesTitle`/`enginesSub`/`engines[]`（title/description/note）；`mechanism.*`（note/desc 分层+pol/rights）；`lifecycle.*`；`finalTitle`/`finalBody`/`docsCta`；footer 组（`footerStatement`/`footerProtocolLabel`/`footerResourcesLabel`/`footerTagline`/`footerSocialLabel`）。

## 6. 全状态标注（A1–A15、B1–B4）

| 状态 | 标注 | 说明 |
|---|---|---|
| A1 Disconnected | rendered-here | 默认态：页面完全可读，导航连接按钮引导 |
| A2 Connecting | delegated-to-global-surface | 钱包选择器（GS-3） |
| A3 Wrong network | N/A（本页无写操作） | — |
| A4–A7 | N/A（无写操作） | — |
| A8–A12 | N/A（无交易；交易状态证据链接=GS-4 交易中心） | — |
| A13 Loading… | rendered-here | 指标带骨架（取数中） |
| A14 Empty | rendered-here | 指标零值照常显示（0 也是真实状态） |
| A15 Error | rendered-here | 指标带「—」+重试；页面其余不受影响 |
| B1/B2 | N/A | — |
| B3 Index lag >120s | delegated-to-global-surface | 指标带标「同步中」 |
| B4 User rejected | N/A（无签名） | — |

## 7. 可点击主流程

- 访客读 Hero → 证据带 → 引擎卡 → 机制段 → 生命周期段 → 收尾 CTA
- 出口：主 CTA → `/memeverse/explore`；文档 CTA → OutrunBook；页脚 → 发现页/锚点/外链
- 本页纯落地页，无写操作

## 8. 错误恢复

- 指标取数故障：数值带显示骨架或「—」+重试（A15 aria-live=assertive）；不影响 Hero/引擎卡/教育段渲染
- 社交外链为占位（官方账号待定，Q 项）；文档/GitHub 链接为真实仓库地址

## 9. 视觉证据

- DESIGN.md 四轴；tokens.css 语义类（`home-*` 布局类登记于 docs/design-system/components.md）；指标数字 tabular-nums、零 glow；hero 禁模板化「大数字+渐变」（hero 是论点：首屏传达双模块闭环）

## 10. fixture 场景

- `normal`：证据带三数有值；`zero-balance`：冷启动全零；`rpc-fail`：指标 Error 态；`index-lag`：「同步中」
- 数据=fixture snapshot `homeMetrics`（`totalLocked`/`deployedVerseCount`/`participantCount`，经 `lib/data/fixture-repository.ts` 组装）；场景 ID 引 fixtures/scenarios/states.json

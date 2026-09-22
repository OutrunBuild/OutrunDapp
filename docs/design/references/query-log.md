# 检索日志（Stage-01 步骤 3 · 2026-09-15）

工具：WebFetch / webReader（发现）；Playwright `1.62.1`（`~/.cache/ms-playwright` chromium + headless-shell，程序化浏览器控制，locale `en-US`、`reducedMotion: reduce`、consent 自动关闭）。检索轮次上限 3 轮 / 150 分钟；本轮 1 轮即达核验门后停止。

## 轮次 1（2026-09-15）

| 检索/入口 | 访问结果 | 处置 |
|---|---|---|
| `synthwave website design`（起始候选 The Midnight） | 可访问，双视口+全页截图（VS-001） | 计入 `direct-style`（synthwave） |
| Cyberpunk 2077 官方站 `https://www.cyberpunk.net/us/en/` | 可访问；首捕 mobile 有 Cookiebot 弹窗，工具自动关闭后重捕（VS-002） | 计入 `direct-style`（cyberpunk） |
| 《边缘行者 2》官方站 `https://www.cyberpunk.net/zh-cn/edgerunners2` | 可访问（VS-003） | 计入 `direct-style`（cyberpunk，动画语汇） |
| Neon Dystopia `https://www.neondystopia.com/` | 可访问（VS-004）；暗底霓虹+杂志网格+cyberpunk 叙事，5 项证据命中 3 项 | 计入 `direct-style`（cyberpunk 编辑风） |
| `site:awwwards.com cyberpunk website` | 标签页 `awwwards.com/websites/cyberpunk/` 仅 1 个提名：Cyberpunk Interactive 3D Desk（Introvigne Thibault，`https://3dcyberroom.vercel.app/`） | 无头截图仅 loading 计数器；有头 +12s 等待后 WebGL 完整渲染（VS-005）→ 计入 `web-design-case`（cyberpunk） |
| `site:awwwards.com synthwave web design` | 标签页 `awwwards.com/websites/synthwave/` 无结果 | 记录，无候选 |
| `site:awwwards.com neon / retro-futurism web design` | `retro-futurism` 标签页候选丰富；逐项打开详情页取作者与原始 URL：2bit.chat（Swaraj Singh 等）、FWA Wire（Rob FWA，外链 `thefwa.net`）、Neutomni（原始 URL 未能追溯到独立域名，Webflow 模板页为主） | 2bit.chat（VS-006）、FWA Wire（VS-007）计入 `web-design-case`（other-retro-futurist）；Neutomni 排除（原始项目 URL 不可追溯） |
| **behance.net**（站内搜索 `synthwave web design`） | 可访问：`10,000+ results`，例 "Sui - Brand Identity & Website"；项目卡未提供可追溯的独立原始网站 URL；重动画 SPA，截图合成超时（DOM 事实已存证） | **发现入口**，无案例计入（rubric §5：须作者+原始项目 URL） |
| **pinterest.com**（站内搜索 `synthwave web design`） | 匿名访问登录墙：`links: 0`，正文为空 | **发现入口**，标记 `blocked`（anonymous），无案例计入 |
| **styleshift.design/styles/synthwave** | 可访问："Retro Synthwave — StyleShift"，含 principles（Neon on Dark 等）；未列可逐项打开的原始网站案例清单 | **发现入口/风格索引**，自身不计入（rubric §1 reference-index）；其 principles 仅作索引线索，不替代实站证据 |

## 计数（互斥，见 source-register.json）

- `direct-style` ≥4 ✓：VS-001（synthwave）、VS-002（cyberpunk）、VS-003（cyberpunk）、VS-004（cyberpunk 编辑风）
- `web-design-case` ≥2（与 direct 互不重复）✓：VS-005、VS-006、VS-007（3 个）
- 合计已核实来源 7 ≥6 ✓，达到最低门即停（未用满 3 轮）。
- `fusion-case` 标注：本轮无单作品融合案例；融合锚点为 `docs/design/brand/`（rubric §4，不占计数）。

## 轮次 2（2026-09-15 · 审计补强：完成 7 个规定检索词中剩余 3 个，寻找 fusion-case）

| 检索/入口 | 访问结果 | 处置 |
|---|---|---|
| `cyberpunk synthwave fusion design` | 结果多为 Dribbble/Behance/GraphicRiver 图库与 YouTube 合集（非实站） | 记录；图库/视频不计入 |
| `neon noir interactive website` | 命中 SVAROG Neon Noir 案例站（live Framer）；designmd/aesthetics wiki 为索引/词条 | **VS-008** 计入 `web-design-case`（neon-noir，非 fusion）；索引不计入 |
| `retro-futurist web design` → 落到 One Page Love `synthwave` 标签 | 标签页仅 3 案例：Radical Icons（radicalicons.com 存活 200）、We are the Innovation（nkfrv.com 444 死链）、Starborn Wanderers（starbornwanderers.com 000 死链） | **VS-009** radicalicons.com 计入 `web-design-case`，`substyleTag: fusion-case-lite`（synthwave 主导 + cyberpunk 底色同页和谐共存：渐变只在 hero、暗底等宽字承载内容）；两个死链案例排除并记录 |

## 计数（轮次 2 后更新）

- `direct-style` 4：VS-001~004
- `web-design-case` 5：VS-005~009
- `fusion-case` 1：VS-009（lite，如实标注；另一融合锚点为 brand/ 包，不占计数）
- 合计已核实 9。

## 审计补强记录（2026-09-15）

- 复审 7 张 mobile 截图：6 张有效；VS-003-mobile 被 Cookiebot(Usercentrics 中文) 遮挡——以 `--host-resolver-rules` 屏蔽 `consent.cookiebot.com` 后双视口重捕，目检通过，register hash 已更新（desktop `2461927e…`、mobile `83c77a2d…`）。
- VS-004 direct-style 五维证据细目已补入 register `evidenceForDirect`。

## 排除与受阻记录

- Neutomni：作者可追溯但原始项目 URL 只指向 Webflow 模板聚合页，非独立原始站 → 排除。
- VS-007 全页补充截图：滚动注入触发站点防护，未产出；协议双视口截图有效，登记 `fullCapture: unavailable`。
- VS-005 桌面端需 +12s 等待才完成 WebGL 渲染（已在 register 记录等待参数）。
- 交易产品站点未做任何视觉检索（步骤 5 专属，不入本清单）。

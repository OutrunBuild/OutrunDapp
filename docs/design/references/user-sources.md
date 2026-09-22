# 用户来源登记（Stage-01 步骤 2 · 已完成 2026-09-15）

> 状态：已冻结。你确认 inbox 现有 5 文件即全部输入（无新增 URL/附件），并授权使用；观察目标由 Agent 按文件名与步骤 4 八维拆解补齐。
> 记录口径：inbox 5 文件无权属证明，license 记 `reference-only`（不得复制到产品，不得当作产品资产）；`externalToolUpload: allowed`（2026-09-15 你明确授权，可进 v0 研究包）。brand/logo-variants 为 `licensed-for-product` 且 `externalToolUpload: allowed`（同日确认）。

## A. canonical inbox 现有文件（5 个，即全部用户输入）

| source-id | 文件（sourcePath） | 类型 | 字节 | SHA256 | 获取日期（mtime） | 授权 | externalToolUpload | 观察目标 | 保留状态 |
|---|---|---|---|---|---|---|---|---|---|
| USR-INBOX-001 | `docs/design/references/inbox/edgerunner01.png` | image | 911346 | `8499f983…80dafd2` | 2026-08-30 | reference-only | allowed | cyberpunk：霓虹色、暗部层次、人物构图（步骤 4 八维拆解） | retain |
| USR-INBOX-002 | `docs/design/references/inbox/edgerunner02.gif` | image | 90668688 | `527dcd74…3d3251` | 2026-08-30 | reference-only | allowed | cyberpunk：动效氛围、霓虹光源、叙事语汇（步骤 4 八维拆解） | retain |
| USR-INBOX-003 | `docs/design/references/inbox/edgerunners03.png` | image | 51112 | `3ce28792…a0513c` | 2026-08-31 | reference-only | allowed | cyberpunk：配色、构图、材质（步骤 4 八维拆解） | retain |
| USR-INBOX-004 | `docs/design/references/inbox/sythwave01.jpg` | image | 1270071 | `5e8cc6ad…5189b48f` | 2026-09-14 | reference-only | allowed | synthwave：配色、网格/透视、日落意象、氛围（步骤 4 八维拆解） | retain |
| USR-INBOX-005 | `docs/design/references/inbox/sythwave02.jpg` | image | 39682 | `17805afb…88e57d5` | 2026-09-14 | reference-only | allowed | synthwave：配色、字体/字形、材质（步骤 4 八维拆解） | retain |

完整 SHA256：`8499f983…80dafd2`、`527dcd74…3d3251`、`3ce28792…a0513c`、`5e8cc6ad…5189b48f`、`17805afb…88e57d5`（`sha256sum inbox/*` 实测）。禁止事项：reference-only 不得进 `public/`、生产路由/组件，不得当作产品资产；进 v0 包仅作研究对比，不作产品资产。

## B. legacy inbox

- `docs/runbooks/references/inbox/`：不存在（2026-09-15 已验）。无登记项，无移动/删除。

## C. 品牌成品包（`licensed-for-product`，`externalToolUpload` 2026-09-15 你确认：全部 allowed）

| source-id | 路径 | 内容 | license | externalToolUpload（当前值） |
|---|---|---|---|---|
| BRAND-01 | `docs/design/brand/01-primary/`（10 文件） | 双色字标 SVG/透明底/onblack/currentColor + PNG 256–2048 + JPG | licensed-for-product | allowed |
| BRAND-02 | `docs/design/brand/02-reverse/`（7 文件） | 反白 mono-white | licensed-for-product | allowed |
| BRAND-03 | `docs/design/brand/03-mono/`（16 文件） | 单色 black/yellow/magenta/currentColor | licensed-for-product | allowed |
| BRAND-04 | `docs/design/brand/04-symbol/`（22 文件） | OR monogram color/currentColor/themed/mono 四色 + PNG | licensed-for-product | allowed |
| BRAND-05 | `docs/design/brand/05-favicon/`（6 文件） | favicon.svg/ico/apple-touch-icon | licensed-for-product | allowed |
| BRAND-06 | `docs/design/brand/06-app-icon/`（3 文件） | PWA maskable 192/512/1024 | licensed-for-product | allowed |
| BRAND-07 | `docs/design/brand/logo-spec.md` + `README.md` + `preview.html` | 规范/包说明/验收页 | licensed-for-product | allowed |

进入 v0 输入包的位图/矢量只从以上成品包选取，不从 logo-variants 源稿选取。

## D. logo 源稿与管线（产品自有源稿，不进产品，`externalToolUpload` 2026-09-15 你确认：全部 allowed）

| source-id | 路径 | 内容 | license | externalToolUpload（当前值） |
|---|---|---|---|---|
| VAR-01 | `docs/design/logo-variants/ai-renders/`（9 文件） | G10/G29/G30/G31 源稿与字标实验 | licensed-for-product | allowed |
| VAR-02 | `docs/design/logo-variants/or-monogram/concepts/`（1 文件） | OR monogram 概念源稿 | licensed-for-product | allowed |

## E. 用户新增 URL/附件

- 无新增（2026-09-15 你确认：inbox 现有 5 文件即全部输入，无新增 URL/附件）。步骤 3 起按此冻结口径做互联网审美学习补齐。

# 审美学习笔记（Stage-01 步骤 4 · 逐来源八维拆解）

> 证据规则：每条结论引用 `source-id` + 截图文件；`N/A` 按 rubric §3 记录；观察来自步骤 3 实际截图（analyze_image 视觉分析 + 截图本体），不凭模型记忆。
> 八维：色彩/光源、字体/字形、网格/构图、材质/纹理、图像/插画、动效/转场、交互反馈、信息密度。
> 首位拆解对象：`BRAND`（品牌包，rubric §4 认定的 direct-style 用户来源，方向已获用户确认）。

## BRAND — docs/design/brand/（字标 + OR monogram，licensed-for-product）

| 维度 | 观察 | 证据 |
|---|---|---|
| 色彩/光源 | 黄 `#FCEE0A` 字身为唯一主光源；品红 4 档（`#FF06B5→#760F57`）为错位回声而非第二光源；青 `#00F0FF` 仅 symbol 第三层+功能点缀；黑底 `#0A0A10` 不是纯黑，留出层次 | `logo-spec.md` §2/§10；`04-symbol/symbol-color.svg` |
| 字体/字形 | 自有字标：上升斜切、counter 黑 keyline、磨损碎片（T 撕裂/N 碎片）——字形本身携带"信号损坏"叙事 | `01-primary/primary-color.svg`；spec §1 |
| 网格/构图 | 无网格；单字标构图靠斜切角与错位方向制造速度感 | spec §1 |
| 材质/纹理 | CRT 扫描线：竖向周期 ~17px、分区起伏（黄区暗金线/品红区偏粉亮纹）——纹理分色分区，不是全覆盖贴图 | spec §2 CRT 段 |
| 图像/插画 | 无插画；磨损碎片即图像语言（细节级，非画面级） | spec §1 |
| 动效/转场 | N/A（静态资产包；错位回声暗示 glitch 位移方向） | rubric N/A |
| 交互反馈 | N/A（静态资产包） | rubric N/A |
| 信息密度 | 极低（单标志）；但"错位回声"提供可迁移的层级机制：主体+一次偏移副本=强调 | symbol 三级级联错位（+64,+26 / +128,+52） |

**机制提炼**：品牌包已经是一种验证过的 cyberpunk×synthwave 融合——synthwave 的霓虹日落色（黄/品红）+ cyberpunk 的磨损/CRT/黑底，融合靠「单一主光源 + 回声层只做偏移复制 + 纹理分区」。这是步骤 6 融合策略的桥接原理来源（可引用原理，不得照抄画面）。

## VS-001 The Midnight（direct-style · synthwave · themidnightofficial.com）

| 维度 | 观察 | 证据 |
|---|---|---|
| 色彩/光源 | 全屏深蓝紫夜空→地平线暖光渐变；霓虹粉/青做字与描边；光源在地平线，不争夺内容层 | `VS-001-desktop.png`（analyze_image：full-viewport hero，SYNDICATE 专辑落地页） |
| 字体/字形 | 大号几何无衬线展示字 + 细窄长体辅助；字形间距宽松 | `VS-001-desktop.png` |
| 网格/构图 | 单屏 hero 构图：中央视觉主体 + 底部行动区；全页节奏=满屏视觉段与留白段交替 | `VS-001-desktop.png` + `-desktop-full.png` |
| 材质/纹理 | 轻颗粒/光晕；背景摄影与渐变叠合 | `VS-001-desktop.png` |
| 图像/插画 | 专辑键视摄影为主角（do-not-copy：专辑艺术/照片） | `VS-001-desktop-full.png` |
| 动效/转场 | N/A（reduced-motion 捕获；推测存在环境动效，无证据不记录） | rubric N/A |
| 交互反馈 | 导航/商店/演出入口为常规链接层级 | `VS-001-desktop.png` |
| 信息密度 | 低——音乐官网以氛围为主，单屏信息点 ≤5 | `VS-001-desktop.png` |

## VS-002 Cyberpunk 2077 官方站（direct-style · cyberpunk）

| 维度 | 观察 | 证据 |
|---|---|---|
| 色彩/光源 | 近黑底 + 高饱和黄/红局部光；文字用高对比实色（黄字直读，不靠 glow） | `VS-002-desktop.png`（analyze_image：官方站完整渲染，无弹窗遮挡） |
| 字体/字形 | 倾斜/截角显示字系（速度感）；正文常规无衬线 | `VS-002-desktop.png` |
| 网格/构图 | 编辑式分区：大幅键视 + 分块资讯列；构图碎片化、有撕裂/错位排版 | `VS-002-desktop.png` + `-desktop-full.png` |
| 材质/纹理 | 噪点、划痕、做旧磨损广泛使用；边缘不做柔和渐隐 | `VS-002-desktop-full.png` |
| 图像/插画 | 游戏键视艺术（do-not-copy：CDPR 角色/商标/键视） | `VS-002-desktop-full.png` |
| 动效/转场 | N/A（reduced-motion 捕获） | rubric N/A |
| 交互反馈 | 平台选择/语言选择按钮态清晰 | `VS-002-mobile.png`（cookie 关闭后） |
| 信息密度 | 中——营销官网密度，但分块明确 | `VS-002-desktop-full.png` |

## VS-003 Edgerunners 2 官方站（direct-style · cyberpunk/anime）

| 维度 | 观察 | 证据 |
|---|---|---|
| 色彩/光源 | 暗底 + 品红/青双向霓虹，动画饱和度比 VS-002 更高、更粉彩 | `VS-003-desktop.png`（analyze_image：zh-cn 完整渲染） |
| 字体/字形 | 展示字带动画式张力（斜切/拉伸）；中文标题同样保持锐利排印 | `VS-003-desktop.png` |
| 网格/构图 | 大幅视觉段+纵向信息带；中日双语层叠排版有专门设计 | `VS-003-desktop.png` |
| 材质/纹理 | 漫画网点/速度线气质的纹理 | `VS-003-desktop-full.png` |
| 图像/插画 | 动画剧照（do-not-copy） | `VS-003-desktop-full.png` |
| 动效/转场 | N/A（reduced-motion 捕获） | rubric N/A |
| 交互反馈 | 预告片入口/追更入口按钮层级清晰 | `VS-003-mobile.png` |
| 信息密度 | 低-中 | `VS-003-desktop.png` |

## VS-004 Neon Dystopia（direct-style · cyberpunk/editorial）

| 维度 | 观察 | 证据 |
|---|---|---|
| 色彩/光源 | 深底 + 霓虹点缀（链接/强调），正文保持高对比浅色 | `VS-004-desktop.png`（analyze_image：完整渲染） |
| 字体/字形 | 编辑部常规字系为主，标题偶尔用科技感字 | `VS-004-desktop.png` |
| 网格/构图 | WordPress 杂志网格：多列列表+侧栏——**暗底高密度内容的可行证据** | `VS-004-desktop-full.png` |
| 材质/纹理 | 基本平涂；霓虹只在交互色 | `VS-004-desktop.png` |
| 图像/插画 | 文章配图（do-not-copy） | `VS-004-desktop-full.png` |
| 动效/转场 | N/A | rubric N/A |
| 交互反馈 | 常规链接/分类导航 | `VS-004-mobile.png` |
| 信息密度 | **高**——本批唯一证明"暗底+霓虹点缀可以承载列表型高密度内容"的来源 | `VS-004-desktop-full.png` |

## VS-005 Cyberpunk Interactive 3D Desk（web-design-case · cyberpunk）

| 维度 | 观察 | 证据 |
|---|---|---|
| 色彩/光源 | 近黑 `#0A0A1A` 底 + 霓虹粉/青/紫；发光仅作环境光 | `VS-005-mobile.png`（analyze_image：门户页完整渲染） |
| 字体/字形 | 像素/终端字（VT323 气质）做门户字 | `VS-005-mobile.png` |
| 网格/构图 | 门户式落地：移动端卡片+CTA；桌面端 3D 场景即界面 | `VS-005-desktop.png`（+12s 加载后完整渲染） |
| 材质/纹理 | CRT 屏幕材质的界面化再现 | `VS-005-desktop.png` |
| 图像/插画 | 3D 场景（do-not-copy：作者作品画面） | `VS-005-desktop.png` |
| 动效/转场 | 加载计数器→场景的过渡（捕获到 loading 态即状态设计证据） | `VS-005-desktop.png` 捕获过程（query-log） |
| 交互反馈 | 3D 空间导航入口（观察受限：无头交互未执行，标注 partial） | rubric：case 需 ≥2 交互——门户+加载态+场景入口已满足结构观察 |
| 信息密度 | 低（体验型） | `VS-005-mobile.png` |

## VS-006 2bit.chat（web-design-case · retro-terminal）

| 维度 | 观察 | 证据 |
|---|---|---|
| 色彩/光源 | 单色 CRT（近黑底+单一前景色），无霓虹多色 | `VS-006-desktop.png`（analyze_image：完整渲染，1989 视频会议） |
| 字体/字形 | 像素/终端字贯穿全站（含正文）——可读性靠字号与间距补偿 | `VS-006-desktop.png` |
| 网格/构图 | 顶部导航+分屏工作台（预览/控件两栏）——**复古隐喻完整界面化的证据** | `VS-006-desktop.png` |
| 材质/纹理 | CRT 扫描线/CRT 弧面暗示 | `VS-006-desktop.png` |
| 图像/插画 | 无插画；UI 即视觉 | `VS-006-desktop.png` |
| 动效/转场 | N/A（reduced-motion 捕获） | rubric N/A |
| 交互反馈 | 表单/输入/复古控件态（case 结构观察达标） | `VS-006-desktop.png`（awwwards 案例描述佐证） |
| 信息密度 | 中（工具型双栏） | `VS-006-desktop.png` |

## VS-007 FWA Wire（web-design-case · retro-brutalist-terminal）

| 维度 | 观察 | 证据 |
|---|---|---|
| 色彩/光源 | raw 黑白+极少强调色；反霓虹——**去装饰的高对比证据** | `VS-007-desktop.png`（analyze_image：完整渲染，非 Cloudflare 页） |
| 字体/字形 | 终端等宽字为正文——密度与层级全靠字重/缩进/分隔线 | `VS-007-desktop.png` |
| 网格/构图 | 新swire 列表：时间线+条目层级，无卡片 | `VS-007-desktop.png` |
| 材质/纹理 | 平涂 raw UI；无纹理 | `VS-007-desktop.png` |
| 图像/插画 | 无 | `VS-007-desktop.png` |
| 动效/转场 | N/A（reduced-motion 捕获；full 截图被滚动防护阻断） | rubric N/A + register captureNotes |
| 交互反馈 | 列表浏览为主 | `VS-007-mobile.png` |
| 信息密度 | **高**——纯文本列表高密度证据 | `VS-007-desktop.png` |

## 相邻来源（adjacent-style，不计入核验门，仅原则参考）

- USR-INBOX-001~005（inbox 图片/GIF）：cyberpunk 动画截帧与 synthwave 拼贴——只提供氛围词（霓虹雨夜/日落网格），无可迁移界面结构，不单独成结论。

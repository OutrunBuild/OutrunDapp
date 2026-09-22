# OUTRUN Brand Mark — 生产资产规范

源稿：`docs/design/logo-variants/ai-renders/g10-final-black.png`（G10 final, 4096×2304 raster；`01–03` 字标资产）
Symbol 源稿：`docs/design/logo-variants/or-monogram/concepts/symbol_logo.png`（OR monogram, 2048×2048；`04–06` 资产，2026-09-04 替换旧 O 字形 symbol）
交付：`docs/design/brand/`（本目录）· 视觉验收：[preview.html](preview.html)

---

## 1. 标志结构

| 层级 | 资产 | 说明 |
|---|---|---|
| Primary lockup | `01-primary/primary-color.svg` | "OUTRUN" 五色字标：黄色字身 + 品红错位回声（品红主体 + 3 档羽化暗边，见 §2），上升斜切角度，含设计磨损碎片（T 撕裂、N 碎片）与 counter 黑色 keyline |
| Symbol | `04-symbol/symbol-color.svg` | OR 三字母连体 monogram：黄/品红/青为**同一母版形状**三级级联错位（品红层 = 黄层平移 +64,+26 源像素，青层 = 黄层平移 +128,+52 即 2×品红位移；每层带 13px 黑色描边，不透明——浅底禁用三色版，用 mono） |
| 反白 | `02-reverse/mono-white.svg` | 暗底单色白 |
| 单色 | `03-mono/mono-black.svg` · `mono-yellow.svg` | 印刷/浅底/刺绣 |
| 主题化 | `*-currentcolor.svg` | `fill: currentColor`（品红回声层 opacity .4，symbol 青层 .25），随 CSS color 变色 |
| 三色主题化 | `04-symbol/symbol-themed.svg` | 几何与 `symbol-color.svg` 逐字符同形（6 条 d 全等，已验证）；填充 `var(--or-yellow, #fcee0a)` / `var(--or-red, #ff06b5)` / `var(--or-cyan, #00f0ff)`，须内联使用，独立换色，不传变量时回退品牌默认色 |
| Symbol 单色 | `04-symbol/symbol-mono-{white,black,yellow,magenta}.svg`（+128/256/512 PNG） | 双层并集剪影同形四色：白（暗底）/ 黑（浅底印刷）/ 黄（品牌单色）/ 品红 `#FF06B5`（品牌品红单色） |

关键设计特征（字标 `01–03`，已验证保留，矢量化 IoU ±3px = 0.9998）：
- 黄/红交界顶部**无**分隔线（直接相接）
- O/R counter 周围的**黑色 keyline** 为设计意图，在透明底 SVG 中呈现为透明缝隙 —— 在黑底上正确显示为黑色 keyline
- 磨损碎片（T 撕裂 ×1、N 碎片 ×2、T 侧小碎片）全部保留
- raster 源稿中的扫描线/颗粒纹理已按商业矢量惯例**抹平**（纯色填充）

关键设计特征（symbol `04–06`，见 §9）：
- 黄/品红/青为同一母版三级级联错位，每层 13px **不透明黑描边**（深底专用；浅底用 mono）
- 平涂无纹理（CRT 纹理仅 primary 有，见 §2）

## 2. 色彩

| Token | Hex | RGB | 用途 |
|---|---|---|---|
| `--logo-yellow` | `#FCEE0A` | 252 236 10 | 字身（2026-09-14 由 `#FDE52F` 更换，2077 黄，见 §10） |
| `--logo-magenta-bright` | `#FF06B5` | 255 6 181 | 回声主体（色相 318°；S/L 沿用原红档结构，见 §10） |
| `--logo-magenta-high` | `#EE17AE` | 238 23 174 | 羽化第 1 档 |
| `--logo-magenta-mid` | `#B11884` | 177 24 132 | 羽化第 2 档 |
| `--logo-magenta-dark` | `#760F57` | 118 15 87 | 羽化第 3 档（贴黑渐隐） |
| `--or-cyan` | `#00F0FF` | 0 240 255 | 青：symbol 第三回声层 + 功能点缀（链接/动作/focus），禁大面积与两霓虹并排 |
| black ground | `#000000` | 0 0 0 | onblack 变体的烘焙底色 |
| site dark | `#0A0A10` | 10 10 16 | 站点深色底（主色资产可直接放置） |

品红 4 档为原红档的色相整体搬移（→318°，S/L 保留，羽化明暗关系不断；主档与 `#FF06B5` 精确重合），原红档为源图阴影层羽化结构的 **Lloyd-Max 最优量化**（1D k-means on 亮度），
色值取各簇 RGB 均值；分档阈值 [66, 93, 110] 为簇间中点。

**CRT 扫描线纹理**：源图有竖向条纹（周期 ~17 源像素、线宽 ~2.5px），且分区分色、
分区起伏：黄区为暗金线（Δ 偏蓝下降），品红影区为**偏粉的亮纹**（Δ 偏蓝上升），
振幅在各 ~500–800px 区间内在"清晰"与"近乎消失"间波动（若隐若现）。矢量版：
分区 `<pattern>`（黄 `#F9C300`/品红 `#FF2EC1`）+ 重复渐变 `mask`（周期 1600/2000，
按源图实测包络）复现起伏；纹层夹在洋葱层之间（红纹在红壳之上黄层之下），计数器
与 keyline 不受影响。参数为 `build_variants.py` 的 `SCAN` 常量。**应用范围**：
primary 三变体；symbol/mono/favicon/图标为无纹理平涂版。

印刷：黄 ≈ CMYK 0/8/90/0（无专色标定，高保真印刷前打样确认）；单色场景一律用 mono 变体，禁止位图重着色。

## 3. 最小尺寸与净空

| 资产 | Web 最小 | Print 最小 | 净空 |
|---|---|---|---|
| primary wordmark | 宽 96px | 宽 24mm | 四周 ≥ 字高 × 0.5 |
| symbol | 16px（mono）| 8mm | 四周 ≥ symbol 宽 × 0.25 |
| favicon | 16/32 用 mono（48px 起三色可辨） | — | — |

- 字标宽 < 150px 时优先考虑改用 symbol（视觉验证见 preview 的 scale ladder）
- maskable 图标（`06-app-icon/`）内 symbol 已按 80% 安全区圆最大化并光学居中（以黄色字形层为中心），可直接用于 PWA `"purpose": "maskable"`

## 4. 使用规则

**Do**
- 深色底：primary-color（透明底）或 mono-white；symbol 用 `symbol-color.svg`（黑描边与底色融为一体）
- 浅色底：mono-black / mono-yellow / symbol mono 四色（三色 symbol 禁用：不透明黑边在浅底上成黑圈）
- 主题化场景：currentColor 版本（单变量跟随 `color`）或 themed 版本（三变量独立换色）；两者都须内联 SVG，`<img>` 引用下变量/继承进不去，只显示默认色
- Tab/小图标：`favicon.svg`（支持 SVG 的浏览器）+ `favicon.ico` fallback

**Don't**
- 不拉伸变形、不旋转、不加投影/描边/渐变
- 不改变黄/品红/青色值（含透明度混用）
- 不在花哨照片上直接放置（需 ≥40% 暗色蒙层）
- 不把 wordmark 与 symbol 拆开重组出新 lockup

## 5. 接入示例

```html
<!-- Next.js public/ 目录 -->
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
```
```html
<!-- currentColor 主题化（必须内联：<img> 是文档边界，外部 color 继承不进去） -->
<span style="color:#FCEE0A">
  <svg viewBox="0 0 1829 1365"><!-- 04-symbol/symbol-currentcolor.svg 内容 --></svg>
</span>
```
```html
<!-- themed 三变量（同上，须内联） -->
<span style="--or-yellow:#FCEE0A; --or-red:#FF06B5; --or-cyan:#00F0FF;">
  <svg viewBox="0 0 1829 1365"><!-- 04-symbol/symbol-themed.svg 内容 --></svg>
</span>
```

## 6. 生产管线（可复现）

工具链（市场标准，非手绘路径）：

| 步骤 | 工具 | 参数要点 |
|---|---|---|
| 分类去噪 | Python + numpy/scipy | HSV 分类（黄/红/背景），红色按亮度分 4 档；连通域去斑（<400px），黄红交界去饱和光晕桥接（保留暗色 keyline） |
| 分色描摹 | potrace × 5 层（印刷分色法） | 每色调独立二值 mask；turdSize=60, alphaMax=1.0, optTolerance=0.2, fill-rule=evenodd |
| 洋葱壳合成 | Python | 底层=完整剪影（羽化暗档），向上逐层为累积亮区，黄层最上；嵌套曲线无缝且细带不被平滑侵蚀 |
| 单色版 | potrace × 1 | alpha 整体剪影，turdSize=200 |
| 优化 | svgo 4.1 | multipass, preset-default + removeDimensions, 保留 viewBox |
| 栅格化 | resvg (@resvg/resvg-js) | 矢量源直接按目标宽度渲染（非降采样） |
| ICO | Pillow | 16(mono)+32(mono)+48(dual) 多分辨率 |

弃用记录：vtracer 彩色整图描摹因区域均值色偏（±6/通道，亮红被均到 #E51B38）被分色法取代。

管线脚本：`script/logo-vectorize/`（preprocess.py → cleanup.py → extract_symbol.py → vtracer/potrace → build_variants.py → export.mjs；依赖见该目录 package.json 与 venv——`npm i potrace svgo @resvg/resvg-js` + `pip install numpy scipy pillow vtracer`）。已端到端复现验证。同目录的 vectorize.py / export_png.py / verify.py 为被本管线取代的 v1（手搓 cv2 多边形方案，存档）。

**OR monogram 管线**（`04–06`，源稿为 2048 平涂矢量渲染，无需分色/去噪）：`or_monogram_v3.py`（HSV 硬阈值分黄/红/前景 → 黄 mask 扩张 1px 补偿提取内收 → 单母版多边形 cv2 approxPolyDP eps=1.5 → 每层 = 同一 d 的黑描边（stroke-width 22，miter）+ 填充，红层平移 `(+64,+26)` 源像素；位移经 brute-force 验证为唯一最优：红外轮廓与平移黄轮廓 3450/3450 点零距离重合；mono 取双层并集单外轮廓）→ `export_or.mjs`（svgo + resvg：color/currentcolor/themed + mono 白黑黄红 128/256/512 透明底；themed 只优化 SVG、无栅格版——变量未定义时回退值与 color 版逐像素一致；favicon-16/32 由 mono-yellow、48 由双色版渲染；图标黑底光学居中合成，maskable/80% 规则同上；favicon.ico 为手写打包：16 mono + 32 mono + 48 dual 三帧 PNG 压缩——Pillow 12 ICO 插件忽略 append_images）。

**2026-09-14 换色重切**（管线脚本不在库内，本次为 token 置换 + cairosvg 重渲染；原管线 resvg，AA 像素级差异可忽略）：黄 `#FDE52F`→`#FCEE0A`（2077 黄）、黄纹 `#F9B400`→`#F9C300`、红系 4 档 + 红纹 `#FF7A2E`→`#FF2EC1`（色相→318°，S/L 保留）；symbol 加青层（同一母版 d 平移 `(+128,+52)` = 2×品红位移，构造保证同形——剥离青层后与旧版逐字符全等；themed 加 `--or-cyan`，回退渲染与 color 版 512px 逐像素一致 maxdiff 0；currentcolor 青层 opacity .25；favicon.svg/48 改三色版；字标补 `03-mono/mono-magenta.svg`（与 mono-yellow 同形验证），`symbol-mono-red.*` 改名 `symbol-mono-magenta.*`；图标经黄层 bbox 对齐复刻摆位，favicon.ico 照旧手写三帧（16/32 mono + 48 tri）。


## 7. 验证记录（2026-09-02，v2 五色版）

- 形状保真：wordmark IoU 0.9936；覆盖率 0.9998（无孔洞）
- 色彩保真（逐像素 Lab ΔE76，原生 3991px 渲染 vs 源图，剔除 1px 边界混合带）：
  - 黄：mean 3.20 / p50 1.17；亮红：5.06 / 2.74；羽化 3 档：p50 4.15 / 8.52 / 6.66
  - 全前景：mean 3.73 / p50 1.45 / p95 11.76；ΔE>30 仅 2.2%（集中于羽化渐变的量化固有残差）
  - 对照 v1 平涂版：外缘档 ΔE 54.5 → 9.1
- 黄红交界带：3541px 中 0 白像素、0 暗缝（此前视觉审计报告的白线为 QA 拼版 LANCZOS 放大振铃，资产本身无此问题）
- CRT 纹理 v3：周期 17 ✓；黄区条纹 Δ(-1.3,-5.3,-3.7)（源 -0.5,-3,-6.5 方向一致）；红区黄橙亮纹 Δ(-0.9,+4.8,-1.1)（源 +1.5,+8,0 方向一致）；包络强/弱起伏（弱区近零），视觉审计强区/弱区均 PASS
- 视觉审计：4/4 区域 PASS（羽化方向/位置/色值、字形、碎片、斜切面）
- 发丝缝：黄红交界光晕缝已桥接；残留内部透明区均为设计 keyline（100% 暗色像素验证）
- 图标：maskable 安全区半径 ≤1.0；以黄色字形层光学居中
- 小尺寸：16/32px favicon 单色化（视觉对比测试结论），48px 起双色

## 8. 验证记录（2026-09-04，OR monogram v1，已作废）

v1 把红层做成 3 片挤出侧面（`or_monogram.py`，已删），后经逐点轮廓测量证伪——红外轮廓与平移黄轮廓 3450/3450 点零距离重合，红是完整平移复制。现行构造与数据见 §9。

## 9. 验证记录（2026-09-04，OR monogram v3，含黑描边终版）

- 原图结构实测：红外轮廓 = 黄轮廓平移 (+64,+26)，3450/3450 点零距离重合；黑 keyline 宽 10–13px（中位 12，3574 点均匀）；无封闭孔洞；填充色 = token 精确值
- 拆分验证（硬性要求）：红层反平移 (−64,−26) 后与黄层逐像素全等 —— split-IoU **1.00000**，面积 787532px 相等；描边/填充共用同一 d，仅填充色不同
- 像素保真（原生渲染 vs 源图，Y/R/底三分类）：总一致率 **99.53%**（黄 99.92 / 红 95.79 / 底 99.62），残差为 1px 级边缘带
- Keyline：render 缝隙 13px = 源图 13px（逐行实测一致）；参数经 dilate×stroke 二维 sweep 锁定（1px / 22）
- 小尺寸/图标/ICO 规则不变（16/32 mono-yellow、48 tri；ICO 手写三帧）

## 10. 变更记录（2026-09-14，PRIMARY V3 / SYMBOL V4）

- 字标保持双色：黄 `#FCEE0A` + 品红 4 档（`#FF06B5` / `#EE17AE` / `#B11884` / `#760F57`，纹 `#FF2EC1`）；symbol 升三色：加青回声层 `#00F0FF`（+128,+52）
- 青层为**有意偏离源稿**：源稿 OR monogram 只有黄/红两层；§9 源稿保真度量（99.53% 等）仅适用于黄/品红两层，青层像素不计入
- 字标青残影方案（整圈 rim / 单侧 fringe）已否决：笔画密，第三层必糊或显 artifact；青只进 symbol 本体 + glitch 特效版 + 界面功能色（对比实验文件已清理）
- `symbol-mono-red.*` 已改名 `symbol-mono-magenta.*`；`symbol-themed.svg` 现为三变量（`--or-yellow/--or-red/--or-cyan`）
- 决策链：现行红（H 352°）→ 标准洋红（H 300°，偏紫否决）→ 2077 红 `#FF003C`（H 346°，与现行差 6° 不够）→ `#FF06B5`（H 318°，定稿）+ 黄 `#FCEE0A`（vs 品红对比 2.92，全候选最佳）

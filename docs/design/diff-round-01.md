# 差异轮 Round-01（Stage-01 步骤 13 · 2026-09-17）

> 输入：qa-round-00.md 发现 F1–F7（无用户追加反馈）。本轮只修已列差异，不换轴不动方向。

## 本轮关闭的差异项

| # | 严重度 | 关闭判据 | 验证 | 状态 |
|---|---|---|---|---|
| F1 | P2 | disabled 文字对比 ≥4.5:1 | 实测 `#9AA3B5` on `#2A2E3D` = **5.32:1**（改前 4.25:1）；两预览件同步 | **closed** |
| F2 | P2 | product-ux-board 17 img 全有 alt | grep 17/17（描述=内容摘要） | **closed** |
| F3 | P2 | 无死链锚点 | 两预览件 `href="#"` 0；改为 `<button class="linkbtn">` | **closed** |
| F4 | P3 | skip-link + theme-color | 两预览件均已加（`#0A0A10`）；skip 目标 `#main` | **closed**（产品侧为阶段 3 brief 项，已记 F4 双处置） |
| F5 | P3 | moodboard alt 一致性 | 11/11 描述性 alt | **closed** |
| F6 | P3 | 390 表格无溢出 | PositionTable 卡加 `overflow-x:auto`（scrollx），round-01-mobile.png 复核 | **closed** |

## 本轮未关闭项（有意，非遗漏）

| # | 原因 |
|---|---|
| F7 | 字体加载策略（preload/font-display/preconnect）——属阶段 3 实现约束（已入 skill-evidence/qa 的 R 区），静态契约件无法落地，保持 open-transfer |

## 前后证据

- 前：`qa-desktop.png`/`qa-mobile.png`（修复前审计快照）+ qa-round-00.md 实测值
- 后：`round-01-desktop.png`（sha256 `0cc24206…acddda`）/ `round-01-mobile.png`（`e85aac1d…bf1b2`）；重渲染件 token-preview/component-contract-preview/product-ux-board/visual-moodboard PNG 已同步

## 验证命令（可复跑）

```bash
node -e '<对比度计算，F1>'   # → 5.32
grep -c '<img[^>]*alt="' docs/design/references/product-ux-board.html   # → 17
grep -c 'href="#"' docs/design/review/token-preview.html docs/design/review/component-contract-preview.html   # → 0 / 0
grep -c 'skip\|theme-color' docs/design/review/component-contract-preview.html   # ≥2
```

## 结论

本轮关闭 6/7（F1–F6），1 项依规则移交阶段 3。连续两轮零关闭规则不适用（首轮即有效关闭）。四轴选择与审美学习资料零改动（本轮 diff 仅限预览件与证据板的可及性属性）。

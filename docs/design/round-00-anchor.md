# Round-00 起始锚点（Stage-01 步骤 1 产出）

> 唯一架构真相源：`docs/architecture.md`。本文件登记约束与未决项，不含胜者。

## 1. 起始方向

- 用户指定的起始方向：赛博朋克 × synthwave 融合的复古未来主义。
- 两个子风格必须融合为单一和谐系统，禁止拼贴式混用。
- 具体融合配方（主导/从属关系、桥接元素）是步骤 6 方向候选与人工决策的内容，此步不决定。
- 品牌视觉语言（黄/品红错位回声、黑底、CRT 扫描线、磨损碎片）即该方向的既定锚点，与用户起点一致。
- 和谐判据：
  1. 数据层仍是单一系统；
  2. 强调层同源；
  3. 两种子风格元素同框时层级不互抢。
- 明确排除的冲突组合示例：synthwave 粉彩日落渐变与 cyberpunk 做旧磨损等权重混用。

## 2. 可读性红线

1. 价格/收益率/余额使用 tabular numerals。
2. 正文对比度 WCAG AA（正文 ≥4.5:1，大字号 ≥3:1）。
3. 霓虹/发光仅用于强调层，数据层用高对比实色，关 glow 仍可读。
4. 键盘 focus、aria、reduced-motion、错误恢复、中英文溢出按 `DESIGN.md` §4。

## 3. 参考分类

- 视觉审美参考：synthwave/cyberpunk/retro-futurist 网站设计，步骤 3 按 rubric 核实。
- 交易 UX 参考：各 DeFi/LaunchPad 站点，只约束信息密度与流程，禁推导视觉语言，禁入视觉 moodboard。
- 品牌资产 `docs/design/brand/**` 为已定稿事实；`docs/design/logo-variants/**` 为源稿管线，不进产品。

## 4. 四项人工选择（已全部锁定 2026-09-15，decision-log.md 决议 001~004）

1. 风格方向：**D1 暗端信号台**（+去极客修订、双语=locale 切换默认 en）。
2. 主色/强调色延伸：**P2 冷石墨**（表面 #12141B/成功 #35E08E/危险 #FF5468）。
3. 信息密度：**T2 均衡**（行高 44px/正文 14px）。
4. 字标：**brand/ 包唯一基准确认锁定**（红线全过；<150px 用 symbol）。

候选索引存档：`directions/direction-0{1,2,3}.md`、`comparison.html`（决策规格书）。

## 5. 依据

- `docs/architecture.md` §1、§3、§10、§18；`docs/design/brand/logo-spec.md`；`PRODUCT.md` 路由与 OutrunBook 引用。
- Skill：`frontend-design`（SHA256 `1608ea77…b3f45dd`），Node `24.20.0`。未引入 §3 之外新依赖。

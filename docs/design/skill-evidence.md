# Skill 执行证据（Stage-01 步骤 12）

| Skill | 版本/Hash | 执行时间 | 执行方式 | 证据产物 |
|---|---|---|---|---|
| frontend-design | SHA256 `1608ea77fbb6fc30d13a97d12cfa8ebf31358d40f0dd97beed24829d6b3f45dd`（会话开始校验一致） | 2026-09-17 | 全文在会话上下文；用于步骤 6 方向综合与本轮校准检查 | qa-round-00.md §校准检查（三默认判别+三色信号语义论证） |
| impeccable 4.1.2 | 本地 `.agents/skills/impeccable/` | 2026-09-17 | `context.mjs` 于步骤 4 已运行（context 存证 `docs/design/references/impeccable-context.md`，同会话复用不重跑）；本轮读取 `reference/audit.md` + `reference/craft-floor.md`（craft-floor 步骤 4 已读）执行 5 维审计 | qa-round-00.md §审查健康分 17/20 + 发现 F1/F3/F5（craft-floor「depth/zero-offset halo/declare elevation once」对照） |
| web-design-guidelines 1.0.0 | vercel | 2026-09-17 | 读本地 SKILL.md → WebFetch `raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`（成功，17 分类清单入上下文）→ 对 4 个 HTML+tokens.css 逐类检查 | qa-round-00.md §合规快照 + F2/F3/F4/F5/F7 |
| vercel-react-best-practices 1.0.0 | vercel | 2026-09-17 | 读本地 SKILL.md（70 规则 8 类索引）；按 runbook 仅记录实现约束，不声称静态件已测 | qa-round-00.md §阶段 3 实现约束（7 条规则锚定） |

## 可编程实测记录（qa 的量化证据）

- 对比度 node 实测：warning `#F4B74A` on surface 10.27:1 ✓；cyan on surface 13.06:1 ✓；**disabled 4.25:1 ✗（F1）**
- grep 计数：product-ux-board `<img>`17 / `alt`0（F2）；`href="#"` 预览件 1+1（F3）；skip-link 0（F4）
- 截图：`qa-desktop.png`（1440 全页，即审查主体 contract preview 的审计快照）、`qa-mobile.png`（390 全页，F6 依据）

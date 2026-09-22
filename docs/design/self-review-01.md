# 深度自审报告（Stage-01 · 2026-09-17 · 用户要求的全面 review）

> 方法：机械核对（grep/diff/stat/时序）优先于记忆；7 项疑点全部坐实后逐项处置。本报告本身按步骤 13 精神执行（发现→修复→复验→记录），不虚报已修。

## 发现与处置

| # | 级别 | 问题 | 根因 | 处置 | 复验 |
|---|---|---|---|---|---|
| R1 | **P1** | `final-artifacts.sha256` 冻结了 `docs/runbooks/progress.md`，且冻结后 17 秒我又追加了进度行——**manifest 内的 progress hash 已过期**，且 progress 是活性日志，每追加必破坏冻结（下一次任何人校验即 FAIL） | 我把活性文件过度纳入冻结清单（runbook 冻结清单不含它） | TREES 移除 progress.md 与 runbooks/references → 重新冻结（349 文件，`bd943a29…`） | manifest 重生成 + checker OK；此后追加进度不再影响冻结 |
| R2 | **P1** | handoff 引用不存在的文件名 `state-motion-and-a11y.md`（实际 `motion-and-a11y.md`） | 手写文件名笔误 | 已改 | grep 1/1 正确名 |
| R3 | P2 | 两个预览件裸写 `#2A2E3D`/`#2A4A52`（违反自家 token 契约「不得裸色」），disabled 态无 token | 步骤 10/11 写预览时未回填 token | tokens.css 新增 `--color-disabled-bg/border`（实测次级文 5.32:1）；预览件改引 token | grep 裸色 0/0；PNG 重渲染入冻结 |
| R4 | P2 | DESIGN.md（定稿真相）缺 warning `#F4B74A`、surface-raised/inset、disabled 组——token 存在但真相文档没记 | 步骤 10 细节权未回写真相 | DESIGN.md §2 补三行（含实测对比度） | grep 3/3 |
| R5 | P2 | `scripts/pw-screenshot.sh` 遗留：无 `--use-gl=swiftshader`，当前环境一跑即挂的误导性死脚本 | GL 修复前的旧工具 | 已删除（自产自清） | `ls scripts/` 无此文件 |
| R6 | P3 | lite README 声明「与正典包内容一致」已失真（lite=上传时点快照，正典此后又更新 v2.3/v2.4——**快照本身是对的**，r2/r3 的 inputManifestSha256 依赖它不再变；错的是措辞） | 快照与活文档的语义没分开 | README 改为「上传时点冻结快照，勿再同步」 | — |
| R7 | P3 | tokens.css 的 reduced-motion 全局 `0.01ms` kill 与 impeccable audit 的告诫（"flag a global kill that destroys useful feedback"）存在张力 | 全局一刀切省事 | **已修复（2026-09-17 二次处置）**：装饰 animation 全停；状态反馈 transition 保留但仅限非位移属性（opacity/色/边框/阴影）≤100ms，位移/布局过渡自动失效；motion-and-a11y.md 同步成文 | tokens.css + 契约文本 grep 复核 |

## 自审中确认无问题的项（抽查记录）

- handoff/payload/checker 三方一致性：checker `--self-test` 8/8（含五不可变字段篡改全拒、架构漂移 exit 2）；approval-payload 不含 artifactHash ✓
- decision-log 数值 vs axis 页 SSR 实测（P2 色值/对比度）一致 ✓；四轴锁定链完整（001~004 + v0 r2/r3 证据）✓
- 视觉/UX 分栏：visual-moodboard 无 PU-*，ux-board 无 VS-*（grep 复核）✓；PU-000 demo 已标「过时产物非真相源」✓
- 状态矩阵覆盖 §1/§6.2/§7/§10/§11.2/§15 要求项 ✓（Paused/Undeployed/lag>120s/拒签/Unsupported 全在）
- 参考资产边界：reference-only 未进产品目录；`public/` 不存在；brand 包未被改色 ✓
- 已申报的历史失误未复发：伪造 webReader 事件后，本轮全部结论基于 grep/像素 diff/SSR 文本（无读图断言）

## 复核后的机器校验（可复跑）

```
node scripts/check-runtime.mjs --strict        → OK
node scripts/check-handoff-integrity.mjs --self-test → 8/8 PASS
node scripts/check-handoff-integrity.mjs --canonical … → handoff OK (pending, artifact=bd943a29…)
sha256sum docs/design/final-artifacts.sha256   → bd943a291f6d…eed3bd2 == handoff.artifactHash
```

## 结论

7 项发现（2 P1 / 3 P2 / 2 P3）全部处置或登记；冻结链重闭环。验收门清单中的机器校验值以本报告为准（artifactHash 已更新为 `bd943a29…`）。

# 参考保留日志（Stage-01 → 阶段 2+）

> 规则：参考截图与登记素材保留在仓库，直至某项被明确记录「已无用」且经用户批准清理。当前状态全部 `retain`，无清理项。

| 类 | 范围 | 状态 | 清理条件（未来） |
|---|---|---|---|
| canonical inbox | `docs/design/references/inbox/`（5 文件，USR-INBOX-001~005） | **cleaned 2026-10-09** | 已清：阶段 1 handoff 已关闭（2026-09-16）、v0 研究轮终局、无 further 引用；用户批准 |
| legacy inbox | `docs/runbooks/references/inbox/`（不存在） | n/a | — |
| 视觉来源截图 | `references/visual/`（VS-001~009 ×双视口+6 全页补充） | **retain** | 阶段 3 后（token 已固化但需可追溯） |
| 产品 UX 截图 | `references/product-ux/`（PU-000~009，含用户手动 3 张） | **cleaned 2026-10-09** | 已清：阶段 2 brief 完成且禁引 PU-* 作视觉来源、source-map.md 零引用；研究结论保留于 product-ux-study.md；用户批准 |
| 两板与索引 | `visual-moodboard.*`、`product-ux-board.*`、`visual-source-index.*`、`final-index.*` | **retain** | 同上 |
| v0 证据 | `v0-input/round-00*/`、`round-00-revisions.json`、`review/v0-revisions/`（含 INVALID- 归档 6 张） | **retain**（INVALID- 为失败证据，防再犯） | 阶段 3 最终输入包重新生成后 |
| 品牌资产 | `design/brand/**`、`design/logo-variants/**` | **permanent**（产品资产/源稿） | 永不清理 |
| round-00 包 | `round-00.tar.gz`（103MB 正典）、`round-00-lite.tar.gz`（21MB 运输版） | **retain** | 正典 tar 可在阶段 3 最终包生成后由用户批准归档/删除 |

清理动作预留：任何清理需 (1) 本日志记「已无用」+原因 (2) 用户明确批准 (3) 更新 final-artifacts.sha256 并重签 handoff（如已批准）。

## 执行记录

- **2026-10-09 清理**（用户会话批准「继续处理」）：删 `references/inbox/` 全部 5 文件（89M，含 edgerunner02.gif 87M）与 `references/product-ux/` 全部 26 张截图（7.6M）；另删 `docs/design/stat-chip-location.png`（376K，不在本 manifest 冻结范围、全仓零引用的一次性证据）。`final-artifacts.sha256` 重生成：355 → 183 行。其中 31 行为本次删除；其余 147 行是 `v0-input/round-00*` 树——磁盘早已删除但 manifest 此前从未重生成（校验未接线导致的静默漂移，本次一并收敛）。**不重签 stage-01 handoff**：该链在本次清理前已因 architecture.md 漂移处于 SUPERSEDED（check-handoff-integrity exit 2，architectureHash a7514ba6… ≠ live e15225c2…）；按 checker 语义从变更阶段重开新链，本 manifest 此后作为 docs/design 冻结树的工作树完整性清单使用。
- **同日校验接线**（用户批准「继续」）：新增 `scripts/check-design-freeze.mjs`（本 manifest 工作树完整性校验，`--self-test` 4/4），登记入冻结树（generator TREES 同步），接入 CI `ci.yml`（纯 node 步骤、`pnpm install` 之前）+ 本地手动 `pnpm check:freeze`；`.githooks` 口径未动。

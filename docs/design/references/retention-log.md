# 参考保留日志（Stage-01 → 阶段 2+）

> 规则：参考截图与登记素材保留在仓库，直至某项被明确记录「已无用」且经用户批准清理。当前状态全部 `retain`，无清理项。

| 类 | 范围 | 状态 | 清理条件（未来） |
|---|---|---|---|
| canonical inbox | `docs/design/references/inbox/`（5 文件，USR-INBOX-001~005） | **retain** | 阶段 1 handoff 后如无 further 引用，经用户批准 |
| legacy inbox | `docs/runbooks/references/inbox/`（不存在） | n/a | — |
| 视觉来源截图 | `references/visual/`（VS-001~009 ×双视口+6 全页补充） | **retain** | 阶段 3 后（token 已固化但需可追溯） |
| 产品 UX 截图 | `references/product-ux/`（PU-000~009，含用户手动 3 张） | **retain** | 阶段 2 页面 brief 完成后评估 |
| 两板与索引 | `visual-moodboard.*`、`product-ux-board.*`、`visual-source-index.*`、`final-index.*` | **retain** | 同上 |
| v0 证据 | `v0-input/round-00*/`、`round-00-revisions.json`、`review/v0-revisions/`（含 INVALID- 归档 6 张） | **retain**（INVALID- 为失败证据，防再犯） | 阶段 3 最终输入包重新生成后 |
| 品牌资产 | `design/brand/**`、`design/logo-variants/**` | **permanent**（产品资产/源稿） | 永不清理 |
| round-00 包 | `round-00.tar.gz`（103MB 正典）、`round-00-lite.tar.gz`（21MB 运输版） | **retain** | 正典 tar 可在阶段 3 最终包生成后由用户批准归档/删除 |

清理动作预留：任何清理需 (1) 本日志记「已无用」+原因 (2) 用户明确批准 (3) 更新 final-artifacts.sha256 并重签 handoff（如已批准）。

# Stage-01 Handoff（v1.1.0 重签）— 设计系统与风格锚定 → 阶段 2（页面 brief 与 fixture）

> 本文件审批块之外的内容为证据索引，可在后续阶段追加；审批块内 immutable 字段 Agent 写入后不可变，人工只改 `status`/`signer`/`signedAt`。

## v1.1.0 重签说明（为什么需要重新签字）

- v1.0.0（approved，2026-09-16T18:57:46Z，artifactHash `de774877…`）已按 architecture §19 规则判 **superseded**：用户于 2026-09-17 开启架构修订窗口（决议 006）——① OutStake 基线推进 `73c9b163…` → `731541109f…`（diff 仅 harness/测试，spec 事实无差异）；② §2 默认 locale `/zh` → `/en`（决议 001-B 落地）。architecture hash `286474bd…` → `a331dc7f…`。
- **设计系统产物自 v1.0.0 批准以来零内容变化**：DESIGN.md、PRODUCT.md、tokens.css、三个契约、9 视觉来源、complexity-map、v0 修订链、QA/差异轮记录均未改动。本版相对 v1.0.0 的冻结差异仅为簿记：decision-log 增决议 006、approval-payload 换 architectureHash/版本号、stage-02-inputs 两处过时备注更新（locale 挂起项标记完成）、bootstrap-pnpm.mjs 增 `--check-only` 模式、manifest 重出。
- v1.0.0 原件字节保全：`docs/design/archive/stage-01-handoff-v1.0.0-approved.md`（sha256 `c2fed036…`）。
- 重签范围：仅需核对上述架构修订与簿记差异；无需重验设计系统内容。

## 交付总览

| 项 | 状态 | 路径 |
|---|---|---|
| 设计真相（定稿） | ✅（同 v1.0.0） | `DESIGN.md`（D1 暗端信号台·去极客修订 / P2 / T2 / 字标锁定） |
| 产品真相骨架 | ✅（同 v1.0.0） | `PRODUCT.md`（11 路由 / 单语切换默认 en / 全状态 / fixture 边界） |
| 人工决策链 | ✅ 口头已锁，签名=本审批 | `docs/design/decision-log.md` 决议 001~**006**（006=架构修订窗口授权） |
| 设计 token + 契约 | ✅（同 v1.0.0） | `components/design-system/tokens.css` + `token-contract.md` |
| 组件契约 / 状态矩阵 / 动效 a11y | ✅（同 v1.0.0） | `components/design-system/{component-contract,motion-and-a11y}.md` |
| 审美学习（独立可核实） | ✅（同 v1.0.0） | `references/aesthetic-learning.md`（9 来源八维）、`aesthetic-principles.md` |
| 来源登记与核验门 | ✅（同 v1.0.0） | `references/source-register.json`、`source-eligibility-rubric.md`、`query-log.md` |
| 视觉 / 交易 UX 分栏 | ✅（同 v1.0.0） | `references/visual-moodboard.html` ↔ `references/product-ux-board.html` |
| 信息复杂度地图 | ✅（同 v1.0.0） | `references/complexity-map.md`（+4 条冲突附注） |
| v0 研究轮交接 | ✅（同 v1.0.0） | `v0-input/round-00(-lite)/`、`round-00-revisions.json`（hash 链深 3） |
| 质量审查 / 差异轮 | ✅（同 v1.0.0） | `qa-round-00.md` + `skill-evidence.md` + `diff-round-01.md`（F1–F6 关闭） |
| 阶段 2 输入 | ✅（locale 挂起项已清） | `stage-02-inputs.md` |

## 已知非阻断事项

- **决议 005（用户裁定）**：阶段 1 全部界面片段（POL 工作台等）不代表实际产品 UI/UX（仅视觉设计参考）——阶段 2 brief 从 architecture+OutrunBook+complexity-map 重新推导，勿抄片段版面
- **决议 006（2026-09-17）**：架构修订窗口（OutStake 基线推进 + 默认 locale `/en`）——见 architecture §21 与 decision-log；本 handoff v1.1.0 即其审批证据重签
- F7（字体 preload/font-display/preconnect）→ 阶段 3 实现约束（qa-round-00.md R 区）
- v0 无稳定 revision ID → `revision-identity-unavailable`，以部署 URL+chatId 记录（r2/r3）

## 运行时冻结

阶段 2 步骤 1 已建最小工具链（`outrun-dapp`，private；typescript7@7.0.2 + typescript6 alias + vitest 4.1.11 + vite 8.2.2 + prettier 3.9.6 + zod 4.5.4 + @types/node 24.13.3，engines/packageManager 契约写入；package/lockfile/workspace 由阶段 2 持有，阶段 3 按 bootstrap contract 增量添加）；根控制件冻结同 v1.0.0（`.node-version` 24.20.0、`.prettierrc.json`、`.prettierignore`、`scripts/{check-runtime,bootstrap-pnpm}.mjs`；`check-runtime --strict` 实测 OK）。

## 审批块

> 授权记录：用户于会话中明确指令「授权通过」（2026-09-16T19:31Z，针对 v1.1.0 重签），由 Agent 据此转录签字三字段；immutable 字段未动。v1.0.0→v1.1.0 差异见上方「v1.1.0 重签说明」。

```json
{
  "status": "approved",
  "scope": "stage-01-design-system-style-anchor",
  "artifactVersion": "1.1.0",
  "architectureHash": "a331dc7f1632dc2621e2d3d7be1eff48e2a3053748f6035ff4b9bc8175ff227f",
  "artifactHash": "62aacb4714db3c2aaeefc6fce6cba3c6093661b8bdc44a39be667a598432df4d",
  "blockingIssues": [],
  "signer": "Jasonrale",
  "signedAt": "2026-09-16T19:31:39Z"
}
```

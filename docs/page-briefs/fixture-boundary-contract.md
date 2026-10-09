# Fixture Boundary Contract — 生产/原型数据隔离契约

> 任何导出物/新代码必须原样通过同一检查器，不得另写兼容规则。

## 唯一合法 import 图

```
fixtures/**  →  lib/data/fixture-repository.ts  →  components/**（ui/design-system 通用层除外）| fixtures/inspector/** | tests/**
```

- `lib/data/fixture-repository.ts` 是 fixtures 的**唯一**消费方（哨兵 `OUTRUN_FIXTURE_ONLY_v1` 随 `fixtures/index.ts` 导出）。
- 生产目录 `app/`、`features/`、`entities/`、`components/`（含 ui/design-system 通用层）、`lib/`（fixture-repository 除外）**禁止**直接 import、re-export、或经 import 图间接到达 `fixtures/**`。
- 生产 resolver（`lib/data/source-resolver.ts` + `lib/data/repository.ts`）禁含字面量：`fixture-repository`、`OUTRUN_FIXTURE_ONLY_v1`、`scenario`；生产数据源只返回真实 repository 或结构化 unavailable（`undeployed|rpc-error|not-configured`），**永不回退原型数据**。
- 三层共用基础类型（`FixtureChain`/`Locale`/`VerseStage`）声明于 `lib/data/types.ts`——零依赖叶子（禁止 import `fixtures/**` 与 `fixture-repository`），`fixture-repository` re-export 维持既有消费方；通用层与 `lib/**` 需要这些类型必须引 `types`（`design-system/showcase` 与 `lib/locale` 亦不例外，禁止越界引桥取类型）。
- 非字面量动态 `import()`/`require()`（动态 source resolver）在生产目录视为违规。

## 检查器与模式

`scripts/check-fixture-boundary.mjs`：

| 模式 | 检查 | 时机 |
|---|---|---|
| `--source` | 静态 import 扫描（含 export-from/require/import()/路径别名/未解析目标）+ resolver 禁词 | 每阶段门 + CI |
| `--graph production` | 生产入口传递闭包不可达 fixtures | 同上 |
| `--bundle <dir>` | 产物扫描 `OUTRUN_FIXTURE_ONLY_v1` 哨兵（补充层）；`<dir>=.next` 时正向枚举生产子目录（server/static/standalone），dev 缓存（`.next/dev`）不扫——合法消费方在 dev 编译无 tree-shake 会留哨兵，属假警且 dev 产物不分发（单测含双向对照） | 生产构建后（`.next` 存在时执行；目录不存在或无生产子目录时输出「接口已定义」） |
| `--self-test` | 临时副本注入直接导入/re-export/动态 resolver/引号开头拼接动态/别名直连 fixtures/别名桥消费方六类违规→必须全部以非零退出+文件行号→自动清理（source+graph 双模式同跑） | 每次变更门+CI |

当前行为（以代码与单测为准）：`resolveSpec` 按 tsconfig paths 解析 `@/` 别名（别名形态的桥消费方/直连 fixtures/graph 遍历均在拦截范围）；不支持形态别名（精确键/多目标）fail-closed 落 `unresolved-import` 注记；引号开头拼接动态 `import('../x' + y)` 落 `dynamic-source-resolver`；两参 import attributes（`import('./x', { with: … })`）按静态可解析放行；违规注记按 `file|line|kind|detail` 去重。已知边界：魔法注释 `import(/* c */ './x')` 仍按动态注记；`require.resolve('…')` 不纳入判定（运行时路径解析、不进 import 图；bundle 哨兵层兜底内容泄漏），本仓零触发。单测 `tests/unit/fixtures/boundary.test.ts` 全绿。

## 当前 allowlist

- 消费方白名单：`components/**`（`ui/`、`design-system/` 通用层除外）、`fixtures/inspector/**`、`tests/**`、`lib/data/fixture-repository.ts`——豁免口径=「components 全体减通用层」（域组件禁直接引 fixtures，检查器 `PROD_DIR_RE` 与消费方正则同步）。三层共用基础类型源：`lib/data/types.ts`（零依赖叶子，非 fixture 消费方，任何层可引）。
- 生产 resolver 禁词清单见上；新增豁免须重新登记本契约（不得放宽到整个 app/features/lib）。

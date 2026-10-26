# Fixture Boundary Contract — onchain/fixture 数据隔离契约

> 任何导出物/新代码必须原样通过同一检查器，不得另写兼容规则。

## 唯一合法 import 图

```
fixtures/**  →  lib/data/fixture-repository.ts  →  components/**（ui/design-system 通用层除外）| fixtures/inspector/** | tests/**
```

- `lib/data/fixture-repository.ts` 是 fixtures 的**唯一**消费方（哨兵 `OUTRUN_FIXTURE_ONLY_v1` 随 `fixtures/index.ts` 导出）。
- 核心源码目录 `app/`、`features/`、`entities/`、`components/`（含 ui/design-system 通用层）、`lib/`（fixture-repository 除外）**禁止**直接 import、re-export、或经 import 图间接到达 `fixtures/**`。
- onchain resolver（`lib/data/source-resolver.ts` + `lib/data/repository.ts`）禁含字面量：`fixture-repository`、`OUTRUN_FIXTURE_ONLY_v1`、`scenario`；onchain 数据源只返回真实 repository 或结构化 unavailable（`undeployed|rpc-error|not-configured`），**永不回退原型数据**。
- 三层共用基础类型（`FixtureChain`/`Locale`/`VerseStage`）声明于 `lib/data/types.ts`——零依赖叶子（禁止 import `fixtures/**` 与 `fixture-repository`），`fixture-repository` re-export 维持既有消费方；通用层与 `lib/**` 需要这些类型必须引 `types`（`design-system/showcase` 与 `lib/locale` 亦不例外，禁止越界引桥取类型）。
- 非字面量动态 `import()`/`require()`（动态 source resolver）在核心源码目录视为违规。

## 检查器与模式

`scripts/check-fixture-boundary.mjs`：

| 模式 | 检查 | 时机 |
|---|---|---|
| `--source` | 静态 import 扫描（含 export-from/require/import()/路径别名/未解析目标）+ resolver 禁词 | 每阶段门 + CI |
| `--graph onchain` | 核心源码树入口传递闭包不可达 fixtures | 同上 |
| `--bundle <dir>` | 产物扫描 `OUTRUN_FIXTURE_ONLY_v1` 哨兵（补充层）；`<dir>=.next` 时正向枚举生产子目录（server/static/standalone），dev 缓存（`.next/dev`）不扫——合法消费方在 dev 编译无 tree-shake 会留哨兵，属假警且 dev 产物不分发（单测含双向对照） | 生产构建后（`.next` 存在时执行；目录不存在或无生产子目录时输出「接口已定义」） |
| `--self-test` | 临时副本注入直接导入/re-export/动态 resolver/引号开头拼接动态/别名直连 fixtures/别名桥消费方六类违规→必须全部以非零退出+文件行号→自动清理（source+graph 双模式同跑） | 每次变更门+CI |

当前行为（以代码与单测为准）：`resolveSpec` 按 tsconfig paths 解析 `@/` 别名（别名形态的桥消费方/直连 fixtures/graph 遍历均在拦截范围）；不支持形态别名（精确键/多目标）fail-closed 落 `unresolved-import` 注记；引号开头拼接动态 `import('../x' + y)` 落 `dynamic-source-resolver`；两参 import attributes（`import('./x', { with: … })`）按静态可解析放行；违规注记按 `file|line|kind|detail` 去重。已知边界：魔法注释 `import(/* c */ './x')` 仍按动态注记；`require.resolve('…')` 不纳入判定（运行时路径解析、不进 import 图；bundle 哨兵层兜底内容泄漏），本仓零触发。单测 `tests/unit/fixtures/boundary.test.ts` 全绿。

## OUTRUN_DATA_SOURCE 数据源开关语义（2026-10-14 登记，阶段 5 步骤 1；同日用户裁定值名=onchain）

- **取值**：`onchain` → 真数据路径（`lib/data/source-resolver.ts` → RPC/Graph repository）；未设置或 `fixture` → 原型 fixture 路径（默认：本地原型、e2e、视觉基线）。其他取值一律按 fixture 语义——仅与 `'onchain'` 精确匹配走真数据（先例：`lib/prototype/scenario.ts` 的 `=== 'onchain'` 判定）。命名语义：该开关只表达**数据源维度**（链上真数据 vs 原型 fixture），不表达环境维度（主网/测试网）——测试网真数据同为 `onchain`；曾拟名 `production` 因与主网生产环境语义混淆被否（2026-10-14 用户裁定）。
- **定格时机**：构建期（build-time pin）。两模式 = 两次构建；同一构建产物内 fixture/真实双路径静态共存即违规（本契约禁核心源码目录动态 resolver、禁 onchain 图到达 `fixtures/**` 的直接推论）。对已构建产物在运行期改此变量不改变其数据路径；运行期读取仅继续守卫非数据面（如 scenario 参数解析，见 `scripts/check-scenario-boundary.mjs` 头注）。
- **选择点**：`lib/data/source-resolver.ts` 是真数据路径的唯一选择点——onchain 构建的数据消费只经它取得真实 repository（真实数据或结构化 unavailable，永不回退 fixture）；原型模式沿用本契约的 fixture-repository 合法桥（components 直连，不经 source-resolver）。
- **接线纪律**：消费图因切换接线变化时同步更新本契约登记，不得放宽任何豁免；onchain 构建必须过 `--graph onchain` 与 `--bundle` 两层。
- **切换实现登记（2026-10-15，阶段 5 步骤 7）**：onchain 构建经 `next.config.ts` 构建期 resolveAlias（turbopack+webpack 双配置，仅 `OUTRUN_DATA_SOURCE=onchain` 时激活）把 `@/lib/data/fixture-repository` 精确重定向到 `lib/data/onchain-source.ts`。适配器以 **type-only** 引 fixture-repository 的共享 ViewModel 形状（运行时值零引用——单测锁死），运行时同名导出面由 `lib/data/repository.ts`（RPC）+ `lib/data/graph/graph-repository.ts`（Graph）实现；无链上来源的字段按 null/空态纪律降级（faucet 冷却 null 不渲染=2026-10-14 裁定）。页面侧消费点 async 化并 `await` getter——fixture 模式下 await 同步值，渲染与基线逐字节一致。

## 当前 allowlist

- 消费方白名单：`components/**`（`ui/`、`design-system/` 通用层除外）、`fixtures/inspector/**`、`tests/**`、`lib/data/fixture-repository.ts`——豁免口径=「components 全体减通用层」（域组件禁直接引 fixtures，检查器 `CORE_DIR_RE` 与消费方正则同步）。三层共用基础类型源：`lib/data/types.ts`（零依赖叶子，非 fixture 消费方，任何层可引）。
- onchain resolver 禁词清单见上；新增豁免须重新登记本契约（不得放宽到整个 app/features/lib）。

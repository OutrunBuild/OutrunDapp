# Fixtures — 原型与测试专用数据（阶段 2 步骤 9）

## 用途与边界

- 仅用于原型渲染与测试（`fixtures/inspector/`、`components/**`（ui/design-system 通用层除外）经 `lib/data/fixture-repository.ts`）。
- **禁止生产导入**：唯一合法入口 `fixtures/index.ts`（导出带 `OUTRUN_FIXTURE_ONLY_v1` 哨兵）；生产代码路径见 `docs/page-briefs/fixture-boundary-contract.md` 与 `scripts/check-fixture-boundary.mjs`。
- 所有地址 `fixtureOnly: true`，不冒充任何部署地址；部署地址只来自 `deployments/{chainId}.json`（阶段 4–6）。

## 规则

- 数值域分治：`amount={raw,decimals}`、`rate={raw,unit:bps|ppm|ratio,scale}`、`nonce`/`blockNumber`=非负整数字符串、时间=固定 UTC ISO、ID=前缀-整数。
- 确定性：禁 `Math.random()`/`Date.now()`/运行时随机 UUID；一切派生自 `data/seed.json`（时间锚 2026-09-16T12:00:00Z）。
- PRNG 派别登记：mulberry32 核心一致，seed 派生分两派——murmur 式（`1779033703`/`3432918353`，10 处 `scripts/gen-*.mjs` 价格与派生字段）与 FNV-1a（`2166136261`/`16777619`，`scripts/gen-candle-volumes.mjs` 与 `lib/data/fixture-repository.ts` `extendHourlyHistory`）。两派输出流不兼容：统一抽取 canonical PRNG 前，禁止改动任一实现的派生算法；统一属独立任务，须全量重生成 fixture 并重冻结 manifest。
- 链集限 architecture §5 测试网集 chainId（421614/84532/97；schema 与 data 同步）。
- 每条记录带 `sourceRef`（仓库相对路径+章节锚：`docs/architecture.md#…` 或 `docs/page-briefs/source-map.md#M/S…`）。
- 语义约束在 `invariants/`（amounts/lifecycle/cross-chain/state-scenarios），machine-checkable 子集由 `tests/unit/fixtures/schema.test.ts` 断言。
- 重建 manifest：`rtk node scripts/write-fixture-manifest.mjs`（确定性输出，见下）；完整性由 `rtk node scripts/check-fixture-manifest.mjs` 双向对账（`pnpm test` 内）；manifest 自身条目 hash 固定为 `"self"`，不递归。

## 查看

```
rtk node scripts/serve-fixture-inspector.mjs --root fixtures --port 4174
# 打开 http://127.0.0.1:4174/ 切换场景（normal/Empty/Paused/Index lag/…）
```

## 保留/清理

- 冻结前全部保留（阶段 2 验收基准的一部分）；阶段 3 起仅按 freeze-v1 变更流程增删。

## manifest 重建

```
rtk node scripts/write-fixture-manifest.mjs   # 确定性输出；重复运行字节一致
rtk node scripts/check-fixture-manifest.mjs   # 双向对账；不一致即非零退出
```

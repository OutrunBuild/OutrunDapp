# 代码风格与注释纪律

从根 `AGENTS.md` §6 拆出的完整细则；红线速览（`any` 禁令等）仍留在 `AGENTS.md` §6。规则进本篇的两条准入线（满足其一）：抽象 Good/Bad 示例自证，或直接命名禁区。

## 风格

每条规则以抽象 Good/Bad 示例自证，不引用仓库现有代码当正反例——行号与「现存违规」会随修复过期，规范文档必须常青；已知违规的迁移是独立代码任务，不登记在规范里。

函数与控制流：函数单职责、喜 `const` + 早返、避 `else` 与重赋值；不为单次使用提前抽 helper；单用一次的中间变量直接内联。

```ts
// Good — 三元 + 早返
const fee = tier === 'vip' ? 0 : rate;
if (rows.length === 0) return null;
return rows.map(toRow);

// Bad — let 重赋值 + else
let fee;
if (tier === 'vip') {
  fee = 0;
} else {
  fee = rate;
}
```

校验只做一次、放在边界：已由 schema / 类型 / 构造保证的值不再做 `typeof` / 属性存在性二次防御。集合变换默认 `map` / `filter` / `flatMap`（`filter` 接类型守卫 `(x): x is T` 保住下游推断），累积建 Map / 遍历迭代器才用 `for-of`。

复杂函数 happy-path 在上、命名 helper 沉底（只在 helper 命名了真概念时才抽，如 `requireConfig`）：

```ts
// Good — 主函数读作 happy path，校验沉底
export function loadThing(input: unknown) {
  return createThing(requireConfig(input));
}
function requireConfig(input: unknown) {
  /* 校验只在此一次 */
}
```

类型：依赖推断，只为导出与澄清写显式标注。外部 JSON 一律 zod 解码，禁 `JSON.parse(text) as T`：

```ts
// Good — schema 解码，失败拿到结构化错误
const parsed = rowSchema.safeParse(JSON.parse(text));
if (!parsed.success) return fallback;
return parsed.data;

// Bad — 断言掩掉形状错误，坏数据直贯下游
const row = JSON.parse(text) as Row;
```

import 路径照 `docs/design-system/agent-workflow.md` §2（components 之间相对，`ui` 与 `lib` 走 `@/` 别名，`app`→components 走别名），不另起写法。细则：

- `as` 别名只许 `ui/*` 的 `X as XPrimitive`（shadcn base-ui 惯用）与同文件真撞名，其余用原名。
- 禁内联 `import('…')` 类型引用。
- 重模块动态 `import()` 收在用它的分支内，绑定当普通 import 读：

```ts
// Good — 分支内取绑定，读作普通 import
if (needsChart) {
  const { createChart } = await import('lightweight-charts');
  createChart(el);
}

// Bad — .then() 链把控制流埋进回调
import('lightweight-charts').then((mod) => mod.createChart(el));
```

为极小概率 race / 安全 edge 加复杂度前，先写清 failure mode + 概率 + 成本并征得同意，不默默扩大范围。

`any` 默认禁止：唯一豁免是 viem 适配层（`lib/web3/viem-rpc-port.ts` 的 `readContract` / `multicall` 泛型边界），须带 `eslint-disable-next-line @typescript-eslint/no-explicit-any` 并在注释写清 why。`try/catch` 只做错误到值的转换（如 probe），不做流程控制。

## 注释纪律

代码注释只写就地原因与约束（why / 不这样做会怎样），不引用 `decision-log` 的决议编号、日期或「ruling / 决议」字样——注释必须脱离外部文档独立读懂，出处归 `decision-log.md`，决策变了改注释而不改引用。链上观测、SDK 版本、基准值这类经验事实可以带日期；会话轮次（round N）、「用户裁定」之类叙事一律不进注释。

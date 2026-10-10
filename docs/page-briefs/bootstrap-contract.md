# Bootstrap Contract — 工作区与脚手架所有权

> 违反本契约的任何脚手架/依赖操作 = 变更门阻断。

## 1. 所有权与规则

| 文件/职责 | 规则 |
|---|---|
| `package.json`（`outrun-dapp`，private，engines `node 24.x`/`pnpm 11.24.0`，`packageManager: pnpm@11.24.0`） | **只允许增量添加** architecture §3 已锁版本的依赖；发现 §3 之外依赖即停止并报告 |
| `pnpm-workspace.yaml`（`packages: ['.', 'vendor/typescript-bridge']`；override `@typescript/old: npm:typescript@6.0.2`；`allowBuilds` 构建脚本白名单） | 不得创建第二套 alias/override 规则 |
| `pnpm-lock.yaml`（sha256 见 `docs/page-briefs/pnpm-lock.sha256`） | 依赖增量后必须重新运行 `rtk node scripts/write-file-hash.mjs --input pnpm-lock.yaml --output docs/page-briefs/pnpm-lock.sha256`（防篡改守卫会拒绝静默覆盖） |
| 双编译器断言 | `test "$(rtk pnpm exec tsc --version)" = "Version 7.0.2"`；`test "$(rtk node -p "require('typescript').version")" = "6.0.2"`；任何依赖变更后复跑两条断言 |
| `.node-version`(24.20.0) / `.prettierrc.json` / `.prettierignore` / `scripts/check-runtime.mjs` / `scripts/bootstrap-pnpm.mjs`（Vercel installCommand，含 `--check-only` 模式） | 不改语义；`check-runtime --strict` 每次变更门复跑 |

## 2. 锁定工具链（全部精确版本，禁 caret/range；下列为契约断言对象、非全集——全集以 architecture §3 与 package.json 为准）

devDependencies：`typescript7@npm:typescript@7.0.2`、`typescript@npm:@typescript/typescript6@6.0.2`、`vitest@4.1.11`、`vite@8.2.2`、`prettier@3.9.6`、`@types/node@24.13.3`；dependencies：`zod@4.5.4`。

## 3. 脚手架红线

1. 本仓库**已有非空 package.json** → **禁止**运行 `create-next-app`（或任何全量脚手架）；应用骨架按 architecture §4 目录手工增量搭建。
2. 导入/搬运代码必须过 `scripts/check-fixture-boundary.mjs` 与 `scripts/check-architecture-compliance.mjs`（不得另写兼容规则）。
3. 生产分支只返回真实数据 repository 或结构化 unavailable 状态，**永不回退到 fixture**（步骤 10 的 resolver 强制）。

## 4. Git

本目录已纳入版本控制（.gitignore 不再排除）。合约仓（Memeverse/OutStake）只读，不得切换/合并/修改（基线推进必须经用户授权 + architecture §21 记录）。

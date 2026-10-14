#!/usr/bin/env node
// check-architecture-compliance.mjs —— §3 版本/运行时 allowlist、§4 目录、RSC/Client 边界、
// fixture 数据源（阶段 2 步骤 10 建立；阶段 3 检查 v0/create-next-app 导出物必须复用本检查器）。
// 基础阶段（无 app/）允许 deferred-to-stage-3，不把缺失应用代码误报为通过。
import { readFileSync, existsSync } from 'node:fs';
import { exit } from 'node:process';

const problems = [];
const deferred = [];

// 1) §3 版本 allowlist（精确版本，禁 caret/range）
// typescript 允许两种形态：直锁 npm:@typescript/typescript6@6.0.2，
// 或双编译器桥 link:./vendor/typescript-bridge（2026-09-19 迁移：Next 16.3.3
// useTypeScriptCli 要求 typescript 包内 bin/tsc；桥内 API=TS6.0.2/CLI=TS7.0.2，
// 由 §1b 逐项校验桥契约）。
const ALLOWLIST = {
  devDependencies: {
    typescript7: '7.0.2', // alias: npm:typescript@7.0.2
    vitest: '4.1.11',
    vite: '8.2.2',
    prettier: '3.9.6',
    '@types/node': '24.13.3',
    // §3 全集（阶段 3 步骤 2 落地，2026-09-19）
    '@playwright/test': '1.62.1',
    '@axe-core/playwright': '4.13.0',
    '@tailwindcss/postcss': '4.3.3',
    '@testing-library/dom': '10.4.1',
    '@testing-library/react': '16.3.3',
    '@types/react': '19.2.18',
    '@types/react-dom': '19.2.5',
    eslint: '10.9.1',
    jsdom: '30.0.1',
    postcss: '8.5.26',
    tailwindcss: '4.3.3',
    'typescript-eslint': '8.68.0',
    // web3 索引 CLI（§3 全集，阶段 4 步骤 10 落地）
    '@graphprotocol/graph-cli': '0.98.1',
  },
  dependencies: {
    zod: '4.5.4',
    // §3 全集
    next: '16.3.3',
    react: '19.2.8',
    'react-dom': '19.2.8',
    'lucide-react': '1.37.0',
    '@tanstack/react-query': '5.102.8',
    // shadcn/ui 4.19.0 生态运行时件（§3 批准的组件体系依赖）
    '@base-ui/react': '1.5.0',
    'class-variance-authority': '0.7.1',
    clsx: '2.1.1',
    'tailwind-merge': '3.3.1',
    'tw-animate-css': '1.4.0',
    'lightweight-charts': '5.2.1',
    // web3 运行时（§3 全集，阶段 4 步骤 10 落地；viem 精确 2.55.10 = @privy-io/wagmi 4.0.16 精确 peer）
    wagmi: '3.7.7',
    viem: '2.55.10',
    '@privy-io/react-auth': '3.38.0',
    '@privy-io/wagmi': '4.0.16',
    '@sentry/nextjs': '10.72.0',
  },
};
if (existsSync('package.json')) {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const tsActual = (pkg.devDependencies ?? {}).typescript;
  const tsBridge = tsActual === 'link:./vendor/typescript-bridge';
  if (!tsBridge) ALLOWLIST.devDependencies.typescript = '6.0.2'; // 直锁形态走 allowlist
  for (const [section, table] of Object.entries(ALLOWLIST)) {
    const deps = pkg[section] ?? {};
    for (const [name, expected] of Object.entries(table)) {
      const actual = deps[name];
      if (!actual) problems.push(`§3 ${section}.${name} 缺失（期望 ${expected}）`);
      else if (!actual.includes(expected))
        problems.push(`§3 ${section}.${name}=${actual} 未锁 ${expected}`);
      else if (/[\^~]| \||\*/.test(actual.replace(/npm:[^@]+@/, '')))
        problems.push(`§3 ${section}.${name}=${actual} 含范围符号`);
    }
    for (const name of Object.keys(deps)) {
      if (!table[name] && !(section === 'devDependencies' && name === 'typescript' && tsBridge))
        problems.push(`§3 之外依赖：${section}.${name}（不在 allowlist，需先过架构变更）`);
    }
  }
  // §1b 双编译器桥契约（仅当 typescript=link 桥形态）
  if (tsBridge) {
    try {
      const bridge = JSON.parse(readFileSync('vendor/typescript-bridge/package.json', 'utf8'));
      const bd = bridge.dependencies ?? {};
      if (bridge.version !== '6.0.2') problems.push(`桥包 version=${bridge.version} != 6.0.2`);
      if (bd['@typescript/typescript6'] !== 'npm:@typescript/typescript6@6.0.2')
        problems.push('桥包 API 依赖不是 @typescript/typescript6@6.0.2');
      if (bd.typescript7 !== 'npm:typescript@7.0.2')
        problems.push('桥包 CLI 依赖不是 typescript@7.0.2');
      if (bridge.bin?.tsc !== 'bin/tsc') problems.push('桥包缺 bin.tsc');
      const api = readFileSync('vendor/typescript-bridge/lib/typescript.js', 'utf8');
      if (!api.includes('@typescript/typescript6')) problems.push('桥包 API 未转发 TS6');
    } catch {
      problems.push('桥包 vendor/typescript-bridge 不完整（package.json/lib/typescript.js）');
    }
  }
  const e = pkg.engines ?? {};
  if (e.node !== '24.x') problems.push(`engines.node=${e.node} != 24.x`);
  if (e.pnpm !== '11.24.0') problems.push(`engines.pnpm=${e.pnpm} != 11.24.0`);
  if (pkg.packageManager !== 'pnpm@11.24.0')
    problems.push(`packageManager=${pkg.packageManager} != pnpm@11.24.0`);
} else problems.push('package.json 缺失');

// 2) §12 workspace 契约
if (existsSync('pnpm-workspace.yaml')) {
  const ws = readFileSync('pnpm-workspace.yaml', 'utf8');
  if (!/packages:\s*\n\s*-\s*'\.'/.test(ws) && !ws.includes("packages: ['.']"))
    problems.push("pnpm-workspace.yaml 缺根 package（packages: ['.']）");
  if (!ws.includes("'@typescript/old': npm:typescript@6.0.2"))
    problems.push('pnpm-workspace.yaml 缺 override @typescript/old -> npm:typescript@6.0.2');
} else problems.push('pnpm-workspace.yaml 缺失');
if (existsSync('.node-version')) {
  const v = readFileSync('.node-version', 'utf8').trim();
  if (v !== '24.20.0') problems.push(`.node-version=${v} != 24.20.0`);
} else problems.push('.node-version 缺失');

// 3) §4 目录与 RSC/Client 边界 + fixture 数据源
if (!existsSync('app')) {
  deferred.push(
    '§4 RSC/Client 边界与目录结构：app/ 尚未创建（deferred-to-stage-3，v0 导出物落地时按 docs/prototype/architecture-compliance.md 检查）',
  );
} else {
  deferred.push('app/ 已存在：阶段 3 首轮运行完整 RSC/Client 扫描（本检查器扩展点）');
}
deferred.push(
  'fixture 数据源运行时证明：随阶段 3 原型页落地，由 check-fixture-boundary --source/--graph/--bundle 三层强制',
);

console.log('architecture compliance ' + (problems.length ? 'FAIL' : 'OK'));
for (const p of problems) console.error(' -', p);
for (const d of deferred) console.log(' [deferred-to-stage-3]', d);
if (problems.length) exit(1);

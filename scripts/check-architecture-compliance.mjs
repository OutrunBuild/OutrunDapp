#!/usr/bin/env node
// check-architecture-compliance.mjs -- implemented checks: the version/runtime allowlist, the
// workspace contract and engines (v0/create-next-app exports reuse this checker).
// Directory layout and the RSC/Client boundary are advisory extension points (not scanned here);
// fixture isolation is enforced by scripts/check-fixture-boundary.mjs. Deferred advisories are
// printed so missing app code is not misreported as a pass.
// 4) click-path budget (docs/engineering/performance.md): every write dialog must resolve its verse session
// through the shared prefetch cache; importing the raw resolver in a component is where the
// per-click verse-tuple read came from, so it is rejected here instead of found by hand later.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { exit } from 'node:process';

const problems = [];
const deferred = [];

// 1) version allowlist (exact versions; caret/ranges forbidden)
// typescript allows two forms: a direct pin to npm:@typescript/typescript6@6.0.2,
// or the dual-compiler bridge link:./vendor/typescript-bridge (Next 16.4.3 useTypeScriptCli
// requires bin/tsc inside the typescript package; bridge API=TS6.0.2/CLI=TS7.0.2).
const ALLOWLIST = {
  devDependencies: {
    typescript7: '7.0.2', // alias: npm:typescript@7.0.2
    vitest: '4.1.11',
    vite: '8.2.2',
    prettier: '3.9.6',
    '@types/node': '24.13.3',
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
    // web3 indexing CLIs
    '@graphprotocol/graph-cli': '0.98.1',
  },
  dependencies: {
    zod: '4.6.7',
    next: '16.4.3',
    react: '19.2.8',
    'react-dom': '19.2.8',
    'lucide-react': '1.37.0',
    '@tanstack/react-query': '5.102.8',
    // shadcn/ui 4.19.0 ecosystem runtime pieces (dependencies of the component system)
    '@base-ui/react': '1.5.0',
    'class-variance-authority': '0.7.1',
    clsx: '2.1.1',
    'tailwind-merge': '3.3.1',
    'tw-animate-css': '1.4.0',
    'lightweight-charts': '5.2.1',
    // web3 runtime (viem exact 2.55.10 = exact peer of @privy-io/wagmi 4.0.16)
    wagmi: '3.7.7',
    viem: '2.55.10',
    '@privy-io/react-auth': '3.38.0',
    '@privy-io/wagmi': '4.0.16',
    '@sentry/nextjs': '10.76.2',
  },
};
if (existsSync('package.json')) {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const tsActual = (pkg.devDependencies ?? {}).typescript;
  const tsBridge = tsActual === 'link:./vendor/typescript-bridge';
  if (!tsBridge) ALLOWLIST.devDependencies.typescript = '6.0.2'; // direct-pin form goes through the allowlist
  for (const [section, table] of Object.entries(ALLOWLIST)) {
    const deps = pkg[section] ?? {};
    for (const [name, expected] of Object.entries(table)) {
      const actual = deps[name];
      // npm: aliases (typescript7 / direct-pin typescript) encode the exact version after the
      // alias specifier; strip it so the pin check compares versions instead of substrings.
      const pinned = actual?.startsWith('npm:')
        ? actual.slice(actual.lastIndexOf('@') + 1)
        : actual;
      if (!actual)
        problems.push(`the version allowlist: ${section}.${name} missing (expected ${expected})`);
      else if (pinned !== expected)
        problems.push(
          `the version allowlist: ${section}.${name}=${actual} not pinned to ${expected}`,
        );
    }
    for (const name of Object.keys(deps)) {
      if (!table[name] && !(section === 'devDependencies' && name === 'typescript' && tsBridge))
        problems.push(
          `dependency outside the version allowlist: ${section}.${name} (not in the allowlist; requires an architecture change first)`,
        );
    }
  }
  // dual-compiler bridge contract (only when typescript is the link: bridge form)
  if (tsBridge) {
    try {
      const bridge = JSON.parse(readFileSync('vendor/typescript-bridge/package.json', 'utf8'));
      const bd = bridge.dependencies ?? {};
      if (bridge.version !== '6.0.2')
        problems.push(`bridge package version=${bridge.version} != 6.0.2`);
      if (bd['@typescript/typescript6'] !== 'npm:@typescript/typescript6@6.0.2')
        problems.push('bridge package API dependency is not @typescript/typescript6@6.0.2');
      if (bd.typescript7 !== 'npm:typescript@7.0.2')
        problems.push('bridge package CLI dependency is not typescript@7.0.2');
      if (bridge.bin?.tsc !== 'bin/tsc') problems.push('bridge package missing bin.tsc');
      const api = readFileSync('vendor/typescript-bridge/lib/typescript.js', 'utf8');
      if (!api.includes('@typescript/typescript6'))
        problems.push('bridge package API does not re-export TS6');
    } catch {
      problems.push(
        'bridge package vendor/typescript-bridge incomplete (package.json/lib/typescript.js)',
      );
    }
  }
  const e = pkg.engines ?? {};
  if (e.node !== '24.x') problems.push(`engines.node=${e.node} != 24.x`);
  if (e.pnpm !== '11.24.0') problems.push(`engines.pnpm=${e.pnpm} != 11.24.0`);
  if (pkg.packageManager !== 'pnpm@11.24.0')
    problems.push(`packageManager=${pkg.packageManager} != pnpm@11.24.0`);
} else problems.push('package.json missing');

// 2) workspace contract
if (existsSync('pnpm-workspace.yaml')) {
  const ws = readFileSync('pnpm-workspace.yaml', 'utf8');
  if (!/packages:\s*\n\s*-\s*'\.'/.test(ws) && !ws.includes("packages: ['.']"))
    problems.push("pnpm-workspace.yaml missing the root package (packages: ['.'])");
  if (!ws.includes("'@typescript/old': npm:typescript@6.0.2"))
    problems.push('pnpm-workspace.yaml missing override @typescript/old -> npm:typescript@6.0.2');
} else problems.push('pnpm-workspace.yaml missing');
if (existsSync('.node-version')) {
  const v = readFileSync('.node-version', 'utf8').trim();
  if (v !== '24.20.0') problems.push(`.node-version=${v} != 24.20.0`);
} else problems.push('.node-version missing');

// 3) directories and RSC/Client boundary + fixture data sources
if (!existsSync('app')) {
  deferred.push(
    'RSC/Client boundary and directory layout advisory: app/ not created yet (deferred; check against docs/prototype/architecture-compliance.md when the v0 export lands)',
  );
} else {
  deferred.push(
    'app/ exists: this checker does not scan the RSC/Client boundary (extension point); no automated RSC/Client gate is wired up',
  );
}
deferred.push(
  'fixture data source runtime proof: enforced by the check-fixture-boundary --source/--graph/--bundle layers',
);

// 4) click-path budget: components resolve write sessions only through write-session.ts
if (existsSync('components')) {
  // the definition layer (execution-reads) and the cache that wraps it (write-session)
  const ALLOWED = new Set([
    'components/global/execution-reads.ts',
    'components/global/write-session.ts',
  ]);
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return walk(path);
      return /\.(?:tsx?|js)$/.test(entry.name) ? [path] : [];
    });
  for (const file of walk('components')) {
    if (ALLOWED.has(file)) continue;
    const source = readFileSync(file, 'utf8');
    if (source.includes('resolveVerseSession')) {
      problems.push(
        `${file}: resolves a verse session directly — use getVerseSession/prefetchVerseSession from components/global/write-session.ts (click-path budget)`,
      );
    }
  }
}

console.log('architecture compliance ' + (problems.length ? 'FAIL' : 'OK'));
for (const p of problems) console.error(' -', p);
for (const d of deferred) console.log(' [deferred]', d);
if (problems.length) exit(1);

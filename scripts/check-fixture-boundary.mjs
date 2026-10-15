#!/usr/bin/env node
// check-fixture-boundary.mjs -- fixture/onchain isolation check
// Usage:
//   node scripts/check-fixture-boundary.mjs --source        static import scan (core source dirs
//     must not import fixtures directly/indirectly)
//   node scripts/check-fixture-boundary.mjs --graph onchain  walk the import graph from core-tree
//     entries; reaching fixtures/** is forbidden
//   node scripts/check-fixture-boundary.mjs --bundle <dir>      artifact scan (OUTRUN_FIXTURE_ONLY_v1
//     sentinel; run after an onchain-mode build)
//     When <dir>=.next only production-build subdirs are enumerated (server/static/standalone); the dev
//     cache (.next/dev) reaches the sentinel via the legitimate path (fixture-repository -> fixtures)
//     without tree-shaking, so scanning it = false alarm, and dev artifacts are not shipped with
//     deployments
//   node scripts/check-fixture-boundary.mjs --self-test         inject six violation kinds into a
//     temp copy -> all must be caught -> auto cleanup
//   (a forbidden-token scan of lib/data/source-resolver.ts and lib/data/repository.ts always runs,
//     with or without flags)
// The only legal import graph: fixtures/** -> lib/data/fixture-repository.ts -> components/**
// (ui/design-system common layers exempt) or fixtures/inspector/**
import {
  readdirSync,
  readFileSync,
  statSync,
  existsSync,
  cpSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from 'node:fs';
import { join, dirname, resolve, extname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { argv, exit } from 'node:process';

const args = new Set(argv.slice(2));
const ROOT = argv.includes('--root') ? argv[argv.indexOf('--root') + 1] : process.cwd();

// components no longer exempts any subdirectory: domain components (verse/home/…) and the common
// layer are all barred from importing fixtures directly; the only legal consumer of fixtures is
// lib/data/fixture-repository.ts itself
const CORE_DIR_RE = /^(app|features|entities|components|lib(?!\/data\/fixture-repository))\//;
const FIXTURE_RE = /^fixtures(\/|$)/;
const JS_EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

const violations = [];
const note = (file, line, kind, detail) => violations.push({ file, line, kind, detail });

function* walkJs(dir) {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walkJs(p);
    else if (JS_EXT.includes(extname(e.name))) yield p;
  }
}

// tsconfig paths prefix aliases (the script must resolve path aliases). Only the
// "prefix/* -> single target prefix/*" form is supported; other forms (exact keys, multi-target) go
// into UNSUPPORTED_ALIAS -- resolveSpec records an unresolved note for hits instead of silently
// passing them as external packages (path aliases that cannot be statically resolved are
// violations). Fallback @/ -> ROOT when tsconfig is missing or unparsable (the --self-test temp copy
// only copies scripts/ and fixtures/)
const ALIAS_PREFIXES = [];
const UNSUPPORTED_ALIAS = [];
{
  const entries = [];
  const tsconfigPath = join(ROOT, 'tsconfig.json');
  if (existsSync(tsconfigPath)) {
    try {
      entries.push(
        ...Object.entries(
          JSON.parse(readFileSync(tsconfigPath, 'utf8')).compilerOptions?.paths ?? {},
        ),
      );
    } catch {
      /* JSONC and other parse failures -> fall through to the fallback below */
    }
  }
  for (const [from, tos] of entries) {
    if (from.endsWith('/*') && tos.length === 1 && tos[0].endsWith('/*'))
      ALIAS_PREFIXES.push([from.slice(0, -1), tos[0].slice(0, -1)]); // '@/*': ['./*'] -> ['@/', './']
    else UNSUPPORTED_ALIAS.push(from.endsWith('/*') ? from.slice(0, -2) : from);
  }
  // Once tsconfig declares @/* (in any form, supported or not), the fallback does not apply --
  // otherwise the fallback would short-circuit that key's fail-closed note
  if (!ALIAS_PREFIXES.some(([from]) => from === '@/') && !UNSUPPORTED_ALIAS.some((a) => a === '@'))
    ALIAS_PREFIXES.push(['@/', './']);
}

// Resolve relative paths and tsconfig aliases uniformly (including omitted extensions and index);
// always compute absolute paths first, then normalize to ROOT-relative; unresolvable aliases also
// get an unresolved note, never silently passed
function resolveSpec(fromAbs, spec) {
  let base;
  if (spec.startsWith('.') || spec.startsWith('/')) base = resolve(dirname(fromAbs), spec);
  else {
    const hit = ALIAS_PREFIXES.find(([from]) => spec.startsWith(from));
    if (!hit) {
      // Alias declared in tsconfig but in a form this script cannot resolve: fail-closed note,
      // not passed as an external package
      if (UNSUPPORTED_ALIAS.some((a) => spec === a || spec.startsWith(a + '/')))
        return { unresolved: true, target: spec };
      return { external: true };
    }
    base = resolve(ROOT, hit[1] + spec.slice(hit[0].length));
  }
  const cands = [
    base,
    ...JS_EXT.map((x) => base + x),
    ...JS_EXT.map((x) => join(base, 'index' + x)),
  ];
  for (const c of cands) {
    if (existsSync(c) && statSync(c).isFile()) return { target: toRel(c) };
  }
  return { unresolved: true, target: spec };
}
const toRel = (abs) =>
  abs.startsWith(ROOT + '/') || abs.startsWith(ROOT + '\\')
    ? abs.slice(ROOT.length + 1).replaceAll('\\', '/')
    : abs.replaceAll('\\', '/');

// static import shapes (including export-from / require / dynamic import())
const IMPORT_RES = [
  /\bimport\s+[^'"]*?from\s*['"]([^'"]+)['"]/g,
  /\bexport\s+[^'"]*?from\s*['"]([^'"]+)['"]/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*(?:,|\))/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*(?:,|\))/g,
  /\bimport\s*['"]([^'"]+)['"]/g,
];
// dynamic import()/require (including quote-first forms -- concatenated shapes like import('../x' + y)
// must also be judged; importsOf strips the literal)
const DYNAMIC_IMPORT_RE = /\b(?:import|require)\s*\(\s*[^)]+?\)/g;

function importsOf(file) {
  const src = readFileSync(file, 'utf8');
  const rel = toRel(file);
  const specs = [];
  for (const re of IMPORT_RES) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) specs.push({ spec: m[1], line: lineOf(src, m.index) });
  }
  for (const re of [DYNAMIC_IMPORT_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) {
      const inner = m[0]
        .replace(/^.*?\(/, '')
        .replace(/\)$/, '')
        .trim();
      // A literal immediately followed by end or , (the two-arg import attributes form) = statically
      // resolvable, captured as a spec by IMPORT_RES; other shapes (concatenation/variables) are
      // treated as dynamic source resolvers
      if (!/^['"][^'"]*['"]\s*($|,)/.test(inner))
        note(
          rel,
          lineOf(src, m.index),
          'dynamic-source-resolver',
          `non-literal dynamic import/require: ${inner.slice(0, 60)} (dynamic source resolvers forbidden in core source directories)`,
        );
    }
  }
  return specs.map(({ spec, line }) => ({ ...resolveSpec(file, spec), line }));
}
function lineOf(src, idx) {
  return src.slice(0, idx).split('\n').length;
}

function isCore(rel) {
  return CORE_DIR_RE.test(rel);
}

function sourceScan() {
  const files = [
    ...walkJs(join(ROOT, 'app')),
    ...walkJs(join(ROOT, 'features')),
    ...walkJs(join(ROOT, 'entities')),
    ...walkJs(join(ROOT, 'components')),
    ...walkJs(join(ROOT, 'lib')),
  ];
  for (const f of files) {
    const rel = toRel(f);
    const imports = importsOf(f); // shared single call: the dynamic-source violation notes live in the
    // function body; repeated calls would duplicate them
    for (const im of imports) {
      if (im.unresolved)
        note(rel, im.line, 'unresolved-import', `cannot resolve statically: ${im.target}`);
      if (im.target && FIXTURE_RE.test(im.target) && isCore(rel)) {
        note(
          rel,
          im.line,
          'direct-fixture-import',
          `core source file imports a fixture directly: ${im.target}`,
        );
      }
    }
    // fixture-repository may only be referenced by components/** (ui/design-system common layers
    // exempt), fixtures/**, tests/**
    if (rel === 'lib/data/fixture-repository.ts') continue;
    for (const im of imports) {
      if (
        im.target === 'lib/data/fixture-repository.ts' &&
        !/^(components\/(?!ui\/|design-system\/)|fixtures\/|tests\/)/.test(rel)
      ) {
        note(
          rel,
          im.line,
          'illegal-bridge-consumer',
          `illegal fixture-repository consumer: only components/** (ui/design-system excepted), fixtures/**, and tests/** may reference it`,
        );
      }
    }
  }
}

function graphScan() {
  // transitive closure from the core-tree roots; reaching fixtures/** is forbidden
  const entryDirs = ['app', 'features', 'entities', 'components', 'lib'].map((d) => join(ROOT, d));
  const seen = new Set();
  const stack = [];
  for (const d of entryDirs) for (const f of walkJs(d)) stack.push(f);
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    const rel = toRel(f);
    for (const im of importsOf(f)) {
      if (!im.target || im.external) continue;
      if (FIXTURE_RE.test(im.target)) {
        if (isCore(rel))
          note(
            rel,
            im.line,
            'graph-reaches-fixture',
            `import graph reaches a fixture: ${im.target}`,
          );
        continue;
      }
      const t = join(ROOT, im.target);
      if (existsSync(t) && statSync(t).isFile()) stack.push(t);
    }
  }
}

/** Deployable production output subdirs in the Next build directory (positive enumeration;
 *  cache/dev/diagnostics/types are dev and intermediate artifacts, not shipped) */
const PROD_BUNDLE_SUBDIRS = ['server', 'static', 'standalone'];

// whether the bundle scan actually ran (early exits for missing dir / no artifact subdirs do not
// count) -- report()'s summary line labels this truthfully
let bundleScanExecuted = false;

function bundleScan(dir) {
  if (!existsSync(dir)) {
    console.log(`--bundle ${dir}: directory does not exist -- run after an onchain-mode build`);
    return;
  }
  // `.next` scans only production-build subdirs: the dev server compile cache (.next/dev/**) has no
  // tree-shaking, and the legitimate consumer fixture-repository leaves the sentinel in dev SSR
  // chunks -- that is the allowed import graph, not a leak.
  // Non-`.next` custom artifact directories keep the full scan (original interface semantics unchanged).
  const roots =
    basename(dir) === '.next'
      ? PROD_BUNDLE_SUBDIRS.map((d) => join(dir, d)).filter(existsSync)
      : [dir];
  if (basename(dir) === '.next' && roots.length === 0) {
    console.log(
      `--bundle ${dir}: no production artifact subdirs found (server/static/standalone) -- run after an onchain-mode build`,
    );
    return;
  }
  bundleScanExecuted = true;
  for (const root of roots) {
    for (const f of walkJs(root)) {
      const src = readFileSync(f, 'utf8');
      if (src.includes('OUTRUN_FIXTURE_ONLY_v1')) {
        note(
          f.startsWith(ROOT) ? f.slice(ROOT.length + 1) : f,
          1,
          'bundle-sentinel',
          'artifact contains the fixture sentinel',
        );
      }
    }
  }
}

function resolverTokenScan() {
  // reject fixture-repository / scenario selector / sentinel constants appearing in
  // the onchain resolvers
  const TOKENS = ['fixture-repository', 'OUTRUN_FIXTURE_ONLY_v1', 'scenario'];
  for (const f of ['lib/data/source-resolver.ts', 'lib/data/repository.ts']) {
    const abs = join(ROOT, f);
    if (!existsSync(abs)) continue;
    const src = readFileSync(abs, 'utf8');
    src.split('\n').forEach((line, i) => {
      for (const t of TOKENS)
        if (line.includes(t))
          note(
            f,
            i + 1,
            'onchain-resolver-token',
            `onchain resolver contains a forbidden token: ${t}`,
          );
    });
  }
}

function runAll() {
  if (args.has('--source')) sourceScan();
  if (args.has('--graph')) graphScan();
  resolverTokenScan();
  const b = argv.indexOf('--bundle');
  if (b !== -1) bundleScan(resolve(ROOT, argv[b + 1]));
}

function report() {
  // dedupe: --source/--graph each call importsOf once per process; the in-function dynamic notes
  // would otherwise appear in pairs
  const unique = [
    ...new Map(violations.map((v) => [`${v.file}|${v.line}|${v.kind}|${v.detail}`, v])).values(),
  ];
  if (unique.length) {
    console.error(`fixture boundary FAIL: ${unique.length} violation(s)`);
    for (const v of unique) console.error(` - [${v.kind}] ${v.file}:${v.line} ${v.detail}`);
    exit(1);
  }
  const bundleSuffix = argv.includes('--bundle')
    ? bundleScanExecuted
      ? ' (bundle scan executed)'
      : ' (bundle scan not executed)'
    : '';
  // the OK line enumerates only what this invocation actually ran (the resolver token scan always
  // runs); the bundle layer keeps its own executed/not-executed suffix
  const scanned = [
    ...(args.has('--source') ? ['no direct-import violations'] : []),
    ...(args.has('--graph') ? ['no indirect-reach violations'] : []),
    'no forbidden resolver tokens',
  ];
  console.log(`fixture boundary OK: ${scanned.join(', ')}` + bundleSuffix);
}

async function selfTest() {
  // temp copy injects six violation kinds (direct import / path alias / re-export / dynamic
  // resolver / quote-first concatenated dynamic resolver / alias bridge consumer) -> all caught ->
  // cleanup
  const tmp = mkdtempSync(join(tmpdir(), 'fx-boundary-'));
  try {
    for (const d of ['scripts']) cpSync(join(ROOT, d), join(tmp, d), { recursive: true });
    cpSync(join(ROOT, 'fixtures'), join(tmp, 'fixtures'), { recursive: true }); // so imports resolve to real fixture targets
    mkdirSync(join(tmp, 'app'), { recursive: true });
    mkdirSync(join(tmp, 'lib/data'), { recursive: true });
    writeFileSync(join(tmp, 'app/direct.ts'), `import { fixtureData } from '../fixtures/index';\n`);
    writeFileSync(
      join(tmp, 'app/reexport.ts'),
      `export { fixtureData } from '../fixtures/index';\n`,
    );
    writeFileSync(
      join(tmp, 'app/dynamic.ts'),
      `const src = '../fixtures/index';\nconst m = await import(src);\n`,
    );
    writeFileSync(join(tmp, 'lib/data/repository.ts'), `export const repo = 'onchain';\n`);
    writeFileSync(join(tmp, 'lib/data/fixture-repository.ts'), `export const bridge = 1;\n`); // resolution target for the alias-bridge consumer case
    const { execFileSync } = await import('node:child_process');
    // [filename, expected violation tag] -- re-export shares the tag with direct/alias imports (all
    // direct-fixture-import); dynamic source gets its own tag; alias-bridge locks in the
    // illegal-bridge-consumer interception after '@/' normalization
    const cases = [
      ['direct', 'direct-fixture-import', `import { fixtureData } from '../fixtures/index';\n`],
      ['alias', 'direct-fixture-import', `import { fixtureData } from '@/fixtures/index';\n`],
      ['reexport', 'direct-fixture-import', `export { fixtureData } from '../fixtures/index';\n`],
      [
        'dynamic',
        'dynamic-source-resolver',
        `const src = '../fixtures/index';\nconst m = await import(src);\n`,
      ],
      [
        'dynamic-concat',
        'dynamic-source-resolver',
        `const m = await import('../fixtures' + '/index');\n`,
      ],
      [
        'alias-bridge',
        'illegal-bridge-consumer',
        `import type { Locale } from '@/lib/data/fixture-repository';\n`,
      ],
    ];
    const results = [];
    for (const [kind, tag] of cases) {
      for (const [k, , inject] of cases) {
        writeFileSync(join(tmp, 'app', `${k}.ts`), k === kind ? inject : 'export const ok = 1;\n');
      }
      try {
        execFileSync(
          process.argv[0],
          [
            join(tmp, 'scripts/check-fixture-boundary.mjs'),
            '--root',
            tmp,
            '--source',
            '--graph',
            'onchain',
          ],
          { stdio: 'pipe' },
        );
        results.push(`${kind}: not intercepted (FAIL)`);
      } catch (e) {
        const out = String(e.stdout ?? '') + String(e.stderr ?? '');
        const m = out.match(new RegExp(`\\[${tag}\\] (app/${kind}\\.ts):(\\d+)`));
        results.push(
          m
            ? `${kind}: intercepted [${tag}] ${m[1]}:${m[2]} ✓`
            : `${kind}: intercepted but tag/location missing (${out
                .split('\n')
                .filter((l) => l.includes(' - '))
                .slice(0, 2)
                .join(' | ')})`,
        );
      }
    }
    console.log(results.join('\n'));
    const ok = results.every((r) => r.includes('✓'));
    if (!ok) exit(1);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    console.log('self-test temp copy cleaned up');
  }
}

if (args.has('--self-test')) {
  await selfTest();
  exit(0);
}
runAll();
report();

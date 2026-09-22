#!/usr/bin/env node
// check-fixture-boundary.mjs — fixture/生产隔离检查（阶段 2 步骤 10）
// 用法：
//   node scripts/check-fixture-boundary.mjs --source            静态 import 扫描（生产目录禁直接/间接引 fixture）
//   node scripts/check-fixture-boundary.mjs --graph production  从生产入口走 import 图，禁止到达 fixtures/**
//   node scripts/check-fixture-boundary.mjs --bundle <dir>      产物扫描（OUTRUN_FIXTURE_ONLY_v1 哨兵；阶段 3 构建后）
//   node scripts/check-fixture-boundary.mjs --self-test         临时副本注入三类违规→必须三杀→自动清理
// 唯一合法 import 图：fixtures/** → lib/data/prototype-repository.ts → components/prototype/** 或 fixtures/inspector/**
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
import { join, dirname, resolve, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { argv, exit } from 'node:process';

const args = new Set(argv.slice(2));
const ROOT = argv.includes('--root') ? argv[argv.indexOf('--root') + 1] : process.cwd();

const PROD_DIR_RE =
  /^(app|features|entities|components(?!\/prototype)|lib(?!\/data\/prototype-repository))\//;
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

// 相对路径解析（含省略扩展名与 index）；一律以绝对路径计算再归一为 ROOT 相对；路径别名视为不可解析动态源
function resolveSpec(fromAbs, spec) {
  if (!spec.startsWith('.') && !spec.startsWith('/')) {
    if (spec.startsWith('@/')) return { alias: true, target: spec };
    return { external: true };
  }
  const base = resolve(dirname(fromAbs), spec);
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

// 静态 import 形状（含 export-from / require / 动态 import()）
const IMPORT_RES = [
  /\bimport\s+[^'"]*?from\s*['"]([^'"]+)['"]/g,
  /\bexport\s+[^'"]*?from\s*['"]([^'"]+)['"]/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\bimport\s*['"]([^'"]+)['"]/g,
];
// 动态（非字面量）import()/require：source resolver 嫌疑
const DYNAMIC_IMPORT_RE = /\b(?:import|require)\s*\(\s*[^'"\s][^)]*?\)/g;

function importsOf(file) {
  const src = readFileSync(file, 'utf8');
  const rel = toRel(file);
  const lines = src.split('\n');
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
      if (!/^['"]/.test(inner))
        note(
          rel,
          lineOf(src, m.index),
          'dynamic-source-resolver',
          `非字面量动态 import/require：${inner.slice(0, 60)}（生产目录禁止动态 source resolver）`,
        );
    }
  }
  return specs.map(({ spec, line }) => ({ ...resolveSpec(file, spec), line }));
}
function lineOf(src, idx) {
  return src.slice(0, idx).split('\n').length;
}

function isProd(rel) {
  return PROD_DIR_RE.test(rel);
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
    for (const im of importsOf(f)) {
      if (im.unresolved) note(rel, im.line, 'unresolved-import', `无法静态解析：${im.target}`);
      if (im.target && FIXTURE_RE.test(im.target) && isProd(rel)) {
        note(rel, im.line, 'direct-fixture-import', `生产文件直接导入 fixture：${im.target}`);
      }
    }
    // prototype-repository 只允许被 components/prototype/**、fixtures/**、tests/** 引用
    if (rel === 'lib/data/prototype-repository.ts') continue;
    for (const im of importsOf(f)) {
      if (
        im.target === 'lib/data/prototype-repository.ts' &&
        !/^(components\/prototype|fixtures|tests)\//.test(rel)
      ) {
        note(
          rel,
          im.line,
          'illegal-bridge-consumer',
          `prototype-repository 非法消费方：仅 components/prototype/**、fixtures/**、tests/** 可引用`,
        );
      }
    }
  }
}

function graphScan() {
  // 从生产根出发的传递闭包，禁止到达 fixtures/**
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
        if (isProd(rel))
          note(rel, im.line, 'graph-reaches-fixture', `import 图到达 fixture：${im.target}`);
        continue;
      }
      const t = join(ROOT, im.target);
      if (existsSync(t) && statSync(t).isFile()) stack.push(t);
    }
  }
}

function bundleScan(dir) {
  if (!existsSync(dir)) {
    console.log(`--bundle ${dir}: 目录不存在——阶段 3 生产构建后执行（接口已定义）`);
    return;
  }
  for (const f of walkJs(dir)) {
    const src = readFileSync(f, 'utf8');
    if (src.includes('OUTRUN_FIXTURE_ONLY_v1')) {
      note(
        f.startsWith(ROOT) ? f.slice(ROOT.length + 1) : f,
        1,
        'bundle-sentinel',
        '产物含 fixture 哨兵',
      );
    }
  }
}

function resolverTokenScan() {
  // runbook：拒绝 production resolver 中出现 prototype-repository / scenario selector / 哨兵常量
  const TOKENS = ['prototype-repository', 'OUTRUN_FIXTURE_ONLY_v1', 'scenario'];
  for (const f of ['lib/data/source-resolver.ts', 'lib/data/repository.ts']) {
    const abs = join(ROOT, f);
    if (!existsSync(abs)) continue;
    const src = readFileSync(abs, 'utf8');
    src.split('\n').forEach((line, i) => {
      for (const t of TOKENS)
        if (line.includes(t))
          note(f, i + 1, 'production-resolver-token', `生产 resolver 含禁词：${t}`);
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
  if (violations.length) {
    console.error(`fixture boundary FAIL：${violations.length} 处违规`);
    for (const v of violations) console.error(` - [${v.kind}] ${v.file}:${v.line} ${v.detail}`);
    exit(1);
  }
  console.log(
    'fixture boundary OK：无直接导入/间接到达/动态 resolver 违规' +
      (argv.includes('--bundle') ? '（bundle 扫描已执行）' : ''),
  );
}

async function selfTest() {
  // 临时副本注入三类违规（runbook：直接 import / re-export / 动态 resolver）→ 三杀 → 清理
  const tmp = mkdtempSync(join(tmpdir(), 'fx-boundary-'));
  try {
    for (const d of ['scripts']) cpSync(join(ROOT, d), join(tmp, d), { recursive: true });
    cpSync(join(ROOT, 'fixtures'), join(tmp, 'fixtures'), { recursive: true }); // 让 import 可解析到真实 fixture 目标
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
    writeFileSync(join(tmp, 'lib/data/repository.ts'), `export const repo = 'production';\n`);
    const { execFileSync } = await import('node:child_process');
    // [文件名, 期望的违规 tag]——re-export 与直接导入同 tag（同属 direct-fixture-import），动态源单列 tag
    const cases = [
      ['direct', 'direct-fixture-import', `import { fixtureData } from '../fixtures/index';\n`],
      ['reexport', 'direct-fixture-import', `export { fixtureData } from '../fixtures/index';\n`],
      [
        'dynamic',
        'dynamic-source-resolver',
        `const src = '../fixtures/index';\nconst m = await import(src);\n`,
      ],
    ];
    const results = [];
    for (const [kind, tag, code] of cases) {
      for (const [k, , inject] of cases) {
        writeFileSync(join(tmp, 'app', `${k}.ts`), k === kind ? inject : 'export const ok = 1;\n');
      }
      try {
        execFileSync(
          process.argv[0],
          [join(tmp, 'scripts/check-fixture-boundary.mjs'), '--root', tmp, '--source'],
          { stdio: 'pipe' },
        );
        results.push(`${kind}: 未被拦截（FAIL）`);
      } catch (e) {
        const out = String(e.stdout ?? '') + String(e.stderr ?? '');
        const m = out.match(new RegExp(`\\[${tag}\\] (app/${kind}\\.ts):(\\d+)`));
        results.push(
          m
            ? `${kind}: 已拦截 [${tag}] ${m[1]}:${m[2]} ✓`
            : `${kind}: 已拦截但 tag/位置缺失（${out
                .split('\n')
                .filter((l) => l.includes(' - '))
                .slice(0, 2)
                .join(' | ')}）`,
        );
      }
    }
    console.log(results.join('\n'));
    const ok = results.every((r) => r.includes('✓'));
    if (!ok) exit(1);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    console.log('self-test 临时副本已清理');
  }
}

if (args.has('--self-test')) {
  await selfTest();
  exit(0);
}
runAll();
report();

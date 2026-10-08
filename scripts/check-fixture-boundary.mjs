#!/usr/bin/env node
// check-fixture-boundary.mjs — fixture/生产隔离检查（阶段 2 步骤 10）
// 用法：
//   node scripts/check-fixture-boundary.mjs --source            静态 import 扫描（生产目录禁直接/间接引 fixture）
//   node scripts/check-fixture-boundary.mjs --graph production  从生产入口走 import 图，禁止到达 fixtures/**
//   node scripts/check-fixture-boundary.mjs --bundle <dir>      产物扫描（OUTRUN_FIXTURE_ONLY_v1 哨兵；阶段 3 构建后）
//     <dir>=.next 时正向枚举生产子目录（server/static/standalone）；dev 缓存（.next/dev）经合法路径
//     （fixture-repository → fixtures）无 tree-shake 含哨兵，扫它=假警，且 dev 产物不随部署分发
//   node scripts/check-fixture-boundary.mjs --self-test         临时副本注入六类违规→必须全杀→自动清理
// 唯一合法 import 图：fixtures/** → lib/data/fixture-repository.ts → components/**（ui/design-system 通用层除外）或 fixtures/inspector/**
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

// components 不再豁免任何子目录：域组件（verse/home/…）与通用层一律禁直接引 fixtures，
// fixtures 的唯一合法消费方就是 lib/data/fixture-repository.ts 本身
const PROD_DIR_RE = /^(app|features|entities|components|lib(?!\/data\/fixture-repository))\//;
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

// tsconfig paths 前缀别名（runbook 步骤 10：脚本必须解析路径别名）。只支持「前缀/* → 单目标前缀/*」
// 形态；其余形态（精确键、多目标）收进 UNSUPPORTED_ALIAS——resolveSpec 对命中者落 unresolved 注记
// 而非按外部包静默放行（runbook：无法静态解析的路径别名视为违规）。tsconfig 缺失或不可解析
// （--self-test 临时副本只拷 scripts/ 与 fixtures/）时兜底 @/ → ROOT
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
      /* JSONC 等解析失败 → 走下方兜底 */
    }
  }
  for (const [from, tos] of entries) {
    if (from.endsWith('/*') && tos.length === 1 && tos[0].endsWith('/*'))
      ALIAS_PREFIXES.push([from.slice(0, -1), tos[0].slice(0, -1)]); // '@/*': ['./*'] → ['@/', './']
    else UNSUPPORTED_ALIAS.push(from.endsWith('/*') ? from.slice(0, -2) : from);
  }
  // tsconfig 已声明 @/*（无论支持形态与否）就不再兜底——否则兜底会短路该键的 fail-closed 注记
  if (!ALIAS_PREFIXES.some(([from]) => from === '@/') && !UNSUPPORTED_ALIAS.some((a) => a === '@'))
    ALIAS_PREFIXES.push(['@/', './']);
}

// 相对路径与 tsconfig 别名统一解析（含省略扩展名与 index）；一律以绝对路径计算再归一为 ROOT 相对；
// 别名解析不出同样落 unresolved 注记，不静默放行
function resolveSpec(fromAbs, spec) {
  let base;
  if (spec.startsWith('.') || spec.startsWith('/')) base = resolve(dirname(fromAbs), spec);
  else {
    const hit = ALIAS_PREFIXES.find(([from]) => spec.startsWith(from));
    if (!hit) {
      // tsconfig 已声明但本脚本不支持解析形态的别名：fail-closed 注记，不按外部包放行
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

// 静态 import 形状（含 export-from / require / 动态 import()）
const IMPORT_RES = [
  /\bimport\s+[^'"]*?from\s*['"]([^'"]+)['"]/g,
  /\bexport\s+[^'"]*?from\s*['"]([^'"]+)['"]/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*(?:,|\))/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*(?:,|\))/g,
  /\bimport\s*['"]([^'"]+)['"]/g,
];
// 动态 import()/require（含引号开头——拼接形态如 import('../x' + y) 也必须进判定，由 importsOf 剥字面量）
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
      // 字面量后紧跟结束或 , （两参 import attributes 形态）= 静态可解析，由 IMPORT_RES 捕获为 spec；
      // 拼接/变量等其余形态视为动态 source resolver
      if (!/^['"][^'"]*['"]\s*($|,)/.test(inner))
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
    const imports = importsOf(f); // 单次调用共享：动态源违规注记在函数体内，重复调用会重复注记
    for (const im of imports) {
      if (im.unresolved) note(rel, im.line, 'unresolved-import', `无法静态解析：${im.target}`);
      if (im.target && FIXTURE_RE.test(im.target) && isProd(rel)) {
        note(rel, im.line, 'direct-fixture-import', `生产文件直接导入 fixture：${im.target}`);
      }
    }
    // fixture-repository 只允许被 components/**（ui/design-system 通用层除外）、fixtures/**、tests/** 引用
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
          `fixture-repository 非法消费方：仅 components/**（ui/design-system 除外）、fixtures/**、tests/** 可引用`,
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

/** Next 构建目录中可部署的生产输出子目录（正向枚举；cache/dev/diagnostics/types 为开发与中间产物，不分发） */
const PROD_BUNDLE_SUBDIRS = ['server', 'static', 'standalone'];

// bundle 扫描是否真执行（目录缺失/无产物子目录的早退路径不算）——report() 汇总行据此如实标注
let bundleScanExecuted = false;

function bundleScan(dir) {
  if (!existsSync(dir)) {
    console.log(`--bundle ${dir}: 目录不存在——阶段 3 生产构建后执行（接口已定义）`);
    return;
  }
  // `.next` 只扫生产子目录：dev server 编译缓存（.next/dev/**）无 tree-shake，合法消费方
  // fixture-repository 会把哨兵留在 dev SSR chunk 里——那是允许的 import 图，不是泄漏。
  // 非 `.next` 的自定义产物目录维持整扫（原接口语义不变）。
  const roots =
    basename(dir) === '.next'
      ? PROD_BUNDLE_SUBDIRS.map((d) => join(dir, d)).filter(existsSync)
      : [dir];
  if (basename(dir) === '.next' && roots.length === 0) {
    console.log(`--bundle ${dir}: 未发现生产产物子目录（server/static）——阶段 3 生产构建后执行`);
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
          '产物含 fixture 哨兵',
        );
      }
    }
  }
}

function resolverTokenScan() {
  // runbook：拒绝 production resolver 中出现 fixture-repository / scenario selector / 哨兵常量
  const TOKENS = ['fixture-repository', 'OUTRUN_FIXTURE_ONLY_v1', 'scenario'];
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
  // 去重：--source/--graph 同进程各调一次 importsOf，函数体内的动态注记会成对重复
  const unique = [
    ...new Map(violations.map((v) => [`${v.file}|${v.line}|${v.kind}|${v.detail}`, v])).values(),
  ];
  if (unique.length) {
    console.error(`fixture boundary FAIL：${unique.length} 处违规`);
    for (const v of unique) console.error(` - [${v.kind}] ${v.file}:${v.line} ${v.detail}`);
    exit(1);
  }
  const bundleSuffix = argv.includes('--bundle')
    ? bundleScanExecuted
      ? '（bundle 扫描已执行）'
      : '（bundle 扫描未执行）'
    : '';
  console.log('fixture boundary OK：无直接导入/间接到达/动态 resolver 违规' + bundleSuffix);
}

async function selfTest() {
  // 临时副本注入六类违规（runbook：直接 import / 路径别名 / re-export / 动态 resolver /
  // 引号开头拼接动态 resolver / 别名桥消费方）→ 全杀 → 清理
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
    writeFileSync(join(tmp, 'lib/data/fixture-repository.ts'), `export const bridge = 1;\n`); // 别名桥消费用例的解析目标
    const { execFileSync } = await import('node:child_process');
    // [文件名, 期望的违规 tag]——re-export 与直接/别名导入同 tag（同属 direct-fixture-import），动态源单列 tag；
    // alias-bridge 锁定 '@/' 归一后 illegal-bridge-consumer 的拦截（别名归一修复前该规则对 '@/' 全盲）
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
            'production',
          ],
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

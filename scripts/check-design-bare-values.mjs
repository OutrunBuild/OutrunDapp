#!/usr/bin/env node
// check-design-bare-values.mjs — 设计裸值扫描（agent-workflow.md §3.1 的脚本化）
// 用法：
//   node scripts/check-design-bare-values.mjs            扫描产品代码（默认）
//   node scripts/check-design-bare-values.mjs --self-test  内置金丝雀注入→四类全杀+豁免/剥注释生效→自动清理
// 检查范围：components/** 与 app/** 的 *.tsx（与 agent-workflow §3.1 文档口径一致）。
// 排除：components/axis-choice/、components/direction-choice/、app/design-review/（Stage-01 内部审阅工具，非产品界面）。
// 四类违规：
//   [hex]      裸 #hex 颜色（token 唯一源 = components/design-system/tokens.css）
//   [palette]  Tailwind 原始调色板类（bg-blue-500 等；只能用语义类 bg-primary/text-muted-foreground）
//   [space-*]  space-x/space-y 工具类（用 gap，见 components.md §8）
//   [transition-all] transition: all（点名过渡，避免全局重绘）
// 说明：注释（// 与 /* */）先剥离再扫，URL 中的 // 不受影响；px 裸值不在自动闸（canvas/图表配置合法使用多，误报率高，人工按 README §3.1 把关）。
import { readdirSync, readFileSync, existsSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { argv, cwd, exit } from 'node:process';

const args = new Set(argv.slice(2));
const ROOT = cwd();

const SCAN_DIRS = ['components', 'app'];
const EXCLUDE_RE = /(axis-choice|direction-choice|design-review)[/\\]/;
const PALETTES =
  'red|blue|green|yellow|purple|pink|cyan|emerald|slate|zinc|gray|orange|rose|indigo|violet|teal|lime|amber|fuchsia|sky|neutral|stone';

const PATTERNS = [
  {
    kind: 'hex',
    re: /#[0-9a-fA-F]{3,8}\b/g,
    detail: '裸 hex 颜色——改用 tokens.css 的 var(--color-*) 或语义类',
  },
  {
    kind: 'palette',
    re: new RegExp(`\\b(?:bg|text|border)-(?:${PALETTES})-\\d{2,3}\\b`, 'g'),
    detail: 'Tailwind 原始调色板类——改用语义类（bg-primary / text-muted-foreground 等）',
  },
  { kind: 'space-*', re: /\bspace-[xy]-\d+\b/g, detail: 'space-x/y——改用 flex/grid + gap' },
  {
    kind: 'transition-all',
    re: /\btransition[a-zA-Z]*\s*:\s*['"]?all\b/g,
    detail: "transition: 'all'——点名具体属性（引号内联样式同样违规）",
  },
];

// 豁免表：合法非样式用途（每条必须带理由；新增需在 PR 说明）
const ALLOWLIST = [
  {
    file: 'app/layout.tsx',
    re: /themeColor:\s*'#0A0A10'/,
    reason:
      'Next viewport meta 的 themeColor——品牌锚 --site-black 的必要镜像（meta 不识别 CSS 变量）',
  },
];

const violations = [];

function* walkTsx(dir) {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walkTsx(p);
    else if (extname(e.name) === '.tsx') yield p;
  }
}

// 剥离注释但保持行号：/* */ 段替换为等长空白；// 行注释按「行首或空白前缀」切（https:// 不受影响）
function stripComments(content) {
  const noBlock = content.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));
  return noBlock
    .split('\n')
    .map((line) => line.replace(/(^|\s)\/\/.*$/, '$1'))
    .join('\n');
}

function scanSource(rel, raw) {
  const content = stripComments(raw);
  const lines = content.split('\n');
  for (const { kind, re, detail } of PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      re.lastIndex = 0;
      const m = re.exec(lines[i]);
      if (!m) continue;
      const allow = ALLOWLIST.find((a) => rel === a.file && a.re.test(`${lines[i]}`));
      if (allow) continue;
      violations.push({
        file: rel,
        line: i + 1,
        kind,
        detail,
        snippet: lines[i].trim().slice(0, 90),
      });
    }
  }
}

function report() {
  if (violations.length === 0) {
    console.log('裸值扫描：0 命中 ✓（产品代码仅 token 与语义类）');
    return;
  }
  console.log(`裸值扫描：${violations.length} 处违规 ✗\n`);
  for (const v of violations) {
    console.log(`  [${v.kind}] ${v.file}:${v.line}`);
    console.log(`    ${v.snippet}`);
    console.log(`    → ${v.detail}\n`);
  }
  exit(1);
}

async function selfTest() {
  const tmp = join(ROOT, 'components', '__selftest__');
  mkdirSync(tmp, { recursive: true });
  try {
    // 四类违规 + 注释豁免 + URL 保护 + 允许表各一行
    const canary = `import React from 'react';
// 参考 issue #1178 与 https://example.com/a
/* 旧实现 color: #FF0000; 已删 */
export function Canary({ ok }: { ok: boolean }) {
  return (
    <div
      className="bg-blue-500 space-x-4"
      style={{ transition: 'all 120ms', background: '#00F0FF' }}
      data-url="https://example.com/#frag"
    >
      {/* JSX 注释 #ABC123 不算 */}
      {ok ? 'k' : 'v'}
    </div>
  );
}
`;
    const file = join(tmp, 'canary.tsx');
    writeFileSync(file, canary);
    violations.length = 0;
    scanSource(relative(ROOT, file), canary);

    const kinds = [...new Set(violations.map((v) => v.kind))].sort();
    const expectKinds = ['hex', 'palette', 'space-*', 'transition-all'].sort();
    const pass =
      JSON.stringify(kinds) === JSON.stringify(expectKinds) &&
      violations.every((v) => v.file === 'components/__selftest__/canary.tsx') &&
      violations.filter((v) => v.kind === 'hex').length === 1 && // style 里的 #00F0FF；data-url 片段/#frag 不是 3-8 hex 词边界、注释已剥
      violations.filter((v) => v.kind === 'palette').length === 1 &&
      violations.filter((v) => v.kind === 'space-*').length === 1 &&
      violations.filter((v) => v.kind === 'transition-all').length === 1;
    console.log(
      `self-test: 四类金丝雀 ${pass ? '全杀 ✓' : '漏杀/误杀 ✗'}（命中 kinds=${kinds.join(',')}）`,
    );
    if (!pass) {
      console.log(violations);
      exit(1);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    console.log('self-test 临时文件已清理');
  }
}

if (args.has('--self-test')) {
  await selfTest();
  exit(0);
}
for (const dir of SCAN_DIRS) {
  for (const file of walkTsx(join(ROOT, dir))) {
    const rel = relative(ROOT, file).replaceAll('\\', '/');
    if (EXCLUDE_RE.test(rel)) continue;
    scanSource(rel, readFileSync(file, 'utf8'));
  }
}
report();

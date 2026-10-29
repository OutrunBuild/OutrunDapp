#!/usr/bin/env node
// check-cjk-copy.mjs -- hardcoded-CJK literal scan
// Usage:
//   node scripts/check-cjk-copy.mjs            scan product code (default)
//   node scripts/check-cjk-copy.mjs --self-test  built-in canary injection -> comment/URL
//     exemptions verified + attribute/JSX-text/ternary/template hits all killed -> auto cleanup
// Scope: *.ts/*.tsx under components/**, app/**, lib/**, excluding the dictionary itself
// (components/global/copy.ts), tests, and stories. Enforcement of the copy-and-i18n.md §1
// contract "all user-visible strings come from the dictionary": CJK outside comments means
// hardcoded copy, which is invisible to the font-subset corpus (copy.ts + fixtures) -- an
// uncovered glyph would fall back to system fonts with every other gate green.
// Note: comments (// and /* */) are stripped before scanning; // inside URLs is unaffected.
import { readdirSync, readFileSync, existsSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { argv, cwd, exit } from 'node:process';

const args = new Set(argv.slice(2));
const ROOT = cwd();

const SCAN_DIRS = ['components', 'app', 'lib'];
const EXCLUDED_FILES = new Set(['components/global/copy.ts']);
const EXCLUDED_NAME_PARTS = ['.test.', '.stories.', '.d.ts'];
// design-system/ is the universal layer: the showcase page's zh/en label tables are its own
// display data, not product copy (same carve-out class as the fixture boundary's ui/ exemption)
const EXCLUDED_PREFIXES = ['components/design-system/'];
const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

const violations = [];

function* walkSources(dir) {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walkSources(p);
    else if (extname(e.name) === '.ts' || extname(e.name) === '.tsx') yield p;
  }
}

// Same stripping contract as check-design-bare-values.mjs: /* */ blocks replaced by
// same-length whitespace (line numbers preserved); // is cut only at line start or after
// whitespace, so https:// survives.
function stripComments(content) {
  const noBlock = content.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));
  return noBlock
    .split('\n')
    .map((line) => line.replace(/(^|\s)\/\/.*$/, '$1'))
    .join('\n');
}

function scanSource(rel, raw) {
  const lines = stripComments(raw).split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!CJK_RE.test(lines[i])) continue;
    violations.push({
      file: rel,
      line: i + 1,
      snippet: lines[i].trim().slice(0, 90),
    });
  }
}

function report() {
  if (violations.length === 0) {
    console.log(
      'hardcoded-CJK scan: 0 hits ✓ (user-visible strings come from the copy dictionary)',
    );
    return;
  }
  console.log(`hardcoded-CJK scan: ${violations.length} violation(s) ✗\n`);
  for (const v of violations) {
    console.log(`  ${v.file}:${v.line}`);
    console.log(`    ${v.snippet}`);
    console.log(
      '    → hardcoded copy -- add the string to components/global/copy.ts and read it via getCopy\n',
    );
  }
  exit(1);
}

async function selfTest() {
  const tmp = join(ROOT, 'components', '__selftest__');
  mkdirSync(tmp, { recursive: true });
  let pass = false;
  try {
    // five violation lines (attribute / JSX text / ternary / href+text / template) + three
    // comment kinds that must not count + a URL line whose trailing CJK must still be caught
    const canary = `import React from 'react';
// 行注释里的中文不计数
/* 块注释里的中文不计数 */
export function Canary({ ok }: { ok: boolean }) {
  return (
    <div title="硬编码属性文案">
      {/* JSX 注释里的中文 https://example.com 不计数 */}
      <span>硬编码文本</span>
      {ok ? '硬编码甲' : '硬编码乙'}
      <a href="https://example.com">中文链接</a>
      {ok && \`模板 \${String(ok)} 串\`}
    </div>
  );
}
`;
    const file = join(tmp, 'canary.tsx');
    writeFileSync(file, canary);
    violations.length = 0;
    scanSource(relative(ROOT, file), canary);

    const hitLines = violations.map((v) => v.line);
    // title=6, JSX text=8, ternary=9, href+text=10, template=11; comments on 2/3/7 escape
    pass =
      violations.length === 5 &&
      JSON.stringify(hitLines) === JSON.stringify([6, 8, 9, 10, 11]) &&
      violations.every((v) => v.file === 'components/__selftest__/canary.tsx');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  // exit only after cleanup: exit() inside try would skip the finally block
  console.log(
    `self-test: canary hits ${pass ? 'exact ✓' : 'wrong ✗'} (lines=${violations.map((v) => v.line).join(',')})`,
  );
  if (!pass) {
    console.log(violations);
    exit(1);
  }
  console.log('self-test temp file cleaned up');
}

if (args.has('--self-test')) {
  await selfTest();
  exit(0);
}
for (const dir of SCAN_DIRS) {
  for (const file of walkSources(join(ROOT, dir))) {
    const rel = relative(ROOT, file).replaceAll('\\', '/');
    if (
      EXCLUDED_FILES.has(rel) ||
      EXCLUDED_NAME_PARTS.some((part) => rel.includes(part)) ||
      EXCLUDED_PREFIXES.some((prefix) => rel.startsWith(prefix))
    )
      continue;
    scanSource(rel, readFileSync(file, 'utf8'));
  }
}
report();

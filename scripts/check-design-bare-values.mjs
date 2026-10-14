#!/usr/bin/env node
// check-design-bare-values.mjs -- bare design-value scan
// Usage:
//   node scripts/check-design-bare-values.mjs            scan product code (default)
//   node scripts/check-design-bare-values.mjs --self-test  built-in canary injection -> all four kinds
//     killed + comment exemption and URL protection verified -> auto cleanup
// Scope: *.tsx under components/** and app/**.
// Four violation kinds:
//   [hex]      bare #hex colors (token single source = components/design-system/tokens.css)
//   [palette]  raw Tailwind palette classes (bg-blue-500 etc.; only semantic classes such as
//              bg-primary/text-muted-foreground are allowed)
//   [space-*]  space-x/space-y utilities (use gap instead)
//   [transition-all] transition: all (name the specific properties; avoids global repaint)
// Note: comments (// and /* */) are stripped before scanning; // inside URLs is unaffected; bare px
// values are not in this automatic gate (legitimately common in canvas/chart configs, high
// false-positive rate; gated manually during design review).
import { readdirSync, readFileSync, existsSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { argv, cwd, exit } from 'node:process';

const args = new Set(argv.slice(2));
const ROOT = cwd();

const SCAN_DIRS = ['components', 'app'];
const PALETTES =
  'red|blue|green|yellow|purple|pink|cyan|emerald|slate|zinc|gray|orange|rose|indigo|violet|teal|lime|amber|fuchsia|sky|neutral|stone';

const PATTERNS = [
  {
    kind: 'hex',
    re: /#[0-9a-fA-F]{3,8}\b/g,
    detail: 'bare hex color -- use tokens.css var(--color-*) or a semantic class instead',
  },
  {
    kind: 'palette',
    re: new RegExp(`\\b(?:bg|text|border)-(?:${PALETTES})-\\d{2,3}\\b`, 'g'),
    detail:
      'raw Tailwind palette class -- use a semantic class instead (bg-primary / text-muted-foreground etc.)',
  },
  {
    kind: 'space-*',
    re: /\bspace-[xy]-\d+\b/g,
    detail: 'space-x/y -- use flex/grid + gap instead',
  },
  {
    kind: 'transition-all',
    re: /\btransition[a-zA-Z]*\s*:\s*['"]?all\b/g,
    detail: "transition: 'all' -- name the specific properties (quoted inline styles violate too)",
  },
];

// Allowlist: legitimate non-style uses (every entry must carry a reason; new entries need PR justification)
const ALLOWLIST = [
  {
    file: 'app/layout.tsx',
    re: /themeColor:\s*'#0A0A10'/,
    reason:
      'themeColor of the Next viewport meta -- required mirror of the brand anchor --site-black (meta cannot read CSS variables)',
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

// Strip comments but keep line numbers: /* */ blocks replaced by same-length whitespace; // line
// comments are cut at "line start or whitespace prefix" (https:// unaffected)
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
    console.log('bare-value scan: 0 hits ✓ (product code uses tokens and semantic classes only)');
    return;
  }
  console.log(`bare-value scan: ${violations.length} violation(s) ✗\n`);
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
    // four violation kinds + comment exemption + URL protection (a violation placed after the URL
    // must still be caught -- scanner must not truncate the line at https://)
    const canary = `import React from 'react';
// ref issue #1178 and https://example.com/a
/* old implementation color: #FF0000; removed */
export function Canary({ ok }: { ok: boolean }) {
  return (
    <div
      className="bg-blue-500 space-x-4"
      style={{ transition: 'all 120ms', background: '#00F0FF' }}
      data-url="https://example.com/#frag"
      data-after-url="bg-red-500"
    >
      {/* JSX comment #ABC123 not counted */}
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
    // hex: the #00F0FF in style (the data-url fragment /#frag is not 3-8 hex at a word boundary);
    // palette x2: bg-blue-500 + bg-red-500 -- the second sits AFTER the https:// URL, so a scanner
    // that truncates lines at URLs fails here; comments were already stripped
    const pass =
      JSON.stringify(kinds) === JSON.stringify(expectKinds) &&
      violations.every((v) => v.file === 'components/__selftest__/canary.tsx') &&
      violations.filter((v) => v.kind === 'hex').length === 1 &&
      violations.filter((v) => v.kind === 'palette').length === 2 &&
      violations.filter((v) => v.kind === 'space-*').length === 1 &&
      violations.filter((v) => v.kind === 'transition-all').length === 1;
    console.log(
      `self-test: four canary kinds ${pass ? 'all killed ✓' : 'escaped or falsely killed ✗'} (hit kinds=${kinds.join(',')})`,
    );
    if (!pass) {
      console.log(violations);
      exit(1);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    console.log('self-test temp file cleaned up');
  }
}

if (args.has('--self-test')) {
  await selfTest();
  exit(0);
}
for (const dir of SCAN_DIRS) {
  for (const file of walkTsx(join(ROOT, dir))) {
    const rel = relative(ROOT, file).replaceAll('\\', '/');
    scanSource(rel, readFileSync(file, 'utf8'));
  }
}
report();

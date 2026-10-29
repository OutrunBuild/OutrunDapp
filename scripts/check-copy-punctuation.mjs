#!/usr/bin/env node
// check-copy-punctuation.mjs -- copy semicolon scan
// Enforces docs/design-system/copy-and-i18n.md §2 "文案禁用分号". The rule carries no
// language qualifier and was applied to en and zh copy in the introducing commit, so both
// branches are scanned.
// Scope = user-visible copy: components/global/copy.ts string literals, fixtures/data/**/*.json
// string values, and the `const COPY` label table inside components/design-system/showcase.tsx
// (the rest of that component is JSX/className/style specimens, not copy).
// build:cjk-font's corpus is the superset copy.ts + fixtures/**; the invariants/ and scenarios/
// trees are engineering-facing specs, not copy, so they stay out.
// Exemptions: comments in .ts/.tsx; fixtures/data/seed.json (deterministic seed metadata);
// URL values (http(s)://), so a query string is not read as copy. EXEMPT_FIXTURE_KEYS lists
// metadata keys reachable inside fixtures/data, not a waiver registry: the rule's
// "具体必要性" exception is a manual ruling (record it in docs/design/decision-log.md), not a
// switch to flip here.
// Usage: node scripts/check-copy-punctuation.mjs [--self-test]
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argv, exit } from 'node:process';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// rejectTemplates: copy.ts is a pure data dictionary, so a template literal there is either an
// escaped scan surface or an accident; showcase.tsx is a component (inline styles use
// templates), so only its COPY table is scanned and templates there are left alone.
const COPY_FILES = [
  { path: 'components/global/copy.ts', rejectTemplates: true, copyTable: false },
  { path: 'components/design-system/showcase.tsx', rejectTemplates: false, copyTable: true },
];
const FIXTURE_DIR = 'fixtures/data';
const EXEMPT_FIXTURE_FILES = new Set(['fixtures/data/seed.json']);
const EXEMPT_FIXTURE_KEYS = new Set(['sourceRef', 'generatedFrom']);
const STRING_RE = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g;
const QUOTED_RE = /"(?:[^"\\]|\\.)*"/g;
const URL_RE = /^https?:\/\//i;
const SEMI_RE = /[;；]/;
const SEMI_HINT = 'split into two sentences, or use a comma/dash (copy-and-i18n.md §2)';
const TEMPLATE_HINT =
  'copy dictionary uses quoted strings only; convert the template literal so the punctuation scan can see it';
const COPY_TABLE_START = 'const COPY = {';
const COPY_TABLE_END = '} as const';

// Same stripping contract as check-cjk-copy.mjs: /* */ blocks replaced by same-length
// whitespace (line numbers preserved); // is cut only at line start or after whitespace, so
// https:// survives inside string literals.
function stripComments(content) {
  const noBlock = content.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));
  return noBlock
    .split('\n')
    .map((line) => line.replace(/(^|\s)\/\/.*$/, '$1'))
    .join('\n');
}

// Blank everything outside the COPY table so the scan surface stays the label data and line
// numbers still match the file. Returns null when the markers are missing (fail closed).
function maskOutsideCopyTable(raw) {
  const start = raw.indexOf(COPY_TABLE_START);
  const end = start === -1 ? -1 : raw.indexOf(COPY_TABLE_END, start);
  if (start === -1 || end === -1) return null;
  const endAt = end + COPY_TABLE_END.length;
  const blank = (text) => text.replace(/[^\n]/g, ' ');
  return blank(raw.slice(0, start)) + raw.slice(start, endAt) + blank(raw.slice(endAt));
}

function scanCopySource(rel, raw, { rejectTemplates }) {
  const stripped = stripComments(raw);
  const found = [];
  let literals = 0;
  if (rejectTemplates) {
    const tick = stripped.indexOf('`');
    if (tick !== -1) {
      found.push({
        file: rel,
        line: stripped.slice(0, tick).split('\n').length,
        snippet: 'template literal',
        hint: TEMPLATE_HINT,
      });
    }
  }
  const lines = stripped.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const match of lines[i].matchAll(STRING_RE)) {
      literals++;
      const value = match[0].slice(1, -1);
      if (SEMI_RE.test(value) && !URL_RE.test(value)) {
        found.push({
          file: rel,
          line: i + 1,
          snippet: lines[i].trim().slice(0, 110),
          hint: SEMI_HINT,
        });
        break;
      }
    }
  }
  return { found, literals };
}

// Keys are tracked per quoted token so an inline multi-key object still exempts its metadata
// keys; a value is judged against the key that immediately precedes it.
function scanFixture(rel, raw) {
  if (EXEMPT_FIXTURE_FILES.has(rel)) return { found: [], literals: 0 };
  const found = [];
  let literals = 0;
  const lines = raw.split('\n');
  for (let i = 0; i < lines.length; i++) {
    let key = null;
    for (const match of lines[i].matchAll(QUOTED_RE)) {
      literals++;
      const rest = lines[i].slice(match.index + match[0].length);
      if (/^\s*:/.test(rest)) {
        key = match[0].slice(1, -1);
        continue;
      }
      if (key !== null && EXEMPT_FIXTURE_KEYS.has(key)) continue;
      const value = match[0].slice(1, -1);
      if (SEMI_RE.test(value) && !URL_RE.test(value)) {
        found.push({
          file: rel,
          line: i + 1,
          snippet: lines[i].trim().slice(0, 110),
          hint: SEMI_HINT,
        });
        break;
      }
    }
  }
  return { found, literals };
}

function* walkJson(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walkJson(path);
    else if (entry.name.endsWith('.json')) yield path;
  }
}

function report(violations, files, dictionaryLiterals, fixtureLiterals) {
  if (violations.length === 0) {
    const total = dictionaryLiterals + fixtureLiterals;
    console.log(
      `copy-punctuation scan: 0 hits ✓ (scanned ${files} files / ${total} string literals; ` +
        `dictionary ${dictionaryLiterals} / fixtures ${fixtureLiterals}; ` +
        `no semicolons in user-visible copy; copy-and-i18n.md §2)`,
    );
    return;
  }
  console.log(`copy-punctuation scan: ${violations.length} violation(s) ✗\n`);
  for (const v of violations) {
    console.log(`  ${v.file}:${v.line}`);
    console.log(`    ${v.snippet}`);
    console.log(`    → ${v.hint}\n`);
  }
  exit(1);
}

function selfTest() {
  const canaryCopy = [
    "const a = 'two clauses; joined';",
    "// 'comment; not copy' — see `pnpm build:cjk-font`",
    "/* 'block; not copy' */",
    'const b = "https://example.com/?a=1;b=2";',
    'const c = `two clauses; joined`;',
    "const d = '两句话；拼接';",
  ].join('\n');
  const canaryFixture = [
    '{"description": "two clauses; joined"}',
    '{"sourceRef": "subgraph:1;2"}',
    '{"url": "https://example.com/?a=1;b=2"}',
    '{ "sourceRef": "a;b", "note": "c;d" }',
    '{ "generatedFrom": "a;b", "note": "c;d" }',
  ].join('\n');
  const strict = scanCopySource('canary.ts', canaryCopy, { rejectTemplates: true }).found;
  const loose = scanCopySource('canary.ts', canaryCopy, { rejectTemplates: false }).found;
  const fixture = scanFixture('canary.json', canaryFixture).found;
  const masked = maskOutsideCopyTable('const COPY = {\n  a: "x; y",\n} as const\nconst z = "p; q"');
  const maskOk = masked !== null && masked.includes('"x; y"') && !masked.includes('"p; q"');
  const lines = (hits) =>
    hits
      .map((hit) => hit.line)
      .sort((a, b) => a - b)
      .join(',');
  const pass =
    lines(strict) === '1,5,6' && lines(loose) === '1,6' && lines(fixture) === '1,4,5' && maskOk;
  console.log(
    `self-test: canary hits ${pass ? 'exact ✓' : 'wrong ✗'} (strict=${lines(strict)}, loose=${lines(loose)}, fixture=${lines(fixture)}, mask=${maskOk ? 'ok' : 'bad'})`,
  );
  if (!pass) {
    console.log({ strict, loose, fixture, masked });
    exit(1);
  }
}

if (argv.includes('--self-test')) {
  selfTest();
  exit(0);
}

const violations = [];
let files = 0;
let dictionaryLiterals = 0;
let fixtureLiterals = 0;
for (const { path: rel, rejectTemplates, copyTable } of COPY_FILES) {
  const raw = readFileSync(join(REPO_ROOT, rel), 'utf8');
  const text = copyTable ? maskOutsideCopyTable(raw) : raw;
  if (text === null) {
    violations.push({
      file: rel,
      line: 1,
      snippet: 'copy table markers not found',
      hint: `expected \`${COPY_TABLE_START}\` … \`${COPY_TABLE_END}\``,
    });
    continue;
  }
  const result = scanCopySource(rel, text, { rejectTemplates });
  violations.push(...result.found);
  dictionaryLiterals += result.literals;
  files++;
}
for (const file of walkJson(join(REPO_ROOT, FIXTURE_DIR))) {
  const rel = relative(REPO_ROOT, file).replaceAll('\\', '/');
  if (EXEMPT_FIXTURE_FILES.has(rel)) continue;
  const result = scanFixture(rel, readFileSync(file, 'utf8'));
  violations.push(...result.found);
  fixtureLiterals += result.literals;
  files++;
}
report(violations, files, dictionaryLiterals, fixtureLiterals);

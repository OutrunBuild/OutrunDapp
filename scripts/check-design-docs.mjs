#!/usr/bin/env node
// Registration doc gate (check:design-docs)
//
// Scope: Markdown docs under docs/design-system/ plus the root AGENTS.md
// Predicates:
//   1) FAIL  duplicate pattern-name rows in section 6 of the components doc -- guards against the
//            "append a new row on update without deleting the old one" accident; a missing or
//            empty section 6 fails closed, so a renamed/renumbered heading cannot silently
//            disable this predicate
//   2) FAIL  any single line in any file exceeding MAX_LINE_CHARS (12,000) -- guards against new
//            giant single lines; the loose ceiling fits the legacy big-table format and can be
//            tightened as the table is split into per-pattern sections
//   3) FAIL  narrative dates (YYYY-MM-DD) -- history narrative belongs only in the decision log; the
//            sole exemption = the e2e clock-pin fixed value (a config constant, not narrative).
//            New exemptions must be registered in EXEMPT_DATES with their nature explained
//
// Self-test: --self-test runs positive and negative cases for all three FAIL predicates.
// Exit code: any FAIL = 1.

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS_DIR = join(REPO_ROOT, 'docs', 'design-system');
// Root files outside DOCS_DIR that share the same registration rules.
const ROOT_FILES = ['AGENTS.md'];
const MAX_LINE_CHARS = 12000;
const DATE_RE = /\d{4}-\d{2}-\d{2}/g;
const EXEMPT_DATES = [{ file: 'agent-workflow.md', span: '时钟钉 2026-10-01' }];

function parseSection6Rows(text) {
  const lines = text.split('\n');
  const rows = [];
  let inSection = false;
  for (const line of lines) {
    if (line.startsWith('## ')) inSection = line.startsWith('## 6.');
    else if (inSection && line.startsWith('|') && !/^\|[-\s|]+$/.test(line)) {
      const firstCell = line.slice(1, line.indexOf('|', 1)).trim();
      if (firstCell && firstCell !== '模式') rows.push(firstCell);
    }
  }
  return rows;
}

function findDuplicatePatterns(rows) {
  const seen = new Set();
  const dupes = [];
  for (const name of rows) {
    if (seen.has(name)) dupes.push(name);
    seen.add(name);
  }
  return dupes;
}

// Fail closed on parse-anchor drift: a renamed/renumbered section 6 would otherwise leave this
// gate silently parsing zero rows and passing forever.
function section6GateFailures(text) {
  if (text === undefined) return ['components doc missing from docs/design-system/'];
  const rows = parseSection6Rows(text);
  if (rows.length === 0)
    return ['components doc section 6 not found or empty -- `## 6.` parse anchor drifted'];
  const dupes = findDuplicatePatterns(rows);
  if (dupes.length)
    return [`components doc section 6 duplicate pattern names: ${dupes.join(', ')}`];
  return [];
}

function findOverlongLines(files, max) {
  const hits = [];
  for (const [name, text] of files) {
    text.split('\n').forEach((line, i) => {
      if (line.length > max) hits.push(`${name}:${i + 1} (${line.length})`);
    });
  }
  return hits;
}

function findNarrativeDates(files) {
  const hits = [];
  for (const [name, text] of files) {
    let rest = text;
    for (const ex of EXEMPT_DATES.filter((e) => e.file === name)) {
      rest = rest.split(ex.span).join('');
    }
    const n = (rest.match(DATE_RE) || []).length;
    if (n > 0) hits.push(`${name}: ${n}`);
  }
  return hits;
}

function runChecks() {
  const files = [
    ...readdirSync(DOCS_DIR)
      .filter((f) => f.endsWith('.md'))
      .map((f) => [f, readFileSync(join(DOCS_DIR, f), 'utf8')]),
    ...ROOT_FILES.map((f) => [f, readFileSync(join(REPO_ROOT, f), 'utf8')]),
  ];

  const failures = [];

  const components = files.find(([f]) => f === 'components.md');
  failures.push(...section6GateFailures(components?.[1]));

  const overlong = findOverlongLines(files, MAX_LINE_CHARS);
  if (overlong.length)
    failures.push(`single line over ${MAX_LINE_CHARS} chars: ${overlong.join(', ')}`);

  const dates = findNarrativeDates(files);
  if (dates.length)
    failures.push(
      `narrative dates (decision-log only; exemption table in the script header): ${dates.join(', ')}`,
    );

  return { failures };
}

function selfTest() {
  const cases = [
    [
      'components doc section 6 duplicate rows positive case',
      JSON.stringify(
        findDuplicatePatterns(parseSection6Rows('## 6. x\n| a | b |\n| a | c |\n## 7. y')),
      ) === '["a"]',
    ],
    [
      'components doc section 6 duplicate rows negative case (no duplicates)',
      findDuplicatePatterns(
        parseSection6Rows('## 6. x\n| a | b |\n| b | c |\n|---|\n| 模式 | x |\n## 7. y'),
      ).length === 0,
    ],
    [
      'components doc section 6 gate fails closed on missing/renumbered section (anchor drift)',
      section6GateFailures('## 5. x\n| a | b |\n## 7. y').length === 1,
    ],
    [
      'components doc section 6 gate fails closed on missing components doc',
      section6GateFailures(undefined).length === 1,
    ],
    [
      'components doc section 6 gate passes a healthy table',
      section6GateFailures('## 6. x\n| a | b |\n| b | c |\n|---|\n| 模式 | x |\n## 7. y').length ===
        0,
    ],
    [
      'components doc section 6 gate reports duplicates (wiring + message template)',
      section6GateFailures('## 6. x\n| a | b |\n| a | c |')[0] ===
        'components doc section 6 duplicate pattern names: a',
    ],
    [
      'overlong line positive case',
      findOverlongLines([['t.md', 'x'.repeat(12001)]], 12000).length === 1,
    ],
    [
      'overlong line negative case',
      findOverlongLines([['t.md', 'x'.repeat(12000)]], 12000).length === 0,
    ],
    [
      'narrative date positive case (residue remains after exemption)',
      findNarrativeDates([['t.md', 'ruled on 2026-10-09, 时钟钉 2026-10-01']]).length === 1,
    ],
    [
      'narrative date negative case (exempt fixed value only)',
      findNarrativeDates([['agent-workflow.md', '时钟钉 2026-10-01']]).length === 0,
    ],
  ];
  let ok = true;
  for (const [name, pass] of cases) {
    console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`);
    if (!pass) ok = false;
  }
  return ok;
}

if (process.argv.includes('--self-test')) {
  process.exit(selfTest() ? 0 : 1);
}

const { failures } = runChecks();
if (failures.length) {
  for (const f of failures) console.error(`FAIL ${f}`);
  process.exit(1);
}
console.log('registration doc gate (docs/design-system + AGENTS.md): all checks passed');

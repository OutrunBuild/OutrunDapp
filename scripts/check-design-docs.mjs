#!/usr/bin/env node
// 登记文档闸（check:design-docs）
//
// 管辖范围：docs/design-system/*.md
// 谓词：
//   1) FAIL  components.md §6 表格「模式名」重复——防「更新时追加新行、不删旧行」事故
//            （先例：四标签容器行 2026-10 出现新旧两版并存，9.7KB 死内容进过 HEAD）
//   2) FAIL  任一文件单行超过 MAX_LINE_CHARS（12,000）——防新增巨型单行；当前存量最大
//            ~9.8K（四标签容器行）。§6 格式改造（大表→每模式小节）落地后应逐档下调此值
//   3) FAIL  叙事日期（YYYY-MM-DD）——沿革叙事只进 decision-log；唯一豁免 = e2e 时钟钉
//            定值（agent-workflow.md「时钟钉 2026-10-01」，配置值非叙事）。新增豁免须在
//            EXEMPT_DATES 登记并说明性质
//
// 自检：--self-test 对三个 FAIL 谓词跑正反用例。
// 退出码：任一 FAIL=1。

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'design-system');
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
  const files = readdirSync(DOCS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => [f, readFileSync(join(DOCS_DIR, f), 'utf8')]);

  const failures = [];

  const components = files.find(([f]) => f === 'components.md');
  if (components) {
    const dupes = findDuplicatePatterns(parseSection6Rows(components[1]));
    if (dupes.length) failures.push(`§6 模式名重复: ${dupes.join('、')}`);
  }

  const overlong = findOverlongLines(files, MAX_LINE_CHARS);
  if (overlong.length) failures.push(`单行超 ${MAX_LINE_CHARS} 字符: ${overlong.join('、')}`);

  const dates = findNarrativeDates(files);
  if (dates.length)
    failures.push(`叙事日期（只进 decision-log，豁免表见脚本文件头）: ${dates.join('、')}`);

  return { failures };
}

function selfTest() {
  const cases = [
    [
      '§6 重复行正例',
      JSON.stringify(
        findDuplicatePatterns(parseSection6Rows('## 6. x\n| a | b |\n| a | c |\n## 7. y')),
      ) === '["a"]',
    ],
    [
      '§6 重复行反例（无重复）',
      findDuplicatePatterns(
        parseSection6Rows('## 6. x\n| a | b |\n| b | c |\n|---|\n| 模式 | x |\n## 7. y'),
      ).length === 0,
    ],
    ['超长行正例', findOverlongLines([['t.md', 'x'.repeat(12001)]], 12000).length === 1],
    ['超长行反例', findOverlongLines([['t.md', 'x'.repeat(12000)]], 12000).length === 0],
    [
      '叙事日期正例（豁免后仍有残留）',
      findNarrativeDates([['t.md', '裁定于 2026-10-09，时钟钉 2026-10-01']]).length === 1,
    ],
    [
      '叙事日期反例（仅豁免定值）',
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
console.log('docs/design-system 登记文档闸：全过');

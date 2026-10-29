#!/usr/bin/env node
// check-scenario-boundary.mjs -- scenario protocol boundary verification (dual mode):
//
// Mode A (default): --rendered <html-file> [more.html...]
//   Scans HTML rendered by the onchain-data server (OUTRUN_DATA_SOURCE=onchain):
//   scenario-switching DOM (scenario-selector/degrade-banner/degrade-skeleton) must not appear,
//   and HTML from parameterized requests such as ?scenario=loading must not contain the degrade
//   banner/skeleton (onchain mode neither parses nor injects).
//
// Mode B: --self-test
//   Injects fake HTML containing sentinels into a private temp dir to verify the scanner catches
//   them, and a clean file produces zero hits; the temp dir is removed afterwards (auto cleanup).
//
// The default build (non-onchain env) including selector code is expected behavior -- rendering
// is gated server-side by OUTRUN_DATA_SOURCE, so no chunk scanning is done.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const args = process.argv.slice(2);

const SENTINELS = [
  /scenario-selector/, // floating switch DOM
  /degrade-banner/, // degrade banner DOM
  /degrade-skeleton/, // skeleton DOM
];

function scanHtml(file) {
  const html = readFileSync(file, 'utf8');
  const hits = [];
  for (const re of SENTINELS) {
    if (re.test(html)) hits.push(re.source);
  }
  return hits;
}

if (args.includes('--self-test')) {
  // process.exit skips finally, so failures throw and the exit code is set after cleanup
  const tmp = mkdtempSync(join(tmpdir(), 'scenario-boundary-'));
  try {
    const fake = join(tmp, 'selftest.html');
    writeFileSync(fake, '<div class="scenario-selector"><div class="degrade-banner">x</div></div>');
    if (scanHtml(fake).length < 2) throw new Error('sentinel not intercepted');
    const cleanFile = join(tmp, 'selftest-clean.html');
    writeFileSync(cleanFile, '<main><p>clean onchain-mode html</p></main>');
    if (scanHtml(cleanFile).length > 0) throw new Error('false positive on the clean file');
    console.log(
      'scenario boundary self-test OK: sentinels intercepted, clean file zero false positives',
    );
  } catch (error) {
    console.error(`self-test FAIL: ${error.message}`);
    process.exitCode = 1;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  process.exit(process.exitCode);
}

const files = args.filter((a) => !a.startsWith('--'));
if (files.length === 0) {
  console.error('usage: check-scenario-boundary.mjs --rendered <html...> | --self-test');
  process.exit(2);
}

let violations = 0;
for (const file of files) {
  const hits = scanHtml(file);
  if (hits.length > 0) {
    violations++;
    console.error(` - [scenario-sentinel] ${file}: scenario DOM residue (${hits.join(', ')})`);
  }
}

if (violations > 0) {
  console.error(
    `scenario boundary FAIL: ${violations} file(s) contain scenario-switching residue (onchain mode must not render it)`,
  );
  process.exit(1);
}
console.log(
  `scenario boundary OK: ${files.length} onchain-mode-rendered HTML file(s) with zero scenario-switching residue`,
);

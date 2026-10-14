#!/usr/bin/env node
// check-scenario-boundary.mjs -- scenario protocol boundary verification (dual mode):
//
// Mode A (default): --rendered <html-file> [more.html...]
//   Scans HTML rendered by the production server (OUTRUN_DATA_SOURCE=production):
//   scenario-switching DOM (scenario-selector/degrade-banner/degrade-skeleton) must not appear,
//   and HTML from parameterized requests such as ?scenario=loading must not contain the degrade
//   banner/skeleton (production neither parses nor injects).
//
// Mode B: --self-test
//   Injects fake HTML containing sentinels to verify the scanner catches them, and a clean file
//   produces zero hits.
//
// The default build (non-production env) including selector code is expected behavior -- rendering
// is gated server-side by OUTRUN_DATA_SOURCE, so no chunk scanning is done.
import { readFileSync, writeFileSync } from 'node:fs';

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
  const fake = '/tmp/scenario-boundary-selftest.html';
  writeFileSync(fake, '<div class="scenario-selector"><div class="degrade-banner">x</div></div>');
  const hits = scanHtml(fake);
  if (hits.length < 2) {
    console.error('self-test FAIL: sentinel not intercepted');
    process.exit(1);
  }
  writeFileSync(
    '/tmp/scenario-boundary-selftest-clean.html',
    '<main><p>clean production html</p></main>',
  );
  const clean = scanHtml('/tmp/scenario-boundary-selftest-clean.html');
  if (clean.length > 0) {
    console.error('self-test FAIL: false positive on the clean file');
    process.exit(1);
  }
  console.log(
    'scenario boundary self-test OK: sentinels intercepted, clean file zero false positives',
  );
  process.exit(0);
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
    `scenario boundary FAIL: ${violations} file(s) contain scenario-switching residue (production must not render it)`,
  );
  process.exit(1);
}
console.log(
  `scenario boundary OK: ${files.length} production-rendered HTML file(s) with zero scenario-switching residue`,
);

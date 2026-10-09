#!/usr/bin/env node
// Working-tree integrity check for the docs/design freeze manifest
// (final-artifacts.sha256): every listed path must exist with a matching
// sha256. Deliberately does NOT anchor the superseded stage-01 handoff
// artifactHash — since 2026-10-09 the manifest is maintained as a plain
// integrity list (see docs/design/references/retention-log.md 执行记录);
// any intentional change to frozen trees requires regenerating the manifest
// via scripts/write-design-artifact-manifest.mjs.
// Usage: node scripts/check-design-freeze.mjs [--manifest <file>] [--self-test]
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_MANIFEST = 'docs/design/final-artifacts.sha256';

function verify(manifestPath) {
  const lines = readFileSync(manifestPath, 'utf8').split('\n');
  const bad = [];
  let total = 0;
  for (const line of lines) {
    if (line.trim() === '') continue;
    const m = line.match(/^([0-9a-f]{64}) {2}(.+)$/);
    if (!m) {
      bad.push({ path: line, kind: 'unparseable-line' });
      continue;
    }
    total++;
    const [, expected, path] = m;
    let buf;
    try {
      buf = readFileSync(path);
    } catch {
      bad.push({ path, kind: 'missing' });
      continue;
    }
    const actual = createHash('sha256').update(buf).digest('hex');
    if (actual !== expected) bad.push({ path, kind: 'drift' });
  }
  return { total, bad };
}

function report({ total, bad }, manifestPath) {
  for (const { path, kind } of bad) console.error(`FREEZE ${kind.toUpperCase()}: ${path}`);
  if (bad.length) {
    console.error(`check-design-freeze: ${bad.length} bad of ${total} entries in ${manifestPath}`);
    process.exit(1);
  }
  console.log(`check-design-freeze: all ${total} entries OK (${manifestPath})`);
}

const args = process.argv.slice(2);
if (args.includes('--self-test')) {
  const dir = mkdtempSync(join(tmpdir(), 'freeze-selftest-'));
  try {
    const manifest = join(dir, 'manifest.sha256');
    const keep = join(dir, 'keep.txt');
    writeFileSync(keep, 'frozen-content');
    const good = `${createHash('sha256').update(readFileSync(keep)).digest('hex')}  ${keep}`;
    const results = [];
    results.push([
      'baseline all-OK passes',
      (() => {
        writeFileSync(manifest, `${good}\n`);
        const r = verify(manifest);
        return r.total === 1 && r.bad.length === 0;
      })(),
    ]);
    results.push([
      'missing file detected',
      (() => {
        writeFileSync(manifest, `${good}\n${'0'.repeat(64)}  ${join(dir, 'gone.txt')}\n`);
        const r = verify(manifest);
        return r.bad.length === 1 && r.bad[0].kind === 'missing';
      })(),
    ]);
    results.push([
      'drifted content detected',
      (() => {
        writeFileSync(manifest, `${'1'.repeat(64)}  ${keep}\n`);
        const r = verify(manifest);
        return r.bad.length === 1 && r.bad[0].kind === 'drift';
      })(),
    ]);
    results.push([
      'unparseable line detected',
      (() => {
        writeFileSync(manifest, `not-a-manifest-line\n`);
        const r = verify(manifest);
        return r.bad.length === 1 && r.bad[0].kind === 'unparseable-line';
      })(),
    ]);
    const failed = results.filter(([, ok]) => !ok);
    for (const [name, ok] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
    if (failed.length) process.exit(1);
    console.log('self-test: all verdicts correct');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
} else {
  const idx = args.indexOf('--manifest');
  const manifestPath = idx >= 0 ? args[idx + 1] : DEFAULT_MANIFEST;
  report(verify(manifestPath), manifestPath);
}

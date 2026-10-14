#!/usr/bin/env node
// Working-tree integrity gate for the design-freeze manifest
// (final-artifacts.sha256), bidirectional: every listed path must exist with
// a matching sha256, AND every file inside the watched trees (scope shared
// with the writer via scripts/design-freeze-trees.mjs) must be listed —
// untracked additions inside the trees fail as UNLISTED, which is what
// catches stray files that were never added to the manifest.
// Any intentional change to watched trees requires regenerating the manifest
// via scripts/write-design-artifact-manifest.mjs.
// Usage: node scripts/check-design-freeze.mjs [--manifest <file>] [--self-test]
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectTreeFiles } from './design-freeze-trees.mjs';

const DEFAULT_MANIFEST = 'docs/design/final-artifacts.sha256';

function verify(manifestPath, treeFiles = []) {
  const lines = readFileSync(manifestPath, 'utf8').split('\n');
  const bad = [];
  const listed = new Set();
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
    listed.add(path);
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
  const unlisted = treeFiles.filter((p) => !listed.has(p) && p !== manifestPath);
  return { total, bad, unlisted };
}

function report({ total, bad, unlisted }, manifestPath) {
  for (const { path, kind } of bad) console.error(`FREEZE ${kind.toUpperCase()}: ${path}`);
  for (const path of unlisted) console.error(`FREEZE UNLISTED: ${path}`);
  if (bad.length || unlisted.length) {
    console.error(
      `check-design-freeze: ${bad.length} bad of ${total} entries, ${unlisted.length} unlisted tree files (${manifestPath})`,
    );
    process.exit(1);
  }
  console.log(
    `check-design-freeze: all ${total} entries OK, no unlisted tree files (${manifestPath})`,
  );
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
        return r.total === 1 && r.bad.length === 0 && r.unlisted.length === 0;
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
    results.push([
      'unlisted tree file detected',
      (() => {
        const a = join(dir, 'a.txt');
        const b = join(dir, 'b.txt');
        writeFileSync(a, 'a');
        writeFileSync(b, 'b');
        const hashA = `${createHash('sha256').update(readFileSync(a)).digest('hex')}  ${a}`;
        writeFileSync(manifest, `${hashA}\n`); // lists a, omits b
        const r = verify(manifest, [a, b]);
        return r.bad.length === 0 && r.unlisted.length === 1 && r.unlisted[0] === b;
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
  report(verify(manifestPath, collectTreeFiles()), manifestPath);
}

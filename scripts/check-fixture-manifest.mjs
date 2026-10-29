#!/usr/bin/env node
// check-fixture-manifest.mjs -- working-tree integrity gate for fixtures/manifest.json
//
// Bidirectional check, paired with scripts/write-fixture-manifest.mjs:
//   1) every file under fixtures/ (except manifest.json itself) is listed with a matching
//      byte size and sha256;
//   2) every listed entry still exists on disk.
// The manifest's own entry is fixed as "self" and skipped (no recursion).
//
// Intentional fixture changes require regenerating the manifest first:
//   node scripts/write-fixture-manifest.mjs
//
// Usage: node scripts/check-fixture-manifest.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';

const MANIFEST = 'fixtures/manifest.json';

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`],
  );
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const listed = manifest.items ?? {};
const files = walk('fixtures')
  .filter((f) => f !== MANIFEST)
  .sort();

const bad = [];
for (const file of files) {
  const entry = listed[file];
  if (!entry) {
    bad.push(`UNLISTED ${file}`);
    continue;
  }
  const bytes = statSync(file).size;
  const sha256 = createHash('sha256').update(readFileSync(file)).digest('hex');
  if (entry.bytes !== bytes || entry.sha256 !== sha256) bad.push(`DRIFT ${file}`);
}
for (const file of Object.keys(listed)) {
  if (file !== MANIFEST && !files.includes(file)) bad.push(`MISSING ${file}`);
}

if (bad.length > 0) {
  for (const item of bad) console.error(` - [fixture-manifest] ${item}`);
  console.error(
    `fixture manifest FAIL: ${bad.length} item(s); regenerate with node scripts/write-fixture-manifest.mjs`,
  );
  process.exit(1);
}
console.log(`fixture manifest OK: ${files.length} files match fixtures/manifest.json`);

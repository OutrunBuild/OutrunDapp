#!/usr/bin/env node
// Generates fixtures/manifest.json:
// relative path + byte size + SHA256 for every fixture file; the manifest's own entry hash is fixed
// as "self" (no recursion).
// Determinism: sorted traversal, fixed JSON serialization (2-space indent + trailing newline);
// repeated runs are byte-identical.
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = 'fixtures';
const manifestPath = `${root}/manifest.json`;

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`],
  );
}

const files = walk(root)
  .filter((f) => f !== manifestPath)
  .sort();
const items = {};
for (const f of files) {
  items[f] = {
    bytes: statSync(f).size,
    sha256: createHash('sha256').update(readFileSync(f)).digest('hex'),
  };
}
const manifest = {
  note: 'fixture frozen manifest; own entry hash=self, no recursion; regenerate: node scripts/write-fixture-manifest.mjs (byte-deterministic output)',
  items: { ...items, [manifestPath]: { bytes: 0, sha256: 'self' } },
};
const out = JSON.stringify(manifest, null, 2) + '\n';

if (existsSync(manifestPath) && readFileSync(manifestPath, 'utf8') !== out) {
  console.log('manifest regenerated (content changed)');
}
writeFileSync(manifestPath, out);
console.log(`manifest: ${files.length} files + self`);

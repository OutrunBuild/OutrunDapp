#!/usr/bin/env node
// Stage-01 14B: write docs/design/final-artifacts.sha256 — the frozen manifest of
// every stage-1 design artifact (excluding the handoff doc and this manifest
// itself). Include the reference inboxes (canonical + legacy), revision chain,
// review screenshots, and root runtime control files that exist.
// Usage: node scripts/write-design-artifact-manifest.mjs --output <file> [--exclude <path>]...
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { relative, join } from 'node:path';

const args = process.argv.slice(2);
const outIdx = args.indexOf('--output');
const OUT = outIdx >= 0 ? args[outIdx + 1] : 'docs/design/final-artifacts.sha256';
const EXCLUDES = new Set(args.filter((_, i) => args[i - 1] === '--exclude'));

const ROOT = process.cwd();
const ALWAYS_EXCLUDE = new Set([
  'docs/design/stage-01-handoff.md',
  OUT,
  'docs/design/final-artifacts.sha256',
]);

// scope: everything produced/frozen by stage 1 + pre-existing runtime control files
const TREES = [
  'DESIGN.md',
  'PRODUCT.md',
  '.node-version',
  '.prettierrc.json',
  '.prettierignore',
  'docs/design/brand',
  'docs/design/logo-variants',
  'docs/design/references',
  'docs/design/directions',
  'docs/design/direction-seeds',
  'docs/design/review',
  'docs/design/decision-log.md',
  'docs/design/round-00-anchor.md',
  'docs/design/diff-round-01.md',
  'docs/design/approval-payload.json',
  'docs/design/stage-02-inputs.md',
  'docs/design/self-review-01.md',
  'docs/design/qa-round-00.md',
  'docs/design/skill-evidence.md',
  'docs/design/v0-input/round-00',
  'docs/design/v0-input/round-00-lite',
  'docs/design/v0-input/round-00-revisions.json',
  'scripts/build-design-input-manifest.mjs',
  'scripts/record-v0-revision.mjs',
  'scripts/write-design-artifact-manifest.mjs',
  'scripts/check-design-freeze.mjs',
  'scripts/check-runtime.mjs',
  'scripts/bootstrap-pnpm.mjs',
];

async function walk(p) {
  const st = await stat(p).catch(() => null);
  if (!st) return [];
  if (st.isFile()) return [p];
  const out = [];
  for (const e of await readdir(p, { withFileTypes: true })) {
    if (e.name === '.DS_Store') continue;
    out.push(...(await walk(join(p, e.name))));
  }
  return out;
}

const lines = [];
let count = 0;
for (const t of TREES) {
  for (const abs of await walk(join(ROOT, t))) {
    const rel = relative(ROOT, abs);
    if (ALWAYS_EXCLUDE.has(rel) || EXCLUDES.has(rel)) continue;
    const buf = await readFile(abs);
    lines.push(`${createHash('sha256').update(buf).digest('hex')}  ${rel}`);
    count++;
  }
}
lines.sort((a, b) => a.slice(66).localeCompare(b.slice(66)));
await writeFile(OUT, lines.join('\n') + '\n');
console.log(`final-artifacts.sha256: ${count} files frozen → ${OUT}`);

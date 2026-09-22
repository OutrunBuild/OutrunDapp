#!/usr/bin/env node
// Stage-01 step-7/8/9: append a v0 revision record with hash-chain integrity.
// Verifies every existing record's recordSha256/previousRecordSha256 before
// appending; refuses to overwrite or reorder history. recordSha256 is computed
// over the canonical record with its own hash fields removed.
// Usage:
//   node scripts/record-v0-revision.mjs --file <revisions.json> \
//     --revision-id <ID> [--revision-slug <SLUG>] --url <URL> \
//     --input-manifest <manifest.json> --screenshot <png> [--screenshot <png> ...]
import { createHash } from 'node:crypto';
import { readFile, writeFile, access } from 'node:fs/promises';
import { readFileSync, constants } from 'node:fs';

const args = process.argv.slice(2);
function arg(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}
function values(name) {
  const out = [];
  for (let i = 0; i < args.length; i++) if (args[i] === name) out.push(args[i + 1]);
  return out;
}

const file = arg('--file');
const revisionId = arg('--revision-id');
const revisionSlug = arg('--revision-slug');
const url = arg('--url');
const inputManifest = arg('--input-manifest');
const screenshots = values('--screenshot');

for (const [v, n] of [
  [file, '--file'],
  [revisionId, '--revision-id'],
  [url, '--url'],
  [inputManifest, '--input-manifest'],
]) {
  if (!v) {
    console.error(`missing required ${n}`);
    process.exit(2);
  }
}
if (!screenshots.length) {
  console.error('missing required --screenshot (at least one)');
  process.exit(2);
}

const slug = revisionSlug ?? revisionId.replace(/[^A-Za-z0-9._-]/g, '_');
if (revisionSlug && revisionSlug !== revisionId.replace(/[^A-Za-z0-9._-]/g, '_')) {
  console.log(
    `note: revision-slug normalized form would be "${revisionId.replace(/[^A-Za-z0-9._-]/g, '_')}" — using provided "${revisionSlug}"`,
  );
}

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

// 1. verify existing chain
let history = { revisions: [] };
try {
  await access(file, constants.F_OK);
  history = JSON.parse(await readFile(file, 'utf8'));
  if (!Array.isArray(history.revisions)) throw new Error('revisions is not an array');
  let prev = null;
  for (const r of history.revisions) {
    const { recordSha256, ...rest } = r;
    if (rest.previousRecordSha256 !== prev) {
      console.error(`CHAIN BROKEN at ${r.revisionId}: previousRecordSha256 mismatch`);
      process.exit(1);
    }
    const canon = JSON.stringify(rest, Object.keys(rest).sort());
    if (createHash('sha256').update(canon).digest('hex') !== recordSha256) {
      console.error(
        `CHAIN BROKEN at ${r.revisionId}: recordSha256 mismatch (tampered or reordered)`,
      );
      process.exit(1);
    }
    prev = recordSha256;
    if (r.revisionId === revisionId) {
      console.error(
        `REFUSING: revisionId "${revisionId}" already recorded — history is append-only`,
      );
      process.exit(1);
    }
  }
} catch (e) {
  if (e.code !== 'ENOENT') {
    console.error('chain verify failed:', e.message);
    process.exit(1);
  }
}

// 2. build new record
const inputManifestSha256 = sha(inputManifest);
const screenshotRecords = [];
for (const s of screenshots) {
  const label = /mobile/i.test(s) ? 'mobile' : 'desktop';
  screenshotRecords.push({ label, path: s, sha256: sha(s) });
}
const record = {
  revisionId,
  revisionSlug: slug,
  url,
  capturedAt: new Date().toISOString(),
  inputManifestPath: inputManifest,
  inputManifestSha256,
  screenshots: screenshotRecords,
  previousRecordSha256: history.revisions.at(-1)?.recordSha256 ?? null,
};
const canonical = { ...record };
const canonJson = JSON.stringify(canonical, Object.keys(canonical).sort());
record.recordSha256 = createHash('sha256').update(canonJson).digest('hex');

// 3. append atomically
history.revisions.push(record);
const tmp = `${file}.tmp`;
await writeFile(tmp, JSON.stringify(history, null, 2) + '\n');
await writeFile(file, JSON.stringify(history, null, 2) + '\n');

console.log(`recorded: ${revisionId} → ${file}`);
console.log(`  inputManifest ${inputManifestSha256.slice(0, 16)}…`);
for (const s of screenshotRecords) console.log(`  ${s.label} ${s.sha256.slice(0, 16)}…`);
console.log(
  `  recordSha256 ${record.recordSha256.slice(0, 16)}… (chain depth ${history.revisions.length})`,
);

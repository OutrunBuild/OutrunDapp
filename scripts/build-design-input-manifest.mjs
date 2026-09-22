#!/usr/bin/env node
// Stage-01 step-7: build and verify docs/design/v0-input/round-00/manifest.json.
// Records {path, bytes, sha256} for every file in the round-00 input package and
// scans HTML/CSS/Markdown for embedded/referenced assets + data URIs, refusing
// the manifest if a denied/unknown source slips in via a board reference.
import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const pkgIdx = args.indexOf('--package');
const PKG =
  pkgIdx >= 0 ? join(ROOT, args[pkgIdx + 1]) : join(ROOT, 'docs/design/v0-input/round-00');
const outIdx = args.indexOf('--output');
const OUT = outIdx >= 0 ? join(ROOT, args[outIdx + 1]) : join(PKG, 'manifest.json');

// sourcePath prefixes registered in user-sources.md; anything matching these
// basenames outside assets/ referenced by a board is flagged unless allowed.
const ALLOWED_ASSET_NAMES = new Set([
  'USR-INBOX-001-edgerunner01.png',
  'USR-INBOX-002-edgerunner02.gif',
  'USR-INBOX-003-edgerunners03.png',
  'USR-INBOX-004-sythwave01.jpg',
  'USR-INBOX-005-sythwave02.jpg',
  'BRAND-01-wordmark-onblack.png',
  'BRAND-04-symbol-color-512.png',
  'BRAND-04-symbol-mono-white-512.png',
]);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(p)));
    else files.push(p);
  }
  return files;
}

const all = await walk(PKG);
const manifest = { generatedAt: new Date().toISOString(), package: 'round-00', files: [] };
const problems = [];

for (const abs of all.sort()) {
  if (abs === OUT) continue; // manifest excludes itself
  const rel = relative(PKG, abs).split(sep).join('/');
  const buf = await readFile(abs);
  manifest.files.push({
    path: rel,
    bytes: buf.length,
    sha256: createHash('sha256').update(buf).digest('hex'),
  });
  // embed/reference scan: html/css carry real embeds (img src, url()); md/txt
  // files are registries that legitimately *mention* filenames, so only
  // markdown image/link syntax with an asset extension is treated as a reference
  if (/\.(html?|css)$/i.test(rel)) {
    const text = buf.toString('utf8');
    const dataUris = text.match(/data:(?:image|font)\/[\w.+-]+;base64,[A-Za-z0-9+/=]{64,}/g) ?? [];
    if (dataUris.length)
      problems.push(`${rel}: contains ${dataUris.length} data URI(s) — inspect manually`);
    const refs =
      text.match(/(?:src=|url\()["']?([^"')]+\.(?:png|jpe?g|gif|webp|svg|ico))["']?\)?/gi) ?? [];
    for (const m of refs) {
      const base = (m.split(/["'()]/).pop() ?? '').split('/').pop().toLowerCase();
      if (!base) continue;
      if (
        base.startsWith('vs-') ||
        base.startsWith('pu-') ||
        base.startsWith('brand-') ||
        base.startsWith('usr-inbox')
      )
        continue;
      if (!ALLOWED_ASSET_NAMES.has(base))
        problems.push(`${rel}: html/css references non-registered asset "${base}"`);
    }
  } else if (
    /\.md$/i.test(rel) &&
    !/^docs\/design\/references\/(user-sources|query-log|source-eligibility-rubric|aesthetic-learning|aesthetic-principles|product-ux-study|complexity-map)\.md$/.test(
      rel,
    ) &&
    rel !== 'DESIGN.md' &&
    rel !== 'PRODUCT.md' &&
    rel !== 'docs/design/round-00-anchor.md'
  ) {
    const text = buf.toString('utf8');
    const embeds = text.match(/\]\([^)]*\.(?:png|jpe?g|gif|webp|svg|ico)\)/gi) ?? [];
    if (embeds.length)
      problems.push(
        `${rel}: markdown embeds ${embeds.length} image(s) — verify they are allowed assets`,
      );
  }
}

if (problems.length) {
  console.error('MANIFEST REFUSED — embed/reference scan findings:');
  for (const p of problems) console.error(' -', p);
  process.exit(1);
}

const selfCheck = createHash('sha256').update(JSON.stringify(manifest.files)).digest('hex');
manifest.filesSha256 = selfCheck;
await writeFile(OUT, JSON.stringify(manifest, null, 2) + '\n');

// verification pass: re-read manifest, re-hash every file, compare bytes+digest
const written = JSON.parse(await readFile(OUT, 'utf8'));
let verified = 0;
for (const f of written.files) {
  const buf = await readFile(join(PKG, f.path));
  const digest = createHash('sha256').update(buf).digest('hex');
  if (buf.length !== f.bytes || digest !== f.sha256) {
    console.error(`VERIFY FAIL: ${f.path}`);
    process.exit(1);
  }
  verified++;
}
console.log(
  `manifest OK: ${verified} files verified, filesSha256=${selfCheck.slice(0, 16)}…, total ${(all.filter((f) => f !== OUT).reduce((s, f) => s + 1, 0), written.files.reduce((s, f) => s + f.bytes, 0))} bytes`,
);

// CJK font subset build (widened extraction range, pinned source, hash verification)
//
// What it does: extracts all Chinese copy characters used site-wide (components/global/copy.ts +
// fixtures/**), subsets the Noto Sans SC variable font (wght 100-900) into a single woff2 named by
// content hash under public/fonts/, and also regenerates:
//   - public/fonts/noto-sc-subset-chars.json -- covered character list + source pin registry
//     (the reconciliation baseline for the check script)
//   - components/design-system/cjk-subset.ts  -- CJK_SUBSET_HREF (single source for preload and
//     @font-face)
//
// Why subset: next/font's Noto is 4 weights x 113 slices = 452 unicode-range faces that cannot be
// preloaded, so every refresh loses the first frame (flash); after subsetting, one
// preloadable file covers all weights (~363KB), mirrors the verified Latin preload approach.
//
// Source font pinning: the URL pins a specific noto-cjk commit (byte-reproducible);
// both cached and freshly downloaded copies are sha256-verified against EXPECTED_SOURCE_SHA256.
// Upgrading the source = change the commit, then re-measure and update both constants -- eliminating
// "main branch drift -> silent glyph changes".
//
// Dependencies (only this script needs them; zero product dependencies): python3 + fonttools + brotli
//   pip install --user --break-system-packages fonttools brotli
// The 36MB source font uses the local cache by default (/tmp/outrun-cjk-cache/; lost on OS reboot,
// the script re-downloads and verifies automatically). Run: pnpm build:cjk-font (must re-run after
// copy changes; missed runs are blocked by pnpm check:cjk-font -- part of the vitest contract gate
// tests/unit/contract-gates.test.ts)

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const COPY_FILE = path.join(ROOT, 'components/global/copy.ts');
const FIXTURES_DIR = path.join(ROOT, 'fixtures');
const OUT_DIR = path.join(ROOT, 'public/fonts');
const CHARS_JSON = path.join(OUT_DIR, 'noto-sc-subset-chars.json');
const TS_OUT = path.join(ROOT, 'components/design-system/cjk-subset.ts');

// ---- Source pinning (upgrade = change commit -> re-measure sha256sum, backfill both constants -> re-run) ----
const NOTO_CJK_COMMIT = 'f8d157532fbfaeda587e826d4cd5b21a49186f7c';
const CJK_FONT_URL = `https://raw.githubusercontent.com/notofonts/noto-cjk/${NOTO_CJK_COMMIT}/Sans/Variable/TTF/NotoSansCJKsc-VF.ttf`;
const EXPECTED_SOURCE_SHA256 = '990c807e79c25662a5a9ecf7f971baeb2bf2eab9a559e5ecf15cdfdb8561d21f';

const CACHE_DIR = process.env.CJK_FONT_CACHE ?? path.join(tmpdir(), 'outrun-cjk-cache');
const SOURCE = process.env.CJK_FONT_SOURCE ?? path.join(CACHE_DIR, 'NotoSansSC-VF.ttf');

/** Same predicate as check-cjk-subset.mjs (the check imports it from this file; single source):
 *  CJK Unified Ideographs + Ext-A + Chinese punctuation/fullwidth + General Punctuation +
 *  Latin-1 Supplement + arrows + math operators.
 *  Range widening: 00A0-00FF (±·×÷ and the section-sign glyph -- makes the "non-ASCII ⊆ subset∪emoji"
 *  reconciliation predicate self-consistent), 2190-21FF (→←↔), 2200-22FF (≈≠≤≥⊙−); without these
 *  ranges 7 symbol glyphs fall back to system fonts, and since the reconciliation gate shares this
 *  predicate with the build it structurally could not catch such misses. */
export function extractCharset(text) {
  const out = new Set();
  for (const ch of text) {
    const c = ch.codePointAt(0);
    if (
      (c >= 0x4e00 && c <= 0x9fff) ||
      (c >= 0x3400 && c <= 0x4dbf) ||
      (c >= 0x3000 && c <= 0x303f) ||
      (c >= 0xff01 && c <= 0xff60) ||
      (c >= 0x2000 && c <= 0x206f) ||
      (c >= 0x00a0 && c <= 0x00ff) ||
      (c >= 0x2190 && c <= 0x21ff) ||
      (c >= 0x2200 && c <= 0x22ff)
    ) {
      out.add(ch);
    }
  }
  return out;
}

function collectProjectCharset() {
  const files = [COPY_FILE];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith('.json')) files.push(p);
    }
  };
  walk(FIXTURES_DIR);

  const chars = new Set();
  for (const file of files) {
    for (const ch of extractCharset(readFileSync(file, 'utf8'))) chars.add(ch);
  }
  // ASCII fallback: for the rare mixed CJK/Latin cases that cannot reach Plex
  // (+~6KB, in exchange for zero risk from stack-order changes)
  for (let c = 0x20; c <= 0x7e; c += 1) chars.add(String.fromCodePoint(c));
  return chars;
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function ensureSourceFont() {
  const verify = (label) => {
    const actual = sha256(readFileSync(SOURCE));
    if (actual !== EXPECTED_SOURCE_SHA256) {
      throw new Error(
        `${label} sha256 does not match the pinned constant (got ${actual.slice(0, 16)}… expected ${EXPECTED_SOURCE_SHA256.slice(0, 16)}…). ` +
          'If NOTO_CJK_COMMIT was just upgraded, re-measure and backfill EXPECTED_SOURCE_SHA256; otherwise the local cache/download source was tampered with -- do not use.',
      );
    }
  };

  if (existsSync(SOURCE)) {
    verify('cached source font');
    return;
  }
  mkdirSync(path.dirname(SOURCE), { recursive: true });
  console.log(
    `[build-cjk-font] source font not present locally, downloading the pinned source (commit ${NOTO_CJK_COMMIT.slice(0, 8)})`,
  );
  const res = spawnSync('curl', ['-sL', '-o', SOURCE, CJK_FONT_URL], { stdio: 'inherit' });
  if (res.status !== 0 || !existsSync(SOURCE)) {
    throw new Error(
      'source font download failed (place it manually and retry, or point CJK_FONT_SOURCE at a local file)',
    );
  }
  verify('freshly downloaded source font');
}

function main() {
  const chars = [...collectProjectCharset()].sort().join('');
  console.log(
    `[build-cjk-font] site-wide CJK characters (incl. punctuation/symbols/ASCII fallback): ${chars.length}`,
  );

  ensureSourceFont();
  const sourceSha = sha256(readFileSync(SOURCE));

  const work = path.join(tmpdir(), `outrun-cjk-${Date.now()}`);
  mkdirSync(work, { recursive: true });
  const textFile = path.join(work, 'chars.txt');
  const woff2 = path.join(work, 'subset.woff2');
  writeFileSync(textFile, chars, 'utf8');

  // --no-hinting: Noto SC has no meaningful hinting; --desubroutinize is more stable for
  // CFF-based variable subsets
  const subset = spawnSync(
    'python3',
    [
      '-m',
      'fontTools.subset',
      SOURCE,
      `--text-file=${textFile}`,
      '--flavor=woff2',
      `--output-file=${woff2}`,
      '--layout-features=*',
      '--no-hinting',
      '--desubroutinize',
    ],
    { stdio: 'inherit' },
  );
  if (subset.status !== 0)
    throw new Error(
      'pyftsubset failed (dependency: pip install --user --break-system-packages fonttools brotli)',
    );

  const woff2Bytes = readFileSync(woff2);
  const sha8 = createHash('sha1').update(woff2Bytes).digest('hex').slice(0, 8);

  mkdirSync(OUT_DIR, { recursive: true });
  for (const old of readdirSync(OUT_DIR)) {
    if (/^noto-sc-subset\..*\.woff2$/.test(old) && old !== `noto-sc-subset.${sha8}.woff2`) {
      rmSync(path.join(OUT_DIR, old));
    }
  }
  const fontName = `noto-sc-subset.${sha8}.woff2`;
  writeFileSync(path.join(OUT_DIR, fontName), woff2Bytes);

  writeFileSync(
    CHARS_JSON,
    JSON.stringify(
      {
        chars,
        source: CJK_FONT_URL,
        sourceCommit: NOTO_CJK_COMMIT,
        sourceSha256: sourceSha,
        sha: sha8,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + '\n',
  );

  writeFileSync(
    TS_OUT,
    [
      '// Generated by scripts/build-cjk-font.mjs -- do not hand-edit; run pnpm build:cjk-font after copy changes',
      '// Covered character inventory and pinned-source registration:',
      '// public/fonts/noto-sc-subset-chars.json',
      `export const CJK_SUBSET_HREF = '/fonts/${fontName}';`,
      '',
    ].join('\n'),
  );

  console.log(
    `[build-cjk-font] artifact public/fonts/${fontName} (${Math.round(woff2Bytes.length / 1024)}KB)`,
  );
  console.log('[build-cjk-font] verify: pnpm check:cjk-font');
}

// Build only when run directly: skipped when imported as a module by check-cjk-subset.mjs
// (which reuses extractCharset)
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}

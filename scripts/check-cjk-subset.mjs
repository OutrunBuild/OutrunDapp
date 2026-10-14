// CJK font subset reconciliation gate (dual predicates eliminate the shared-predicate blind spot):
//   Predicate 1: characters extracted from the site-copy corpus (components/global/copy.ts +
//     fixtures/**/*.json) ⊆ the deployed subset coverage list --
//     catches "copy changed but the subset was not rebuilt";
//   Predicate 2: all non-ASCII characters of that corpus ⊆ subset ∪ emoji whitelist --
//     catches characters outside the extraction range that predicate 1 structurally cannot see
//     (→ ≈ ≤ ≥ ⊙ etc. would otherwise silently fall back to system fonts). Emoji rendering via
//     the system emoji font is correct behavior (Noto Sans SC does not contain them anyway),
//     hence the whitelist.
// When either predicate fails, per-item fix guidance is given. Run: pnpm check:cjk-font (a vitest
// contract gate also runs this script). Self-test: pnpm check:cjk-font -- --self-test
// -- injects one rare Han char (predicate 1) and one "✓" (predicate 2), expecting this gate to
// fail (verifies both wires of the gate itself are live).

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHARS_JSON = path.join(ROOT, 'public/fonts/noto-sc-subset-chars.json');
const TS_REF = path.join(ROOT, 'components/design-system/cjk-subset.ts');
const OUT_DIR = path.join(ROOT, 'public/fonts');

const { extractCharset } = await import('./build-cjk-font.mjs');

/** Emoji whitelist (predicate 2 allowance zone): emoji main+supplementary blocks + Miscellaneous
 *  Symbols block + variation selector / zero-width joiner */
const isEmoji = (c) =>
  (c >= 0x1f000 && c <= 0x1faff) || (c >= 0x2600 && c <= 0x26ff) || c === 0xfe0f || c === 0x200d;

function collectProjectText() {
  const files = [path.join(ROOT, 'components/global/copy.ts')];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith('.json')) files.push(p);
    }
  };
  walk(path.join(ROOT, 'fixtures'));
  return files.map((f) => readFileSync(f, 'utf8'));
}

const selfTest = process.argv.includes('--self-test');
const failures = [];

if (!existsSync(CHARS_JSON)) {
  failures.push('public/fonts/noto-sc-subset-chars.json missing -- run pnpm build:cjk-font first');
} else {
  const manifest = JSON.parse(readFileSync(CHARS_JSON, 'utf8'));
  const covered = new Set(manifest.chars);

  // artifact files vs. href reference consistency
  const woff2s = readdirSync(OUT_DIR).filter((f) => /^noto-sc-subset\.[0-9a-f]{8}\.woff2$/.test(f));
  if (woff2s.length !== 1) {
    failures.push(
      `public/fonts must hold exactly 1 hashed artifact, found ${woff2s.length}: ${woff2s.join(', ')}`,
    );
  }
  const ts = existsSync(TS_REF) ? readFileSync(TS_REF, 'utf8') : '';
  const href = ts.match(/CJK_SUBSET_HREF = '([^']+)'/)?.[1];
  if (!href) {
    failures.push(
      'components/design-system/cjk-subset.ts missing CJK_SUBSET_HREF -- re-run pnpm build:cjk-font',
    );
  } else if (!existsSync(path.join(ROOT, 'public', href.slice(1)))) {
    failures.push(`${href} referenced by CJK_SUBSET_HREF does not exist`);
  }

  const texts = collectProjectText();

  // Predicate 1: in-range extracted chars ⊆ subset coverage (copy changed -> rebuild the subset)
  const extracted = new Set();
  for (const text of texts) {
    for (const ch of extractCharset(text)) extracted.add(ch);
  }
  const missing = [...extracted].filter((ch) => !covered.has(ch));
  if (selfTest) missing.push('瘸'); // self-test line 1: a rare Han char outside the range, never in the subset
  if (missing.length > 0) {
    failures.push(
      `predicate 1: subset does not cover ${missing.length} character(s) (would fall back to system fonts): ${missing.join('')} -- run pnpm build:cjk-font to re-cut`,
    );
  }

  // Predicate 2: all non-ASCII ⊆ subset ∪ emoji whitelist (out-of-range chars are structurally
  // invisible to predicate 1)
  const nonAsciiOutside = new Set();
  for (const text of texts) {
    for (const ch of text) {
      const c = ch.codePointAt(0);
      if (
        c > 0x7e &&
        ch !== '\n' &&
        ch !== '\r' &&
        ch !== '\t' &&
        !isEmoji(c) &&
        !covered.has(ch)
      ) {
        nonAsciiOutside.add(ch);
      }
    }
  }
  if (selfTest) nonAsciiOutside.add('✓'); // self-test line 2: U+2713 is non-ASCII non-emoji, outside range∪subset
  if (nonAsciiOutside.size > 0) {
    failures.push(
      `predicate 2: ${nonAsciiOutside.size} non-ASCII character(s) outside the extraction range and the subset (fall back to system fonts, invisible to predicate 1): ` +
        `${[...nonAsciiOutside].join('')} -- widen the ranges in scripts/build-cjk-font.mjs extractCharset, then run pnpm build:cjk-font`,
    );
  }
}

if (failures.length > 0) {
  console.error(
    selfTest
      ? '✓ self-test as expected (gate correctly failed on uncovered characters):'
      : '✗ CJK subset reconciliation failed:',
  );
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(selfTest ? 0 : 1);
}

if (selfTest) {
  console.error('✗ self-test state did not trigger a failure: the gate itself has a bug');
  process.exit(1);
}
console.log(
  '✓ CJK subset reconciliation passed: all site copy characters are covered by the subset (dual predicates); artifacts and href reference consistent',
);

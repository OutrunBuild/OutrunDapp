#!/usr/bin/env node
// check-design-contrast.mjs -- token contrast gate (turns the design doc's registered measured
// contrast values into a regression-verifiable gate)
// Usage:
//   node scripts/check-design-contrast.mjs              parse tokens.css and compute WCAG contrast per
//     the pairing table
//   node scripts/check-design-contrast.mjs --self-test   built-in known-value checks
//     (black/white 21:1, #767676/white ~4.54:1, the registered text and accent-on-surface doc
//     values, and 3-digit shorthand)
// Two gates:
//   1) Regression gate: computed value < minimum threshold (body 4.5:1; large text/graphics 3:1) -> FAIL
//   2) Drift gate: differs from the registered doc value (the `doc` field in the pairing table)
//      by > 0.05 -> FAIL
//      (token changed without syncing the doc, or the doc is wrong without syncing the token)
// Pairing table basis: doc values are all measured "on --color-surface";
// disabled pairings are noted separately.
// When adding/modifying token colors: first update the design doc + the tokens.css comment,
// then sync the doc values in this table.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { argv, cwd, exit } from 'node:process';

const args = new Set(argv.slice(2));
const ROOT = cwd();
const TOKENS_PATH = join(ROOT, 'components/design-system/tokens.css');

// ---- WCAG relative luminance and contrast ----
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h.slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
}
function channelLum(c) {
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(channelLum);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(fg, bg) {
  const [l1, l2] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}

// ---- tokens.css parsing: --name: #hex / --name: var(--other) (one level of resolution) ----
function parseTokens(css) {
  const map = {};
  for (const m of css.matchAll(/^\s*(--[\w-]+)\s*:\s*([^;]+);/gm)) {
    map[m[1]] = m[2].trim();
  }
  // Resolve var() references down to the final hex (--color-bg -> --site-black -> #0A0A10)
  const resolve = (name, seen = new Set()) => {
    const v = map[name];
    if (!v || seen.has(name)) return null;
    seen.add(name);
    if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return v.slice(0, 7) === v || v.length <= 7 ? v : v;
    const ref = /^var\((--[\w-]+)\)$/.exec(v);
    return ref ? resolve(ref[1], seen) : null;
  };
  for (const name of Object.keys(map)) map[name] = resolve(name) ?? map[name];
  return map;
}

// ---- Pairing table: fg / bg are token names; doc = the registered measured value in the design
// doc (null = not registered in the doc, regression gate only); min = WCAG floor ----
const PAIRS = [
  // on --color-surface (doc basis)
  { fg: '--color-text', bg: '--color-surface', doc: 15.14, min: 4.5, why: 'body text AAA' },
  {
    fg: '--color-text-secondary',
    bg: '--color-surface',
    doc: 7.25,
    min: 4.5,
    why: 'secondary text AAA',
  },
  {
    fg: '--color-text-tertiary',
    bg: '--color-surface',
    doc: 5.8,
    min: 4.5,
    why: 'tertiary text AA',
  },
  {
    fg: '--accent-primary',
    bg: '--color-surface',
    doc: 15.22,
    min: 3.0,
    why: 'CTA/KPI readings (>=20px large-text tier)',
  },
  { fg: '--color-success', bg: '--color-surface', doc: 10.69, min: 4.5, why: 'status text AAA' },
  { fg: '--color-danger', bg: '--color-surface', doc: 5.89, min: 4.5, why: 'status text AA' },
  {
    fg: '--color-warning',
    bg: '--color-surface',
    doc: 10.27,
    min: 4.5,
    why: 'status text (warning color, AA tier)',
  },
  {
    fg: '--accent-link',
    bg: '--color-surface',
    doc: 13.06,
    min: 4.5,
    why: 'link at body text size',
  },
  {
    fg: '--accent-echo',
    bg: '--color-surface',
    doc: 5.21,
    min: 3.0,
    why: 'magenta only at >=20px large text/graphics',
  },
  // borders (decorative cool-gray scale; no contrast tier registered for them in the design doc;
  // doc = computed from the registered hex, value-lock only against drift)
  {
    fg: '--color-border',
    bg: '--color-surface',
    doc: 1.29,
    min: 1.0,
    why: 'decorative border value-lock (no WCAG floor)',
  },
  {
    fg: '--color-border-strong',
    bg: '--color-surface',
    doc: 1.76,
    min: 1.0,
    why: 'hover/active border value-lock (no WCAG floor)',
  },
  // on --color-bg (page background; not listed separately in the doc; covered by the regression gate)
  {
    fg: '--color-text',
    bg: '--color-bg',
    doc: null,
    min: 4.5,
    why: 'body text on the page background',
  },
  {
    fg: '--color-text-secondary',
    bg: '--color-bg',
    doc: null,
    min: 4.5,
    why: 'secondary text on the page background',
  },
  {
    fg: '--color-text-tertiary',
    bg: '--color-bg',
    doc: null,
    min: 4.5,
    why: 'tertiary text on the page background',
  },
  {
    fg: '--accent-link',
    bg: '--color-bg',
    doc: null,
    min: 4.5,
    why: 'link on the page background',
  },
  // disabled (doc basis: secondary text on disabled background)
  {
    fg: '--color-text-secondary',
    bg: '--color-disabled-bg',
    doc: 5.32,
    min: 4.5,
    why: 'secondary text inside disabled controls',
  },
];

function run() {
  const tokens = parseTokens(readFileSync(TOKENS_PATH, 'utf8'));
  const failures = [];
  const rows = [];
  for (const p of PAIRS) {
    const fg = tokens[p.fg];
    const bg = tokens[p.bg];
    if (!fg || !/^#[0-9a-fA-F]{3,8}$/.test(fg) || !bg || !/^#[0-9a-fA-F]{3,8}$/.test(bg)) {
      failures.push(
        `${p.fg} on ${p.bg}: token missing or not resolvable to hex (fg=${fg} bg=${bg})`,
      );
      continue;
    }
    const ratio = contrast(fg, bg);
    const drift = p.doc !== null && Math.abs(ratio - p.doc) > 0.05;
    const below = ratio < p.min;
    if (drift) {
      failures.push(
        `${p.fg} on ${p.bg}: computed ${ratio.toFixed(2)}:1 drifted >0.05 from the registered doc value ${p.doc}:1 -- token and doc must be synced (color changes require a decision-log entry)`,
      );
    }
    if (below) {
      failures.push(
        `${p.fg} on ${p.bg}: ${ratio.toFixed(2)}:1 below the WCAG floor ${p.min}:1 (${p.why})`,
      );
    }
    rows.push({
      pair: `${p.fg.replace('--', '')} on ${p.bg.replace('--color-', '')}`,
      ratio: ratio.toFixed(2),
      doc: p.doc === null ? '—' : p.doc.toFixed(2),
      min: p.min.toFixed(1),
      ok: !drift && !below,
      why: p.why,
    });
  }
  const w = Math.max(...rows.map((r) => r.pair.length));
  console.log(`contrast gate (source: components/design-system/tokens.css)\n`);
  for (const r of rows) {
    console.log(
      `  ${r.ok ? '✓' : '✗'} ${r.pair.padEnd(w)}  ${r.ratio.padStart(6)}:1  doc ${r.doc.padStart(6)}  min ${r.min.padStart(4)}  ${r.why}`,
    );
  }
  console.log('');
  if (failures.length > 0) {
    console.log(`FAIL: ${failures.length} item(s)\n`);
    for (const f of failures) console.log(`  - ${f}`);
    exit(1);
  }
  console.log('all pairs pass both gates (regression + doc anti-drift) ✓');
}

function selfTest() {
  const cases = [
    { fg: '#FFFFFF', bg: '#000000', expect: 21 },
    { fg: '#000000', bg: '#FFFFFF', expect: 21 },
    { fg: '#767676', bg: '#FFFFFF', expect: 4.54 },
    { fg: '#E6E9F0', bg: '#12141B', expect: 15.14 },
    { fg: '#FCEE0A', bg: '#12141B', expect: 15.22 },
  ];
  let pass = true;
  for (const c of cases) {
    const got = contrast(c.fg, c.bg);
    const ok = Math.abs(got - c.expect) <= 0.01;
    if (!ok) pass = false;
    console.log(
      `  ${ok ? '✓' : '✗'} ${c.fg} on ${c.bg} = ${got.toFixed(2)} (expected ${c.expect})`,
    );
  }
  // 3-digit shorthand hex parsing
  const short = contrast('#fff', '#000');
  const okShort = Math.abs(short - 21) < 0.01;
  if (!okShort) pass = false;
  console.log(`  ${okShort ? '✓' : '✗'} 3-digit shorthand #fff parsing = ${short.toFixed(2)}`);
  if (!pass) exit(1);
  console.log('self-test passed ✓');
}

if (args.has('--self-test')) {
  selfTest();
  exit(0);
}
run();

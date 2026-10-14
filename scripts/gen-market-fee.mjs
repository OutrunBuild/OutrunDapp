// One-off data extension script (fabricated samples for prototype visuals): writes
// feeRate for every pool row in markets.json -- dynamic fee rate samples. Anchor = the Memeverse
// dynamic fee hook source of truth: base fee floor of 1%
// (the hook's fee math sets FEE_BASE_BPS = 100, i.e. a 1% base fee floor)
// plus three dynamic add-ons: adverse impact/volatility/short-term impact (the EWVWAP-exempt direction
// pays only the base fee; the 50% decay window after pool opening is long past -- all market verses in
// this repo are steady-state pools locked for one year). Sample band = 100-800 bps (1%-8%), 25 bps
// steps; mulberry32 seed = record id + ':fee'; full overwrite on re-run, idempotent.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const marketsPath = join(root, 'fixtures/data/markets.json');

function mulberry32(text) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MIN_BPS = 100; // base fee floor (FEE_BASE_BPS)
const MAX_BPS = 800; // typical upper-bound sample for steady-state pools including dynamic terms
const STEP_BPS = 25;

const data = JSON.parse(readFileSync(marketsPath, 'utf8'));
for (const market of data.items) {
  const rnd = mulberry32(`${market.id}:fee`);
  const bps = Math.round((MIN_BPS + rnd() * (MAX_BPS - MIN_BPS)) / STEP_BPS) * STEP_BPS;
  market.feeRate = { raw: String(bps), unit: 'bps', scale: 4 };
}
writeFileSync(marketsPath, `${JSON.stringify(data, null, 2)}\n`);
console.log(`feeRate written: ${data.items.length} rows (${MIN_BPS}-${MAX_BPS} bps band)`);

// One-off data extension script (Swap token selector samples): backfills ptPricePerPol for every
// record in pol-positions.json -- the PT/POL pool market price sample per 1 PT. Magnitude anchor =
// PT trades at roughly 0.9 POL (YT implied price = 1 - PT), i.e. PT trades at a discount to nominal.
// Range 0.88-0.92; determinism: mulberry32 seed = record id + ':pt-price' (same paradigm as gen-pol-my-lp);
// idempotent on re-run.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const positionsPath = join(root, 'fixtures/data/pol-positions.json');

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

const MIN = 0.88;
const MAX = 0.92;

const data = JSON.parse(readFileSync(positionsPath, 'utf8'));
for (const record of data.items) {
  const rnd = mulberry32(`${record.id}:pt-price`);
  const price = MIN + rnd() * (MAX - MIN);
  record.ptPricePerPol = { raw: price.toFixed(4), unit: 'ratio', scale: 18 };
}
writeFileSync(positionsPath, `${JSON.stringify(data, null, 2)}\n`);
console.log(`ptPricePerPol written: ${data.items.length} rows`);

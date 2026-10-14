// One-off data extension script (Add Liquidity modal samples): backfills lpPerQuote for every pool
// row in markets.json -- LP mint rate samples: LP minted per 1 quote-side asset supplied =
// totalSupply/R_quote (v2-style basis, full-range pools with equal-value sides; fee accrual slowly
// lowers the ratio -> sample range 0.90-0.98).
// Determinism: mulberry32 seed = market id + ':lp-rate' (same paradigm as gen-verse-market-ext);
// idempotent on re-run.
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

const data = JSON.parse(readFileSync(marketsPath, 'utf8'));
for (const market of data.items) {
  const rnd = mulberry32(`${market.id}:lp-rate`);
  const rate = 0.9 + rnd() * 0.08; // 0.90-0.98, 4 decimal places
  market.lpPerQuote = { raw: rate.toFixed(4), unit: 'ratio', scale: 18 };
}
writeFileSync(marketsPath, `${JSON.stringify(data, null, 2)}\n`);
console.log(`lpPerQuote written: ${data.items.length} rows`);

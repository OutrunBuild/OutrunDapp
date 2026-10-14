// One-off data extension script (Remove Liquidity modal samples): backfills myLp for every record
// in pol-positions.json -- four-pool LP token balance samples. Magnitude anchor = "the sample account
// once supplied part of each side's holdings into the pools":
// LP = supply-side holding x supplied ratio x that pool's lpPerQuote in markets.json (main anchors
// myMemecoin, pol-uasset/pt-pol anchor myPol, pt-uasset anchors myPt; ratio ranges below).
// Determinism: mulberry32 seeded from record id + pool key (same paradigm as gen-market-lp-rate);
// idempotent on re-run.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const marketsPath = join(root, 'fixtures/data/markets.json');
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

const markets = JSON.parse(readFileSync(marketsPath, 'utf8'));
// verseId+pool -> lpPerQuote (pools missing samples fall back to 1; sample snapshots may drift from
// the mint rate)
const lpRate = new Map();
for (const market of markets.items) {
  lpRate.set(`${market.verseId}:${market.pool}`, Number(market.lpPerQuote?.raw ?? 1));
}
// pool -> supply-side holding anchor field + supplied ratio range (only part of the holding sits in
// the pool, not the full amount)
const anchors = {
  main: { field: 'myMemecoin', min: 0.25, max: 0.6 },
  'pol-uasset': { field: 'myPol', min: 0.15, max: 0.5 },
  'pt-uasset': { field: 'myPt', min: 0.15, max: 0.5 },
  'pt-pol': { field: 'myPol', min: 0.1, max: 0.35 },
};

const data = JSON.parse(readFileSync(positionsPath, 'utf8'));
for (const record of data.items) {
  record.myLp = {};
  for (const [pool, { field, min, max }] of Object.entries(anchors)) {
    const rnd = mulberry32(`${record.id}:my-lp:${pool}`);
    const holding = Number(record[field].raw);
    const supplied = holding * (min + rnd() * (max - min));
    const lp = supplied * (lpRate.get(`${record.verseId}:${pool}`) ?? 1);
    record.myLp[pool] = { raw: lp.toFixed(2), decimals: 18 };
  }
}
writeFileSync(positionsPath, `${JSON.stringify(data, null, 2)}\n`);
console.log(`myLp written: ${data.items.length} rows × 4 pools`);

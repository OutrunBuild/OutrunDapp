// Backfills deterministic volume v (uAsset-denominated sample) for every candle in markets.json.
// Basis: base volume + volatility amplification (the larger |Δc/o|, the larger the volume); fake data
// same as prices -- for prototype visuals.
// Idempotent: candles that already have v are skipped. Usage: pnpm node scripts/gen-candle-volumes.mjs
// Determinism: mulberry32 with FNV-1a seeding (2166136261/16777619) -- a DIFFERENT seeding variant from
// the price-candle generators (gen-verse-market-ext / gen-verse-fixture-coverage / gen-fine-candles,
// murmur-style 1779033703). The two streams are not interchangeable; do not switch the seeding variant
// on either side without a repo-wide canonicalization decision (variants logged in fixtures/README.md).
import { readFileSync, writeFileSync } from 'node:fs';

const marketsPath = new URL('../fixtures/data/markets.json', import.meta.url);
const data = JSON.parse(readFileSync(marketsPath, 'utf8'));

function mulberry32(seedText) {
  let h = 2166136261;
  for (const ch of seedText) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let touched = 0;
for (const item of data.items) {
  const groups = [];
  if (item.candles) groups.push(['1h', item.candles]);
  if (item.candlesFine)
    for (const [g, rows] of Object.entries(item.candlesFine)) groups.push([g, rows]);
  for (const [gran, rows] of groups) {
    const rnd = mulberry32(`${item.id}:${gran}:vol`);
    for (const candle of rows) {
      if (candle.v != null) continue;
      const move = Math.abs(Number(candle.c) - Number(candle.o)) / Number(candle.o);
      const v = Math.round(6000 + rnd() * 9000 + move * 2_000_000);
      candle.v = String(v);
      touched++;
    }
  }
}
writeFileSync(marketsPath, JSON.stringify(data, null, 2) + '\n');
console.log(`candle volumes added: ${touched}`);

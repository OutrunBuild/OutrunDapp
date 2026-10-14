// One-off data extension script (fabricated samples for prototype visuals):
// backfills myReserve for every record in pol-positions.json -- the sample account's paired PSM
// reserve balance in this verse (UETH->ETH, UBNB->BNB; wallet level).
// Magnitude anchor = "the wallet also holds part of the reserves" = 20-60% of myUAsset; mulberry32
// seed = record id + ':my-reserve'; idempotent on re-run.
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

const MIN = 0.2;
const MAX = 0.6;

const data = JSON.parse(readFileSync(positionsPath, 'utf8'));
for (const record of data.items) {
  if (record.myReserve) continue;
  const rnd = mulberry32(`${record.id}:my-reserve`);
  const holding = Number(record.myUAsset.raw) * (MIN + rnd() * (MAX - MIN));
  record.myReserve = { raw: holding.toFixed(2), decimals: 18 };
}
writeFileSync(positionsPath, `${JSON.stringify(data, null, 2)}\n`);
console.log(`myReserve written: ${data.items.length} rows`);

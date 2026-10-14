// One-off data extension script (fabricated samples for prototype visuals):
// backfills ytRedeemUAssetPerUnit for locked records in pol-positions.json -- YT settlement uAsset
// leg estimate samples. Mechanically that leg = settlement reclaim derived from the remaining pool
// (not derivable during the lockup); samples are landed here; magnitude anchor = the existing
// unlocked samples at ~3-5% of uAssetPerPol (e.g. verse-003 0.0231/0.58≈4%).
// Only missing records (locked) are filled; the unlocked settlement-derived ground truth is untouched;
// mulberry32 seed = record id + ':yt-uasset-leg'; idempotent on re-run.
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

const MIN = 0.03;
const MAX = 0.05;

const data = JSON.parse(readFileSync(positionsPath, 'utf8'));
let written = 0;
for (const record of data.items) {
  if (record.ytRedeemUAssetPerUnit) continue;
  const rnd = mulberry32(`${record.id}:yt-uasset-leg`);
  const perPol = Number(record.uAssetPerPol.raw);
  const leg = perPol * (MIN + rnd() * (MAX - MIN));
  record.ytRedeemUAssetPerUnit = { raw: leg.toFixed(4), unit: 'ratio', scale: 18 };
  written += 1;
}
writeFileSync(positionsPath, `${JSON.stringify(data, null, 2)}\n`);
console.log(
  `ytRedeemUAssetPerUnit written: ${written} rows (skipped ${data.items.length - written} existing)`,
);

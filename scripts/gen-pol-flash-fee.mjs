// One-off data extension script: backfills flashUserFeeRate for every record
// in pol-positions.json -- Flash Swap user fee rate samples (relative to the user's payment amount).
// Basis: the pool dynamic fee (DynamicFeeMath: FEE_BASE_BPS=100 floor, FEE_MAX_BPS=10000 cap) is
// charged on the PT full-leg notional while the user pays only the difference
// (MemeverseYTFlashSwapRouter._executeBuy); converted onto the payment base it is amplified by
// leverage, with a spectrum from <1% (deep PT discount + EWVWAP exemption) to extremely high (PT near
// parity / high volatility -- when the fee pushes cost non-positive, InvalidBuyCost reverts and the
// trade cannot execute). Sample band 0.3%-85% directly covers the full spectrum; the fake data does
// no chained derivation. mulberry32 seed = record id + ':flash-fee'; idempotent on re-run.
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

const MIN = 0.003; // 0.3% -- lower end of the spectrum (<1% reachable)
const MAX = 0.85; // 85% -- upper end of the spectrum (higher mostly cannot execute)

const data = JSON.parse(readFileSync(positionsPath, 'utf8'));
for (const record of data.items) {
  if (record.flashUserFeeRate) continue;
  const rnd = mulberry32(`${record.id}:flash-fee`);
  // Square-root sampling -- denser at the low-fee end (most trades have modest fees), sparse but
  // present at the high end
  const minSqrt = Math.sqrt(MIN);
  const rate = Math.pow(minSqrt + rnd() * (Math.sqrt(MAX) - minSqrt), 2);
  record.flashUserFeeRate = { raw: rate.toFixed(4), unit: 'ratio', scale: 18 };
}
writeFileSync(positionsPath, `${JSON.stringify(data, null, 2)}\n`);
console.log(`flashUserFeeRate written: ${data.items.length} rows (band ${MIN}-${MAX})`);

// 一次性数据扩展脚本（2026-09-27 Swap 代币选择）：为 pol-positions.json 全部记录补
// ptPricePerPol——每 1 PT 的 PT/POL 池市场价样本。量级锚=OutrunBook yt-flash-swap.md
// 示例「PT trades at roughly 0.9 POL」（YT 隐含价=1−PT）；PT 折价交易（pol-splitter.md:44）。
// 区间 0.88–0.92；确定性：mulberry32 种子取记录 id（同 gen-pol-my-lp 范式），重跑幂等。
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

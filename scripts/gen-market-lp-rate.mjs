// 一次性数据扩展脚本（2026-09-27 Add Liquidity 弹窗）：为 markets.json 全部池行补
// lpPerQuote——LP 铸得率样本：每供给 1 quote 侧资产铸得 LP 数量 = totalSupply/R_quote
// （v2 式口径，full-range 池双侧等值，费累积使比率缓降 → 样本区间 0.90–0.98）。
// 确定性：mulberry32 种子取 market.id（同 gen-verse-market-ext 范式），重跑幂等。
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
  const rate = 0.9 + rnd() * 0.08; // 0.90–0.98，4 位小数
  market.lpPerQuote = { raw: rate.toFixed(4), unit: 'ratio', scale: 18 };
}
writeFileSync(marketsPath, `${JSON.stringify(data, null, 2)}\n`);
console.log(`lpPerQuote written: ${data.items.length} rows`);

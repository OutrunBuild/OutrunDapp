// 一次性数据扩展脚本（2026-09-28 用户裁定）：为 pol-positions.json 全部记录补
// flashUserFeeRate——Flash Swap 用户手续费率样本（相对用户支付额）。口径：池动态费
// （DynamicFeeMath：FEE_BASE_BPS=100 下限、FEE_MAX_BPS=10000 顶）按 PT 全腿名义收取、
// 用户只付差额（MemeverseYTFlashSwapRouter._executeBuy），换算到支付额基数后被杠杆放大，
// 谱系横跨 <1%（PT 深折价+EWVWAP 豁免）到极高（PT 近平价/高波动，费率高到成本非正时
// InvalidBuyCost 回滚无法成交）。样本带宽 0.3%–85% 直接覆盖全谱；假数据不做链式推导
// （用户裁定）。mulberry32 种子取记录 id，重跑幂等。
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

const MIN = 0.003; // 0.3% —— 谱系下端（<1% 可达）
const MAX = 0.85; // 85% —— 谱系上端（更高时基本无法成交）

const data = JSON.parse(readFileSync(positionsPath, 'utf8'));
for (const record of data.items) {
  if (record.flashUserFeeRate) continue;
  const rnd = mulberry32(`${record.id}:flash-fee`);
  // 平方根取样——低费率端更密（多数交易费率不高），高费率端稀疏但存在
  const minSqrt = Math.sqrt(MIN);
  const rate = Math.pow(minSqrt + rnd() * (Math.sqrt(MAX) - minSqrt), 2);
  record.flashUserFeeRate = { raw: rate.toFixed(4), unit: 'ratio', scale: 18 };
}
writeFileSync(positionsPath, `${JSON.stringify(data, null, 2)}\n`);
console.log(`flashUserFeeRate written: ${data.items.length} rows (band ${MIN}-${MAX})`);

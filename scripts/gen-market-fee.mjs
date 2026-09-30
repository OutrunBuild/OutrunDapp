// 一次性数据扩展脚本（2026-09-28 用户裁定造数看原型效果）：为 markets.json 全部池记录写
// feeRate——动态费率样本。锚=Memeverse 动态费 hook 真源：基础费率下限 1%
// （`DynamicFeeMath.sol:41 FEE_BASE_BPS=100`；OB:memeverse/hook.md「Base fee: a floor of 1%」）
// + 不利冲击/波动/短期冲击三项动态加成（EWVWAP 豁免方向仅付基础费；开池 50% 衰减窗口早已过去
// ——本仓 market verse 均为锁定一年期的稳态池）。样本带宽=100–800 bps（1%–8%），
// 25 bps 步进；mulberry32 种子取记录 id+':fee'，重跑全量覆写幂等。
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

const MIN_BPS = 100; // 基础费率下限（FEE_BASE_BPS）
const MAX_BPS = 800; // 稳态池含动态项的典型上限样本
const STEP_BPS = 25;

const data = JSON.parse(readFileSync(marketsPath, 'utf8'));
for (const market of data.items) {
  const rnd = mulberry32(`${market.id}:fee`);
  const bps = Math.round((MIN_BPS + rnd() * (MAX_BPS - MIN_BPS)) / STEP_BPS) * STEP_BPS;
  market.feeRate = { raw: String(bps), unit: 'bps', scale: 4 };
}
writeFileSync(marketsPath, `${JSON.stringify(data, null, 2)}\n`);
console.log(`feeRate written: ${data.items.length} rows (${MIN_BPS}-${MAX_BPS} bps band)`);

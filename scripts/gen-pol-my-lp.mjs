// 一次性数据扩展脚本（2026-09-27 Remove Liquidity 弹窗）：为 pol-positions.json 全部
// 记录补 myLp——四池 LP 代币余额样本。量级锚=「样本账户曾把各侧持仓的一部分供给进池」：
// LP = 供给侧持仓 × 供给比例 × markets.json 该池 lpPerQuote（main 池锚 myMemecoin、
// pol-uasset/pt-pol 锚 myPol、pt-uasset 锚 myPt；比例区间见下）。确定性：mulberry32
// 种子取记录 id+池标识（同 gen-market-lp-rate 范式），重跑幂等。
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
// verseId+pool → lpPerQuote（缺样本池按 1 兜底，样本快照允许与铸得率漂移）
const lpRate = new Map();
for (const market of markets.items) {
  lpRate.set(`${market.verseId}:${market.pool}`, Number(market.lpPerQuote?.raw ?? 1));
}
// 池 → 供给侧持仓锚字段 + 供给比例区间（持仓的一部分在池里，非全额）
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

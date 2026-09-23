// 为 markets.json 全部蜡烛补确定性成交量 v（uAsset 计价样本）。
// 口径：基础量 + 波动放大（|Δc/o| 越大量越大），与价格同为假数据——原型看效果（2026-09-23）。
// 幂等：已有 v 的蜡烛跳过。用法：pnpm node scripts/gen-candle-volumes.mjs
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

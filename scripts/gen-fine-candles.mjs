// 细粒度蜡烛生成（2026-09-23 用户裁定：1m/5m/15m 全部可选——假数据看效果）。
// 对每个带 1h 蜡烛的主池：以最后收盘价为锚，确定性生成 96 根 1m / 5m / 15m 蜡烛。
// 确定性：mulberry32(seed + marketId + 粒度)；幂等：已有 candlesFine 跳过。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const marketsPath = join(root, 'fixtures/data/markets.json');
const seed =
  JSON.parse(readFileSync(join(root, 'fixtures/data/seed.json'), 'utf8')).seed ?? 'seed-001';

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

const ANCHOR = Date.parse('2026-09-16T12:00:00Z');
const COUNT = 96;
/** 各细粒度的单根时长（分钟）与整体波幅（越细越小） */
const FINE = {
  '1m': { span: 1, vol: 0.0012 },
  '5m': { span: 5, vol: 0.003 },
  '15m': { span: 15, vol: 0.006 },
};

const data = JSON.parse(readFileSync(marketsPath, 'utf8'));
let added = 0;
for (const market of data.items) {
  if (!Array.isArray(market.candles) || market.candles.length === 0 || market.candlesFine) continue;
  const lastClose = Number(market.candles.at(-1).c);
  market.candlesFine = Object.fromEntries(
    Object.entries(FINE).map(([gran, cfg]) => {
      const rnd = mulberry32(`${seed}:${market.id}:${gran}`);
      const stepMs = cfg.span * 60_000;
      const firstT = ANCHOR - COUNT * stepMs;
      // 乘性随机游走（永不为负）：从首价出发，末根收盘收敛回锚定价
      const first = lastClose * (1 + (rnd() - 0.5) * cfg.vol * 6);
      const perStep = Math.pow(lastClose / first, 1 / (COUNT - 1));
      const prices = [first];
      for (let i = 1; i < COUNT - 1; i++) {
        prices.push(prices[i - 1] * perStep * (1 + (rnd() - 0.5) * cfg.vol));
      }
      prices.push(lastClose);
      return [
        gran,
        prices.map((p, i) => {
          const o = p;
          const c = prices[Math.min(i + 1, COUNT - 1)];
          const round6 = (v) => v.toFixed(6);
          return {
            t: new Date(firstT + i * stepMs).toISOString().replace('.000Z', 'Z'),
            o: round6(o),
            h: round6(Math.max(o, c) * (1 + rnd() * cfg.vol * 0.4)),
            l: round6(Math.min(o, c) * (1 - rnd() * cfg.vol * 0.4)),
            c: round6(c),
          };
        }),
      ];
    }),
  );
  added++;
}
writeFileSync(marketsPath, JSON.stringify(data, null, 2) + '\n');
console.log(`fine candles added to ${added} main pools`);

// One-off data extension script: backfills four pools, 24h volume,
// APR samples, token stats and 168 1h candles for the locked/unlocked hero sample verses.
// Determinism: mulberry32 seeded from seed.json's seed-001, candle series keyed `${verseId}:${id}`;
// no Date.now/Math.random.
// Idempotent on re-run (rewritten per verseId section).
// Mechanism basis: four-pool market structure; the 70/30 target ratio is a deployment target and
// may deviate.
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

const HOUR = 3_600_000;
const ANCHOR = Date.parse('2026-09-16T12:00:00Z');

/** Generates count 1h candles, on-the-hour series ending before endingExclusive; startPrice -> drift to endPrice */
function genCandles(key, count, firstOpen, lastClose) {
  const rnd = mulberry32(`${seed}:${key}`);
  const firstT = ANCHOR - count * HOUR; // last candle opens at ANCHOR-1h on the hour ([t, t+1h) half-open interval)
  const prices = [firstOpen];
  const drift = (lastClose - firstOpen) / (count - 1);
  for (let i = 1; i < count; i++) {
    const noise = (rnd() - 0.5) * Math.max(2e-4, firstOpen * 0.012);
    prices.push(prices[i - 1] + drift + noise);
  }
  prices[count - 1] = lastClose;
  return prices.map((p, i) => {
    const o = p;
    const c = prices[Math.min(i + 1, count - 1)] ?? p;
    const hi = Math.max(o, c) * (1 + rnd() * 0.004);
    const lo = Math.min(o, c) * (1 - rnd() * 0.004);
    const round6 = (v) => v.toFixed(6);
    return {
      t: new Date(firstT + i * HOUR).toISOString().replace('.000Z', 'Z'),
      o: round6(o),
      h: round6(hi),
      l: round6(lo),
      c: round6(c),
    };
  });
}

const amount = (raw, decimals = 18) => ({ raw: String(raw), decimals });
const rate = (raw, unit, scale = 18) => ({ raw: String(raw), unit, scale });

// four-pool samples (verseId -> pools to backfill): ids continue after the existing mkt-014
const POOL_PLAN = {
  'verse-002': {
    // existing mkt-003 main 730000, mkt-004 pt-pol 96000; adds pol-uasset/pt-uasset
    add: [
      {
        id: 'mkt-101',
        pool: 'pol-uasset',
        tvl: 120000,
        volume24h: 42000,
        apr7d: ['0.312', 'ratio'],
      },
      { id: 'mkt-102', pool: 'pt-uasset', tvl: 96857, volume24h: 31000, apr7d: ['0.274', 'ratio'] },
    ],
    patch: {
      'mkt-003': { volume24h: 380000, apr7d: ['0.448', 'ratio'] },
      'mkt-004': { volume24h: 26000, apr7d: ['0.221', 'ratio'] },
    },
    tokenStats: { 'mkt-003': { totalSupply: 1000000000, holders: 4230 } },
    candles: { 'mkt-003': [168, 0.0142, 0.015] },
  },
  'verse-003': {
    // existing mkt-001 main 480000 (with 4 candles), mkt-002 pol-uasset 210000 (paused-protection
    // sample kept)
    add: [
      { id: 'mkt-103', pool: 'pt-uasset', tvl: 52000, volume24h: 14000, apr7d: ['0.242', 'ratio'] },
      { id: 'mkt-104', pool: 'pt-pol', tvl: 64000, volume24h: 21000, apr7d: ['0.196', 'ratio'] },
    ],
    patch: {
      'mkt-001': { volume24h: 291000, apr7d: ['0.405', 'ratio'] },
      'mkt-002': { volume24h: 38000, apr7d: ['0.288', 'ratio'] },
    },
    tokenStats: { 'mkt-001': { totalSupply: 1000000000, holders: 6120 } },
    // keep the existing 4 candles (09-16T08:00-11:00), prepend 164 candles back to 09-09T13:00
    candles: { 'mkt-001': [164, 0.0039, null, 'prepend'] },
  },
};

const data = JSON.parse(readFileSync(marketsPath, 'utf8'));
const byId = new Map(data.items.map((m) => [m.id, m]));

for (const [verseId, plan] of Object.entries(POOL_PLAN)) {
  for (const item of plan.add) {
    if (byId.has(item.id)) continue;
    const record = {
      id: item.id,
      scenario: ['normal'],
      sourceRef: 'docs/page-briefs/source-map.md#M5',
      verseId,
      pool: item.pool,
      tvl: amount(item.tvl),
      volume24h: amount(item.volume24h),
      apr7d: rate(item.apr7d[0], item.apr7d[1]),
      feeState: 'normal',
    };
    data.items.push(record);
    byId.set(item.id, record);
  }
  for (const [id, patch] of Object.entries(plan.patch)) {
    const record = byId.get(id);
    if (!record) throw new Error(`unknown market ${id}`);
    record.volume24h = amount(patch.volume24h);
    record.apr7d = rate(patch.apr7d[0], patch.apr7d[1]);
  }
  for (const [id, stats] of Object.entries(plan.tokenStats)) {
    const record = byId.get(id);
    record.tokenStats = {
      totalSupply: amount(stats.totalSupply),
      holders: stats.holders,
      // sample address (fixtureOnly); source-of-truth discipline: do not impersonate deployed addresses
      tokenAddress: { value: `0x1a2b00000000000000000000000000000000ef12`, fixtureOnly: true },
    };
  }
  for (const [id, spec] of Object.entries(plan.candles)) {
    const record = byId.get(id);
    if (spec[3] === 'prepend') {
      const existing = record.candles ?? [];
      if (existing.length > 4) continue; // idempotent: skip if already extended
      const firstOpen = Number(existing[0].o);
      const startPrice = spec[2] ?? firstOpen * 0.93;
      const generated = genCandles(`${verseId}:${id}`, spec[0], startPrice, firstOpen);
      record.candles = [...generated, ...existing];
    } else {
      const [count, from, to] = spec;
      record.candles = genCandles(`${verseId}:${id}`, count, from, to);
    }
  }
}

writeFileSync(marketsPath, JSON.stringify(data, null, 2) + '\n');
console.log(
  'markets.json updated:',
  data.items.filter((m) => POOL_PLAN[m.verseId]).length,
  'items across hero verses',
);

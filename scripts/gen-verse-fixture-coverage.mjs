// Full coverage generation (no "on-chain read values prevail" slots are left -- all locked/unlocked
// verses are filled with four-pool/token stats/candle/
// POL position/staking vault/DAO cycle sample data).
// Determinism: mulberry32 keyed `${seed}:${key}` — per-verse rows keyed verse id, candle streams
// keyed `${key}:candles`; no clock and no Math.random; idempotent on re-run
// (existing entries are skipped).
// Mechanism basis anchors: four-pool market structure; pool magnitudes aligned to the hero sample
// (verse-002/003) ratios.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'fixtures/data');
const seed = JSON.parse(readFileSync(join(dataDir, 'seed.json'), 'utf8')).seed ?? 'seed-001';

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
const rngOf = (key) => mulberry32(`${seed}:${key}`);
const between = (rnd, lo, hi) => lo + rnd() * (hi - lo);
const round = (v, d = 0) => Number(v.toFixed(d));

const HOUR = 3_600_000;
const ANCHOR = Date.parse('2026-09-16T12:00:00Z');
const amount = (raw, decimals = 18) => ({ raw: String(raw), decimals });
const rate = (raw, unit = 'ratio', scale = 18) => ({ raw: String(raw), unit, scale });
const addr = (n) => ({ value: '0x' + n.toString(16).padStart(40, '0'), fixtureOnly: true });
const iso = (t) => new Date(t).toISOString().replace('.000Z', 'Z');

// DAO treasury composition sample (modeled on the demo.outrun.build/memeverse/26 modal;
// fixed-weight split, deterministic with no rnd; unitPrice is a sample price, and the usdValue sum
// approximates the treasuryUAsset/remainingRewards totals)
const TREASURY_SPLIT = [
  ['ETH', 'Ethereum', 2500, 0.42],
  ['USDC', 'USD Coin', 1, 0.24],
  ['USDT', 'Tether USD', 1, 0.16],
  ['DAI', 'Dai', 1, 0.1],
  ['WBTC', 'Wrapped BTC', 50000, 0.08],
];
const UNCLAIMED_SPLIT = [
  ['ETH', 'Ethereum', 2500, 0.4],
  ['USDC', 'USD Coin', 1, 0.3],
  ['USDT', 'Tether USD', 1, 0.2],
  ['DAI', 'Dai', 1, 0.1],
];
// Claimable reward composition (claimable detail modal; mechanism = getClaimableReward(user)
// with multiple tokens split by voting-power share in the governance cycle incentivizer contract;
// total anchored to myClaimable, same universe as the rewardTokenList sample)
const CLAIMABLE_SPLIT = [
  ['ETH', 'Ethereum', 2500, 0.38],
  ['USDC', 'USD Coin', 1, 0.3],
  ['USDT', 'Tether USD', 1, 0.2],
  ['DAI', 'Dai', 1, 0.12],
];
const composeAssets = (total, split) =>
  split.map(([symbol, name, unitPrice, weight]) => {
    const usdValue = round(total * weight, 2);
    return {
      symbol,
      name,
      amount: amount((usdValue / unitPrice).toFixed(6), 6),
      usdValue: amount(usdValue.toFixed(2), 2),
    };
  });

// hero pool ratios (measured on mkt-003/101/102/104): aux/main ≈ 0.164 / 0.133 / 0.132; volume/TVL ≈ 0.52
const AUX_RATIO = { 'pol-uasset': 0.164, 'pt-uasset': 0.133, 'pt-pol': 0.132 };
const APR_RANGE = {
  main: [0.28, 0.55],
  'pol-uasset': [0.2, 0.36],
  'pt-uasset': [0.18, 0.32],
  'pt-pol': [0.15, 0.28],
};

function genCandles(key, count, firstOpen, lastClose) {
  const rnd = rngOf(`${key}:candles`);
  const firstT = ANCHOR - count * HOUR;
  const prices = [firstOpen];
  const drift = (lastClose - firstOpen) / (count - 1);
  for (let i = 1; i < count; i++)
    prices.push(prices[i - 1] + drift + (rnd() - 0.5) * Math.max(2e-4, firstOpen * 0.012));
  prices[count - 1] = lastClose;
  return prices.map((p, i) => {
    const o = p;
    const c = prices[Math.min(i + 1, count - 1)];
    return {
      t: iso(firstT + i * HOUR),
      o: o.toFixed(6),
      h: (Math.max(o, c) * (1 + rnd() * 0.004)).toFixed(6),
      l: (Math.min(o, c) * (1 - rnd() * 0.004)).toFixed(6),
      c: c.toFixed(6),
    };
  });
}

const verses = JSON.parse(readFileSync(join(dataDir, 'verses.json'), 'utf8'));
const markets = JSON.parse(readFileSync(join(dataDir, 'markets.json'), 'utf8'));
const staking = JSON.parse(readFileSync(join(dataDir, 'staking.json'), 'utf8'));
const polPos = JSON.parse(readFileSync(join(dataDir, 'pol-positions.json'), 'utf8'));
const governance = JSON.parse(readFileSync(join(dataDir, 'governance.json'), 'utf8'));

const targets = verses.items.filter((v) => v.stage === 'locked' || v.stage === 'unlocked');
const idFactory = (prefix, start) =>
  (() => {
    let n = start;
    return () => `${prefix}-${String(n++).padStart(3, '0')}`;
  })();
const mktId = idFactory('mkt', 300);
const stkId = idFactory('stk', 100);
const polpId = idFactory('polp', 100);
const govId = idFactory('gov', 100);

for (const verse of targets) {
  const rnd = rngOf(verse.id);
  const existing = markets.items.filter((m) => m.verseId === verse.id);
  const main = existing.find((m) => m.pool === 'main');
  // projectedMarketCap snapshot was removed (market cap is now derived per stage at read
  // time from raised/price×supply) — gap-filling fabricates from a fixed sample magnitude
  const projected = between(rnd, 4e6, 2e7);

  // -- four pools: missing pools are filled (tvl magnitude derived from the existing main; without
  // a main, fabricated from the projected ratio) --
  const mainTvl = main ? Number(main.tvl.raw) : round(between(rnd, 0.03, 0.08) * projected);
  if (!main) {
    markets.items.push({
      id: mktId(),
      scenario: ['normal'],
      sourceRef: 'docs/page-briefs/source-map.md#M5',
      verseId: verse.id,
      pool: 'main',
      tvl: amount(mainTvl),
      feeState: 'normal',
    });
  }
  for (const [pool, ratio] of Object.entries(AUX_RATIO)) {
    if (existing.some((m) => m.pool === pool)) continue;
    markets.items.push({
      id: mktId(),
      scenario: ['normal'],
      sourceRef: 'docs/page-briefs/source-map.md#M5',
      verseId: verse.id,
      pool,
      tvl: amount(round(mainTvl * ratio * between(rnd, 0.85, 1.15))),
      feeState: 'normal',
    });
  }
  // -- pool card values: volume/APR all filled --
  for (const m of markets.items.filter((x) => x.verseId === verse.id)) {
    if (!m.volume24h) m.volume24h = amount(round(Number(m.tvl.raw) * between(rnd, 0.4, 0.65)));
    if (!m.apr7d) m.apr7d = rate(between(rnd, ...APR_RANGE[m.pool]).toFixed(4));
  }
  // -- main pool tokenStats + candles --
  const mainNow = markets.items.find((m) => m.verseId === verse.id && m.pool === 'main');
  if (!mainNow.tokenStats) {
    mainNow.tokenStats = {
      totalSupply: amount(1_000_000_000),
      holders: round(between(rnd, 1800, 9200)),
      tokenAddress: {
        value:
          '0x' +
          ('a1b2c3' +
            (Number(verse.id.replace(/\D/g, '')) * 0x10000 + 0xc0de)
              .toString(16)
              .padStart(34, '0')),
        fixtureOnly: true,
      },
    };
  }
  if (!(mainNow.candles?.length > 4)) {
    const endPrice = round((projected / 1e9) * between(rnd, 0.6, 1.6), 6);
    mainNow.candles = genCandles(
      `${verse.id}:main`,
      168,
      round(endPrice * between(rnd, 0.82, 0.95), 6),
      endPrice,
    );
  }

  // -- POL positions --
  if (!polPos.items.some((x) => x.verseId === verse.id)) {
    const polSupply = round(mainTvl * between(rnd, 0.8, 1.1));
    const uAssetPerPol = round((mainTvl / polSupply) * between(rnd, 0.8, 0.95), 4);
    const nominal = uAssetPerPol * 2;
    polPos.items.push({
      id: polpId(),
      scenario: ['normal'],
      sourceRef: 'docs/page-briefs/source-map.md#M14',
      verseId: verse.id,
      polAddress: addr(
        0x5d4f00000000000000000000000000000000f00a + Number(verse.id.replace(/\D/g, '')) * 0x100,
      ),
      polSupply: amount(polSupply),
      uAssetPerPol: rate(uAssetPerPol.toFixed(4)),
      // Market price sample = typical 4-18% discount (generally below nominal
      // value; the mechanism allows premium/discount)
      marketPricePerPol: rate((nominal * between(rnd, 0.82, 0.96)).toFixed(4)),
      myPol: amount(round(between(rnd, 800, 60000), 2).toFixed(2)),
      claimablePol: amount(
        verse.stage === 'unlocked' ? round(between(rnd, 200, 4000), 2).toFixed(2) : '0',
      ),
    });
  }

  // -- staking vault --
  if (!staking.items.some((x) => x.verseId === verse.id)) {
    const totalStaked = round(1e9 * between(rnd, 0.004, 0.012));
    const assetsPerShare = round(between(rnd, 1.02, 1.38), 4);
    // Full 5-entry sample = the contract MAX_REDEEM_REQUESTS cap: 3 pending (Redeem countdown
    // samples, staggered 20h/9h/1h remaining) + 2 matured (Withdraw samples, matured 6h/18h ago);
    // maturesAt = requestedAt + REDEEM_DELAY(24h)
    const pending = [
      {
        lockedAssets: amount(round(totalStaked * 0.0005)),
        requestedAt: iso(ANCHOR - 4 * HOUR),
        maturesAt: iso(ANCHOR + 20 * HOUR),
      },
      {
        lockedAssets: amount(round(totalStaked * 0.0012)),
        requestedAt: iso(ANCHOR - 15 * HOUR),
        maturesAt: iso(ANCHOR + 9 * HOUR),
      },
      {
        lockedAssets: amount(round(totalStaked * 0.0003)),
        requestedAt: iso(ANCHOR - 23 * HOUR),
        maturesAt: iso(ANCHOR + 1 * HOUR),
      },
      {
        lockedAssets: amount(round(totalStaked * 0.0008)),
        requestedAt: iso(ANCHOR - 30 * HOUR),
        maturesAt: iso(ANCHOR - 6 * HOUR),
      },
      {
        lockedAssets: amount(round(totalStaked * 0.0004)),
        requestedAt: iso(ANCHOR - 54 * HOUR),
        maturesAt: iso(ANCHOR - 30 * HOUR),
      },
    ];
    staking.items.push({
      id: stkId(),
      scenario: ['normal'],
      sourceRef: 'docs/page-briefs/source-map.md#M10',
      verseId: verse.id,
      vaultAddress: addr(
        0x8f1a000000000000000000000000000000008f1a + Number(verse.id.replace(/\D/g, '')) * 0x100,
      ),
      totalStaked: amount(totalStaked),
      assetsPerShare: rate(assetsPerShare.toFixed(4)),
      apy7d: rate(between(rnd, 0.05, 0.31).toFixed(4)),
      myShares: amount(round(totalStaked * between(rnd, 0.008, 0.03))),
      delegatee: addr(0x1111111000000000000000000000000000000001),
      pendingRedeems: pending,
    });
  }

  // -- DAO cycle --
  if (!governance.items.some((x) => x.verseId === verse.id)) {
    const unlocked = verse.stage === 'unlocked';
    const cycleNumber = String(Math.floor(between(rnd, 2, 18)));
    const cycleEndsAt = unlocked
      ? ANCHOR - between(rnd, 3, 40) * 24 * HOUR
      : ANCHOR + between(rnd, 8, 75) * 24 * HOUR;
    const treasury = round(projected * between(rnd, 0.16, 0.34));
    const totalVotes = round(1e9 * between(rnd, 0.04, 0.12));
    const myVotes = round(totalVotes * between(rnd, 0.05, 0.25));
    governance.items.push({
      id: govId(),
      scenario: ['normal'],
      sourceRef: 'docs/page-briefs/source-map.md#M10',
      verseId: verse.id,
      cycleNumber,
      cycleDurationDays: 90,
      cycleEndsAt: iso(cycleEndsAt),
      finalized: unlocked,
      claimWindowEndsAt: iso(cycleEndsAt + 14 * 24 * HOUR),
      governorAddress: addr(
        0x9a670000000000000000000000000000000a004 + Number(verse.id.replace(/\D/g, '')) * 0x100,
      ),
      incentivizerAddress: addr(
        0x6c5b00000000000000000000000000000000c7b0 + Number(verse.id.replace(/\D/g, '')) * 0x100,
      ),
      delegates: round(between(rnd, 900, 7800)),
      totalVotingPower: amount(round(totalVotes * between(rnd, 0.4, 0.7))),
      myVotes: amount(myVotes),
      treasuryUAsset: amount(treasury),
      rewardRatio: rate('2500', 'bps'),
      cumulativeIncentivePool: amount(round(treasury * 0.23)),
      currentCycleVotes: { total: amount(totalVotes), mine: amount(myVotes) },
      lastCycle: {
        number: String(Number(cycleNumber) - 1 || 1),
        treasuryUAsset: amount(round(treasury * between(rnd, 0.82, 0.96))),
        remainingRewards: amount(round(treasury * between(rnd, 0.02, 0.06))),
        totalVotes: amount(round(totalVotes * between(rnd, 0.95, 1.2))),
        myVotes: amount(round(myVotes * between(rnd, 0.9, 1.15))),
        myClaimable: amount(round(treasury * between(rnd, 0.004, 0.012))),
      },
      proposals: [],
    });
  }
}

// -- Backfill fund compositions for existing/new entries (idempotent: only missing fields are filled;
// entries that already carry samples keep their sourceRef unchanged) --
// The guard must check raw values: amount objects are always truthy, and a zero total (e.g.
// myClaimable/remainingRewards when unsettled or the window closed) must not get fabricated samples
// -- otherwise you get self-contradictory samples of a 0 anchor plus residual-value assets
// (modal Total Value $0 while asset rows are non-zero)
for (const g of governance.items) {
  if (!g.treasuryAssets && Number(g.treasuryUAsset?.raw) > 0)
    g.treasuryAssets = composeAssets(Number(g.treasuryUAsset.raw), TREASURY_SPLIT);
  if (g.lastCycle) {
    if (!g.lastCycle.treasuryAssets && Number(g.lastCycle.treasuryUAsset?.raw) > 0)
      g.lastCycle.treasuryAssets = composeAssets(
        Number(g.lastCycle.treasuryUAsset.raw),
        TREASURY_SPLIT,
      );
    if (!g.lastCycle.unclaimedAssets && Number(g.lastCycle.remainingRewards?.raw) > 0)
      g.lastCycle.unclaimedAssets = composeAssets(
        Number(g.lastCycle.remainingRewards.raw),
        UNCLAIMED_SPLIT,
      );
    if (!g.lastCycle.claimableAssets && Number(g.lastCycle.myClaimable?.raw) > 0)
      g.lastCycle.claimableAssets = composeAssets(
        Number(g.lastCycle.myClaimable.raw),
        CLAIMABLE_SPLIT,
      );
  }
}

const write = (name, data) =>
  writeFileSync(join(dataDir, name), JSON.stringify(data, null, 2) + '\n');
write('markets.json', markets);
write('staking.json', staking);
write('pol-positions.json', polPos);
write('governance.json', governance);
console.log(
  `coverage: ${targets.length} locked/unlocked verses;`,
  `markets=${markets.items.length} staking=${staking.items.length} pol=${polPos.items.length} gov=${governance.items.length}`,
);

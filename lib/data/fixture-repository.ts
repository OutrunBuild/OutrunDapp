// fixture repository -- the sole legal consumer of fixtures. Allowed import graph:
// fixtures/** -> this file -> components/** (except the ui/design-system generic layer), tests/**
// or fixtures/inspector/**. Production code (the app/, features/, entities/, components/ and lib/
// trees, except this file and the ui/design-system generic layer) must not import it directly or
// indirectly: enforced by scripts/check-fixture-boundary.mjs --source / --graph production.
import { OUTRUN_FIXTURE_ONLY_v1, fixtureData } from '../../fixtures/index';

import type { VerseStage } from './types';

export const FIXTURE_ONLY_SENTINEL = OUTRUN_FIXTURE_ONLY_v1;

export const fixtureRepository = {
  sentinel: FIXTURE_ONLY_SENTINEL,
  chains: () => fixtureData.chains.items,
  assets: () => fixtureData.assets.items,
  verses: () => fixtureData.verses.items,
  markets: () => fixtureData.markets.items,
  positions: () => fixtureData.positions.items,
  psm: () => fixtureData.psm.items,
  usrVaults: () => fixtureData.usrVaults.items,
  bridgeMessages: () => fixtureData.bridgeMessages.items,
  transactions: () => fixtureData.transactions.items,
  governance: () => fixtureData.governance.items,
  staking: () => fixtureData.staking.items,
  polPositions: () => fixtureData.polPositions.items,
  accounts: () => fixtureData.accounts.items,
  notifications: () => fixtureData.notifications.items,
  participations: () => fixtureData.participations.items,
  scenarios: () => fixtureData.scenarios.items,
} as const;

// ---------------------------------------------------------------------------
// ViewModel layer (data comes entirely from the fixture reads above; inventing domain values is
// forbidden; price/change is derived from candles).
// ---------------------------------------------------------------------------

// FixtureChain/Locale/VerseStage live in lib/data/types.ts; this re-export keeps existing
// consumers (components domain components etc.) untouched.
export type { FixtureChain, Locale, VerseStage } from './types';

export type SourceRecord = { id: string; sourceRef: string };

export type FixtureMarket = SourceRecord & {
  verseId: string;
  pool: 'main' | 'pol-uasset' | 'pt-uasset' | 'pt-pol';
  tvl: number;
  feeState: string;
  /** Pool dynamic fee rate (markets feeRate bps -> ratio, e.g. 0.008=0.8%); null=slot */
  feeRate: number | null;
  /** 24h volume snapshot; null=fixture missing -> UI does not render */
  volume24h: number | null;
  /** Trailing 7-day fee APR sample (display-derived value); null=this APR slot is not rendered */
  apr7d: number | null;
  /** LP mint rate sample: LP amount minted per 1 quote-side supplied (derived from Add Liquidity dialog output); null=dialog output falls back to 0.00 on empty */
  lpPerQuote: number | null;
};

export type FixtureSocial = {
  kind: 'website' | 'x' | 'telegram' | 'discord';
  url: string;
};

/** Fixed display order for social links (rows are sorted to this) */
const SOCIAL_ORDER: FixtureSocial['kind'][] = ['website', 'x', 'discord', 'telegram'];

export type FixtureVerse = SourceRecord & {
  name: string;
  symbol: string;
  stage: VerseStage;
  /** Scenario tags (frozen whitelist subset of states.json; the scenario protocol focuses demos on these) */
  scenario: readonly string[];
  governanceChain: number;
  governanceChainName: string;
  createdAt: string;
  participantCount: number;
  /** One-line description (registration-phase metadata); fixture missing=null -> UI does not render */
  description: string | null;
  /** Social links (registration-phase metadata); fixture missing=empty array -> UI does not render */
  socials: FixtureSocial[];
  /** Projected market cap snapshot (in uAsset, registration parameter); fixture missing=null -> UI does not render */
  projectedMarketCap: number | null;
  minSuccessThreshold: number;
  normalRaised: number;
  leverageInterest: number;
  preorderRaised: number;
  participationSize: number;
  raiseAsset: string;
  normalProgress: number;
  leverageProgress: number;
  preorderProgress: number;
  endsAt: string;
  /** Preorder capacity ratio snapshot (capacity=(normal funds + leverage debt principal)×70%×capacity ratio); fixture missing=null -> UI does not render */
  preorderCapacityRatio: number | null;
  /** Leverage one-time interest rate snapshot (locked at registration, not annualized; debt allowance=interest÷rate); fixture missing=null -> UI does not render */
  leverageInterestRate: number | null;
  /** Leverage debt cap snapshot (in uAsset); fixture missing=null -> UI does not render */
  leverageDebtCap: number | null;
  /** Fast Mode: genesis ends early once any threshold is met (false when the fixture does not mark it) */
  fastGenesis: boolean;
  /** Unlock time = genesis deadline + FIXED_LOCKUP_DURATION(365d); shown on locked/unlocked cards */
  unlockTimeAt: string;
  /** 24h four-pool volume snapshot (in uAsset); fixture missing=null -> UI shows an unavailable slot */
  volume24h: number | null;
  /** Staking APY snapshot (percentage value, 5.688 ratio -> 568.8); fixture missing=null -> UI shows an unavailable slot */
  stakingApy: number | null;
  /** DAO treasury balance snapshot (in USD); fixture missing=null -> UI shows an unavailable slot */
  treasuryFundUsd: number | null;
  unlockedAt: string | null;
  currentPrice: number | null;
  change24h: number | null;
  /** Memecoin CA (markets main-pool tokenStats sample); null=undeployed/no sample -> address search does not match (deployed only after genesis succeeds) */
  memecoinAddress: string | null;
  markets: FixtureMarket[];
};

export type FixtureAsset = SourceRecord & {
  symbol: string;
  /** Token proper name (assets.json name; missing=components fall back to symbol) */
  name?: string;
  anchorNote?: string;
  /** sy asset to anchor-asset conversion sample rate (1 sy ≈ N anchor assets -> N uAsset, changes in real time; missing=falls back to face value 1, no slot) */
  anchorValue?: number;
};

export type FixtureSnapshot = {
  timeAnchor: string;
  verses: FixtureVerse[];
  assets: FixtureAsset[];
  homeMetrics: {
    totalLocked: number;
    verseCount: number;
    /** Deployed Memecoin count (locked + unlocked; genesis/refund not counted) */
    deployedVerseCount: number;
    participantCount: number;
    sourceRefs: string[];
  };
  sampleAccount: {
    address: string;
    sourceRef: string;
  };
};

const FIXTURE_TIME_ANCHOR = '2026-09-16T12:00:00Z';

/** Fixed lockup: FIXED_LOCKUP_DURATION = 365 days, a contract constant, not a registration parameter */
const FIXED_LOCKUP_MS = 365 * 24 * 60 * 60 * 1000;

function amount(raw: string) {
  return Number(raw);
}

function progress(value: number, threshold: number) {
  if (threshold === 0) return 0;
  return (value / threshold) * 100;
}

function getSnapshot(): FixtureSnapshot {
  const chainMeta = new Map(fixtureData.chains.items.map((chain) => [chain.chainId, chain]));
  const marketsByVerse = new Map<string, FixtureMarket[]>();

  for (const market of fixtureData.markets.items) {
    const normalizedMarket: FixtureMarket = {
      id: market.id,
      sourceRef: market.sourceRef,
      verseId: market.verseId,
      pool: market.pool as FixtureMarket['pool'],
      tvl: amount(market.tvl.raw),
      feeState: market.feeState,
      feeRate: market.feeRate ? Number(market.feeRate.raw) / 1e4 : null,
      volume24h: market.volume24h ? amount(market.volume24h.raw) : null,
      apr7d: market.apr7d ? Number(market.apr7d.raw) : null,
      lpPerQuote: market.lpPerQuote ? Number(market.lpPerQuote.raw) : null,
    };
    const current = marketsByVerse.get(market.verseId) ?? [];
    current.push(normalizedMarket);
    marketsByVerse.set(market.verseId, current);
  }

  const verses = fixtureData.verses.items.map<FixtureVerse>((verse) => {
    const threshold = amount(verse.genesis.minSuccessThreshold.raw);
    const normalRaised = amount(verse.genesis.normalRaised.raw);
    const leverageInterest = amount(verse.genesis.leverageInterest.raw);
    const preorderRaised = amount(verse.genesis.preorderRaised.raw);
    const mainMarket = fixtureData.markets.items.find(
      (market) => market.verseId === verse.id && market.pool === 'main',
    );
    const candles = mainMarket && 'candles' in mainMarket ? mainMarket.candles : undefined;
    const firstCandle = candles?.[0];
    const lastCandle = candles?.at(-1);
    const currentPrice = lastCandle ? Number(lastCandle.c) : null;
    // 24h change: prefer the trailing 24-candle window (when enough candles); otherwise fall back to the full window
    const windowStart =
      candles && candles.length >= 25 ? candles[candles.length - 24] : firstCandle;
    const change24h =
      windowStart && lastCandle
        ? ((Number(lastCandle.c) - Number(windowStart.o)) / Number(windowStart.o)) * 100
        : null;

    return {
      id: verse.id,
      sourceRef: verse.sourceRef,
      scenario: verse.scenario,
      name: verse.name,
      symbol: verse.symbol,
      stage: verse.stage as VerseStage,
      governanceChain: verse.governanceChain,
      governanceChainName:
        chainMeta.get(verse.governanceChain)?.name ?? String(verse.governanceChain),
      createdAt: verse.createdAt,
      participantCount: verse.participants,
      description: verse.description ?? null,
      socials: (verse.socials ?? [])
        .map((social) => ({
          // The kind union type is validated as a backstop by the fixture schema (verseSocialSchema)
          kind: social.kind as FixtureSocial['kind'],
          url: social.url,
        }))
        .sort((a, b) => SOCIAL_ORDER.indexOf(a.kind) - SOCIAL_ORDER.indexOf(b.kind)),
      projectedMarketCap: verse.projectedMarketCap ? amount(verse.projectedMarketCap.raw) : null,
      // Raise denomination: governance chain native symbol -> uAsset family (ETH->UETH, BNB->UBNB, both in the assets whitelist;
      // mainnet native symbols -- the testnet tBNB has no whitelist entry)
      raiseAsset: `U${chainMeta.get(verse.governanceChain)?.nativeSymbol ?? 'Asset'}`,
      minSuccessThreshold: threshold,
      normalRaised,
      leverageInterest,
      preorderRaised,
      participationSize: normalRaised + leverageInterest + preorderRaised,
      normalProgress: progress(normalRaised, threshold),
      leverageProgress: progress(leverageInterest, threshold),
      preorderProgress: progress(preorderRaised, threshold),
      endsAt: verse.genesis.endsAt,
      preorderCapacityRatio: verse.genesis.preorderCapacityRatio
        ? Number(verse.genesis.preorderCapacityRatio.raw)
        : null,
      leverageInterestRate: verse.genesis.leverageInterestRate
        ? Number(verse.genesis.leverageInterestRate.raw)
        : null,
      leverageDebtCap: verse.genesis.leverageDebtCap
        ? amount(verse.genesis.leverageDebtCap.raw)
        : null,
      fastGenesis: verse.genesis.fastGenesis ?? false,
      unlockTimeAt: new Date(Date.parse(verse.genesis.endsAt) + FIXED_LOCKUP_MS).toISOString(),
      volume24h: verse.livePhase ? amount(verse.livePhase.volume24h.raw) : null,
      stakingApy: verse.livePhase ? Number(verse.livePhase.stakingApy.raw) * 100 : null,
      treasuryFundUsd: verse.livePhase ? amount(verse.livePhase.treasuryFundUsd.raw) : null,
      unlockedAt: verse.unlock?.unlockedAtTx ?? null,
      currentPrice,
      change24h,
      memecoinAddress: mainMarket?.tokenStats?.tokenAddress.value ?? null,
      markets: marketsByVerse.get(verse.id) ?? [],
    };
  });

  const genesisLocked = verses
    .filter((verse) => verse.stage === 'genesis')
    .reduce((sum, verse) => sum + verse.participationSize, 0);
  const lockedPools = verses
    .filter((verse) => verse.stage === 'locked')
    .flatMap((verse) => verse.markets)
    .reduce((sum, market) => sum + market.tvl, 0);
  // Cumulative participating-address sample: sum of each verse's participants (address-level dedup
  // sample); cross-verse overlap is not deducted -- an order-of-magnitude sample; production reads
  // on-chain values. Do not count accounts.items -- those are the portfolio page's persona wallets,
  // not a network-wide sample.
  const participantTotal = verses.reduce((sum, verse) => sum + verse.participantCount, 0);
  const sampleAccount = fixtureData.accounts.items[0];

  return {
    timeAnchor: FIXTURE_TIME_ANCHOR,
    verses,
    assets: fixtureData.assets.items
      .filter((asset) => asset.kind === 'uasset')
      .map((asset) => ({
        id: asset.id,
        sourceRef: asset.sourceRef,
        symbol: asset.symbol,
        anchorNote: asset.anchorNote,
      })),
    homeMetrics: {
      totalLocked: genesisLocked + lockedPools,
      verseCount: verses.length,
      deployedVerseCount: verses.filter(
        (verse) => verse.stage === 'locked' || verse.stage === 'unlocked',
      ).length,
      participantCount: participantTotal,
      sourceRefs: [
        ...new Set([
          ...fixtureData.verses.items.map((verse) => verse.sourceRef),
          ...fixtureData.markets.items.map((market) => market.sourceRef),
          ...fixtureData.accounts.items.map((account) => account.sourceRef),
        ]),
      ],
    },
    sampleAccount: {
      address: sampleAccount.address.value,
      sourceRef: sampleAccount.sourceRef,
    },
  };
}

export function getFixtureSnapshot() {
  return getSnapshot();
}

/** Detail page URL segment parsing: accepts numeric form (/memeverse/21, = on-chain uint256 verseId convention) and the legacy verse-021 form */
export function getFixtureVerse(verseId: string) {
  const match = /^(?:verse-)?(\d+)$/i.exec(verseId);
  if (!match) return null;
  const numeric = Number(match[1]);
  return (
    getSnapshot().verses.find((verse) => Number(verse.id.replace(/^verse-/, '')) === numeric) ??
    null
  );
}

export type FixtureParticipation = {
  verseId: string;
  owner: string;
  kind: 'normal' | 'leverage' | 'preorder';
  /** Participation route (only meaningful for kind=normal; other kinds should omit it, not schema-enforced; null=absent from the record) */
  route: 'direct' | 'stake' | null;
  amount: number;
  sourceRef: string;
};

export type FixtureYieldSource = {
  /** Source id (fixtures yield-sources.json, ysrc prefix) */
  id: string;
  sourceRef: string;
  /** Source name (Lido/Aave...) */
  name: string;
  /** Asset group participable under this source (determined only after choosing the source) */
  assets: FixtureAsset[];
};

export type FixtureParticipationOptions = {
  /** uAsset raised by this verse (specified at creation, the sole denomination asset for direct pay/preorder; null=missing from fixture whitelist) */
  raiseAsset: FixtureAsset | null;
  /** Reserve assets payable on the face-value direct-swap path (PSM pairs read from fixture, no project affiliation assumed) */
  reserves: FixtureAsset[];
  /** Staking-path source registry (source -> asset group, read from fixture, no project affiliation assumed) */
  yieldSourceRegistry: FixtureYieldSource[];
  /** Leverage-interest Credit direct-pay asset (kind=credit and pairedUAssetId=this verse's raised uAsset; null=no paired Credit) */
  creditAsset: FixtureAsset | null;
};

/** Participation route -> payment-asset option resolution (the route determines the payment asset; direct pay is limited to this verse's raised uAsset) */
export function getFixtureParticipationOptions(
  raiseAssetSymbol: string,
): FixtureParticipationOptions {
  const raiseAsset = fixtureData.assets.items.find(
    (asset) => asset.kind === 'uasset' && asset.symbol === raiseAssetSymbol,
  );
  const reserveIds = new Set(
    raiseAsset
      ? fixtureData.psm.items
          .filter((pair) => pair.uAssetId === raiseAsset.id)
          .map((pair) => pair.reserveId)
      : [],
  );
  const assetById = new Map(fixtureData.assets.items.map((asset) => [asset.id, asset]));
  const toAsset = (asset: (typeof fixtureData.assets.items)[number]) => ({
    id: asset.id,
    sourceRef: asset.sourceRef,
    symbol: asset.symbol,
    name: asset.name,
    anchorValue: asset.anchorValue,
  });
  // uAsset symbol convention = 'U' + underlying family symbol (UETH/UUSD/UBNB); sources
  // open only to same-family verses
  // (a UETH verse can never offer sUSDe-like USD sources)
  const family = raiseAssetSymbol.slice(1);
  return {
    raiseAsset: raiseAsset
      ? {
          id: raiseAsset.id,
          sourceRef: raiseAsset.sourceRef,
          symbol: raiseAsset.symbol,
          anchorNote: raiseAsset.anchorNote,
        }
      : null,
    reserves: fixtureData.assets.items.filter((asset) => reserveIds.has(asset.id)).map(toAsset),
    yieldSourceRegistry: fixtureData.yieldSources.items
      .filter((source) => source.anchor === family)
      .map((source) => ({
        id: source.id,
        sourceRef: source.sourceRef,
        name: source.name,
        assets: source.assetIds.flatMap((assetId) => {
          const asset = assetById.get(assetId);
          return asset ? [toAsset(asset)] : [];
        }),
      })),
    creditAsset: (() => {
      // Credit is one-to-one with uAsset (contract creditOf(uAsset)):
      // take only the Credit paired with this verse's raised uAsset; other Credits cannot pay this verse's interest
      const credit = fixtureData.assets.items.find(
        (asset) => asset.kind === 'credit' && raiseAsset && asset.pairedUAssetId === raiseAsset.id,
      );
      return credit ? { id: credit.id, sourceRef: credit.sourceRef, symbol: credit.symbol } : null;
    })(),
  };
}

/** Sample account's genesis participation records (data source for the Portfolio refund/voucher section; amount conversion same as the ViewModel convention) */
export function getFixtureParticipations(): FixtureParticipation[] {
  return fixtureRepository.participations().map((p) => ({
    verseId: p.verseId,
    owner: p.owner.value,
    kind: p.kind as FixtureParticipation['kind'],
    route: (p as { route?: 'direct' | 'stake' }).route ?? null,
    amount: amount(p.amount.raw),
    sourceRef: p.sourceRef,
  }));
}

export type FixtureCreateConfig = {
  /** Allowed genesis duration range (center min/maxDurationDays read-value sample) */
  minDurationDays: number;
  maxDurationDays: number;
  /** Fixed lockup: unlockTime = endTime + 365 days (FIXED_LOCKUP_DURATION contract constant, not a registration parameter) */
  lockupDays: number;
  /** Cross-chain fan-out fee sample per remote chain (in governance-chain native asset; fee=0 for hub-chain targets); no registration fee */
  remoteDeployFee: number;
  /** LayerZero send fee sample for origin-chain -> registration-hub-chain when registering from a remote chain (quoteRegister;
   *  same-chain origin=0); sample scenario assumption = governance chain is the registration hub chain */
  remoteSendFee: number;
  sourceRef: string;
};

/** Create-form on-chain parameter snapshot; returns null when the create-config fixture has no records -> UI null-not-rendered */
export function getFixtureCreateConfig(): FixtureCreateConfig | null {
  const config = fixtureData.createConfig.items[0];
  if (!config) return null;
  return {
    minDurationDays: config.minDurationDays,
    maxDurationDays: config.maxDurationDays,
    lockupDays: config.lockupDays,
    remoteDeployFee: amount(config.remoteDeployFee.raw),
    remoteSendFee: amount(config.remoteSendFee.raw),
    sourceRef: config.sourceRef,
  };
}

/** Symbol occupation detection sample: a symbol cannot be reused while the previous verse's genesis window is unfinished
 *  (registration reverts with SymbolNotUnlock; endTime=registration+durationDays×DAY is the genesis deadline; at genesis
 *  end nonce+1 -> new uniqueId makes the symbol reusable).
 *  Sample convention: a verse with snapshot stage='genesis' = inside the genesis window = locked. The contract maps by raw byte string --
 *  matching must be case-sensitive and not trimmed. Production=previewRegistration+symbolRegistry on-chain reads */
export function getFixtureOccupiedSymbols(): string[] {
  return fixtureRepository
    .verses()
    .filter((verse) => verse.stage === 'genesis')
    .map((verse) => verse.symbol);
}

/** Shell chain-selector data: six-chain view; functional exports keep the sentinel object out of the production bundle */
export function getFixtureChains() {
  return fixtureRepository.chains().map((c) => ({
    chainId: c.chainId,
    name: c.name,
    env: c.env as 'mainnet' | 'testnet',
    nativeSymbol: c.nativeSymbol,
    sourceRef: c.sourceRef,
  }));
}

// ---------------------------------------------------------------------------
// Four-tab detail page ViewModel (Locked/Unlocked detail page = header card
// + stats bar/candles/Swap persistent section + Liquidity/POL/Yield Vault/DAO four tabs; POL
// nominal value = 2×uAsset side (full-range convention). All sample values come from fixtures;
// missing fields -> null -> UI does not render.
// ---------------------------------------------------------------------------

export type FixtureCandle = { t: string; o: number; h: number; l: number; c: number; v: number };

export type FixtureFineCandles = {
  '1m': FixtureCandle[];
  '5m': FixtureCandle[];
  '15m': FixtureCandle[];
};

export type FixtureVerseTrade = {
  /** Main-pool candles (1h raw granularity); empty=no sample (degradation notice) */
  candles: FixtureCandle[];
  /** Fine-granularity candle samples (all granularities selectable); null=fixture missing */
  fineCandles: FixtureFineCandles | null;
  tokenStats: {
    price: number | null;
    change24h: number | null;
    /** Market cap = current price × total supply (derived); null=any input missing */
    marketCap: number | null;
    /** Main-pool TVL (stats-bar convention; the four-pool total is computed by the Liquidity tab itself) */
    liquidity: number;
    /** Main-pool 24h volume; null=main-pool volume missing */
    volume24h: number | null;
    holders: number | null;
    totalSupply: number | null;
    /** Memecoin CA (fixture sample); null=no sample */
    tokenAddress: string | null;
  };
  pools: Array<
    FixtureMarket & {
      /** Both-side asset symbols of the pool (display order: MEME first); uAsset side = the verse's raise asset */
      baseSymbol: string;
      quoteSymbol: string;
    }
  >;
};

/** Infinite left-scroll history total (1h bars ≈ 1 year) */
const HISTORY_TOTAL_HOURLY = 8760;

/** Candle history backfill (derived sample): the fixture stores only 168h of real data; anchored at the seam (k=1's close
 *  === fixture first candle's open), a deterministic random walk toward the past extends it to ~1 year -- drift accumulates
 *  only in the seam-less far end, with zero jump at the seam (anchor at the newest end so the seam stays continuous);
 *  results are constant for a given verseId; production defers to data-source pagination */
function extendHourlyHistory(candles: FixtureCandle[], seedKey: string): FixtureCandle[] {
  if (candles.length === 0 || candles.length >= HISTORY_TOTAL_HOURLY) return candles;
  let seed = 2166136261;
  for (const ch of seedKey) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619);
  const rnd = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const first = candles[0];
  const firstT = Date.parse(first.t);
  const older: FixtureCandle[] = [];
  let price = first.o; // Seam anchor: k=1's close === fixture first candle's open; walk toward the past from here
  for (let k = 1; k <= HISTORY_TOTAL_HOURLY - candles.length; k++) {
    const open = price * (1 + (rnd() - 0.5) * 0.011);
    const high = Math.max(open, price) * (1 + rnd() * 0.004);
    const low = Math.min(open, price) * (1 - rnd() * 0.004);
    older.push({
      t: new Date(firstT - k * 3_600_000).toISOString().replace('.000Z', 'Z'),
      o: open,
      h: high,
      l: low,
      c: price,
      v: Math.round(6000 + rnd() * 9000),
    });
    price = open;
  }
  older.reverse();
  return [...older, ...candles];
}

export function getFixtureVerseTrade(verseId: string): FixtureVerseTrade | null {
  const verse = getSnapshot().verses.find((item) => item.id === verseId);
  if (!verse) return null;
  const rawMarkets = fixtureData.markets.items.filter((market) => market.verseId === verseId);
  const mainRaw = rawMarkets.find((market) => market.pool === 'main');
  const candles: FixtureCandle[] =
    mainRaw && 'candles' in mainRaw && mainRaw.candles
      ? mainRaw.candles.map((candle) => ({
          t: candle.t,
          o: Number(candle.o),
          h: Number(candle.h),
          l: Number(candle.l),
          c: Number(candle.c),
          v: candle.v != null ? Number(candle.v) : 0,
        }))
      : [];
  // Backfilled derived history (infinite left-scroll data pool; trailing fixture samples unchanged, stats unaffected)
  const historyCandles = extendHourlyHistory(candles, `${verseId}:history`);
  const toCandles = (
    rows: Array<{ t: string; o: string; h: string; l: string; c: string; v?: string }>,
  ) =>
    rows.map((candle) => ({
      t: candle.t,
      o: Number(candle.o),
      h: Number(candle.h),
      l: Number(candle.l),
      c: Number(candle.c),
      v: candle.v != null ? Number(candle.v) : 0,
    }));
  const fineRaw = mainRaw && 'candlesFine' in mainRaw ? mainRaw.candlesFine : undefined;
  const fineCandles =
    fineRaw && fineRaw['1m'] && fineRaw['5m'] && fineRaw['15m']
      ? {
          '1m': toCandles(fineRaw['1m']),
          '5m': toCandles(fineRaw['5m']),
          '15m': toCandles(fineRaw['15m']),
        }
      : null;
  const stats = mainRaw && 'tokenStats' in mainRaw ? mainRaw.tokenStats : undefined;
  const pools = verse.markets.map((market) => {
    // POL/PT are categories, not standalone symbols: POL-<MEME>, PT-<MEME>
    const polSymbol = `POL-${verse.symbol}`;
    const ptSymbol = `PT-${verse.symbol}`;
    const pair: Record<FixtureMarket['pool'], [string, string]> = {
      main: [verse.symbol, verse.raiseAsset],
      'pol-uasset': [polSymbol, verse.raiseAsset],
      'pt-uasset': [ptSymbol, verse.raiseAsset],
      'pt-pol': [ptSymbol, polSymbol],
    };
    return { ...market, baseSymbol: pair[market.pool][0], quoteSymbol: pair[market.pool][1] };
  });
  // Stats-bar convention: Liq/Vol = main-pool data (trades route to that pool), not the four-pool total
  const mainPool = pools.find((pool) => pool.pool === 'main');
  const liquidity = mainPool?.tvl ?? 0;
  const totalSupply = stats ? amount(stats.totalSupply.raw) : null;
  return {
    candles: historyCandles,
    fineCandles,
    tokenStats: {
      price: verse.currentPrice,
      change24h: verse.change24h,
      marketCap:
        verse.currentPrice != null && totalSupply != null ? verse.currentPrice * totalSupply : null,
      liquidity,
      volume24h: mainPool?.volume24h != null ? mainPool.volume24h : null,
      holders: stats?.holders ?? null,
      totalSupply,
      tokenAddress: stats?.tokenAddress.value ?? null,
    },
    pools,
  };
}

export type FixtureStaking = {
  vaultAddress: string;
  totalStaked: number;
  /** 1 share ≈ N Memecoin (including the virtualAssets buffer) */
  assetsPerShare: number;
  /** Trailing 7-day realized APY (off-chain derived display value) */
  apy7d: number;
  myShares: number;
  /** Share value = myShares × assetsPerShare (derived) */
  myShareValue: number;
  delegatee: string;
  pendingRedeems: Array<{
    lockedAssets: number;
    requestedAt: string;
    maturesAt: string;
    /** maturesAt ≤ snapshot anchor -> matured and withdrawable (REDEEM_DELAY≈1 day) */
    ready: boolean;
    /** Milliseconds remaining from the snapshot anchor to maturity (countdown display start; 0=matured) */
    remainingMs: number;
  }>;
  /** Matured total (Withdraw sub-tab Total Available) */
  claimableTotal: number;
};

/** uAsset USD sample price (fixture dummy data; missing returns null -> UI hides the USD conversion row) */
export function getFixtureAssetUsdSample(symbol: string): number | null {
  const asset = fixtureData.assets.items.find((item) => item.symbol === symbol);
  return asset?.usdSample ?? null;
}

/** Memecoin staking yield vault sample (locked/unlocked verse; null=no sample for this verse -> the whole panel is not rendered) */
export function getFixtureStaking(verseId: string): FixtureStaking | null {
  const record = fixtureData.staking.items.find((item) => item.verseId === verseId);
  if (!record) return null;
  const anchor = Date.parse(FIXTURE_TIME_ANCHOR);
  const pendingRedeems = record.pendingRedeems.map((entry) => ({
    lockedAssets: amount(entry.lockedAssets.raw),
    requestedAt: entry.requestedAt,
    maturesAt: entry.maturesAt,
    ready: Date.parse(entry.maturesAt) <= anchor,
    remainingMs: Math.max(0, Date.parse(entry.maturesAt) - anchor),
  }));
  const assetsPerShare = Number(record.assetsPerShare.raw);
  const myShares = amount(record.myShares.raw);
  return {
    vaultAddress: record.vaultAddress.value,
    totalStaked: amount(record.totalStaked.raw),
    assetsPerShare,
    apy7d: Number(record.apy7d.raw),
    myShares,
    myShareValue: myShares * assetsPerShare,
    delegatee: record.delegatee.value,
    pendingRedeems,
    claimableTotal: pendingRedeems
      .filter((entry) => entry.ready)
      .reduce((sum, e) => sum + e.lockedAssets, 0),
  };
}

export type FixturePolPosition = {
  polAddress: string;
  polSupply: number;
  /** uAsset-side amount of the main pool per 1 POL */
  uAssetPerPol: number;
  /** Nominal value = 2 × uAssetPerPol (full-range simplification; derived) */
  nominalValuePerPol: number;
  /** POL/uAsset pool market price */
  marketPricePerPol: number;
  /** PT/POL pool market price per 1 PT (YT implied price=1−this value, from the "1 POL=1 PT+1 YT" identity) */
  ptPricePerPol: number;
  /** Flash Swap user fee-rate sample (sample band 0.3%-85% of the user's payment; spectrum <1% to very high) */
  flashUserFeeRate: number;
  myPol: number;
  myPt: number;
  myYt: number;
  /** Sample account's memecoin balance in this verse (Mint POL supply-side sample) */
  myMemecoin: number;
  /** Sample account's uAsset balance (wallet-level asset; Mint POL supply-side sample) */
  myUAsset: number;
  /** Sample account's PSM-paired reserve balance in this verse (wallet-level; Swap reserve-side supply sample) */
  myReserve: number;
  /** Four-pool LP token balance samples (Remove Liquidity supply side; key=pool identifier) */
  myLp: { main: number; 'pol-uasset': number; 'pt-uasset': number; 'pt-pol': number };
  /** YT claimable after genesis ends (claimNormalYT, one-time pro rata by contribution) */
  claimableYt: number;
  /** uAsset redeemed per 1 YT (remaining pool after settlement × share / circulating YT; null=leg value unavailable, dialog Receive box falls back to 0.00) */
  ytRedeemUAssetPerUnit: number | null;
  /** Memecoin redeemed per 1 YT (settlementMemecoin × share / circulating YT; null=leg value unavailable, dialog Receive box falls back to 0.00) */
  ytRedeemMemecoinPerUnit: number | null;
};

/** POL/PT/YT positions and valuation sample (locked/unlocked verse; null=this panel is not rendered) */
export function getFixturePolPosition(verseId: string): FixturePolPosition | null {
  const record = fixtureData.polPositions.items.find((item) => item.verseId === verseId);
  if (!record) return null;
  const uAssetPerPol = Number(record.uAssetPerPol.raw);
  return {
    polAddress: record.polAddress.value,
    polSupply: amount(record.polSupply.raw),
    uAssetPerPol,
    nominalValuePerPol: uAssetPerPol * 2,
    marketPricePerPol: Number(record.marketPricePerPol.raw),
    ptPricePerPol: Number(record.ptPricePerPol.raw),
    flashUserFeeRate: Number(record.flashUserFeeRate.raw),
    myPol: amount(record.myPol.raw),
    myPt: amount(record.myPt.raw),
    myYt: amount(record.myYt.raw),
    myMemecoin: amount(record.myMemecoin.raw),
    myUAsset: amount(record.myUAsset.raw),
    myReserve: amount(record.myReserve.raw),
    myLp: {
      main: amount(record.myLp.main.raw),
      'pol-uasset': amount(record.myLp['pol-uasset'].raw),
      'pt-uasset': amount(record.myLp['pt-uasset'].raw),
      'pt-pol': amount(record.myLp['pt-pol'].raw),
    },
    claimableYt: amount(record.claimableYt.raw),
    ytRedeemUAssetPerUnit: record.ytRedeemUAssetPerUnit
      ? Number(record.ytRedeemUAssetPerUnit.raw)
      : null,
    ytRedeemMemecoinPerUnit: record.ytRedeemMemecoinPerUnit
      ? Number(record.ytRedeemMemecoinPerUnit.raw)
      : null,
  };
}

/** Treasury breakdown composition rows (governance.json treasuryAssets/unclaimedAssets samples) */
export type FixtureGovernanceAsset = {
  symbol: string;
  name: string;
  amount: number;
  usdValue: number;
};

export type FixtureGovernanceState = {
  cycleNumber: string;
  cycleDurationDays: number;
  cycleEndsAt: string;
  finalized: boolean;
  claimWindowEndsAt: string | null;
  governorAddress: string | null;
  incentivizerAddress: string | null;
  delegates: number | null;
  totalVotingPower: number | null;
  myVotes: number | null;
  treasuryUAsset: number | null;
  /** Allocation ratio (bps; initial 2500=25%, governance-changeable) */
  rewardRatioBps: number | null;
  cumulativeIncentivePool: number | null;
  /** Current-cycle treasury composition sample (null=no sample -> breakdown entry not rendered) */
  treasuryAssets: FixtureGovernanceAsset[] | null;
  currentCycleVotes: { total: number; mine: number } | null;
  /** If already voted this cycle, the estimated claimable for this cycle by vote share (derived) */
  estimatedClaimable: number | null;
  lastCycle: {
    number: string;
    treasuryUAsset: number;
    /** Previous cycle's end-of-cycle treasury composition sample (null=no sample -> breakdown entry not rendered) */
    treasuryAssets: FixtureGovernanceAsset[] | null;
    remainingRewards: number;
    totalVotes: number;
    myVotes: number;
    myClaimable: number;
    /** Claimable-reward composition sample (multiple tokens by voting-power share; null=no sample -> breakdown entry not rendered) */
    claimableAssets: FixtureGovernanceAsset[] | null;
    /** Unclaimed-reward composition sample (null=no sample -> breakdown entry not rendered) */
    unclaimedAssets: FixtureGovernanceAsset[] | null;
  } | null;
  proposalCount: { total: number; active: number };
};

/** DAO governance cycle state sample (locked/unlocked verse; null=no governance sample for this verse -> DAO tab shows only the heading) */
export function getFixtureGovernanceState(verseId: string): FixtureGovernanceState | null {
  const record = fixtureData.governance.items.find((item) => item.verseId === verseId);
  if (!record) return null;
  const currentCycleVotes =
    record.currentCycleVotes && Number(record.currentCycleVotes.total.raw) > 0
      ? {
          total: amount(record.currentCycleVotes.total.raw),
          mine: amount(record.currentCycleVotes.mine.raw),
        }
      : null;
  const cumulativeIncentivePool = record.cumulativeIncentivePool
    ? amount(record.cumulativeIncentivePool.raw)
    : null;
  const mapAssets = (
    list:
      | { symbol: string; name: string; amount: { raw: string }; usdValue: { raw: string } }[]
      | undefined,
  ): FixtureGovernanceAsset[] | null =>
    list
      ? list.map((asset) => ({
          symbol: asset.symbol,
          name: asset.name,
          amount: Number(asset.amount.raw),
          usdValue: Number(asset.usdValue.raw),
        }))
      : null;
  return {
    cycleNumber: record.cycleNumber,
    cycleDurationDays: record.cycleDurationDays,
    cycleEndsAt: record.cycleEndsAt,
    finalized: record.finalized,
    claimWindowEndsAt: record.claimWindowEndsAt ?? null,
    governorAddress: record.governorAddress?.value ?? null,
    incentivizerAddress: record.incentivizerAddress?.value ?? null,
    delegates: record.delegates ?? null,
    totalVotingPower: record.totalVotingPower ? amount(record.totalVotingPower.raw) : null,
    myVotes: record.myVotes ? amount(record.myVotes.raw) : null,
    treasuryUAsset: record.treasuryUAsset ? amount(record.treasuryUAsset.raw) : null,
    rewardRatioBps: record.rewardRatio ? Number(record.rewardRatio.raw) : null,
    cumulativeIncentivePool,
    treasuryAssets: mapAssets(record.treasuryAssets),
    currentCycleVotes,
    estimatedClaimable:
      cumulativeIncentivePool != null && currentCycleVotes
        ? (cumulativeIncentivePool * currentCycleVotes.mine) / currentCycleVotes.total
        : null,
    lastCycle: record.lastCycle
      ? {
          number: record.lastCycle.number,
          treasuryUAsset: amount(record.lastCycle.treasuryUAsset.raw),
          treasuryAssets: mapAssets(record.lastCycle.treasuryAssets),
          remainingRewards: amount(record.lastCycle.remainingRewards.raw),
          totalVotes: amount(record.lastCycle.totalVotes.raw),
          myVotes: amount(record.lastCycle.myVotes.raw),
          myClaimable: amount(record.lastCycle.myClaimable.raw),
          claimableAssets: mapAssets(record.lastCycle.claimableAssets),
          unclaimedAssets: mapAssets(record.lastCycle.unclaimedAssets),
        }
      : null,
    proposalCount: {
      total: record.proposals.length,
      active: record.proposals.filter((proposal) => proposal.state === 'active').length,
    },
  };
}

// ---------------------------------------------------------------------------
// Portfolio page ViewModel (four sections: (1) to-dos (2) assets & cross-chain
// (3) positions & savings (4) participation vouchers). Conventions: cross-chain lives on this page
// (there is no standalone /bridge page); "1:1 Convert" = user-facing name for PSM par
// swap (avoiding collision with the trade desk's "Swap"); the to-do section only collects
// "overdue-with-consequences" items (undated claimable yields sink into section (4)'s filter --
// vault-ready is the one undated claimable elevated into to-dos; same-kind aggregation applies to
// the vault card only, per-verse kinds get one card each). All times anchored to FIXTURE_TIME_ANCHOR.
// ---------------------------------------------------------------------------

const ANCHOR_MS = Date.parse(FIXTURE_TIME_ANCHOR);

/** 24-hour liquidity protection window (anchored to the actual unlock transaction time, not unlockTime) */
export const PROTECTION_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Sample account's wallet balance view (section (2) asset rows): asset -> per-chain distribution aggregation (product assets = uAsset family + genesis credits;
 *  reserve/native balances are unrelated to this product and stay out of the table; only
 *  kind==='reserve' is skipped, the rest cast to uasset|credit -- current data contains only
 *  uasset/reserve/credit kinds) */
export type FixtureWalletAsset = {
  assetId: string;
  symbol: string;
  kind: 'uasset' | 'credit';
  /** uAsset USD sample price (fixture sample); null=hide conversion */
  usdSample: number | null;
  total: number;
  chains: Array<{ chainId: number; chainName: string; amount: number }>;
  /** Bridgeable via the protocol OFT (uAsset family + GenesisCredit; reserve/native are read-only) */
  bridgeable: boolean;
};

export function getFixtureWalletAssets(): FixtureWalletAsset[] {
  const chainMeta = new Map(fixtureData.chains.items.map((chain) => [chain.chainId, chain]));
  const assetMeta = new Map(fixtureData.assets.items.map((asset) => [asset.id, asset]));
  const byAsset = new Map<string, Array<{ chainId: number; amount: number }>>();
  for (const row of fixtureData.balances.items) {
    const current = byAsset.get(row.assetId) ?? [];
    current.push({ chainId: row.chainId, amount: amount(row.amount.raw) });
    byAsset.set(row.assetId, current);
  }
  const rows: FixtureWalletAsset[] = [];
  for (const [assetId, chains] of byAsset) {
    const asset = assetMeta.get(assetId);
    if (!asset || asset.kind === 'reserve') continue;
    rows.push({
      assetId,
      symbol: asset.symbol,
      kind: asset.kind as FixtureWalletAsset['kind'],
      // Credit has no independent quote: redeemable 1:1 at the same share as its paired uAsset,
      // so the USD sample price = the paired uAsset's sample price; no pairing = hide conversion
      usdSample:
        asset.usdSample ??
        (asset.kind === 'credit' && asset.pairedUAssetId
          ? (assetMeta.get(asset.pairedUAssetId)?.usdSample ?? null)
          : null),
      total: chains.reduce((sum, row) => sum + row.amount, 0),
      chains: chains.map((row) => ({
        chainId: row.chainId,
        chainName: chainMeta.get(row.chainId)?.name ?? String(row.chainId),
        amount: row.amount,
      })),
      bridgeable: asset.kind === 'uasset' || asset.kind === 'credit',
    });
  }
  // uAsset family first (participation currencies), then genesis credits; sorted by symbol within family
  const kindOrder: Record<FixtureWalletAsset['kind'], number> = {
    uasset: 0,
    credit: 1,
  };
  return rows.sort(
    (a, b) => kindOrder[a.kind] - kindOrder[b.kind] || a.symbol.localeCompare(b.symbol),
  );
}

/** Reserve asset balance table (Max source for the Redeem side of the PSM Convert dialog; reserves are not listed as assets) */
export function getFixtureReserveBalances(): Record<string, number> {
  const assetMeta = new Map(fixtureData.assets.items.map((asset) => [asset.id, asset]));
  const balances: Record<string, number> = {};
  for (const row of fixtureData.balances.items) {
    const asset = assetMeta.get(row.assetId);
    if (asset && asset.kind === 'reserve') {
      balances[asset.symbol] = (balances[asset.symbol] ?? 0) + amount(row.amount.raw);
    }
  }
  return balances;
}

/** All-symbol wallet balance table (aggregated across chains by symbol; Balance/Max source for the genesis participation form).
 *  Symbols with no snapshot row are absent from the table (-> slot state -- + Max disabled, same as swap-panel) */
export function getFixtureWalletBalances(): Record<string, number> {
  const assetMeta = new Map(fixtureData.assets.items.map((asset) => [asset.id, asset]));
  const balances: Record<string, number> = {};
  for (const row of fixtureData.balances.items) {
    const asset = assetMeta.get(row.assetId);
    if (asset) {
      balances[asset.symbol] = (balances[asset.symbol] ?? 0) + amount(row.amount.raw);
    }
  }
  return balances;
}

/** PSM 1:1 convert pair (section (2) convert dialog): looked up by uAsset symbol */
export type FixturePsmPair = {
  chainId: number;
  reserveSymbol: string;
  /** mint fee / redeem fee (bps -> ratio) */
  feeIn: number;
  feeOut: number;
  /** Remaining mint allowance = stockCap − netMinted */
  headroom: number;
  /** Remaining redeemable reserve */
  reserveAvailable: number;
};

export function getFixturePsmPair(uAssetSymbol: string): FixturePsmPair | null {
  const assetMeta = new Map(fixtureData.assets.items.map((asset) => [asset.id, asset]));
  const uAsset = fixtureData.assets.items.find(
    (asset) => asset.kind === 'uasset' && asset.symbol === uAssetSymbol,
  );
  if (!uAsset) return null;
  const pair = fixtureData.psm.items.find((item) => item.uAssetId === uAsset.id);
  if (!pair) return null;
  return {
    chainId: pair.chainId,
    reserveSymbol: assetMeta.get(pair.reserveId)?.symbol ?? '',
    feeIn: Number(pair.tin.raw) / 1e4,
    feeOut: Number(pair.tout.raw) / 1e4,
    headroom: amount(pair.stockCap.raw) - amount(pair.netMinted.raw),
    reserveAvailable: amount(pair.reserveAvailable.raw),
  };
}

/** Cross-chain message view (section (2) in-transit/stranded; no cross-chain history is shown) */
export type FixtureBridgeMessageView = {
  id: string;
  fromChainId: number;
  fromChainName: string;
  toChainId: number;
  toChainName: string;
  assetSymbol: string;
  amount: number;
  sentAt: string;
  stage: 'sent' | 'delivered' | 'settled' | 'stranded';
  /** 6-decimal remainder left on the source chain; null=no remainder */
  remainder: number | null;
};

export function getFixtureBridgeMessages(): FixtureBridgeMessageView[] {
  const chainMeta = new Map(fixtureData.chains.items.map((chain) => [chain.chainId, chain]));
  const assetMeta = new Map(fixtureData.assets.items.map((asset) => [asset.id, asset]));
  return fixtureData.bridgeMessages.items.map((row) => ({
    id: row.id,
    fromChainId: row.fromChain,
    fromChainName: chainMeta.get(row.fromChain)?.name ?? String(row.fromChain),
    toChainId: row.toChain,
    toChainName: chainMeta.get(row.toChain)?.name ?? String(row.toChain),
    assetSymbol: assetMeta.get(row.assetId)?.symbol ?? '',
    amount: amount(row.amount.raw),
    sentAt: row.sentAt,
    stage: row.stage as FixtureBridgeMessageView['stage'],
    remainder: row.remainderOnSource ? amount(row.remainderOnSource.raw) : null,
  }));
}

/** CDP position view (section (3)): debt unit derived via the yield-sources registry anchor family (Lido->ETH->UETH) */
export type FixtureCdpPosition = {
  id: string;
  chainId: number;
  chainName: string;
  collateralSymbol: string;
  collateralAmount: number;
  /** Outstanding uAsset debt (v1 face-value parity = the collateral amount) */
  debt: number;
  uAssetSymbol: string;
  yieldSource: string;
};

export function getFixtureCdpPositions(): FixtureCdpPosition[] {
  const chainMeta = new Map(fixtureData.chains.items.map((chain) => [chain.chainId, chain]));
  const assetMeta = new Map(fixtureData.assets.items.map((asset) => [asset.id, asset]));
  const anchorBySource = new Map(
    fixtureData.yieldSources.items.map((source) => [source.name, source.anchor]),
  );
  return fixtureData.positions.items.map((row) => {
    const collateral = assetMeta.get(row.collateral.assetId);
    const anchor = anchorBySource.get(row.yieldSource);
    return {
      id: row.id,
      chainId: row.chainId,
      chainName: chainMeta.get(row.chainId)?.name ?? String(row.chainId),
      collateralSymbol: collateral?.symbol ?? '',
      collateralAmount: amount(row.collateral.amount.raw),
      debt: amount(row.debt.raw),
      uAssetSymbol: anchor ? `U${anchor}` : 'UAsset',
      yieldSource: row.yieldSource,
    };
  });
}

/** USR savings view (section (3)): suETH->UETH family mapping; deposit value = shares × accrualIndex/1e18 */
export type FixtureUsrSavings = {
  id: string;
  /** Share symbol (suETH/suUSD/suBNB) */
  shareSymbol: string;
  /** Underlying uAsset symbol (UETH/UUSD/UBNB) */
  uAssetSymbol: string;
  chainId: number;
  chainName: string;
  /** Rate (ratio -> percentage handled by the presentation layer); 0=inactive (inactive state still shown) */
  rate: number;
  rateActive: boolean;
  /** Cap clamp flag */
  capped: boolean;
  myShares: number;
  /** Deposit value (derived) */
  myAssets: number;
  /** uAsset USD sample price (fixture dummy data; missing=null -> UI hides USD conversion) */
  usdSample: number | null;
  lastSettledAt: string;
};

export function getFixtureUsrSavings(): FixtureUsrSavings[] {
  const chainMeta = new Map(fixtureData.chains.items.map((chain) => [chain.chainId, chain]));
  const assetMeta = new Map(fixtureData.assets.items.map((asset) => [asset.id, asset]));
  // USD sample price hangs on the underlying uAsset (su* share tokens have no price), reverse-looked-up by symbol
  const assetBySymbol = new Map(fixtureData.assets.items.map((asset) => [asset.symbol, asset]));
  return fixtureData.usrVaults.items
    .map((row) => {
      const asset = assetMeta.get(row.assetId);
      if (!asset) return null;
      const rate = Number(row.usrRate.raw);
      const myShares = row.myShares ? amount(row.myShares.raw) : 0;
      const uAssetSymbol = `U${asset.symbol.replace(/^su/, '')}`;
      return {
        id: row.id,
        shareSymbol: asset.symbol,
        uAssetSymbol,
        chainId: row.chainId,
        chainName: chainMeta.get(row.chainId)?.name ?? String(row.chainId),
        rate,
        rateActive: rate > 0,
        capped: row.capped,
        myShares,
        myAssets: (myShares * Number(row.accrualIndexRaw)) / 1e18,
        usdSample: assetBySymbol.get(uAssetSymbol)?.usdSample ?? null,
        lastSettledAt: row.lastSettledAt,
      } satisfies FixtureUsrSavings;
    })
    .filter((row): row is FixtureUsrSavings => row !== null);
}

/** Yield vault statement row (section (3) compact table): staking + governance joined per verse */
export type FixtureVaultRow = {
  verse: { id: string; symbol: string; name: string };
  shareSymbol: string;
  myShares: number;
  apy7d: number;
  /** Total tokens locked in pending redeems (requestRedeem -> REDEEM_DELAY) */
  waitingTotal: number;
  /** Total matured and withdrawable (claimableRedeemRequest convention) */
  readyTotal: number;
  /** Claimable USD conversion (portfolio net-value hero: readyTotal × verse.currentPrice; no sample price=null) */
  readyUsd: number | null;
};

export function getFixtureVaultRows(): FixtureVaultRow[] {
  const verseMeta = new Map(getSnapshot().verses.map((verse) => [verse.id, verse]));
  const rows: FixtureVaultRow[] = [];
  for (const record of fixtureData.staking.items) {
    const verse = verseMeta.get(record.verseId);
    if (!verse) continue;
    const staking = getFixtureStaking(record.verseId);
    rows.push({
      verse: {
        id: verse.id,
        symbol: verse.symbol,
        name: verse.name,
      },
      shareSymbol: `s${verse.symbol}`,
      myShares: staking?.myShares ?? 0,
      apy7d: staking ? staking.apy7d * 100 : 0,
      waitingTotal: staking
        ? staking.pendingRedeems
            .filter((entry) => !entry.ready)
            .reduce((sum, entry) => sum + entry.lockedAssets, 0)
        : 0,
      readyTotal: staking?.claimableTotal ?? 0,
      readyUsd:
        verse.currentPrice != null ? (staking?.claimableTotal ?? 0) * verse.currentPrice : null,
    });
  }
  // Statement lists actual holdings only: verses with myShares=0 stay out of the portfolio (vault samples still serve the
  // verse tab; portfolio dummy data concentrates holdings into 10 verses, the rest have myShares=0)
  return rows
    .filter((row) => row.myShares > 0)
    .sort((a, b) => a.verse.id.localeCompare(b.verse.id));
}

/** Section (1) to-do aggregation (only "overdue-with-consequences" items; same-kind aggregation across verses, aggregate card shows the nearest deadline;
 *  incentives whose window has passed are not shown -- overdue ones merged into the treasury, nothing actionable left;
 *  no cross-chain stranded items -- stranded messages never enter to-dos or page-level signals) */
export type PortfolioActionKind = 'protection' | 'incentive' | 'vault-ready' | 'refund';

export type FixturePortfolioAction = {
  kind: PortfolioActionKind;
  /** Single-verse target (aggregate card=null) */
  verse: { id: string; symbol: string; name: string; raiseAsset: string } | null;
  /** Deep-link target for the action row; null when the action has no single-verse destination (currently unconsumed -- incentive rows carry their own verse) */
  focusVerseId: string | null;
  /** Aggregate count (null=single card) */
  count: number | null;
  /** Deadline ISO (null=no deadline; aggregate card=nearest deadline) */
  deadline: string | null;
  /** Milliseconds remaining from the snapshot anchor to the deadline (null=no deadline; non-null remaining ms=limited-window item, null=do-anytime item) */
  remainingMs: number | null;
  /**
   * Amount anchor (sample convention): refund=total participation (uAsset); protection=genesis principal
   * (myPt + myPol×uAssetPerPol); incentive=native myClaimable
   */
  amount: number | null;
  /** USD sample conversion (incentive=myClaimable × verse sample price; vault=Σ readyUsd; null=no sample price) */
  amountUsd: number | null;
  bridgeMessageId: string | null;
};

const KIND_ORDER: Record<PortfolioActionKind, number> = {
  protection: 0,
  incentive: 1,
  'vault-ready': 2,
  refund: 3,
};

export function getFixturePortfolioActions(): FixturePortfolioAction[] {
  const snapshot = getSnapshot();
  const actions: FixturePortfolioAction[] = [];

  // 24h protection window (unlocked less than 24h ago -- anchored to unlockedAtTx); amount=genesis principal
  // (PT 1:1 at par + POL converted to the uAsset side at uAssetPerPol -- full-exit rights composition)
  for (const verse of snapshot.verses) {
    if (verse.stage !== 'unlocked' || !verse.unlockedAt) continue;
    const remainingMs = Date.parse(verse.unlockedAt) + PROTECTION_WINDOW_MS - ANCHOR_MS;
    if (remainingMs <= 0) continue;
    const pol = getFixturePolPosition(verse.id);
    const principal = pol ? pol.myPt + pol.myPol * pol.uAssetPerPol : null;
    actions.push({
      kind: 'protection',
      verse: {
        id: verse.id,
        symbol: verse.symbol,
        name: verse.name,
        raiseAsset: verse.raiseAsset,
      },
      count: null,
      deadline: new Date(Date.parse(verse.unlockedAt) + PROTECTION_WINDOW_MS).toISOString(),
      remainingMs,
      amount: principal,
      amountUsd: null,
      focusVerseId: null,
      bridgeMessageId: null,
    });
  }

  // Cycle incentive claimable (window not passed; per-verse rows open the claim panel, the action navigates to the verse
  // page; amount=native myClaimable + USD conversion at sample price, same convention as the portfolio hero readyUsd)
  for (const gov of fixtureData.governance.items) {
    const verse = snapshot.verses.find((candidate) => candidate.id === gov.verseId);
    const claimable = gov.lastCycle ? amount(gov.lastCycle.myClaimable.raw) : 0;
    if (!verse || claimable <= 0 || !gov.claimWindowEndsAt) continue;
    const remainingMs = Date.parse(gov.claimWindowEndsAt) - ANCHOR_MS;
    if (remainingMs <= 0) continue;
    actions.push({
      kind: 'incentive',
      verse: {
        id: verse.id,
        symbol: verse.symbol,
        name: verse.name,
        raiseAsset: verse.raiseAsset,
      },
      count: null,
      deadline: gov.claimWindowEndsAt,
      remainingMs,
      amount: claimable,
      amountUsd: verse.currentPrice != null ? claimable * verse.currentPrice : null,
      focusVerseId: verse.id,
      bridgeMessageId: null,
    });
  }

  // Yield vault pending redemption (matured second step of the redeem flow; own card -- CTA anchors in-page #pf-vault,
  // no cross-verse summing since tokens differ, USD sample-price conversion for the total)
  const readyVerses = getFixtureVaultRows().filter((row) => row.readyTotal > 0);
  if (readyVerses.length > 0) {
    actions.push({
      kind: 'vault-ready',
      verse: null,
      count: readyVerses.length,
      deadline: null,
      remainingMs: null,
      amount: null,
      amountUsd: readyVerses.some((row) => row.readyUsd == null)
        ? null
        : readyVerses.reduce((sum, row) => sum + (row.readyUsd ?? 0), 0),
      focusVerseId: null,
      bridgeMessageId: null,
    });
  }

  // Genesis refund (once per address; no deadline -- refund-stage is claimable anytime)
  const refundRows = [...new Set(getFixtureParticipations().map((p) => p.verseId))]
    .map((verseId) => {
      const verse = snapshot.verses.find((candidate) => candidate.id === verseId);
      const rows = getFixtureParticipations().filter((p) => p.verseId === verseId);
      return verse && verse.stage === 'refund'
        ? {
            verse: {
              id: verse.id,
              symbol: verse.symbol,
              name: verse.name,
              raiseAsset: verse.raiseAsset,
            },
            total: rows.reduce((sum, row) => sum + row.amount, 0),
          }
        : null;
    })
    .filter(
      (
        row,
      ): row is {
        verse: { id: string; symbol: string; name: string; raiseAsset: string };
        total: number;
      } => row !== null,
    );
  for (const row of refundRows) {
    actions.push({
      kind: 'refund',
      verse: row.verse,
      count: null,
      deadline: null,
      remainingMs: null,
      amount: row.total,
      amountUsd: null,
      focusVerseId: null,
      bridgeMessageId: null,
    });
  }

  // Sort: items with deadlines ascending by remaining time (most urgent on top); no-deadline items trail by kind order
  return actions.sort((a, b) => {
    if (a.remainingMs != null && b.remainingMs != null) return a.remainingMs - b.remainingMs;
    if (a.remainingMs != null) return -1;
    if (b.remainingMs != null) return 1;
    return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  });
}

/** Section (4) participation voucher rows: genesis-stage=participation records (future vouchers); locked/unlocked=POL/PT/YT/LP holdings */
export type FixtureParticipationRow = {
  verse: {
    id: string;
    symbol: string;
    name: string;
    stage: VerseStage;
    raiseAsset: string;
    endsAt: string;
    /** Genesis deadline + 365d fixed lockup (contract constant) = expected unlock date for locked rows */
    unlockAt: string;
    unlockedAt: string | null;
  };
  /** Genesis-stage participation total (split by kind) + staking participation route flag */
  genesis: {
    total: number;
    normal: number;
    leverage: number;
    preorder: number;
    /** true when any normal participation used the stake route -> shows the "Stake participation" badge + section (3) position cross-link */
    stakeRoute: boolean;
  } | null;
  /** POL/PT/YT/LP holdings (locked/unlocked); null=genesis stage has no vouchers */
  holdings: {
    pol: number;
    pt: number;
    yt: number;
    /** Claimable YT (one-time pro rata by contribution once Stage≥Locked) */
    claimableYt: number;
  } | null;
};

export function getFixtureParticipationRows(): FixtureParticipationRow[] {
  const snapshot = getSnapshot();
  const participations = getFixtureParticipations();
  const rows: FixtureParticipationRow[] = [];

  for (const verse of snapshot.verses) {
    const mine = participations.filter((p) => p.verseId === verse.id);
    const pol = getFixturePolPosition(verse.id);
    const head = {
      id: verse.id,
      symbol: verse.symbol,
      name: verse.name,
      stage: verse.stage,
      raiseAsset: verse.raiseAsset,
      endsAt: verse.endsAt,
      unlockAt: verse.unlockTimeAt,
      unlockedAt: verse.unlockedAt,
    };
    if (verse.stage === 'genesis' && mine.length > 0) {
      rows.push({
        verse: head,
        genesis: {
          total: mine.reduce((sum, row) => sum + row.amount, 0),
          normal: mine
            .filter((row) => row.kind === 'normal')
            .reduce((sum, row) => sum + row.amount, 0),
          leverage: mine
            .filter((row) => row.kind === 'leverage')
            .reduce((sum, row) => sum + row.amount, 0),
          preorder: mine
            .filter((row) => row.kind === 'preorder')
            .reduce((sum, row) => sum + row.amount, 0),
          stakeRoute: mine.some((row) => row.kind === 'normal' && row.route === 'stake'),
        },
        holdings: null,
      });
    } else if ((verse.stage === 'locked' || verse.stage === 'unlocked') && pol) {
      rows.push({
        verse: head,
        genesis: null,
        holdings: {
          pol: pol.myPol,
          pt: pol.myPt,
          yt: pol.myYt,
          claimableYt: pol.claimableYt,
        },
      });
    }
  }

  // Group order = lifecycle direction (genesis -> locked -> unlocked; refund handled by section (1) to-dos)
  const stageOrder: Record<VerseStage, number> = { genesis: 0, locked: 1, unlocked: 2, refund: 3 };
  return rows.sort(
    (a, b) =>
      stageOrder[a.verse.stage] - stageOrder[b.verse.stage] || a.verse.id.localeCompare(b.verse.id),
  );
}

/** Shared by section (1) to-dos / status rows: page-level signal counts (to-dos / claimable) */
export function getFixturePortfolioSignals() {
  const actions = getFixturePortfolioActions();
  const claimableVerses = getFixtureParticipationRows().filter(
    (row) => (row.holdings?.claimableYt ?? 0) > 0,
  ).length;
  return {
    actionCount: actions.length,
    claimableVerses,
  };
}

/** /referral (four page blocks): Memeverse swap rebate sample view.
 *  Mechanism: the rebate is carved out of the protocol's 35% share
 *  (default rate=1000bps i.e. 10% of total fees, owner-adjustable 0-3500), in-kind per-token
 *  pending/claim (no batching), single-level with unbound self-referral legal, independent per chain
 *  (pending rows=chain × token).
 *  Friends detail and the referralCode short code are samples (on-chain events exclude the
 *  referee, no code registry); ≈$ conversion reuses the assets usdSample sample prices. */
export type FixtureReferralAssetAmount = {
  assetId: string;
  symbol: string;
  chainId: number;
  chainName: string;
  amount: number;
  /** Sample-price conversion; no sample price=null (the ≈$ row is not rendered) */
  usd: number | null;
};

export type FixtureReferralTransaction = {
  txId: string;
  friendAddress: string;
  chainId: number;
  chainName: string;
  rebate: { symbol: string; amount: number; usd: number | null };
  at: string;
};

export type FixtureReferralFriend = {
  address: string;
  joinedAt: string;
  volumeUsd: number;
  earnedUsd: number;
};

export type FixtureReferral = {
  /** Link owner=sample account (owner is not in referral.json, derived from accounts to prevent drift between the two) */
  owner: string;
  referralCode: string;
  /** Rebate rate (percentage of total fees; production reads hook referrerRebateBps()) */
  ratePercent: number;
  /** Cumulative earned USD (sum of earned × usdSample; rows without a sample price count as 0) */
  totalEarnedUsd: number;
  /** Claimable USD (same convention) */
  pendingUsd: number;
  friendsCount: number;
  earned: FixtureReferralAssetAmount[];
  pending: FixtureReferralAssetAmount[];
  transactions: FixtureReferralTransaction[];
  friends: FixtureReferralFriend[];
};

export function getFixtureReferral(): FixtureReferral | null {
  const record = fixtureData.referral.items[0];
  if (!record) return null;
  const chainMeta = new Map(fixtureData.chains.items.map((chain) => [chain.chainId, chain]));
  const assetMeta = new Map(fixtureData.assets.items.map((asset) => [asset.id, asset]));
  const viewAmount = (row: (typeof record.earned)[number]): FixtureReferralAssetAmount => {
    const asset = assetMeta.get(row.assetId);
    const value = amount(row.amount.raw);
    return {
      assetId: row.assetId,
      symbol: asset?.symbol ?? row.assetId,
      chainId: row.chainId,
      chainName: chainMeta.get(row.chainId)?.name ?? String(row.chainId),
      amount: value,
      usd: asset?.usdSample != null ? value * asset.usdSample : null,
    };
  };
  const earned = record.earned.map(viewAmount);
  const pending = record.pending.map(viewAmount);
  const sumUsd = (rows: FixtureReferralAssetAmount[]) =>
    rows.reduce((sum, row) => sum + (row.usd ?? 0), 0);
  return {
    owner: getSnapshot().sampleAccount.address,
    referralCode: record.referralCode,
    ratePercent: Number(record.rate.raw) / 100,
    totalEarnedUsd: sumUsd(earned),
    pendingUsd: sumUsd(pending),
    friendsCount: record.friendsCount,
    earned,
    pending,
    transactions: record.transactions.map((tx) => ({
      txId: tx.txId.value,
      friendAddress: tx.friend.value,
      chainId: tx.chainId,
      chainName: chainMeta.get(tx.chainId)?.name ?? String(tx.chainId),
      rebate: {
        symbol: assetMeta.get(tx.rebate.assetId)?.symbol ?? tx.rebate.assetId,
        amount: amount(tx.rebate.amount.raw),
        usd: (() => {
          const asset = assetMeta.get(tx.rebate.assetId);
          const value = amount(tx.rebate.amount.raw);
          return asset?.usdSample != null ? value * asset.usdSample : null;
        })(),
      },
      at: tx.at,
    })),
    friends: record.friends.map((friend) => ({
      address: friend.address.value,
      joinedAt: friend.joinedAt,
      volumeUsd: friend.volumeUsd,
      earnedUsd: friend.earnedUsd,
    })),
  };
}

// ---------------------------------------------------------------------------
// /faucet (testnet faucet + PSM face-value conversion to UUSD; UUSD's only acquisition path=PSM,
// yield-bearing assets stakeForGenesis directly without passing through UUSD)
// ---------------------------------------------------------------------------

export type FixtureFaucetToken = {
  symbol: string;
  name: string;
  /** Daily claim allowance (contract dailyLimit, one-time full mint) */
  dailyLimit: number;
  /** Cooldown remaining milliseconds sample (0=claimable; >0=ClaimTooSoon error domain) */
  cooldownRemainingMs: number;
};

export type FixtureFaucet = {
  chainId: number;
  chainName: string;
  tokens: FixtureFaucetToken[];
  swap: {
    uAssetSymbol: string;
    reserveSymbol: string;
    /** mint fee rate (ratio, 10bps->0.001) */
    feeIn: number;
    /** redeem fee rate (ratio) */
    feeOut: number;
    /** Mint allowance headroom (stockCap−netMinted sample); null=slot */
    headroom: number | null;
    /** Sample account's UUSD balance (Max source for the Back to USDC direction) */
    myUAsset: number;
    /** Sample account's reserve balance (Max source for the Get UUSD direction) */
    myReserve: number;
  };
};

export function getFixtureFaucet(): FixtureFaucet | null {
  const record = fixtureData.faucet.items[0];
  if (!record) return null;
  const chain = fixtureData.chains.items.find((item) => item.chainId === record.chainId);
  return {
    chainId: record.chainId,
    chainName: chain?.name ?? String(record.chainId),
    tokens: record.tokens.map((token) => ({
      symbol: token.symbol,
      name: token.name,
      dailyLimit: amount(token.dailyLimit.raw),
      cooldownRemainingMs: token.cooldownRemainingMs,
    })),
    swap: {
      uAssetSymbol: record.swap.uAssetSymbol,
      reserveSymbol: record.swap.reserveSymbol,
      feeIn: Number(record.swap.feeIn.raw) / 1e4,
      feeOut: Number(record.swap.feeOut.raw) / 1e4,
      headroom: record.swap.headroom ? amount(record.swap.headroom.raw) : null,
      myUAsset: amount(record.swap.myUAsset.raw),
      myReserve: amount(record.swap.myReserve.raw),
    },
  };
}

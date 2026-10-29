// Onchain data adapter — the OUTRUN_DATA_SOURCE=onchain build-time alias target of
// '@/lib/data/fixture-repository' (next.config.ts resolveAlias; fixture-boundary-contract
// OUTRUN_DATA_SOURCE section). It references the fixture repository TYPE-ONLY — never runtime
// values — so the shared ViewModel shapes stay single-sourced while the onchain build statically
// swaps every runtime getter to real RPC/Graph data. Two-build rule: the fixture build resolves the real
// fixture repository and renders the stage-3 baseline byte-identically.
//
// Degrade discipline: fields without an on-chain source render nothing (null/empty), never
// fixture samples and never zero-addresses; sections with zero rows collapse by their existing
// contracts (e.g. pending-referral area unmounts on zero rows). The faucet cooldown slot is null
// for want of an on-chain source (claimable set comes from claim() probes).
import type {
  Asset,
  CreateConfig,
  Faucet,
  GovernanceState,
  Participation,
  ParticipationOptions,
  ParticipationRow,
  PolPosition,
  PortfolioAction,
  PsmPair,
  Referral,
  Staking,
  UsrSavings,
  VaultRow,
  Verse,
  VerseChainAggregates,
  VerseTrade,
  WalletAsset,
  YieldSource,
} from '@/lib/data/fixture-repository';
import type { DataResult } from '@/lib/data/repository';
import { getOnchainRepository } from '@/lib/data/repository';
import { getGraphRepository } from '@/lib/data/graph/graph-repository';
import type { VerseSummaryView } from '@/lib/data/graph/graph-repository';
import { readSeed, writeSeed, deleteSeed, deleteSeedsMatching } from '@/lib/data/persisted-swr';
import { CHAIN_IDS, MAINNET_CHAIN_IDS, resolveOutrunChain } from '@/lib/web3/chains';
import { getPublicClient } from '@/lib/web3/public-client';
import { readNativeUsdPrice } from '@/lib/web3/native-price';
import { hookPoolKey, lpPerQuoteUnit, poolIdOf, priceQuotePerBase } from '@/lib/web3/pool-quote';
import { cache } from 'react';
import type { Hex } from 'viem';
import type { ChainInfo } from '@/lib/data/types';

// 24h liquidity protection window — single source in lib/data/types (client-safe)
export { PROTECTION_WINDOW_MS } from '@/lib/data/types';

const rpc = () => getOnchainRepository();
const graph = () => getGraphRepository();
const TESTNETS = (CHAIN_IDS as readonly number[]).filter(
  (id) => !(MAINNET_CHAIN_IDS as readonly number[]).includes(id),
);
const REGISTRATION_HUB = 97;
const E18 = 1e18;
/** Date's representable range is ±8.64e15 ms. A graph row outside it is dirty data and
 *  toISOString() would throw out of the row projection (one bad row killing the whole
 *  getter) — out of range reads as a null slot instead. */
const ISO_MAX_SECONDS = 8_640_000_000_000n;
const iso = (seconds: bigint): string | null =>
  seconds > ISO_MAX_SECONDS || seconds < -ISO_MAX_SECONDS
    ? null
    : new Date(Number(seconds) * 1000).toISOString();

function unwrap<T>(r: DataResult<T>): T | null {
  return r.status === 'ok' ? r.data : null;
}

// --- connected account ---------------------------------------------------------------------
// The client writes this cookie on wallet connect/disconnect (use-account-center) and calls
// router.refresh(); account-scoped reads below follow it. Fixture mode's demo-account data
// becomes real-wallet data — never samples, and never persisted (no disk seed on these paths).

const ACCOUNT_COOKIE = 'outrun_account';

async function connectedAccount(): Promise<string | null> {
  try {
    const { cookies } = await import('next/headers');
    const value = (await cookies()).get(ACCOUNT_COOKIE)?.value;
    return value && /^0x[0-9a-fA-F]{40}$/.test(value) ? value : null;
  } catch {
    // non-request scope (tests, build workers) — accountless
    return null;
  }
}

// Accountless config reads (faucet limits/fees, registration preview, verse financials
// overlay) are chain-config-like: low churn, no per-user data — last value serves instantly,
// refresh runs in background (§9). Mid-tier TTL (30s): fresher than the graph list tier
// (60s) since detail pages show capacity/rate numbers. A null/failed read is never cached as
// fresh; the next request retries while callers keep seeing the last good value.
const CONFIG_TTL_MS = 30_000;
type ConfigEntry = { at: number; value: unknown; inflight: Promise<unknown> | null };
const configCache = new Map<string, ConfigEntry>();

/** Post-write invalidation: drop every verse-scoped config-cache group for one verse across
 *  every chain — `verse-fin|trade|split|gov|vault-<chain>-<id>` (runtime overlay, trade-desk
 *  composition, splitter info, governance snapshot, vault state) plus the omnichain supply
 *  sum — in memory and on the seed disk. Paired with the graph-tier `invalidateVerse` —
 *  together they force the next detail render onto fresh blocking reads. */
export function invalidateVerseConfig(verseId: string): void {
  // The id arrives in whatever surface spelling the write flow carried (hand-typed URLs can
  // be zero-padded or verse-prefixed); the keys hold loadVerse's canonical decimal, so fold
  // the input to the same form before matching or every group silently misses
  const match = /^(?:verse-)?(\d+)$/i.exec(verseId);
  if (!match) return;
  const id = match[1].replace(/^0+(?=\d)/, '');
  // All five per-verse cachedConfig groups rerun after a confirmed verse write: swaps/LP
  // move the trade composition, stakes move vault totals, POL moves the split legs
  dropConfigKeys(
    (key) => /^verse-(fin|trade|split|gov|vault)-\d+-/.test(key) && key.endsWith(`-${id}`),
  );
  dropConfigKeys((key) => key === `verse-meme-supply-${id}`);
}

// Seed namespace carries a schema version: v1 files hold the old encoding where a failed
// supply/reserve read was persisted as 0n legs; v2 reads 0n as an honestly empty pool, so v1
// seeds are deliberately orphaned (one background cold fetch per key) instead of being re-read
// under the new semantics. Read/write/invalidate must switch together.
export const CONFIG_SEED_NS = 'adapter-config-v2';

function dropConfigKeys(matches: (key: string) => boolean): void {
  for (const key of configCache.keys()) {
    if (!matches(key)) continue;
    configCache.delete(key);
    deleteSeed(CONFIG_SEED_NS, key);
  }
  // Seeds survive restarts, so the seed file holds matching keys this process's Map never
  // materialized (nothing read here since the last boot). Run the same predicate over the
  // disk keyspace directly — Map-borrowed deletion would leave those seeds in place and a
  // later cold start would serve the pre-write value.
  deleteSeedsMatching(CONFIG_SEED_NS, matches);
}

function cachedConfig<T>(key: string, run: () => Promise<T | null>): Promise<T | null> {
  let created = configCache.get(key);
  if (created === undefined) {
    created = { at: 0, value: undefined, inflight: null };
    // cold process (fresh boot or restart): seed the last ok value from disk (null seeds are skipped —
    // a degraded read must not stick across restarts)
    const seed = readSeed<T | null>(CONFIG_SEED_NS, key);
    if (seed?.value != null) created.value = seed.value;
    configCache.set(key, created);
  }
  const entry = created;
  const fresh = entry.at !== 0 && Date.now() - entry.at < CONFIG_TTL_MS;
  if (!fresh && entry.inflight === null) {
    entry.inflight = run().then(
      (value) => {
        // A post-write invalidation detaches this entry (Map delete + deleteSeed); a detached
        // settle must not re-publish pre-write data into the disk seed.
        if (configCache.get(key) !== entry) return value;
        entry.inflight = null;
        entry.value = value;
        entry.at = value == null ? 0 : Date.now();
        if (value != null) writeSeed(CONFIG_SEED_NS, key, entry.at, value);
        return value;
      },
      () => {
        // config-read failures degrade to null (§9) and expire immediately for a retry
        entry.inflight = null;
        entry.at = 0;
        return null;
      },
    );
  }
  if (entry.value !== undefined) return Promise.resolve(entry.value as T | null);
  return entry.inflight as Promise<T | null>;
}

/** uAsset address -> symbol via the deployment contract tables (UAsset.<SYM> keys). Unknown
 *  addresses resolve to null — never to a known symbol: a known-symbol sentinel would ride
 *  that symbol's real price sample (getAssetUsdPrice) and fabricate USD values downstream.
 *  null degrades every raise-asset slot instead (caps/labels hide, lookups fail closed). */
function uAssetSymbol(address: string): string | null {
  for (const chainId of TESTNETS) {
    const resolved = resolveOutrunChain(chainId);
    if (resolved.status !== 'ok' || resolved.config.contracts.status !== 'deployed') continue;
    for (const [key, addr] of Object.entries(resolved.config.contracts.addresses)) {
      if (key.startsWith('UAsset.') && addr.toLowerCase() === address.toLowerCase()) {
        return key.slice('UAsset.'.length);
      }
    }
  }
  return null;
}

function deployedContracts(chainId: number): Record<string, string> {
  const resolved = resolveOutrunChain(chainId);
  return resolved.status === 'ok' && resolved.config.contracts.status === 'deployed'
    ? resolved.config.contracts.addresses
    : {};
}

/** Raise-asset whitelist from the deployment tables (UAsset.<SYM> per chain, deduped) — the
 * create page's fund-type dropdown and submit gate (assets.length===0) stay alive onchain */
function deployedAssets(): Asset[] {
  const bySymbol = new Map<string, Asset>();
  for (const chainId of TESTNETS) {
    for (const [key, addr] of Object.entries(deployedContracts(chainId))) {
      if (!key.startsWith('UAsset.')) continue;
      const symbol = key.slice('UAsset.'.length);
      if (!bySymbol.has(symbol)) {
        bySymbol.set(symbol, { id: addr, symbol, sourceRef: `deployments/${chainId}.json#${key}` });
      }
    }
  }
  return [...bySymbol.values()];
}

function chainNameOf(chainId: number): string {
  const resolved = resolveOutrunChain(chainId);
  return (
    (resolved.status === 'ok' ? resolved.config.viemChain.name : null) ?? 'BNB Smart Chain Testnet'
  );
}

/** Market cap in USD, stage-aware: genesis = cross-chain raised × 2 (POL match doubles
 *  the primary pool's uAsset side) × uAsset USD sample; deployed stages (locked/unlocked)
 *  carry no price/supply in the subgraph summary views — the trade-desk MC (price ×
 *  supply) is the real number there — and refund never deployed a memecoin, so both
 *  return null (cap slots do not render). The price read is cached per symbol, so
 *  per-row calls in the row builders are cheap. */
async function verseMarketCapUsd(
  stage: string,
  raiseAsset: string | null,
  omniRaised: number | null,
): Promise<number | null> {
  if (stage !== 'genesis' || raiseAsset == null || omniRaised == null) return null;
  const usd = await getAssetUsdPrice(raiseAsset);
  return usd != null ? omniRaised * 2 * usd : null;
}

/** Build one chain-scoped row from a single chain's subgraph view. Raised/progress/participants
 * are that chain's own local genesis state — each chain settles its own genesis independently,
 * so these are never summed across chains. */
function toVerse(view: VerseSummaryView): Verse {
  const raiseAsset = uAssetSymbol(view.uAsset);
  const normalRaised = Number(view.raised.genesis) / E18;
  const leverageInterest = Number(view.raised.leveraged) / E18;
  const preorderRaised = Number(view.raised.preorder) / E18;
  // Governance chain = first registered omnichain id (registration truth); the display name
  // rides the chain table, fallback keeps the registration hub label
  const omnichainIds = view.omnichainIds.map(Number);
  const governanceChain = omnichainIds[0] ?? REGISTRATION_HUB;
  const participationSize = normalRaised + leverageInterest + preorderRaised;
  return {
    id: String(view.verseId),
    sourceRef: `subgraph:${view.chainId}`,
    scenario: [],
    name: view.name,
    symbol: view.symbol,
    stage: view.stage,
    governanceChain,
    governanceChainName: chainNameOf(governanceChain),
    // This row views view.chainId's own local state (see the function comment)
    chainId: view.chainId,
    chainName: chainNameOf(view.chainId),
    omnichainIds,
    // Filled by the callers that know the cross-chain group (chain rows / paged sidecar)
    deployedChainIds: null,
    createdAt: iso(view.registeredAt),
    participantCount: view.participantCount,
    description: null,
    socials: [],
    // Filled by the callers that know the cross-chain group (derived: raised × 2 × USD sample)
    marketCapUsd: null,
    raiseAsset,
    minSuccessThreshold: 0,
    normalRaised,
    leverageInterest,
    preorderRaised,
    participationSize,
    // Filled by the chain-rows builder below (cross-chain totals of the same verse)
    omniRaised: participationSize,
    omniParticipantCount: view.participantCount,
    normalProgress: 0,
    leverageProgress: 0,
    preorderProgress: 0,
    endsAt: iso(view.endTime),
    preorderCapacityRatio: null,
    leverageInterestRate: null,
    leverageDebtCap: null,
    leverageInterestRateWad: null,
    preorderCapRatioBps: null,
    preorderRemainingBase: null,
    fastGenesis: view.flashGenesis,
    unlockTimeAt: iso(view.unlockTime),
    volume24h: null,
    stakingApy: null,
    treasuryFundUsd: null,
    unlockedAt: null,
    currentPrice: null,
    change24h: null,
    memecoinAddress: view.memecoin,
    markets: [],
  };
}

/** List-path threshold overlay: the subgraph carries raised sums but no min-success threshold
 * (fundMetaDatas is per-uAsset RPC). Group views by chain+uAsset, fetch one threshold per
 * distinct asset (cached per chain+asset, degraded to null on any failure), then fill each
 * row's threshold + progress with the fixture semantics (raised / threshold * 100, unclamped).
 * Detail pages keep their full per-verse financial overlay; this is the list-card equivalent so
 * cards with real raised funds never sit at 0%. */
async function thresholdByAsset(views: VerseSummaryView[]): Promise<Map<string, number>> {
  const representative = new Map<string, { chainId: number; uAsset: string; verseId: bigint }>();
  for (const view of views) {
    const key = `${view.chainId}:${view.uAsset.toLowerCase()}`;
    if (!representative.has(key)) {
      representative.set(key, {
        chainId: view.chainId,
        uAsset: view.uAsset,
        verseId: view.verseId,
      });
    }
  }
  const entries = await Promise.all(
    [...representative.entries()].map(async ([key, rep]) =>
      cachedConfig<number>(`threshold-${rep.chainId}-${rep.uAsset.toLowerCase()}`, async () => {
        const r = unwrap(await rpc().getVerseFinancials(rep.chainId, rep.verseId, rep.uAsset));
        if (!r) return null;
        const threshold = Number(r.minTotalFund) / E18;
        return Number.isFinite(threshold) && threshold > 0 ? threshold : null;
      }).then((threshold) => ({ key, threshold })),
    ),
  );
  const out = new Map<string, number>();
  for (const { key, threshold } of entries) {
    if (threshold != null) out.set(key, threshold);
  }
  return out;
}

function withListProgress(row: Verse, threshold: number | undefined): Verse {
  if (threshold == null) return row;
  const pct = (raised: number) => (raised / threshold) * 100;
  return {
    ...row,
    minSuccessThreshold: threshold,
    normalProgress: pct(row.normalRaised),
    leverageProgress: pct(row.leverageInterest),
    preorderProgress: pct(row.preorderRaised),
  };
}

// --- shared snapshot (home + explore + every page shell) -------------------------------

// Graph views behind the last snapshot build, keyed by verse id — the detail getter needs the
// raw view (chainId/uAsset/verseId) to run the RPC financial overlay below
let snapshotViews = new Map<string, VerseSummaryView>();

// Per-verse landed memecoin OFT addresses, filled by getVerse's fan-out — the omnichain
// supply sum reads each landed chain's own token contract (same-lifecycle map as snapshotViews)
const landedMemecoins = new Map<string, Array<{ chainId: number; memecoin: Hex }>>();

/** Global supply is all-or-nothing: one unread leg collapses the total to null. A partial sum
 *  would under-report circulation with no downstream signal that a leg went missing. */
export function sumCompleteSupplies(rows: ReadonlyArray<bigint | null>): bigint | null {
  if (rows.length === 0) return null;
  if (!rows.every((row): row is bigint => row != null)) return null;
  return rows.reduce((sum, row) => sum + row, 0n);
}

/** Omnichain memecoin supply: the OFT burns on the source chain and mints on the
 *  destination, so each chain's totalSupply() is that chain's local circulation — the
 *  global total is the sum over the landed set. Any leg unread → null (never a partial
 *  sum); cached per verse, invalidated with the verse config tier. */
async function omniMemecoinSupply(
  verseId: string,
  legs: ReadonlyArray<{ chainId: number; memecoin: Hex }>,
): Promise<bigint | null> {
  if (legs.length === 0) return null;
  return cachedConfig(`verse-meme-supply-${verseId}`, async () => {
    const rows = await Promise.all(
      legs.map((leg) => rpc().getTokenTotalSupply(leg.chainId, leg.memecoin).then(unwrap)),
    );
    return sumCompleteSupplies(rows);
  });
}

/** Canonical view of one verse: the governance chain's (omnichainIds[0]) copy carries the
 * registration truth (stage/endtime/omnichain ids). Falls back to the first copy when the
 * governance chain's subgraph has no record of the verse. */
function canonicalViewOf(group: VerseSummaryView[]): VerseSummaryView {
  const governanceChain = Number(group[0]!.omnichainIds[0] ?? REGISTRATION_HUB);
  return group.find((view) => view.chainId === governanceChain) ?? group[0]!;
}

export type ChainVersePage = {
  rows: Verse[];
  /** verses on the selected chain (page-scoped count for the pager) */
  total: number;
  hasMore: boolean;
  /** all indexed chain ids (filter options; derived from the same fetch, never a second pull) */
  chainIds: number[];
};

/** Single-build loader: one fan-out builds the chain rows, the canonical snapshot rows, the
 * chain option set, and the raw views for the detail overlay — every page getter below reads
 * from one build, never a second subgraph pull. */
async function buildChainRows(): Promise<{
  rows: Verse[];
  canonical: Verse[];
  chainIds: number[];
  views: Map<string, VerseSummaryView>;
}> {
  // three per-chain subgraph round trips are independent — fan out instead of serializing
  const results = await Promise.all(TESTNETS.map((chainId) => graph().getVerseSummaries(chainId)));
  // A failed chain read is not "this chain has no verse" — the cross-chain totals below are
  // unknown unless every chain answered.
  const allChainsRead = results.every((result) => result.status === 'ok');
  const byVerseId = new Map<string, VerseSummaryView[]>();
  for (const result of results) {
    const list = unwrap(result);
    if (list) {
      for (const view of list) {
        const group = byVerseId.get(String(view.verseId));
        if (group) group.push(view);
        else byVerseId.set(String(view.verseId), [view]);
      }
    }
  }
  const rows: Verse[] = [];
  const canonical: Verse[] = [];
  const views = new Map<string, VerseSummaryView>();
  // List rows need the same raised/threshold progress as detail rows (fundMetaDatas is
  // per-uAsset RPC, not a subgraph field): resolve one threshold per distinct chain+uAsset
  // across every view so cards with raised funds never render 0%.
  const flatViews = [...byVerseId.values()].flat();
  const thresholds = await thresholdByAsset(flatViews);
  // Per-verse price reads are independent and deduped per symbol by the cached feed — fan out
  // like the per-chain reads above so the per-symbol feed round trips overlap.
  const buildVerseRows = async ([id, group]: [string, VerseSummaryView[]]) => {
    const canonicalView = canonicalViewOf(group);
    const omniRaised = allChainsRead
      ? group.reduce(
          (sum, view) =>
            sum + Number(view.raised.genesis + view.raised.leveraged + view.raised.preorder) / E18,
          0,
        )
      : null;
    const omniParticipantCount = allChainsRead
      ? group.reduce((sum, view) => sum + view.participantCount, 0)
      : null;
    // The group is exactly the set of chains whose subgraph holds this verse — the landed set.
    // The requested omnichainIds can name chains that never received the registration message.
    const deployedChainIds = group.map((view) => view.chainId);
    const marketCapUsd = await verseMarketCapUsd(
      canonicalView.stage,
      uAssetSymbol(canonicalView.uAsset),
      omniRaised,
    );
    const groupRows: Verse[] = [];
    let canonicalRow: Verse | null = null;
    for (const view of group) {
      const row = withListProgress(
        { ...toVerse(view), omniRaised, omniParticipantCount, deployedChainIds, marketCapUsd },
        thresholds.get(`${view.chainId}:${view.uAsset.toLowerCase()}`),
      );
      groupRows.push(row);
      if (view === canonicalView) canonicalRow = row;
    }
    const fallbackRow = toVerse(canonicalView);
    const canonicalVerse = canonicalRow ?? {
      ...fallbackRow,
      omniRaised,
      deployedChainIds,
      marketCapUsd: await verseMarketCapUsd(fallbackRow.stage, fallbackRow.raiseAsset, omniRaised),
    };
    return { id, canonicalView, groupRows, canonicalVerse };
  };
  const built = await Promise.all([...byVerseId].map(buildVerseRows));
  // Promise.all preserves input order, so rows keep the byVerseId order.
  for (const { id, canonicalView, groupRows, canonicalVerse } of built) {
    views.set(id, canonicalView);
    rows.push(...groupRows);
    canonical.push(canonicalVerse);
  }
  snapshotViews = views;
  return {
    rows,
    canonical,
    chainIds: [...new Set(rows.map((row) => row.chainId))].sort((a, b) => a - b),
    views,
  };
}

export async function getSnapshot() {
  const { canonical } = await buildChainRows();
  // The snapshot keeps one row per verse (governance-chain canonical) so every existing
  // consumer — home metrics, detail page, portfolio lookups — is untouched; the discovery
  // browser reads the full chain-scoped rows via getChainVerses directly
  const verses = canonical;
  const deployedVerseCount = verses.filter(
    (v) => v.stage === 'locked' || v.stage === 'unlocked',
  ).length;
  return {
    timeAnchor: new Date().toISOString(),
    verses,
    assets: deployedAssets(),
    homeMetrics: {
      totalLocked: verses.reduce((sum, v) => sum + v.participationSize, 0),
      verseCount: verses.length,
      deployedVerseCount,
      participantCount: verses.reduce((sum, v) => sum + v.participantCount, 0),
      sourceRefs: ['subgraph:testnets'],
    },
    displayAccount: { address: '', sourceRef: 'onchain:wallet' },
  };
}

/** Chain-scoped verse rows: one row per (verse, registered chain), each row carrying that
 * chain's own local genesis state. The discovery browser filters rows by the selected chain —
 * no 'all chains' merged view exists because each chain settles its own genesis independently.
 * A chain whose subgraph failed simply contributes no rows. */
export async function getChainVerses(): Promise<Verse[]> {
  return (await buildChainRows()).rows;
}

/** Chain ids that have at least one indexed verse — the discovery chain filter's option set */
export async function getVerseChainIds(): Promise<number[]> {
  return (await buildChainRows()).chainIds;
}

/** One discovery page on one chain: the paged subgraph read keeps server memory and the RSC
 * payload bounded at any verse volume; the omni sidecar sums only the page's verses. */
export async function getChainVersePage(
  chainId: number,
  filter: {
    stage?: 'genesis' | 'refund' | 'locked' | 'unlocked';
    fastGenesis?: boolean;
    query?: string;
  },
  first: number,
  skip: number,
): Promise<ChainVersePage> {
  // Chain-0 probe (option-set discovery before chain resolution): static config, zero reads
  if (chainId === 0) return { rows: [], total: 0, hasMore: false, chainIds: [...TESTNETS] };
  const page = await graph().getVersePage(chainId, filter, first, skip);
  const list = unwrap(page);
  // A failed chain subgraph degrades to an empty page (never fixture samples, never a throw);
  // the chain option set comes from the caller's own chainIds read (no second pull here)
  if (!list) {
    return { rows: [], total: 0, hasMore: false, chainIds: [] };
  }
  const verseIds = list.verses.map((view) => view.verseId);
  // Omni sidecar: the page verses' sums and landed presence on every sibling chain (bounded:
  // one verseId_in query per sibling, only for the page's ids)
  const siblings = await Promise.all(
    TESTNETS.filter((id) => id !== chainId).map(async (sibling) => ({
      chainId: sibling,
      sidecar: unwrap(await graph().getRaisedSums(sibling, verseIds)),
    })),
  );
  const thresholds = await thresholdByAsset(list.verses);
  const rows = await Promise.all(
    list.verses.map(async (view) => {
      const own = Number(view.raised.genesis + view.raised.leveraged + view.raised.preorder) / E18;
      // A null sidecar is a failed sibling read, not an absent verse (an absent verse answers ok
      // with no sum) — the all-chain total is unknown, never a partial sum.
      const omniRaised = siblings.some(({ sidecar }) => sidecar == null)
        ? null
        : own +
          siblings.reduce((sum, { sidecar }) => {
            const raised = sidecar?.sums.get(String(view.verseId));
            return (
              sum + (raised ? Number(raised.genesis + raised.leveraged + raised.preorder) / E18 : 0)
            );
          }, 0);
      // Landed set = this chain plus every sibling whose subgraph returned a Verse row for the id.
      const deployedChainIds = TESTNETS.filter(
        (id) =>
          id === chainId ||
          siblings.some(
            (sibling) =>
              sibling.chainId === id && sibling.sidecar?.present.has(String(view.verseId)) === true,
          ),
      );
      return withListProgress(
        {
          ...toVerse(view),
          omniRaised,
          omniParticipantCount: view.participantCount,
          deployedChainIds,
          marketCapUsd: await verseMarketCapUsd(view.stage, uAssetSymbol(view.uAsset), omniRaised),
        },
        thresholds.get(`${view.chainId}:${view.uAsset.toLowerCase()}`),
      );
    }),
  );
  // TESTNETS membership is static config: the option set is the deployed testnets, not a second
  // subgraph pull. A verse-less chain still offers its filter (empty page, not a missing option).
  return {
    rows,
    total: skip + rows.length + (list.hasMore ? 1 : 0),
    hasMore: list.hasMore,
    chainIds: [...TESTNETS],
  };
}

async function loadVerse(verseId: string): Promise<Verse | null> {
  const match = /^(?:verse-)?(\d+)$/i.exec(verseId);
  if (!match) return null;
  // uint256 ids exceed Number precision — compare normalized decimal strings
  const digits = match[1].replace(/^0+(?=\d)/, '');
  const id = BigInt(digits);
  // Point reads: the same id on every indexed chain, one query each (never the full list).
  // The governance-chain (omnichainIds[0]) copy supplies the canonical metadata; when that
  // chain's subgraph has no record, the first landed copy stands in.
  const details = await Promise.all(
    TESTNETS.map(async (chainId) => ({
      chainId,
      result: await graph().getVerseDetail(chainId, id),
    })),
  );
  // Absence is ok(null); a non-ok status is a failed read. The latter leaves the landed set
  // and the omni totals unknown — never a silently shorter sum.
  const allChainsRead = details.every((entry) => entry.result.status === 'ok');
  const found = details
    .map((entry) => ({ chainId: entry.chainId, view: unwrap(entry.result) }))
    .filter((entry): entry is { chainId: number; view: VerseSummaryView } => entry.view != null);
  if (found.length === 0) return null;
  const governanceChain = Number(found[0]!.view.omnichainIds[0] ?? REGISTRATION_HUB);
  const canonical = found.find((entry) => entry.chainId === governanceChain) ?? found[0]!;
  const view = canonical.view;
  // Omni sidecar for the detail facts row (the same id on the sibling chains)
  const siblings = await Promise.all(
    found
      .filter((entry) => entry.chainId !== canonical.chainId)
      .map(async (entry) => entry.view.raised),
  );
  const own = Number(view.raised.genesis + view.raised.leveraged + view.raised.preorder) / E18;
  const omniRaised = allChainsRead
    ? own +
      siblings.reduce(
        (sum, raised) => sum + Number(raised.genesis + raised.leveraged + raised.preorder) / E18,
        0,
      )
    : null;
  // Per-chain rows power the wallet-chain-following displays (meters, panel aggregates) —
  // found already holds every landed chain's copy, so this adds no round trip. The omni
  // participant count sums per-chain distinct counts (cross-chain dedup needs an identity the
  // contracts do not carry — same stance as the home metrics).
  const chainAggregates: Record<string, VerseChainAggregates> = {};
  for (const entry of found) {
    chainAggregates[String(entry.chainId)] = {
      normalRaised: Number(entry.view.raised.genesis) / E18,
      leverageInterest: Number(entry.view.raised.leveraged) / E18,
      preorderRaised: Number(entry.view.raised.preorder) / E18,
      participantCount: entry.view.participantCount,
    };
  }
  // Genesis financial params (preorder ratio / leverage rate+cap / min success) have on-chain
  // getters but no subgraph field — detail-only RPC overlay so the fixture-mode constraint UI
  // (preorder capacity meter, real-time preorder cap, leverage preview, success threshold)
  // survives the onchain build; config-like reads ride the SWR cache (§9); a failed read
  // leaves the null slots exactly as before (never fixture samples).
  // Started before the verse literal: the USD market-cap sample inside that literal is an
  // independent round, so awaiting the literal first would serialize two RPC rounds.
  const finPromise = cachedConfig(`verse-fin-${view.chainId}-${view.verseId}`, async () => {
    // Same cached round: the launcher's own remaining-preorder-capacity preview is the
    // authoritative gate input (the panel must not re-derive capacity from float aggregates).
    const [r, runtime] = await Promise.all([
      rpc().getVerseFinancials(view.chainId, view.verseId, view.uAsset),
      rpc().getVerseRuntime(view.chainId, view.verseId),
    ]);
    const fin = unwrap(r);
    if (!fin) return null;
    const remaining = unwrap(runtime);
    const numeric = {
      minSuccessThreshold: Number(fin.minTotalFund) / E18,
      // interest rate is 1e18-scaled ratio, cap ratio is bps — fixture units are plain ratios
      leverageInterestRate: Number(fin.interestRate) / E18,
      leverageDebtCap: Number(fin.debtCap) / E18,
      preorderCapacityRatio: Number(fin.preorderCapRatioBps) / 1e4,
    };
    // Parse, don't assert: a decode-shape drift upstream yields undefined -> NaN here; gate
    // the NUMERIC slots only (the exact wad strings below are not numbers) so a malformed
    // read degrades to the null slots (never written to the disk seed) instead of leaking NaN
    if (!Object.values(numeric).every(Number.isFinite)) return null;
    return {
      ...numeric,
      // Exact raw params for the panel's bigint math (strings stay RSC-serializable)
      leverageInterestRateWad: fin.interestRate.toString(),
      preorderCapRatioBps: Number(fin.preorderCapRatioBps),
      preorderRemainingBase:
        remaining != null ? remaining.remainingPreorderCapacity.toString() : null,
    };
  });
  const verse: Verse = {
    ...toVerse(view),
    omniRaised,
    omniParticipantCount: allChainsRead
      ? found.reduce((sum, entry) => sum + entry.view.participantCount, 0)
      : null,
    deployedChainIds: found.map((entry) => entry.chainId).sort((a, b) => a - b),
    chainAggregates,
    marketCapUsd: await verseMarketCapUsd(view.stage, uAssetSymbol(view.uAsset), omniRaised),
  };
  snapshotViews.set(verse.id, view);
  landedMemecoins.set(
    verse.id,
    found.flatMap((entry) =>
      entry.view.memecoin ? [{ chainId: entry.chainId, memecoin: entry.view.memecoin as Hex }] : [],
    ),
  );
  const fin = await finPromise;
  if (!fin) return verse;
  // Progress bars share the fixture semantics (fixture-repository progress()): each raised
  // pool vs the min success threshold, percent, unclamped — the meter bounds display
  const pct = (raised: number) =>
    fin.minSuccessThreshold > 0 ? (raised / fin.minSuccessThreshold) * 100 : 0;
  return {
    ...verse,
    ...fin,
    normalProgress: pct(verse.normalRaised),
    leverageProgress: pct(verse.leverageInterest),
    preorderProgress: pct(verse.preorderRaised),
  };
}

/** Per-request dedupe: the four id-keyed detail getters below each need the verse record —
 *  React.cache() collapses their repeated executions into one within a render (the graph/RPC
 *  layers already dedupe the network reads; this removes the repeated assembly too). */
export const getVerse = cache(loadVerse);

// --- chains / registration --------------------------------------------------------------

/** Home KPI band: chain-wide totals from each chain's ProtocolStats row (O(1) per chain).
 * participantCount sums the per-chain distinct counts — cross-chain de-duplication needs an
 * identity the contracts do not carry. */
export async function getHomeMetrics() {
  const perChain = await Promise.all(TESTNETS.map((chainId) => graph().getHomeMetrics(chainId)));
  let totalLocked = 0;
  let verseCount = 0;
  let deployedVerseCount = 0;
  let participantCount = 0;
  for (const result of perChain) {
    const metrics = unwrap(result);
    if (!metrics) continue;
    totalLocked += Number(metrics.participationTotal) / E18;
    verseCount += metrics.verseCount;
    deployedVerseCount += metrics.deployedVerseCount;
    participantCount += metrics.participantCount;
  }
  return {
    totalLocked,
    verseCount,
    deployedVerseCount,
    participantCount,
    sourceRefs: ['subgraph:testnets'],
  };
}

/** Shell account slot: onchain builds never carry a demo account (the connected wallet owns
 * identity client-side) */
export async function getDisplayAccount() {
  return { address: '', sourceRef: 'onchain:wallet' };
}

/** Raise-asset whitelist for the create form (deployment tables, no subgraph read) */
export async function getAssets(): Promise<Asset[]> {
  return deployedAssets();
}

export async function getChains(): Promise<ChainInfo[]> {
  return CHAIN_IDS.map((chainId) => {
    const resolved = resolveOutrunChain(chainId);
    const config = resolved.status === 'ok' ? resolved.config : null;
    return {
      chainId,
      name: config?.viemChain.name ?? String(chainId),
      env: (MAINNET_CHAIN_IDS as readonly number[]).includes(chainId)
        ? ('mainnet' as const)
        : ('testnet' as const),
      nativeSymbol: config?.viemChain.nativeCurrency.symbol ?? '',
      sourceRef: 'lib/web3/chains.ts',
    };
  });
}

export async function getCreateConfig(): Promise<CreateConfig | null> {
  return cachedConfig('create-config', async () => {
    const preview = unwrap(await rpc().getRegistrationPreview('PROBE'));
    if (!preview) return null;
    return {
      minDurationDays: preview.minDurationDays,
      maxDurationDays: preview.maxDurationDays,
      lockupDays: preview.lockupDays,
      // cross-chain fees are live quoteSend reads on the client submit path (execution-reads), not config
      sourceRef: `rpc:${preview.hubChainId}:MemeverseRegistrationCenter`,
    };
  });
}

/** Symbol occupancy has no enumerable on-chain source: `symbolRegistry` is a mapping
 *  (MemeverseRegistrationCenterUpgradeable.sol:55) and occupancy is the per-candidate,
 *  time-relative `previewRegistration(symbol)` view at :112-118, so it can only be answered for
 *  the symbol the user is typing. The create form probes it on the client — debounced while
 *  typing and again at submit, where a false verdict fails the send closed instead of letting
 *  registration() revert with SymbolNotUnlock.
 *  This getter exists to keep the repository contract's shape, which the fixture build fills from
 *  its verses snapshot. It returns the empty set here and MUST NOT be read as "no symbol is
 *  occupied" — the authoritative answer is the client probe, never this list. */
export async function getOccupiedSymbols(): Promise<string[]> {
  return [];
}

export async function getParticipationOptions(
  raiseAssetSymbol: string | null,
  execChainId?: number,
): Promise<ParticipationOptions> {
  // Unknown raise asset (address outside the deployment tables) — every participation
  // route fails closed; empty options keep the panel's direct-pay toggle disabled instead
  // of borrowing a deployed family's contracts
  if (raiseAssetSymbol == null) {
    return { raiseAsset: null, reserves: [], yieldSourceRegistry: [], creditAsset: null };
  }
  // Config-tier read (low churn, accountless) — cachedConfig serves the last good value across
  // the 30s TTL and across process restarts (§9).
  const options = await cachedConfig(
    `participation:${raiseAssetSymbol}:${execChainId ?? 0}`,
    async (): Promise<ParticipationOptions> => {
      // Deployment-table wired: the raise uAsset's paired GenesisCredit (leverage-credit direct
      // pay) and its PSM pair reserve (face-value direct swap). Stake sources resolve per
      // execution chain (SP instances differ per chain — slisBNB lives only on BSC Testnet) and
      // stay hidden on a chain without them; the registry is chain-read, never faked.
      const creditAsset = contractAsset(`GenesisCredit.${raiseAssetSymbol}`);
      const reserve = await psmReserveAsset(raiseAssetSymbol);
      const stakeChain = TESTNETS.includes(execChainId ?? -1) ? (execChainId as number) : null;
      const uAssetAddress =
        stakeChain != null
          ? deployedContracts(stakeChain)[`UAsset.${raiseAssetSymbol}`]
          : undefined;
      const stakeSources =
        stakeChain != null && uAssetAddress
          ? (unwrap(await rpc().getStakeSources(stakeChain, uAssetAddress)) ?? [])
          : [];
      const yieldSourceRegistry: YieldSource[] = stakeSources.map((source) => ({
        id: source.sp,
        sourceRef: `rpc:${stakeChain}:${source.name}`,
        // deployments instance key minus the contract prefix doubles as the yield-source label —
        // the brand name has no chain source
        name: source.name.replace(/^OutrunStakingPosition\./, ''),
        assets: source.tokens.map((token) => ({
          id: token.address,
          symbol: token.symbol,
          decimals: token.decimals,
          sourceRef: `rpc:${stakeChain}:${source.name}#${token.symbol}`,
          sp: source.sp,
          anchorValue: token.anchorValue ?? undefined,
          // Exact preview base (uAsset units per ONE whole token) for the bigint conversion.
          anchorPreviewBase: token.previewBase?.toString(),
        })),
      }));
      return {
        raiseAsset: {
          id: `uasset:${raiseAssetSymbol}`,
          sourceRef: 'lib/web3/chains.ts',
          symbol: raiseAssetSymbol,
        },
        reserves: reserve ? [reserve] : [],
        yieldSourceRegistry,
        creditAsset,
      };
    },
  );
  return options!;
}

function contractAsset(key: string): Asset | null {
  for (const chainId of TESTNETS) {
    const addr = deployedContracts(chainId)[key];
    if (addr) {
      const family = key.split('.').pop() ?? key;
      // Credit carries its own ERC20 symbol on-chain, but the UI vocabulary is the fixture
      // term "SYM(Credit)" — a bare family symbol would collide with the uAsset in the
      // credit route's balance lookups (walletBalances is keyed by symbol)
      const symbol = key.startsWith('GenesisCredit.') ? `${family}(Credit)` : family;
      return { id: addr, symbol, sourceRef: `deployments/${chainId}.json#${key}` };
    }
  }
  return null;
}

async function psmReserveAsset(uAssetSymbol: string): Promise<Asset | null> {
  for (const chainId of TESTNETS) {
    const psm = deployedContracts(chainId)[`OutrunPSM.${uAssetSymbol}`];
    if (!psm) continue;
    const state = unwrap(await rpc().getPsmState(chainId, psm));
    if (!state) continue;
    // Metadata piggybacks on the token-balance view (zero-address owner: symbol/decimals only)
    const rows = unwrap(
      await rpc().getTokenBalances(chainId, '0x0000000000000000000000000000000000000000', [
        state.reserve,
      ]),
    );
    const meta = rows?.[0];
    if (meta) {
      return {
        id: state.reserve,
        symbol: meta.symbol,
        decimals: meta.decimals,
        sourceRef: `rpc:${chainId}:OutrunPSM.${uAssetSymbol}`,
        // PSM mint-side fee (tin): 18-dec point value (1e18 = 100%) — the same read the faucet
        // Fee row uses; the face-value direct path deducts it before uAsset is minted.
        psmFeeIn: Number(state.tinWad) / E18,
        // Exact wad for the panel's bigint mint math (amountOut = face * (1e18-tin)/1e18).
        psmFeeInWad: state.tinWad.toString(),
      };
    }
  }
  return null;
}

// --- faucet (R-07, real RPC data) ---------------------------------------------------------

// Personal values never ride the SSR path — account-scoped reads
// (balances, claim probes) moved client-side (FaucetSwapDialog reads PSM balances through the
// wallet provider; FaucetClaims already probes claim()). The server keeps only the accountless
// config read (limits/fees/headroom), fully SWR-cached (§9).
export async function getFaucet(): Promise<Faucet | null> {
  return cachedConfig('faucet-97', async () => {
    const status = unwrap(await rpc().getFaucetStatus(REGISTRATION_HUB));
    if (!status) return null;
    const resolved = resolveOutrunChain(REGISTRATION_HUB);
    return {
      chainId: status.chainId,
      chainName: resolved.status === 'ok' ? resolved.config.viemChain.name : String(status.chainId),
      tokens: status.tokens.map((token) => ({
        symbol: token.symbol,
        name: token.name,
        dailyLimit: Number(token.dailyLimit) / E18,
        // per-user cooldown has no on-chain getter/event — slot not rendered
        cooldownRemainingMs: null,
      })),
      swap: {
        uAssetSymbol: uAssetSymbol(status.swap.uAsset),
        reserveSymbol: 'USDC',
        // PSM tin/tout are 18-dec point values (1e18 = 100%), not bps
        feeIn: Number(status.swap.tinWad) / E18,
        feeOut: Number(status.swap.toutWad) / E18,
        feeInWad: status.swap.tinWad.toString(),
        feeOutWad: status.swap.toutWad.toString(),
        headroom: Number(status.swap.headroom) / E18,
        // accountless read: always null→0 here; the connected wallet reads real balances
        // client-side (see the section comment above)
        myUAsset: status.swap.myUAsset != null ? Number(status.swap.myUAsset) / E18 : 0,
        myReserve: status.swap.myReserve != null ? Number(status.swap.myReserve) / E18 : 0,
      },
    };
  });
}

// --- referral (R-06: real rate + pending via RPC; histories via graph once there is volume) -

// The SSR path is accountless — referrerRebateBps is a global hook config
// (identical for the zero address), so the cached config read serves the rate; per-referrer
// pending/history stay client/graph-driven (empty until wired, same as before).
export async function getReferral(): Promise<Referral | null> {
  const snapshot = await cachedConfig('referral-97', async () =>
    unwrap(
      await rpc().getReferralSnapshot(
        REGISTRATION_HUB,
        '0x0000000000000000000000000000000000000000',
      ),
    ),
  );
  const ratePercent = snapshot?.ratePercent ?? null;
  return {
    owner: '',
    referralCode: null,
    ratePercent,
    totalEarnedUsd: 0,
    pendingUsd: 0,
    friendsCount: 0,
    earned: [],
    pending: [],
    transactions: [],
    friends: [],
  };
}

// --- verse detail sections ----------------------------------------------------------------

type PoolKind = 'main' | 'pol-uasset' | 'pt-uasset' | 'pt-pol';
type VerseTokenKind = 'memecoin' | 'pol' | 'pt' | 'uAsset';

/** (base, quote) token kinds per pool — the pairing bootstrap liquidity deploys at settlement:
 *  main=memecoin/uAsset, POL pool=POL/uAsset, PT pools=PT/uAsset and PT/POL. */
const POOL_SIDES: Record<PoolKind, [VerseTokenKind, VerseTokenKind]> = {
  main: ['memecoin', 'uAsset'],
  'pol-uasset': ['pol', 'uAsset'],
  'pt-uasset': ['pt', 'uAsset'],
  'pt-pol': ['pt', 'pol'],
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/** Trade desk with no pool data yet (genesis/refund verse, or every composition read failed):
 *  pools empty, stats slotted — never fabricated values. */
function emptyVerseTrade(verse: Verse): VerseTrade {
  return {
    candles: [],
    fineCandles: null,
    tokenStats: {
      price: null,
      change24h: null,
      marketCap: null,
      liquidity: null,
      volume24h: null,
      holders: null,
      totalSupply: null,
      tokenAddress: verse.memecoinAddress,
    },
    pools: [],
  };
}

type VersePoolComposition = {
  chainId: number;
  tokens: Record<VerseTokenKind, Hex>;
  /** lowercased token address -> decimals (plain record: the composition rides the JSON seed) */
  decimals: Record<string, number>;
  polSupply: bigint | null;
  /** supply/amounts null = the read failed (unknown); a zero-LP pool reads exactly 0n —
   *  unknown degrades its price/TVL slot to null, empty keeps the honest 0 */
  legs: Array<{
    kind: PoolKind;
    supply: bigint | null;
    amountBase: bigint | null;
    amountQuote: bigint | null;
  }>;
};

/** Governance contracts (vault/governor/incentivizer) off the Verse row. The row is rewritten
 *  by the proxy deployer's settlement events (subgraph/src/governance-deploy.ts), so a
 *  zero/absent field = settlement genuinely deployed none (or a spoke-chain row, which never
 *  carries them — the DApp reads the governance-chain copy). */
function governanceContractsOf(view: VerseSummaryView): {
  vault: string | null;
  governor: string | null;
  incentivizer: string | null;
} {
  return {
    vault: view.yieldVault && view.yieldVault !== ZERO_ADDRESS ? view.yieldVault : null,
    governor: view.governor && view.governor !== ZERO_ADDRESS ? view.governor : null,
    incentivizer:
      view.incentivizer && view.incentivizer !== ZERO_ADDRESS ? view.incentivizer : null,
  };
}

/** One verse's four pool legs off the canonical chain: LP supply (hook cache) per locally
 *  computed pool id, then the full-range reserve amounts through the router quote. A pool
 *  without LP settles at zero reserves (amounts 0n) — its price/TVL slots degrade, never
 *  block the others. A failed supply/reserve read is UNKNOWN, not empty: it keeps null
 *  amounts so downstream slots hide instead of printing a fabricated $0.00. */
async function readVersePoolComposition(
  chainId: number,
  view: VerseSummaryView,
): Promise<VersePoolComposition | null> {
  const contracts = deployedContracts(chainId);
  const router = contracts.MemeverseSwapRouter;
  const hook = contracts.MemeverseUniswapHook;
  const splitter = contracts.POLSplitter;
  if (!router || !hook || !splitter || !view.memecoin || !view.pol) return null;
  const pt = unwrap(await rpc().getVersePtAddress(chainId, splitter, view.verseId));
  if (!pt || pt === ZERO_ADDRESS) return null;
  const tokens: Record<VerseTokenKind, Hex> = {
    memecoin: view.memecoin as Hex,
    pol: view.pol as Hex,
    pt: pt as Hex,
    uAsset: view.uAsset as Hex,
  };
  // decimals ride the batched metadata read (zero-address owner: symbol/decimals only)
  const meta = unwrap(
    await rpc().getTokenBalances(chainId, ZERO_ADDRESS, [
      tokens.memecoin,
      tokens.pol,
      tokens.pt,
      tokens.uAsset,
    ]),
  );
  if (!meta) return null;
  const decimals = Object.fromEntries(
    meta.map((row) => [row.address.toLowerCase(), row.decimals] as const),
  );
  // Memecoin totalSupply is NOT read here: the OFT splits circulation across chains, so
  // the market cap sums every landed chain's local supply (omniMemecoinSupply) instead
  const polSupply = unwrap(await rpc().getTokenTotalSupply(chainId, tokens.pol));
  const legs = await Promise.all(
    (Object.keys(POOL_SIDES) as PoolKind[]).map(async (kind) => {
      const [baseKind, quoteKind] = POOL_SIDES[kind];
      const base = tokens[baseKind];
      const quote = tokens[quoteKind];
      const poolId = poolIdOf(hookPoolKey(base, quote, hook as Hex));
      const supply = unwrap(await rpc().getPoolLpSupply(chainId, hook, poolId));
      // supply read failed -> unknown; supply 0 -> a genuinely empty pool
      if (supply == null) return { kind, supply: null, amountBase: null, amountQuote: null };
      if (supply <= 0n) return { kind, supply, amountBase: 0n, amountQuote: 0n };
      const amounts = unwrap(
        await rpc().getPoolReserveAmounts(chainId, router, base, quote, supply),
      );
      if (!amounts) return { kind, supply, amountBase: null, amountQuote: null };
      return { kind, supply, amountBase: amounts[0], amountQuote: amounts[1] };
    }),
  );
  return { chainId, tokens, decimals, polSupply, legs };
}

/** Display price of one pool from the composition legs (quote per base). Shared by the trade
 *  desk and the POL position — the reserve ratio is the pool's live price, no extra read. */
function poolPriceOf(comp: VersePoolComposition, kind: PoolKind): number | null {
  const leg = comp.legs.find((entry) => entry.kind === kind);
  if (!leg || leg.amountBase == null || leg.amountQuote == null) return null;
  const [baseKind, quoteKind] = POOL_SIDES[kind];
  const dec = (tokenKind: VerseTokenKind) =>
    comp.decimals[comp.tokens[tokenKind].toLowerCase()] ?? 18;
  return priceQuotePerBase(leg.amountBase, dec(baseKind), leg.amountQuote, dec(quoteKind));
}

/** POL-position unit price: an honestly empty pool (no LP / both sides 0) reads as 0 — the
 *  gauge shows full deviation rather than a fake mid — while a failed read is unknown, not
 *  worthless, and stays null so the gauge slots instead of printing a fabricated $0. */
function polPricePerPol(comp: VersePoolComposition, kind: PoolKind): number | null {
  const leg = comp.legs.find((entry) => entry.kind === kind);
  if (!leg || leg.amountBase == null || leg.amountQuote == null) return null;
  if (leg.amountBase <= 0n && leg.amountQuote <= 0n) return 0;
  return poolPriceOf(comp, kind);
}

/** Price/TVL mapping over the raw composition. Every display value derives from the pool
 *  reserves: pool price = quote/base reserve ratio; TVL = uAsset leg at face + other leg
 *  converted through its own pool's price (PT/POL pool legs convert via the PT and POL
 *  uAsset pools). USD scale multiplies by the uAsset USD sample; an absent sample (failed
 *  feed / unresolved raise asset) nulls the $-prefixed slots — they hide, never render
 *  uAsset-unit numbers with a $ prefix. */
function buildVerseTrade(
  verse: Verse,
  comp: VersePoolComposition,
  uAssetUsd: number | null,
  omniSupply: bigint | null,
): VerseTrade {
  const legOf = (kind: PoolKind) => comp.legs.find((leg) => leg.kind === kind)!;
  const dec = (kind: VerseTokenKind) => comp.decimals[comp.tokens[kind].toLowerCase()] ?? 18;
  const priceMeme = poolPriceOf(comp, 'main');
  const pricePol = poolPriceOf(comp, 'pol-uasset');
  const pricePt = poolPriceOf(comp, 'pt-uasset');
  const uAssetEq = (kind: PoolKind): number | null => {
    const leg = legOf(kind);
    // A failed read is unknown, not an empty pool — hide the slot, never print a fake $0
    if (leg.amountBase == null || leg.amountQuote == null) return null;
    const [baseKind, quoteKind] = POOL_SIDES[kind];
    const base = Number(leg.amountBase) / 10 ** dec(baseKind);
    const quote = Number(leg.amountQuote) / 10 ** dec(quoteKind);
    // main/pol-uasset/pt-uasset price their base off their OWN pool and value the quote side
    // (uAsset) at face; pt-pol converts both sides through the PT and POL uAsset pools.
    const basePrice = kind === 'pt-pol' ? pricePt : poolPriceOf(comp, kind);
    const quotePrice = kind === 'pt-pol' ? pricePol : 1;
    // Only a zero side may read 0; a non-zero side whose conversion price is unknown leaves
    // the leg value unknown (a drained backing pool must not halve this pool's TVL).
    if ((base > 0 && basePrice == null) || (quote > 0 && quotePrice == null)) return null;
    return base * (basePrice ?? 0) + quote * (quotePrice ?? 0);
  };
  const liquidityEq = uAssetEq('main');
  // Market cap rides the OMNICHAIN supply (per-chain totalSupply summed by the caller) —
  // the OFT model splits circulation across chains, so any single chain's read understates
  const totalSupply = omniSupply != null ? Number(omniSupply) / 10 ** dec('memecoin') : null;
  const symbolOf = (kind: VerseTokenKind) =>
    kind === 'memecoin'
      ? verse.symbol
      : kind === 'pol'
        ? `POL-${verse.symbol}`
        : kind === 'pt'
          ? `PT-${verse.symbol}`
          : // unknown raise asset: the uAsset pool side renders symbol-less (slot degrade);
            // its price read is null so USD-derived stats stay null too
            (verse.raiseAsset ?? '');
  const pools: VerseTrade['pools'] = comp.legs.map((leg) => {
    const [baseKind, quoteKind] = POOL_SIDES[leg.kind];
    const uAssetValue = uAssetEq(leg.kind);
    return {
      id: `${verse.id}-${leg.kind}`,
      sourceRef: `rpc:${comp.chainId}:${leg.kind}`,
      verseId: verse.id,
      pool: leg.kind,
      tvl: uAssetValue != null && uAssetUsd != null ? uAssetValue * uAssetUsd : null,
      // dynamic fee is swap-context dependent; 24h volume and APR need the indexed PoolSwap
      // history — all three stay slotted until those reads land
      feeState: 'normal',
      feeRate: null,
      volume24h: null,
      apr7d: null,
      lpPerQuote:
        leg.supply != null && leg.amountQuote != null
          ? lpPerQuoteUnit(leg.supply, leg.amountQuote)
          : null,
      baseSymbol: symbolOf(baseKind),
      quoteSymbol: symbolOf(quoteKind),
    };
  });
  return {
    candles: [],
    fineCandles: null,
    tokenStats: {
      price: priceMeme,
      change24h: null,
      marketCap:
        priceMeme != null && totalSupply != null && uAssetUsd != null
          ? priceMeme * totalSupply * uAssetUsd
          : null,
      liquidity: liquidityEq != null && uAssetUsd != null ? liquidityEq * uAssetUsd : null,
      volume24h: null,
      holders: null,
      totalSupply,
      tokenAddress: verse.memecoinAddress,
    },
    pools,
  };
}

export async function getVerseTrade(verseId: string): Promise<VerseTrade | null> {
  const verse = await getVerse(verseId);
  if (!verse) return null;
  // Pools exist only after settlement (memecoin + POL deploy at launch) — the trade desk is
  // not rendered on these stages; keep the empty shape for the four-tab guard.
  if (verse.stage === 'genesis' || verse.stage === 'refund') return emptyVerseTrade(verse);
  const view = snapshotViews.get(verse.id);
  if (!view?.memecoin || !view.pol) return emptyVerseTrade(verse);
  const comp = await cachedConfig(`verse-trade-${view.chainId}-${verse.id}`, () =>
    readVersePoolComposition(view.chainId, view),
  );
  if (!comp) return emptyVerseTrade(verse);
  const [uAssetUsd, omniSupply] = await Promise.all([
    getAssetUsdPrice(verse.raiseAsset),
    omniMemecoinSupply(verse.id, landedMemecoins.get(verse.id) ?? []),
  ]);
  return buildVerseTrade(verse, comp, uAssetUsd, omniSupply);
}

export async function getStaking(verseId: string): Promise<Staking | null> {
  const verse = await getVerse(verseId);
  if (!verse) return null;
  // The vault deploys at settlement — no staking exists on genesis/refund verses
  if (verse.stage === 'genesis' || verse.stage === 'refund') return null;
  const view = snapshotViews.get(verse.id);
  if (!view) return null;
  // Zero vault after the launcher fallback = settlement deployed no staking
  const { vault } = governanceContractsOf(view);
  if (!vault) return null;
  const state = await cachedConfig(`verse-vault-${view.chainId}-${verse.id}`, async () =>
    unwrap(await rpc().getVaultState(view.chainId, vault)),
  );
  if (!state) return null;
  return {
    vaultAddress: vault,
    totalStaked: Number(state.totalAssets) / 1e18,
    assetsPerShare: Number(state.assetsPerShareBase) / 1e18,
    // Realized APY needs yield history (checkpoint series) — no static view; the row slots
    apy7d: null,
    // Account half (shares/queue/delegate) reads through the wallet provider client-side
    myShares: null,
    myShareValue: null,
    delegatee: null,
    pendingRedeems: null,
    claimableTotal: null,
  };
}

export async function getPolPosition(verseId: string): Promise<PolPosition | null> {
  const verse = await getVerse(verseId);
  if (!verse) return null;
  // POL/PT/YT exist only after settlement — the Tokenization panel is not rendered earlier
  if (verse.stage === 'genesis' || verse.stage === 'refund') return null;
  const view = snapshotViews.get(verse.id);
  if (!view?.memecoin || !view.pol) return null;
  const comp = await cachedConfig(`verse-trade-${view.chainId}-${verse.id}`, () =>
    readVersePoolComposition(view.chainId, view),
  );
  if (!comp) return null;
  // Splitter wiring in one cached round: PT backing ratio (= uAsset per POL, registered once at
  // settlement) plus the YT redemption leg preview (reverts pre-settlement → null leg, retried
  // rather than cached as a hard failure).
  const split = await cachedConfig(`verse-split-${view.chainId}-${verse.id}`, async () => {
    const splitter = deployedContracts(view.chainId).POLSplitter;
    if (!splitter) return null;
    const info = unwrap(await rpc().getVerseSplitInfo(view.chainId, splitter, view.verseId));
    if (!info) return null;
    const ytLeg = unwrap(
      await rpc().getPreviewRedeemYtUAsset(view.chainId, splitter, view.verseId, 10n ** 18n),
    );
    // Memecoin leg is a settlement truth: settlementMemecoin split over the circulating YT
    // supply — only meaningful once settled; pre-settlement there is no memecoin leg at all
    const ytSupply =
      info.settled && info.settlementMemecoin > 0n && info.yt !== ZERO_ADDRESS
        ? unwrap(await rpc().getTokenTotalSupply(view.chainId, info.yt))
        : null;
    const memeLegPerUnit =
      ytSupply != null && ytSupply > 0n ? Number(info.settlementMemecoin) / Number(ytSupply) : null;
    return { info, ytLeg, memeLegPerUnit };
  });
  if (!split || split.info.ptBackingDenominator <= 0n) return null;
  const uAssetPerPol =
    Number(split.info.ptBackingNumerator) / Number(split.info.ptBackingDenominator);
  const polDecimals = comp.decimals[comp.tokens.pol.toLowerCase()] ?? 18;
  return {
    polAddress: view.pol,
    polSupply: comp.polSupply != null ? Number(comp.polSupply) / 10 ** polDecimals : null,
    uAssetPerPol,
    nominalValuePerPol: uAssetPerPol * 2,
    marketPricePerPol: polPricePerPol(comp, 'pol-uasset'),
    ptPricePerPol: polPricePerPol(comp, 'pt-pol'),
    // The flash fee is swap-context dependent (dynamic fee on the PT full-leg notional) — no
    // static view exists; the dialog's fee row slots until an execution-time quote lands
    flashUserFeeRate: null,
    // Account-scoped values never ride the accountless SSR path — dialogs render '--' and the
    // chain enforces real holdings at execution; the faucet my-balance probe pattern fills them
    // client-side where a display needs them
    myPol: null,
    myPt: null,
    myYt: null,
    myMemecoin: null,
    myUAsset: null,
    myReserve: null,
    myLp: { main: null, 'pol-uasset': null, 'pt-uasset': null, 'pt-pol': null },
    claimableYt: null,
    // Claim-center legs are wallet-scoped (the fifth tab reads them client-side through the
    // wallet provider); the accountless SSR path never carries them
    claimablePreorder: null,
    claimedPreorder: null,
    preorderProgress: null,
    claimableUAssetFee: null,
    claimablePtFee: null,
    claimableLpMeme: null,
    claimableLpUAsset: null,
    ytRedeemUAssetPerUnit: split.ytLeg != null ? Number(split.ytLeg) / 1e18 : null,
    ytRedeemMemecoinPerUnit: split.memeLegPerUnit,
  };
}

export async function getGovernanceState(verseId: string): Promise<GovernanceState | null> {
  const verse = await getVerse(verseId);
  if (!verse) return null;
  // Governance contracts deploy at settlement — no DAO state on genesis/refund verses
  if (verse.stage === 'genesis' || verse.stage === 'refund') return null;
  const view = snapshotViews.get(verse.id);
  if (!view) return null;
  // Zero contracts after the launcher fallback = governance never deployed — absent, not errored
  const { vault, governor, incentivizer } = governanceContractsOf(view);
  if (!vault || !governor || !incentivizer) return null;
  const chainId = view.chainId;
  const gov = await cachedConfig(`verse-gov-${chainId}-${verse.id}`, async () => {
    const snapshot = unwrap(await rpc().getGovernanceSnapshot(chainId, incentivizer));
    if (!snapshot) return null;
    const [votingShares] = await Promise.all([
      rpc().getTokenTotalSupply(chainId, vault).then(unwrap),
    ]);
    // Token metadata for treasury/reward rows (batched symbol+decimals via the zero-address read)
    const pricedTokens = new Set([view.uAsset.toLowerCase(), (view.memecoin ?? '').toLowerCase()]);
    const listTokens = [
      ...new Set(
        [
          ...snapshot.treasury.tokens,
          ...snapshot.rewards.tokens,
          ...(snapshot.previousTreasury?.tokens ?? []),
        ].map((token) => token.toLowerCase()),
      ),
    ].filter((token) => pricedTokens.has(token));
    const meta = listTokens.length
      ? unwrap(await rpc().getTokenBalances(chainId, ZERO_ADDRESS, [...listTokens]))
      : [];
    return { snapshot, votingShares, meta };
  });
  if (!gov) return null;
  const status = unwrap(
    await graph().getGovernanceStatus(chainId, governor, incentivizer, gov.snapshot.currentCycleId),
  );
  // Priced composition: only uAsset (at the USD sample) and the memecoin (through the main-pool
  // price) carry a USD value on-chain — other treasury tokens render no row rather than a fake 0
  const uAssetUsd = await getAssetUsdPrice(verse.raiseAsset);
  const comp = await cachedConfig(`verse-trade-${chainId}-${verse.id}`, () =>
    readVersePoolComposition(chainId, view),
  );
  const priceMeme = comp ? poolPriceOf(comp, 'main') : null;
  const metaOf = new Map((gov.meta ?? []).map((row) => [row.address.toLowerCase(), row]));
  const toPricedAssets = (
    tokens: readonly string[],
    balances: readonly bigint[],
  ): {
    rows: Array<{ symbol: string; name: string; amount: number; usdValue: number }> | null;
    usdTotal: number | null;
  } => {
    if (tokens.length === 0) return { rows: null, usdTotal: null };
    const rows: Array<{ symbol: string; name: string; amount: number; usdValue: number }> = [];
    let usdTotal: number | null = null;
    tokens.forEach((token, index) => {
      const meta = metaOf.get(token.toLowerCase());
      const balance = balances[index];
      if (!meta || balance == null || balance <= 0n) return;
      const amount = Number(balance) / 10 ** meta.decimals;
      const usdEach =
        token.toLowerCase() === view.uAsset.toLowerCase()
          ? uAssetUsd
          : priceMeme != null && uAssetUsd != null
            ? priceMeme * uAssetUsd
            : null;
      if (usdEach == null) return;
      rows.push({ symbol: meta.symbol, name: meta.symbol, amount, usdValue: amount * usdEach });
      usdTotal = (usdTotal ?? 0) + amount * usdEach;
    });
    return { rows: rows.length > 0 ? rows : null, usdTotal };
  };
  const treasury = toPricedAssets(gov.snapshot.treasury.tokens, gov.snapshot.treasury.balances);
  const rewards = toPricedAssets(gov.snapshot.rewards.tokens, gov.snapshot.rewards.amounts);
  const previousTreasury = gov.snapshot.previousTreasury
    ? toPricedAssets(gov.snapshot.previousTreasury.tokens, gov.snapshot.previousTreasury.balances)
    : { rows: null, usdTotal: null };
  const totalVotes = Number(gov.snapshot.current.totalVotes) / 1e18;
  return {
    cycleNumber: String(gov.snapshot.currentCycleId),
    cycleDurationDays: Number(gov.snapshot.cycleDurationSecs) / 86_400,
    cycleEndsAt: iso(gov.snapshot.current.endTime),
    // Subgraph failure → null (degrade, never fabricate); query-ok-but-unindexed still reads
    // false per the getGovernanceStatus contract
    finalized: status?.finalized ?? null,
    claimWindowEndsAt: null,
    governorAddress: governor,
    incentivizerAddress: incentivizer,
    delegates: null,
    totalVotingPower: gov.votingShares != null ? Number(gov.votingShares) / 1e18 : null,
    myVotes: null,
    treasuryUAsset: treasury.usdTotal,
    rewardRatioBps: null,
    cumulativeIncentivePool: rewards.usdTotal,
    treasuryAssets: treasury.rows,
    currentCycleVotes: { total: totalVotes, mine: null },
    estimatedClaimable: null,
    lastCycle: gov.snapshot.previous
      ? {
          number: String(gov.snapshot.currentCycleId - 1n),
          treasuryUAsset: previousTreasury.usdTotal,
          treasuryAssets: previousTreasury.rows,
          remainingRewards: rewards.usdTotal,
          totalVotes: Number(gov.snapshot.previous.totalVotes) / 1e18,
          myVotes: null,
          myClaimable: null,
          claimableAssets: null,
          unclaimedAssets: null,
        }
      : null,
    // Subgraph failure → null: a fabricated 0 would render as a certain "no proposals" row
    proposalCount: status ? { total: status.proposalTotal, active: status.proposalActive } : null,
  };
}

/** uAsset → USD sample for the ≈$ rows. UUSD is PSM face-value par against its USD reserve
 *  (1:1 — the same contract fact the faucet swap UI shows); UETH/UBNB ride the underlying's
 *  native Chainlink feed on the chain whose NATIVE asset is that family's underlying
 *  (ETH→Arbitrum Sepolia, BNB→BSC Testnet; each manifest carries exactly one native feed).
 *  A stale or failed feed reads as null → the USD rows simply hide. */
const NATIVE_USD_FEED_CHAIN: Record<string, number> = { UETH: 421614, UBNB: 97 };

export async function getAssetUsdPrice(symbol: string | null): Promise<number | null> {
  if (symbol == null) return null;
  if (symbol === 'UUSD') return 1;
  const feedChain = NATIVE_USD_FEED_CHAIN[symbol];
  if (!feedChain) return null;
  return cachedConfig(`asset-usd-${symbol}`, async () => {
    const resolved = resolveOutrunChain(feedChain);
    const feed = resolved.status === 'ok' ? resolved.config.nativeUsdFeed : null;
    const client = getPublicClient(feedChain);
    if (!feed || !client) return null;
    return readNativeUsdPrice(client, feed as Hex);
  });
}

// --- portfolio sections (aggregates; empty until per-account wiring in stage 6+) ------------

export async function getWalletAssets(): Promise<WalletAsset[]> {
  return [];
}

export async function getReserveBalances(): Promise<Record<string, number>> {
  const account = await connectedAccount();
  if (!account) return {};
  // Per-request reads (account-scoped, no disk seed); symbols summed cross-chain like the
  // fixture map (balances.json 按符号跨链合计). Chains fan out; within a chain the PSM states
  // fan out and the deduped reserves read as ONE batched multicall (6 round trips, not 18).
  const totals: Record<string, number> = {};
  await Promise.all(
    TESTNETS.map(async (chainId) => {
      const psms = Object.entries(deployedContracts(chainId)).filter(([key]) =>
        key.startsWith('OutrunPSM.'),
      );
      const states = (
        await Promise.all(psms.map(([, psm]) => rpc().getPsmState(chainId, psm).then(unwrap)))
      ).filter((state): state is NonNullable<typeof state> => state != null);
      const reserves = [...new Set(states.map((state) => state.reserve))];
      if (reserves.length === 0) return;
      const rows = unwrap(await rpc().getTokenBalances(chainId, account, reserves));
      for (const row of rows ?? []) {
        totals[row.symbol] = (totals[row.symbol] ?? 0) + Number(row.balance) / 10 ** row.decimals;
      }
    }),
  );
  return totals;
}

// The account-scoped SSR read is retired — personal values never ride the server path; its last
// consumer, the verse participation panel, now reads pay-asset balances client-side through the
// wallet provider. Accountless on onchain; fixture-mode samples live in the fixture repository
// (untouched, baselines keep them).
export async function getWalletBalances(): Promise<Record<string, number>> {
  return {};
}

export async function getPsmPair(_uAssetSymbol: string): Promise<PsmPair | null> {
  return null;
}

export async function getCdpPositions(): Promise<never[]> {
  return [];
}

export async function getUsrSavings(): Promise<UsrSavings[]> {
  return [];
}

export async function getVaultRows(): Promise<VaultRow[]> {
  return [];
}

export async function getPortfolioActions(): Promise<PortfolioAction[]> {
  return [];
}

export async function getParticipationRows(): Promise<ParticipationRow[]> {
  return [];
}

export async function getPortfolioSignals() {
  return { actionCount: 0, claimableVerses: 0 };
}

export async function getParticipations(): Promise<Participation[]> {
  return [];
}

// Warm the cold caches at server boot so the first navigation doesn't pay the network round
// trips (fire-and-forget; failures degrade silently per §9/§24). Only in the onchain runtime
// (the default — fixture test processes set OUTRUN_DATA_SOURCE=fixture) and never during
// `next build` (NEXT_PHASE).
if (
  process.env.OUTRUN_DATA_SOURCE !== 'fixture' &&
  process.env.NEXT_PHASE !== 'phase-production-build'
) {
  void Promise.allSettled([getSnapshot(), getFaucet(), getReferral(), getCreateConfig()]);
}

// Server-side Graph repository (§9 graph path): global lists / aggregates / history from the
// per-chain Studio subgraphs, with short-TTL cache + in-flight dedup.
//
// RPC-AUTHORITATIVE FIELD RULE (§9/§16): balances, allowances, account code and transaction
// final outcomes NEVER come from this module — the ViewModels below structurally exclude them
// and unit tests assert indexed data can never override those fields (receipts are RPC-only via
// RpcOnchainRepository.getTransactionReceipt; stale indexes never judge transaction success).
//
// Index lag degrades SILENTLY (§9 + §24 erratum): every query reads the graph `_meta` block and
// the RPC safe block side by side, then DISCARDS the comparison — a lagging index returns its
// (slightly stale) aggregates unchanged, with no degraded/stale marker anywhere in the payload.
// An unreachable safe-block reader does not take aggregates down with it.
import { getChainConfig, type ResolvedChain } from '../../web3/chains';
import { resolveDataSource } from '../source-resolver';
import type { DataResult } from '../repository';
import { createHttpGraphPort, type GraphPort } from './graph-port';
import { readSeed, writeSeed, deleteSeed } from '../persisted-swr';

const unavailable = <T>(
  reason: 'rpc-error' | 'not-configured' | 'undeployed',
  detail: string,
): DataResult<T> => ({ status: 'unavailable', reason, detail });
const ok = <T>(data: T): DataResult<T> => ({ status: 'ok', data });

// ---------------------------------------------------------------------------
// Graph ViewModels — aggregate/history domain ONLY (see the RPC-authoritative note above)
// ---------------------------------------------------------------------------

export type VerseSummaryView = {
  chainId: number;
  verseId: bigint;
  name: string;
  symbol: string;
  stage: 'genesis' | 'refund' | 'locked' | 'unlocked';
  flashGenesis: boolean;
  uAsset: string;
  memecoin: string | null;
  pol: string | null;
  yieldVault: string | null;
  governor: string | null;
  incentivizer: string | null;
  endTime: bigint;
  unlockTime: bigint;
  omnichainIds: bigint[];
  communities: string[];
  registeredAt: bigint;
  /** Aggregate sums over the indexed participation events (display magnitudes, not balances) */
  raised: { genesis: bigint; leveraged: bigint; preorder: bigint };
  /** Distinct participating addresses on this verse (indexed-event approximation) */
  participantCount: number;
};

/** Per-chain participation sums for an explicit verse set, plus the verse ids that actually have
 * a Verse row on that chain. Registered-but-not-landed chains have no row, so `present` is the
 * only truthful source for "which chains hold this verse". */
export type VerseRaisedSums = {
  sums: Map<string, VerseSummaryView['raised']>;
  present: Set<string>;
};

export type HomeMetricsView = {
  verseCount: number;
  deployedVerseCount: number;
  /** Distinct addresses across all indexed participations on the chain */
  participantCount: number;
  /** Sum of indexed participation amounts (genesis + leveraged + preorder); pool TVL not included */
  participationTotal: bigint;
};

export type ParticipationHistoryView = {
  chainId: number;
  genesis: Array<{ verseId: bigint; payer: string; depositer: string; amount: bigint; at: bigint }>;
  preorder: Array<{ verseId: bigint; caller: string; user: string; amount: bigint; at: bigint }>;
  leveraged: Array<{ verseId: bigint; payer: string; user: string; amount: bigint; at: bigint }>;
  claims: Array<{ verseId: bigint; kind: string; receiver: string; at: bigint }>;
};

export type ReferralHistoryView = {
  chainId: number;
  accrued: Array<{ currency: string; amount: bigint; at: bigint }>;
  claimed: Array<{ currency: string; amount: bigint; at: bigint }>;
};

const META_FRAGMENT = '_meta { block { number } hasIndexingErrors }';

type VerseRow = {
  verseId: string;
  name: string;
  symbol: string;
  stage: string;
  flashGenesis: boolean;
  uAsset: string;
  memecoin: string | null;
  pol: string | null;
  yieldVault: string | null;
  governor: string | null;
  incentivizer: string | null;
  endTime: string;
  unlockTime: string;
  omnichainIds: string[];
  communities: string[];
  registeredAtTimestamp: string;
};
type GenesisRow = { verseId: string; payer: string; depositer: string; amount: string };
type PreorderRow = { verseId: string; caller: string; user: string; amountInUAsset: string };
type LeveragedRow = { verseId: string; payer: string; user: string; amount: string };

type VerseAggregateData = {
  verses: VerseRow[];
  genesisParticipations: GenesisRow[];
  preorderParticipations: PreorderRow[];
  leveragedGenesisParticipations: LeveragedRow[];
};

const VERSE_AGGREGATE_QUERY = `query VerseAggregates {
  verses(first: 1000, orderBy: verseId) {
    verseId name symbol stage flashGenesis uAsset memecoin pol yieldVault governor incentivizer
    endTime unlockTime omnichainIds communities registeredAtTimestamp
  }
  genesisParticipations(first: 1000) { verseId payer depositer amount }
  preorderParticipations(first: 1000) { verseId caller user amountInUAsset }
  leveragedGenesisParticipations(first: 1000) { verseId payer user amount }
  ${META_FRAGMENT}
}`;

type VersePageRow = VerseRow & {
  totalGenesisFunds?: string | null;
  totalLeveragedInterest?: string | null;
  totalPreorderFunds?: string | null;
  participantCount?: number | null;
};

type VersePageData = {
  verses: VersePageRow[];
  genesisParticipations: GenesisRow[];
  preorderParticipations: PreorderRow[];
  leveragedGenesisParticipations: LeveragedRow[];
};

/** Paged verse listing: only the requested window of verse rows is read (VersePageRows);
 * raised/participant totals come from the mapping-accumulated fields, so at any verse volume a
 * page costs ONE round trip. When the endpoint still serves a pre-totals version (null fields),
 * the page falls back to the verseId_in-scoped participation legs — never a full pull either
 * way. Sort key = verseId ascending (registration order); stage/mode/query ride the subgraph
 * where clause (query fans out to name/symbol substring matches). */

const VERSE_PAGE_SIZE_MAX = 100;

function versePageWhere(filter: VerseListFilter): Record<string, unknown> {
  const and: Record<string, unknown>[] = [];
  if (filter.stage) and.push({ stage: filter.stage });
  if (filter.flashGenesis !== undefined) and.push({ flashGenesis: filter.flashGenesis });
  const q = filter.query?.trim();
  if (q) and.push({ or: [{ name_contains_nocase: q }, { symbol_contains_nocase: q }] });
  if (and.length === 0) return {};
  if (and.length === 1) return and[0] as Record<string, unknown>;
  return { and };
}

function toSummaryView(
  chainId: number,
  verse: VersePageRow,
  sums?: { raised: VerseSummaryView['raised']; participantCount: number },
): VerseSummaryView {
  return {
    chainId,
    verseId: BigInt(verse.verseId),
    name: verse.name,
    symbol: verse.symbol,
    stage: verse.stage as VerseSummaryView['stage'],
    flashGenesis: verse.flashGenesis,
    uAsset: verse.uAsset,
    memecoin: verse.memecoin,
    pol: verse.pol,
    yieldVault: verse.yieldVault,
    governor: verse.governor,
    incentivizer: verse.incentivizer,
    endTime: BigInt(verse.endTime),
    unlockTime: BigInt(verse.unlockTime),
    omnichainIds: verse.omnichainIds.map((v) => BigInt(v)),
    communities: verse.communities,
    registeredAt: BigInt(verse.registeredAtTimestamp),
    raised: sums?.raised ?? {
      genesis: verse.totalGenesisFunds != null ? BigInt(verse.totalGenesisFunds) : 0n,
      leveraged: verse.totalLeveragedInterest != null ? BigInt(verse.totalLeveragedInterest) : 0n,
      preorder: verse.totalPreorderFunds != null ? BigInt(verse.totalPreorderFunds) : 0n,
    },
    participantCount: sums?.participantCount ?? verse.participantCount ?? 0,
  };
}

/** Stored-totals guard: a null means the endpoint serves a pre-totals version — the caller
 * must run the row-sum fallback (null is "unknown", never "zero raised"). */
function hasStoredTotals(verse: VersePageRow): boolean {
  return (
    verse.totalGenesisFunds != null &&
    verse.totalLeveragedInterest != null &&
    verse.totalPreorderFunds != null &&
    verse.participantCount != null
  );
}

function sumPageRows(
  verses: VersePageRow[],
  data: VersePageData,
): Map<string, { raised: VerseSummaryView['raised']; participantCount: number }> {
  const out = new Map<string, { raised: VerseSummaryView['raised']; participantCount: number }>();
  const sumBy = (rows: Array<Record<string, string>>, field: string) => {
    const map = new Map<string, bigint>();
    for (const row of rows) {
      const cur = map.get(row.verseId!) ?? 0n;
      map.set(row.verseId!, cur + BigInt(row[field]!));
    }
    return map;
  };
  const collectBy = (rows: Array<Record<string, string>>, field: string) => {
    const map = new Map<string, Set<string>>();
    for (const row of rows) {
      const cur = map.get(row.verseId!) ?? new Set<string>();
      cur.add(row[field]!);
      map.set(row.verseId!, cur);
    }
    return map;
  };
  const genesisSum = sumBy(
    data.genesisParticipations as unknown as Array<Record<string, string>>,
    'amount',
  );
  const preorderSum = sumBy(
    data.preorderParticipations as unknown as Array<Record<string, string>>,
    'amountInUAsset',
  );
  const leveragedSum = sumBy(
    data.leveragedGenesisParticipations as unknown as Array<Record<string, string>>,
    'amount',
  );
  const genesisAddr = collectBy(
    data.genesisParticipations as unknown as Array<Record<string, string>>,
    'depositer',
  );
  const preorderAddr = collectBy(
    data.preorderParticipations as unknown as Array<Record<string, string>>,
    'user',
  );
  const leveragedAddr = collectBy(
    data.leveragedGenesisParticipations as unknown as Array<Record<string, string>>,
    'user',
  );
  for (const verse of verses) {
    out.set(verse.verseId, {
      raised: {
        genesis: genesisSum.get(verse.verseId) ?? 0n,
        leveraged: leveragedSum.get(verse.verseId) ?? 0n,
        preorder: preorderSum.get(verse.verseId) ?? 0n,
      },
      participantCount: new Set([
        ...(genesisAddr.get(verse.verseId) ?? []),
        ...(preorderAddr.get(verse.verseId) ?? []),
        ...(leveragedAddr.get(verse.verseId) ?? []),
      ]).size,
    });
  }
  return out;
}

type CacheEntry = {
  /** when the settled value landed (0 = nothing fresh yet); TTL window starts here */
  at: number;
  /** last ok value — past TTL it serves immediately while a refresh runs */
  settled: DataResult<never> | null;
  /** in-flight fetch; null when idle. Non-null also dedups concurrent readers */
  inflight: Promise<DataResult<never>> | null;
};

export type VerseListFilter = {
  stage?: 'genesis' | 'refund' | 'locked' | 'unlocked';
  flashGenesis?: boolean;
  /** substring match on name or symbol (case-insensitive) */
  query?: string;
};

/** One page of verses from a single chain's subgraph. raised/participantCount prefer the
 * mapping-accumulated stored totals; when the deployment predates the totals fields, the
 * repository falls back to summing the page's own participation rows. */
export type VersePageView = {
  chainId: number;
  verses: VerseSummaryView[];
  /** true when more rows exist past this page */
  hasMore: boolean;
};

export interface GraphOnchainRepository {
  getVerseSummaries(chainId: number): Promise<DataResult<VerseSummaryView[]>>;
  getVerseDetail(chainId: number, verseId: bigint): Promise<DataResult<VerseSummaryView | null>>;
  getVersePage(
    chainId: number,
    filter: VerseListFilter,
    first: number,
    skip: number,
  ): Promise<DataResult<VersePageView>>;
  /** Raised sums + landed presence for an explicit verse set (powers the omni sidecar
   * without full pulls) */
  getRaisedSums(chainId: number, verseIds: readonly bigint[]): Promise<DataResult<VerseRaisedSums>>;
  getHomeMetrics(chainId: number): Promise<DataResult<HomeMetricsView>>;
  getParticipationHistory(
    chainId: number,
    address: string,
  ): Promise<DataResult<ParticipationHistoryView>>;
  getReferralHistory(chainId: number, referrer: string): Promise<DataResult<ReferralHistoryView>>;
  /** DAO tab sidecar: one cycle's finalized status (RPC has no view for it) and the governor's
   *  proposal counts. Cycle not yet indexed → finalized=false (the tab's own timing hides the
   *  finalize button until endTime anyway). */
  getGovernanceStatus(
    chainId: number,
    governor: string,
    incentivizer: string,
    cycleId: bigint,
  ): Promise<DataResult<{ finalized: boolean; proposalTotal: number; proposalActive: number }>>;
  /** Authoritative locked-at (settlement) timestamp for one verse, from the stage-change log.
   *  Null = not locked yet, chain not configured, or graph failure — the caller degrades,
   *  never fabricates. */
  getVerseLockedAt(chainId: number, verseId: bigint): Promise<number | null>;
  /** Live index head of one chain's subgraph (uncached `_meta` read) — the freshness gate
   * for post-write refreshes: the caller waits until this reaches the write's block. */
  getIndexedBlock(chainId: number): Promise<number | null>;
  /** Drop every verse-scoped cache entry (detail + detail-legs + raised-sums across all
   * chains) so the next read blocks on a fresh fetch. List/aggregate queries stay on their
   * TTL — a single verse's write must not flush whole-chain lists. */
  invalidateVerse(verseId: bigint): void;
}

type ConfigResolver = (chainId: number) => ResolvedChain;
type SafeBlockResolver = (chainId: number) => Promise<DataResult<number>>;

class GraphRepository implements GraphOnchainRepository {
  private cache = new Map<string, CacheEntry>();

  constructor(
    private readonly port: GraphPort,
    private readonly configFor: ConfigResolver = getChainConfig,
    private readonly safeBlockFor: SafeBlockResolver = (chainId) =>
      resolveDataSource().getSafeBlockNumber(chainId),
    // Graph list/aggregate TTL (verse summaries, home metrics): low churn, 60s.
    private readonly ttlMs = 60_000,
    private readonly now = () => Date.now(),
    /** cross-process seed namespace; null (tests) keeps the cache memory-only */
    private readonly persistNs: string | null = null,
  ) {}

  /**
   * Short-TTL cache + in-flight dedup + stale-while-revalidate (§9): keyed by
   * endpoint+document+variables. Within TTL the settled value returns as-is; past TTL the last
   * ok value is served IMMEDIATELY while the refresh runs in background — a lagging or slow
   * graph never blocks page render, and the staleness stays server-observed only (§24). A
   * failed refresh expires the entry but keeps the settled value, so the next call retries and
   * readers keep seeing the last good data instead of a cached failure.
   */
  private cached<T>(
    endpoint: string,
    document: string,
    variables: Record<string, unknown>,
    run: () => Promise<DataResult<T>>,
  ): Promise<DataResult<T>> {
    const key = endpoint + '|' + document + '|' + JSON.stringify(variables);
    let created = this.cache.get(key);
    if (created === undefined) {
      created = { at: 0, settled: null, inflight: null };
      // cold process: seed from the cross-process store so the first hit serves the last ok
      // value instantly (stale) instead of paying the network round trip
      if (this.persistNs) {
        const seed = readSeed<DataResult<never>>(this.persistNs, key);
        if (seed?.value && seed.value.status === 'ok') created.settled = seed.value;
      }
      this.cache.set(key, created);
    }
    const entry = created;
    const fresh = entry.at !== 0 && this.now() - entry.at < this.ttlMs;

    if (!fresh && entry.inflight === null) {
      const refreshing = run()
        .catch((e: unknown) =>
          unavailable<T>('rpc-error', e instanceof Error ? e.message : String(e)),
        )
        .then((value: DataResult<T>) => {
          entry.inflight = null;
          if (value.status === 'ok') {
            entry.at = this.now();
            entry.settled = value as DataResult<never>;
            if (this.persistNs) writeSeed(this.persistNs, key, entry.at, value);
          } else {
            entry.at = 0;
          }
          return value;
        });
      entry.inflight = refreshing as Promise<DataResult<never>>;
      if (entry.settled === null) return refreshing; // cold key: the first fetch blocks
    }

    if (!fresh && entry.settled !== null)
      return Promise.resolve(entry.settled) as Promise<DataResult<T>>;
    return (entry.inflight ?? entry.settled) as Promise<DataResult<T>>;
  }

  /**
   * Silent-degrade query runner (§9 + §24): reads the graph `_meta` block AND the RPC safe block
   * side by side, then DISCARDS the comparison — a lagging index returns its (slightly stale)
   * aggregates unchanged, with no marker field anywhere. An unreachable safe-block reader must
   * not take aggregates down with it either.
   */
  private async querySilently<T>(
    chainId: number,
    document: string,
    variables: Record<string, unknown>,
  ): Promise<DataResult<T>> {
    const resolved = this.configFor(chainId);
    if (resolved.status !== 'ok' || !resolved.config.subgraphEndpoint)
      return unavailable<T>('not-configured', `chain ${chainId} has no subgraph endpoint`);
    const endpoint = resolved.config.subgraphEndpoint;
    return this.cached<T>(endpoint, document, variables, async () => {
      const response = await this.port.query<T>(endpoint, document, variables);
      const safeBlock = await this.safeBlockFor(chainId).catch(() => null);
      // §24: index lag is server-observed only — no user-visible state, ever
      if (safeBlock !== null && safeBlock.status === 'ok') {
        console.debug(
          `[graph] chain ${chainId} index at ${response.meta.block.number}, safe block ${safeBlock.data} (silent degrade, §9/§24)`,
        );
      }
      return ok<T>(response.data);
    });
  }

  async getVerseSummaries(chainId: number): Promise<DataResult<VerseSummaryView[]>> {
    const r = await this.querySilently<VerseAggregateData>(chainId, VERSE_AGGREGATE_QUERY, {});
    if (r.status !== 'ok') return r;
    const d = r.data;
    const sumBy = (rows: Array<Record<string, string>>, field: string) => {
      const map = new Map<string, bigint>();
      for (const row of rows) {
        const cur = map.get(row.verseId!) ?? 0n;
        map.set(row.verseId!, cur + BigInt(row[field]!));
      }
      return map;
    };
    const addressesBy = (rows: Array<Record<string, string>>, field: string) => {
      const map = new Map<string, Set<string>>();
      for (const row of rows) {
        const cur = map.get(row.verseId!) ?? new Set<string>();
        cur.add(row[field]!);
        map.set(row.verseId!, cur);
      }
      return map;
    };
    const genesisSum = sumBy(
      d.genesisParticipations as unknown as Array<Record<string, string>>,
      'amount',
    );
    const preorderSum = sumBy(
      d.preorderParticipations as unknown as Array<Record<string, string>>,
      'amountInUAsset',
    );
    const leveragedSum = sumBy(
      d.leveragedGenesisParticipations as unknown as Array<Record<string, string>>,
      'amount',
    );
    const genesisAddr = addressesBy(
      d.genesisParticipations as unknown as Array<Record<string, string>>,
      'depositer',
    );
    const preorderAddr = addressesBy(
      d.preorderParticipations as unknown as Array<Record<string, string>>,
      'user',
    );
    return ok(
      d.verses.map<VerseSummaryView>((verse) => ({
        chainId,
        verseId: BigInt(verse.verseId),
        name: verse.name,
        symbol: verse.symbol,
        stage: verse.stage as VerseSummaryView['stage'],
        flashGenesis: verse.flashGenesis,
        uAsset: verse.uAsset,
        memecoin: verse.memecoin,
        pol: verse.pol,
        yieldVault: verse.yieldVault,
        governor: verse.governor,
        incentivizer: verse.incentivizer,
        endTime: BigInt(verse.endTime),
        unlockTime: BigInt(verse.unlockTime),
        omnichainIds: verse.omnichainIds.map((v) => BigInt(v)),
        communities: verse.communities,
        registeredAt: BigInt(verse.registeredAtTimestamp),
        raised: {
          genesis: genesisSum.get(verse.verseId) ?? 0n,
          leveraged: leveragedSum.get(verse.verseId) ?? 0n,
          preorder: preorderSum.get(verse.verseId) ?? 0n,
        },
        participantCount: new Set([
          ...(genesisAddr.get(verse.verseId) ?? []),
          ...(preorderAddr.get(verse.verseId) ?? []),
        ]).size,
      })),
    );
  }

  async getVerseDetail(
    chainId: number,
    verseId: bigint,
  ): Promise<DataResult<VerseSummaryView | null>> {
    // Point read: one verse row by id (stored totals included) — never the full list. A
    // pre-totals endpoint falls back to the verseId_in-scoped legs for this one id.
    const r = await this.querySilently<{ verses: VersePageRow[] }>(
      chainId,
      `query VerseDetail($id: BigInt!) {
        verses(first: 1, where: { verseId: $id }) {
          verseId name symbol stage flashGenesis uAsset memecoin pol yieldVault governor incentivizer
          endTime unlockTime omnichainIds communities registeredAtTimestamp
          totalGenesisFunds totalLeveragedInterest totalPreorderFunds participantCount
        }
        ${META_FRAGMENT}
      }`,
      { id: String(verseId) },
    );
    if (r.status !== 'ok') return r;
    const verse = r.data.verses[0];
    if (!verse) return ok(null);
    if (hasStoredTotals(verse)) return ok(toSummaryView(chainId, verse));
    const legs = await this.querySilently<Omit<VersePageData, 'verses'>>(
      chainId,
      `query VerseDetailLegs($ids: [BigInt!]) {
        genesisParticipations(first: 1000, where: { verseId_in: $ids }) { verseId payer depositer amount }
        preorderParticipations(first: 1000, where: { verseId_in: $ids }) { verseId caller user amountInUAsset }
        leveragedGenesisParticipations(first: 1000, where: { verseId_in: $ids }) { verseId payer user amount }
        ${META_FRAGMENT}
      }`,
      { ids: [verse.verseId] },
    );
    if (legs.status !== 'ok') return legs;
    const sums = sumPageRows([verse], { verses: [verse], ...legs.data });
    return ok(toSummaryView(chainId, verse, sums.get(verse.verseId)));
  }

  async getVersePage(
    chainId: number,
    filter: VerseListFilter,
    first: number,
    skip: number,
  ): Promise<DataResult<VersePageView>> {
    const size = Math.max(
      1,
      Math.min(Math.floor(first) || VERSE_PAGE_SIZE_MAX, VERSE_PAGE_SIZE_MAX),
    );
    const offset = Math.max(0, Math.floor(skip) || 0);
    const where = versePageWhere(filter);
    // verse window first; stored totals ride the same document, so a fully-indexed endpoint
    // answers a page in ONE round trip. Only rows without totals (pre-totals version) need the
    // verseId_in-scoped legs — never a full pull either way.
    const rows = await this.querySilently<{ verses: VersePageRow[] }>(
      chainId,
      `query VersePageRows($where: Verse_filter, $first: Int!, $skip: Int!) {
        verses(first: $first, skip: $skip, orderBy: verseId, orderDirection: asc, where: $where) {
          verseId name symbol stage flashGenesis uAsset memecoin pol yieldVault governor incentivizer
          endTime unlockTime omnichainIds communities registeredAtTimestamp
          totalGenesisFunds totalLeveragedInterest totalPreorderFunds participantCount
        }
        ${META_FRAGMENT}
      }`,
      { where, first: size + 1, skip: offset },
    );
    if (rows.status !== 'ok') return rows;
    const window = rows.data.verses;
    const hasMore = window.length > size;
    const page = hasMore ? window.slice(0, size) : window;
    if (page.length === 0) return ok({ chainId, verses: [], hasMore: false });
    const missing = page.filter((verse) => !hasStoredTotals(verse));
    let sums = new Map<string, { raised: VerseSummaryView['raised']; participantCount: number }>();
    if (missing.length > 0) {
      const ids = missing.map((verse) => verse.verseId);
      const legs = await this.querySilently<Omit<VersePageData, 'verses'>>(
        chainId,
        `query VersePageLegs($ids: [BigInt!]) {
          genesisParticipations(first: 1000, where: { verseId_in: $ids }) { verseId payer depositer amount }
          preorderParticipations(first: 1000, where: { verseId_in: $ids }) { verseId caller user amountInUAsset }
          leveragedGenesisParticipations(first: 1000, where: { verseId_in: $ids }) { verseId payer user amount }
          ${META_FRAGMENT}
        }`,
        { ids },
      );
      if (legs.status !== 'ok') return legs;
      sums = sumPageRows(missing, { verses: missing, ...legs.data });
    }
    const verses = page.map((verse) => toSummaryView(chainId, verse, sums.get(verse.verseId)));
    return ok({ chainId, verses, hasMore });
  }

  async getRaisedSums(
    chainId: number,
    verseIds: readonly bigint[],
  ): Promise<DataResult<VerseRaisedSums>> {
    if (verseIds.length === 0) return ok({ sums: new Map(), present: new Set() });
    const ids = [...new Set(verseIds.map(String))];
    // Stored totals ride the verses selection (presence + sums in one round trip); rows from a
    // pre-totals version fall back to the verseId_in-scoped legs below.
    const r = await this.querySilently<{
      verses: Array<
        Pick<
          VersePageRow,
          'verseId' | 'totalGenesisFunds' | 'totalLeveragedInterest' | 'totalPreorderFunds'
        >
      >;
      genesisParticipations: GenesisRow[];
      preorderParticipations: PreorderRow[];
      leveragedGenesisParticipations: LeveragedRow[];
    }>(
      chainId,
      `query VerseRaisedSums($ids: [BigInt!]) {
        verses(first: 1000, where: { verseId_in: $ids }) {
          verseId totalGenesisFunds totalLeveragedInterest totalPreorderFunds
        }
        genesisParticipations(first: 1000, where: { verseId_in: $ids }) { verseId payer depositer amount }
        preorderParticipations(first: 1000, where: { verseId_in: $ids }) { verseId caller user amountInUAsset }
        leveragedGenesisParticipations(first: 1000, where: { verseId_in: $ids }) { verseId payer user amount }
        ${META_FRAGMENT}
      }`,
      { ids },
    );
    if (r.status !== 'ok') return r;
    const sums = new Map(
      r.data.verses
        .filter(
          (verse) =>
            verse.totalGenesisFunds != null &&
            verse.totalLeveragedInterest != null &&
            verse.totalPreorderFunds != null,
        )
        .map((verse) => [
          verse.verseId,
          {
            genesis: BigInt(verse.totalGenesisFunds as string),
            leveraged: BigInt(verse.totalLeveragedInterest as string),
            preorder: BigInt(verse.totalPreorderFunds as string),
          } satisfies VerseSummaryView['raised'],
        ]),
    );
    const missing = r.data.verses.filter((verse) => !sums.has(verse.verseId));
    if (missing.length > 0) {
      const sumsByLegs = sumPageRows(
        missing.map((verse) => ({ verseId: verse.verseId }) as VersePageRow),
        {
          verses: [],
          genesisParticipations: r.data.genesisParticipations,
          preorderParticipations: r.data.preorderParticipations,
          leveragedGenesisParticipations: r.data.leveragedGenesisParticipations,
        },
      );
      for (const [id, entry] of sumsByLegs) sums.set(id, entry.raised);
    }
    return ok({
      sums,
      present: new Set(r.data.verses.map((verse) => verse.verseId)),
    });
  }

  async getHomeMetrics(chainId: number): Promise<DataResult<HomeMetricsView>> {
    // Chain-wide totals come from the single ProtocolStats row the mappings maintain — O(1),
    // independent of verse/participation volume. An endpoint without the row (pre-stats
    // version) degrades to the bounded aggregate read below.
    const statsResult = await this.querySilently<{
      protocolStats: {
        verseCount: number;
        deployedVerseCount: number;
        participantCount: number;
        participationTotal: string;
      } | null;
    }>(
      chainId,
      `query HomeMetrics($id: ID!) {
        protocolStats(id: $id) {
          verseCount deployedVerseCount participantCount participationTotal
        }
        ${META_FRAGMENT}
      }`,
      { id: `${chainId}-protocol` },
    );
    const stats =
      statsResult.status === 'ok' ? (statsResult.data.protocolStats ?? undefined) : undefined;
    if (stats) {
      return ok({
        verseCount: stats.verseCount,
        deployedVerseCount: stats.deployedVerseCount,
        participantCount: stats.participantCount,
        participationTotal: BigInt(stats.participationTotal),
      });
    }
    const r = await this.querySilently<VerseAggregateData>(chainId, VERSE_AGGREGATE_QUERY, {});
    if (r.status !== 'ok') return r;
    const d = r.data;
    const total =
      d.genesisParticipations.reduce((sum, row) => sum + BigInt(row.amount), 0n) +
      d.leveragedGenesisParticipations.reduce((sum, row) => sum + BigInt(row.amount), 0n) +
      d.preorderParticipations.reduce((sum, row) => sum + BigInt(row.amountInUAsset), 0n);
    const addresses = new Set<string>([
      ...d.genesisParticipations.map((row) => row.depositer),
      ...d.preorderParticipations.map((row) => row.user),
      ...d.leveragedGenesisParticipations.map((row) => row.user),
    ]);
    return ok({
      verseCount: d.verses.length,
      deployedVerseCount: d.verses.filter((v) => v.stage === 'locked' || v.stage === 'unlocked')
        .length,
      participantCount: addresses.size,
      participationTotal: total,
    });
  }

  async getParticipationHistory(
    chainId: number,
    address: string,
  ): Promise<DataResult<ParticipationHistoryView>> {
    const r = await this.querySilently<{
      genesisParticipations: Array<GenesisRow & { blockTimestamp: string }>;
      preorderParticipations: Array<PreorderRow & { blockTimestamp: string }>;
      leveragedGenesisParticipations: Array<LeveragedRow & { blockTimestamp: string }>;
      participationClaims: Array<{
        verseId: string;
        kind: string;
        receiver: string;
        blockTimestamp: string;
      }>;
    }>(
      chainId,
      `query ParticipationHistory($address: Bytes!) {
        genesisParticipations(first: 1000, where: { depositer: $address }) { verseId payer depositer amount blockTimestamp }
        preorderParticipations(first: 1000, where: { user: $address }) { verseId caller user amountInUAsset blockTimestamp }
        leveragedGenesisParticipations(first: 1000, where: { user: $address }) { verseId payer user amount blockTimestamp }
        participationClaims(first: 1000, where: { receiver: $address }) { verseId kind receiver blockTimestamp }
        ${META_FRAGMENT}
      }`,
      { address },
    );
    if (r.status !== 'ok') return r;
    const d = r.data;
    return ok({
      chainId,
      genesis: d.genesisParticipations.map((row) => ({
        verseId: BigInt(row.verseId),
        payer: row.payer,
        depositer: row.depositer,
        amount: BigInt(row.amount),
        at: BigInt(row.blockTimestamp),
      })),
      preorder: d.preorderParticipations.map((row) => ({
        verseId: BigInt(row.verseId),
        caller: row.caller,
        user: row.user,
        amount: BigInt(row.amountInUAsset),
        at: BigInt(row.blockTimestamp),
      })),
      leveraged: d.leveragedGenesisParticipations.map((row) => ({
        verseId: BigInt(row.verseId),
        payer: row.payer,
        user: row.user,
        amount: BigInt(row.amount),
        at: BigInt(row.blockTimestamp),
      })),
      claims: d.participationClaims.map((row) => ({
        verseId: BigInt(row.verseId),
        kind: row.kind,
        receiver: row.receiver,
        at: BigInt(row.blockTimestamp),
      })),
    });
  }

  async getReferralHistory(
    chainId: number,
    referrer: string,
  ): Promise<DataResult<ReferralHistoryView>> {
    const r = await this.querySilently<{
      referralRebates: Array<{
        kind: string;
        currency: string;
        amount: string;
        blockTimestamp: string;
      }>;
    }>(
      chainId,
      `query ReferralHistory($referrer: Bytes!) {
        referralRebates(first: 1000, where: { referrer: $referrer }) { kind currency amount blockTimestamp }
        ${META_FRAGMENT}
      }`,
      { referrer },
    );
    if (r.status !== 'ok') return r;
    const d = r.data;
    const map = (kind: string) =>
      d.referralRebates
        .filter((row) => row.kind === kind)
        .map((row) => ({
          currency: row.currency,
          amount: BigInt(row.amount),
          at: BigInt(row.blockTimestamp),
        }));
    return ok({
      chainId,
      accrued: map('accrued'),
      claimed: map('claimed'),
    });
  }

  async getGovernanceStatus(
    chainId: number,
    governor: string,
    incentivizer: string,
    cycleId: bigint,
  ): Promise<DataResult<{ finalized: boolean; proposalTotal: number; proposalActive: number }>> {
    const r = await this.querySilently<{
      governanceCycles: Array<{ status: string }>;
      governanceProposals: Array<{ status: string }>;
    }>(
      chainId,
      `query GovernanceStatus($incentivizer: Bytes!, $cycleId: BigInt!, $governor: Bytes!) {
        governanceCycles(first: 1, where: { incentivizer: $incentivizer, cycleId: $cycleId }) { status }
        governanceProposals(first: 1000, where: { governor: $governor }) { status }
        ${META_FRAGMENT}
      }`,
      { incentivizer, cycleId: String(cycleId), governor },
    );
    if (r.status !== 'ok') return r;
    return ok({
      finalized: r.data.governanceCycles[0]?.status === 'finalized',
      proposalTotal: r.data.governanceProposals.length,
      proposalActive: r.data.governanceProposals.filter((row) => row.status === 'active').length,
    });
  }

  async getVerseLockedAt(chainId: number, verseId: bigint): Promise<number | null> {
    try {
      const r = await this.querySilently<{ verseStageChanges: Array<{ blockTimestamp: string }> }>(
        chainId,
        'query VerseLockedAt($id: BigInt!) { verseStageChanges(where: { verseId: $id, stage: "locked" }, orderBy: blockTimestamp, orderDirection: desc, first: 1) { blockTimestamp } }',
        { id: verseId.toString() },
      );
      if (r.status !== 'ok') return null;
      const ts = Number(r.data.verseStageChanges[0]?.blockTimestamp);
      return Number.isFinite(ts) && ts > 0 ? ts : null;
    } catch {
      return null;
    }
  }

  async getIndexedBlock(chainId: number): Promise<number | null> {
    const resolved = this.configFor(chainId);
    if (resolved.status !== 'ok' || !resolved.config.subgraphEndpoint) return null;
    try {
      // The port hoists the query's `_meta` block into the top-level response meta.
      const response = await this.port.query<unknown>(
        resolved.config.subgraphEndpoint,
        '_meta { block { number } }',
      );
      const block = Number(response.meta?.block?.number);
      return Number.isFinite(block) ? block : null;
    } catch {
      return null;
    }
  }

  invalidateVerse(verseId: bigint): void {
    const id = String(verseId);
    for (const key of this.cache.keys()) {
      // Key layout is endpoint|document|variables; only verse-scoped documents carry the id
      // in their variables — list/aggregate queries keep their TTL.
      const sep = key.indexOf('|');
      const sep2 = key.indexOf('|', sep + 1);
      if (sep < 0 || sep2 < 0) continue;
      const document = key.slice(sep + 1, sep2);
      const variablesText = key.slice(sep2 + 1);
      const isVerseDoc =
        document.startsWith('query VerseDetail(') || document.startsWith('query VerseDetailLegs(');
      const isSumsDoc = document.startsWith('query VerseRaisedSums(');
      if (!isVerseDoc && !isSumsDoc) continue;
      let matches = false;
      try {
        const variables = JSON.parse(variablesText) as { id?: string; ids?: string[] };
        if (isVerseDoc) matches = variables.id === id;
        else matches = Array.isArray(variables.ids) && variables.ids.includes(id);
      } catch {
        matches = false;
      }
      if (!matches) continue;
      // Deleting the Map key detaches any in-flight refresh: its settle writes the detached
      // entry and cannot resurrect the key, so the next read is a cold blocking fetch.
      this.cache.delete(key);
      if (this.persistNs) deleteSeed(this.persistNs, key);
    }
  }
}

let cachedRepo: GraphOnchainRepository | null = null;

export function getGraphRepository(): GraphOnchainRepository {
  // 'graph' namespace: settled values seed across render-worker processes and restarts
  return (cachedRepo ??= new GraphRepository(
    createHttpGraphPort(),
    undefined,
    undefined,
    undefined,
    undefined,
    'graph',
  ));
}

/** Test seam: build with injected port/config/safe-block resolvers (no env dependence) */
export function buildGraphRepository(
  port: GraphPort,
  configFor?: ConfigResolver,
  safeBlockFor?: SafeBlockResolver,
  ttlMs?: number,
  now?: () => number,
  persistNs?: string | null,
): GraphOnchainRepository {
  return new GraphRepository(port, configFor, safeBlockFor, ttlMs, now, persistNs ?? null);
}

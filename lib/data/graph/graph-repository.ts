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
import { readSeed, writeSeed } from '../persisted-swr';

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

type CacheEntry = {
  /** when the settled value landed (0 = nothing fresh yet); TTL window starts here */
  at: number;
  /** last ok value — past TTL it serves immediately while a refresh runs */
  settled: DataResult<never> | null;
  /** in-flight fetch; null when idle. Non-null also dedups concurrent readers */
  inflight: Promise<DataResult<never>> | null;
};

export interface GraphOnchainRepository {
  getVerseSummaries(chainId: number): Promise<DataResult<VerseSummaryView[]>>;
  getVerseDetail(chainId: number, verseId: bigint): Promise<DataResult<VerseSummaryView | null>>;
  getHomeMetrics(chainId: number): Promise<DataResult<HomeMetricsView>>;
  getParticipationHistory(
    chainId: number,
    address: string,
  ): Promise<DataResult<ParticipationHistoryView>>;
  getReferralHistory(chainId: number, referrer: string): Promise<DataResult<ReferralHistoryView>>;
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
    private readonly ttlMs = 15_000,
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
    const list = await this.getVerseSummaries(chainId);
    if (list.status !== 'ok') return list;
    return ok(list.data.find((verse) => verse.verseId === verseId) ?? null);
  }

  async getHomeMetrics(chainId: number): Promise<DataResult<HomeMetricsView>> {
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

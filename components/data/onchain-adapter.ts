// Onchain data adapter — the OUTRUN_DATA_SOURCE=onchain build-time alias target of
// '@/lib/data/fixture-repository' (next.config.ts resolveAlias; fixture-boundary-contract
// OUTRUN_DATA_SOURCE section). It lives in components/ on purpose: that is the sanctioned zone
// allowed to reference the fixture repository (TYPE-ONLY imports — never runtime values), so the
// shared ViewModel shapes stay single-sourced while the onchain build statically swaps every
// runtime getter to real RPC/Graph data. Two-build rule: the fixture build resolves the real
// fixture repository and renders the stage-3 baseline byte-identically.
//
// Degrade discipline: fields without an on-chain source render nothing (null/empty), never
// fixture samples and never zero-addresses; sections with zero rows collapse by their existing
// contracts (e.g. pending-referral area unmounts on zero rows). The faucet cooldown slot is null
// by the 2026-10-14 user ruling (no on-chain source; claimable set comes from claim() probes).
import type {
  FixtureAsset,
  FixtureCreateConfig,
  FixtureFaucet,
  FixtureGovernanceState,
  FixtureParticipation,
  FixtureParticipationOptions,
  FixtureParticipationRow,
  FixturePolPosition,
  FixturePortfolioAction,
  FixturePsmPair,
  FixtureReferral,
  FixtureStaking,
  FixtureUsrSavings,
  FixtureVaultRow,
  FixtureVerse,
  FixtureVerseTrade,
  FixtureWalletAsset,
} from '@/lib/data/fixture-repository';
import type { DataResult } from '@/lib/data/repository';
import { getOnchainRepository } from '@/lib/data/repository';
import { getGraphRepository } from '@/lib/data/graph/graph-repository';
import type { VerseSummaryView } from '@/lib/data/graph/graph-repository';
import { readSeed, writeSeed } from '@/lib/data/persisted-swr';
import { CHAIN_IDS, MAINNET_CHAIN_IDS, resolveOutrunChain } from '@/lib/web3/chains';
import type { FixtureChain } from '@/lib/data/types';

// 24h liquidity protection window — single source in lib/data/types (client-safe)
export { PROTECTION_WINDOW_MS } from '@/lib/data/types';

const rpc = () => getOnchainRepository();
const graph = () => getGraphRepository();
const TESTNETS = [421614, 84532, 97];
const REGISTRATION_HUB = 97;
const E18 = 1e18;
const iso = (seconds: bigint) => new Date(Number(seconds) * 1000).toISOString();

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

function cachedConfig<T>(key: string, run: () => Promise<T | null>): Promise<T | null> {
  let created = configCache.get(key);
  if (created === undefined) {
    created = { at: 0, value: undefined, inflight: null };
    // cold render-worker process: seed the last ok value from disk (null seeds are skipped —
    // a degraded read must not stick across restarts)
    const seed = readSeed<T | null>('adapter-config', key);
    if (seed?.value != null) created.value = seed.value;
    configCache.set(key, created);
  }
  const entry = created;
  const fresh = entry.at !== 0 && Date.now() - entry.at < CONFIG_TTL_MS;
  if (!fresh && entry.inflight === null) {
    entry.inflight = run().then(
      (value) => {
        entry.inflight = null;
        entry.value = value;
        entry.at = value == null ? 0 : Date.now();
        if (value != null) writeSeed('adapter-config', key, entry.at, value);
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

/** uAsset address -> symbol via the deployment contract tables (UAsset.<SYM> keys) */
function uAssetSymbol(address: string): string {
  for (const chainId of TESTNETS) {
    const resolved = resolveOutrunChain(chainId);
    if (resolved.status !== 'ok' || resolved.config.contracts.status !== 'deployed') continue;
    for (const [key, addr] of Object.entries(resolved.config.contracts.addresses)) {
      if (key.startsWith('UAsset.') && addr.toLowerCase() === address.toLowerCase()) {
        return key.slice('UAsset.'.length);
      }
    }
  }
  return 'UUSD';
}

function deployedContracts(chainId: number): Record<string, string> {
  const resolved = resolveOutrunChain(chainId);
  return resolved.status === 'ok' && resolved.config.contracts.status === 'deployed'
    ? resolved.config.contracts.addresses
    : {};
}

/** Raise-asset whitelist from the deployment tables (UAsset.<SYM> per chain, deduped) — the
 * create page's fund-type dropdown and submit gate (assets.length===0) stay alive onchain */
function deployedAssets(): FixtureAsset[] {
  const bySymbol = new Map<string, FixtureAsset>();
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

/** Build one chain-scoped row from a single chain's subgraph view. Raised/progress/participants
 * are that chain's own local genesis state — each chain settles its own genesis independently,
 * so these are never summed across chains. */
function toFixtureVerse(view: VerseSummaryView): FixtureVerse {
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
    createdAt: iso(view.registeredAt),
    participantCount: view.participantCount,
    description: null,
    socials: [],
    projectedMarketCap: null,
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

// --- shared snapshot (home + explore + every page shell) -------------------------------

// Graph views behind the last snapshot build, keyed by verse id — the detail getter needs the
// raw view (chainId/uAsset/verseId) to run the RPC financial overlay below
let snapshotViews = new Map<string, VerseSummaryView>();

/** Canonical view of one verse: the governance chain's (omnichainIds[0]) copy carries the
 * registration truth (stage/endtime/omnichain ids). Falls back to the first copy when the
 * governance chain's subgraph has no record of the verse. */
function canonicalViewOf(group: VerseSummaryView[]): VerseSummaryView {
  const governanceChain = Number(group[0]!.omnichainIds[0] ?? REGISTRATION_HUB);
  return group.find((view) => view.chainId === governanceChain) ?? group[0]!;
}

export type ChainVersePage = {
  rows: FixtureVerse[];
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
  rows: FixtureVerse[];
  canonical: FixtureVerse[];
  chainIds: number[];
  views: Map<string, VerseSummaryView>;
}> {
  // three per-chain subgraph round trips are independent — fan out instead of serializing
  const results = await Promise.all(TESTNETS.map((chainId) => graph().getVerseSummaries(chainId)));
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
  const rows: FixtureVerse[] = [];
  const canonical: FixtureVerse[] = [];
  const views = new Map<string, VerseSummaryView>();
  for (const [id, group] of byVerseId) {
    const canonicalView = canonicalViewOf(group);
    views.set(id, canonicalView);
    const omniRaised =
      group.reduce(
        (sum, view) =>
          sum + Number(view.raised.genesis + view.raised.leveraged + view.raised.preorder) / E18,
        0,
      );
    const omniParticipantCount = group.reduce((sum, view) => sum + view.participantCount, 0);
    let canonicalRow: FixtureVerse | null = null;
    for (const view of group) {
      const row = { ...toFixtureVerse(view), omniRaised, omniParticipantCount };
      rows.push(row);
      if (view === canonicalView) canonicalRow = row;
    }
    canonical.push(canonicalRow ?? toFixtureVerse(canonicalView));
  }
  snapshotViews = views;
  return {
    rows,
    canonical,
    chainIds: [...new Set(rows.map((row) => row.chainId))].sort((a, b) => a - b),
    views,
  };
}

export async function getFixtureSnapshot() {
  const { canonical } = await buildChainRows();
  // The snapshot keeps one row per verse (governance-chain canonical) so every existing
  // consumer — home metrics, detail page, portfolio lookups — is untouched; the discovery
  // browser reads the full chain-scoped rows via getFixtureChainVerses directly
  const verses = canonical;
  const deployedVerseCount = verses.filter((v) => v.stage === 'locked' || v.stage === 'unlocked').length;
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
    sampleAccount: { address: '', sourceRef: 'onchain:wallet' },
  };
}

/** Chain-scoped verse rows: one row per (verse, registered chain), each row carrying that
 * chain's own local genesis state. The discovery browser filters rows by the selected chain —
 * no 'all chains' merged view exists because each chain settles its own genesis independently.
 * A chain whose subgraph failed simply contributes no rows. */
export async function getFixtureChainVerses(): Promise<FixtureVerse[]> {
  return (await buildChainRows()).rows;
}

/** Chain ids that have at least one indexed verse — the discovery chain filter's option set */
export async function getFixtureVerseChainIds(): Promise<number[]> {
  return (await buildChainRows()).chainIds;
}

/** One discovery page on one chain: the paged subgraph read keeps server memory and the RSC
 * payload bounded at any verse volume; the omni sidecar sums only the page's verses. */
export async function getFixtureChainVersePage(
  chainId: number,
  filter: { stage?: 'genesis' | 'refund' | 'locked' | 'unlocked'; fastGenesis?: boolean; query?: string },
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
  // Omni sidecar: the page verses' sums on every sibling chain (bounded: one verseId_in query
  // per sibling, only for the page's ids)
  const siblings = await Promise.all(
    TESTNETS.filter((id) => id !== chainId).map(async (sibling) =>
      unwrap(await graph().getRaisedSums(sibling, verseIds)),
    ),
  );
  const rows = list.verses.map((view) => {
    const own = Number(view.raised.genesis + view.raised.leveraged + view.raised.preorder) / E18;
    const omniRaised =
      own +
      siblings.reduce((sum, sums) => {
        const raised = sums?.get(String(view.verseId));
        return (
          sum +
          (raised
            ? Number(raised.genesis + raised.leveraged + raised.preorder) / E18
            : 0)
        );
      }, 0);
    return { ...toFixtureVerse(view), omniRaised, omniParticipantCount: view.participantCount };
  });
  // TESTNETS membership is static config: the option set is the deployed testnets, not a second
  // subgraph pull. A verse-less chain still offers its filter (empty page, not a missing option).
  return { rows, total: skip + rows.length + (list.hasMore ? 1 : 0), hasMore: list.hasMore, chainIds: [...TESTNETS] };
}

export async function getFixtureVerse(verseId: string): Promise<FixtureVerse | null> {
  const match = /^(?:verse-)?(\d+)$/i.exec(verseId);
  if (!match) return null;
  // uint256 ids exceed Number precision — compare normalized decimal strings
  const digits = match[1].replace(/^0+(?=\d)/, '');
  const snapshot = await getFixtureSnapshot();
  const verse =
    snapshot.verses.find((verse) => verse.id.replace(/^0+(?=\d)/, '') === digits) ?? null;
  const view = verse ? (snapshotViews.get(verse.id) ?? null) : null;
  if (!verse || !view) return verse;
  // Genesis financial params (preorder ratio / leverage rate+cap / min success) have on-chain
  // getters but no subgraph field — detail-only RPC overlay so the fixture-mode constraint UI
  // (preorder capacity meter, real-time preorder cap, leverage preview, success threshold)
  // survives the onchain build; config-like reads ride the SWR cache (§9); a failed read
  // leaves the null slots exactly as before (never fixture samples)
  const fin = await cachedConfig(`verse-fin-${view.chainId}-${view.verseId}`, async () => {
    const r = unwrap(await rpc().getVerseFinancials(view.chainId, view.verseId, view.uAsset));
    if (!r) return null;
    const next = {
      minSuccessThreshold: Number(r.minTotalFund) / E18,
      // interest rate is 1e18-scaled ratio, cap ratio is bps — fixture units are plain ratios
      leverageInterestRate: Number(r.interestRate) / E18,
      leverageDebtCap: Number(r.debtCap) / E18,
      preorderCapacityRatio: Number(r.preorderCapRatioBps) / 1e4,
    };
    // Parse, don't assert: a decode-shape drift upstream yields undefined -> NaN here; gate
    // at the conversion point so a malformed read degrades to the null slots (and a null
    // result is never written to the disk seed) instead of leaking NaN into the UI
    return Object.values(next).every(Number.isFinite) ? next : null;
  });
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

// --- chains / registration --------------------------------------------------------------

export async function getFixtureChains(): Promise<FixtureChain[]> {
  return CHAIN_IDS.map((chainId) => {
    const resolved = resolveOutrunChain(chainId);
    const config = resolved.status === 'ok' ? resolved.config : null;
    return {
      chainId,
      name: config?.viemChain.name ?? String(chainId),
      env: (MAINNET_CHAIN_IDS as readonly number[]).includes(chainId) ? ('mainnet' as const) : ('testnet' as const),
      nativeSymbol: config?.viemChain.nativeCurrency.symbol ?? '',
      sourceRef: 'lib/web3/chains.ts',
    };
  });
}

export async function getFixtureCreateConfig(): Promise<FixtureCreateConfig | null> {
  return cachedConfig('create-config', async () => {
    const preview = unwrap(await rpc().getRegistrationPreview('PROBE'));
    if (!preview) return null;
    return {
      minDurationDays: preview.minDurationDays,
      maxDurationDays: preview.maxDurationDays,
      lockupDays: preview.lockupDays,
      // cross-chain fee quotes need the registration calldata (stage-6 tx pipeline); slots quote at submit
      remoteDeployFee: 0,
      remoteSendFee: 0,
      sourceRef: `rpc:${preview.hubChainId}:MemeverseRegistrationCenter`,
    };
  });
}

export async function getFixtureOccupiedSymbols(): Promise<string[]> {
  return [];
}

export async function getFixtureParticipationOptions(
  raiseAssetSymbol: string,
): Promise<FixtureParticipationOptions> {
  // Deployment-table wired: the raise uAsset's paired GenesisCredit (leverage-credit direct
  // pay) and its PSM pair reserve (face-value direct swap). Stake sources stay empty until the
  // OutStake adapter registry is wired (cross-repo) — the route stays hidden, never faked.
  const creditAsset = contractAsset(`GenesisCredit.${raiseAssetSymbol}`);
  const reserve = await psmReserveAsset(raiseAssetSymbol);
  return {
    raiseAsset: { id: `uasset:${raiseAssetSymbol}`, sourceRef: 'lib/web3/chains.ts', symbol: raiseAssetSymbol },
    reserves: reserve ? [reserve] : [],
    yieldSourceRegistry: [],
    creditAsset,
  };
}

function contractAsset(key: string): FixtureAsset | null {
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

async function psmReserveAsset(uAssetSymbol: string): Promise<FixtureAsset | null> {
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
        sourceRef: `rpc:${chainId}:OutrunPSM.${uAssetSymbol}`,
        // PSM mint-side fee (tin): 18-dec point value (1e18 = 100%) — the same read the faucet
        // Fee row uses; the face-value direct path deducts it before uAsset is minted.
        psmFeeIn: Number(state.tinWad) / E18,
      };
    }
  }
  return null;
}

// --- faucet (R-07, real RPC data) ---------------------------------------------------------

// 2026-10-21 ruling: personal values never ride the SSR path — account-scoped reads
// (balances, claim probes) moved client-side (FaucetSwapDialog reads PSM balances through the
// wallet provider; FaucetClaims already probes claim()). The server keeps only the accountless
// config read (limits/fees/headroom), fully SWR-cached (§9).
export async function getFixtureFaucet(): Promise<FixtureFaucet | null> {
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
        // per-user cooldown has no on-chain getter/event — 2026-10-14 ruling: slot not rendered
        cooldownRemainingMs: null,
      })),
      swap: {
        uAssetSymbol: uAssetSymbol(status.swap.uAsset),
        reserveSymbol: 'USDC',
        // PSM tin/tout are 18-dec point values (1e18 = 100%), not bps
        feeIn: Number(status.swap.tinWad) / E18,
        feeOut: Number(status.swap.toutWad) / E18,
        headroom: Number(status.swap.headroom) / E18,
        // accountless read: always null→0 here; the connected wallet reads real balances
        // client-side (2026-10-21 ruling — see the section comment above)
        myUAsset: status.swap.myUAsset != null ? Number(status.swap.myUAsset) / E18 : 0,
        myReserve: status.swap.myReserve != null ? Number(status.swap.myReserve) / E18 : 0,
      },
    };
  });
}

// --- referral (R-06: real rate + pending via RPC; histories via graph once there is volume) -

// 2026-10-21 ruling: the SSR path is accountless — referrerRebateBps is a global hook config
// (identical for the zero address), so the cached config read serves the rate; per-referrer
// pending/history stay client/graph-driven (empty until wired, same as before).
export async function getFixtureReferral(): Promise<FixtureReferral | null> {
  const snapshot = await cachedConfig('referral-97', async () =>
    unwrap(await rpc().getReferralSnapshot(REGISTRATION_HUB, '0x0000000000000000000000000000000000000000')),
  );
  const ratePercent = snapshot?.ratePercent ?? 0;
  return {
    owner: '',
    referralCode: '',
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

export async function getFixtureVerseTrade(verseId: string): Promise<FixtureVerseTrade | null> {
  const verse = await getFixtureVerse(verseId);
  if (!verse) return null;
  return {
    candles: [],
    fineCandles: null,
    tokenStats: {
      price: null,
      change24h: null,
      marketCap: null,
      liquidity: 0,
      volume24h: null,
      holders: null,
      totalSupply: null,
      tokenAddress: verse.memecoinAddress,
    },
    pools: [],
  };
}

export async function getFixtureStaking(_verseId: string): Promise<FixtureStaking | null> {
  return null;
}

export async function getFixturePolPosition(_verseId: string): Promise<FixturePolPosition | null> {
  return null;
}

export async function getFixtureGovernanceState(_verseId: string): Promise<FixtureGovernanceState | null> {
  return null;
}

export async function getFixtureAssetUsdSample(_symbol: string): Promise<number | null> {
  return null;
}

// --- portfolio sections (aggregates; empty until per-account wiring in stage 6+) ------------

export async function getFixtureWalletAssets(): Promise<FixtureWalletAsset[]> {
  return [];
}

export async function getFixtureReserveBalances(): Promise<Record<string, number>> {
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
        await Promise.all(
          psms.map(([, psm]) => rpc().getPsmState(chainId, psm).then(unwrap)),
        )
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

// 2026-10-22: the account-scoped SSR read is retired — the 2026-10-21 ruling (personal values
// never ride the server path) applied to its last consumer, the verse participation panel,
// which now reads pay-asset balances client-side through the wallet provider. Accountless on
// onchain; fixture-mode samples live in the fixture repository (untouched, baselines keep them).
export async function getFixtureWalletBalances(): Promise<Record<string, number>> {
  return {};
}

export async function getFixturePsmPair(_uAssetSymbol: string): Promise<FixturePsmPair | null> {
  return null;
}

export async function getFixtureCdpPositions(): Promise<never[]> {
  return [];
}

export async function getFixtureUsrSavings(): Promise<FixtureUsrSavings[]> {
  return [];
}

export async function getFixtureVaultRows(): Promise<FixtureVaultRow[]> {
  return [];
}

export async function getFixturePortfolioActions(): Promise<FixturePortfolioAction[]> {
  return [];
}

export async function getFixtureParticipationRows(): Promise<FixtureParticipationRow[]> {
  return [];
}

export async function getFixturePortfolioSignals() {
  return { actionCount: 0, claimableVerses: 0 };
}

export async function getFixtureParticipations(): Promise<FixtureParticipation[]> {
  return [];
}

export async function getFixtureBridgeMessages(): Promise<never[]> {
  return [];
}

// Warm the cold caches at server boot so the first navigation doesn't pay the network round
// trips (fire-and-forget; failures degrade silently per §9/§24). Only in the onchain runtime —
// never during `next build` (NEXT_PHASE) and never in fixture-mode test processes.
if (process.env.OUTRUN_DATA_SOURCE === 'onchain' && process.env.NEXT_PHASE !== 'phase-production-build') {
  void Promise.allSettled([
    getFixtureSnapshot(),
    getFixtureFaucet(),
    getFixtureReferral(),
    getFixtureCreateConfig(),
  ]);
}

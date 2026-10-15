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

// Accountless config reads (faucet limits/fees, registration preview) are chain-config-like:
// low churn, no per-user data, so they get the same policy as the graph cache — last value
// serves instantly, refresh runs in background (§9). A null/failed read is never cached as
// fresh; the next request retries while callers keep seeing the last good value.
const CONFIG_TTL_MS = 15_000;
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

function toFixtureVerse(view: VerseSummaryView): FixtureVerse {
  const raiseAsset = uAssetSymbol(view.uAsset);
  const normalRaised = Number(view.raised.genesis) / E18;
  const leverageInterest = Number(view.raised.leveraged) / E18;
  const preorderRaised = Number(view.raised.preorder) / E18;
  return {
    id: String(view.verseId),
    sourceRef: `subgraph:${view.chainId}`,
    scenario: [],
    name: view.name,
    symbol: view.symbol,
    stage: view.stage,
    governanceChain: REGISTRATION_HUB,
    governanceChainName: 'BNB Smart Chain Testnet',
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
    participationSize: normalRaised + leverageInterest + preorderRaised,
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

export async function getFixtureSnapshot() {
  // three per-chain subgraph round trips are independent — fan out instead of serializing
  const results = await Promise.all(TESTNETS.map((chainId) => graph().getVerseSummaries(chainId)));
  const verses: FixtureVerse[] = [];
  for (const result of results) {
    const list = unwrap(result);
    if (list) verses.push(...list.map(toFixtureVerse));
  }
  const deployedVerseCount = verses.filter((v) => v.stage === 'locked' || v.stage === 'unlocked').length;
  return {
    timeAnchor: new Date().toISOString(),
    verses,
    assets: [] as FixtureAsset[],
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

export async function getFixtureVerse(verseId: string): Promise<FixtureVerse | null> {
  const match = /^(?:verse-)?(\d+)$/i.exec(verseId);
  if (!match) return null;
  const numeric = Number(match[1]);
  const snapshot = await getFixtureSnapshot();
  return snapshot.verses.find((verse) => Number(verse.id) === numeric) ?? null;
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
  return {
    raiseAsset: { id: `uasset:${raiseAssetSymbol}`, sourceRef: 'lib/web3/chains.ts', symbol: raiseAssetSymbol },
    reserves: [],
    yieldSourceRegistry: [],
    creditAsset: null,
  };
}

// --- faucet (R-07, real RPC data) ---------------------------------------------------------

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
        feeIn: Number(status.swap.tinBps) / 1e4,
        feeOut: Number(status.swap.toutBps) / 1e4,
        headroom: Number(status.swap.headroom) / E18,
        myUAsset: status.swap.myUAsset != null ? Number(status.swap.myUAsset) / E18 : 0,
        myReserve: status.swap.myReserve != null ? Number(status.swap.myReserve) / E18 : 0,
      },
    };
  });
}

// --- referral (R-06: real rate + pending via RPC; histories via graph once there is volume) -

export async function getFixtureReferral(): Promise<FixtureReferral | null> {
  // accountless disconnected view (fixed zero address): the rate read is config-like, so it
  // rides the same SWR cache as the other RPC config reads
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
  return {};
}

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
  void Promise.allSettled([getFixtureSnapshot(), getFixtureFaucet(), getFixtureCreateConfig()]);
}

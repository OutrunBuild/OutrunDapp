// Post-write config invalidation (invalidateVerseConfig): every verse-scoped cachedConfig
// group must drop for the written verse — a missed group replays pre-write numbers after a
// confirmed write (30s TTL, and the SWR second leg can stretch the stale window further),
// breaking the write-refresh converge-once contract (docs/engineering/performance.md).
// Priming goes through the real getters; the seed deletes are the key-space observable and
// per-group RPC re-reads are the freshness observable.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAddress } from 'viem';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const deployment = JSON.parse(readFileSync(join(repo, 'deployments/97.json'), 'utf8'));

// Chain resolution fails closed without RPC env placeholders — provision before the import.
process.env.ALCHEMY_KEY_BSC_TESTNET ??= 'test-key';
process.env.INFURA_KEY_BSC_TESTNET ??= 'test-key';
process.env.SUBGRAPH_ENDPOINT_BSC_TESTNET ??= 'http://subgraph.test';

const E = 10n ** 18n;
const ok = <T>(data: T) => ({ status: 'ok' as const, data });

const MEMECOIN = getAddress('0x0a0aa00000000000000000000000000000000001');
const POL = getAddress('0x0a0aa00000000000000000000000000000000002');
const PT = getAddress('0x0a0aa00000000000000000000000000000000003');
const YT = getAddress('0x0a0aa00000000000000000000000000000000004');
const VAULT = getAddress('0x0a0aa00000000000000000000000000000000005');
const GOVERNOR = getAddress('0x0a0aa00000000000000000000000000000000006');
const INCENTIVIZER = getAddress('0x0a0aa00000000000000000000000000000000007');
const UUSD = deployment.contracts['UAsset.UUSD'];

// Locked stage with governance contracts set: the detail getters bail early on
// genesis/refund or zero contracts — either bail would leave its key group unwarmed.
function view(verseId: bigint) {
  return {
    chainId: 97,
    verseId,
    name: 'Osmosis Kitty',
    symbol: 'OSMK',
    stage: 'locked' as const,
    flashGenesis: false,
    uAsset: UUSD,
    memecoin: MEMECOIN,
    pol: POL,
    yieldVault: VAULT,
    governor: GOVERNOR,
    incentivizer: INCENTIVIZER,
    endTime: 1800000000n,
    unlockTime: 1800000000n,
    omnichainIds: [97n],
    communities: [],
    registeredAt: 1790000000n,
    raised: { genesis: 0n, leveraged: 0n, preorder: 0n },
    participantCount: 0,
  };
}

const graphMock = vi.hoisted(() => ({
  getVerseDetail: vi.fn(),
  getGovernanceStatus: vi.fn(),
}));
vi.mock('@/lib/data/graph/graph-repository', () => ({
  getGraphRepository: () => graphMock,
}));

const rpcMock = vi.hoisted(() => ({
  getVerseFinancials: vi.fn(),
  getVerseRuntime: vi.fn(),
  getVersePtAddress: vi.fn(),
  getTokenBalances: vi.fn(),
  getTokenTotalSupply: vi.fn(),
  getPoolLpSupply: vi.fn(),
  getPoolReserveAmounts: vi.fn(),
  getVerseSplitInfo: vi.fn(),
  getPreviewRedeemYtUAsset: vi.fn(),
  getVaultState: vi.fn(),
  getGovernanceSnapshot: vi.fn(),
}));
vi.mock('@/lib/data/repository', () => ({
  getOnchainRepository: () => rpcMock,
}));

const seedMock = vi.hoisted(() => ({
  readSeed: vi.fn(() => null),
  writeSeed: vi.fn(),
  deleteSeed: vi.fn(),
  deleteSeedsMatching: vi.fn(),
}));
vi.mock('@/lib/data/persisted-swr', () => seedMock);

async function wireAllReadsOk(verseId: bigint) {
  graphMock.getVerseDetail.mockImplementation((chainId: number, id: bigint) =>
    Promise.resolve(chainId === 97 && id === verseId ? ok(view(verseId)) : ok(null)),
  );
  graphMock.getGovernanceStatus.mockResolvedValue(ok(null));
  rpcMock.getVerseFinancials.mockResolvedValue(
    ok({
      minTotalFund: 100n * E,
      interestRate: 5n * E,
      debtCap: 50n * E,
      preorderCapRatioBps: 5000n,
    }),
  );
  rpcMock.getVerseRuntime.mockResolvedValue(ok({ remainingPreorderCapacity: 10n * E }));
  rpcMock.getVersePtAddress.mockResolvedValue(ok(PT));
  rpcMock.getTokenBalances.mockResolvedValue(ok([]));
  rpcMock.getTokenTotalSupply.mockResolvedValue(ok(1_000_000n * E));
  rpcMock.getPoolLpSupply.mockResolvedValue(ok(1_000n * E));
  rpcMock.getPoolReserveAmounts.mockResolvedValue(ok([200_000n * E, 1_000n * E]));
  rpcMock.getVerseSplitInfo.mockResolvedValue(
    ok({
      settled: true,
      settlementMemecoin: 1_000n * E,
      yt: YT,
      ptBackingNumerator: 1_000n * E,
      ptBackingDenominator: 2_000n * E,
    }),
  );
  rpcMock.getPreviewRedeemYtUAsset.mockResolvedValue(ok(5n * E));
  rpcMock.getVaultState.mockResolvedValue(ok({ totalAssets: 500n * E, assetsPerShareBase: E }));
  rpcMock.getGovernanceSnapshot.mockResolvedValue(
    ok({
      treasury: { tokens: [], balances: [] },
      rewards: { tokens: [], amounts: [] },
      previousTreasury: null,
      previous: null,
      currentCycleId: 1n,
      cycleDurationSecs: 604_800n,
      current: { totalVotes: 1_000n * E, endTime: 1_900_000_000n },
    }),
  );
}

// One counter per cache group; each is the group's backing RPC read, so a warm replay must
// leave them flat and a post-invalidation pass must move each one again.
function readCount() {
  return {
    fin: rpcMock.getVerseFinancials.mock.calls.length,
    trade: rpcMock.getPoolReserveAmounts.mock.calls.length,
    supply: rpcMock.getTokenTotalSupply.mock.calls.length,
    vault: rpcMock.getVaultState.mock.calls.length,
    split: rpcMock.getVerseSplitInfo.mock.calls.length,
    gov: rpcMock.getGovernanceSnapshot.mock.calls.length,
  };
}

// One pass over every getter warms all five verse-scoped groups plus the supply sum
async function warmAll(adapter: typeof import('../../../lib/data/onchain-source')) {
  await adapter.getVerse('9001');
  await adapter.getVerseTrade('9001');
  await adapter.getStaking('9001');
  await adapter.getPolPosition('9001');
  await adapter.getGovernanceState('9001');
}

beforeEach(() => {
  for (const fn of [
    ...Object.values(graphMock),
    ...Object.values(rpcMock),
    seedMock.writeSeed,
    seedMock.deleteSeed,
    seedMock.deleteSeedsMatching,
  ]) {
    fn.mockReset();
  }
  seedMock.readSeed.mockReset().mockReturnValue(null);
});

describe('invalidateVerseConfig', () => {
  it('drops every verse-scoped config key group and forces the re-reads', async () => {
    await wireAllReadsOk(9001n);
    const adapter = await import('../../../lib/data/onchain-source');

    await warmAll(adapter);

    // Warm replay must be read-free — this proves each group cached a fresh (non-null)
    // value, without which the re-read assertions below would pass on a broken drop too.
    const warm = readCount();
    await warmAll(adapter);
    expect(readCount()).toEqual(warm);

    seedMock.deleteSeed.mockClear();
    adapter.invalidateVerseConfig('9001');

    // Exactly this verse's six keys left the cache (and the seed disk); nothing else did.
    const dropped = seedMock.deleteSeed.mock.calls.map((call) => call[1]).sort();
    expect(dropped).toEqual(
      [
        'verse-fin-97-9001',
        'verse-meme-supply-9001',
        'verse-trade-97-9001',
        'verse-vault-97-9001',
        'verse-split-97-9001',
        'verse-gov-97-9001',
      ].sort(),
    );

    // Namespace pin across all four seed mounts: the v2 files carry the post-bump encoding —
    // a silent revert to the v1 namespace (whose files hold pre-bump 0n legs that v2 reads as
    // honest zeros) would otherwise pass every assertion in this file
    const seedNamespaces = new Set([
      ...(seedMock.readSeed.mock.calls as unknown[][]).map((call) => call[0]),
      ...seedMock.writeSeed.mock.calls.map((call) => call[0]),
      ...seedMock.deleteSeed.mock.calls.map((call) => call[0]),
      ...seedMock.deleteSeedsMatching.mock.calls.map((call) => call[0]),
    ]);
    expect([...seedNamespaces]).toEqual(['adapter-config-v2']);

    // The disk pass enumerates the seed namespace with the same predicate, so keys the
    // process never materialized (restart leftovers) drop by the same rule
    expect(seedMock.deleteSeedsMatching).toHaveBeenCalledTimes(2);
    const diskMatch = seedMock.deleteSeedsMatching.mock.calls[0]![1] as (key: string) => boolean;
    for (const key of [
      'verse-fin-97-9001',
      'verse-trade-97-9001',
      'verse-split-97-9001',
      'verse-gov-97-9001',
      'verse-vault-97-9001',
    ]) {
      expect(diskMatch(key)).toBe(true);
    }
    expect(diskMatch('verse-fin-97-9002')).toBe(false);
    expect(diskMatch('threshold-x')).toBe(false);
    const supplyMatch = seedMock.deleteSeedsMatching.mock.calls[1]![1] as (key: string) => boolean;
    expect(supplyMatch('verse-meme-supply-9001')).toBe(true);
    expect(supplyMatch('verse-meme-supply-9002')).toBe(false);
    expect(supplyMatch('verse-fin-97-9001')).toBe(false);

    await warmAll(adapter);
    const after = readCount();
    expect(after.fin).toBeGreaterThan(warm.fin);
    expect(after.trade).toBeGreaterThan(warm.trade);
    expect(after.supply).toBeGreaterThan(warm.supply);
    expect(after.vault).toBeGreaterThan(warm.vault);
    expect(after.split).toBeGreaterThan(warm.split);
    expect(after.gov).toBeGreaterThan(warm.gov);
  });

  it('matches every surface spelling of the id and ignores unknown ids', async () => {
    await wireAllReadsOk(9001n);
    const adapter = await import('../../../lib/data/onchain-source');
    const expected = [
      'verse-fin-97-9001',
      'verse-meme-supply-9001',
      'verse-trade-97-9001',
      'verse-vault-97-9001',
      'verse-split-97-9001',
      'verse-gov-97-9001',
    ].sort();

    // An id nothing was warmed under drops nothing (guards the match from over-reaching)
    await warmAll(adapter);
    seedMock.deleteSeed.mockClear();
    adapter.invalidateVerseConfig('9002');
    expect(seedMock.deleteSeed).not.toHaveBeenCalled();

    // Each surface spelling a hand-typed URL can carry must fold to the canonical decimal
    // the keys hold (loadVerse's own id convention) — proven per spelling on a freshly
    // warmed cache, so a folding regression cannot hide behind an already-emptied cache
    for (const spelling of ['9001', 'verse-9001', '09001', 'VERSE-09001']) {
      await warmAll(adapter);
      seedMock.deleteSeed.mockClear();
      adapter.invalidateVerseConfig(spelling);
      const dropped = seedMock.deleteSeed.mock.calls.map((call) => call[1]).sort();
      expect(dropped).toEqual(expected);
    }
  });

  it('a settle that lands after invalidation does not rewrite the disk seed', async () => {
    const verseId = 9101n;
    await wireAllReadsOk(verseId);
    // Hold the verse-fin read open across the invalidation: a refresh that started before the
    // confirmed write settles only after the key was dropped.
    let releaseFin: (value: unknown) => void = () => {};
    const finGate = new Promise<unknown>((resolve) => {
      releaseFin = resolve;
    });
    rpcMock.getVerseFinancials.mockReturnValueOnce(
      finGate.then(() =>
        ok({
          minTotalFund: 100n * E,
          interestRate: 5n * E,
          debtCap: 50n * E,
          preorderCapRatioBps: 5000n,
        }),
      ),
    );

    const adapter = await import('../../../lib/data/onchain-source');
    const pending = adapter.getVerse('9101');
    await vi.waitFor(() => expect(rpcMock.getVerseFinancials).toHaveBeenCalled());

    seedMock.writeSeed.mockClear();
    seedMock.deleteSeed.mockClear();
    adapter.invalidateVerseConfig('9101');
    expect(seedMock.deleteSeed.mock.calls.map((call) => call[1])).toContain('verse-fin-97-9101');

    releaseFin(undefined);
    await pending;

    // The detached settle still answers the read that was already in flight, but it must not
    // re-publish the pre-write value into the seed the invalidation just cleared.
    expect(seedMock.writeSeed.mock.calls.map((call) => call[1])).not.toContain('verse-fin-97-9101');
  });
});

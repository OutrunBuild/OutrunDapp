// Onchain trade-desk composition (getVerseTrade): four hook pools priced off full-range
// reserves — pool price = quote/base reserve ratio, TVL = uAsset leg + other leg converted
// through its own pool's price, USD scale = uAsset USD sample (UUSD par 1). Zero-LP pools and
// failed reads degrade to slotted values, never fabricated ones.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAddress } from 'viem';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const deployment = JSON.parse(readFileSync(join(repo, 'deployments/97.json'), 'utf8'));

// Chain resolution fails closed without RPC env placeholders — the composition path reads the
// deployment table directly, so provision dummy values before the adapter import.
process.env.ALCHEMY_KEY_BSC_TESTNET ??= 'test-key';
process.env.INFURA_KEY_BSC_TESTNET ??= 'test-key';
process.env.SUBGRAPH_ENDPOINT_BSC_TESTNET ??= 'http://subgraph.test';

const MEMECOIN = getAddress('0x0a0aa00000000000000000000000000000000001');
const POL = getAddress('0x0a0aa00000000000000000000000000000000002');
const PT = getAddress('0x0a0aa00000000000000000000000000000000003');
const UUSD = deployment.contracts['UAsset.UUSD'];
// Valid hex but absent from every deployment table — the "unknown raise asset" shape. A
// syntactically invalid address would throw inside viem's poolId encoding and collapse the
// whole composition to the empty trade shape, testing the wrong degrade path.
const UNKNOWN_UASSET = getAddress('0x0000000000000000000000000000000000000777');
const HOOK = deployment.contracts.MemeverseUniswapHook;
const ROUTER = deployment.contracts.MemeverseSwapRouter;
const SPLITTER = deployment.contracts.POLSplitter;
const E = 10n ** 18n;
const ok = <T>(data: T) => ({ status: 'ok' as const, data });
const unavailable = { status: 'unavailable' as const, reason: 'rpc-error', detail: 'test' };

function view(verseId: bigint, uAsset: string = UUSD) {
  return {
    chainId: 97,
    verseId,
    name: 'Osmosis Kitty',
    symbol: 'OSMK',
    stage: 'locked' as const,
    flashGenesis: false,
    uAsset,
    memecoin: MEMECOIN,
    pol: POL,
    yieldVault: null,
    governor: null,
    incentivizer: null,
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

// Reserve amounts per pool pair: (base, quote) display units ×1e18 — main 0.005 UUSD per meme,
// POL pool 1.25, PT pool 0.625; every uAsset-bearing pool lands at 2000 uAsset-equivalent.
const PAIRS: Record<string, [bigint, bigint]> = {
  main: [200_000n * E, 1_000n * E],
  'pol-uasset': [800n * E, 1_000n * E],
  'pt-uasset': [1_600n * E, 1_000n * E],
  'pt-pol': [500n * E, 400n * E],
};
const TOKEN_OF: Record<string, string> = {
  main: MEMECOIN,
  'pol-uasset': POL,
  'pt-uasset': PT,
  'pt-pol': PT,
};
const QUOTE_OF: Record<string, string> = {
  main: UUSD,
  'pol-uasset': UUSD,
  'pt-uasset': UUSD,
  'pt-pol': POL,
};

async function wireComposition(
  verseId: bigint,
  opts?: { zeroMain?: boolean; zeroKinds?: string[]; failKinds?: string[]; uAsset?: string },
) {
  const { hookPoolKey, poolIdOf } = await import('../../../lib/web3/pool-quote');
  graphMock.getVerseDetail.mockImplementation((chainId: number, id: bigint) =>
    Promise.resolve(chainId === 97 && id === verseId ? ok(view(verseId, opts?.uAsset)) : ok(null)),
  );
  rpcMock.getVerseFinancials.mockResolvedValue(unavailable);
  rpcMock.getVerseRuntime.mockResolvedValue(unavailable);
  rpcMock.getVersePtAddress.mockResolvedValue(ok(PT));
  rpcMock.getTokenBalances.mockResolvedValue(
    ok(
      [MEMECOIN, POL, PT, UUSD].map((address) => ({
        address,
        symbol: 'X',
        decimals: 18,
        balance: 0n,
      })),
    ),
  );
  rpcMock.getTokenTotalSupply.mockResolvedValue(ok(1_000_000n * E));
  rpcMock.getPoolLpSupply.mockImplementation((_chainId: number, _hook: string, poolId: string) => {
    const kind = poolKindOf(poolId);
    const zero = (kind === 'main' && opts?.zeroMain) || opts?.zeroKinds?.includes(kind);
    return Promise.resolve(ok(zero ? 0n : 1_000n * E));
  });
  rpcMock.getPoolReserveAmounts.mockImplementation(
    (_chainId: number, _router: string, base: string, _quote: string, liquidity: bigint) => {
      const kind = baseKindOf(base, _quote);
      if (opts?.failKinds?.includes(kind)) return Promise.resolve(unavailable);
      const [amountBase, amountQuote] = PAIRS[kind]!;
      return Promise.resolve(ok(liquidity <= 0n ? [0n, 0n] : [amountBase, amountQuote]));
    },
  );
  function poolKindOf(poolId: string): string {
    for (const kind of Object.keys(PAIRS)) {
      const key = hookPoolKey(
        TOKEN_OF[kind]! as `0x${string}`,
        QUOTE_OF[kind]! as `0x${string}`,
        HOOK,
      );
      if (poolIdOf(key) === poolId) return kind;
    }
    return 'main';
  }
  function baseKindOf(base: string, quote: string): string {
    return (
      Object.keys(PAIRS).find((kind) => TOKEN_OF[kind] === base && QUOTE_OF[kind] === quote) ??
      'main'
    );
  }
}

beforeEach(() => {
  graphMock.getVerseDetail.mockReset();
  graphMock.getGovernanceStatus.mockReset();
  rpcMock.getVersePtAddress.mockReset();
  rpcMock.getTokenBalances.mockReset();
  rpcMock.getTokenTotalSupply.mockReset();
  rpcMock.getPoolLpSupply.mockReset();
  rpcMock.getPoolReserveAmounts.mockReset();
  rpcMock.getVerseSplitInfo.mockReset();
  rpcMock.getPreviewRedeemYtUAsset.mockReset();
  rpcMock.getVaultState.mockReset();
  rpcMock.getGovernanceSnapshot.mockReset();
});

describe('getVerseTrade onchain composition', () => {
  it('prices the four pools off full-range reserves and derives TVL/market cap', async () => {
    await wireComposition(9001n);
    const adapter = await import('../../../lib/data/onchain-source');
    const trade = await adapter.getVerseTrade('9001');
    expect(trade).not.toBeNull();
    expect(trade!.pools).toHaveLength(4);
    const byKind = new Map(trade!.pools.map((pool) => [pool.pool, pool]));
    expect(byKind.get('main')!.baseSymbol).toBe('OSMK');
    expect(byKind.get('main')!.quoteSymbol).toBe('UUSD');
    expect(byKind.get('pt-pol')!.baseSymbol).toBe('PT-OSMK');
    expect(byKind.get('pt-pol')!.quoteSymbol).toBe('POL-OSMK');
    // uAsset-equivalent TVL × UUSD par 1: main 1000 + 200000×0.005; pol 1000 + 800×1.25;
    // pt-uasset 1000 + 1600×0.625; pt-pol 500×0.625 + 400×1.25
    expect(byKind.get('main')!.tvl).toBeCloseTo(2000, 6);
    expect(byKind.get('pol-uasset')!.tvl).toBeCloseTo(2000, 6);
    expect(byKind.get('pt-uasset')!.tvl).toBeCloseTo(2000, 6);
    expect(byKind.get('pt-pol')!.tvl).toBeCloseTo(812.5, 6);
    expect(trade!.tokenStats.price).toBeCloseTo(0.005, 12);
    expect(trade!.tokenStats.liquidity).toBeCloseTo(2000, 6);
    expect(trade!.tokenStats.totalSupply).toBeCloseTo(1_000_000, 6);
    expect(trade!.tokenStats.marketCap).toBeCloseTo(5000, 6);
    // LP minted 1:1 with liquidity, both legs 18-dec -> lpPerQuote is the raw ratio (1000/1000)
    expect(byKind.get('main')!.lpPerQuote).toBeCloseTo(1, 9);
    // no indexed volume/APR history yet — slotted, not fabricated
    expect(trade!.pools.every((pool) => pool.volume24h === null && pool.apr7d === null)).toBe(true);
  });

  it('zero-LP main pool degrades price/market cap/liquidity but keeps the pool row', async () => {
    await wireComposition(9002n, { zeroMain: true });
    const adapter = await import('../../../lib/data/onchain-source');
    const trade = await adapter.getVerseTrade('9002');
    const main = trade!.pools.find((pool) => pool.pool === 'main')!;
    expect(main.tvl).toBe(0);
    expect(main.lpPerQuote).toBeNull();
    expect(trade!.tokenStats.price).toBeNull();
    expect(trade!.tokenStats.marketCap).toBeNull();
    expect(trade!.tokenStats.liquidity).toBe(0);
  });

  it('a drained backing pool nulls the cross-priced leg instead of halving its TVL', async () => {
    // PT/uAsset LP fully burned: the PT side of pt-pol has no conversion price, so that
    // pool's value is unknown — never the POL half dressed up as the whole pool.
    await wireComposition(9005n, { zeroKinds: ['pt-uasset'] });
    const adapter = await import('../../../lib/data/onchain-source');
    const trade = await adapter.getVerseTrade('9005');
    const byKind = new Map(trade!.pools.map((pool) => [pool.pool, pool]));
    expect(byKind.get('pt-uasset')!.tvl).toBe(0);
    expect(byKind.get('pt-pol')!.tvl).toBeNull();
    // self-priced legs stay intact
    expect(byKind.get('main')!.tvl).toBeCloseTo(2000, 6);
    expect(byKind.get('pol-uasset')!.tvl).toBeCloseTo(2000, 6);
    expect(trade!.tokenStats.liquidity).toBeCloseTo(2000, 6);
  });

  it('a failed reserve read is unknown, not an empty pool', async () => {
    await wireComposition(9006n, { failKinds: ['pol-uasset'] });
    const adapter = await import('../../../lib/data/onchain-source');
    const trade = await adapter.getVerseTrade('9006');
    const byKind = new Map(trade!.pools.map((pool) => [pool.pool, pool]));
    expect(byKind.get('pol-uasset')!.tvl).toBeNull();
    expect(byKind.get('pol-uasset')!.lpPerQuote).toBeNull();
    // pt-pol's POL side loses its price -> whole leg unknown
    expect(byKind.get('pt-pol')!.tvl).toBeNull();
    expect(byKind.get('main')!.tvl).toBeCloseTo(2000, 6);
  });

  it('a failed PT resolution collapses to the empty trade shape (never throws)', async () => {
    await wireComposition(9003n);
    rpcMock.getVersePtAddress.mockResolvedValue(unavailable);
    const adapter = await import('../../../lib/data/onchain-source');
    const trade = await adapter.getVerseTrade('9003');
    expect(trade!.pools).toEqual([]);
    expect(trade!.tokenStats.price).toBeNull();
  });

  it('genesis verses carry no pools (memecoin deploys at settlement)', async () => {
    const genesis = { ...view(9004n), stage: 'genesis' as const };
    graphMock.getVerseDetail.mockImplementation((chainId: number) =>
      Promise.resolve(chainId === 97 ? ok(genesis) : ok(null)),
    );
    rpcMock.getVerseFinancials.mockResolvedValue(unavailable);
    rpcMock.getVerseRuntime.mockResolvedValue(unavailable);
    const adapter = await import('../../../lib/data/onchain-source');
    const trade = await adapter.getVerseTrade('9004');
    expect(trade!.pools).toEqual([]);
    expect(trade!.tokenStats.liquidity).toBeNull();
  });

  it('a missing USD sample nulls the $ slots (tvl/liquidity/marketCap) — never a ×1 stand-in', async () => {
    // out-of-table uAsset -> raiseAsset null -> getAssetUsdPrice null: the same shape a
    // UETH/UBNB feed failure produces (null sample entering buildVerseTrade)
    await wireComposition(9301n, { uAsset: UNKNOWN_UASSET });
    const adapter = await import('../../../lib/data/onchain-source');
    const trade = await adapter.getVerseTrade('9301');
    expect(trade).not.toBeNull();
    expect(trade!.tokenStats.liquidity).toBeNull();
    expect(trade!.tokenStats.marketCap).toBeNull();
    expect(trade!.pools).toHaveLength(4);
    expect(trade!.pools.every((pool) => pool.tvl === null)).toBe(true);
    // non-USD slots stay: the uAsset-denominated pool price and the pool rows themselves
    expect(trade!.tokenStats.price).toBeCloseTo(0.005, 12);
    expect(trade!.pools.every((pool) => pool.baseSymbol.length > 0)).toBe(true);
  });
});

describe('getAssetUsdPrice onchain', () => {
  it('UUSD is PSM face-value par (1) without any feed read', async () => {
    const adapter = await import('../../../lib/data/onchain-source');
    expect(await adapter.getAssetUsdPrice('UUSD')).toBe(1);
  });

  it('unknown families have no USD sample (rows hide)', async () => {
    const adapter = await import('../../../lib/data/onchain-source');
    expect(await adapter.getAssetUsdPrice('USDC')).toBeNull();
  });
});

// POL position: protocol half real off the composition + splitter wiring, account half slotted
// (null — never fake zeros: a 0 would gate the dialogs' balance checks).
describe('getPolPosition onchain', () => {
  function wireSplit(verseId: bigint, opts?: { backingFails?: boolean; ytLegReverts?: boolean }) {
    graphMock.getVerseDetail.mockImplementation((chainId: number, id: bigint) =>
      Promise.resolve(chainId === 97 && id === verseId ? ok(view(verseId)) : ok(null)),
    );
    rpcMock.getVerseFinancials.mockResolvedValue(unavailable);
    rpcMock.getVerseRuntime.mockResolvedValue(unavailable);
    if (opts?.backingFails) {
      rpcMock.getVerseSplitInfo.mockResolvedValue(unavailable);
    } else {
      rpcMock.getVerseSplitInfo.mockResolvedValue(
        ok({
          pt: PT,
          yt: '0x0000000000000000000000000000000000000099',
          pol: POL,
          memecoin: MEMECOIN,
          uAsset: UUSD,
          totalPOLCollateral: 0n,
          settlementUAsset: 0n,
          settlementMemecoin: 0n,
          ptBackingNumerator: 62n * E,
          ptBackingDenominator: 100n * E,
          settled: false,
        }),
      );
    }
    rpcMock.getPreviewRedeemYtUAsset.mockResolvedValue(
      opts?.ytLegReverts ? unavailable : ok(28_100_000_000_000_000n),
    );
  }

  it('derives prices from pools, nominal from the backing ratio, and slots every account field', async () => {
    await wireComposition(9101n);
    wireSplit(9101n);
    const adapter = await import('../../../lib/data/onchain-source');
    const pol = await adapter.getPolPosition('9101');
    expect(pol).not.toBeNull();
    // POL/uAsset pool: 1000 uAsset backing 800 POL -> 1.25 per POL; PT/POL pool: 400 POL per 500 PT
    expect(pol!.marketPricePerPol).toBeCloseTo(1.25, 12);
    expect(pol!.ptPricePerPol).toBeCloseTo(0.8, 12);
    // backing 0.62 uAsset per POL; nominal = 2× (full-range convention)
    expect(pol!.uAssetPerPol).toBeCloseTo(0.62, 12);
    expect(pol!.nominalValuePerPol).toBeCloseTo(1.24, 12);
    expect(pol!.polSupply).toBeCloseTo(1_000_000, 6);
    expect(pol!.ytRedeemUAssetPerUnit).toBeCloseTo(0.0281, 12);
    // account half: every slot null — no fabricated zeros, no fabricated fee
    expect(pol!.myPol).toBeNull();
    expect(pol!.myLp).toEqual({
      main: null,
      'pol-uasset': null,
      'pt-uasset': null,
      'pt-pol': null,
    });
    expect(pol!.flashUserFeeRate).toBeNull();
    expect(pol!.claimableYt).toBeNull();
  });

  it('a reverting YT preview keeps the position (leg slots, retried not cached)', async () => {
    await wireComposition(9102n);
    wireSplit(9102n, { ytLegReverts: true });
    const adapter = await import('../../../lib/data/onchain-source');
    const pol = await adapter.getPolPosition('9102');
    expect(pol).not.toBeNull();
    expect(pol!.ytRedeemUAssetPerUnit).toBeNull();
    expect(pol!.uAssetPerPol).toBeCloseTo(0.62, 12);
  });

  it('a failed splitter read collapses to null (panel hidden, never half-real)', async () => {
    await wireComposition(9103n);
    wireSplit(9103n, { backingFails: true });
    const adapter = await import('../../../lib/data/onchain-source');
    expect(await adapter.getPolPosition('9103')).toBeNull();
  });

  it('a failed pool-leg read slots the prices (unknown, not 0) and keeps the position', async () => {
    await wireComposition(9105n, { failKinds: ['pol-uasset'] });
    wireSplit(9105n);
    const adapter = await import('../../../lib/data/onchain-source');
    const pol = await adapter.getPolPosition('9105');
    expect(pol).not.toBeNull();
    expect(pol!.marketPricePerPol).toBeNull();
    expect(pol!.ptPricePerPol).toBeCloseTo(0.8, 12);
  });

  it('a failed totalSupply read slots polSupply null (unknown, not 0) and keeps the position', async () => {
    await wireComposition(9107n);
    rpcMock.getTokenTotalSupply.mockResolvedValue(unavailable);
    wireSplit(9107n);
    const adapter = await import('../../../lib/data/onchain-source');
    const pol = await adapter.getPolPosition('9107');
    expect(pol).not.toBeNull();
    expect(pol!.polSupply).toBeNull();
    expect(pol!.marketPricePerPol).toBeCloseTo(1.25, 12);
  });

  it('an honestly empty pool reads as price 0 (full gauge deviation), never unknown', async () => {
    await wireComposition(9106n, { zeroKinds: ['pol-uasset'] });
    wireSplit(9106n);
    const adapter = await import('../../../lib/data/onchain-source');
    const pol = await adapter.getPolPosition('9106');
    expect(pol).not.toBeNull();
    expect(pol!.marketPricePerPol).toBe(0);
    expect(pol!.ptPricePerPol).toBeCloseTo(0.8, 12);
  });

  it('genesis verses have no POL position', async () => {
    const genesis = { ...view(9104n), stage: 'genesis' as const };
    graphMock.getVerseDetail.mockImplementation((chainId: number) =>
      Promise.resolve(chainId === 97 ? ok(genesis) : ok(null)),
    );
    rpcMock.getVerseFinancials.mockResolvedValue(unavailable);
    rpcMock.getVerseRuntime.mockResolvedValue(unavailable);
    const adapter = await import('../../../lib/data/onchain-source');
    expect(await adapter.getPolPosition('9104')).toBeNull();
  });
});

// Staking: protocol half real off the vault (totalAssets + per-share conversion), account half
// slotted (APY has no static source either — history-derived display value).
const testAddr = (last: string) => getAddress(`0x0a0aa${'0'.repeat(32)}${last}`);
describe('getStaking onchain', () => {
  const VAULT = testAddr('004');

  function wireVault(verseId: bigint, opts?: { fails?: boolean }) {
    graphMock.getVerseDetail.mockImplementation((chainId: number, id: bigint) =>
      Promise.resolve(
        chainId === 97 && id === verseId ? ok({ ...view(verseId), yieldVault: VAULT }) : ok(null),
      ),
    );
    rpcMock.getVerseFinancials.mockResolvedValue(unavailable);
    rpcMock.getVerseRuntime.mockResolvedValue(unavailable);
    if (opts?.fails) rpcMock.getVaultState.mockResolvedValue(unavailable);
    else
      rpcMock.getVaultState.mockResolvedValue(
        ok({ totalAssets: 5_200_000n * E, assetsPerShareBase: 1_214_500_000_000_000_000n }),
      );
  }

  it('serves totalStaked and the share rate off the vault, slotting APY and the account half', async () => {
    wireVault(9201n);
    const adapter = await import('../../../lib/data/onchain-source');
    const staking = await adapter.getStaking('9201');
    expect(staking).not.toBeNull();
    expect(staking!.vaultAddress).toBe(VAULT);
    expect(staking!.totalStaked).toBeCloseTo(5_200_000, 6);
    expect(staking!.assetsPerShare).toBeCloseTo(1.2145, 12);
    expect(staking!.apy7d).toBeNull();
    expect(staking!.myShares).toBeNull();
    expect(staking!.pendingRedeems).toBeNull();
    expect(staking!.claimableTotal).toBeNull();
    expect(staking!.delegatee).toBeNull();
  });

  it('a failed vault read collapses to null; genesis has no vault at all', async () => {
    wireVault(9202n, { fails: true });
    const adapter = await import('../../../lib/data/onchain-source');
    expect(await adapter.getStaking('9202')).toBeNull();
    graphMock.getVerseDetail.mockImplementation((chainId: number) =>
      Promise.resolve(
        chainId === 97 ? ok({ ...view(9203n), stage: 'genesis' as const }) : ok(null),
      ),
    );
    rpcMock.getVerseFinancials.mockResolvedValue(unavailable);
    rpcMock.getVerseRuntime.mockResolvedValue(unavailable);
    expect(await adapter.getStaking('9203')).toBeNull();
  });

  it('a Verse row without a vault address (unsettled or spoke-chain copy) has no staking', async () => {
    // The row's governance fields are written by the proxy deployer's settlement events; a
    // missing/zero vault there = settlement deployed none — null, never an RPC probe at 0x0.
    graphMock.getVerseDetail.mockImplementation((chainId: number, id: bigint) =>
      Promise.resolve(chainId === 97 && id === 9205n ? ok(view(9205n)) : ok(null)),
    );
    rpcMock.getVerseFinancials.mockResolvedValue(unavailable);
    rpcMock.getVerseRuntime.mockResolvedValue(unavailable);
    rpcMock.getVaultState.mockResolvedValue(ok({ totalAssets: 1_000n * E, assetsPerShareBase: E }));
    const adapter = await import('../../../lib/data/onchain-source');
    expect(await adapter.getStaking('9205')).toBeNull();
    expect(rpcMock.getVaultState).not.toHaveBeenCalled();
  });
});

// Governance: cycle timing/votes/treasury off the incentivizer RPC, finalized status and
// proposal counts off the subgraph; only uAsset/memecoin treasury rows carry a USD value
// (priceless tokens render no row instead of a fake 0).
describe('getGovernanceState onchain', () => {
  const GOVERNOR = testAddr('005');
  const INCENTIVIZER = testAddr('006');
  const VAULT = testAddr('004');

  function wireGov(verseId: bigint, opts?: { noPrevious?: boolean }) {
    graphMock.getVerseDetail.mockImplementation((chainId: number, id: bigint) =>
      Promise.resolve(
        chainId === 97 && id === verseId
          ? ok({
              ...view(verseId),
              governor: GOVERNOR,
              incentivizer: INCENTIVIZER,
              yieldVault: VAULT,
            })
          : ok(null),
      ),
    );
    rpcMock.getVerseFinancials.mockResolvedValue(unavailable);
    rpcMock.getVerseRuntime.mockResolvedValue(unavailable);
    rpcMock.getGovernanceSnapshot.mockResolvedValue(
      ok({
        currentCycleId: 3n,
        cycleDurationSecs: 90n * 86_400n,
        current: {
          startTime: 1_790_000_000n,
          endTime: 1_790_000_000n + 90n * 86_400n,
          totalVotes: 100n * E,
        },
        previous: opts?.noPrevious
          ? null
          : {
              startTime: 1_790_000_000n - 90n * 86_400n,
              endTime: 1_790_000_000n,
              totalVotes: 115n * E,
            },
        treasury: {
          tokens: [UUSD, MEMECOIN],
          balances: [2_000n * E, 500_000_000n * E],
        },
        previousTreasury: opts?.noPrevious ? null : { tokens: [UUSD], balances: [1_000n * E] },
        rewards: { tokens: [MEMECOIN], amounts: [200_000_000n * E] },
      }),
    );
    rpcMock.getTokenTotalSupply.mockResolvedValue(ok(42_000_000n * E));
    // composition (main-pool price for the memecoin rows): PAIRS main = 1000 UUSD / 200000 meme
    rpcMock.getVersePtAddress.mockResolvedValue(ok(PT));
    rpcMock.getTokenBalances.mockImplementation(
      (_chainId: number, _account: string, tokens: string[]) =>
        Promise.resolve(
          ok(
            tokens.map((address) => ({
              address,
              symbol: address.toLowerCase() === UUSD.toLowerCase() ? 'UUSD' : 'OSMK',
              decimals: 18,
              balance: 0n,
            })),
          ),
        ),
    );
    rpcMock.getPoolLpSupply.mockResolvedValue(ok(1_000n * E));
    rpcMock.getPoolReserveAmounts.mockImplementation(
      (_c: number, _r: string, base: string, _q: string, liquidity: bigint) => {
        const kind = base === MEMECOIN ? 'main' : 'pol-uasset';
        const [amountBase, amountQuote] = PAIRS[kind]!;
        return Promise.resolve(ok(liquidity <= 0n ? [0n, 0n] : [amountBase, amountQuote]));
      },
    );
    graphMock.getGovernanceStatus.mockResolvedValue(
      ok({ finalized: false, proposalTotal: 3, proposalActive: 1 }),
    );
  }

  it('maps cycle timing, voting power, priced treasury rows and the subgraph status', async () => {
    wireGov(9301n);
    const adapter = await import('../../../lib/data/onchain-source');
    const gov = await adapter.getGovernanceState('9301');
    expect(gov).not.toBeNull();
    expect(gov!.cycleNumber).toBe('3');
    expect(gov!.cycleDurationDays).toBeCloseTo(90, 9);
    expect(gov!.finalized).toBe(false);
    expect(gov!.governorAddress).toBe(GOVERNOR);
    expect(gov!.incentivizerAddress).toBe(INCENTIVIZER);
    expect(gov!.totalVotingPower).toBeCloseTo(42_000_000, 6);
    expect(gov!.currentCycleVotes).toEqual({ total: 100, mine: null });
    // treasury USD (UUSD par 1: 2000; memecoin at main-pool 0.005: 5e8×0.005)
    expect(gov!.treasuryUAsset).toBeCloseTo(2_000 + 2_500_000, 0);
    expect(gov!.treasuryAssets).toHaveLength(2);
    expect(gov!.cumulativeIncentivePool).toBeCloseTo(200_000_000 * 0.005, 0);
    expect(gov!.lastCycle).not.toBeNull();
    expect(gov!.lastCycle!.number).toBe('2');
    expect(gov!.lastCycle!.myVotes).toBeNull();
    // previous treasury = 1000 UUSD (par 1); remaining rewards = 2e8 meme at main-pool 0.005
    expect(gov!.lastCycle!.treasuryUAsset).toBeCloseTo(1_000, 0);
    expect(gov!.lastCycle!.remainingRewards).toBeCloseTo(1_000_000, 0);
    expect(gov!.proposalCount).toEqual({ total: 3, active: 1 });
  });

  it('cycle 0 has no previous cycle row', async () => {
    wireGov(9302n);
    rpcMock.getGovernanceSnapshot.mockResolvedValue(
      ok({
        currentCycleId: 0n,
        cycleDurationSecs: 90n * 86_400n,
        current: {
          startTime: 1_790_000_000n,
          endTime: 1_790_000_000n + 90n * 86_400n,
          totalVotes: 0n,
        },
        previous: null,
        treasury: { tokens: [], balances: [] },
        previousTreasury: null,
        rewards: { tokens: [], amounts: [] },
      }),
    );
    const adapter = await import('../../../lib/data/onchain-source');
    const gov = await adapter.getGovernanceState('9302');
    expect(gov).not.toBeNull();
    expect(gov!.lastCycle).toBeNull();
    expect(gov!.treasuryUAsset).toBeNull();
    expect(gov!.cycleNumber).toBe('0');
  });

  it('unpriced last-cycle treasury and rewards null the totals instead of a fabricated 0', async () => {
    wireGov(9303n);
    // Meme pricing dead (pool composition unavailable) → memecoin legs carry no USD total
    rpcMock.getPoolLpSupply.mockResolvedValue(unavailable);
    rpcMock.getGovernanceSnapshot.mockResolvedValue(
      ok({
        currentCycleId: 3n,
        cycleDurationSecs: 90n * 86_400n,
        current: {
          startTime: 1_790_000_000n,
          endTime: 1_790_000_000n + 90n * 86_400n,
          totalVotes: 100n * E,
        },
        previous: {
          startTime: 1_790_000_000n - 90n * 86_400n,
          endTime: 1_790_000_000n,
          totalVotes: 115n * E,
        },
        treasury: { tokens: [UUSD], balances: [2_000n * E] },
        previousTreasury: { tokens: [MEMECOIN], balances: [500_000_000n * E] },
        rewards: { tokens: [MEMECOIN], amounts: [200_000_000n * E] },
      }),
    );
    const adapter = await import('../../../lib/data/onchain-source');
    const gov = await adapter.getGovernanceState('9303');
    expect(gov).not.toBeNull();
    expect(gov!.lastCycle).not.toBeNull();
    expect(gov!.lastCycle!.treasuryUAsset).toBeNull();
    expect(gov!.lastCycle!.remainingRewards).toBeNull();
  });

  it('a Verse row without governance addresses has no DAO state', async () => {
    // Row fields are settlement-deploy-event-written; missing/zero = none deployed → null
    wireGov(9303n);
    graphMock.getVerseDetail.mockImplementation((chainId: number, id: bigint) =>
      Promise.resolve(chainId === 97 && id === 9303n ? ok(view(9303n)) : ok(null)),
    );
    const adapter = await import('../../../lib/data/onchain-source');
    expect(await adapter.getGovernanceState('9303')).toBeNull();
    expect(rpcMock.getGovernanceSnapshot).not.toHaveBeenCalled();
  });

  it('subgraph failure degrades finalized/proposalCount to null instead of fabricated values', async () => {
    wireGov(9304n);
    graphMock.getGovernanceStatus.mockResolvedValue(unavailable);
    const adapter = await import('../../../lib/data/onchain-source');
    const gov = await adapter.getGovernanceState('9304');
    expect(gov).not.toBeNull();
    // RPC-side facts stay intact; only the unread graph slots go null (degrade, never fabricate)
    expect(gov!.cycleNumber).toBe('3');
    expect(gov!.finalized).toBeNull();
    expect(gov!.proposalCount).toBeNull();
  });
});

// ROUTER/SPLITTER constants are part of the mocked repo's expected call surface; referenced to
// keep them load-bearing for future assertions.
void ROUTER;
void SPLITTER;

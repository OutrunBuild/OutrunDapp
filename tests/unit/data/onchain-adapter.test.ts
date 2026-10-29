// Onchain adapter contract tests (stage 5 step 7): the adapter is the build-time alias target of
// the fixture repository in OUTRUN_DATA_SOURCE=onchain builds — these tests lock the seam rules:
//  (1) runtime-value isolation: the adapter NEVER imports runtime values from the fixture
//      repository (type-only; a stray value import would drag fixtures into the onchain graph)
//  (2) export-surface parity: every fixture-repository getter/constant consumed by components is
//      re-provided by the adapter (the onchain build must not resolve to a missing export)
//  (3) the async page-consumer pattern is sound: awaiting the fixture (sync) values equals the
//      values themselves, so fixture-mode rendering is unchanged by the async conversion
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const graphMock = vi.hoisted(() => ({
  getVerseSummaries: vi.fn(),
  getVersePage: vi.fn(),
  getRaisedSums: vi.fn(),
  getVerseDetail: vi.fn(),
}));
vi.mock('@/lib/data/graph/graph-repository', () => ({
  getGraphRepository: () => graphMock,
}));

describe('onchain adapter seam', () => {
  it('imports fixture-repository types only — never runtime values', () => {
    const src = readFileSync(join(repo, 'lib/data/onchain-source.ts'), 'utf8');
    const imports = [
      ...src.matchAll(/import\s+(type\s+)?\{[^{}]+\}\s+from\s+['"][^'"]*fixture-repository['"]/g),
    ];
    expect(imports.length).toBeGreaterThan(0);
    for (const m of imports) {
      expect((m[1] ?? '').trim(), 'fixture-repository imports must be type-only').toBe('type');
    }
  });

  it('re-exports the full runtime surface consumed by components', async () => {
    const adapter = await import('../../../lib/data/onchain-source');
    const surface = [
      'PROTECTION_WINDOW_MS',
      'getSnapshot',
      'getVerse',
      'getChains',
      'getCreateConfig',
      'getOccupiedSymbols',
      'getParticipationOptions',
      'getFaucet',
      'getReferral',
      'getVerseTrade',
      'getStaking',
      'getPolPosition',
      'getGovernanceState',
      'getAssetUsdPrice',
      'getWalletAssets',
      'getReserveBalances',
      'getWalletBalances',
      'getPsmPair',
      'getCdpPositions',
      'getUsrSavings',
      'getVaultRows',
      'getPortfolioActions',
      'getParticipationRows',
      'getPortfolioSignals',
      'getParticipations',
      'getAssets',
      'getDisplayAccount',
      'getHomeMetrics',
    ];
    for (const name of surface) {
      expect(adapter, `adapter export ${name}`).toHaveProperty(name);
    }
    expect(adapter.PROTECTION_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
  });

  it('PROTECTION_WINDOW_MS equals the fixture repository constant', async () => {
    const fixtures = await import('../../../lib/data/fixture-repository');
    const adapter = await import('../../../lib/data/onchain-source');
    expect(adapter.PROTECTION_WINDOW_MS).toBe(fixtures.PROTECTION_WINDOW_MS);
  });

  it('exposes the chain-scoped row getters alongside the snapshot surface', async () => {
    const adapter = await import('../../../lib/data/onchain-source');
    expect(adapter).toHaveProperty('getChainVerses');
    expect(adapter).toHaveProperty('getVerseChainIds');
    expect(adapter).toHaveProperty('getChainVersePage');
  });
});

// Chain-scoped rows (getChainVerses): one row per (verse, registered chain), each row
// carrying that chain's OWN local genesis state — raised/progress/participants are never summed
// across chains (each chain settles its own genesis independently). Omni totals ride the
// sidecar fields for the fact row only.
describe('getChainVerses chain-scoped rows', () => {
  const E = 10n ** 18n;
  const okList = (data: unknown[]) => ({ status: 'ok' as const, data });
  const unavailable = { status: 'unavailable' as const, reason: 'rpc-error', detail: 'test' };

  function view(
    chainId: number,
    verseId: bigint,
    raised: { genesis: bigint; leveraged: bigint; preorder: bigint },
    participantCount: number,
    endTime = 1800000000n,
  ) {
    return {
      chainId,
      verseId,
      name: 'Omnichain Verse',
      symbol: 'OCV',
      stage: 'genesis' as const,
      flashGenesis: false,
      uAsset: '0x0000000000000000000000000000000000000uasset',
      memecoin: null,
      pol: null,
      yieldVault: null,
      governor: null,
      incentivizer: null,
      endTime,
      unlockTime: endTime + 86_400n,
      omnichainIds: [97n, 421614n, 84532n],
      communities: [],
      registeredAt: 1790000000n,
      raised,
      participantCount,
    };
  }

  function perChain(lists: Record<number, unknown[] | null>) {
    graphMock.getVerseSummaries.mockImplementation((chainId: number) =>
      Promise.resolve(lists[chainId] ? okList(lists[chainId]!) : unavailable),
    );
  }

  beforeEach(() => graphMock.getVerseSummaries.mockReset());

  it('emits one row per chain with local raised, omni sidecars summed', async () => {
    const adapter = await import('../../../lib/data/onchain-source');
    perChain({
      421614: [view(421614, 123456789n, { genesis: 2n * E, leveraged: 1n * E, preorder: 0n }, 3)],
      84532: [view(84532, 123456789n, { genesis: 4n * E, leveraged: 0n, preorder: 5n * E }, 5)],
      97: [view(97, 123456789n, { genesis: 1n * E, leveraged: 0n, preorder: 2n * E }, 2)],
    });
    const rows = await adapter.getChainVerses();
    expect(graphMock.getVerseSummaries).toHaveBeenCalledTimes(3);
    expect(rows).toHaveLength(3);
    const byChain = new Map(rows.map((row) => [row.chainId, row]));
    // each row shows its own chain's local state — never the cross-chain sum
    expect(byChain.get(421614)!.normalRaised).toBe(2);
    expect(byChain.get(421614)!.leverageInterest).toBe(1);
    expect(byChain.get(421614)!.preorderRaised).toBe(0);
    expect(byChain.get(421614)!.participantCount).toBe(3);
    expect(byChain.get(84532)!.normalRaised).toBe(4);
    expect(byChain.get(97)!.normalRaised).toBe(1);
    // omni sidecars carry the cross-chain totals on every row (2+4+1 / 1+0+0 / 0+5+2 / 3+5+2)
    for (const row of rows) {
      expect(row.id).toBe('123456789');
      expect(row.governanceChain).toBe(97);
      expect(row.omniRaised).toBe(15);
      expect(row.omniParticipantCount).toBe(10);
    }
  });

  it('snapshot: a failed chain read leaves the omni total unknown (never a partial sum)', async () => {
    const adapter = await import('../../../lib/data/onchain-source');
    perChain({
      421614: [view(421614, 1n, { genesis: 1n * E, leveraged: 0n, preorder: 0n }, 1)],
      84532: null,
      97: [view(97, 1n, { genesis: 3n * E, leveraged: 0n, preorder: 0n }, 1)],
    });
    const rows = await adapter.getChainVerses();
    expect(rows[0]!.omniRaised).toBeNull();
    expect(rows[0]!.omniParticipantCount).toBeNull();
  });

  it('snapshot keeps one canonical row per verse (governance chain); chain ids list the indexed chains', async () => {
    const adapter = await import('../../../lib/data/onchain-source');
    perChain({
      421614: [view(421614, 1n, { genesis: 1n * E, leveraged: 0n, preorder: 0n }, 1)],
      84532: null,
      97: [
        view(97, 1n, { genesis: 3n * E, leveraged: 0n, preorder: 0n }, 1),
        view(97, 2n, { genesis: 0n, leveraged: 0n, preorder: 2n * E }, 4),
      ],
    });
    const snapshot = await adapter.getSnapshot();
    expect(snapshot.verses.map((verse) => verse.id)).toEqual(['1', '2']);
    // verse 1: governance-chain (97) canonical row — local 97 state, not the 1+3 sum
    expect(snapshot.verses[0]!.chainId).toBe(97);
    expect(snapshot.verses[0]!.normalRaised).toBe(3);
    expect(snapshot.verses[0]!.participantCount).toBe(1);
    expect(snapshot.verses[1]!.preorderRaised).toBe(2);
    expect(await adapter.getVerseChainIds()).toEqual([97, 421614]);
  });

  it('an unrepresentable timestamp degrades its own slot instead of failing the list', async () => {
    const adapter = await import('../../../lib/data/onchain-source');
    // 8_640_000_000_001s is the first value past Date's ±8.64e15 ms range — toISOString
    // would throw and take the whole getter with it; the row must keep the rest of its data.
    perChain({
      421614: null,
      84532: null,
      97: [view(97, 7n, { genesis: 1n * E, leveraged: 0n, preorder: 0n }, 1, 8_640_000_000_001n)],
    });
    const rows = await adapter.getChainVerses();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.endsAt).toBeNull();
    expect(rows[0]!.unlockTimeAt).toBeNull();
    expect(rows[0]!.normalRaised).toBe(1);
    expect(rows[0]!.createdAt).toBe(new Date(1_790_000_000_000).toISOString());
  });
});

describe('getChainVersePage server page', () => {
  const E = 10n ** 18n;
  const ok = (data: unknown) => ({ status: 'ok' as const, data });

  function summary(chainId: number, verseId: bigint, genesis: bigint, participants: number) {
    return {
      chainId,
      verseId,
      name: 'Omnichain Verse',
      symbol: 'OCV',
      stage: 'genesis' as const,
      flashGenesis: false,
      uAsset: '0x0000000000000000000000000000000000000uasset',
      memecoin: null,
      pol: null,
      yieldVault: null,
      governor: null,
      incentivizer: null,
      endTime: 1800000000n,
      unlockTime: 1800086400n,
      omnichainIds: [97n, 421614n],
      communities: [],
      registeredAt: 1790000000n,
      raised: { genesis, leveraged: 0n, preorder: 0n },
      participantCount: participants,
    };
  }

  beforeEach(() => {
    graphMock.getVerseSummaries.mockReset();
    graphMock.getVersePage.mockReset();
    graphMock.getRaisedSums.mockReset();
  });

  it('serves one chain window with local raised and page-scoped omni sidecar', async () => {
    const adapter = await import('../../../lib/data/onchain-source');
    graphMock.getVersePage.mockResolvedValue(
      ok({ chainId: 97, verses: [summary(97, 7n, 3n * E, 2)], hasMore: true }),
    );
    graphMock.getRaisedSums.mockImplementation((chainId: number) =>
      Promise.resolve(
        chainId === 421614
          ? ok({
              sums: new Map([['7', { genesis: 1n * E, leveraged: 0n, preorder: 0n }]]),
              present: new Set(['7']),
            })
          : ok({ sums: new Map(), present: new Set() }),
      ),
    );
    const page = await adapter.getChainVersePage(97, { stage: 'genesis' }, 24, 0);
    expect(graphMock.getVersePage).toHaveBeenCalledWith(97, { stage: 'genesis' }, 24, 0);
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]!.chainId).toBe(97);
    expect(page.rows[0]!.normalRaised).toBe(3);
    expect(page.rows[0]!.omniRaised).toBe(4);
    // Landed set = the selected chain plus the sibling whose subgraph returned the verse row
    expect(page.rows[0]!.deployedChainIds).toEqual([421614, 97]);
    expect(page.hasMore).toBe(true);
    expect(page.chainIds).toEqual([421614, 84532, 97]);
  });

  it('any sibling leg unread → omniRaised null, never a partial sum', async () => {
    const adapter = await import('../../../lib/data/onchain-source');
    graphMock.getVersePage.mockResolvedValue(
      ok({ chainId: 97, verses: [summary(97, 7n, 3n * E, 2)], hasMore: false }),
    );
    graphMock.getRaisedSums.mockImplementation((chainId: number) =>
      Promise.resolve(
        chainId === 421614
          ? { status: 'unavailable' as const, reason: 'rpc-error' as const, detail: 'timeout' }
          : ok({ sums: new Map(), present: new Set() }),
      ),
    );
    const page = await adapter.getChainVersePage(97, { stage: 'genesis' }, 24, 0);
    expect(page.rows[0]!.omniRaised).toBeNull();
    expect(page.rows[0]!.marketCapUsd).toBeNull();
    // The paged row keeps its chain-local count by design; only the cross-chain total degrades.
  });

  it('chain-0 probe returns the static option set with zero reads', async () => {
    const adapter = await import('../../../lib/data/onchain-source');
    const probe = await adapter.getChainVersePage(0, {}, 1, 0);
    expect(probe).toEqual({ rows: [], total: 0, hasMore: false, chainIds: [421614, 84532, 97] });
    expect(graphMock.getVersePage).not.toHaveBeenCalled();
  });
});

describe('getVerse wallet-chain rows + omni participant count', () => {
  const E = 10n ** 18n;

  function detailView(
    chainId: number,
    raised: { genesis: bigint; leveraged: bigint; preorder: bigint },
    participantCount: number,
  ) {
    return {
      chainId,
      verseId: 77n,
      name: 'Omnichain Verse',
      symbol: 'OCV',
      stage: 'genesis' as const,
      flashGenesis: false,
      uAsset: '0x0000000000000000000000000000000000000uasset',
      memecoin: null,
      pol: null,
      yieldVault: null,
      governor: null,
      incentivizer: null,
      endTime: 1800000000n,
      unlockTime: 1800000000n + 86_400n,
      omnichainIds: [97n, 84532n, 421614n],
      communities: [],
      registeredAt: 1790000000n,
      raised,
      participantCount,
    };
  }

  beforeEach(() => {
    graphMock.getVerseDetail.mockReset();
    // Point reads: 97 and 84532 landed the verse, 421614 did not. The RPC overlay fails
    // (unstubbed env) → the verse returns before the financial overlay, exercising the map.
    graphMock.getVerseDetail.mockImplementation((chainId: number, id: bigint) =>
      Promise.resolve({
        status: 'ok' as const,
        data:
          String(id) === '77' && chainId !== 421614
            ? chainId === 97
              ? detailView(97, { genesis: 1n * E, leveraged: 0n, preorder: 0n }, 2)
              : detailView(84532, { genesis: 4n * E, leveraged: 2n * E, preorder: 0n }, 5)
            : null,
      }),
    );
  });

  it('carries a per-chain row for every landed chain (wallet-chain displays switch on it)', async () => {
    const adapter = await import('../../../lib/data/onchain-source');
    const verse = await adapter.getVerse('77');
    expect(verse).not.toBeNull();
    expect(verse!.chainAggregates!['97']).toEqual({
      normalRaised: 1,
      leverageInterest: 0,
      preorderRaised: 0,
      participantCount: 2,
    });
    expect(verse!.chainAggregates!['84532']).toEqual({
      normalRaised: 4,
      leverageInterest: 2,
      preorderRaised: 0,
      participantCount: 5,
    });
    expect(verse!.chainAggregates!['421614']).toBeUndefined();
    expect(verse!.deployedChainIds).toEqual([97, 84532]);
  });

  it('sums the per-chain distinct participant counts across the landed set', async () => {
    const adapter = await import('../../../lib/data/onchain-source');
    const verse = await adapter.getVerse('77');
    expect(verse!.omniParticipantCount).toBe(7);
    // A chain that answered ok(null) has simply not landed the verse — absence is a valid 0,
    // never a failure that voids the cross-chain totals.
    expect(verse!.omniRaised).toBe(7);
  });

  it('a failed chain read makes the omni total unknown (never a partial sum)', async () => {
    const adapter = await import('../../../lib/data/onchain-source');
    graphMock.getVerseDetail.mockImplementation((chainId: number, id: bigint) =>
      Promise.resolve(
        String(id) === '77' && chainId === 421614
          ? { status: 'unavailable' as const, reason: 'rpc-error' as const, detail: 'timeout' }
          : {
              status: 'ok' as const,
              data:
                String(id) === '77' && chainId !== 421614
                  ? chainId === 97
                    ? detailView(97, { genesis: 1n * E, leveraged: 0n, preorder: 0n }, 2)
                    : detailView(84532, { genesis: 4n * E, leveraged: 2n * E, preorder: 0n }, 5)
                  : null,
            },
      ),
    );
    const verse = await adapter.getVerse('77');
    expect(verse!.omniRaised).toBeNull();
    expect(verse!.omniParticipantCount).toBeNull();
  });
});

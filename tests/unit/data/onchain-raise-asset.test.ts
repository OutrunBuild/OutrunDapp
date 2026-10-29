// Unknown raise-asset degradation (own file: the deployment tables stay `deployed` only with
// the RPC env placeholders provisioned, and that provisioning must not leak into
// onchain-adapter.test.ts whose wallet-chain tests rely on an unstubbed env — the verse-fin
// overlay short-circuits there). Same provisioning precedent as onchain-trade.test.ts.
// A uAsset address outside the static deployment tables resolves to null — never to a
// known-symbol sentinel (a 'UUSD' fallback would ride par pricing and fabricate USD market
// caps). Every raise-asset slot degrades instead.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

process.env.ALCHEMY_KEY_BSC_TESTNET ??= 'test-key';
process.env.INFURA_KEY_BSC_TESTNET ??= 'test-key';
process.env.SUBGRAPH_ENDPOINT_BSC_TESTNET ??= 'http://subgraph.test';

const graphMock = vi.hoisted(() => ({
  getVerseSummaries: vi.fn(),
}));
vi.mock('@/lib/data/graph/graph-repository', () => ({
  getGraphRepository: () => graphMock,
}));

// The RPC edge stays a seam stub (§11.1): a real threshold read 401s through the fallback
// transport for seconds each run (past the 5s default timeout under full-suite load). Same
// degradation either way — unwrap maps `unavailable` to null, exactly as the 401s did.
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
for (const read of Object.values(rpcMock))
  read.mockResolvedValue({ status: 'unavailable' as const, reason: 'rpc-error', detail: 'test' });

describe('unknown raise-asset degradation', () => {
  const E = 10n ** 18n;
  const okList = (data: unknown[]) => ({ status: 'ok' as const, data });
  const UNKNOWN_UASSET = '0x0000000000000000000000000000000000000uasset';

  function view(verseId: bigint, uAsset: string) {
    return {
      chainId: 97,
      verseId,
      name: 'Omnichain Verse',
      symbol: 'OCV',
      stage: 'genesis' as const,
      flashGenesis: false,
      uAsset,
      memecoin: null,
      pol: null,
      yieldVault: null,
      governor: null,
      incentivizer: null,
      endTime: 1800000000n,
      unlockTime: 1800000000n + 86_400n,
      omnichainIds: [97n],
      communities: [],
      registeredAt: 1790000000n,
      raised: { genesis: 5n * E, leveraged: 0n, preorder: 0n },
      participantCount: 1,
    };
  }

  beforeEach(() => graphMock.getVerseSummaries.mockReset());

  it('out-of-table uAsset: raiseAsset null and genesis market cap null; in-table UUSD keeps par pricing', async () => {
    const adapter = await import('../../../lib/data/onchain-source');
    const deployment = JSON.parse(readFileSync(join(repo, 'deployments/97.json'), 'utf8'));
    const uusd = deployment.contracts['UAsset.UUSD'] as string;
    graphMock.getVerseSummaries.mockImplementation((chainId: number) =>
      Promise.resolve(
        chainId === 97 ? okList([view(1n, UNKNOWN_UASSET), view(2n, uusd)]) : okList([]),
      ),
    );
    const rows = await adapter.getChainVerses();
    const byId = new Map(rows.map((row) => [row.id, row]));
    // unknown address: label and USD cap slots degrade (null 不渲染), no borrowed symbol
    expect(byId.get('1')!.raiseAsset).toBeNull();
    expect(byId.get('1')!.marketCapUsd).toBeNull();
    // genuine UUSD verse: unchanged — par 1, cap = raised × 2 (POL match) × 1
    expect(byId.get('2')!.raiseAsset).toBe('UUSD');
    expect(byId.get('2')!.marketCapUsd).toBe(10);
  });

  it('participation options fail closed for a null raise asset (no borrowed contracts)', async () => {
    const adapter = await import('../../../lib/data/onchain-source');
    expect(await adapter.getParticipationOptions(null)).toEqual({
      raiseAsset: null,
      reserves: [],
      yieldSourceRegistry: [],
      creditAsset: null,
    });
  });

  it('null symbol has no USD sample on either build (rows hide)', async () => {
    const adapter = await import('../../../lib/data/onchain-source');
    const fixtures = await import('../../../lib/data/fixture-repository');
    expect(await adapter.getAssetUsdPrice(null)).toBeNull();
    expect(fixtures.getAssetUsdPrice(null)).toBeNull();
  });
});

// invalidateVerse detaches the Map entry and deletes the seed; a refresh that was already in
// flight must not re-publish its pre-write value into the disk seed afterwards (the write-refresh
// converge-once contract, docs/engineering/performance.md). The seed store is mocked so the
// detached-settle write is observable per key.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildGraphRepository } from '../../../lib/data/graph/graph-repository';
import type { GraphPort, GraphResponse } from '../../../lib/data/graph/graph-port';
import { resolveOutrunChain } from '../../../lib/web3/chains';

const seedMock = vi.hoisted(() => ({
  readSeed: vi.fn(() => null),
  writeSeed: vi.fn(),
  deleteSeed: vi.fn(),
  deleteSeedsMatching: vi.fn(),
}));
vi.mock('../../../lib/data/persisted-swr', () => seedMock);

const ENV = {
  ALCHEMY_KEY_ARB_SEPOLIA: 'k',
  INFURA_KEY_ARB_SEPOLIA: 'k',
  ALCHEMY_KEY_BASE_SEPOLIA: 'k',
  INFURA_KEY_BASE_SEPOLIA: 'k',
  ALCHEMY_KEY_BSC_TESTNET: 'k',
  INFURA_KEY_BSC_TESTNET: 'k',
  SUBGRAPH_ENDPOINT_ARB_SEPOLIA: 'https://api.thegraph.com/deployments/id/arb',
  SUBGRAPH_ENDPOINT_BASE_SEPOLIA: 'https://api.thegraph.com/deployments/id/base',
  SUBGRAPH_ENDPOINT_BSC_TESTNET: 'https://api.thegraph.com/deployments/id/bnb',
};

// Stored totals present, so the detail read is a single round trip (no VerseDetailLegs follow-up).
const DETAIL_DATA = {
  verses: [
    {
      verseId: '1',
      name: 'Moon',
      symbol: 'MOON',
      stage: 'genesis',
      flashGenesis: true,
      uAsset: '0xuusd',
      memecoin: '0xmemecoin',
      pol: '0xpol',
      yieldVault: '0xvault',
      governor: '0xgov',
      incentivizer: '0xinc',
      endTime: '1770000000',
      unlockTime: '1801536000',
      omnichainIds: ['40231'],
      communities: [],
      registeredAtTimestamp: '1768000000',
      totalGenesisFunds: '3000000000000000000',
      totalLeveragedInterest: '250000000000000000',
      totalPreorderFunds: '500000000000000000',
      participantCount: 4,
    },
  ],
};

/** Port whose reads stay pending until the test settles them (one at a time). */
class DeferredPort implements GraphPort {
  calls = 0;
  private settleFn: ((response: GraphResponse<unknown>) => void) | null = null;

  query<T>(_endpoint: string, _document: string, _variables?: Record<string, unknown>) {
    this.calls += 1;
    return new Promise<GraphResponse<T>>((resolve) => {
      this.settleFn = (response) => resolve(response as GraphResponse<T>);
    });
  }

  settle(data: unknown): void {
    const settle = this.settleFn;
    if (!settle) throw new Error('no pending query to settle');
    this.settleFn = null;
    settle({ data, meta: { block: { number: 1, hasIndexingErrors: false } } });
  }
}

const make = (port: GraphPort) =>
  buildGraphRepository(
    port,
    (chainId) => resolveOutrunChain(chainId, ENV),
    60_000,
    () => 0,
    'test-graph-inflight',
  );

beforeEach(() => {
  seedMock.readSeed.mockClear();
  seedMock.writeSeed.mockClear();
  seedMock.deleteSeed.mockClear();
  seedMock.deleteSeedsMatching.mockClear();
});

describe('invalidateVerse vs an in-flight graph refresh', () => {
  it('a settle after invalidation answers its caller but never rewrites the seed', async () => {
    const port = new DeferredPort();
    const repo = make(port);
    const pending = repo.getVerseDetail(421614, 1n); // cold key: the first fetch blocks
    expect(port.calls).toBe(1);

    seedMock.writeSeed.mockClear();
    seedMock.deleteSeed.mockClear();
    repo.invalidateVerse(1n);
    expect(seedMock.deleteSeed).toHaveBeenCalledWith(
      'test-graph-inflight',
      expect.stringContaining('query VerseDetail('),
    );

    port.settle(DETAIL_DATA);
    const result = await pending;
    expect(result.status).toBe('ok'); // the already-issued read still serves its caller
    // …but the detached settle must not re-publish the pre-write value into the seed.
    expect(seedMock.writeSeed).not.toHaveBeenCalled();
  });

  it('a settle on an entry that still owns its key keeps writing the seed', async () => {
    const port = new DeferredPort();
    const repo = make(port);
    const pending = repo.getVerseDetail(421614, 1n);
    expect(port.calls).toBe(1);

    port.settle(DETAIL_DATA);
    await pending;

    expect(seedMock.writeSeed).toHaveBeenCalledTimes(1);
    expect(seedMock.writeSeed).toHaveBeenCalledWith(
      'test-graph-inflight',
      expect.stringContaining('query VerseDetail('),
      0,
      expect.objectContaining({ status: 'ok' }),
    );
  });
});

// Graph onchain-repository tests (stage 5 step 6). These lock the three runbook guarantees:
//  ① a lagging `_meta` block still returns aggregates unchanged, with NO degraded/stale marker
//    injected anywhere (silent degrade, §9/§24)
//  ② RPC-authoritative fields (balances/allowances/account code/tx outcomes) never appear in
//    graph-sourced views — indexed data structurally cannot override them
//  ③ graph transport/query failures collapse to structured unavailable (rpc-error), never throw
// Plus cache/dedup behavior (single port hit for concurrent and TTL-window calls).
import { describe, expect, it } from 'vitest';
import { buildGraphRepository } from '../../../lib/data/graph/graph-repository';
import type { GraphPort, GraphResponse } from '../../../lib/data/graph/graph-port';
import { resolveOutrunChain } from '../../../lib/web3/chains';
import type { DataResult } from '../../../lib/data/repository';

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

const AGGREGATE_DATA = {
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
      omnichainIds: ['40231', '40245'],
      communities: ['x'],
      registeredAtTimestamp: '1768000000',
    },
  ],
  genesisParticipations: [
    { verseId: '1', payer: '0xa', depositer: '0xa', amount: '1000000000000000000' },
    { verseId: '1', payer: '0xb', depositer: '0xb', amount: '2000000000000000000' },
  ],
  preorderParticipations: [
    { verseId: '1', caller: '0xc', user: '0xc', amountInUAsset: '500000000000000000' },
  ],
  leveragedGenesisParticipations: [
    { verseId: '1', payer: '0xd', user: '0xd', amount: '250000000000000000' },
  ],
};

const HISTORY_DATA = {
  genesisParticipations: [
    {
      verseId: '1',
      payer: '0xa',
      depositer: '0xa',
      amount: '1000000000000000000',
      blockTimestamp: '1769000000',
    },
  ],
  preorderParticipations: [],
  leveragedGenesisParticipations: [],
  participationClaims: [
    { verseId: '1', kind: 'normal-yt', receiver: '0xa', blockTimestamp: '1769000100' },
  ],
};

const REFERRAL_DATA = {
  referralRebates: [
    {
      kind: 'accrued',
      currency: '0xuusd',
      amount: '1000000000000000',
      blockTimestamp: '1769000000',
    },
    {
      kind: 'claimed',
      currency: '0xuusd',
      amount: '900000000000000',
      blockTimestamp: '1769000200',
    },
  ],
};

class StubGraphPort implements GraphPort {
  calls = 0;
  metaBlock = 1_000;
  failNext = false;
  async query<T>(_endpoint: string, document: string): Promise<GraphResponse<T>> {
    this.calls += 1;
    if (this.failNext) {
      this.failNext = false;
      throw new Error('graph endpoint HTTP 502');
    }
    const data = document.includes('ParticipationHistory')
      ? HISTORY_DATA
      : document.includes('ReferralHistory')
        ? REFERRAL_DATA
        : AGGREGATE_DATA;
    return {
      data: data as unknown as T,
      meta: { block: { number: this.metaBlock, hasIndexingErrors: false } },
    };
  }
}

const setup = (safeBlock: number = 1_000) => {
  const port = new StubGraphPort();
  const repo = buildGraphRepository(
    port,
    (chainId) => resolveOutrunChain(chainId, ENV),
    async () => ({ status: 'ok', data: safeBlock }) as DataResult<number>,
  );
  return { repo, port };
};

describe('① silent degrade: index lag never changes the payload', () => {
  it('returns identical aggregates whether the index is at head or 500 blocks behind', async () => {
    const fresh = setup(1_000);
    const freshResult = await fresh.repo.getVerseSummaries(421614);
    const stale = setup(1_500); // safe block 500 ahead of the index position
    const staleResult = await stale.repo.getVerseSummaries(421614);
    expect(freshResult).toEqual(staleResult);
    expect(freshResult.status).toBe('ok');
  });

  it('injects no lag/degrade/sync marker anywhere in the result', async () => {
    const { repo } = setup(9_999);
    const r = await repo.getVerseSummaries(421614);
    expect(r.status).toBe('ok');
    const serialized = JSON.stringify(r, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
    expect(serialized).not.toMatch(/lag|degrad|stale|sync|pending|outofdate/i);
  });

  it('keeps aggregates alive when the safe-block reader itself fails', async () => {
    const port = new StubGraphPort();
    const repo = buildGraphRepository(
      port,
      (chainId) => resolveOutrunChain(chainId, ENV),
      async () => ({ status: 'unavailable', reason: 'rpc-error', detail: 'rpc down' }),
    );
    const r = await repo.getHomeMetrics(421614);
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.data.verseCount).toBe(1);
  });
});

describe('② RPC-authoritative fields never come from the graph', () => {
  const FORBIDDEN = /balance|allowance|delegation|nonce|receipt|codehash|accountcode/i;
  it('verse/home/history views carry no balance/allowance/code/receipt keys', async () => {
    const { repo } = setup();
    const summaries = await repo.getVerseSummaries(421614);
    const metrics = await repo.getHomeMetrics(421614);
    const history = await repo.getParticipationHistory(421614, '0xa');
    const referral = await repo.getReferralHistory(421614, '0xa');
    const replacer = (_k: string, v: unknown) => (typeof v === 'bigint' ? v.toString() : v);
    for (const result of [summaries, metrics, history, referral]) {
      expect(result.status).toBe('ok');
      expect(JSON.stringify(result, replacer)).not.toMatch(FORBIDDEN);
    }
  });
});

describe('③ failures collapse to structured unavailable', () => {
  it('transport failure → rpc-error, never a throw', async () => {
    const { repo, port } = setup();
    port.failNext = true;
    const r = await repo.getVerseSummaries(421614);
    expect(r).toMatchObject({
      status: 'unavailable',
      reason: 'rpc-error',
      detail: expect.stringContaining('502'),
    });
  });

  it('missing subgraph endpoint → not-configured', async () => {
    const port = new StubGraphPort();
    const repo = buildGraphRepository(port, (chainId) =>
      resolveOutrunChain(chainId, { ...ENV, SUBGRAPH_ENDPOINT_ARB_SEPOLIA: '' }),
    );
    const r = await repo.getVerseSummaries(421614);
    expect(r).toMatchObject({ status: 'unavailable', reason: 'not-configured' });
  });
});

describe('mapping correctness (interface-mocked port)', () => {
  it('maps verse rows and participation aggregates', async () => {
    const { repo } = setup();
    const r = await repo.getVerseSummaries(421614);
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.data).toHaveLength(1);
    const verse = r.data[0]!;
    expect(verse.verseId).toBe(1n);
    expect(verse.stage).toBe('genesis');
    expect(verse.raised).toEqual({
      genesis: 3_000_000_000_000_000_000n,
      leveraged: 250_000_000_000_000_000n,
      preorder: 500_000_000_000_000_000n,
    });
    expect(verse.participantCount).toBe(3); // 0xa, 0xb via genesis + 0xc via preorder
    expect(verse.omnichainIds).toEqual([40231n, 40245n]);
  });

  it('detail lookup finds by numeric verseId or returns null', async () => {
    const { repo } = setup();
    const hit = await repo.getVerseDetail(421614, 1n);
    expect(hit.status).toBe('ok');
    if (hit.status === 'ok') expect(hit.data?.verseId).toBe(1n);
    const miss = await repo.getVerseDetail(421614, 99n);
    expect(miss).toEqual({ status: 'ok', data: null });
  });

  it('home metrics sum all participation kinds and count distinct addresses', async () => {
    const { repo } = setup();
    const r = await repo.getHomeMetrics(421614);
    expect(r).toEqual({
      status: 'ok',
      data: {
        verseCount: 1,
        deployedVerseCount: 0,
        participantCount: 4, // 0xa 0xb 0xc 0xd
        participationTotal: 3_750_000_000_000_000_000n,
      },
    });
  });
});

describe('short cache + in-flight dedup (§9)', () => {
  it('serves concurrent and TTL-window calls from one port hit', async () => {
    const { repo, port } = setup();
    const [a, b] = await Promise.all([
      repo.getVerseSummaries(421614),
      repo.getVerseSummaries(421614),
    ]);
    await repo.getVerseSummaries(421614);
    expect(a.status).toBe('ok');
    expect(b.status).toBe('ok');
    expect(port.calls).toBe(1);
  });

  it('serves stale past the TTL window immediately and refreshes in background', async () => {
    const port = new StubGraphPort();
    let clock = 0;
    const repo = buildGraphRepository(
      port,
      (chainId) => resolveOutrunChain(chainId, ENV),
      async () => ({ status: 'ok', data: 1 }) as DataResult<number>,
      1_000,
      () => clock,
    );
    const first = await repo.getVerseSummaries(421614);
    clock = 2_000;
    const served = await repo.getVerseSummaries(421614);
    expect(served).toEqual(first); // expired key: last ok value returns without waiting
    await new Promise((resolve) => setImmediate(resolve)); // background refresh lands
    expect(port.calls).toBe(2);
  });

  it('seeds a cold process from the persisted store and refreshes in background', async () => {
    const ns = 'test-graph-seed';
    const port = new StubGraphPort();
    const make = () =>
      buildGraphRepository(
        port,
        (chainId) => resolveOutrunChain(chainId, ENV),
        async () => ({ status: 'ok', data: 1 }) as DataResult<number>,
        60_000,
        () => 0,
        ns,
      );
    const first = await make().getVerseSummaries(421614); // populates memory + disk seed
    expect(first.status).toBe('ok');
    // a second instance (≈ another render-worker process) serves the seed instantly…
    const second = await make().getVerseSummaries(421614);
    expect(second).toEqual(first);
    // …while its background refresh still lands on the port
    await new Promise((resolve) => setImmediate(resolve));
    expect(port.calls).toBe(2);
  });
});

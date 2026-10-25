// Post-write refresh orchestration: the freshness gate must hold invalidation back until the
// subgraph index passes the write's own block (receipt lookup by hash; safe head as the
// fallback) — invalidating early would let the cold re-fetch re-cache PRE-write aggregates
// under a fresh timestamp and reset the stale value's TTL clock. Past the bounded gate
// deadline the refresh proceeds anyway (best-effort).
import { describe, expect, it } from 'vitest';

import {
  orchestrateVerseRefresh,
  type WriteRefreshDeps,
} from '../../../lib/data/write-refresh-core';

type DepState = {
  head: number;
  indexed: number[]; // per-poll answers (last one repeats)
  sleeps: number;
  invalidatedVerse: bigint | null;
  invalidatedConfig: string | null;
  primed: string | null;
  primeFails: boolean;
};

const depsOf = (state: DepState): WriteRefreshDeps => ({
  getWriteBlock: async () => state.head,
  getIndexedBlock: async () => {
    const next = state.indexed.length > 1 ? (state.indexed.shift() as number) : state.indexed[0]!;
    return next;
  },
  invalidateVerse: (verseId) => {
    state.invalidatedVerse = verseId;
  },
  invalidateVerseConfig: (verseId) => {
    state.invalidatedConfig = verseId;
  },
  primeVerse: async (verseId) => {
    if (state.primeFails) throw new Error('prime rpc down');
    state.primed = verseId;
  },
  sleep: async () => {
    state.sleeps += 1;
  },
});

describe('orchestrateVerseRefresh', () => {
  it('index already past the head: invalidates and primes with zero waiting', async () => {
    const state: DepState = {
      head: 100,
      indexed: [105],
      sleeps: 0,
      invalidatedVerse: null,
      invalidatedConfig: null,
      primed: null,
      primeFails: false,
    };
    await orchestrateVerseRefresh(depsOf(state), { chainId: 97, verseId: '21' });
    expect(state.sleeps).toBe(0);
    expect(state.invalidatedVerse).toBe(21n);
    expect(state.invalidatedConfig).toBe('21');
    expect(state.primed).toBe('21');
  });

  it('index behind: waits per poll, then invalidates only once the gate passes', async () => {
    const state: DepState = {
      head: 100,
      indexed: [98, 99, 100],
      sleeps: 0,
      invalidatedVerse: null,
      invalidatedConfig: null,
      primed: null,
      primeFails: false,
    };
    await orchestrateVerseRefresh(depsOf(state), { chainId: 97, verseId: '21' });
    expect(state.sleeps).toBe(2);
    // Invalidation must not have landed during the polls (order is the whole point of the gate)
    expect(state.invalidatedVerse).toBe(21n);
    expect(state.primed).toBe('21');
  });

  it('gate deadline: a stuck index still gets the refresh through (bounded 6 attempts)', async () => {
    const state: DepState = {
      head: 100,
      indexed: [50],
      sleeps: 0,
      invalidatedVerse: null,
      invalidatedConfig: null,
      primed: null,
      primeFails: false,
    };
    await orchestrateVerseRefresh(depsOf(state), { chainId: 97, verseId: '21' });
    expect(state.sleeps).toBe(6);
    expect(state.invalidatedVerse).toBe(21n);
    expect(state.primed).toBe('21');
  });

  it('unreadable target block skips the gate entirely (no sleeps)', async () => {
    const state: DepState = {
      head: -1,
      indexed: [0],
      sleeps: 0,
      invalidatedVerse: null,
      invalidatedConfig: null,
      primed: null,
      primeFails: false,
    };
    const deps = { ...depsOf(state), getWriteBlock: async () => null };
    await orchestrateVerseRefresh(deps, { chainId: 97, verseId: '21' });
    expect(state.sleeps).toBe(0);
    expect(state.invalidatedVerse).toBe(21n);
  });

  it('the write’s tx hash rides through to the target resolver (receipt-block gate)', async () => {
    const state: DepState = {
      head: 100,
      indexed: [105],
      sleeps: 0,
      invalidatedVerse: null,
      invalidatedConfig: null,
      primed: null,
      primeFails: false,
    };
    const seen: Array<[number, string | null]> = [];
    const deps = {
      ...depsOf(state),
      getWriteBlock: async (chainId: number, txHash: string | null) => {
        seen.push([chainId, txHash]);
        return 100;
      },
    };
    await orchestrateVerseRefresh(deps, { chainId: 97, verseId: '21', txHash: '0xabc' });
    expect(seen).toEqual([[97, '0xabc']]);
    expect(state.sleeps).toBe(0);
    expect(state.primed).toBe('21');
  });

  it('a failing prime never fails the refresh (caches stay cold for the next render)', async () => {
    const state: DepState = {
      head: 100,
      indexed: [105],
      sleeps: 0,
      invalidatedVerse: null,
      invalidatedConfig: null,
      primed: null,
      primeFails: true,
    };
    await expect(
      orchestrateVerseRefresh(depsOf(state), { chainId: 97, verseId: '21' }),
    ).resolves.toBeUndefined();
    expect(state.invalidatedVerse).toBe(21n);
    expect(state.primed).toBeNull();
  });
});

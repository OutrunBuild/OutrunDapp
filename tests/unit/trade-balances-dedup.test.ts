// sharedVerseProbe dedup contract tests (no chain): concurrent same-key callers join ONE
// network run, distinct keys run apart, a shared failure rejects every joiner and clears the
// in-flight slot so the next call starts fresh.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Hex } from 'viem';

import { getVerseSession } from '../../components/global/write-session';
import { sharedVerseProbe } from '../../components/verse/trade-balances';

vi.mock('../../components/global/write-session', () => ({
  getVerseSession: vi.fn(),
}));

// The real export is overloaded; the tests only need the bare vi.fn handle.
const getVerseSessionMock = getVerseSession as unknown as ReturnType<typeof vi.fn>;

const MEMECOIN = '0x1111111111111111111111111111111111111111' as Hex;
const UASSET = '0x2222222222222222222222222222222222222222' as Hex;
const POL = '0x3333333333333333333333333333333333333333' as Hex;
const ACCOUNT = '0x4444444444444444444444444444444444444444' as Hex;

const slotOk = (result: unknown) => ({ status: 'success', result }) as const;

// The probe walks 3 batches; with no splitter/router/psm/vault only batch 3 fires —
// 3 core legs × (balanceOf + decimals). Gate its promise to hold the run open mid-flight.
const stubSession = () => {
  let release!: (value: unknown) => void;
  const gated = new Promise((resolve) => {
    release = resolve;
  });
  const multicall = vi.fn(() => gated);
  getVerseSessionMock.mockReturnValue({
    client: { multicall },
    reader: { read: vi.fn() },
    contracts: {},
    verse: { memecoin: MEMECOIN, uAsset: UASSET, pol: POL, yieldVault: undefined },
  });
  const settle = () =>
    release(
      Array.from({ length: 6 }, (_, index) =>
        index % 2 === 0 ? slotOk(1_000_000_000_000_000_000n) : slotOk(18),
      ),
    );
  return { multicall, settle };
};

const stubRejectingSession = () => {
  getVerseSessionMock.mockReturnValue({
    client: { multicall: vi.fn(() => Promise.reject(new Error('transport down'))) },
    reader: { read: vi.fn() },
    contracts: {},
    verse: { memecoin: MEMECOIN, uAsset: UASSET, pol: POL, yieldVault: undefined },
  });
};

const depsOf = (overrides?: Partial<Parameters<typeof sharedVerseProbe>[0]>) => ({
  provider: { request: vi.fn() },
  execChain: 97,
  account: ACCOUNT,
  verseId: '42',
  ...overrides,
});

describe('sharedVerseProbe', () => {
  beforeEach(() => {
    getVerseSessionMock.mockReset();
  });

  it('joins concurrent same-key callers into one network run and self-cleans on settle', async () => {
    const { multicall, settle } = stubSession();
    const deps = depsOf();

    const first = sharedVerseProbe(deps);
    const second = sharedVerseProbe(deps);
    expect(first).toBe(second);
    expect(getVerseSessionMock).toHaveBeenCalledTimes(1);

    settle();
    await Promise.all([first, second]);
    expect(multicall).toHaveBeenCalledTimes(1);

    // Settled runs leave the map: the next caller starts a fresh run, not a stale result.
    const rerun = stubSession();
    const third = sharedVerseProbe(deps);
    expect(getVerseSessionMock).toHaveBeenCalledTimes(2);
    rerun.settle();
    await third;
  });

  it('runs distinct probe shapes apart (uAssetSymbol is part of the key)', async () => {
    const one = stubSession();
    const two = stubSession();
    const withReserve = sharedVerseProbe(depsOf({ uAssetSymbol: 'UUSD' }));
    const withoutReserve = sharedVerseProbe(depsOf());
    expect(withReserve).not.toBe(withoutReserve);
    expect(getVerseSessionMock).toHaveBeenCalledTimes(2);

    one.settle();
    two.settle();
    await Promise.all([withReserve, withoutReserve]);
  });

  it('a shared failure rejects every joiner and clears the in-flight slot', async () => {
    stubRejectingSession();
    const deps = depsOf();

    const first = sharedVerseProbe(deps);
    const second = sharedVerseProbe(deps);
    await expect(first).rejects.toThrow('transport down');
    await expect(second).rejects.toThrow('transport down');
    expect(getVerseSessionMock).toHaveBeenCalledTimes(1);

    // The rejected run left the map: the next caller starts a new run.
    await expect(sharedVerseProbe(deps)).rejects.toThrow('transport down');
    expect(getVerseSessionMock).toHaveBeenCalledTimes(2);
  });
});

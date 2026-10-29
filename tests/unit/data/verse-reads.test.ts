// Cross-chain account reads: the server action is the callers' only way to see a sibling chain's
// balance. Two contracts matter at this layer — a pseudo address must never reach the RPC, and a
// failed leg must be ABSENT from the map (callers render '--'); a fabricated 0 would read as
// "you hold nothing on that chain".
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAccountGenesisFunds: vi.fn(),
  getVerseLockedAt: vi.fn(),
}));

vi.mock('@/lib/data/repository', () => ({
  getOnchainRepository: () => ({ getAccountGenesisFunds: mocks.getAccountGenesisFunds }),
}));
vi.mock('@/lib/data/graph/graph-repository', () => ({
  getGraphRepository: () => ({ getVerseLockedAt: mocks.getVerseLockedAt }),
}));

import { readGenesisFundsByChain, readVerseLockedAt } from '../../../lib/data/verse-reads';

const ACCOUNT = '0x1111111111111111111111111111111111111111';

beforeEach(() => {
  mocks.getAccountGenesisFunds.mockReset();
  mocks.getVerseLockedAt.mockReset();
});

describe('readGenesisFundsByChain', () => {
  it('rejects a pseudo address before any RPC read', async () => {
    const out = await readGenesisFundsByChain({ verseId: '1', chains: [97], account: '0x1234' });
    expect(out).toEqual({});
    expect(mocks.getAccountGenesisFunds).not.toHaveBeenCalled();
  });

  it('rejects a non-numeric verse id', async () => {
    const out = await readGenesisFundsByChain({
      verseId: 'verse-021',
      chains: [97],
      account: ACCOUNT,
    });
    expect(out).toEqual({});
    expect(mocks.getAccountGenesisFunds).not.toHaveBeenCalled();
  });

  it('keeps only the ok legs — a failed chain is absent, never a zero', async () => {
    mocks.getAccountGenesisFunds.mockImplementation((chainId: number) =>
      Promise.resolve(
        chainId === 97
          ? { status: 'ok', data: 5n * 10n ** 18n }
          : { status: 'unavailable', reason: 'rpc-error' },
      ),
    );
    const out = await readGenesisFundsByChain({
      verseId: '7',
      chains: [97, 84532],
      account: ACCOUNT,
    });
    expect(out).toEqual({ '97': (5n * 10n ** 18n).toString() });
    expect(Object.keys(out)).toEqual(['97']);
    expect(mocks.getAccountGenesisFunds).toHaveBeenCalledWith(97, 7n, ACCOUNT);
  });
});

describe('readVerseLockedAt', () => {
  it('rejects a non-numeric verse id without touching the graph', async () => {
    expect(await readVerseLockedAt({ chainId: 97, verseId: 'x' })).toBeNull();
    expect(mocks.getVerseLockedAt).not.toHaveBeenCalled();
  });

  it('passes a numeric verse id through as a bigint', async () => {
    mocks.getVerseLockedAt.mockResolvedValue(1_770_000_000);
    expect(await readVerseLockedAt({ chainId: 97, verseId: '12' })).toBe(1_770_000_000);
    expect(mocks.getVerseLockedAt).toHaveBeenCalledWith(97, 12n);
  });
});

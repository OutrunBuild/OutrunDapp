// Referral SSR getter (getReferral): the rate rides the hook's global referrerRebateBps
// (zero-address read via the config cache); the short code has no on-chain source at all.
// Both degrade to null slots — a failed read must never surface as a fabricated 0% and the
// missing code never as an empty-code /ref/ link.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { deleteSeed } from '../../../lib/data/persisted-swr';

// Chain resolution fails closed without RPC env placeholders — provision before the adapter import.
process.env.ALCHEMY_KEY_BSC_TESTNET ??= 'test-key';
process.env.INFURA_KEY_BSC_TESTNET ??= 'test-key';
process.env.SUBGRAPH_ENDPOINT_BSC_TESTNET ??= 'http://subgraph.test';

// The cleanup namespace must ride the same constant production writes seeds under — a literal
// copy here would silently orphan this cleanup on the next seed-namespace bump
const { CONFIG_SEED_NS } = await import('../../../lib/data/onchain-source');

const rpcMock = vi.hoisted(() => ({
  getReferralSnapshot: vi.fn(),
}));
vi.mock('@/lib/data/repository', () => ({
  getOnchainRepository: () => rpcMock,
}));
const graphMock = vi.hoisted(() => ({}));
vi.mock('@/lib/data/graph/graph-repository', () => ({
  getGraphRepository: () => graphMock,
}));

const ok = <T>(data: T) => ({ status: 'ok' as const, data });
const unavailable = { status: 'unavailable' as const, reason: 'rpc-error', detail: 'test' };

describe('getReferral degradation', () => {
  beforeEach(() => {
    // The config cache and its disk seed outlive the module across resetModules — clear
    // both so each test starts from a cold cache regardless of execution order
    deleteSeed(CONFIG_SEED_NS, 'referral-97');
    rpcMock.getReferralSnapshot.mockReset();
    vi.resetModules();
  });

  it('a failed snapshot read degrades the rate to null (never a fabricated 0%)', async () => {
    rpcMock.getReferralSnapshot.mockResolvedValue(unavailable);
    const adapter = await import('../../../lib/data/onchain-source');
    const referral = await adapter.getReferral();
    expect(referral).not.toBeNull();
    expect(referral!.ratePercent).toBeNull();
    expect(referral!.referralCode).toBeNull();
  });

  it('a good snapshot serves the rate; the code stays null with no on-chain source', async () => {
    rpcMock.getReferralSnapshot.mockResolvedValue(ok({ ratePercent: 10, pending: [] }));
    const adapter = await import('../../../lib/data/onchain-source');
    const referral = await adapter.getReferral();
    expect(referral!.ratePercent).toBe(10);
    expect(referral!.referralCode).toBeNull();
  });
});

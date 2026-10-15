// lib/web3 public-client tests (stage 5 step 2): the read-side client only exists for chains that
// resolve with provisioned RPC; undeployed (mainnet) and env-missing cases return null, and the
// client is a per-chain singleton. No network access happens at creation time.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const RPC_VARS = [
  'ALCHEMY_KEY_ARB_SEPOLIA',
  'INFURA_KEY_ARB_SEPOLIA',
  'ALCHEMY_KEY_BASE_SEPOLIA',
  'INFURA_KEY_BASE_SEPOLIA',
  'ALCHEMY_KEY_BSC_TESTNET',
  'INFURA_KEY_BSC_TESTNET',
] as const;

// the config cache lives at module level: each test re-imports a fresh module under its own env
beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllEnvs());

describe('public client factory', () => {
  it('returns null for every chain when RPC env is unprovisioned', async () => {
    for (const v of RPC_VARS) vi.stubEnv(v, '');
    const { getPublicClient } = await import('../../../lib/web3/public-client');
    expect(getPublicClient(421614)).toBeNull();
    expect(getPublicClient(84532)).toBeNull();
    expect(getPublicClient(97)).toBeNull();
  });

  it('creates a cached client per provisioned testnet chain', async () => {
    for (const v of RPC_VARS) vi.stubEnv(v, 'test-key');
    const { getPublicClient } = await import('../../../lib/web3/public-client');
    const arb = getPublicClient(421614);
    expect(arb).not.toBeNull();
    expect(arb!.chain!.id).toBe(421614);
    expect(getPublicClient(421614)).toBe(arb); // per-chain singleton
    expect(getPublicClient(97)!.chain!.id).toBe(97);
  });

  it('returns null for structurally undeployed mainnet chains regardless of env', async () => {
    for (const v of RPC_VARS) vi.stubEnv(v, 'test-key');
    const { getPublicClient } = await import('../../../lib/web3/public-client');
    expect(getPublicClient(1)).toBeNull();
    expect(getPublicClient(8453)).toBeNull();
    expect(getPublicClient(56)).toBeNull();
    expect(getPublicClient(1337)).toBeNull();
  });
});

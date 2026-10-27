// Capability-probe cache: the wallet round trip is seconds on some builds, so one probe must
// cover every click of a connection — without pinning a stale "no", and without surviving the
// send path's own "method unavailable" verdict.
import { describe, expect, it } from 'vitest';
import type { Hex } from 'viem';

import type { Eip1193ProviderLike } from '../../../lib/web3/active-provider';
import { forgetAtomicCalls, resolveAtomicCalls } from '../../../lib/web3/tx-executor';

const EOA = '0x1111111111111111111111111111111111111111' as Hex;
const OTHER = `0x${'22'.repeat(20)}` as Hex;

function providerAnswering(status: 'supported' | 'unsupported') {
  const methods: string[] = [];
  const provider: Eip1193ProviderLike = {
    request: async (args) => {
      methods.push(args.method);
      if (args.method === 'wallet_getCapabilities') {
        return { 97: { atomic: { status } } };
      }
      throw new Error(`unexpected ${args.method}`);
    },
  };
  return { provider, methods };
}

describe('wallet_getCapabilities cache', () => {
  it('shares one probe across clicks on the same connection, chain and account', async () => {
    const { provider, methods } = providerAnswering('supported');
    expect(await resolveAtomicCalls(provider, 97, EOA)).toBe(true);
    expect(await resolveAtomicCalls(provider, 97, EOA)).toBe(true);
    expect(methods).toEqual(['wallet_getCapabilities']);
  });

  it('shares the in-flight probe between concurrent callers', async () => {
    const { provider, methods } = providerAnswering('supported');
    const [first, second] = await Promise.all([
      resolveAtomicCalls(provider, 97, EOA),
      resolveAtomicCalls(provider, 97, EOA),
    ]);
    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(methods).toHaveLength(1);
  });

  it('does not cache a negative answer: the next click re-probes', async () => {
    const { provider, methods } = providerAnswering('unsupported');
    expect(await resolveAtomicCalls(provider, 97, EOA)).toBe(false);
    expect(await resolveAtomicCalls(provider, 97, EOA)).toBe(false);
    expect(methods).toHaveLength(2);
  });

  it('re-probes after the send path reports the method unavailable', async () => {
    const { provider, methods } = providerAnswering('supported');
    expect(await resolveAtomicCalls(provider, 97, EOA)).toBe(true);
    forgetAtomicCalls(provider, 97, EOA);
    expect(await resolveAtomicCalls(provider, 97, EOA)).toBe(true);
    expect(methods).toHaveLength(2);
  });

  it('keys by chain and account, not by provider alone', async () => {
    const { provider, methods } = providerAnswering('supported');
    await resolveAtomicCalls(provider, 97, EOA);
    await resolveAtomicCalls(provider, 84532, EOA);
    await resolveAtomicCalls(provider, 97, OTHER);
    expect(methods).toHaveLength(3);
  });
});

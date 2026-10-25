// 点击链路契约（AGENTS.md 性能纪律）：写会话按「探测到的实链」缓存，并且每次调用都先探链——
// 探链是错链闸门（缓存的 chainId 在钱包内切链后会失真），也是点击链路上唯一不可避免的往返；
// 探到链之后元组/精度/部署表零往返。失败不缓存，缓存键永远等于数据来源链。
import { describe, expect, it } from 'vitest';
import type { Hex } from 'viem';

import type { VerseSession } from '../../components/global/execution-reads';
import {
  getTokenDecimals,
  getVerseSession,
  prefetchVerseSession,
  probeVerseChain,
  VerseChainError,
} from '../../components/global/write-session';

const EOA = '0x1111111111111111111111111111111111111111' as Hex;
const UASSET = '0x2222222222222222222222222222222222222222' as Hex;
const TOKEN = '0x3333333333333333333333333333333333333333' as Hex;

const BSC = 97;
const BASE = 84532;

/** Provider stub answering a fixed live chain; records every request it receives. */
function providerOn(chainId: number, methods?: string[]) {
  return {
    request: async ({ method }: { method: string }) => {
      methods?.push(method);
      if (method === 'eth_chainId') return `0x${chainId.toString(16)}`;
      throw new Error(`unexpected ${method}`);
    },
  };
}

function sessionOf(chainId = BSC): VerseSession {
  return {
    client: {} as VerseSession['client'],
    reader: { read: async () => 18n },
    contracts: {},
    verse: {
      uAsset: UASSET,
      memecoin: TOKEN,
      pol: TOKEN,
      yieldVault: TOKEN,
      governor: TOKEN,
    },
    kernel: TOKEN,
    hook: TOKEN,
    launcher: TOKEN,
    eoa: EOA,
    chain: {} as VerseSession['chain'],
    chainId,
    manifestVersion: 'test',
  };
}

function input(provider: ReturnType<typeof providerOn>, eoa: Hex = EOA, verseId = 21n) {
  return { provider, chains: [BSC], eoa, verseId };
}

describe('probeVerseChain: the only chain truth on the click path', () => {
  it('returns the provider chain when it is one this write may execute on', async () => {
    await expect(probeVerseChain(providerOn(BASE), [BSC, BASE])).resolves.toBe(BASE);
  });

  it('refuses a chain outside the allowed set', async () => {
    await expect(probeVerseChain(providerOn(BASE), [BSC])).rejects.toBeInstanceOf(VerseChainError);
  });
});

describe('getVerseSession: static half resolves once per landed chain', () => {
  it('merges concurrent resolves (two dialogs opening together probe once)', async () => {
    const methods: string[] = [];
    const provider = providerOn(BSC, methods);
    let calls = 0;
    const resolve = async () => {
      calls += 1;
      return sessionOf();
    };
    const [first, second] = await Promise.all([
      getVerseSession(input(provider, EOA, 22n), resolve),
      getVerseSession(input(provider, EOA, 22n), resolve),
    ]);
    expect(calls).toBe(1);
    expect(first).toBe(second);
    expect(first.uAssetDecimals).toBe(18);
    expect(methods).toEqual(['eth_chainId']);
  });

  it('a warm session costs exactly one probe and no static read', async () => {
    const methods: string[] = [];
    const provider = providerOn(BSC, methods);
    let calls = 0;
    const resolve = async () => {
      calls += 1;
      return sessionOf();
    };
    await getVerseSession(input(provider, EOA, 23n), resolve);
    methods.length = 0;
    await getVerseSession(input(provider, EOA, 23n), resolve);
    // the probe is repeated on purpose: it is the gate that notices a wallet switch
    expect(methods).toEqual(['eth_chainId']);
    expect(calls).toBe(1);
  });

  it('keys the entry by the probed chain, not by the requested set', async () => {
    const provider = providerOn(BASE);
    const session = await getVerseSession(
      { provider, chains: [BSC, BASE], eoa: EOA, verseId: 24n },
      async () => sessionOf(BASE),
    );
    expect(session.chainId).toBe(BASE);
  });

  it('keeps accounts apart (an account switch must not reuse the other session)', async () => {
    let calls = 0;
    const resolve = async () => {
      calls += 1;
      return sessionOf();
    };
    const provider = providerOn(BSC);
    await getVerseSession(input(provider, EOA, 25n), resolve);
    await getVerseSession(
      input(provider, '0x9999999999999999999999999999999999999999' as Hex, 25n),
      resolve,
    );
    expect(calls).toBe(2);
  });

  it('never caches a failed resolve (one transient RPC error must not kill the dialog)', async () => {
    const provider = providerOn(BSC);
    await expect(
      getVerseSession(input(provider, EOA, 26n), async () => {
        throw new Error('rpc down');
      }),
    ).rejects.toThrow('rpc down');
    const session = await getVerseSession(input(provider, EOA, 26n), async () => sessionOf());
    expect(session.uAssetDecimals).toBe(18);
  });

  it('refuses a wallet on another chain and caches nothing', async () => {
    const provider = providerOn(BASE);
    let calls = 0;
    const resolve = async () => {
      calls += 1;
      return sessionOf();
    };
    await expect(
      getVerseSession({ provider, chains: [BSC], eoa: EOA, verseId: 27n }, resolve),
    ).rejects.toBeInstanceOf(VerseChainError);
    await expect(
      getVerseSession({ provider, chains: [BSC], eoa: EOA, verseId: 27n }, resolve),
    ).rejects.toBeInstanceOf(VerseChainError);
    expect(calls).toBe(0);
  });
});

describe('prefetchVerseSession: eagerness never surfaces as an error', () => {
  it('swallows a failed warm-up (the click path retries and shows the degrade copy)', () => {
    expect(() =>
      prefetchVerseSession({
        provider: {
          request: async () => Promise.reject(new Error('no provider')),
        },
        chains: [BSC],
        eoa: EOA,
        verseId: 28n,
      }),
    ).not.toThrow();
  });
});

describe('getTokenDecimals: ERC20 precision is a deployment constant', () => {
  it('reads each chain+token once', async () => {
    let calls = 0;
    const reader = {
      read: async () => {
        calls += 1;
        return 6n;
      },
    };
    await expect(getTokenDecimals(reader, 97, TOKEN)).resolves.toBe(6);
    await expect(getTokenDecimals(reader, 97, TOKEN)).resolves.toBe(6);
    expect(calls).toBe(1);
  });

  it('retries after a failed read instead of caching the failure', async () => {
    const reader = {
      read: async () => {
        throw new Error('decode');
      },
    };
    const other = '0x4444444444444444444444444444444444444444' as Hex;
    await expect(getTokenDecimals(reader, 97, other)).rejects.toThrow('decode');
    const healthy = { read: async () => 18n };
    await expect(getTokenDecimals(healthy, 97, other)).resolves.toBe(18);
  });
});

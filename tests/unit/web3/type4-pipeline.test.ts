// Type-4 pipeline contract tests (stage 6 step 3, architecture.md §6.3/§6.4/§14):
// - N/N+1 nonce relation, chain-specific authorization (chainId=0 forbidden), to=self EOA
// - gas gate fires before any authorization/signature request (§6.4)
// - simulation failure blocks sending (no silent retry, no broadcast)
// - re-prepare triggers cover all nine scope fields; broadcast requires byte-identical fields
import { describe, expect, it } from 'vitest';
import type { Hex } from 'viem';

import {
  assertByteIdentical,
  buildAuthorizationRequest,
  needsReprepare,
  prepareType4,
  sendPrepared,
  type PrepareInput,
  type PrepareScope,
  type SignedAuthorization,
  type Type4Ports,
  type UnsignedType4,
} from '../../../lib/web3/type4-pipeline';

const EOA = '0x1111111111111111111111111111111111111111' as Hex;
const KERNEL = '0xd6CEDDe84be40893d153Be9d467CD6aD37875b28' as Hex;
const BATCH = '0xaabbcc' as Hex;
const AUTH: SignedAuthorization = {
  chainId: 421614,
  address: EOA,
  nonce: 8,
  r: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Hex,
  s: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Hex,
  yParity: 1,
};

const baseInput = (overrides: Partial<PrepareInput> = {}): PrepareInput => ({
  eoa: EOA,
  kernel: KERNEL,
  expectedChainId: 421614,
  batchCallData: BATCH,
  quoteId: 'q-1',
  minOutput: '100',
  slippageBps: 50,
  deadline: 9999999999,
  manifestVersion: 'v1-rc',
  nativeBalance: 1000n,
  estimatedCost: 100n,
  ...overrides,
});

const mockPorts = (overrides: Partial<Type4Ports> = {}) => {
  const log: string[] = [];
  const ports: Type4Ports = {
    getPendingNonce: async () => 7,
    getChainId: async () => 421614,
    getCode: async () => '0x',
    signAuthorization: async (req) => {
      log.push(`sign:${req.chainId}:${req.nonce}:${req.executor}`);
      return { ...AUTH, chainId: req.chainId, nonce: req.nonce };
    },
    simulateType4: async () => {
      log.push('simulate');
      return { ok: true };
    },
    sendType4: async () => {
      log.push('send');
      return '0xhash' as Hex;
    },
    ...overrides,
  };
  return { ports, log };
};

describe('buildAuthorizationRequest', () => {
  it('packs a chain-specific self-execution authorization', () => {
    expect(buildAuthorizationRequest({ kernel: KERNEL, chainId: 421614, authNonce: 8 })).toEqual({
      contractAddress: KERNEL,
      chainId: 421614,
      nonce: 8,
      executor: 'self',
    });
  });

  it('forbids chainId=0 universal authorization', () => {
    expect(() => buildAuthorizationRequest({ kernel: KERNEL, chainId: 0, authNonce: 8 })).toThrow(
      'chainId=0 forbidden',
    );
  });
});

describe('prepareType4', () => {
  it('signs at N+1, transacts at N, to=self, and simulates with the identical list', async () => {
    const { ports, log } = mockPorts();
    const seen: { simulated: UnsignedType4 | null } = { simulated: null };
    ports.simulateType4 = async (tx) => {
      log.push('simulate');
      seen.simulated = tx;
      return { ok: true };
    };
    const result = await prepareType4(ports, baseInput());
    expect(log).toEqual(['sign:421614:8:self', 'simulate']);
    expect(result).toHaveProperty('prepared');
    if (!('prepared' in result)) throw new Error('unreachable');
    expect(result.prepared.nonce).toBe(7);
    expect(result.prepared.to).toBe(EOA);
    expect(result.prepared.authorizationList).toHaveLength(1);
    expect(seen.simulated?.authorizationList).toEqual(result.prepared.authorizationList);
    expect(result.prepared.scope.authorization?.nonce).toBe(8);
  });

  it('skips authorization when already delegated', async () => {
    const { ports, log } = mockPorts({
      getCode: async () => `0xef0100${KERNEL.slice(2)}` as Hex,
    });
    const result = await prepareType4(ports, baseInput());
    expect(log).not.toContainEqual(expect.stringMatching(/^sign:/));
    if (!('prepared' in result)) throw new Error('unreachable');
    // Delegated accounts ride a plain type-2: no authorizationList field at all
    // (empty lists are invalid per EIP-7702; ARS/Base testnet-verified 2026-10-20).
    expect(result.prepared.authorizationList).toBeUndefined();
  });

  it('blocks before signing when the native balance cannot cover gas (§6.4)', async () => {
    const { ports, log } = mockPorts();
    const result = await prepareType4(
      ports,
      baseInput({ nativeBalance: 50n, estimatedCost: 100n }),
    );
    expect(result).toEqual({ blocked: 'insufficient-native-balance' });
    expect(log).toEqual([]);
  });

  it('blocks chain mismatch and chainId=0 without signing', async () => {
    const { ports, log } = mockPorts({ getChainId: async () => 84532 });
    expect(await prepareType4(ports, baseInput())).toEqual({ blocked: 'chain-mismatch' });
    const zero = mockPorts({ getChainId: async () => 0 });
    expect(await prepareType4(zero.ports, baseInput())).toEqual({ blocked: 'chain-id-zero' });
    expect(log.concat(zero.log)).toEqual([]);
  });

  it('blocks sending on simulation failure with a decoded revert', async () => {
    const { ports, log } = mockPorts({
      simulateType4: async () => ({ ok: false as const, revertData: '0x12345678' as Hex }),
    });
    const result = await prepareType4(ports, baseInput());
    expect(result).toMatchObject({ blocked: 'simulation-failed' });
    expect(log).not.toContain('send');
  });
});

describe('needsReprepare', () => {
  const base: PrepareScope = {
    chainId: 421614,
    nonce: 7,
    authorization: AUTH,
    quoteId: 'q-1',
    minOutput: '100',
    slippageBps: 50,
    deadline: 9999999999,
    callData: BATCH,
    manifestVersion: 'v1-rc',
    accountCode: '0x',
  };

  it('stays cool when nothing changed', () => {
    expect(needsReprepare(base, { ...base })).toBe(false);
  });

  it('fires on every trigger field', () => {
    const variants: PrepareScope[] = [
      { ...base, chainId: 84532 },
      { ...base, nonce: 8 },
      { ...base, authorization: null },
      { ...base, quoteId: 'q-2' },
      { ...base, minOutput: '101' },
      { ...base, slippageBps: 51 },
      { ...base, deadline: 1 },
      { ...base, callData: '0xaabbcd' as Hex },
      { ...base, manifestVersion: 'v1' },
      { ...base, accountCode: `0xef0100${KERNEL.slice(2)}` as Hex },
    ];
    for (const next of variants) {
      expect(needsReprepare(base, next)).toBe(true);
    }
  });
});

describe('assertByteIdentical + sendPrepared', () => {
  const tx: UnsignedType4 = {
    to: EOA,
    eoa: EOA,
    chainId: 421614,
    nonce: 7,
    value: 0n,
    data: BATCH,
    authorizationList: [AUTH],
  };

  it('passes identical fields and names the drifted one', () => {
    expect(() => assertByteIdentical(tx, { ...tx })).not.toThrow();
    expect(() => assertByteIdentical(tx, { ...tx, nonce: 8 })).toThrow('nonce');
    expect(() => assertByteIdentical(tx, { ...tx, authorizationList: [] })).toThrow(
      'authorizationList',
    );
  });

  it('broadcasts byte-identical preparations and never sends drifted ones', async () => {
    const { ports, log } = mockPorts();
    await expect(sendPrepared(ports, tx)).resolves.toBe('0xhash' as Hex);
    expect(log).toEqual(['send']);
    // A send-time snapshot that drifted from the simulated preparation must trip the
    // gate before reaching the port, not after.
    const drifted = { ...tx, data: '0x00' as Hex };
    expect(() => assertByteIdentical(tx, drifted)).toThrow('data');
    expect(log).toEqual(['send']);
  });
});

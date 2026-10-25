// Adapter simulation param tests: the authorizationList field is present if and only if
// non-empty (present-but-empty is rejected as malformed).
import { describe, expect, it } from 'vitest';
import { parseTransaction } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import type { Hex } from 'viem';

import { buildType4Ports as buildPorts } from '../../../lib/web3/viem-type4-adapter';
import type { UnsignedType4 } from '../../../lib/web3/type4-pipeline';

const EOA = '0x1111111111111111111111111111111111111111' as Hex;

const baseTx: UnsignedType4 = {
  to: EOA,
  eoa: EOA,
  chainId: 421614,
  nonce: 7,
  value: 0n,
  data: '0x1234',
  authorizationList: [],
};

describe('simulateType4 params', () => {
  it('omits an empty authorizationList and keeps a non-empty one', async () => {
    const seen: unknown[] = [];
    const provider = {
      request: async (args: { method: string; params?: unknown }) => {
        seen.push(args.params);
        return '0x';
      },
    };
    const ports = buildPorts({
      provider,
      chain: arbitrumSepolia,
      signAuthorization: async () => {
        throw new Error('no signing in this test');
      },
    });
    await ports.simulateType4(baseTx);
    expect(seen).toHaveLength(1);
    expect((seen[0] as unknown[])[0]).not.toHaveProperty('authorizationList');

    const auth = {
      chainId: 421614,
      address: EOA,
      nonce: 8,
      r: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Hex,
      s: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Hex,
      yParity: 1,
    };
    await ports.simulateType4({ ...baseTx, authorizationList: [auth] });
    expect(seen).toHaveLength(2);
    const withAuth = (seen[1] as unknown[])[0] as { authorizationList: unknown[] };
    expect(withAuth.authorizationList).toHaveLength(1);
  });

  it('canonicalizes zero-padded signer r/s (Privy returns fixed-width 32-byte hex)', async () => {
    const seen: unknown[] = [];
    const provider = {
      request: async (args: { method: string; params?: unknown }) => {
        seen.push(args.params);
        return '0x';
      },
    };
    const ports = buildPorts({
      provider,
      chain: arbitrumSepolia,
      signAuthorization: async () => {
        throw new Error('no signing in this test');
      },
    });
    await ports.simulateType4({
      ...baseTx,
      authorizationList: [
        {
          chainId: 421614,
          address: EOA,
          nonce: 8,
          // Leading zero digit in both values: geth-family nodes reject non-canonical
          // hex quantities in authorizationList with -32602 and no revert data.
          r: ('0x0' + 'ab'.repeat(31)) as Hex,
          s: ('0x0' + 'cd'.repeat(31)) as Hex,
          yParity: 1,
        },
      ],
    });
    const emitted = (seen[0] as unknown[])[0] as {
      authorizationList: { r: string; s: string }[];
    };
    expect(emitted.authorizationList[0]!.r).toBe('0x' + 'ab'.repeat(31));
    expect(emitted.authorizationList[0]!.s).toBe('0x' + 'cd'.repeat(31));
  });
});

describe('sendType4 broadcast', () => {
  it('signs the raw type-4 hash via eth_sign and self-broadcasts the assembled tx', async () => {
    const requests: { method: string; params?: unknown }[] = [];
    const provider = {
      request: async (args: { method: string; params?: unknown }) => {
        requests.push(args);
        if (args.method === 'eth_chainId') return '0x66aee'; // 421614
        if (args.method === 'eth_estimateGas') return '0x100000';
        if (args.method === 'eth_gasPrice') return '0x77359400';
        if (args.method === 'secp256k1_sign') return '0x' + 'ab'.repeat(64) + '1c'; // v = 28
        if (args.method === 'eth_sendRawTransaction') {
          return '0xabc0000000000000000000000000000000000000000000000000000000000def';
        }
        throw Object.assign(new Error('The method does not exist.'), { code: -32601 });
      },
    };
    const ports = buildPorts({
      provider,
      chain: arbitrumSepolia,
      signAuthorization: async () => {
        throw new Error('no signing in this test');
      },
    });
    const hash = await ports.sendType4({
      to: EOA,
      eoa: EOA,
      chainId: 421614,
      nonce: 7,
      value: 0n,
      data: '0x1234',
      authorizationList: [
        {
          chainId: 421614,
          address: EOA,
          nonce: 8,
          r: ('0x0' + 'ab'.repeat(31)) as Hex,
          s: ('0x0' + 'cd'.repeat(31)) as Hex,
          yParity: 1,
        },
      ],
    });
    expect(hash).toBe('0xabc0000000000000000000000000000000000000000000000000000000000def');
    // Signing asks the wallet for the raw tx hash only (secp256k1_sign = Privy's own
    // unprefixed-signing primitive; no EIP-191 wrapper at hand-off).
    const sign = requests.find((r) => r.method === 'secp256k1_sign');
    expect(sign).toBeDefined();
    const [signedHash] = sign!.params as [string];
    expect(signedHash).toMatch(/^0x[0-9a-fA-F]{64}$/);
    // The broadcast is a locally-assembled type-4 carrying the (trimmed) authorization.
    const raw = (
      requests.find((r) => r.method === 'eth_sendRawTransaction')!.params as unknown[]
    )[0] as string;
    const parsed = parseTransaction(raw as Hex);
    expect(parsed.type).toBe('eip7702');
    expect(parsed.nonce).toBe(7);
    expect(parsed.authorizationList?.[0]?.address?.toLowerCase()).toBe(EOA.toLowerCase());
    expect(parsed.authorizationList?.[0]?.nonce).toBe(8);
    // The wallet-owned send is what dropped the authorizationList on-chain; it must not
    // be used when raw-hash signing is available.
    expect(requests.some((r) => r.method === 'eth_sendTransaction')).toBe(false);
    expect(requests.some((r) => r.method === 'eth_signTransaction')).toBe(false);
  });

  it('honours caller gas overrides without estimating or reading the price', async () => {
    const requests: { method: string; params?: unknown }[] = [];
    const provider = {
      request: async (args: { method: string; params?: unknown }) => {
        requests.push(args);
        if (args.method === 'secp256k1_sign') return '0x' + 'ab'.repeat(64) + '1c';
        if (args.method === 'eth_sendRawTransaction') {
          return '0xabc0000000000000000000000000000000000000000000000000000000000def';
        }
        throw Object.assign(new Error('The method does not exist.'), { code: -32601 });
      },
    };
    const ports = buildPorts({
      provider,
      chain: arbitrumSepolia,
      signAuthorization: async () => {
        throw new Error('no signing in this test');
      },
    });
    await ports.sendType4({
      to: EOA,
      eoa: EOA,
      chainId: 421614,
      nonce: 7,
      value: 0n,
      data: '0x1234',
      gasLimit: 400_000n,
      maxFeePerGas: 2_000_000_000n,
      maxPriorityFeePerGas: 1_000_000_000n,
      authorizationList: [
        {
          chainId: 421614,
          address: EOA,
          nonce: 8,
          r: ('0x' + 'ab'.repeat(32)) as Hex,
          s: ('0x' + 'cd'.repeat(32)) as Hex,
          yParity: 1,
        },
      ],
    });
    const raw = (
      requests.find((r) => r.method === 'eth_sendRawTransaction')!.params as unknown[]
    )[0] as string;
    const parsed = parseTransaction(raw as Hex);
    expect(parsed.gas).toBe(400_000n);
    expect(parsed.maxFeePerGas).toBe(2_000_000_000n);
    expect(parsed.maxPriorityFeePerGas).toBe(1_000_000_000n);
    // The in-app gas control owns both numbers: no estimation, no price read.
    expect(requests.some((r) => r.method === 'eth_estimateGas')).toBe(false);
    expect(requests.some((r) => r.method === 'eth_gasPrice')).toBe(false);
  });
});

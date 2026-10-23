// Adapter simulation param tests: the authorizationList field is present if and only if
// non-empty (present-but-empty is rejected as malformed).
import { describe, expect, it } from 'vitest';
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
});

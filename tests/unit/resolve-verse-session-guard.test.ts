// resolveVerseSession deployment-guard tests (B3-R1-P3-015): a manifest missing the
// hook key must fail loud at the gate, not surface later as an invalid-address read/encode.
import { describe, expect, it, vi } from 'vitest';
import type { Hex } from 'viem';

import { resolveVerseSession } from '../../components/global/execution-reads';
import { getClientChainConfig } from '@/lib/web3/chains';

vi.mock('@/lib/web3/chains', () => ({
  getClientChainConfig: vi.fn(),
}));

const EOA = '0x1111111111111111111111111111111111111111' as Hex;
const LAUNCHER = '0x2222222222222222222222222222222222222222';
const HOOK = '0x3333333333333333333333333333333333333333';
const KERNEL = '0x4444444444444444444444444444444444444444';

function gateOf(addresses: Record<string, string>) {
  vi.mocked(getClientChainConfig).mockReturnValue({
    status: 'ok',
    config: {
      contracts: { status: 'deployed', addresses, abiVersion: 'v1-rc' },
      kernel7702Implementation: KERNEL,
      viemChain: {},
    },
  } as unknown as ReturnType<typeof getClientChainConfig>);
}

const input = {
  request: (async () => undefined) as unknown as Parameters<
    typeof resolveVerseSession
  >[0]['request'],
  chainId: 97,
  eoa: EOA,
  verseId: 21n,
};

describe('resolveVerseSession deployment guards', () => {
  it('throws hook missing when the manifest lacks the hook key', async () => {
    gateOf({ MemeverseLauncher: LAUNCHER });
    await expect(resolveVerseSession(input)).rejects.toThrow('outrun: hook missing');
  });

  it('keeps the launcher guard (missing launcher still throws first)', async () => {
    gateOf({ MemeverseUniswapHook: HOOK });
    await expect(resolveVerseSession(input)).rejects.toThrow('outrun: launcher missing');
  });
});

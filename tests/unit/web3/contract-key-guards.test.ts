// Pool-token resolver deployment-key guard (sibling class of B3-R1-P3-015): a manifest
// missing the POLSplitter key must fail loud at the resolve boundary with the key named,
// not surface later as an invalid-address read/encode.
import { describe, expect, it, vi } from 'vitest';
import type { Hex } from 'viem';

import { resolvePoolTokens } from '@/components/global/execution-reads';

const reader = { read: vi.fn(async () => '0x0000000000000000000000000000000000000009' as Hex) };

const session = {
  verse: {
    uAsset: '0x0000000000000000000000000000000000000001' as Hex,
    memecoin: '0x0000000000000000000000000000000000000002' as Hex,
    pol: '0x0000000000000000000000000000000000000003' as Hex,
    yieldVault: '0x0000000000000000000000000000000000000004' as Hex,
    governor: '0x0000000000000000000000000000000000000005' as Hex,
  },
  contracts: {} as Record<string, string>,
};

describe('resolvePoolTokens deployment-key guard', () => {
  it('fails loud naming POLSplitter when the manifest lacks the key (pt leg)', async () => {
    await expect(resolvePoolTokens(reader, session, 'pt-uasset', 7n)).rejects.toThrow(
      'outrun: POLSplitter missing',
    );
    expect(reader.read).not.toHaveBeenCalled();
  });
});

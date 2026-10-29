// Deployment-key guards of resolveSwapQuoteContext: a manifest missing the PSM or the swap
// router key must resolve null at the context boundary — before any reader call — instead of
// surfacing downstream as an invalid-address read/encode. Key names are plain string index
// reads, so only these failure-path assertions catch a key rename or manifest drift.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Hex } from 'viem';

import { resolveSwapQuoteContext } from '../../components/verse/swap-live-quote';

const mocks = vi.hoisted(() => ({
  readerRead: vi.fn(async () => '0x00000000000000000000000000000000000000a1'),
  readPoolKey: vi.fn(async () => ({})),
  addresses: {
    MemeverseSwapRouter: '0x00000000000000000000000000000000000000f1',
    MemeverseUniswapHook: '0x00000000000000000000000000000000000000c3',
    'OutrunPSM.UUSD': '0x00000000000000000000000000000000000000f2',
  } as Record<string, string>,
  getVerseSession: vi.fn(async () => ({
    reader: { read: mocks.readerRead },
    verse: {
      memecoin: '0x00000000000000000000000000000000000000b2',
      pol: '0x00000000000000000000000000000000000000e5',
      uAsset: '0x00000000000000000000000000000000000000a1',
    },
    contracts: {},
  })),
}));

vi.mock('../../lib/web3/chains', () => ({
  getClientChainConfig: () => ({
    status: 'ok',
    config: {
      contracts: {
        status: 'deployed',
        abiVersion: 'test',
        addresses: mocks.addresses,
      },
      kernel7702Implementation: '0x00000000000000000000000000000000000000f3',
    },
  }),
}));
vi.mock('../../lib/web3/active-provider', () => ({ getActiveEip1193Provider: () => ({}) }));
vi.mock('../../lib/web3/abis', () => ({ psmAbi: [] }));
vi.mock('../../lib/web3/session-actions', () => ({ limitForDirection: () => 0n }));
vi.mock('../../components/global/execution-reads', () => ({
  readPoolKey: mocks.readPoolKey,
  readPsmQuote: vi.fn(),
  readPTToken: vi.fn(),
  readSwapQuote: vi.fn(),
  readSwapSpotOutPerIn: vi.fn(),
}));
vi.mock('../../components/global/write-session', () => ({
  getTokenDecimals: vi.fn(),
  getVerseSession: mocks.getVerseSession,
}));

const BASE = {
  eoa: '0x00000000000000000000000000000000000000aa' as Hex,
  chainId: 8453,
  verseId: '1',
  direction: 'stable-to-meme' as const,
  memeTokenId: 'meme' as const,
  uAssetSymbol: 'UUSD',
  stableToken: { kind: 'uasset' } as const,
  amount: '100',
};

describe('resolveSwapQuoteContext deployment-key guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.addresses = {
      MemeverseSwapRouter: '0x00000000000000000000000000000000000000f1',
      MemeverseUniswapHook: '0x00000000000000000000000000000000000000c3',
      'OutrunPSM.UUSD': '0x00000000000000000000000000000000000000f2',
    };
  });

  it('resolves null naming no PSM when the manifest lacks the OutrunPSM key (reserve leg)', async () => {
    delete mocks.addresses['OutrunPSM.UUSD'];
    const context = await resolveSwapQuoteContext({
      ...BASE,
      stableToken: {
        kind: 'reserve',
        address: '0x00000000000000000000000000000000000000d4' as Hex,
      },
    });
    expect(context).toBeNull();
    // Without the guard the PSM binding read would fire on an undefined address.
    expect(mocks.readerRead).not.toHaveBeenCalled();
    expect(mocks.readPoolKey).not.toHaveBeenCalled();
  });

  it('resolves null when the manifest lacks MemeverseSwapRouter, before the pool-key read', async () => {
    delete mocks.addresses.MemeverseSwapRouter;
    const context = await resolveSwapQuoteContext(BASE);
    expect(context).toBeNull();
    expect(mocks.readPoolKey).not.toHaveBeenCalled();
  });
});

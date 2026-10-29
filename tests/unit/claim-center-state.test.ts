// @vitest-environment jsdom
// ClaimCenter state-machine regression lock (component level): a failed first read raises
// the failed latch and the failed copy replaces the loading line; a window-focus re-read
// that succeeds must CLEAR the latch and render the rows (the failed copy promises refocus
// recovery — the clear-on-success write in the read effect's success branch); and a
// re-read that fails after success re-raises the latch. Without the clear-on-success
// write the latch is sticky until an account/chain switch and the failure copy shadows
// already-landed data. Mocked at the same seams as faucet-claims-degrade.test.ts.
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { Locale } from '../../lib/data/fixture-repository';
import { ClaimCenterPanel, ClaimCenterProvider } from '../../components/verse/claim-center';

const CHAIN_ID = 97;
const LAUNCHER = '0x00000000000000000000000000000000000000a1';
const EOA = '0x00000000000000000000000000000000000000cc';
const U_ASSET = '0x00000000000000000000000000000000000000b2';
const MEMECOIN = '0x00000000000000000000000000000000000000c3';
const ZERO_SLOT = '0x0000000000000000000000000000000000000000000000000000000000000000';
const SCOPED_PREVIEW = '1000000000000000000'; // 1 whole memecoin via BigInt(String(...))

const FAILED_COPY = 'Failed to read claimable items. Switch tabs or refocus to retry.';
const PREORDER_TITLE = 'Preorder unlock';

const state = vi.hoisted(() => ({
  failReads: false,
  addressReads: 0,
  readerByChain: new Map<number, unknown>(),
  tx: {
    active: false,
    display: 'idle' as string,
    reviewing: false,
    running: false,
    context: { txHash: null, review: null, errorKind: undefined as string | undefined },
    reset: () => undefined,
    executeDirect: vi.fn(),
  },
}));

vi.mock('@/components/global/use-account-center', () => ({
  useAccountCenter: () => ({
    source: 'real',
    connected: true,
    address: EOA,
    chainId: CHAIN_ID,
    chainSupported: true,
    connectAction: () => undefined,
  }),
}));

vi.mock('@/components/global/wallet-provider-reader', () => ({
  useWalletProviderReader: (chainId: number | null) => {
    if (chainId == null) return null;
    // Stable per chainId — mirrors the production useMemo so the read effect's
    // providerReader dep does not churn across renders.
    if (!state.readerByChain.has(chainId)) {
      state.readerByChain.set(chainId, {
        client: {
          multicall: async () => [
            { status: 'success', result: 6n }, // uAsset decimals (base identity)
            { status: 'success', result: 18n }, // memecoin decimals (base identity)
            { status: 'success', result: [0n, 0n] }, // userPreorderData (funds, claimed)
            { status: 'success', result: [0n, 0n] }, // userGenesisData
            { status: 'success', result: 0n }, // totalNormalFunds
            { status: 'success', result: 0n }, // totalNormalClaimableYT
            { status: 'success', result: true }, // normalYTClaimed
            { status: 'success', result: [0n, 0n] }, // normalFeeStates
            { status: 'success', result: [0n, 0n] }, // userNormalFeeClaims
          ],
          getStorageAt: async () => ZERO_SLOT,
        },
        reader: { read: async () => SCOPED_PREVIEW },
        addresses: { MemeverseLauncher: LAUNCHER },
      });
    }
    return state.readerByChain.get(chainId);
  },
}));

vi.mock('@/components/global/execution-reads', () => ({
  // The first read of every round: the failure injection point (a throw lands the whole
  // round in the failed state, exactly like a real RPC failure).
  readVerseAddresses: async () => {
    state.addressReads += 1;
    if (state.failReads) throw new Error('rpc down');
    return { uAsset: U_ASSET, memecoin: MEMECOIN };
  },
  readPoolKey: async () => {
    throw new Error('not exercised');
  },
}));

vi.mock('@/lib/data/verse-reads', () => ({
  readVerseLockedAt: async () => null,
}));

vi.mock('@/lib/web3/chains', () => ({
  verseExecutionChains: () => [CHAIN_ID],
  verseSwitchChainId: () => CHAIN_ID,
  executionChainId: (governanceChain: number) => governanceChain,
  getClientChainConfig: (chainId: number) => ({
    status: 'ok',
    config: {
      viemChain: { id: chainId, name: 'Test Chain' },
      contracts: {
        status: 'deployed',
        abiVersion: 'test',
        addresses: { MemeverseLauncher: LAUNCHER },
      },
    },
  }),
}));

vi.mock('@/lib/web3/active-provider', () => ({
  getActiveEip1193Provider: () => null,
  useActiveEip1193Provider: () => null,
}));

vi.mock('@/components/global/use-tx-center', () => ({
  useTxCenter: () => state.tx,
  useClearOnConfirmed: () => undefined,
}));

vi.mock('@/components/global/use-tx-success', () => ({
  useTxSuccessGate: () => ({ successOpen: false, setSuccessOpen: () => undefined, receipt: null }),
}));

vi.mock('@/components/global/write-session', () => ({
  probeVerseChain: async () => CHAIN_ID,
}));

function renderCenter() {
  render(
    createElement(ClaimCenterProvider, {
      verseIdParam: '123',
      governanceChain: CHAIN_ID,
      deployedChainIds: null,
      memecoinSymbol: 'MEME',
      uAssetSymbol: 'UUSD',
      // children rides the props object: the provider's children prop is required and
      // createElement's third argument does not join the props-type match.
      children: createElement(ClaimCenterPanel, {
        locale: 'en' as Locale,
        verseIdParam: '123',
        governanceChain: CHAIN_ID,
        governanceChainName: 'Test Chain',
        deployedChainIds: null,
        harness: null,
      }),
    }),
  );
}

const focusWindow = () => fireEvent(window, new Event('focus'));

beforeEach(() => {
  state.failReads = false;
  state.addressReads = 0;
  state.readerByChain.clear();
});

afterEach(() => {
  cleanup();
});

describe('ClaimCenter failed-latch state machine', () => {
  it('a failed first read raises the latch: the failed copy replaces the rows', async () => {
    state.failReads = true;
    renderCenter();

    // The read must actually reach the RPC seam (not an unconnected gate shortcut).
    await waitFor(() => expect(state.addressReads).toBeGreaterThan(0));
    await waitFor(() => expect(screen.getByText(FAILED_COPY)).toBeDefined());
    expect(screen.queryByText(PREORDER_TITLE)).toBeNull();
  });

  it('a focus re-read that succeeds clears the latch and renders the rows', async () => {
    state.failReads = true;
    renderCenter();
    await waitFor(() => expect(screen.getByText(FAILED_COPY)).toBeDefined());

    state.failReads = false;
    focusWindow();
    await waitFor(() => expect(screen.getByText(PREORDER_TITLE)).toBeDefined());
    expect(screen.queryByText(FAILED_COPY)).toBeNull();
    // The focus event really re-ran the read round (nonce bump), not a stale render.
    expect(state.addressReads).toBeGreaterThanOrEqual(2);
  });

  it('a re-read that fails after success re-raises the latch', async () => {
    renderCenter();
    await waitFor(() => expect(screen.getByText(PREORDER_TITLE)).toBeDefined());

    state.failReads = true;
    focusWindow();
    await waitFor(() => expect(screen.getByText(FAILED_COPY)).toBeDefined());
    // The failed branch takes priority over the previously landed rows.
    expect(screen.queryByText(PREORDER_TITLE)).toBeNull();
  });
});

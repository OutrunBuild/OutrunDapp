// @vitest-environment jsdom
// Bridge CTA readiness: the from-chain selector carries the governance id (mainnet family)
// while the wallet executes on the testnet twin — the comparison must go through
// executionChainId, or the bridge CTA stays dead on every deployed chain (the raw
// `center.chainId === fromChain` form can never hold across the two id domains).
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { decodeFunctionData, encodeFunctionResult, type Abi, type Hex } from 'viem';

import type { Locale } from '../../lib/data/fixture-repository';
import { erc20ReadAbi, uAssetOftAbi } from '../../lib/web3/abis';
import { getCopy } from '../../components/global/copy';
import { BridgeDialog, bridgeExecutionReady } from '../../components/portfolio/portfolio-dialogs';

// Controlled fixtures shared by the mock factories below (vi.hoisted stays ahead of the
// import hoisting): `undeployedIds` simulates the registry/twin-map change that strips a
// deployed target's contracts shape (the B5-ADJ-P3-004 ruling's trigger), and
// `providerRequest` stands in for the wallet provider so the quote flow answers without a
// chain. The pure-function suites below are indifferent to this state.
const bridgeState = vi.hoisted(() => ({
  account: {
    source: 'harness' as string,
    connected: false,
    chainId: null as number | null,
    chainSupported: true,
    address: null as string | null,
  },
  tx: {
    context: { txHash: null, review: null },
    display: 'idle' as string,
    reviewing: false,
    active: false,
    running: false,
    executeDirect: vi.fn(),
    executeSession: vi.fn(),
    reset: vi.fn(),
  },
  undeployedIds: new Set<number>(),
  providerRequest: vi.fn(),
  provider: null as unknown as {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  } | null,
}));

vi.mock('@/components/global/use-account-center', () => ({
  useAccountCenter: () => ({
    ...bridgeState.account,
    connectAction: () => undefined,
    switchChainAction: async () => false,
  }),
}));
vi.mock('@/components/global/use-tx-center', () => ({
  useTxCenter: () => bridgeState.tx,
  useClearOnConfirmed: () => undefined,
}));
vi.mock('@/lib/web3/active-provider', () => ({
  getActiveEip1193Provider: () => bridgeState.provider,
  useActiveEip1193Provider: () => bridgeState.provider,
}));
// Partial chains mock: only `getClientChainConfig` is replaceable — `executionChainId`
// and every other export stay the real implementation, so the twin mapping under test is
// production truth. The undeployed simulation keeps `status: 'ok'` and strips only the
// contracts shape — exactly the predicates the dst guards read.
vi.mock('@/lib/web3/chains', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/web3/chains')>();
  return {
    ...actual,
    getClientChainConfig: (chainId: number) => {
      const real = actual.getClientChainConfig(chainId);
      if (bridgeState.undeployedIds.has(chainId) && real.status === 'ok') {
        return { status: 'ok', config: { ...real.config, contracts: { status: 'undeployed' } } };
      }
      return real;
    },
  };
});

const READY = {
  source: 'real',
  connected: true,
  chainSupported: true,
  address: '0xabc',
} as const;

describe('bridgeExecutionReady', () => {
  it('unlocks when the wallet sits on the selected chain testnet twin', () => {
    expect(bridgeExecutionReady({ ...READY, chainId: 421614 }, 1)).toBe(true);
    expect(bridgeExecutionReady({ ...READY, chainId: 84532 }, 8453)).toBe(true);
    expect(bridgeExecutionReady({ ...READY, chainId: 97 }, 56)).toBe(true);
  });

  it('stays locked on an undeployed mainnet id or a mismatched twin', () => {
    expect(bridgeExecutionReady({ ...READY, chainId: 1 }, 1)).toBe(false);
    expect(bridgeExecutionReady({ ...READY, chainId: 8453 }, 1)).toBe(false);
    expect(bridgeExecutionReady({ ...READY, chainId: 421614 }, 8453)).toBe(false);
    expect(bridgeExecutionReady({ ...READY, chainId: 97 }, 1)).toBe(false);
  });

  it('requires a real connected session on a supported chain', () => {
    expect(bridgeExecutionReady({ ...READY, chainId: 421614, source: 'harness' }, 1)).toBe(false);
    expect(bridgeExecutionReady({ ...READY, chainId: 421614, connected: false }, 1)).toBe(false);
    expect(bridgeExecutionReady({ ...READY, chainId: 421614, chainSupported: false }, 1)).toBe(
      false,
    );
    expect(bridgeExecutionReady({ ...READY, chainId: 421614, address: null }, 1)).toBe(false);
    expect(bridgeExecutionReady({ ...READY, chainId: null }, 1)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Component-level dst-leg guards: the fee-quote effect and the click assembly
// both fail closed on an unquotable target chain. The predicates are black-box
// unreachable with today's registry (every twin target is deployed), so these
// suites simulate the B5-ADJ-P3-004 trigger shapes through the partial chains
// mock instead of waiting for a registry change to make them reachable.
// ---------------------------------------------------------------------------

const COPY = getCopy('en').portfolio.assets;

const CHAINS = [
  { chainId: 1, name: 'Ethereum' },
  { chainId: 8453, name: 'Base' },
  { chainId: 56, name: 'BNB Chain' },
];
const FROM_BALANCES = [{ chainId: 1, name: 'Ethereum', amount: 5 }];

const DECIMALS_FRAGMENT = erc20ReadAbi.filter(
  (item) => 'name' in item && item.name === 'decimals',
) as unknown as Abi;
const QUOTE_FRAGMENT = uAssetOftAbi.filter(
  (item) => 'name' in item && item.name === 'quoteSend',
) as unknown as Abi;
const QUOTE_FEE_LD = 1_000_000_000_000_000n;

beforeEach(() => {
  bridgeState.account.source = 'real';
  bridgeState.account.connected = true;
  bridgeState.account.chainId = 421614;
  bridgeState.account.chainSupported = true;
  bridgeState.account.address = '0xabc';
  bridgeState.tx.display = 'idle';
  bridgeState.tx.active = false;
  bridgeState.tx.running = false;
  bridgeState.undeployedIds.clear();
  bridgeState.providerRequest.mockClear();
  bridgeState.providerRequest.mockImplementation(
    async (args: { method: string; params?: unknown[] }) => {
      if (args.method !== 'eth_call') throw new Error(`unexpected wallet RPC: ${args.method}`);
      const data = (args.params as [{ data: Hex }])[0]?.data ?? '0x';
      // Every calldata is positively identified against a known ABI fragment; an unknown
      // selector fails loud (matching the method-level guard above) instead of silently
      // feeding the caller a quoteSend-shaped answer.
      try {
        decodeFunctionData({ abi: DECIMALS_FRAGMENT, data });
        return encodeFunctionResult({
          abi: DECIMALS_FRAGMENT,
          functionName: 'decimals',
          result: 18,
        });
      } catch {
        try {
          decodeFunctionData({ abi: QUOTE_FRAGMENT, data });
          return encodeFunctionResult({
            abi: QUOTE_FRAGMENT,
            functionName: 'quoteSend',
            result: [QUOTE_FEE_LD, 0n],
          });
        } catch {
          throw new Error(`unexpected wallet RPC calldata: ${data.slice(0, 10)}`);
        }
      }
    },
  );
  bridgeState.tx.executeSession.mockClear();
  bridgeState.provider = { request: bridgeState.providerRequest };
});

afterEach(() => {
  cleanup();
});

function openDialog(): Promise<void> {
  render(
    createElement(BridgeDialog, {
      locale: 'en' as Locale,
      triggerLabel: 'Send cross-chain',
      assetSymbol: 'UETH',
      chains: CHAINS,
      balancesByChain: FROM_BALANCES,
    }),
  );
  return (async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Send cross-chain' }));
    await screen.findByText(COPY.bridgeTitle);
    fireEvent.change(screen.getByLabelText(`${COPY.amount} (UETH)`), { target: { value: '1' } });
  })();
}

describe('BridgeDialog dst-leg guards (component level)', () => {
  it('fee-quote effect: a landed quote hides when the target loses deployment, with zero extra wallet RPC', async () => {
    await openDialog();
    // twin(8453)=84532 stays deployed: the debounced quote flow answers through the
    // stubbed provider (decimals + quoteSend) and the fee row renders.
    await waitFor(() => expect(screen.getByText(COPY.bridgeFee)).toBeTruthy(), { timeout: 4000 });
    const callsAfterQuote = bridgeState.providerRequest.mock.calls.length;
    expect(callsAfterQuote).toBeGreaterThan(0);
    // twin(56)=97 loses its contracts shape: the dst guard must hide the row and spend
    // no further RPC. A weakened guard (contracts predicate dropped — compiles, since
    // layerZeroEid is a top-level field) would re-quote here and go red on both asserts.
    bridgeState.undeployedIds.add(97);
    fireEvent.click(screen.getByRole('button', { name: `${COPY.bridgeTo} · BNB Chain` }));
    await waitFor(() => expect(screen.queryByText(COPY.bridgeFee)).toBeNull(), { timeout: 4000 });
    expect(bridgeState.providerRequest.mock.calls.length).toBe(callsAfterQuote);
  });

  it('click dst guard: an undeployed target degrades to the alert row instead of assembling the send', async () => {
    bridgeState.undeployedIds.add(84532);
    await openDialog();
    fireEvent.click(screen.getByRole('button', { name: COPY.bridgeSend }));
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(bridgeState.tx.executeSession).not.toHaveBeenCalled();
    expect(bridgeState.providerRequest).not.toHaveBeenCalled();
  });
});

// Src-leg mirrors: the same B5 trigger shape on the wallet's own twin. The fee-quote
// effect drops any standing row and the click degrades to the alert row — the same
// fail-closed discipline the dst-leg suites above lock in.
describe('BridgeDialog src-leg guards (component level)', () => {
  it('fee-quote effect: a source-shape loss drops the standing quote with zero extra wallet RPC', async () => {
    await openDialog();
    await waitFor(() => expect(screen.getByText(COPY.bridgeFee)).toBeTruthy(), { timeout: 4000 });
    const callsAfterQuote = bridgeState.providerRequest.mock.calls.length;
    // The wallet twin (421614) loses its contracts shape: the src guard must drop the
    // standing row on the next re-quote pass and spend no further RPC.
    bridgeState.undeployedIds.add(421614);
    fireEvent.change(screen.getByLabelText(`${COPY.amount} (UETH)`), { target: { value: '2' } });
    await waitFor(() => expect(screen.queryByText(COPY.bridgeFee)).toBeNull(), { timeout: 4000 });
    expect(bridgeState.providerRequest.mock.calls.length).toBe(callsAfterQuote);
  });

  it('click src guard: an unquotable source degrades to the alert row instead of assembling the send', async () => {
    bridgeState.undeployedIds.add(421614);
    await openDialog();
    fireEvent.click(screen.getByRole('button', { name: COPY.bridgeSend }));
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(bridgeState.tx.executeSession).not.toHaveBeenCalled();
    expect(bridgeState.providerRequest).not.toHaveBeenCalled();
  });
});

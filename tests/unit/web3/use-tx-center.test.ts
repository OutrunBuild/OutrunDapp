// @vitest-environment jsdom
// Post-write refresh gate (use-tx-center): a confirmed write that declares a verse scope must
// converge that verse's server data exactly once, carrying the write's own hash. A run that a
// later reset() abandoned must NOT refresh — its lastHashRef still points at an earlier write,
// so firing would invalidate + prime against the wrong block and re-cache pre-write numbers
// (the stale-numbers class write-refresh-core.ts:11-18 describes). Both directions are silent
// in every other suite: the component tests replace this module with a stub. The negative
// controls pin the gate's other two conjuncts: a non-confirmed outcome and a scope-less spec
// refresh nothing (the executor's "omit writeScope = no server refresh" contract).
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import type { Hex } from 'viem';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTxCenter, type WriteFlow } from '../../../components/global/use-tx-center';
import type { ExecDeps, WriteOutcome, WriteSpec } from '../../../lib/web3/tx-executor';

const H = vi.hoisted(() => ({
  EOA: '0x1111111111111111111111111111111111111111',
  TARGET: '0x2222222222222222222222222222222222222222',
  HASH_FIRST: `0x${'ab'.repeat(32)}`,
  runDirect: vi.fn(),
  refreshVerseAfterWrite: vi.fn(),
  notifyVerseWrite: vi.fn(),
  routerRefresh: vi.fn(),
  provider: { request: vi.fn() },
}));

vi.mock('@privy-io/react-auth', () => ({
  // A Privy wallet makes the hook route as 'embedded' (no external unlock gate, no 5792 probe).
  useWallets: () => ({ wallets: [{ address: H.EOA, walletClientType: 'privy' }] }),
  useSign7702Authorization: () => ({ signAuthorization: vi.fn() }),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: H.routerRefresh }) }));

vi.mock('../../../lib/web3/active-provider', () => ({
  getActiveEip1193Provider: () => H.provider,
  useActiveEip1193Provider: () => H.provider,
  isWeb3Configured: () => true,
}));

vi.mock('../../../lib/data/write-refresh', () => ({
  refreshVerseAfterWrite: H.refreshVerseAfterWrite,
}));

vi.mock('../../../components/global/verse-write-signal', () => ({
  notifyVerseWrite: H.notifyVerseWrite,
}));

vi.mock('../../../components/global/use-account-center', () => ({
  useAccountCenter: () => ({
    address: H.EOA,
    chainId: 97,
    dispatchAccount: vi.fn(),
    reportProviderLimitation: vi.fn(),
  }),
}));

// Only the wallet send is replaced; the rest of the executor (route table, types) stays real.
vi.mock('../../../lib/web3/tx-executor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/web3/tx-executor')>();
  return { ...actual, runDirect: H.runDirect };
});

// Pin the build branch: the suite always exercises useRealTxCenter, never the no-op harness.
vi.mock('../../../lib/data/source-flag', () => ({ ONCHAIN_BUILD: true }));

function writeSpec(overrides: Partial<WriteSpec> = {}): WriteSpec {
  return {
    review: {
      chainId: 97,
      account: H.EOA,
      targetContract: H.TARGET,
      functionName: 'claim',
      inputs: '',
      minOutput: '—',
      fee: '',
      gasPayer: '',
      authorizationChange: '',
      estimatedGas: '',
      nativeBalance: '',
    },
    expectedChainId: 97,
    batchCallData: '0x',
    quoteId: 'unit-refresh-gate',
    minOutput: '—',
    slippageBps: 0,
    deadline: 0,
    manifestVersion: 'v1-rc',
    direct: { to: H.TARGET as Hex, data: '0x' },
    writeScope: { kind: 'verse', chainId: 97, verseId: '21' },
    ...overrides,
  };
}

/** Invalidate + prime must land before the re-render, or the page replays warm pre-write data. */
function expectRefreshBeforeReRender(): void {
  expect(H.refreshVerseAfterWrite.mock.invocationCallOrder[0]).toBeLessThan(
    H.routerRefresh.mock.invocationCallOrder[0],
  );
}

function renderFlow(): () => WriteFlow {
  let flow: WriteFlow | null = null;
  function Harness(): null {
    flow = useTxCenter();
    return null;
  }
  render(createElement(Harness));
  return () => {
    if (!flow) throw new Error('outrun: use-tx-center harness never rendered');
    return flow;
  };
}

describe('use-tx-center post-write refresh gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    H.refreshVerseAfterWrite.mockImplementation(() => Promise.resolve());
    H.runDirect.mockImplementation(
      async (_spec: WriteSpec, deps: ExecDeps): Promise<WriteOutcome> => {
        deps.dispatch({ type: 'tx-signed', hash: H.HASH_FIRST });
        return 'confirmed';
      },
    );
  });

  afterEach(cleanup);

  it('converges the verse scope once, carrying the write hash, on a confirmed outcome', async () => {
    const flow = renderFlow();

    await act(async () => {
      await flow().executeSession(writeSpec());
    });

    await waitFor(() => expect(H.refreshVerseAfterWrite).toHaveBeenCalledTimes(1));
    expect(H.refreshVerseAfterWrite).toHaveBeenCalledWith({
      chainId: 97,
      verseId: '21',
      txHash: H.HASH_FIRST,
    });
    // The client-side twin fires in the same gate, and the re-render rides the refresh
    // (invalidate + prime BEFORE router.refresh — the reverse order replays warm pre-write data).
    expect(H.notifyVerseWrite).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(H.routerRefresh).toHaveBeenCalledTimes(1));
    expectRefreshBeforeReRender();
  });

  it('refreshes nothing for an abandoned run (reset bumps the generation mid-flight)', async () => {
    const flow = renderFlow();

    // Run 1 lands: this seeds lastHashRef with the hash a stale refresh would wrongly reuse.
    await act(async () => {
      await flow().executeSession(writeSpec());
    });
    await waitFor(() => expect(H.refreshVerseAfterWrite).toHaveBeenCalledTimes(1));

    let settle: (outcome: WriteOutcome) => void = () => undefined;
    H.runDirect.mockImplementation(
      () =>
        new Promise<WriteOutcome>((resolve) => {
          settle = resolve;
        }),
    );

    let abandoned: Promise<WriteOutcome> = Promise.resolve('failed');
    await act(async () => {
      abandoned = flow().executeSession(writeSpec());
      // The synchronous part of run() already captured the generation at this point.
      flow().reset();
      settle('confirmed');
      await abandoned;
    });

    // The settled outcome still goes back to the caller…
    await expect(abandoned).resolves.toBe('confirmed');
    // …but the central refresh does not fire on it: one call total, from run 1 only.
    expect(H.refreshVerseAfterWrite).toHaveBeenCalledTimes(1);
    expect(H.refreshVerseAfterWrite).toHaveBeenCalledWith({
      chainId: 97,
      verseId: '21',
      txHash: H.HASH_FIRST,
    });
    expect(H.notifyVerseWrite).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(H.routerRefresh).toHaveBeenCalledTimes(1));
    expectRefreshBeforeReRender();
  });

  it('refreshes nothing when the outcome is not confirmed (negative control on the conjunct)', async () => {
    const flow = renderFlow();
    H.runDirect.mockImplementation(async (): Promise<WriteOutcome> => 'cancelled');

    await act(async () => {
      await flow().executeSession(writeSpec());
    });
    await waitFor(() => expect(H.runDirect).toHaveBeenCalledTimes(1));
    // Flush the refresh chain before counting: a broadened gate would still fire here.
    await act(async () => {});

    expect(H.refreshVerseAfterWrite).not.toHaveBeenCalled();
    expect(H.notifyVerseWrite).not.toHaveBeenCalled();
    expect(H.routerRefresh).not.toHaveBeenCalled();
  });

  it('refreshes nothing when the spec declares no writeScope (omit = no server refresh)', async () => {
    const flow = renderFlow();
    const scopeless = writeSpec({ writeScope: undefined });

    await act(async () => {
      await flow().executeSession(scopeless);
    });
    await waitFor(() => expect(H.runDirect).toHaveBeenCalledTimes(1));
    await act(async () => {});

    expect(H.refreshVerseAfterWrite).not.toHaveBeenCalled();
    expect(H.notifyVerseWrite).not.toHaveBeenCalled();
    expect(H.routerRefresh).not.toHaveBeenCalled();
  });
});

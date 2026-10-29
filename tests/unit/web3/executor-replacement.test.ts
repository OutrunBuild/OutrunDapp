// Replacement settlement for the two receipt-wait pipelines: a wallet Cancel / speed-up /
// substitute lands a DIFFERENT transaction on the submitted nonce, and viem still resolves a
// receipt — the substitute's own. These tests pin that the executor never reads that receipt
// as "this write succeeded", and that the landed hash (not the submitted one) travels
// downstream to the success dialog and the write-refresh freshness gate.
import { describe, expect, it, vi } from 'vitest';
import type { Chain, Hex } from 'viem';

import type { Eip1193ProviderLike } from '../../../lib/web3/active-provider';
import { INITIAL_TX_CONTEXT, reduceTx, type TxEvent } from '../../../lib/web3/tx-center';
import {
  runDirect,
  runSession,
  type ExecDeps,
  type WriteSpec,
} from '../../../lib/web3/tx-executor';

const EOA = '0x1111111111111111111111111111111111111111' as Hex;
const ROUTER = '0x2222222222222222222222222222222222222222' as Hex;
const OTHER = '0x3333333333333333333333333333333333333333' as Hex;
const HASH = `0x${'ab'.repeat(32)}` as Hex;
const REPLACEMENT_HASH = `0x${'cd'.repeat(32)}` as Hex;
const BLOCK_HASH = `0x${'ee'.repeat(32)}` as Hex;
const ZERO_HASH = `0x${'00'.repeat(32)}` as Hex;
const CHAIN = { id: 97 } as Chain;

// The type-4 legs have their own suites; here the batch is injected as already prepared so
// only the receipt-settlement half runs against the real viem watcher.
const session = vi.hoisted(() => ({
  hash: `0x${'ab'.repeat(32)}`,
  ports: { getPendingNonce: async () => 0n, getChainId: async () => 97, getCode: async () => '0x' },
  // scope is deliberately left empty: the executor then records undefined+1=NaN into the
  // module-level sessionNonceFloor, neutralizing the freshness floor gate for this whole
  // suite — consistent with the receipt-settlement-only intent above. Filling scope.nonce
  // later requires the full trio — a real nonce, getPendingNonce advancing in step (or a
  // unique EOA per test), and matching number/bigint types — or the runSession cases flip
  // to scope-stale. Same caveat applies to executor-read-failures.test.ts.
  prepared: { prepared: { scope: {} } },
}));

vi.mock('../../../lib/web3/viem-type4-adapter', () => ({
  buildType4Ports: () => session.ports,
  resolveType4GasLimit: async () => 21_000n,
}));
vi.mock('../../../lib/web3/type4-pipeline', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/web3/type4-pipeline')>();
  return {
    ...actual,
    prepareType4: async () => session.prepared,
    sendPrepared: async () => session.hash,
    needsReprepare: () => false,
  };
});

type ReplacementKind = 'cancelled' | 'repriced' | 'replaced';

/** The submitted hash as a still-pending tx: viem caches it before the replacement scan. */
function pendingTx() {
  return {
    hash: HASH,
    from: EOA,
    to: ROUTER,
    nonce: '0x0',
    value: '0x0',
    input: '0xcafef00d',
    blockNumber: null,
    blockHash: null,
    transactionIndex: null,
    gas: '0x5208',
    gasPrice: '0x1',
    maxFeePerGas: '0x1',
    maxPriorityFeePerGas: '0x1',
    type: '0x2',
    chainId: '0x61',
    v: '0x1',
    r: `0x${'11'.repeat(32)}`,
    s: `0x${'22'.repeat(32)}`,
    yParity: '0x1',
  };
}

/** The same-nonce substitute: identical fields = speed-up, self-send 0 = cancel. */
function replacementTx(kind: ReplacementKind) {
  return {
    ...pendingTx(),
    hash: REPLACEMENT_HASH,
    to: kind === 'cancelled' ? EOA : kind === 'repriced' ? ROUTER : OTHER,
    input: kind === 'repriced' ? '0xcafef00d' : '0xdeadbeef',
    blockNumber: '0x1',
    blockHash: BLOCK_HASH,
    transactionIndex: '0x0',
  };
}

function successReceipt() {
  return {
    transactionHash: REPLACEMENT_HASH,
    transactionIndex: '0x0',
    blockHash: BLOCK_HASH,
    blockNumber: '0x1',
    from: EOA,
    to: EOA,
    cumulativeGasUsed: '0x5208',
    gasUsed: '0x5208',
    effectiveGasPrice: '0x1',
    contractAddress: null,
    logs: [],
    logsBloom: `0x${'00'.repeat(256)}`,
    status: '0x1',
    type: '0x2',
  };
}

function blockWith(kind: ReplacementKind) {
  return {
    number: '0x1',
    hash: BLOCK_HASH,
    parentHash: ZERO_HASH,
    nonce: '0x0000000000000000',
    sha3Uncles: ZERO_HASH,
    logsBloom: `0x${'00'.repeat(256)}`,
    transactionsRoot: ZERO_HASH,
    stateRoot: ZERO_HASH,
    receiptsRoot: ZERO_HASH,
    miner: EOA,
    difficulty: '0x0',
    totalDifficulty: '0x0',
    extraData: '0x',
    size: '0x100',
    gasLimit: '0x1c9c380',
    gasUsed: '0x5208',
    timestamp: '0x1',
    uncles: [],
    transactions: [replacementTx(kind)],
    baseFeePerGas: '0x1',
    mixHash: ZERO_HASH,
  };
}

/** EIP-1193 stub for the settlement reads: pending original, mined substitute, its receipt. */
function replacementProvider(
  kind: ReplacementKind,
  options: { receiptError?: boolean; originalReverted?: boolean } = {},
): Eip1193ProviderLike & { requests: string[] } {
  const requests: string[] = [];
  return {
    requests,
    request: async (args) => {
      requests.push(args.method);
      switch (args.method) {
        case 'eth_chainId':
          return '0x61';
        case 'eth_sendTransaction':
          return HASH;
        case 'eth_blockNumber':
          return '0x1';
        case 'eth_getBalance':
          return '0xffffffffffffffff';
        case 'eth_gasPrice':
          return '0x1';
        case 'eth_getTransactionByHash':
          return (args.params as string[])[0]?.toLowerCase() === HASH.toLowerCase()
            ? pendingTx()
            : null;
        case 'eth_getTransactionReceipt': {
          // viem's receipt read has no retry of its own: a non-not-found RPC error rejects
          // the wait before its deadline.
          if (options.receiptError) {
            throw Object.assign(new Error('Request exceeds defined limit'), { code: -32005 });
          }
          const hash = (args.params as string[])[0]?.toLowerCase();
          if (options.originalReverted && hash === HASH.toLowerCase()) {
            return { ...successReceipt(), transactionHash: HASH, to: ROUTER, status: '0x0' };
          }
          return hash === REPLACEMENT_HASH.toLowerCase() ? successReceipt() : null;
        }
        case 'eth_getBlockByNumber':
          return blockWith(kind);
        default:
          throw Object.assign(new Error('The method does not exist.'), { code: -32601 });
      }
    },
  };
}

function depsFor(
  provider: Eip1193ProviderLike,
  events: TxEvent[],
  isStale: () => boolean = () => false,
): ExecDeps {
  return {
    provider,
    eoa: EOA,
    chain: CHAIN,
    dispatch: (event) => events.push(event),
    dispatchAccount: () => {},
    reportProviderLimitation: () => {},
    signAuthorization: async () => {
      throw new Error('signing must not happen in the settlement tests');
    },
    isStale,
  };
}

/** A reset while the receipt wait is in flight: the run generation flips after the send. */
function resetDuringWait(provider: Eip1193ProviderLike): {
  provider: Eip1193ProviderLike;
  isStale: () => boolean;
} {
  let stale = false;
  return {
    provider: {
      request: async (args) => {
        const result = await provider.request(args);
        if (args.method === 'eth_getTransactionReceipt') stale = true;
        return result;
      },
    },
    isStale: () => stale,
  };
}

function review() {
  return {
    chainId: 97,
    account: EOA,
    targetContract: ROUTER,
    functionName: 'claim',
    inputs: '1',
    minOutput: '—',
    fee: '—',
    gasPayer: EOA,
    authorizationChange: '—',
    estimatedGas: '—',
    nativeBalance: '—',
  };
}

function directSpec(): WriteSpec & { direct: NonNullable<WriteSpec['direct']> } {
  return {
    review: review(),
    expectedChainId: 97,
    batchCallData: '0xdeadbeef' as Hex,
    quoteId: 'q',
    minOutput: '—',
    slippageBps: 0,
    deadline: 0,
    manifestVersion: 'v1-rc',
    direct: { to: ROUTER, data: '0xcafef00d' as Hex },
  };
}

function sessionSpec(): WriteSpec {
  return {
    review: review(),
    kernel: '0x4444444444444444444444444444444444444444' as Hex,
    expectedChainId: 97,
    batchCallData: '0xdeadbeef' as Hex,
    quoteId: 'q',
    minOutput: '—',
    slippageBps: 0,
    deadline: 0,
    manifestVersion: 'v1-rc',
    crossChain: false,
  };
}

const eventTypes = (events: TxEvent[]) => events.map((event) => event.type);

describe('runDirect × wallet replacement', () => {
  it('a wallet Cancel resolves as cancelled, never as a successful write', async () => {
    const events: TxEvent[] = [];
    const outcome = await runDirect(
      directSpec(),
      depsFor(replacementProvider('cancelled'), events),
    );
    expect(outcome).toBe('cancelled');
    expect(eventTypes(events)).toEqual([
      'preflight-ok',
      'authorization-requested',
      'authorization-signed',
      'simulation-ok',
      'tx-signed',
      'receipt-pending',
      'user-rejected',
    ]);
    expect(events.some((event) => event.type === 'receipt-success')).toBe(false);
  });

  it('a speed-up is confirmed on the replacement hash, not the dropped one', async () => {
    const events: TxEvent[] = [];
    const outcome = await runDirect(directSpec(), depsFor(replacementProvider('repriced'), events));
    expect(outcome).toBe('confirmed');
    expect(events.at(-1)).toEqual({ type: 'receipt-success', hash: REPLACEMENT_HASH });
  });

  it('a substitute transaction reports Replaced instead of a success', async () => {
    const events: TxEvent[] = [];
    const outcome = await runDirect(directSpec(), depsFor(replacementProvider('replaced'), events));
    expect(outcome).toBe('failed');
    expect(events.at(-1)).toEqual({ type: 'tx-replaced', hash: REPLACEMENT_HASH });
    expect(events.some((event) => event.type === 'receipt-success')).toBe(false);
  });

  it('a reverted receipt is a failure, not a success', async () => {
    const events: TxEvent[] = [];
    const outcome = await runDirect(
      directSpec(),
      depsFor(replacementProvider('repriced', { originalReverted: true }), events),
    );
    expect(outcome).toBe('failed');
    expect(events.at(-1)).toEqual({ type: 'tx-reverted', kind: 'unknown' });
    expect(events.some((event) => event.type === 'receipt-success')).toBe(false);
  });

  it('a reset after the receipt settles keeps the landed outcome, not a false failure', async () => {
    const events: TxEvent[] = [];
    const reset = resetDuringWait(replacementProvider('repriced'));
    const outcome = await runDirect(directSpec(), depsFor(reset.provider, events, reset.isStale));
    expect(outcome).toBe('confirmed');
    // The abandoned generation writes no machine events; the settled outcome still returns.
    expect(eventTypes(events).at(-1)).toBe('receipt-pending');
    expect(events.some((event) => event.type === 'receipt-success')).toBe(false);
  });

  it('a stale cancel on the direct path keeps its own outcome, not a failed write', async () => {
    const events: TxEvent[] = [];
    const reset = resetDuringWait(replacementProvider('cancelled'));
    const outcome = await runDirect(directSpec(), depsFor(reset.provider, events, reset.isStale));
    expect(outcome).toBe('cancelled');
    expect(events.some((event) => event.type === 'user-rejected')).toBe(false);
    expect(eventTypes(events).at(-1)).toBe('receipt-pending');
  });

  it('a stale substitute on the direct path still reports failed without writing the machine', async () => {
    const events: TxEvent[] = [];
    const reset = resetDuringWait(replacementProvider('replaced'));
    const outcome = await runDirect(directSpec(), depsFor(reset.provider, events, reset.isStale));
    expect(outcome).toBe('failed');
    expect(events.some((event) => event.type === 'tx-replaced')).toBe(false);
    expect(eventTypes(events).at(-1)).toBe('receipt-pending');
  });

  it('a stale revert on the direct path reports failed without writing the machine', async () => {
    const events: TxEvent[] = [];
    const reset = resetDuringWait(replacementProvider('repriced', { originalReverted: true }));
    const outcome = await runDirect(directSpec(), depsFor(reset.provider, events, reset.isStale));
    expect(outcome).toBe('failed');
    expect(events.some((event) => event.type === 'tx-reverted')).toBe(false);
    expect(eventTypes(events).at(-1)).toBe('receipt-pending');
  });
});

describe('runSession × wallet replacement', () => {
  it('a wallet Cancel stops at cancelled without a documented receipt', async () => {
    const events: TxEvent[] = [];
    const outcome = await runSession(
      sessionSpec(),
      depsFor(replacementProvider('cancelled'), events),
    );
    expect(outcome).toBe('cancelled');
    expect(eventTypes(events).at(-1)).toBe('user-rejected');
    expect(events.some((event) => event.type === 'receipt-success')).toBe(false);
  });

  it('a substitute transaction reports Replaced on the session path too', async () => {
    const events: TxEvent[] = [];
    const outcome = await runSession(
      sessionSpec(),
      depsFor(replacementProvider('replaced'), events),
    );
    expect(outcome).toBe('failed');
    expect(events.at(-1)).toEqual({ type: 'tx-replaced', hash: REPLACEMENT_HASH });
    expect(events.some((event) => event.type === 'receipt-success')).toBe(false);
  });

  it('a rejected receipt wait stays pending instead of fabricating a terminal state', async () => {
    // The injected receipt rejection surfaces through the executor's [tx] console.error
    // observability; substitute the sink for this case only (the rest of this suite uses
    // working receipt waits, where a console.error would be a real regression signal) and
    // restore it before the next case.
    const txLogSink = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const events: TxEvent[] = [];
    const outcome = await runSession(
      sessionSpec(),
      depsFor(replacementProvider('repriced', { receiptError: true }), events),
    );
    expect(outcome).toBe('pending');
    expect(eventTypes(events).at(-1)).toBe('receipt-pending');
    expect(
      events.some((event) =>
        ['receipt-success', 'tx-reverted', 'tx-replaced', 'user-rejected'].includes(event.type),
      ),
    ).toBe(false);
    txLogSink.mockRestore();
  });

  it('a speed-up is confirmed on the replacement hash', async () => {
    const events: TxEvent[] = [];
    const outcome = await runSession(
      sessionSpec(),
      depsFor(replacementProvider('repriced'), events),
    );
    expect(outcome).toBe('confirmed');
    expect(events.at(-1)).toEqual({ type: 'receipt-success', hash: REPLACEMENT_HASH });
  });

  it('a cross-chain speed-up pins the receipt link to the landed source hash', async () => {
    const events: TxEvent[] = [];
    const outcome = await runSession(
      { ...sessionSpec(), crossChain: true },
      depsFor(replacementProvider('repriced'), events),
    );
    expect(outcome).toBe('pending');
    expect(events.at(-1)).toEqual({ type: 'source-confirmed', hash: REPLACEMENT_HASH });
    const context = events.reduce(
      reduceTx,
      reduceTx(INITIAL_TX_CONTEXT, {
        type: 'begin',
        review: review(),
      }),
    );
    expect(context.txHash).toBe(REPLACEMENT_HASH);
  });

  it('a cancel on a cross-chain write never reports the source leg as confirmed', async () => {
    const events: TxEvent[] = [];
    const outcome = await runSession(
      { ...sessionSpec(), crossChain: true },
      depsFor(replacementProvider('cancelled'), events),
    );
    expect(outcome).toBe('cancelled');
    expect(events.some((event) => event.type === 'source-confirmed')).toBe(false);
    expect(eventTypes(events).at(-1)).toBe('user-rejected');
  });

  it('a substitute transaction on a cross-chain write reports Replaced', async () => {
    const events: TxEvent[] = [];
    const outcome = await runSession(
      { ...sessionSpec(), crossChain: true },
      depsFor(replacementProvider('replaced'), events),
    );
    expect(outcome).toBe('failed');
    expect(events.some((event) => event.type === 'source-confirmed')).toBe(false);
    expect(events.at(-1)).toEqual({ type: 'tx-replaced', hash: REPLACEMENT_HASH });
  });

  it('a reverted receipt is a failure on the session path too', async () => {
    const events: TxEvent[] = [];
    const outcome = await runSession(
      sessionSpec(),
      depsFor(replacementProvider('repriced', { originalReverted: true }), events),
    );
    expect(outcome).toBe('failed');
    expect(events.at(-1)).toEqual({ type: 'tx-reverted', kind: 'unknown' });
    expect(events.some((event) => event.type === 'receipt-success')).toBe(false);
  });

  it('a reset after the receipt settles keeps the landed outcome on the session path', async () => {
    const events: TxEvent[] = [];
    const reset = resetDuringWait(replacementProvider('repriced'));
    const outcome = await runSession(sessionSpec(), depsFor(reset.provider, events, reset.isStale));
    expect(outcome).toBe('confirmed');
    expect(eventTypes(events).at(-1)).toBe('receipt-pending');
    expect(events.some((event) => event.type === 'receipt-success')).toBe(false);
  });

  it('a stale cancel keeps its own outcome instead of a failed write', async () => {
    const events: TxEvent[] = [];
    const reset = resetDuringWait(replacementProvider('cancelled'));
    const outcome = await runSession(sessionSpec(), depsFor(reset.provider, events, reset.isStale));
    expect(outcome).toBe('cancelled');
    expect(events.some((event) => event.type === 'user-rejected')).toBe(false);
  });

  it('a stale substitute still reports failed without writing the reset machine', async () => {
    const events: TxEvent[] = [];
    const reset = resetDuringWait(replacementProvider('replaced'));
    const outcome = await runSession(sessionSpec(), depsFor(reset.provider, events, reset.isStale));
    expect(outcome).toBe('failed');
    expect(events.some((event) => event.type === 'tx-replaced')).toBe(false);
  });

  it('a stale revert on the session path reports failed without writing the machine', async () => {
    const events: TxEvent[] = [];
    const reset = resetDuringWait(replacementProvider('repriced', { originalReverted: true }));
    const outcome = await runSession(sessionSpec(), depsFor(reset.provider, events, reset.isStale));
    expect(outcome).toBe('failed');
    expect(events.some((event) => event.type === 'tx-reverted')).toBe(false);
    expect(eventTypes(events).at(-1)).toBe('receipt-pending');
  });

  it('a stale cross-chain source leg keeps pending and skips source-confirmed', async () => {
    const events: TxEvent[] = [];
    const reset = resetDuringWait(replacementProvider('repriced'));
    const outcome = await runSession(
      { ...sessionSpec(), crossChain: true },
      depsFor(reset.provider, events, reset.isStale),
    );
    expect(outcome).toBe('pending');
    expect(events.some((event) => event.type === 'source-confirmed')).toBe(false);
  });
});

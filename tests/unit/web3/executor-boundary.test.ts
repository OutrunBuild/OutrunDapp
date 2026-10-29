// Layer-2 executor boundary tests: lib/web3/tx-executor.ts driven against the FROZEN
// EIP-5792 wallet simulator (fake-wallet.ts, written from spec + wallet transcripts, never
// from the implementation). What must hold forever:
//   - the executor speaks the spec's request sequence (probe → sendCalls → status poll)
//   - the sendCalls envelope matches v2.0.0 with required atomicity
//   - wallet-side outcomes map to exactly one terminal UI event each
// If an executor change and this file disagree, the freeze rule in fake-wallet.ts applies.
import { describe, expect, it, vi } from 'vitest';
import type { Chain, Hex } from 'viem';

import type { Eip1193ProviderLike } from '../../../lib/web3/active-provider';
import { runCalls, runDirect, type WriteSpec } from '../../../lib/web3/tx-executor';
import type { TxEvent } from '../../../lib/web3/tx-center';
import { Fake5792Wallet } from './fake-wallet';

const EOA = '0x1111111111111111111111111111111111111111' as Hex;
const TOKEN = '0x2222222222222222222222222222222222222222' as Hex;
const ROUTER = '0x3333333333333333333333333333333333333333' as Hex;
const HASH = ('0x' + 'ab'.repeat(32)) as `0x${string}`;
const CHAIN = { id: 97 } as Chain;

const sessionSpec = (): WriteSpec =>
  ({
    review: {
      chainId: 97,
      account: EOA,
      targetContract: ROUTER,
      functionName: 'genesisAndPreorder',
      inputs: '1',
      minOutput: '—',
      fee: '—',
      gasPayer: EOA,
      authorizationChange: '—',
      estimatedGas: '—',
      nativeBalance: '—',
    },
    kernel: '0xd6CEDDe84be40893d153Be9d467CD6aD37875b28' as Hex,
    expectedChainId: 97,
    batchCallData: '0xdeadbeef' as Hex,
    quoteId: 'q',
    minOutput: '—',
    slippageBps: 0,
    deadline: 0,
    manifestVersion: 'v1-rc',
    calls: [
      { target: TOKEN, value: 0n, callData: '0x095ea7b3ff' },
      { target: ROUTER, value: 0n, callData: '0x759439b0000' },
    ],
  }) as unknown as WriteSpec;

const depsFor = (
  wallet: Fake5792Wallet,
  events: TxEvent[],
  isStale: () => boolean = () => false,
  provider: Eip1193ProviderLike = wallet,
) =>
  ({
    provider,
    eoa: EOA,
    chain: CHAIN,
    dispatch: (event: TxEvent) => events.push(event),
    dispatchAccount: () => {},
    reportProviderLimitation: () => {},
    signAuthorization: async () => {
      throw new Error('signing must not happen on the external path');
    },
    isStale,
  }) as unknown as Parameters<typeof runCalls>[1];

/** A reset while the batch is out: the run generation flips after the wallet accepted it. */
function resetAfterSend(wallet: Fake5792Wallet): {
  provider: Eip1193ProviderLike;
  isStale: () => boolean;
} {
  let stale = false;
  return {
    provider: {
      request: async (args) => {
        const result = await wallet.request(args);
        if (args.method === 'wallet_sendCalls') stale = true;
        return result;
      },
    },
    isStale: () => stale,
  };
}

const methods = (wallet: Fake5792Wallet) => wallet.requests.map((r) => r.method);

describe('runCalls × frozen 5792 wallet: happy path', () => {
  it('probes capabilities, sends ONE spec-shaped sendCalls, polls status once', async () => {
    const events: TxEvent[] = [];
    const wallet = new Fake5792Wallet({ atomic: true });
    const outcome = await runCalls(sessionSpec(), depsFor(wallet, events));
    expect(outcome).toBe('confirmed');
    // Spec sequence: capability probe precedes the batch; no other wallet methods touched.
    expect(methods(wallet)).toEqual([
      'wallet_getCapabilities',
      'wallet_sendCalls',
      'wallet_getCallsStatus',
    ]);
    const sent = wallet.sentCalls[0];
    expect(sent).toBeDefined();
    // v2.0.0 envelope, atomicity required, chain id as quantity hex, legs mapped to calls.
    expect(sent!.version).toBe('2.0.0');
    expect(sent!.atomicRequired).toBe(true);
    expect(sent!.from.toLowerCase()).toBe(EOA.toLowerCase());
    expect(sent!.chainId).toBe('0x61');
    expect(sent!.calls).toEqual([
      { to: TOKEN, data: '0x095ea7b3ff' },
      { to: ROUTER, data: '0x759439b0000' },
    ]);
    // One visible terminal state; the batch id was announced before polling.
    expect(events.map((e) => e.type)).toEqual([
      'preflight-ok',
      'calls-submitted',
      'receipt-success',
    ]);
    expect(events.find((e) => e.type === 'receipt-success')).toEqual({
      type: 'receipt-success',
      hash: HASH,
    });
  });

  it('a success without receipts carries a null hash, never the bundle id', async () => {
    // Some wallets omit receipts on success: the bundle id is opaque, not an on-chain
    // hash — carrying it as the receipt hash would render an explorer dead link.
    const events: TxEvent[] = [];
    const wallet = new Fake5792Wallet({ atomic: true });
    const provider = {
      request: async (args: { method: string; params?: unknown }) => {
        if (args.method === 'wallet_getCallsStatus') return { status: 200 };
        return wallet.request(args);
      },
    };
    const outcome = await runCalls(
      sessionSpec(),
      depsFor(wallet, events, () => false, provider),
    );
    expect(outcome).toBe('confirmed');
    expect(events.find((e) => e.type === 'receipt-success')).toEqual({
      type: 'receipt-success',
      hash: null,
    });
  });

  it('a value-carrying leg serializes its value as quantity hex', async () => {
    const events: TxEvent[] = [];
    const wallet = new Fake5792Wallet({ atomic: true });
    const spec = sessionSpec();
    spec.calls = [{ target: ROUTER, value: 1n * 10n ** 18n, callData: '0x759439b0000' }];
    await runCalls(spec, depsFor(wallet, events));
    expect(wallet.sentCalls[0]!.calls).toEqual([
      { to: ROUTER, data: '0x759439b0000', value: '0xde0b6b3a7640000' },
    ]);
  });
});

describe('runCalls × frozen 5792 wallet: wallet-side failures', () => {
  it('user rejection at the sendCalls prompt surfaces as cancelled, nothing polled', async () => {
    const events: TxEvent[] = [];
    const wallet = new Fake5792Wallet({ atomic: true, sendCalls: 'user-reject' });
    const outcome = await runCalls(sessionSpec(), depsFor(wallet, events));
    expect(outcome).toBe('cancelled');
    expect(events.map((e) => e.type)).toEqual(['preflight-ok', 'user-rejected']);
    expect(methods(wallet)).not.toContain('wallet_getCallsStatus');
  });

  it('the recorded -32603 internal error surfaces as failed, not as success or cancel', async () => {
    const events: TxEvent[] = [];
    const wallet = new Fake5792Wallet({ atomic: true, sendCalls: 'internal-error' });
    const outcome = await runCalls(sessionSpec(), depsFor(wallet, events));
    expect(outcome).toBe('failed');
    expect(events.map((e) => e.type)).toEqual(['preflight-ok', 'tx-reverted']);
  });

  it('a batch that lands and reverts on-chain (500 + reverted receipt) is batch-reverted', async () => {
    const events: TxEvent[] = [];
    const wallet = new Fake5792Wallet({
      atomic: true,
      getCallsStatus: { kind: 'on-chain-failure', transactionHash: HASH },
    });
    const outcome = await runCalls(sessionSpec(), depsFor(wallet, events));
    expect(outcome).toBe('failed');
    expect(events.map((e) => e.type)).toEqual(['preflight-ok', 'calls-submitted', 'tx-reverted']);
    expect(events.find((e) => e.type === 'tx-reverted')).toEqual({
      type: 'tx-reverted',
      kind: 'batch-reverted',
    });
  });

  it('a 200 status with a mixed (0x1 + 0x0) receipt set is a failure, never a success', async () => {
    // The frozen fake only scripts single-receipt statuses, so the mixed set rides a
    // provider wrapper over its confirmed script — fake-wallet.ts itself stays untouched.
    const events: TxEvent[] = [];
    const wallet = new Fake5792Wallet({ atomic: true });
    const mixed: Eip1193ProviderLike = {
      request: async (args) => {
        if (args.method === 'wallet_getCallsStatus') {
          return {
            status: 200,
            receipts: [
              { status: '0x1', transactionHash: HASH },
              { status: '0x0', transactionHash: HASH },
            ],
          };
        }
        return wallet.request(args);
      },
    };
    const outcome = await runCalls(
      sessionSpec(),
      depsFor(wallet, events, () => false, mixed),
    );
    expect(outcome).toBe('failed');
    expect(events.map((e) => e.type)).toEqual(['preflight-ok', 'calls-submitted', 'tx-reverted']);
    expect(events.find((e) => e.type === 'tx-reverted')).toEqual({
      type: 'tx-reverted',
      kind: 'batch-reverted',
    });
    expect(events.some((e) => e.type === 'receipt-success')).toBe(false);
  });

  it('an eternally-pending batch holds Confirming as pending (no fabricated cancellation)', async () => {
    vi.useFakeTimers();
    try {
      const events: TxEvent[] = [];
      const wallet = new Fake5792Wallet({
        atomic: true,
        getCallsStatus: { kind: 'eternal-pending' },
      });
      const pending = runCalls(sessionSpec(), depsFor(wallet, events));
      await vi.advanceTimersByTimeAsync(120_000);
      expect(await pending).toBe('pending');
      expect(events.map((e) => e.type)).toEqual(['preflight-ok', 'calls-submitted']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a wallet without the atomic capability is reported unsupported, nothing sent', async () => {
    const events: TxEvent[] = [];
    const wallet = new Fake5792Wallet({ atomic: false });
    const outcome = await runCalls(sessionSpec(), depsFor(wallet, events));
    expect(outcome).toBe('unsupported');
    expect(wallet.callsRequested()).toBe(false);
    expect(events).toEqual([{ type: 'wallet-unsupported' }]);
  });

  it('a wallet whose capability probe itself fails is unsupported', async () => {
    const events: TxEvent[] = [];
    const wallet = new Fake5792Wallet({ noCapabilities: true });
    const outcome = await runCalls(sessionSpec(), depsFor(wallet, events));
    expect(outcome).toBe('unsupported');
    expect(wallet.callsRequested()).toBe(false);
  });
});

// A reset bumps the run generation while the batch is still polling. That abandons the
// observation, not the write: the wallet's answer alone decides the outcome, while the
// machine events stay suppressed so the reset context is not written into.
describe('runCalls × abandoned observation (run generation changed)', () => {
  it('a reset after the batch settles keeps the confirmed outcome and skips the events', async () => {
    const events: TxEvent[] = [];
    const wallet = new Fake5792Wallet({ atomic: true });
    const reset = resetAfterSend(wallet);
    const outcome = await runCalls(
      sessionSpec(),
      depsFor(wallet, events, reset.isStale, reset.provider),
    );
    expect(outcome).toBe('confirmed');
    expect(events.map((e) => e.type)).toEqual(['preflight-ok', 'calls-submitted']);
  });

  it('a reset during the status poll keeps the deadline outcome pending, not failed', async () => {
    vi.useFakeTimers();
    try {
      const events: TxEvent[] = [];
      const wallet = new Fake5792Wallet({
        atomic: true,
        getCallsStatus: { kind: 'eternal-pending' },
      });
      const reset = resetAfterSend(wallet);
      const pending = runCalls(
        sessionSpec(),
        depsFor(wallet, events, reset.isStale, reset.provider),
      );
      await vi.advanceTimersByTimeAsync(120_000);
      expect(await pending).toBe('pending');
      expect(events.map((e) => e.type)).toEqual(['preflight-ok', 'calls-submitted']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a stale on-chain batch failure still reports failed without writing the machine', async () => {
    const events: TxEvent[] = [];
    const wallet = new Fake5792Wallet({
      atomic: true,
      getCallsStatus: { kind: 'on-chain-failure', transactionHash: HASH },
    });
    const reset = resetAfterSend(wallet);
    const outcome = await runCalls(
      sessionSpec(),
      depsFor(wallet, events, reset.isStale, reset.provider),
    );
    expect(outcome).toBe('failed');
    expect(events.map((e) => e.type)).toEqual(['preflight-ok', 'calls-submitted']);
  });
});

describe('runDirect × frozen 5792 wallet', () => {
  it('sends one plain transaction to the direct target and reports the receipt', async () => {
    const events: TxEvent[] = [];
    const wallet = new Fake5792Wallet();
    wallet.requests.length = 0;
    // eth_sendTransaction + receipt reading ride the provider/public client pair; the fake
    // answers the provider half, the receipt comes from the executor's public client via the
    // same provider transport.
    (
      wallet as unknown as {
        request: (a: { method: string; params?: unknown }) => Promise<unknown>;
      }
    ).request = async (args) => {
      wallet.requests.push({ method: args.method, params: args.params });
      if (args.method === 'eth_chainId') return '0x61';
      if (args.method === 'eth_sendTransaction') return HASH as `0x${string}`;
      if (args.method === 'eth_getTransactionReceipt') {
        return {
          status: '0x1',
          transactionHash: HASH,
          blockNumber: '0x1',
          blockHash: HASH,
          from: EOA,
          to: ROUTER,
          cumulativeGasUsed: '0x1',
          gasUsed: '0x1',
          logs: [],
          logsBloom: '0x' + '0'.repeat(512),
          transactionIndex: '0x0',
          effectiveGasPrice: '0x1',
          type: '0x2',
        };
      }
      throw Object.assign(new Error('The method does not exist.'), { code: -32601 });
    };
    const spec = {
      review: {
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
      },
      expectedChainId: 97,
      batchCallData: '0xdeadbeef' as Hex,
      quoteId: 'q',
      minOutput: '—',
      slippageBps: 0,
      deadline: 0,
      manifestVersion: 'v1-rc',
      direct: { to: ROUTER, data: '0xcafef00d' as Hex },
    } as unknown as WriteSpec;
    const outcome = await runDirect(
      spec as WriteSpec & { direct: { to: Hex; data: Hex } },
      depsFor(wallet, events),
    );
    expect(outcome).toBe('confirmed');
    const send = wallet.requests.find((r) => r.method === 'eth_sendTransaction');
    expect((send!.params as { to: string; data: Hex }[])[0]).toMatchObject({
      to: ROUTER,
      data: '0xcafef00d',
    });
    // runDirect reuses the session event chain for progress (see tx-executor.ts: the
    // authorization legs only advance the tx machine before tx-signed).
    expect(events.map((e) => e.type)).toEqual([
      'preflight-ok',
      'authorization-requested',
      'authorization-signed',
      'simulation-ok',
      'tx-signed',
      'receipt-pending',
      'receipt-success',
    ]);
  });

  it('reports pending when the receipt wait fails (unknown is not failure)', async () => {
    const events: TxEvent[] = [];
    const wallet = new Fake5792Wallet();
    wallet.requests.length = 0;
    (
      wallet as unknown as {
        request: (a: { method: string; params?: unknown }) => Promise<unknown>;
      }
    ).request = async (args) => {
      wallet.requests.push({ method: args.method, params: args.params });
      if (args.method === 'eth_chainId') return '0x61';
      if (args.method === 'eth_sendTransaction') return HASH as `0x${string}`;
      if (args.method === 'eth_blockNumber') return '0x1';
      if (args.method === 'eth_getTransactionByHash') {
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
          maxFeePerGas: null,
          maxPriorityFeePerGas: null,
          type: '0x2',
          chainId: '0x61',
          v: '0x0',
          r: '0x0',
          s: '0x0',
          yParity: '0x0',
          accessList: [],
          authorizationList: null,
        };
      }
      if (args.method === 'eth_getTransactionReceipt') {
        // viem's receipt read carries no retry of its own: a non-not-found RPC error
        // rejects the wait before its deadline.
        throw Object.assign(new Error('Request exceeds defined limit'), { code: -32005 });
      }
      throw Object.assign(new Error('The method does not exist.'), { code: -32601 });
    };
    const spec = {
      review: {
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
      },
      expectedChainId: 97,
      batchCallData: '0xdeadbeef' as Hex,
      quoteId: 'q',
      minOutput: '—',
      slippageBps: 0,
      deadline: 0,
      manifestVersion: 'v1-rc',
      direct: { to: ROUTER, data: '0xcafef00d' as Hex },
    } as unknown as WriteSpec;
    const outcome = await runDirect(
      spec as WriteSpec & { direct: { to: Hex; data: Hex } },
      depsFor(wallet, events),
    );
    // The tx may still land: the machine keeps Confirming… (no terminal event) and the
    // caller gets the existing pending outcome instead of a rejection.
    expect(outcome).toBe('pending');
    expect(wallet.requests.some((r) => r.method === 'eth_getTransactionReceipt')).toBe(true);
    expect(events.map((e) => e.type)).toEqual([
      'preflight-ok',
      'authorization-requested',
      'authorization-signed',
      'simulation-ok',
      'tx-signed',
      'receipt-pending',
    ]);
  });
});

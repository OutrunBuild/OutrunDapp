// Session-write serialization: two dialogs (faucet + swap) preparing Kernel type-4 batches
// concurrently used to read the same pending nonce N and sign authorizations at N+1 —
// whichever transaction landed first consumed the sibling's authorization. The module
// session lock (per chain+eoa, prepare → broadcast) forces the second flow to re-prepare
// on the consumed nonce instead.
import { describe, expect, it, vi } from 'vitest';
import type { Chain, Hex } from 'viem';

import type { Eip1193ProviderLike } from '../../../lib/web3/active-provider';
import type { TxEvent } from '../../../lib/web3/tx-center';
import { runSession, type ExecDeps, type WriteSpec } from '../../../lib/web3/tx-executor';
import type {
  SignedAuthorization,
  Type4Ports,
  UnsignedType4,
} from '../../../lib/web3/type4-pipeline';

const EOA = '0x1111111111111111111111111111111111111111' as Hex;
const ROUTER = '0x2222222222222222222222222222222222222222' as Hex;
const KERNEL = '6c044B5eC6f1E0FD17235A1D0AbAA39b14b0A30f8' as Hex;
const HASH_A = `0x${'aa'.repeat(32)}` as Hex;
const HASH_B = `0x${'bb'.repeat(32)}` as Hex;
const BLOCK_HASH = `0x${'ee'.repeat(32)}` as Hex;
const CHAIN = { id: 97 } as Chain;

function gateReadProvider(): Eip1193ProviderLike {
  return {
    request: async (args) => {
      switch (args.method) {
        case 'eth_chainId':
          return '0x61';
        case 'eth_getBalance':
          return '0xffffffffffffffff';
        case 'eth_gasPrice':
          return '0x1';
        case 'eth_blockNumber':
          return '0x1';
        case 'eth_getTransactionByHash':
          return {
            hash: (args.params as string[])[0],
            from: EOA,
            to: ROUTER,
            nonce: '0x7',
            value: '0x0',
            input: '0xdeadbeef',
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
        case 'eth_getTransactionReceipt': {
          const hash = (args.params as string[])[0] as Hex;
          return {
            status: '0x1',
            transactionHash: hash,
            blockNumber: '0x1',
            blockHash: BLOCK_HASH,
            from: EOA,
            to: ROUTER,
            cumulativeGasUsed: '0x1',
            gasUsed: '0x1',
            logs: [],
            logsBloom: `0x${'00'.repeat(256)}`,
            contractAddress: null,
            transactionIndex: '0x0',
            effectiveGasPrice: '0x1',
            type: '0x2',
          };
        }
        default:
          throw Object.assign(new Error('The method does not exist.'), { code: -32601 });
      }
    },
  };
}

const AUTH: SignedAuthorization = {
  chainId: 97,
  address: KERNEL,
  nonce: 0,
  r: `0x${'11'.repeat(32)}` as Hex,
  s: `0x${'22'.repeat(32)}` as Hex,
  yParity: 0,
};

/**
 * A chain-level nonce ledger: prepare reads the next unconsumed nonce, broadcast consumes
 * it. Shared across both flows' ports (module hoist) like the chain itself — per-flow
 * ledgers would hide the race. Unsigned flows racing the same nonce is exactly the bug
 * shape; serialized flows see distinct nonces. `staleReads` simulates RPC lag: the next
 * that many getPendingNonce reads return the pre-broadcast value even after a send.
 */
const ledgerState = vi.hoisted(() => ({ next: 7, staleReads: 0 }));

function ledgerPorts(timeline: string[]): Type4Ports {
  return {
    getPendingNonce: async () => {
      if (ledgerState.staleReads > 0) {
        ledgerState.staleReads -= 1;
        return ledgerState.next - 1;
      }
      return ledgerState.next;
    },
    getChainId: async () => 97,
    getCode: async () => '0x' as Hex,
    signAuthorization: async (req) => ({ ...AUTH, nonce: req.nonce }),
    simulateType4: async () => ({ ok: true as const }),
    sendType4: async (tx: UnsignedType4) => {
      timeline.push(`send:nonce=${tx.nonce}:auth=${tx.authorizationList?.[0]?.nonce ?? 'none'}`);
      // The broadcast consumes the pending nonce the preparation read: a second flow that
      // prepared against the same nonce would reuse the consumed authorization.
      ledgerState.next = tx.nonce + 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return (
        timeline.filter((line) => line.startsWith('prepare')).length === 1 ? HASH_A : HASH_B
      ) as Hex;
    },
  };
}

const portsState = vi.hoisted(() => ({ timeline: [] as string[] }));

vi.mock('../../../lib/web3/viem-type4-adapter', () => ({
  buildType4Ports: () => ledgerPorts(portsState.timeline),
}));

vi.mock('../../../lib/web3/type4-pipeline', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/web3/type4-pipeline')>();
  return {
    ...actual,
    // The real prepareType4 reads its nonce through the ports; timestamp it so the test can
    // order prepare vs broadcast across the two flows, then delegate.
    prepareType4: async (ports: Type4Ports, input: never) => {
      portsState.timeline.push('prepare');
      return actual.prepareType4(ports, input);
    },
    needsReprepare: () => false,
  };
});

function depsFor(events: TxEvent[], eoa: Hex = EOA): ExecDeps {
  return {
    provider: gateReadProvider(),
    eoa,
    chain: CHAIN,
    dispatch: (event) => events.push(event),
    dispatchAccount: () => {},
    reportProviderLimitation: () => {},
    signAuthorization: async (req) => ({ ...AUTH, nonce: req.nonce }),
    isStale: () => false,
  };
}

function sessionSpec(tag: string): WriteSpec {
  return {
    review: {
      chainId: 97,
      account: EOA,
      targetContract: ROUTER,
      functionName: tag,
      inputs: '1',
      minOutput: '—',
      fee: '—',
      gasPayer: EOA,
      authorizationChange: '—',
      estimatedGas: '—',
      nativeBalance: '—',
    },
    kernel: KERNEL,
    expectedChainId: 97,
    batchCallData: '0xdeadbeef' as Hex,
    quoteId: tag,
    minOutput: '—',
    slippageBps: 0,
    deadline: 0,
    manifestVersion: 'v1-rc',
  };
}

describe('runSession × concurrent dialogs: the second flow re-prepares on the consumed nonce', () => {
  it('serializes prepare → broadcast so authorizations never share a nonce', async () => {
    portsState.timeline.length = 0;
    ledgerState.next = 7;
    ledgerState.staleReads = 0;
    const first: TxEvent[] = [];
    const second: TxEvent[] = [];
    const [outcomeA, outcomeB] = await Promise.all([
      runSession(sessionSpec('faucet-claim'), depsFor(first)),
      runSession(sessionSpec('swap'), depsFor(second)),
    ]);
    expect(outcomeA).toBe('confirmed');
    expect(outcomeB).toBe('confirmed');
    const sends = portsState.timeline.filter((line) => line.startsWith('send'));
    expect(sends).toHaveLength(2);
    // Distinct broadcast nonces with matching authorization nonces (auth = nonce + 1 each).
    expect(sends[0]).toBe('send:nonce=7:auth=8');
    expect(sends[1]).toBe('send:nonce=8:auth=9');
  });

  it('fails closed with retry guidance when RPC lag hides the consumed nonce', async () => {
    // Both prepares and both freshness re-reads observe the pre-broadcast value (lag);
    // the first broadcast consumes nonce 7 while every read still returns it. The nonce
    // floor aborts the second flow with scope-stale instead of broadcasting into it.
    // A distinct EOA isolates the module-level nonce floor from the previous test.
    const LAG_EOA = '0x2222222222222222222222222222222222222222' as Hex;
    portsState.timeline.length = 0;
    ledgerState.next = 7;
    ledgerState.staleReads = 4;
    const first: TxEvent[] = [];
    const second: TxEvent[] = [];
    const [outcomeA, outcomeB] = await Promise.all([
      runSession(sessionSpec('faucet-claim'), depsFor(first, LAG_EOA)),
      runSession(sessionSpec('swap'), depsFor(second, LAG_EOA)),
    ]);
    const outcomes = [outcomeA, outcomeB].sort();
    expect(outcomes).toEqual(['confirmed', 'failed']);
    const sends = portsState.timeline.filter((line) => line.startsWith('send'));
    expect(sends).toHaveLength(1);
    expect(sends[0]).toBe('send:nonce=6:auth=7');
    const failedEvents = outcomeA === 'failed' ? first : second;
    expect(failedEvents.map((event) => event.type)).toContain('scope-stale');
  });
});

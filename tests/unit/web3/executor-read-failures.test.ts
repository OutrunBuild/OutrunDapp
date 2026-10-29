// Pre-send read failures in runSession: the §6.4 balance gate and the §16 scope-freshness
// re-read are awaits that must exit through the machine. A rejecting RPC read here has
// broadcast nothing, so a plain 'failed' is honest — what must never happen is the
// rejection escaping the executor into the fire-and-forget call sites (unhandled
// rejection, machine stuck mid-flow).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chain, Hex } from 'viem';

import type { Eip1193ProviderLike } from '../../../lib/web3/active-provider';
import type { TxEvent } from '../../../lib/web3/tx-center';
import { runSession, type ExecDeps, type WriteSpec } from '../../../lib/web3/tx-executor';

// Failure-injection suite: the executor's [tx] console.error observability fires on every
// injected read rejection by design; substitute the sink so the viem stack traces do not
// flood the run output (the outcome assertions below carry the signal). The suite's own
// afterEach runs vi.restoreAllMocks(), so the sink is re-armed per test instead of
// installed once at module scope.
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

const EOA = '0x1111111111111111111111111111111111111111' as Hex;
const ROUTER = '0x2222222222222222222222222222222222222222' as Hex;
const CHAIN = { id: 97 } as Chain;

// The type-4 legs have their own suites; the batch is injected as already prepared so
// only the pre-send read sites run against failure-injecting fakes.
const session = vi.hoisted(() => ({
  hash: `0x${'ab'.repeat(32)}`,
  gasLimit: null as bigint | null,
  ports: {
    getPendingNonce: async () => 5,
    getChainId: async () => 97,
    getCode: async () => '0x' as Hex,
  },
}));

vi.mock('../../../lib/web3/viem-type4-adapter', () => ({
  buildType4Ports: () => session.ports,
  resolveType4GasLimit: async () => {
    if (session.gasLimit == null) throw new Error('no estimate');
    return session.gasLimit;
  },
}));
vi.mock('../../../lib/web3/type4-pipeline', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/web3/type4-pipeline')>();
  return {
    ...actual,
    // scope deliberately left empty. No case in this suite reaches sendPrepared, so
    // sessionNonceFloor is never written here and the floor gate stays simply unreachable
    // — not NaN-neutralized as in executor-replacement.test.ts, where every runSession
    // case broadcasts. If a send-path case is ever added here, the fill-trio prerequisite
    // documented there applies before giving scope a real nonce.
    prepareType4: async () => ({ prepared: { scope: {} } }),
    sendPrepared: async () => session.hash,
    needsReprepare: vi.fn(() => false),
  };
});

function resetPorts(): void {
  session.gasLimit = null;
  session.ports.getPendingNonce = async () => 5;
  session.ports.getChainId = async () => 97;
  session.ports.getCode = async () => '0x' as Hex;
}

/** Provider stub answering only the gate reads; everything else is a missing method. */
function gateReadProvider(
  options: { balance?: boolean; gasPrice?: boolean; balanceHex?: string } = {},
): Eip1193ProviderLike {
  return {
    request: async (args) => {
      switch (args.method) {
        case 'eth_chainId':
          return '0x61';
        case 'eth_getBalance':
          if (options.balance) {
            throw Object.assign(new Error('Request exceeds defined limit'), { code: -32005 });
          }
          return (options.balanceHex ?? '0xffffffffffffffff') as `0x${string}`;
        case 'eth_gasPrice':
          if (options.gasPrice) {
            throw Object.assign(new Error('Request exceeds defined limit'), { code: -32005 });
          }
          return '0x1';
        default:
          throw Object.assign(new Error('The method does not exist.'), { code: -32601 });
      }
    },
  };
}

function depsFor(provider: Eip1193ProviderLike, events: TxEvent[]): ExecDeps {
  return {
    provider,
    eoa: EOA,
    chain: CHAIN,
    dispatch: (event) => events.push(event),
    dispatchAccount: () => {},
    reportProviderLimitation: () => {},
    signAuthorization: async () => {
      throw new Error('signing must not happen in the read-failure tests');
    },
    isStale: () => false,
  };
}

function sessionSpec(): WriteSpec {
  return {
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
  };
}

describe('runSession × pre-send read failures', () => {
  afterEach(() => {
    resetPorts();
    vi.restoreAllMocks();
  });

  it('a same-source gate blocks a balance that covers the static ceiling only', async () => {
    // Resolver quotes 1.5M gas priced at 2x gasPrice (3M wei) while the static fallback
    // covers 625k wei: a 1M-wei balance sits in the gap the old ceiling would have let
    // through, and must hit preflight-block-gas before any wallet prompt.
    resetPorts();
    session.gasLimit = 1_500_000n;
    const events: TxEvent[] = [];
    const outcome = await runSession(
      sessionSpec(),
      depsFor(gateReadProvider({ balanceHex: '0xf4240' }), events),
    );
    expect(outcome).toBe('failed');
    expect(events).toEqual([{ type: 'preflight-ok' }, { type: 'preflight-block-gas' }]);
  });

  it('a rejected balance-gate read exits through the machine, not as a rejection', async () => {
    const events: TxEvent[] = [];
    const outcome = await runSession(
      sessionSpec(),
      depsFor(gateReadProvider({ balance: true }), events),
    );
    expect(outcome).toBe('failed');
    expect(events).toEqual([{ type: 'tx-reverted', kind: 'unknown' }]);
  });

  it('a rejected gas price read exits through the machine, not as a rejection', async () => {
    const events: TxEvent[] = [];
    const outcome = await runSession(
      sessionSpec(),
      depsFor(gateReadProvider({ gasPrice: true }), events),
    );
    expect(outcome).toBe('failed');
    expect(events).toEqual([{ type: 'tx-reverted', kind: 'unknown' }]);
  });

  it('a rejected scope-freshness nonce read fails the flow before anything broadcasts', async () => {
    resetPorts();
    session.ports.getPendingNonce = async () => {
      throw Object.assign(new Error('Request exceeds defined limit'), { code: -32005 });
    };
    const events: TxEvent[] = [];
    const outcome = await runSession(sessionSpec(), depsFor(gateReadProvider(), events));
    expect(outcome).toBe('failed');
    // Full walk: the failure must come AFTER the gate and the simulation legs — a merged
    // or hoisted read (failing at the gate instead of §16) would produce a shorter walk
    // and must fail here.
    expect(events).toEqual([
      { type: 'preflight-ok' },
      { type: 'authorization-requested' },
      { type: 'authorization-signed' },
      { type: 'simulation-ok' },
      { type: 'tx-reverted', kind: 'unknown' },
    ]);
  });

  it('a rejected scope-freshness code read fails the flow before anything broadcasts', async () => {
    resetPorts();
    session.ports.getCode = async () => {
      throw Object.assign(new Error('Request exceeds defined limit'), { code: -32005 });
    };
    const events: TxEvent[] = [];
    const outcome = await runSession(sessionSpec(), depsFor(gateReadProvider(), events));
    expect(outcome).toBe('failed');
    expect(events).toEqual([
      { type: 'preflight-ok' },
      { type: 'authorization-requested' },
      { type: 'authorization-signed' },
      { type: 'simulation-ok' },
      { type: 'tx-reverted', kind: 'unknown' },
    ]);
  });

  it('a rejected scope-freshness chain read fails the flow before anything broadcasts', async () => {
    resetPorts();
    session.ports.getChainId = async () => {
      throw Object.assign(new Error('Request exceeds defined limit'), { code: -32005 });
    };
    const events: TxEvent[] = [];
    const outcome = await runSession(sessionSpec(), depsFor(gateReadProvider(), events));
    expect(outcome).toBe('failed');
    expect(events).toEqual([
      { type: 'preflight-ok' },
      { type: 'authorization-requested' },
      { type: 'authorization-signed' },
      { type: 'simulation-ok' },
      { type: 'tx-reverted', kind: 'unknown' },
    ]);
  });

  it('a stale balance-gate failure writes nothing into the reset generation', async () => {
    const events: TxEvent[] = [];
    const staleDeps = {
      ...depsFor(gateReadProvider({ balance: true }), events),
      isStale: () => true,
    };
    const outcome = await runSession(sessionSpec(), staleDeps);
    expect(outcome).toBe('failed');
    expect(events).toEqual([]);
  });

  it('a stale scope-freshness failure writes nothing after the simulation legs', async () => {
    resetPorts();
    session.ports.getPendingNonce = async () => {
      throw Object.assign(new Error('Request exceeds defined limit'), { code: -32005 });
    };
    const events: TxEvent[] = [];
    // Live through the gate and simulation legs, go stale only at the §16 re-read.
    // Three live checks precede it: the gate null-read guard, the post-gate check, and
    // the lock-entry acquire-and-revalidate (P2-009 session mutex).
    let checks = 0;
    const flipDeps = {
      ...depsFor(gateReadProvider(), events),
      isStale: () => {
        checks += 1;
        return checks > 3;
      },
    };
    const outcome = await runSession(sessionSpec(), flipDeps);
    expect(outcome).toBe('failed');
    expect(events).toEqual([
      { type: 'preflight-ok' },
      { type: 'authorization-requested' },
      { type: 'authorization-signed' },
      { type: 'simulation-ok' },
    ]);
  });

  it('a chain switch between prepare and send aborts with scope-stale, never broadcasts', async () => {
    resetPorts();
    const { needsReprepare } = await import('../../../lib/web3/type4-pipeline');
    const seen: { chainId: number }[] = [];
    vi.mocked(needsReprepare).mockImplementationOnce((_prev, next) => {
      seen.push({ chainId: next.chainId });
      return true;
    });
    const events: TxEvent[] = [];
    const outcome = await runSession(sessionSpec(), depsFor(gateReadProvider(), events));
    expect(outcome).toBe('failed');
    expect(seen).toEqual([{ chainId: 97 }]);
    expect(events).toEqual([
      { type: 'preflight-ok' },
      { type: 'authorization-requested' },
      { type: 'authorization-signed' },
      { type: 'simulation-ok' },
      { type: 'scope-stale' },
    ]);
  });
});

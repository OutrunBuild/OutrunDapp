// FROZEN wallet simulator — the Layer-2 boundary fake for the executor tests.
//
// Written ONCE from the EIP-5792 spec + recorded real-wallet behavior (MetaMask on BSC
// testnet, 2026-10 captures: chain-keyed capabilities envelope, sendCalls v2.0.0 params,
// numeric getCallsStatus codes, the bare -32603 internal-error shape). It knows the WALLET
// side of the protocol only — never the executor's internals — so a behavioral change in
// lib/web3/tx-executor.ts turns these tests red instead of the fake agreeing with the code.
//
// FREEZE RULE: do not modify this file in the same change as an executor change. If the
// executor and the fake disagree, one of them is wrong against the spec — investigate both;
// only a spec/transcript citation may move this file.

/** Recorded MetaMask internal-error shape (inpage console, 2026-10-24): bare -32603 with a
 * data object and no revert payload — the wallet's own machinery failed pre-send. */
export const INTERNAL_ERROR = Object.assign(new Error('Internal JSON-RPC error.'), {
  code: -32603,
  data: { cause: 'internal' },
});
export const USER_REJECTION = Object.assign(new Error('User rejected the request.'), {
  code: 4001,
});
export const METHOD_UNAVAILABLE = Object.assign(new Error('The method does not exist.'), {
  code: -32601,
});

export type SendCallsInvocation = {
  from: string;
  chainId: string;
  version: string;
  atomicRequired?: boolean;
  calls: { to: string; data?: string; value?: string }[];
};

export type CallsStatusScript =
  | { kind: 'confirmed'; transactionHash: `0x${string}` }
  /** Numeric failure (4xx/5xx) with a reverted receipt: the bundle landed and reverted. */
  | { kind: 'on-chain-failure'; transactionHash: `0x${string}` }
  /** Stays pending forever: the caller's deadline decides. */
  | { kind: 'eternal-pending' };

export type FakeWalletOptions = {
  /** Wallet reports the atomic capability (spec: missing entry → not supported). */
  atomic?: boolean;
  /** Capability probe itself throws (wallet without EIP-5792 → method unavailable). */
  noCapabilities?: boolean;
  sendCalls?: 'ok' | 'user-reject' | 'internal-error';
  getCallsStatus?: CallsStatusScript;
};

export type RecordedRequest = { method: string; params: unknown };

export class Fake5792Wallet {
  readonly requests: RecordedRequest[] = [];
  readonly sentCalls: SendCallsInvocation[] = [];
  private batchCounter = 0;

  constructor(private readonly options: FakeWalletOptions = {}) {}

  /** The EIP-1193 request fn — hand this to the code under test. */
  readonly request = async (args: { method: string; params?: unknown }): Promise<unknown> => {
    const { method, params } = args;
    this.requests.push({ method, params });
    switch (method) {
      case 'eth_chainId':
        return '0x61';
      case 'eth_getCode':
        return '0x';
      case 'wallet_getCapabilities':
        if (this.options.noCapabilities) throw METHOD_UNAVAILABLE;
        if (!this.options.atomic) return {};
        // Chain-keyed envelope per spec (wagmi-style); 0x61 = 97.
        return { '0x61': { atomic: { status: 'supported' } } };
      case 'wallet_sendCalls': {
        if (this.options.sendCalls === 'user-reject') throw USER_REJECTION;
        if (this.options.sendCalls === 'internal-error') throw INTERNAL_ERROR;
        // Spec: params is a one-element array carrying the invocation envelope.
        const invocation = (params as SendCallsInvocation[])[0];
        this.sentCalls.push(invocation);
        this.batchCounter += 1;
        return `0xbatch-${this.batchCounter}`;
      }
      case 'wallet_getCallsStatus': {
        const script =
          this.options.getCallsStatus ??
          ({
            kind: 'confirmed',
            transactionHash: ('0x' + 'ab'.repeat(32)) as `0x${string}`,
          } as CallsStatusScript);
        if (script.kind === 'eternal-pending') return { status: 100 };
        if (script.kind === 'on-chain-failure') {
          return {
            status: 500,
            receipts: [{ status: '0x0', transactionHash: script.transactionHash }],
          };
        }
        return {
          status: 200,
          receipts: [{ status: '0x1', transactionHash: script.transactionHash }],
        };
      }
      default:
        throw METHOD_UNAVAILABLE;
    }
  };

  callsRequested(): boolean {
    return this.sentCalls.length > 0;
  }
}

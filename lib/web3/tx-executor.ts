// Wallet-executed write pipelines (embedded type-4 / external EIP-5792 / direct EOA).
// Pure orchestration over injected ports: no React, no Privy hooks, no global provider
// reads — the use-tx-center hook owns state, the re-entrancy lock and the run generation,
// and calls executeWrite. Unit-testable with plain fakes.
import { createPublicClient, createWalletClient, custom, type Chain, type Hex } from 'viem';

import type { AccountEvent } from './account';
import {
  executionToCall,
  pollCallsStatus,
  sendCallsId,
  sendCallsParams,
  supportsAtomicCalls,
} from './eip5792';
import type { BatchExecution } from './kernel';
import type { Eip1193ProviderLike } from './active-provider';
import type { TxEvent, TxReview } from './tx-center';
import {
  needsReprepare,
  prepareType4,
  sendPrepared,
  type AuthorizationRequest,
  type PrepareInput,
  type PrepareScope,
  type SignedAuthorization,
  type Type4Ports,
  type UnsignedType4,
} from './type4-pipeline';
import { buildType4Ports } from './viem-type4-adapter';

export type WriteSpec = {
  review: TxReview;
  /** Kernel implementation for session batches; omit for direct writes (no zero address). */
  kernel?: Hex;
  expectedChainId: number;
  batchCallData: Hex;
  value?: bigint;
  quoteId: string;
  minOutput: string;
  slippageBps: number;
  deadline: number;
  manifestVersion: string;
  crossChain?: boolean;
  /**
   * Direct EOA write (§7: plain contract call, no Kernel session, no authorization).
   * Faucet claims use this: `to` is the Faucet contract, `data` is claim(token) calldata.
   * Session guards (begin/endAccountSession) are Router-only — never wrap direct calls.
   */
  direct?: { to: Hex; data: Hex; value?: bigint };
  /**
   * EIP-5792 legs for the same intent. External wallets execute these through
   * wallet_sendCalls; embedded wallets ignore them and run `batchCallData` as the
   * Kernel session type-4 batch.
   */
  calls?: BatchExecution[];
};

/** Terminal outcome of one wallet-executed write. */
export type WriteOutcome =
  | 'confirmed'
  | 'cancelled'
  | 'unsupported'
  | 'failed'
  /** The wallet accepted the batch but the status poll hit its deadline — still pending. */
  | 'pending';

/** Injected ports: everything the pipelines need from the React layer. */
export type ExecDeps = {
  provider: Eip1193ProviderLike;
  eoa: Hex;
  chain: Chain;
  dispatch: (event: TxEvent) => void;
  dispatchAccount: (event: AccountEvent) => void;
  reportProviderLimitation: () => void;
  signAuthorization: (
    request: AuthorizationRequest,
    walletAddress: Hex,
  ) => Promise<SignedAuthorization>;
  /** True once the hook's run generation changed (reset or a newer flow). */
  isStale: () => boolean;
};

const ESTIMATE_BUFFER_DEFAULT_BPS = 12500;

function isUserRejection(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  // 4001: user rejected the request; 5750: user rejected the 7702 upgrade prompt.
  if (code === 4001 || code === 5750 || code === 'ACTION_REJECTED') return true;
  const message = String((error as { message?: unknown }).message ?? '');
  return /user rejected|rejected the request|denied/i.test(message);
}

/** RPC missing / not exposed by this provider (wallet_sendCalls, wallet_getCallsStatus). */
function isMethodUnavailable(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  if (code === -32601 || code === -32604) return true;
  const message = String((error as { message?: unknown }).message ?? '');
  return /not supported|not implemented|method not found|does not exist|not available|unsupported/i.test(
    message,
  );
}

/** Privy signer missing for the active address (external wallet not in its registry). */
function isSignerUnavailable(error: unknown): boolean {
  return /signing wallet not found|signer not available/i.test(
    String((error as { message?: unknown }).message ?? ''),
  );
}

function unsupported(deps: ExecDeps): WriteOutcome {
  deps.dispatch({ type: 'wallet-unsupported' });
  return 'unsupported';
}

/**
 * Direct EOA write (§7/§14 simple-call exception): sign and broadcast the exact fields
 * with no site-side simulation or review — the wallet's own pre-flight is the failure
 * surface. Faucet claims use this.
 */
export async function runDirect(
  spec: WriteSpec & { direct: NonNullable<WriteSpec['direct']> },
  deps: ExecDeps,
): Promise<WriteOutcome> {
  const direct = spec.direct;
  const { provider, eoa, dispatch } = deps;
  const reader = createPublicClient({
    chain: deps.chain,
    transport: custom({ request: provider.request }),
  });
  const wallet = createWalletClient({
    chain: deps.chain,
    transport: custom({ request: provider.request }),
  });
  dispatch({ type: 'preflight-ok' });
  // Reuse the session-path event chain for state progress: the authorization legs only
  // advance the tx machine so tx-signed lands from 'Awaiting transaction signature…'.
  dispatch({ type: 'authorization-requested' });
  dispatch({ type: 'authorization-signed' });
  dispatch({ type: 'simulation-ok' });
  let hash: Hex;
  try {
    hash = await wallet.sendTransaction({
      account: eoa,
      chain: deps.chain,
      to: direct.to,
      data: direct.data,
      value: direct.value ?? 0n,
    });
  } catch (error) {
    if (isUserRejection(error)) {
      dispatch({ type: 'user-rejected' });
      return 'cancelled';
    }
    dispatch({ type: 'tx-reverted', kind: 'unknown' });
    return 'failed';
  }
  dispatch({ type: 'tx-signed', hash });
  dispatch({ type: 'receipt-pending' });
  const receipt = await reader.waitForTransactionReceipt({ hash });
  if (deps.isStale()) return 'failed';
  if (receipt.status === 'success') {
    dispatch({ type: 'receipt-success', hash });
    return 'confirmed';
  }
  dispatch({ type: 'tx-reverted', kind: 'unknown' });
  return 'failed';
}

/** Kernel session batch (embedded wallet only; the caller guarantees the wallet kind). */
export async function runSession(spec: WriteSpec, deps: ExecDeps): Promise<WriteOutcome> {
  const { provider, eoa, dispatch } = deps;
  const ports: Type4Ports = buildType4Ports({
    provider,
    chain: deps.chain,
    signAuthorization: (request, walletAddress) => deps.signAuthorization(request, walletAddress),
  });

  // §6.4 gate before any authorization/signature: balance vs buffered estimate.
  // Independent reads in one Promise.all. estimateGas is deliberately NOT used here:
  // the session batch carries Hook begin/end legs that revert outside an active session,
  // so a plain eth_estimateGas on batchCallData fails even for valid intents — the real
  // simulation happens later in prepareType4 with the authorization attached.
  const reader = createPublicClient({
    chain: deps.chain,
    transport: custom({ request: provider.request }),
  });
  const [balance, gasPrice] = await Promise.all([
    reader.getBalance({ address: eoa }),
    reader.getGasPrice().catch(() => null),
  ]);
  if (gasPrice == null) {
    // The machine is still in Preparing…: simulation-failed would be a no-op.
    dispatch({ type: 'tx-reverted', kind: 'unknown' });
    return 'failed';
  }
  // Conservative static gas ceiling for the gate (session batches are bounded by the
  // Kernel batch shape); the exact cost is simulated in prepareType4.
  const SESSION_GAS_CEILING = 500_000n;
  const estimatedCost =
    (SESSION_GAS_CEILING * gasPrice * BigInt(ESTIMATE_BUFFER_DEFAULT_BPS)) / 10000n;
  if (deps.isStale()) return 'failed';
  dispatch({ type: 'preflight-ok' });
  if (balance < estimatedCost) {
    dispatch({ type: 'preflight-block-gas' });
    return 'failed';
  }
  if (!spec.kernel) {
    // No authorization leg exists, so simulation-failed has no reachable state.
    dispatch({ type: 'tx-reverted', kind: 'unknown' });
    return 'failed';
  }
  dispatch({ type: 'authorization-requested' });
  deps.dispatchAccount({ type: 'request-authorization' });
  let prepared: UnsignedType4 & { scope: PrepareScope };
  try {
    const result = await prepareType4(ports, {
      eoa,
      kernel: spec.kernel,
      expectedChainId: spec.expectedChainId,
      batchCallData: spec.batchCallData,
      value: spec.value,
      quoteId: spec.quoteId,
      minOutput: spec.minOutput,
      slippageBps: spec.slippageBps,
      deadline: spec.deadline,
      manifestVersion: spec.manifestVersion,
      nativeBalance: balance,
      estimatedCost,
    } satisfies PrepareInput);
    if (!('prepared' in result)) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[tx] prepare blocked', result.blocked, result.revert);
      }
      if (result.blocked === 'insufficient-native-balance') {
        dispatch({ type: 'tx-reverted', kind: 'unknown' });
      } else if (result.blocked === 'simulation-failed') {
        dispatch({ type: 'authorization-signed' });
        deps.dispatchAccount({ type: 'authorization-signed' });
        dispatch({ type: 'simulation-failed', kind: result.revert?.kind ?? 'unknown' });
      } else {
        dispatch({ type: 'authorization-signed' });
        dispatch({ type: 'simulation-failed', kind: 'unknown' });
      }
      return 'failed';
    }
    prepared = result.prepared;
  } catch (error) {
    // Dev-only diagnostics: the chain/authorization/simulation failure classes look
    // identical in the UI (one generic line), so keep the raw error visible on the console.
    if (process.env.NODE_ENV !== 'production') {
      console.error('[tx] session prepare failed', error);
    }
    deps.dispatchAccount({ type: 'reject-authorization' });
    if (isUserRejection(error)) {
      dispatch({ type: 'user-rejected' });
      return 'cancelled';
    }
    if (isSignerUnavailable(error)) return unsupported(deps);
    // Non-4001: a capability/technical failure, never "you declined".
    if (isMethodUnavailable(error)) deps.reportProviderLimitation();
    dispatch({ type: 'authorization-signed' });
    dispatch({ type: 'simulation-failed', kind: 'unknown' });
    return 'failed';
  }
  if (deps.isStale()) return 'failed';
  dispatch({ type: 'authorization-signed' });
  deps.dispatchAccount({ type: 'authorization-signed' });
  deps.dispatchAccount({ type: 'authorization-submitted' });
  dispatch({ type: 'simulation-ok' });

  // Scope freshness at send time (§16): nonce/code drift voids the simulation.
  const [freshNonce, freshCode] = await Promise.all([
    ports.getPendingNonce(eoa),
    ports.getCode(eoa),
  ]);
  if (
    needsReprepare(prepared.scope, {
      ...prepared.scope,
      nonce: freshNonce,
      accountCode: freshCode,
    })
  ) {
    dispatch({ type: 'scope-stale' });
    return 'failed';
  }
  if (deps.isStale()) return 'failed';

  let hash: Hex;
  try {
    hash = await sendPrepared(ports, prepared);
  } catch (error) {
    deps.dispatchAccount({ type: 'reject-authorization' });
    if (isUserRejection(error)) {
      dispatch({ type: 'user-rejected' });
      return 'cancelled';
    }
    if (isMethodUnavailable(error)) deps.reportProviderLimitation();
    dispatch({ type: 'tx-reverted', kind: 'unknown' });
    return 'failed';
  }
  dispatch({ type: 'tx-signed', hash });
  dispatch({ type: 'receipt-pending' });
  const receipt = await reader.waitForTransactionReceipt({
    hash,
    onReplaced: (replacement) => {
      // A cancelled replacement is the only terminal signal here; a speed-up still
      // resolves through this receipt.
      if (replacement.reason === 'cancelled') dispatch({ type: 'user-rejected' });
    },
  });
  if (deps.isStale()) return 'failed';
  if (receipt.status === 'success') {
    if (spec.crossChain) {
      // Source leg only: destination confirmation is a separate step.
      dispatch({ type: 'source-confirmed', hash });
      return 'pending';
    }
    dispatch({ type: 'receipt-success', hash });
    return 'confirmed';
  }
  dispatch({ type: 'tx-reverted', kind: 'unknown' });
  return 'failed';
}

/** EIP-5792 wallet_sendCalls batch (external wallets; the wallet owns the upgrade). */
export async function runCalls(spec: WriteSpec, deps: ExecDeps): Promise<WriteOutcome> {
  const calls = spec.calls;
  if (!calls || calls.length === 0) return unsupported(deps);
  const { provider, eoa, dispatch } = deps;
  const request = (args: { method: string; params?: unknown }) => provider.request(args);
  const atomic = await supportsAtomicCalls(request, deps.chain.id, eoa);
  if (!atomic) {
    // One method missing on this wallet, not a broken provider: do not poison the
    // account centre's capability gate.
    return unsupported(deps);
  }
  if (deps.isStale()) return 'failed';
  dispatch({ type: 'preflight-ok' });
  let batchId: string | null;
  try {
    const response = await request({
      method: 'wallet_sendCalls',
      params: sendCallsParams({
        from: eoa,
        chain: deps.chain,
        calls: calls.map(executionToCall),
      }),
    });
    batchId = sendCallsId(response);
  } catch (error) {
    if (isUserRejection(error)) {
      dispatch({ type: 'user-rejected' });
      return 'cancelled';
    }
    if (isMethodUnavailable(error)) return unsupported(deps);
    dispatch({ type: 'tx-reverted', kind: 'unknown' });
    return 'failed';
  }
  if (batchId == null) {
    dispatch({ type: 'tx-reverted', kind: 'unknown' });
    return 'failed';
  }
  dispatch({ type: 'calls-submitted', batchId });
  const status = await pollCallsStatus(request, batchId);
  if (deps.isStale()) return 'failed';
  // Deadline hit: the bundle may still land — keep Confirming… and report 'pending'
  // instead of fabricating a cancellation.
  if (status.status === 'timeout') return 'pending';
  if (status.status === 'success') {
    // Mixed/partial batches must not read as a clean success (atomic is requested, but
    // the wallet is the authority; a reverted leg is a failure).
    const reverted = status.receipts?.some((receipt) => receipt.status === '0x0');
    if (reverted) {
      dispatch({ type: 'tx-reverted', kind: 'batch-reverted' });
      return 'failed';
    }
    const hash = status.receipts?.[0]?.transactionHash ?? batchId;
    dispatch({ type: 'receipt-success', hash });
    return 'confirmed';
  }
  dispatch({ type: 'tx-reverted', kind: 'unknown' });
  return 'failed';
}

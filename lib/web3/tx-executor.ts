// Wallet-executed write pipelines (embedded type-4 / external EIP-5792 / direct EOA).
// Pure orchestration over injected ports: no React, no Privy hooks, no global provider
// reads — the use-tx-center hook owns state, the per-dialog re-entrancy lock and the run
// generation, and calls executeWrite. Concurrent session flows across dialogs additionally
// serialize prepare → broadcast on the module lock below (7702 auth-nonce race).
// Unit-testable with plain fakes.
import {
  createPublicClient,
  createWalletClient,
  custom,
  type Chain,
  type Hex,
  type ReplacementReason,
  type WaitForTransactionReceiptReturnType,
} from 'viem';

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
import { buildType4Ports, resolveType4GasLimit } from './viem-type4-adapter';

export type WriteSpec = {
  review: TxReview;
  /** Kernel implementation for session batches; omit for direct writes (no zero address). */
  kernel?: Hex;
  /** In-app gas control (embedded wallets): caller-resolved limit and fees. */
  gasLimit?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
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
  /**
   * Server data scope this write changes. On a confirmed outcome the tx center runs the
   * post-write server refresh for this scope (subgraph-freshness-gated cache invalidation +
   * prime, then router.refresh) — every server-rendered number of that verse updates without
   * per-page wiring. Omit for flows whose values are already client-read (e.g. faucet
   * personal balances); omitting means no server refresh fires.
   */
  writeScope?: { kind: 'verse'; chainId: number; verseId: string };
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

/** Capability answers are stable for one provider connection + chain + account. */
const atomicSupport = new WeakMap<Eip1193ProviderLike, Map<string, Promise<boolean>>>();

function atomicKey(chainId: number, address: Hex): string {
  return `${chainId}:${address.toLowerCase()}`;
}

function atomicSupportFor(provider: Eip1193ProviderLike): Map<string, Promise<boolean>> {
  let entries = atomicSupport.get(provider);
  if (!entries) {
    entries = new Map();
    atomicSupport.set(provider, entries);
  }
  return entries;
}

/**
 * Cached capability probe. The wallet round trip can take seconds on some builds, and its
 * answer only changes when the wallet's own feature set does — one probe per provider
 * connection covers every click on the page. Only a positive answer is cached: a wallet that
 * gains 5792 support later must not stay blocked behind a page-lifetime "no".
 *
 * The answer is parsed for the requested chain, but a flat-envelope wallet answers for its
 * active chain: warming with a stale chain id can only cost one extra probe on the real
 * chain, never a wrong capability.
 */
export function resolveAtomicCalls(
  provider: Eip1193ProviderLike,
  chainId: number,
  address: Hex,
): Promise<boolean> {
  const entries = atomicSupportFor(provider);
  const key = atomicKey(chainId, address);
  const cached = entries.get(key);
  if (cached) return cached;
  const probe = supportsAtomicCalls((args) => provider.request(args), chainId, address).then(
    (supported) => {
      if (!supported && entries.get(key) === probe) entries.delete(key);
      return supported;
    },
  );
  entries.set(key, probe);
  return probe;
}

/** A wallet that answered unsupported at send time must be re-probed on the next click. */
export function forgetAtomicCalls(
  provider: Eip1193ProviderLike,
  chainId: number,
  address: Hex,
): void {
  atomicSupportFor(provider).delete(atomicKey(chainId, address));
}

/**
 * Module-level session-write mutex: one Kernel type-4 may hold its auth nonce at a time.
 * The per-dialog useRef lock only stops re-entrancy inside the SAME hook instance — two
 * dialogs each prepare at pending nonce N and sign an authorization at N+1, and the two
 * broadcasts then collide on the same tx nonce (the §16 freshness re-read only observes
 * mined state, not the mempool, so a prepare→broadcast overlap slips through). The whole
 * prepare → broadcast section therefore runs under this lock, per (chain, eoa): a queued
 * second flow re-prepares after the first broadcasts and reads the consumed nonce fresh.
 */
const sessionLocks = new Map<string, Promise<unknown>>();

function sessionKey(chainId: number, eoa: Hex): string {
  return `${chainId}:${eoa.toLowerCase()}`;
}

/**
 * Try-lock with a bounded wait: a queued flow whose predecessor never settles (the user
 * walked away from the wallet prompt — in-flight wallet requests cannot be cancelled)
 * must fail with retry guidance, not hang forever behind a human action.
 */
const SESSION_LOCK_WAIT_MS = 60_000;

async function trySessionLock<T>(
  chainId: number,
  eoa: Hex,
  work: () => Promise<T>,
): Promise<{ acquired: true; value: T } | { acquired: false }> {
  const key = sessionKey(chainId, eoa);
  const previous = sessionLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  sessionLocks.set(key, current);
  let waitTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    const settled = await Promise.race([
      previous.then(() => true),
      new Promise<false>((resolve) => {
        waitTimer = setTimeout(() => resolve(false), SESSION_LOCK_WAIT_MS);
      }),
    ]);
    if (!settled) return { acquired: false as const };
    return { acquired: true as const, value: await work() };
  } finally {
    if (waitTimer !== undefined) clearTimeout(waitTimer);
    if (sessionLocks.get(key) === current) sessionLocks.delete(key);
    release();
  }
}

/**
 * Highest broadcast nonce per (chain, eoa) in this tab: the §16 freshness re-read observes
 * mined state, not the mempool, so under RPC lag it can hand back a nonce the tab already
 * consumed. A hash returned from sendPrepared means the node accepted the transaction, so
 * its nonce is consumed even if no node has mined it yet — never broadcast at or below it.
 */
const sessionNonceFloor = new Map<string, number>();

/** What the resolved receipt actually settles once replacement detection is applied. */
type Settlement =
  | { kind: 'cancelled' }
  | { kind: 'replaced'; hash: Hex }
  | { kind: 'succeeded'; hash: Hex }
  | { kind: 'reverted' };

/**
 * Receipt wait shared by the direct and session pipelines, including replacement
 * classification. viem resolves the SUBSTITUTE transaction's receipt whenever the wallet
 * cancels or speeds the submitted hash up (same from+nonce), so "a receipt arrived" is not
 * "this write succeeded": a cancel's receipt is itself a successful self-send, and the
 * replacement hash is the only hash that exists on chain. A rejected wait means the outcome
 * is unknown — viem's 180s deadline, or an RPC failure that outlived the transport retries —
 * not that the write failed: it may still land, so the caller keeps Confirming… and reports
 * 'pending', the same contract as the 5792 status deadline (runCalls). Once a settlement
 * resolves, that settlement — not the run generation — decides the outcome: a reset only
 * suppresses the machine events, because callers read 'failed' as "nothing landed" and may
 * retry a write that already did.
 */
async function awaitSettlement(
  wait: (
    onReplaced: (reason: ReplacementReason) => void,
  ) => Promise<WaitForTransactionReceiptReturnType>,
): Promise<Settlement | null> {
  try {
    let replacement: ReplacementReason | null = null;
    const receipt = await wait((reason) => {
      replacement = reason;
    });
    if (replacement === 'cancelled') return { kind: 'cancelled' };
    if (replacement === 'replaced') return { kind: 'replaced', hash: receipt.transactionHash };
    if (receipt.status !== 'success') return { kind: 'reverted' };
    return { kind: 'succeeded', hash: receipt.transactionHash };
  } catch (error) {
    // Dev-only diagnostics: timeout and persistent RPC failure are expected rejections
    // here (the caller keeps Confirming…), but a programming error must not vanish.
    if (process.env.NODE_ENV !== 'production') {
      console.error('[tx] receipt wait failed', error);
    }
    return null;
  }
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
  // Same session lock as the type-4 path: a direct EOA send from the same account consumes
  // the next pending nonce, so an in-flight faucet claim and a Kernel batch prepared at the
  // same nonce would invalidate each other's authorization/broadcast.
  let hash: Hex;
  try {
    const locked = await trySessionLock(spec.expectedChainId, eoa, () =>
      wallet.sendTransaction({
        account: eoa,
        chain: deps.chain,
        to: direct.to,
        data: direct.data,
        value: direct.value ?? 0n,
      }),
    );
    if (!locked.acquired) {
      dispatch({ type: 'scope-stale' });
      return 'failed';
    }
    hash = locked.value;
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
  const settlement = await awaitSettlement((onReplaced) =>
    reader.waitForTransactionReceipt({
      hash,
      onReplaced: ({ reason }) => onReplaced(reason),
    }),
  );
  if (settlement === null) return 'pending';
  const stale = deps.isStale();
  if (settlement.kind === 'cancelled') {
    // Wallet "Cancel" is a same-nonce self-send: its success receipt is not this write.
    if (!stale) dispatch({ type: 'user-rejected' });
    return 'cancelled';
  }
  if (settlement.kind === 'replaced') {
    // A different transaction took the nonce: this write never executed.
    if (!stale) dispatch({ type: 'tx-replaced', hash: settlement.hash });
    return 'failed';
  }
  if (settlement.kind === 'reverted') {
    if (!stale) dispatch({ type: 'tx-reverted', kind: 'unknown' });
    return 'failed';
  }
  if (!stale) dispatch({ type: 'receipt-success', hash: settlement.hash });
  return 'confirmed';
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
  // Estimate source matches the send path (resolveType4GasLimit): a static ceiling here
  // would pass balances that cannot fund the broadcast limit and fail post-signature.
  const reader = createPublicClient({
    chain: deps.chain,
    transport: custom({ request: provider.request }),
  });
  const [balance, gasPrice] = await Promise.all([
    reader.getBalance({ address: eoa }).catch((error) => {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[tx] balance read failed', error);
      }
      return null;
    }),
    reader.getGasPrice().catch((error) => {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[tx] gas price read failed', error);
      }
      return null;
    }),
  ]);
  if (balance == null || gasPrice == null) {
    // Pre-send reads must not reject into the fire-and-forget call sites: the machine is
    // still in Preparing… (simulation-failed would be a no-op) and nothing is broadcast
    // yet, so a plain failure is honest.
    if (deps.isStale()) return 'failed';
    dispatch({ type: 'tx-reverted', kind: 'unknown' });
    return 'failed';
  }
  // Same-source gate: the send path broadcasts `spec.gasLimit ?? resolveType4GasLimit`
  // priced at `spec.maxFeePerGas ?? 2 * marketPrice`, so the gate resolves the same pair.
  // The static ceiling below is only the fallback when the resolve fails. One
  // authorization leg is assumed (undelegated worst case; delegated accounts clear a
  // slightly higher bar, never a lower one).
  const SESSION_GAS_CEILING = 500_000n;
  let gateGasLimit: bigint | null = spec.gasLimit ?? null;
  if (gateGasLimit == null && spec.kernel) {
    try {
      gateGasLimit = await resolveType4GasLimit({
        provider,
        chain: deps.chain,
        eoa,
        to: eoa,
        data: spec.batchCallData,
        ...(spec.value != null ? { value: spec.value } : {}),
        kernel: spec.kernel,
        authorizationCount: 1,
      });
    } catch {
      gateGasLimit = null;
    }
  }
  const gateFeePerGas = spec.maxFeePerGas ?? gasPrice * 2n;
  const fallbackCost =
    (SESSION_GAS_CEILING * gasPrice * BigInt(ESTIMATE_BUFFER_DEFAULT_BPS)) / 10000n;
  const estimatedCost = gateGasLimit != null ? gateGasLimit * gateFeePerGas : fallbackCost;
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
  // Prepare → broadcast holds the module session lock (per chain+eoa): a second flow
  // queues behind the first and re-prepares on the consumed tx nonce instead of colliding
  // on it. The wait is bounded (a predecessor stuck on its wallet prompt must not hang
  // this flow forever) and the receipt wait below runs outside the lock so parallel
  // Confirming… screens do not serialize on block times.
  const kernel = spec.kernel;
  const broadcast = await trySessionLock(
    spec.expectedChainId,
    eoa,
    async (): Promise<{ sent: true; hash: Hex } | { sent: false; outcome: WriteOutcome }> => {
      // Acquire-and-revalidate: a generation reset while queued abandons the flow before
      // it prompts for a signature the reset flow will never use.
      if (deps.isStale()) return { sent: false as const, outcome: 'failed' as const };
      let prepared: UnsignedType4 & { scope: PrepareScope };
      try {
        const result = await prepareType4(ports, {
          eoa,
          kernel,
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
          ...(spec.gasLimit != null ? { gasLimit: spec.gasLimit } : {}),
          ...(spec.maxFeePerGas != null ? { maxFeePerGas: spec.maxFeePerGas } : {}),
          ...(spec.maxPriorityFeePerGas != null
            ? { maxPriorityFeePerGas: spec.maxPriorityFeePerGas }
            : {}),
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
          return { sent: false as const, outcome: 'failed' as const };
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
          return { sent: false as const, outcome: 'cancelled' as const };
        }
        if (isSignerUnavailable(error)) return { sent: false as const, outcome: unsupported(deps) };
        // Non-4001: a capability/technical failure, never "you declined".
        if (isMethodUnavailable(error)) deps.reportProviderLimitation();
        dispatch({ type: 'authorization-signed' });
        dispatch({ type: 'simulation-failed', kind: 'unknown' });
        return { sent: false as const, outcome: 'failed' as const };
      }
      if (deps.isStale()) return { sent: false as const, outcome: 'failed' as const };
      dispatch({ type: 'authorization-signed' });
      deps.dispatchAccount({ type: 'authorization-signed' });
      deps.dispatchAccount({ type: 'authorization-submitted' });
      dispatch({ type: 'simulation-ok' });

      // Scope freshness at send time (§16): nonce/code/chain drift voids the
      // simulation. A failed verification read aborts too — sending on unverified scope
      // is worse than failing while nothing is broadcast, and the await must not reject
      // past the executor.
      const [freshNonce, freshCode, freshChainId] = await Promise.all([
        ports.getPendingNonce(eoa).catch((error) => {
          if (process.env.NODE_ENV !== 'production') {
            console.error('[tx] freshness read failed', error);
          }
          return null;
        }),
        ports.getCode(eoa).catch((error) => {
          if (process.env.NODE_ENV !== 'production') {
            console.error('[tx] freshness read failed', error);
          }
          return null;
        }),
        ports.getChainId().catch((error) => {
          if (process.env.NODE_ENV !== 'production') {
            console.error('[tx] freshness read failed', error);
          }
          return null;
        }),
      ]);
      if (freshNonce == null || freshCode == null || freshChainId == null) {
        if (deps.isStale()) return { sent: false as const, outcome: 'failed' as const };
        dispatch({ type: 'tx-reverted', kind: 'unknown' });
        return { sent: false as const, outcome: 'failed' as const };
      }
      if (
        needsReprepare(prepared.scope, {
          ...prepared.scope,
          chainId: freshChainId,
          nonce: freshNonce,
          accountCode: freshCode,
        })
      ) {
        dispatch({ type: 'scope-stale' });
        return { sent: false as const, outcome: 'failed' as const };
      }
      if (deps.isStale()) return { sent: false as const, outcome: 'failed' as const };

      // Nonce floor: the freshness re-read observes mined state, not the mempool, so under
      // RPC lag it can hand back a nonce this tab already consumed. A hash returned from a
      // prior sendPrepared means the node accepted that transaction — fail closed with
      // retry guidance instead of broadcasting into the same nonce.
      const floor = sessionNonceFloor.get(sessionKey(spec.expectedChainId, eoa));
      if (floor != null && (prepared.scope.nonce < floor || freshNonce < floor)) {
        dispatch({ type: 'scope-stale' });
        return { sent: false as const, outcome: 'failed' as const };
      }

      try {
        const hash = await sendPrepared(ports, prepared);
        sessionNonceFloor.set(sessionKey(spec.expectedChainId, eoa), prepared.scope.nonce + 1);
        return { sent: true as const, hash };
      } catch (error) {
        // Dev-only diagnostics, mirroring the prepare catch: sign/broadcast failures are
        // otherwise indistinguishable (one generic reverted line).
        if (process.env.NODE_ENV !== 'production') {
          console.error('[tx] session send failed', error);
        }
        deps.dispatchAccount({ type: 'reject-authorization' });
        if (isUserRejection(error)) {
          dispatch({ type: 'user-rejected' });
          return { sent: false as const, outcome: 'cancelled' as const };
        }
        if (isMethodUnavailable(error)) deps.reportProviderLimitation();
        dispatch({ type: 'tx-reverted', kind: 'unknown' });
        return { sent: false as const, outcome: 'failed' as const };
      }
    },
  );
  if (!broadcast.acquired) {
    // The predecessor never settled its wallet prompt: fail with retry guidance instead
    // of hanging behind a human action this flow cannot cancel.
    dispatch({ type: 'scope-stale' });
    return 'failed';
  }
  if (!broadcast.value.sent) return broadcast.value.outcome;
  const hash = broadcast.value.hash;
  dispatch({ type: 'tx-signed', hash });
  dispatch({ type: 'receipt-pending' });
  const settlement = await awaitSettlement((onReplaced) =>
    reader.waitForTransactionReceipt({
      hash,
      onReplaced: ({ reason }) => onReplaced(reason),
    }),
  );
  if (settlement === null) return 'pending';
  const stale = deps.isStale();
  if (settlement.kind === 'cancelled') {
    if (!stale) dispatch({ type: 'user-rejected' });
    return 'cancelled';
  }
  if (settlement.kind === 'replaced') {
    if (!stale) dispatch({ type: 'tx-replaced', hash: settlement.hash });
    return 'failed';
  }
  if (settlement.kind === 'reverted') {
    if (!stale) dispatch({ type: 'tx-reverted', kind: 'unknown' });
    return 'failed';
  }
  if (spec.crossChain) {
    // Source leg only: destination confirmation is a separate step.
    if (!stale) dispatch({ type: 'source-confirmed', hash: settlement.hash });
    return 'pending';
  }
  if (!stale) dispatch({ type: 'receipt-success', hash: settlement.hash });
  return 'confirmed';
}

/** EIP-5792 wallet_sendCalls batch (external wallets; the wallet owns the upgrade). */
export async function runCalls(spec: WriteSpec, deps: ExecDeps): Promise<WriteOutcome> {
  const calls = spec.calls;
  if (!calls || calls.length === 0) return unsupported(deps);
  const { provider, eoa, dispatch } = deps;
  const request = (args: { method: string; params?: unknown }) => provider.request(args);
  const atomic = await resolveAtomicCalls(deps.provider, deps.chain.id, eoa);
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
    if (isMethodUnavailable(error)) {
      forgetAtomicCalls(deps.provider, deps.chain.id, eoa);
      return unsupported(deps);
    }
    dispatch({ type: 'tx-reverted', kind: 'unknown' });
    return 'failed';
  }
  if (batchId == null) {
    dispatch({ type: 'tx-reverted', kind: 'unknown' });
    return 'failed';
  }
  dispatch({ type: 'calls-submitted', batchId });
  const status = await pollCallsStatus(request, batchId);
  // Deadline hit: the bundle may still land — keep Confirming… and report 'pending'
  // instead of fabricating a cancellation. Checked before staleness: a reset does not turn
  // a still-unknown bundle into a failure either.
  if (status.status === 'timeout') return 'pending';
  const stale = deps.isStale();
  if (status.status === 'failure') {
    // The batch landed and reverted on-chain (wallet 400/500 + reverted receipt): this
    // is the batch's own revert class, not a wallet-side infrastructure failure.
    if (!stale) dispatch({ type: 'tx-reverted', kind: 'batch-reverted' });
    return 'failed';
  }
  if (status.status === 'success') {
    // Mixed/partial batches must not read as a clean success (atomic is requested, but
    // the wallet is the authority; a reverted leg is a failure).
    const reverted = status.receipts?.some((receipt) => receipt.status === '0x0');
    if (reverted) {
      if (!stale) dispatch({ type: 'tx-reverted', kind: 'batch-reverted' });
      return 'failed';
    }
    // No receipts (some wallets omit them): there is no on-chain hash to link.
    // A bundle id is not a transaction hash — carry null so the receipt UI hides
    // the explorer row instead of pointing at `${explorer}/tx/<bundleId>`.
    const hash = status.receipts?.[0]?.transactionHash ?? null;
    if (!stale) dispatch({ type: 'receipt-success', hash });
    return 'confirmed';
  }
  if (!stale) dispatch({ type: 'tx-reverted', kind: 'unknown' });
  return 'failed';
}

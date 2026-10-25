'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSign7702Authorization, useWallets } from '@privy-io/react-auth';
import type { Hex } from 'viem';

import { getClientChainConfig } from '@/lib/web3/chains';
import { getActiveEip1193Provider, isWeb3Configured } from '@/lib/web3/active-provider';
import { refreshVerseAfterWrite } from '@/lib/data/write-refresh';
import {
  INITIAL_TX_CONTEXT,
  isTxTerminal,
  reduceTx,
  txDisplayOf,
  type TxContext,
  type TxDisplay,
  type TxEvent,
} from '@/lib/web3/tx-center';
import {
  runCalls,
  runDirect,
  runSession,
  type ExecDeps,
  type WriteOutcome,
  type WriteSpec,
} from '@/lib/web3/tx-executor';
import { routeWrite, type WalletKind } from '@/lib/web3/write-route';

import { useAccountCenter } from './use-account-center';

export type { WriteOutcome, WriteSpec } from '@/lib/web3/tx-executor';

// NEXT_PUBLIC_ mirror is the client-inlinable projection; the server var covers SSR.
const ONCHAIN_BUILD =
  process.env.NEXT_PUBLIC_OUTRUN_DATA_SOURCE === 'onchain' ||
  process.env.OUTRUN_DATA_SOURCE === 'onchain';

export type WriteFlow = {
  context: TxContext;
  display: TxDisplay;
  reviewing: boolean;
  /** A write is staged, running or holding a terminal state (replaces `display !== 'idle'`). */
  active: boolean;
  /** Direct EOA write, no review panel (§29: faucet claims). */
  executeDirect: (spec: WriteSpec) => Promise<WriteOutcome>;
  /**
   * Review-less execution (§29/037): the wallet-appropriate path for the same spec.
   * Embedded wallets walk the Kernel type-4 pipeline; external wallets run the 5792
   * legs in their own prompt (no authorization signing, no review UI).
   */
  executeSession: (spec: WriteSpec) => Promise<WriteOutcome>;
  reset: () => void;
  running: boolean;
};

function useHarnessTxCenter(): WriteFlow {
  const noop = useCallback(() => undefined, []);
  const noopAsync = useCallback(async (): Promise<WriteOutcome> => 'cancelled', []);
  return {
    context: INITIAL_TX_CONTEXT,
    display: 'idle',
    reviewing: false,
    active: false,
    executeDirect: noopAsync,
    executeSession: noopAsync,
    reset: noop,
    running: false,
  };
}

/**
 * Transaction-center hook: state machine, re-entrancy lock, run generation and the one
 * wallet router. All wallet-execution logic lives in lib/web3/tx-executor.ts (pure,
 * port-injected); this hook only wires React state and Privy's signer into it.
 *
 * Routing (`routeWrite` in lib/web3/write-route.ts):
 * - direct → plain EOA write.
 * - Privy embedded / unknown (wallet list not ready) → Kernel type-4.
 * - external → EIP-5792 wallet_sendCalls when the spec carries `calls`, else unsupported.
 */
function useRealTxCenter(): WriteFlow {
  const center = useAccountCenter();
  const router = useRouter();
  const { signAuthorization } = useSign7702Authorization();
  const { wallets } = useWallets();
  const walletKind = useMemo<WalletKind>(() => {
    const address = center.address?.toLowerCase();
    if (!address) return 'unknown';
    const wallet = wallets.find((entry) => entry.address.toLowerCase() === address);
    if (!wallet) return 'unknown';
    return wallet.walletClientType === 'privy' ? 'embedded' : 'external';
  }, [center.address, wallets]);

  const [context, setContext] = useState<TxContext>(INITIAL_TX_CONTEXT);
  const [reviewing, setReviewing] = useState(false);
  const [active, setActive] = useState(false);
  const [running, setRunning] = useState(false);
  const specRef = useRef<WriteSpec | null>(null);
  // Synchronous re-entrancy lock: React state lands a render late, so two clicks in the
  // same tick would both pass a state-based guard and send twice.
  const runningRef = useRef(false);
  // Run generation: begin/reset/cancel bump it so a stale async continuation can never
  // write into a reset or a newer flow.
  const runSeqRef = useRef(0);
  // Last hash the flow dispatched (tx-signed / receipt-success) — the post-write server
  // refresh gates subgraph freshness on the write's OWN block, which needs the receipt.
  const lastHashRef = useRef<string | null>(null);

  const dispatch = useCallback((event: TxEvent) => {
    if (
      (event.type === 'tx-signed' || event.type === 'receipt-success') &&
      'hash' in event &&
      event.hash
    ) {
      lastHashRef.current = event.hash;
    }
    setContext((current) => reduceTx(current, event));
  }, []);

  // Terminal lifecycle: once the flow lands Confirmed/Reverted/Replaced/Cancelled the
  // review stage is over and the spec cannot be re-run.
  useEffect(() => {
    if (isTxTerminal(context.state)) {
      specRef.current = null;
      setReviewing(false);
    }
  }, [context.state]);

  const begin = useCallback(
    (spec: WriteSpec) => {
      runSeqRef.current += 1;
      setActive(true);
      dispatch({ type: 'begin', review: spec.review });
    },
    [dispatch],
  );

  /**
   * One locked execution: resolves provider/chain, builds the injected deps, routes by
   * wallet kind. The lock is released only when the wallet call actually settles.
   */
  const run = useCallback(
    async (spec: WriteSpec, kind: WalletKind): Promise<WriteOutcome> => {
      const provider = getActiveEip1193Provider();
      const address = center.address;
      if (!provider || !address || !isWeb3Configured()) {
        dispatch({ type: 'tx-reverted', kind: 'unknown' });
        return 'failed';
      }
      if (runningRef.current) return 'pending';
      // Route on the chain the spec was assembled for, not the cached wallet chainId: that
      // cache is what lags behind an in-wallet switch, and routing on it would hand a batch
      // built for one chain to a wallet sitting on another. Preparation verified the provider
      // answered this chain, so the spec is the stronger truth.
      const resolved = getClientChainConfig(spec.expectedChainId);
      if (resolved.status !== 'ok') {
        dispatch({ type: 'tx-reverted', kind: 'unknown' });
        return 'failed';
      }
      runningRef.current = true;
      setRunning(true);
      const seq = runSeqRef.current;
      const deps: ExecDeps = {
        provider,
        eoa: address as Hex,
        chain: resolved.config.viemChain,
        dispatch,
        dispatchAccount: center.dispatchAccount,
        reportProviderLimitation: center.reportProviderLimitation,
        signAuthorization: async (request, walletAddress) => {
          const signed = await signAuthorization(
            {
              contractAddress: request.contractAddress,
              chainId: request.chainId,
              nonce: request.nonce,
              executor: 'self',
            },
            { address: walletAddress },
          );
          return {
            chainId: signed.chainId,
            address: signed.address,
            nonce: signed.nonce,
            r: signed.r,
            s: signed.s,
            yParity: signed.yParity,
            v: (signed as { v?: bigint }).v,
          };
        },
        isStale: () => seq !== runSeqRef.current,
      };
      let outcome: WriteOutcome;
      try {
        switch (routeWrite(spec, kind)) {
          case 'direct':
            outcome = await runDirect(
              spec as WriteSpec & { direct: NonNullable<WriteSpec['direct']> },
              deps,
            );
            break;
          case 'calls':
            outcome = await runCalls(spec, deps);
            break;
          case 'session':
            outcome = await runSession(spec, deps);
            break;
          case 'unsupported':
            dispatch({ type: 'wallet-unsupported' });
            outcome = 'unsupported';
        }
      } finally {
        runningRef.current = false;
        setRunning(false);
      }
      // Central post-write refresh: any flow whose spec declares `writeScope` gets the server
      // caches for that scope converged (subgraph-freshness-gated invalidation + prime) and
      // the page re-rendered. Wiring it HERE — not per dialog — is what stops the
      // stale-numbers class of bug from reappearing on future write surfaces. The write's own
      // hash rides along so the freshness gate targets the receipt block (no overshoot past
      // the write into a perpetually head-trailing index).
      if (outcome === 'confirmed' && spec.writeScope?.kind === 'verse') {
        const scope = spec.writeScope;
        const txHash = lastHashRef.current;
        void refreshVerseAfterWrite({
          chainId: scope.chainId,
          verseId: scope.verseId,
          ...(txHash ? { txHash } : {}),
        })
          .catch(() => undefined)
          .finally(() => router.refresh());
      }
      return outcome;
    },
    [center, dispatch, router, signAuthorization],
  );

  // The review station (startReview → TxReviewPanel → confirm) was deleted wholesale
  // (the dialog IS the review — executeSession/executeDirect go
  // straight to the wallet).

  const reset = useCallback(() => {
    runSeqRef.current += 1;
    specRef.current = null;
    setReviewing(false);
    setActive(false);
    setRunning(false);
    // Do NOT clear runningRef here: an in-flight wallet request cannot be cancelled, and
    // re-enabling the guard would let a reopened dialog send a second batch. The runner's
    // finally clears it when the wallet call actually settles.
    setContext(INITIAL_TX_CONTEXT);
  }, []);

  const executeDirect = useCallback(
    async (spec: WriteSpec): Promise<WriteOutcome> => {
      if (!spec.direct || runningRef.current) return 'failed';
      begin(spec);
      return run(spec, walletKind);
    },
    [begin, run, walletKind],
  );

  const executeSession = useCallback(
    async (spec: WriteSpec): Promise<WriteOutcome> => {
      if (runningRef.current) return 'pending';
      specRef.current = spec;
      setReviewing(false);
      begin(spec);
      return run(spec, walletKind);
    },
    [begin, run, walletKind],
  );

  return {
    context,
    display: txDisplayOf(active ? context.state : null),
    reviewing,
    active,
    executeDirect,
    executeSession,
    reset,
    running,
  };
}

const useTxCenterImpl = ONCHAIN_BUILD ? useRealTxCenter : useHarnessTxCenter;

/** Unified write flow: real pipeline onchain, silent no-op otherwise (never fakes sends). */
export function useTxCenter(): WriteFlow {
  return useTxCenterImpl();
}

/**
 * A confirmed write clears the caller's amount inputs (failed/cancelled keeps them for
 * retry/revise). `display` stays 'confirmed' until reset, so the clear runs once per
 * landing; `clear` is kept in a ref, so callers can pass an inline closure.
 */
export function useClearOnConfirmed(display: TxDisplay, clear: () => void): void {
  const clearRef = useRef(clear);
  clearRef.current = clear;
  useEffect(() => {
    if (display === 'confirmed') clearRef.current();
  }, [display]);
}

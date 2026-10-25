// Unified transaction center core (architecture.md §7 + §6.4).
// Event-driven 11-state machine: no timers, no auto-advance — every transition is caused by
// a wallet/chain event or an explicit user action (this replaces the prototype flow-machine
// driver in step 5; the state names below are the §7 verbatim set).
// Copy rule: error lines are single short sentences with no interpolated values;
// the confirm button never changes its label after click, it only disables (wiring rule,
// asserted at the component layer).
import type { RevertKind } from './kernel';

/** Center-level error classes (UI copy maps them per locale; never English literals here). */
export type TxErrorKind =
  'simulation' | 'reverted' | 'replaced' | 'gas' | 'wrong-network' | 'wallet-unsupported';

export const TX_STATES = [
  'Preparing…',
  'Preflighting…',
  'Awaiting authorization…',
  'Simulating Type-4 transaction…',
  'Awaiting transaction signature…',
  'Submitted',
  'Confirming…',
  'Confirmed',
  'Reverted',
  'Replaced',
  'Cancelled',
] as const;

export type TxState = (typeof TX_STATES)[number];

export type TxTerminal = 'Confirmed' | 'Reverted' | 'Replaced' | 'Cancelled';

export function isTxTerminal(state: TxState): state is TxTerminal {
  return (
    state === 'Confirmed' || state === 'Reverted' || state === 'Replaced' || state === 'Cancelled'
  );
}

/** Pre-signature review panel fields (§7 + §6.4 gas gate inputs). */
export type TxReview = {
  chainId: number;
  account: string;
  targetContract: string;
  functionName: string;
  inputs: string;
  minOutput: string;
  fee: string;
  gasPayer: string;
  authorizationChange: string;
  estimatedGas: string;
  nativeBalance: string;
};

const REVIEW_FIELDS: (keyof TxReview)[] = [
  'chainId',
  'account',
  'targetContract',
  'functionName',
  'inputs',
  'minOutput',
  'fee',
  'gasPayer',
  'authorizationChange',
  'estimatedGas',
  'nativeBalance',
];

/** The review panel gates signing: every field must be present before authorization. */
export function isReviewComplete(review: Partial<TxReview>): review is TxReview {
  return REVIEW_FIELDS.every((field) => {
    const value = review[field];
    return typeof value === 'string' ? value.length > 0 : value !== undefined;
  });
}

export type TxContext = {
  state: TxState;
  review: TxReview | null;
  /** §6.4: insufficient native balance blocks authorization AND signature requests. */
  gasGate: 'ok' | 'insufficient';
  // B4: a rejected signature returns to the form; the dialog keeps its own input state.
  txHash: string | null;
  /** Source-chain receipt is not completion: the message stays pending to destination. */
  crossChain: { sourceHash: string; destinationConfirmed: boolean } | null;
  errorKind: TxErrorKind | RevertKind | null;
};

export const INITIAL_TX_CONTEXT: TxContext = {
  state: 'Preparing…',
  review: null,
  gasGate: 'ok',
  txHash: null,
  crossChain: null,
  errorKind: null,
};

export type TxEvent =
  | { type: 'begin'; review: TxReview }
  | { type: 'preflight-ok' }
  | { type: 'preflight-block-gas' }
  | { type: 'authorization-requested' }
  | { type: 'authorization-signed' }
  | { type: 'simulation-ok' }
  | { type: 'simulation-failed'; kind: RevertKind }
  | { type: 'tx-signed'; hash: string }
  | { type: 'receipt-pending' }
  | { type: 'calls-submitted'; batchId: string }
  | { type: 'source-confirmed'; hash: string }
  | { type: 'destination-confirmed' }
  | { type: 'receipt-success'; hash: string }
  | { type: 'tx-reverted'; kind: RevertKind }
  | { type: 'tx-replaced'; hash: string }
  | { type: 'wallet-unsupported' }
  | { type: 'user-rejected' }
  | { type: 'scope-stale' };

/**
 * Total reducer: meaningless events leave the context unchanged. Refusal is Cancelled;
 * scope drift (nonce/quote/manifest change, §16) discards auth and simulation and
 * restarts at Preparing…; a cross-chain source receipt keeps Confirming… until the
 * destination event arrives.
 */
export function reduceTx(context: TxContext, event: TxEvent): TxContext {
  switch (event.type) {
    case 'begin':
      return {
        ...INITIAL_TX_CONTEXT,
        review: event.review,
      };
    case 'preflight-ok':
      return context.state === 'Preparing…' ? { ...context, state: 'Preflighting…' } : context;
    case 'preflight-block-gas':
      if (context.state !== 'Preparing…' && context.state !== 'Preflighting…') return context;
      return { ...context, gasGate: 'insufficient', errorKind: 'gas' };
    case 'authorization-requested':
      if (context.gasGate === 'insufficient') return context;
      return context.state === 'Preflighting…'
        ? { ...context, state: 'Awaiting authorization…' }
        : context;
    case 'authorization-signed':
      return context.state === 'Awaiting authorization…'
        ? { ...context, state: 'Simulating Type-4 transaction…' }
        : context;
    case 'simulation-ok':
      return context.state === 'Simulating Type-4 transaction…'
        ? { ...context, state: 'Awaiting transaction signature…' }
        : context;
    case 'simulation-failed':
      return context.state === 'Simulating Type-4 transaction…'
        ? { ...context, state: 'Reverted', errorKind: event.kind }
        : context;
    case 'tx-signed':
      if (context.gasGate === 'insufficient') return context;
      return context.state === 'Awaiting transaction signature…'
        ? { ...context, state: 'Submitted', txHash: event.hash }
        : context;
    case 'receipt-pending':
      return context.state === 'Submitted' ? { ...context, state: 'Confirming…' } : context;
    case 'calls-submitted':
      // EIP-5792 path: the wallet accepted the batch (bundle id assigned), the dapp-side
      // event chain carries no staged authorization/simulation states — jump straight to
      // the shared on-chain confirmation state.
      return context.state === 'Preflighting…'
        ? { ...context, state: 'Confirming…', txHash: event.batchId }
        : context;
    case 'source-confirmed':
      if (context.state !== 'Confirming…' && context.state !== 'Submitted') return context;
      return {
        ...context,
        state: 'Confirming…',
        crossChain: { sourceHash: event.hash, destinationConfirmed: false },
      };
    case 'destination-confirmed':
      if (!context.crossChain || context.crossChain.destinationConfirmed) return context;
      return {
        ...context,
        state: 'Confirmed',
        crossChain: { ...context.crossChain, destinationConfirmed: true },
      };
    case 'receipt-success':
      // Single-chain path only: a cross-chain leg must wait for destination-confirmed.
      if (context.crossChain) return context;
      return context.state === 'Confirming…' || context.state === 'Submitted'
        ? { ...context, state: 'Confirmed', txHash: event.hash }
        : context;
    case 'tx-reverted':
      return isTxTerminal(context.state)
        ? context
        : { ...context, state: 'Reverted', errorKind: event.kind };
    case 'tx-replaced':
      return isTxTerminal(context.state)
        ? context
        : { ...context, state: 'Replaced', txHash: event.hash };
    case 'wallet-unsupported':
      // No executable path for this wallet: keep the form/panel open and surface the
      // capability line instead of pretending the user cancelled.
      return isTxTerminal(context.state)
        ? context
        : { ...context, errorKind: 'wallet-unsupported' };
    case 'user-rejected':
      return isTxTerminal(context.state)
        ? context
        : { ...context, state: 'Cancelled', errorKind: null };
    case 'scope-stale':
      return isTxTerminal(context.state)
        ? context
        : { ...INITIAL_TX_CONTEXT, review: context.review };
  }
}

/** Display projection onto the existing TxStatus strip (component untouched). */
export type TxDisplay = 'idle' | 'signing' | 'confirming' | 'confirmed' | 'cancelled' | 'reverted';

export function txDisplayOf(state: TxState | null): TxDisplay {
  if (state === null) return 'idle';
  if (state === 'Confirmed') return 'confirmed';
  // A replaced transaction never settles in this app (speed-ups resolve through the
  // replacement receipt); map it to the failure tone rather than a stuck spinner.
  if (state === 'Reverted' || state === 'Replaced') return 'reverted';
  if (state === 'Cancelled') return 'cancelled';
  if (state === 'Submitted' || state === 'Confirming…') return 'confirming';
  return 'signing';
}

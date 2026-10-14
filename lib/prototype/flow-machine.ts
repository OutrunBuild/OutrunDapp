'use client';

import { useEffect, useRef, useState } from 'react';

// Unified transaction state sequence (the display projection onto TxStatus's three-segment bar
// lives in displayGroupOf; the prototype never drives the 'replaced' state)
export const FLOW_STATES = [
  'preparing',
  'preflighting',
  'awaiting-authorization',
  'simulating',
  'awaiting-signature',
  'submitted',
  'confirming',
  'confirmed',
  'reverted',
  'replaced',
  'cancelled',
] as const;

export type FlowState = (typeof FLOW_STATES)[number];

/** Prototype display groups (TxStatus three-segment bar): signing=awaiting-signature and earlier prep, confirming=submitted/confirming, confirmed=confirmed */
export type FlowDisplayGroup =
  'idle' | 'signing' | 'confirming' | 'confirmed' | 'reverted' | 'cancelled';

export type FlowOutcome = 'confirmed' | 'reverted' | 'user-rejected';

/** Display-group mapping per state (consumer TxStatus highlights the three-segment bar by group) */
export function displayGroupOf(state: FlowState): FlowDisplayGroup {
  if (state === 'confirmed') return 'confirmed';
  if (state === 'reverted') return 'reverted';
  if (state === 'cancelled') return 'cancelled';
  if (state === 'submitted' || state === 'confirming') return 'confirming';
  return 'signing';
}

/** Terminal-state check (terminal = confirmed/reverted/cancelled) */
function isTerminal(state: FlowState): boolean {
  return state === 'confirmed' || state === 'reverted' || state === 'cancelled';
}

/** Advancement cadence for the prototype demo (ms); replaced by event drivers once a real wallet is wired in */
const STAGE_MS: Partial<Record<FlowState, number>> = {
  preparing: 500,
  preflighting: 500,
  'awaiting-authorization': 600,
  simulating: 600,
  'awaiting-signature': 700,
  submitted: 500,
  confirming: 900,
};

/**
 * Unified flow state machine (prototype driver for the FLOW_STATES sequence).
 * Prototype has no wallet: after begin(), advances on STAGE_MS timers; outcome decides the
 * terminal state (confirmed=success / reverted=on-chain revert / user-rejected=signature refused).
 * Pure-function core advance(state, outcome) is exported for unit tests; pending timers are
 * cleared on unmount.
 */
export function advance(state: FlowState, outcome: FlowOutcome): FlowState | null {
  if (isTerminal(state)) return null;
  // Signature refusal only occurs while awaiting signature
  if (outcome === 'user-rejected') {
    return state === 'awaiting-signature' ? 'cancelled' : null;
  }
  // Revert can happen earliest after submission (reverted before signing is meaningless -- not yet
  // on-chain, so keep advancing normally)
  if (outcome === 'reverted' && state === 'submitted') return 'reverted';
  return nextProgress(state);
}

function nextProgress(state: FlowState): FlowState {
  const i = FLOW_STATES.indexOf(state);
  return i >= 0 && i + 1 < FLOW_STATES.length ? FLOW_STATES[i + 1] : 'confirmed';
}

export function useFlowMachine(outcome: FlowOutcome = 'confirmed') {
  const [state, setState] = useState<FlowState | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const outcomeRef = useRef(outcome);
  outcomeRef.current = outcome;

  function begin() {
    timers.current.forEach(clearTimeout);
    let current: FlowState = 'preparing';
    setState(current);
    while (!isTerminal(current)) {
      const stage: FlowState = current;
      timers.current.push(
        setTimeout(() => {
          const next = advance(stage, outcomeRef.current);
          if (next) {
            current = next;
            setState(next);
          }
        }, STAGE_MS[stage] ?? 400),
      );
      current = nextProgress(current);
    }
  }

  function reset() {
    timers.current.forEach(clearTimeout);
    setState(null);
  }

  return { state, display: state ? displayGroupOf(state) : 'idle', begin, reset };
}

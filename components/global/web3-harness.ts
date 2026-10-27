'use client';

import { useSyncExternalStore } from 'react';

/**
 * Non-production account harness (runbook step 5): the e2e/visual successor of the retired
 * test harness wallet. Active ONLY in fixture mode (OUTRUN_DATA_SOURCE=fixture; onchain is the default) — onchain builds drive the
 * real hooks in use-account-center and never touch this store (assertHarness throws there).
 * Zero fixture imports, so no boundary registration is needed.
 *
 * Scenario freeze hooks live in the isomorphic ./scenario-view (no 'use client'): the
 * discovery RSC calls them during SSR.
 */
// NEXT_PUBLIC_ mirror is the client-inlinable projection; the server var covers SSR.
const ONCHAIN_BUILD =
  process.env.NEXT_PUBLIC_OUTRUN_DATA_SOURCE !== 'fixture' &&
  process.env.OUTRUN_DATA_SOURCE !== 'fixture';

function assertHarness(): void {
  if (ONCHAIN_BUILD) throw new Error('outrun: test harness is unavailable on onchain builds');
}

// Harness default mirrors the retired mock: the shell falls back to chains[0] for display,
// so connected/chain visuals are pixel-identical to the recorded baselines.
const DEFAULT_CHAIN_ID = 11155111;

let connected = false;
let chainId = DEFAULT_CHAIN_ID;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useHarnessWallet(): {
  connected: boolean;
  chainId: number;
  toggle: () => void;
  switchChain: (chainId: number) => void;
} {
  assertHarness();
  const isConnected = useSyncExternalStore(subscribe, () => connected, () => false);
  const activeChain = useSyncExternalStore(subscribe, () => chainId, () => DEFAULT_CHAIN_ID);
  return {
    connected: isConnected,
    chainId: activeChain,
    toggle: () => {
      assertHarness();
      connected = !connected;
      emit();
    },
    switchChain: (next: number) => {
      assertHarness();
      chainId = next;
      emit();
    },
  };
}

export {
  applyScenarioToVerses,
  degradeToneFor,
  isDegradeView,
  isScenarioView,
  parseScenarioParam,
  SCENARIO_IDS,
  type DegradeTone,
  type ScenarioView,
} from './scenario-view';

// Scenario freeze hooks (loading/empty/error): screenshot-only, invisible to real users.
// Server/client-isomorphic: NO 'use client' directive — the discovery RSC calls these during
// SSR. The client harness (web3-harness.ts) only owns the wallet store.

// NEXT_PUBLIC_ mirror is the client-inlinable projection; the server var covers SSR.
const ONCHAIN_BUILD =
  process.env.NEXT_PUBLIC_OUTRUN_DATA_SOURCE === 'onchain' ||
  process.env.OUTRUN_DATA_SOURCE === 'onchain';

/** Whitelist of screenshot-freeze hook ids */
export const SCENARIO_IDS = ['loading', 'empty', 'error'] as const;

export type ScenarioView = (typeof SCENARIO_IDS)[number] | 'normal';

export function isScenarioView(value: string): value is Exclude<ScenarioView, 'normal'> {
  return (SCENARIO_IDS as readonly string[]).includes(value);
}

/**
 * Scenario param parsing. Onchain builds neither parse nor inject — onchain access carrying
 * this param falls through to the default path.
 */
export function parseScenarioParam(value: string | string[] | undefined): ScenarioView | null {
  if (ONCHAIN_BUILD) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  return isScenarioView(raw) ? raw : null;
}

/** Whether to render banner/skeleton instead of data (empty=empty the list, no banner) */
export function isDegradeView(view: ScenarioView): view is 'loading' | 'empty' | 'error' {
  return view === 'loading' || view === 'empty' || view === 'error';
}

/**
 * Applies the scenario to the list: loading/empty/error clear the data; a banner/skeleton renders
 * for loading/error, empty shows the bare empty list; 'normal' leaves the list as-is.
 */
export function applyScenarioToVerses<T>(verses: T[], view: ScenarioView | null): T[] {
  if (!view) return verses;
  if (isDegradeView(view)) return [];
  return verses;
}

export type DegradeTone = 'loading' | 'error';

export function degradeToneFor(view: ScenarioView): DegradeTone | null {
  if (view === 'loading') return 'loading';
  if (view === 'error') return 'error';
  return null;
}

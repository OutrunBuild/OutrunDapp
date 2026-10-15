// Scenario protocol: only screenshot-freeze hooks for transient views, invisible to real users
// (gated to fixture-mode data). These hooks exist so screenshot capture can freeze pages in
// transient states. Data states (paused/zero-balance etc.) are expressed by the fixture data
// itself, not by scenarios.
// Index lag degrades silently (list data slightly stale; real-time readings such as balances are
// unaffected): there is no user-visible index-lag banner.

/** Whitelist of screenshot-freeze hook ids */
export const SCENARIO_IDS = ['loading', 'empty', 'error'] as const;

export type ScenarioView = (typeof SCENARIO_IDS)[number] | 'normal';

export function isScenarioView(value: string): value is Exclude<ScenarioView, 'normal'> {
  return (SCENARIO_IDS as readonly string[]).includes(value);
}

/**
 * Scenario param parsing. Onchain-data mode runs with OUTRUN_DATA_SOURCE=onchain in the server
 * environment (read at runtime — a build without it silently re-enables scenario parsing) and
 * neither parses nor injects -- onchain-mode access carrying this param is handled via the
 * default path.
 */
export function parseScenarioParam(value: string | string[] | undefined): ScenarioView | null {
  if (process.env.OUTRUN_DATA_SOURCE === 'onchain') return null;
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

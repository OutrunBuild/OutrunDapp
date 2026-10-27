// Click-path timing for wallet prompts. A slow prompt has three candidate cost centres that
// look identical from the UI — the reads before the wallet is asked (chain probe, allowance,
// quote), the wallet round trips (capability probe, the send itself), and whatever the wallet
// does internally before it paints its window. Recording each as one row turns "it takes
// seconds" into a phase.
//
// Off by default: with the flag unset every call is a no-op, so this can stay in the bundle
// (preview/production included — the flag is runtime, not build-time). Enable it in the
// browser console before reproducing the click:
//   localStorage.setItem('outrun:click-trace', '1')
//   localStorage.removeItem('outrun:click-trace')
//
// A click starts a new window: phases that began before it are dropped, so a 10 s quote poll
// or an earlier click cannot lead this flow's timeline. Only flows that reach the wallet's
// send print; an embedded (no-prompt) flow is cleared by the next click instead of leaking.
//
// `t` is relative to the click (or to the earliest row when the window predates one). `ms` is
// that phase's own duration. The prompt is painted by the wallet, not by this code, so
// `wallet.sendCalls` cannot time the window opening directly: reject the batch as soon as the
// window appears on a repeat run — that duration is the wallet's preparation plus reaction
// time, an upper bound on the invisible part.

type ClickTraceEntry = {
  at: number;
  phase: string;
  ms?: number;
  detail?: string;
};

const STORAGE_KEY = 'outrun:click-trace';
/** One click records < 10 rows; the cap only bounds a flow that never reaches the wallet. */
const MAX_ENTRIES = 40;

let entries: ClickTraceEntry[] = [];
/** Start of the current click window; phases that began before it belong to another flow. */
let windowStart = 0;
let listening = false;

function isClickTraceEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  let enabled = false;
  try {
    enabled = window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    // Storage disabled (private mode / blocked): tracing stays off, never throws.
    return false;
  }
  if (enabled) installWindowReset();
  return enabled;
}

/** Capture phase: the boundary lands before the click handler's first read. */
function installWindowReset(): void {
  if (listening || typeof document === 'undefined') return;
  listening = true;
  document.addEventListener(
    'click',
    () => {
      entries = [];
      windowStart = clock();
    },
    true,
  );
}

function clock(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function record(entry: ClickTraceEntry): void {
  if (entry.at < windowStart) return;
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries = entries.slice(entries.length - MAX_ENTRIES);
}

/** One awaited step: the duration is the wallet/node round trip it wraps. */
export async function tracePhase<T>(
  phase: string,
  run: () => Promise<T>,
  detail?: string,
): Promise<T> {
  if (!isClickTraceEnabled()) return run();
  const at = clock();
  try {
    return await run();
  } finally {
    record({ at, phase, ms: clock() - at, ...(detail !== undefined ? { detail } : {}) });
  }
}

/** Print (when enabled) and clear. Called once per flow, when its wallet call settles. */
export function flushClickTrace(reason: string): void {
  if (entries.length === 0) return;
  const enabled = isClickTraceEnabled();
  // Rows are recorded on completion, so a slow phase would print after a faster one that
  // started later; order by start time to keep the phase sequence readable.
  const ordered = [...entries].sort((a, b) => a.at - b.at);
  const base = windowStart > 0 ? windowStart : ordered[0]!.at;
  const rows = ordered.map((entry) => ({
    t: `+${Math.round(entry.at - base)}ms`,
    phase: entry.phase,
    ms: entry.ms != null ? Math.round(entry.ms) : '',
    detail: entry.detail ?? '',
  }));
  entries = [];
  if (enabled) {
    console.info(`[click-trace] ${reason}`);
    console.table(rows);
  }
}

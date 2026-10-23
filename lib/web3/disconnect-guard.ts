// Intentional-disconnect guard (login/logout race).
// leave() flags the window before wagmi disconnect + Privy logout resolve: during
// it the stale user + embedded wallet still read live for a beat, so no auto-link
// effect (dialog, session restore) may re-attach them.
//
// Two lifetimes, deliberately different:
// - The in-page flag never expires. A slow Privy logout can take arbitrarily long,
//   and expiring the guard mid-logout re-linked the old wallet into wagmi — the
//   disconnect silently "bounced back" to the previous social wallet.
// - The stored flag only survives a reload and is a timestamp: a checkout
//   interrupted by a refresh leaves litter, so anything older than MAX_AGE_MS is
//   removed on sight (legacy boolean '1' parses to 1 and is stale by definition).
// A module-memory flag backs the storage path, so private-mode storage failures
// degrade to memory. Same-tab only — cross-tab logout races stay out of scope.
const FLAG = 'outrun:disconnecting';
const MAX_AGE_MS = 60_000;

let memoryActive = false;

function freshStamp(raw: string | null, now: number): boolean {
  if (raw === null) return false;
  const parsed = Number(raw);
  // Legacy '1' parses to 1 and is therefore stale, which is the intent.
  if (!Number.isFinite(parsed)) return false;
  return Math.abs(now - parsed) <= MAX_AGE_MS;
}

export function isDisconnecting(): boolean {
  // In-flight in this page: no timeout, regardless of the stored stamp's age.
  if (memoryActive) return true;
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(FLAG);
  } catch {
    return false;
  }
  if (raw === null) return false;
  if (freshStamp(raw, Date.now())) return true;
  try {
    window.sessionStorage.removeItem(FLAG);
  } catch {
    // Storage unavailable: nothing to clean.
  }
  return false;
}

/** Flag the intentional-disconnect window (leave() entry). */
export function beginDisconnect(): void {
  memoryActive = true;
  try {
    window.sessionStorage.setItem(FLAG, String(Date.now()));
  } catch {
    // Storage unavailable (private mode): the memory flag carries the guard.
  }
}

/** Clear only the cross-reload stamp, keeping the in-page guard. A full-page
 * login (OAuth) reloads the document, so the return can link again while the
 * current page keeps blocking any bounce-back from the old session. */
export function releaseDisconnectStorage(): void {
  try {
    window.sessionStorage.removeItem(FLAG);
  } catch {
    // Storage unavailable: nothing persisted, nothing to clear.
  }
}

/** Clear the intentional-disconnect window (leave() settle, success only). */
export function endDisconnect(): void {
  memoryActive = false;
  try {
    window.sessionStorage.removeItem(FLAG);
  } catch {
    // Storage unavailable: nothing persisted, nothing to clear.
  }
}

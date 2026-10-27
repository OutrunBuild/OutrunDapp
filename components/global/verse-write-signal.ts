'use client'

// Page-scoped write-confirm signal for personal-value probes. A confirmed verse write changes
// wallet balances that OTHER mounted probes display (spending uAsset in the pool dialog empties
// the swap card's row too), but `useTxCenter` is per-component — only the writing component
// sees its own `confirmed` transition. The tx center's central-refresh chokepoint bumps this
// nonce on every confirmed verse-scoped write; probes subscribe and re-read their one batch
// (~4 requests through the shared session cache), so refresh granularity stays "this verse's
// personal values" — matching the central layer's writeScope granularity on the server side.
//
// A notify also schedules a bounded settle window (two extra bumps at +3s/+8s): the immediate
// re-read races the wallet RPC's read-after-write consistency — load-balanced public endpoints
// routinely answer from a backend node that has not yet synced the just-confirmed block, and
// since a successful probe run never retries, that stale read would pin every personal slot
// until the next unrelated trigger. The window's late reads overwrite any stale pin (the
// probes' latest-wins seq guard makes an out-of-order arrival harmless); a newer write cancels
// the previous window's pending bumps, so this stays a fixed burst per write, never polling.
import { useSyncExternalStore } from 'react'

let nonce = 0
const listeners = new Set<() => void>()
const SETTLE_DELAYS_MS = [3_000, 8_000] as const
const pendingSettleTimers = new Set<ReturnType<typeof setTimeout>>()

/** Bump once and wake every subscribed probe. */
function bump(): void {
  nonce += 1
  for (const listener of listeners) listener()
}

/** Bumped once per confirmed verse-scoped write (plus its settle-window bumps); called only
 * from the tx center chokepoint. */
export function notifyVerseWrite(): void {
  for (const timer of pendingSettleTimers) clearTimeout(timer)
  pendingSettleTimers.clear()
  bump()
  for (const delay of SETTLE_DELAYS_MS) {
    const timer = setTimeout(() => {
      pendingSettleTimers.delete(timer)
      bump()
    }, delay)
    pendingSettleTimers.add(timer)
  }
}

/** Subscribe to write-confirm bumps; returns the unsubscribe function. */
export function subscribeVerseWrites(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    // Last consumer left (page teardown): the pending settle window has nobody to wake —
    // drop it so module state stays fully bounded.
    if (listeners.size === 0) {
      for (const timer of pendingSettleTimers) clearTimeout(timer)
      pendingSettleTimers.clear()
    }
  }
}

/** Current write nonce — changes on every confirmed verse write on this page (and on its
 * settle-window re-reads). useSyncExternalStore closes the bump-between-render-and-subscribe
 * window the manual useState+subscribe version left open, and the shared getter doubles as the
 * server snapshot (module nonce starts at 0 on both sides, so hydration stays consistent). */
export function useVerseWriteNonce(): number {
  const getSnapshot = () => nonce
  return useSyncExternalStore(subscribeVerseWrites, getSnapshot, getSnapshot)
}

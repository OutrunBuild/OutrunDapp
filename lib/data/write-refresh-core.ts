// Post-write server refresh — orchestration core (dependency-injected, unit-testable).
//
// WHY THIS EXISTS: the server data path is stale-while-revalidate by design (§9 — a lagging
// graph never blocks a render). That contract is wrong exactly once: right after a write this
// user confirmed, the page's numbers must converge NOW. The post-write router.refresh() alone
// replays pre-write values off the warm caches, and the background revalidation that follows
// never triggers another render. This core closes that loop: wait until the subgraph index has
// passed the write, drop the verse-scoped caches, then prime them with fresh reads so the
// caller's router.refresh() renders post-write numbers in one pass.
//
// FRESHNESS GATE: invalidating before the index catches up would let the cold re-fetch
// re-cache the PRE-write aggregates under a fresh timestamp — the refresh would not only be a
// no-op, it would reset the TTL clock on the stale value. So the gate (indexed block ≥ target)
// runs BEFORE the invalidation. Target = the write's OWN block (receipt lookup by hash —
// exact); the safe head is only the fallback when the hash/receipt is unreadable, and it can
// overshoot: an index that persistently trails the head by more than the finality lag would
// hold the gate open until its bounded deadline, after which the refresh proceeds anyway
// (back to the pre-existing TTL behaviour instead of blocking the refresh).

/** Bounded gate: ~9s worst case. */
const GATE_ATTEMPTS = 6;
const GATE_INTERVAL_MS = 1500;

export type WriteRefreshDeps = {
  /** Block the write landed in (receipt by hash); null when the hash is absent or the
   *  receipt is unreadable. */
  getWriteBlock: (chainId: number, txHash: string | null) => Promise<number | null>;
  /** Live subgraph index head of the chain (uncached `_meta`); null when unreadable. */
  getIndexedBlock: (chainId: number) => Promise<number | null>;
  /** Drop the graph-tier verse-scoped cache entries (all chains). */
  invalidateVerse: (verseId: bigint) => void;
  /** Drop the config-tier verse-financials overlay entries (`verse-fin-<chain>-<id>`). */
  invalidateVerseConfig: (verseId: string) => void;
  /** Re-read the verse detail so the fresh values are warm in every cache the page reads. */
  primeVerse: (verseId: string) => Promise<unknown>;
  sleep: (ms: number) => Promise<void>;
};

export async function orchestrateVerseRefresh(
  deps: WriteRefreshDeps,
  input: { chainId: number; verseId: string; txHash?: string | null },
): Promise<void> {
  const target = await deps.getWriteBlock(input.chainId, input.txHash ?? null);
  if (target != null) {
    for (let attempt = 0; attempt < GATE_ATTEMPTS; attempt++) {
      const indexed = await deps.getIndexedBlock(input.chainId);
      if (indexed != null && indexed >= target) break;
      await deps.sleep(GATE_INTERVAL_MS);
    }
  }
  deps.invalidateVerse(BigInt(input.verseId));
  deps.invalidateVerseConfig(input.verseId);
  try {
    await deps.primeVerse(input.verseId);
  } catch {
    // A failed prime leaves the caches cold — the next render's own blocking read fetches
    // fresh data, so the refresh still lands, one render later.
  }
}

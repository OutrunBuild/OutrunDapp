// Same-machine SWR disk seed store. A cold process — fresh boot, restart, or a second local server
// (dev + production preview coexisting) — would otherwise pay the full graph/RPC round trip on its
// first request. Settled values are persisted here (last-write-wins, atomic rename) so a cold
// process seeds its cache from disk, serves the last ok value instantly, and refreshes in
// background — same stale-while-revalidate contract as the in-memory layer, across restarts and
// coexisting same-machine processes (measured: restart first hit 3.2s -> 0.34s). No production
// cross-process seed sharing is implied: serving is a single `next start`, and multi-instance
// hosts (e.g. Vercel) give each instance its own tmpdir. Best-effort by design: any fs failure
// degrades to a normal cold fetch.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DIR = join(tmpdir(), 'outrun-dapp-swr');

// graph views carry BigInt amounts (JSON-unsafe); wrap them losslessly for the round trip
const replacer = (_k: string, v: unknown) =>
  typeof v === 'bigint' ? ({ $bigint: String(v) } as unknown) : v;
const reviver = (_k: string, v: unknown) => {
  if (v !== null && typeof v === 'object' && '$bigint' in (v as Record<string, unknown>)) {
    return BigInt((v as Record<string, unknown>).$bigint as string);
  }
  return v;
};

export function readSeed<T>(namespace: string, key: string): { at: number; value: T } | null {
  try {
    const parsed = JSON.parse(
      readFileSync(join(DIR, `${namespace}.json`), 'utf8'),
      reviver,
    ) as Record<string, { at: number; value: T }>;
    return parsed[key] ?? null;
  } catch {
    return null;
  }
}

export function writeSeed(namespace: string, key: string, at: number, value: unknown): void {
  try {
    mkdirSync(DIR, { recursive: true });
    const file = join(DIR, `${namespace}.json`);
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(readFileSync(file, 'utf8'), reviver) as Record<string, unknown>;
    } catch {
      // no prior file (or unreadable) — start fresh
    }
    parsed[key] = { at, value };
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(parsed, replacer));
    renameSync(tmp, file);
  } catch {
    // persistence is best-effort: a failed seed write never affects serving
  }
}

/** Drop one seed so a later cold start (restart or fresh process) cannot resurrect a value the
 *  in-memory layer just invalidated (post-write refresh); concurrently running processes are not
 *  synchronized. Same best-effort contract as writeSeed. */
export function deleteSeed(namespace: string, key: string): void {
  try {
    const file = join(DIR, `${namespace}.json`);
    const parsed = JSON.parse(readFileSync(file, 'utf8'), reviver) as Record<string, unknown>;
    if (!(key in parsed)) return;
    delete parsed[key];
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(parsed, replacer));
    renameSync(tmp, file);
  } catch {
    // a missing/corrupt file is already "no seed"
  }
}

/** Drop every seed in the namespace matching the predicate, by enumerating the namespace's full
 *  on-disk keyspace. Seeds survive restarts, so the file holds keys a fresh process never
 *  materialized in memory — invalidation that only deleted keys present in the local Map would
 *  leave those behind, and the next cold start would resurrect the pre-write value. Callers pass
 *  the same predicate the in-memory pass used, so both layers drop exactly the same keys. Same
 *  best-effort contract as writeSeed. */
export function deleteSeedsMatching(namespace: string, matches: (key: string) => boolean): void {
  try {
    const file = join(DIR, `${namespace}.json`);
    const parsed = JSON.parse(readFileSync(file, 'utf8'), reviver) as Record<string, unknown>;
    let dropped = false;
    for (const key of Object.keys(parsed)) {
      if (!matches(key)) continue;
      delete parsed[key];
      dropped = true;
    }
    if (!dropped) return;
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(parsed, replacer));
    renameSync(tmp, file);
  } catch {
    // a missing/corrupt file is already "no seed"
  }
}

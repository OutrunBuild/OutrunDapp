// Cross-process SWR seed store. `next start` renders across several worker processes, each with
// its own module-level cache — a cold worker would otherwise pay the full graph/RPC round trip
// on its first request. Settled values are persisted here (last-write-wins, atomic rename) so a
// cold process seeds its cache from disk, serves the last ok value instantly, and refreshes in
// background — same stale-while-revalidate contract as the in-memory layer, extended across
// processes and restarts. Best-effort by design: any fs failure degrades to a normal cold fetch.
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

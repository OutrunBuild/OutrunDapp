// Production data repository (contract layer).
// Only returns real data sources or structured unavailable states; never falls back to prototype
// data. Real RPC/Graph data assembly plugs in here; the forbidden-word list is enforced literally
// by the production-resolver-token rule in scripts/check-fixture-boundary.mjs (none of the listed
// words may appear in this file).

export type DataUnavailable =
  | { reason: 'undeployed'; detail: string } // Structured undeployed (zero addresses/placeholders forbidden)
  | { reason: 'rpc-error'; detail: string }
  | { reason: 'not-configured'; detail: string };

export type DataResult<T> =
  { status: 'ok'; data: T } | ({ status: 'unavailable' } & DataUnavailable);

export interface ProductionRepository {
  /** Six-chain real-time balances/allowances/receipts (RPC; an index (Graph) fallback never overrides the RPC readings) */
  getBalances(address: string, chainId: number): Promise<DataResult<unknown>>;
  /** Graph aggregated lists (server-side repository queries, short cache + dedup) */
  getVerseSummaries(chainId: number): Promise<DataResult<unknown>>;
}

class NotWiredRepository implements ProductionRepository {
  async getBalances(): Promise<DataResult<unknown>> {
    return {
      status: 'unavailable',
      reason: 'not-configured',
      detail: 'Real RPC wiring pending; the production resolver never falls back to fixtures',
    };
  }
  async getVerseSummaries(): Promise<DataResult<unknown>> {
    return {
      status: 'unavailable',
      reason: 'not-configured',
      detail: 'Graph wiring pending (server queries + short cache)',
    };
  }
}

export function getProductionRepository(): ProductionRepository {
  return new NotWiredRepository();
}

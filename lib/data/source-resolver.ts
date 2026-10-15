// Build-mode resolver -- the sole selection point for the onchain data source
// (fixture-boundary-contract OUTRUN_DATA_SOURCE semantics). Rules:
//  1) Onchain-mode builds/code fetch data only through this file; this file points only to the
//     onchain repository.
//  2) Fixture-mode code in components/<domain>/** imports the fixture data source directly (not
//     via this file) -- so fixtures/** is statically unreachable from the onchain import graph.
//  3) This file and the onchain repository must not mention: prototype repository names,
//     screenshot-freeze selector names, or fixture sentinel constant names
//     (enforced via a literal list by scripts/check-fixture-boundary.mjs and source-resolver.test.ts).
export { getOnchainRepository, type OnchainRepository, type DataResult } from './repository';

import { getOnchainRepository } from './repository';

let cached: ReturnType<typeof getOnchainRepository> | null = null;

/** Lazy module singleton: one onchain repository instance per server process */
export function resolveDataSource() {
  return (cached ??= getOnchainRepository());
}

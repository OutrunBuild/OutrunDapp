// Build-mode resolver -- the sole selection point for the production data source. Rules:
//  1) Production builds/production code fetch data only through this file; this file points only to
//     the production repository.
//  2) Prototype-mode code in components/<domain>/** imports fixtures data sources directly (not via
//     this file) -- so fixtures/** is statically unreachable from the production import graph.
//  3) This file and the production repository must not mention: prototype repository names,
//     screenshot-freeze selector names, or fixture sentinel constant names
//     (enforced via a literal list by scripts/check-fixture-boundary.mjs and source-resolver.test.ts).
export { getProductionRepository, type ProductionRepository, type DataResult } from './repository';

import { getProductionRepository } from './repository';

let cached: ReturnType<typeof getProductionRepository> | null = null;

/** Lazy module singleton: one production repository instance per server process */
export function resolveDataSource() {
  return (cached ??= getProductionRepository());
}

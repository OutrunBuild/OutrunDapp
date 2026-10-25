import type { VerseStage } from '@/lib/data/fixture-repository'

import { legalSortForStage } from './sort-options'

/** Page size: 4 infinite-scroll batches (GRID_BATCH_SIZE=6) per server page */
export const DISCOVERY_PAGE_SIZE = 24

/** Seven axes of discovery URL state (props = the parser's normalized current values) */
export type DiscoveryQueryState = {
  stage: VerseStage
  sort: string
  order: 'asc' | 'desc'
  chain: string
  mode: string
  query: string
  page: number
}

/** Single construction point for param merging + serialization: unspecified axes inherit the
 *  current values; chain is mandatory (no 'all': each chain settles its own genesis, so a
 *  cross-chain view has no defined progress) and always written; page >1 written as ?page=;
 *  other defaults stay out of the URL (order=desc / query empty; mode written only in the
 *  genesis stage). Any filter-axis change resets the page to 1 (callers pass page: 1
 *  explicitly). */
export function discoveryHref(
  pathname: string,
  current: DiscoveryQueryState,
  changes: Partial<DiscoveryQueryState>,
) {
  const next = { ...current, ...changes }
  const params = new URLSearchParams()
  params.set('stage', next.stage)
  params.set('sort', next.sort)
  params.set('chain', next.chain)
  if (next.order !== 'desc') params.set('order', next.order)
  if (next.stage === 'genesis' && next.mode !== 'all') params.set('mode', next.mode)
  if (next.query) params.set('query', next.query)
  if (next.page > 1) params.set('page', String(next.page))
  return `${pathname}?${params.toString()}`
}

/** Switching stage tab: keeps the sort if legal for the target stage (locked↔unlocked
 *  share options); when illegal across genesis, falls back to createtime */
export function stageTabHref(pathname: string, current: DiscoveryQueryState, stage: VerseStage) {
  return discoveryHref(pathname, current, {
    stage,
    sort: legalSortForStage(stage, current.sort),
    page: 1,
  })
}

/** Clear filters: resets only the mode/query axes, preserving the user's stage/sort/order/chain
 *  position; shared by the filter-bar Clear and the empty-state Clear, so the two cannot
 *  semantically diverge by construction */
export function clearFiltersHref(pathname: string, current: DiscoveryQueryState) {
  return discoveryHref(pathname, current, { mode: 'all', query: '', page: 1 })
}

/** Next server page (infinite-scroll anchor): keeps every filter axis, advances page only */
export function nextPageHref(pathname: string, current: DiscoveryQueryState) {
  return discoveryHref(pathname, current, { page: current.page + 1 })
}

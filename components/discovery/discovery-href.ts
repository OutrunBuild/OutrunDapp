import type { VerseStage } from '@/lib/data/fixture-repository'

import { legalSortForStage } from './sort-options'

/** Six axes of discovery URL state (props = the parser's normalized current values) */
export type DiscoveryQueryState = {
  stage: VerseStage
  sort: string
  order: 'asc' | 'desc'
  chain: string
  mode: string
  q: string
}

/** Single construction point for param merging + serialization: unspecified axes inherit the
 *  current values; defaults stay out of the URL (order=desc / chain=all / q empty; mode written
 *  only in the genesis stage) */
export function discoveryHref(
  pathname: string,
  current: DiscoveryQueryState,
  changes: Partial<DiscoveryQueryState>,
) {
  const next = { ...current, ...changes }
  const params = new URLSearchParams()
  params.set('stage', next.stage)
  params.set('sort', next.sort)
  if (next.order !== 'desc') params.set('order', next.order)
  if (next.chain !== 'all') params.set('chain', next.chain)
  if (next.stage === 'genesis' && next.mode !== 'all') params.set('mode', next.mode)
  if (next.q) params.set('q', next.q)
  return `${pathname}?${params.toString()}`
}

/** Switching stage tab: keeps the sort if legal for the target stage (locked↔unlocked
 *  share options); when illegal across genesis, falls back to createtime */
export function stageTabHref(pathname: string, current: DiscoveryQueryState, stage: VerseStage) {
  return discoveryHref(pathname, current, { stage, sort: legalSortForStage(stage, current.sort) })
}

/** Clear filters: resets only the chain/mode/q axes, preserving the user's stage/sort/
 *  order position; shared by the filter-bar Clear and the empty-state Clear, so the two cannot
 *  semantically diverge by construction */
export function clearFiltersHref(pathname: string, current: DiscoveryQueryState) {
  return discoveryHref(pathname, current, { chain: 'all', mode: 'all', q: '' })
}

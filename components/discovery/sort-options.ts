import type { Verse, VerseStage } from '@/lib/data/fixture-repository'

/** Sort options differ per stage: locked includes Unlock Time, unlocked does not */
export const SORT_OPTIONS_BY_STAGE: Record<VerseStage, string[]> = {
  genesis: ['createtime', 'endtime', 'size', 'participants', 'progress'],
  locked: ['createtime', 'unlocktime', 'volume', 'marketcap', 'stakingapy', 'treasury'],
  unlocked: ['createtime', 'volume', 'marketcap', 'stakingapy', 'treasury'],
  refund: [],
}

/** Sort normalization: keeps the sort if legal for the target stage, otherwise falls back to
 *  createtime (the only option shared by the three browsing stages, and the universal fallback;
 *  the refund stage's option list is empty). Shared by discovery-page (URL parse side)
 *  and discovery-browser (tab-switch emit side) to prevent drift between the two */
export function legalSortForStage(stage: VerseStage, sort: string) {
  return SORT_OPTIONS_BY_STAGE[stage].includes(sort) ? sort : 'createtime'
}

/** progress sort key takes the larger of the two thresholds (reaching either one counts) */
function progressValue(verse: Verse) {
  return Math.max(verse.normalProgress, verse.leverageProgress)
}

/** Nullable numeric field sort: null (fixture has no livePhase snapshot) always sinks to the
 *  bottom, never flipping with asc/desc */
function nullableNumberOrder(direction: 1 | -1, a: number | null, b: number | null) {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1
  return direction * (a - b)
}

/** Date key for sorting: an absent/out-of-range timestamp sinks like the nullable numeric
 *  keys instead of poisoning the comparator with NaN */
function dateValue(value: string | null) {
  if (value == null) return null
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? null : ms
}

/** List sort: 10 keys × asc/desc (`size` and unknown keys share the participationSize fallback) */
export function sortVerses(verses: Verse[], sort: string, order: 'asc' | 'desc') {
  const direction = order === 'asc' ? 1 : -1
  return verses.toSorted((a, b) => {
    if (sort === 'endtime')
      return nullableNumberOrder(direction, dateValue(a.endsAt), dateValue(b.endsAt))
    if (sort === 'unlocktime')
      return nullableNumberOrder(direction, dateValue(a.unlockTimeAt), dateValue(b.unlockTimeAt))
    if (sort === 'volume') return nullableNumberOrder(direction, a.volume24h, b.volume24h)
    if (sort === 'marketcap')
      return nullableNumberOrder(direction, a.marketCapUsd, b.marketCapUsd)
    if (sort === 'stakingapy') return nullableNumberOrder(direction, a.stakingApy, b.stakingApy)
    if (sort === 'treasury')
      return nullableNumberOrder(direction, a.treasuryFundUsd, b.treasuryFundUsd)
    if (sort === 'participants')
      return direction * (a.participantCount - b.participantCount)
    if (sort === 'progress') return direction * (progressValue(a) - progressValue(b))
    if (sort === 'createtime')
      return nullableNumberOrder(direction, dateValue(a.createdAt), dateValue(b.createdAt))
    return direction * (a.participationSize - b.participationSize)
  })
}

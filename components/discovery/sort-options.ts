import type { FixtureVerse, VerseStage } from '@/lib/data/fixture-repository'

/** 排序项按阶段区分：锁定含 Unlock Time，已解锁不含（2026-10-01 用户参照截图裁定） */
export const SORT_OPTIONS_BY_STAGE: Record<VerseStage, string[]> = {
  genesis: ['createtime', 'endtime', 'size', 'participants', 'progress'],
  locked: ['createtime', 'unlocktime', 'volume', 'marketcap', 'stakingapy', 'treasury'],
  unlocked: ['createtime', 'volume', 'marketcap', 'stakingapy', 'treasury'],
  refund: [],
}

/** 排序归一：目标阶段合法则保留，否则回落 createtime（唯一全阶段公共项）。
 * discovery-page（URL 解析端）与 discovery-browser（tab 切换发射端）共用，防两端漂移 */
export function legalSortForStage(stage: VerseStage, sort: string) {
  return SORT_OPTIONS_BY_STAGE[stage].includes(sort) ? sort : 'createtime'
}

/** progress 排序键取双门槛较大值（达一即达标） */
function progressValue(verse: FixtureVerse) {
  return Math.max(verse.normalProgress, verse.leverageProgress)
}

/** 可空数值字段排序：null（fixture 无 livePhase 快照）恒沉底，不随升降序翻转 */
function nullableNumberOrder(direction: 1 | -1, a: number | null, b: number | null) {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1
  return direction * (a - b)
}

/** 列表排序：9 键 × 升降序；未知名按 size 口径（participationSize） */
export function sortVerses(verses: FixtureVerse[], sort: string, order: 'asc' | 'desc') {
  const direction = order === 'asc' ? 1 : -1
  return verses.toSorted((a, b) => {
    if (sort === 'endtime') return direction * (Date.parse(a.endsAt) - Date.parse(b.endsAt))
    if (sort === 'unlocktime')
      return direction * (Date.parse(a.unlockTimeAt) - Date.parse(b.unlockTimeAt))
    if (sort === 'volume') return nullableNumberOrder(direction, a.volume24h, b.volume24h)
    if (sort === 'marketcap')
      return nullableNumberOrder(direction, a.projectedMarketCap, b.projectedMarketCap)
    if (sort === 'stakingapy') return nullableNumberOrder(direction, a.stakingApy, b.stakingApy)
    if (sort === 'treasury')
      return nullableNumberOrder(direction, a.treasuryFundUsd, b.treasuryFundUsd)
    if (sort === 'participants')
      return direction * (a.participantCount - b.participantCount)
    if (sort === 'progress') return direction * (progressValue(a) - progressValue(b))
    if (sort === 'createtime')
      return direction * (Date.parse(a.createdAt) - Date.parse(b.createdAt))
    return direction * (a.participationSize - b.participationSize)
  })
}

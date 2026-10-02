import type { VerseStage } from '@/lib/data/fixture-repository'

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

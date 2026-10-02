import type { VerseStage } from '@/lib/data/fixture-repository'

import { legalSortForStage } from './sort-options'

/** discovery URL 状态六轴（props = 解析端归一后的当前值） */
export type DiscoveryQueryState = {
  stage: VerseStage
  sort: string
  order: 'asc' | 'desc'
  chain: string
  mode: string
  q: string
}

/** 参数合并 + 序列化单一构造点：未指定的轴继承当前值；
 * 默认值不进 URL（order=desc / chain=all / q 空；mode 仅创世阶段写入，2026-10-01 用户裁定） */
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

/** 切阶段 tab（P2-5[B]）：目标阶段合法则保留排序（locked↔unlocked 共享项），跨 genesis 非法回落 createtime */
export function stageTabHref(pathname: string, current: DiscoveryQueryState, stage: VerseStage) {
  return discoveryHref(pathname, current, { stage, sort: legalSortForStage(stage, current.sort) })
}

/** 清筛选（P2-5[A]）：只重置 chain/mode/q 三轴，保留用户所在的 stage/sort/order 位置；
 * 筛选栏 Clear 与空态 Clear 共用，语义分裂结构性不可复现 */
export function clearFiltersHref(pathname: string, current: DiscoveryQueryState) {
  return discoveryHref(pathname, current, { chain: 'all', mode: 'all', q: '' })
}

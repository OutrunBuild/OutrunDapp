// P2-5：切阶段 tab 的排序合法性归一——locked↔unlocked 共享项保留、
// 跨 genesis（排序集交集仅 createtime）与非法值回落 createtime
import { describe, expect, it } from 'vitest';

import { SORT_OPTIONS_BY_STAGE, legalSortForStage } from '../../components/discovery/sort-options';

describe('legalSortForStage', () => {
  it('目标阶段合法则保留（locked↔unlocked 共享项不丢）', () => {
    expect(legalSortForStage('unlocked', 'marketcap')).toBe('marketcap');
    expect(legalSortForStage('unlocked', 'volume')).toBe('volume');
    expect(legalSortForStage('locked', 'treasury')).toBe('treasury');
    expect(legalSortForStage('genesis', 'endtime')).toBe('endtime');
  });

  it('目标阶段非法则回落 createtime（跨 genesis 必降级）', () => {
    expect(legalSortForStage('locked', 'endtime')).toBe('createtime');
    expect(legalSortForStage('unlocked', 'progress')).toBe('createtime');
    expect(legalSortForStage('genesis', 'unlocktime')).toBe('createtime');
    expect(legalSortForStage('genesis', 'marketcap')).toBe('createtime');
  });

  it('未知/空值回落 createtime', () => {
    expect(legalSortForStage('locked', 'bogus')).toBe('createtime');
    expect(legalSortForStage('genesis', '')).toBe('createtime');
  });

  it('createtime 是三浏览阶段唯一公共排序项', () => {
    const stages = ['genesis', 'locked', 'unlocked'] as const;
    const shared = stages
      .map((stage) => new Set(SORT_OPTIONS_BY_STAGE[stage]))
      .reduce((acc, set) => new Set([...acc].filter((value) => set.has(value))));
    expect([...shared]).toEqual(['createtime']);
  });
});

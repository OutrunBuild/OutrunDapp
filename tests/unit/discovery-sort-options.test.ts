// P2-5：切阶段 tab 的排序合法性归一——locked↔unlocked 共享项保留、
// 跨 genesis（排序集交集仅 createtime）与非法值回落 createtime
import { describe, expect, it } from 'vitest';

import { getFixtureSnapshot } from '../../lib/data/fixture-repository';
import {
  SORT_OPTIONS_BY_STAGE,
  legalSortForStage,
  sortVerses,
} from '../../components/discovery/sort-options';

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

// sortVerses 期望钉在冻结 fixture 上：verses 数据变更走冻结链重签，需同步更新此处
describe('sortVerses', () => {
  function pick(...ids: string[]) {
    const verses = getFixtureSnapshot().verses;
    return ids.map((id) => {
      const verse = verses.find((candidate) => candidate.id === id);
      if (!verse) throw new Error(`fixture verse missing: ${id}`);
      return verse;
    });
  }

  it('可空数值键 null 恒沉底，不随升降序翻转', () => {
    // verse-001 无 livePhase 快照（volume24h=null）；002/026 为锁定态有值
    const verses = pick('verse-002', 'verse-001', 'verse-026');
    expect(sortVerses(verses, 'volume', 'asc').map((verse) => verse.id)).toEqual([
      'verse-002',
      'verse-026',
      'verse-001',
    ]);
    expect(sortVerses(verses, 'volume', 'desc').map((verse) => verse.id)).toEqual([
      'verse-026',
      'verse-002',
      'verse-001',
    ]);
  });

  it('未知排序名按 size 口径（participationSize）升降序', () => {
    // size：verse-021=27000 < verse-005=182000 < verse-017=562000
    const verses = pick('verse-005', 'verse-021', 'verse-017');
    expect(sortVerses(verses, 'bogus', 'asc').map((verse) => verse.id)).toEqual([
      'verse-021',
      'verse-005',
      'verse-017',
    ]);
    expect(sortVerses(verses, 'bogus', 'desc').map((verse) => verse.id)).toEqual([
      'verse-017',
      'verse-005',
      'verse-021',
    ]);
  });

  it('progress 取双门槛较大值排序', () => {
    // max(normal, leverage)：verse-008=106.7 > verse-001=82 > verse-022=80
    const verses = pick('verse-001', 'verse-008', 'verse-022');
    expect(sortVerses(verses, 'progress', 'desc').map((verse) => verse.id)).toEqual([
      'verse-008',
      'verse-001',
      'verse-022',
    ]);
  });

  it('排序返回新数组，不改写输入顺序', () => {
    const verses = pick('verse-005', 'verse-021', 'verse-017');
    const before = verses.map((verse) => verse.id);
    sortVerses(verses, 'size', 'asc');
    expect(verses.map((verse) => verse.id)).toEqual(before);
  });
});

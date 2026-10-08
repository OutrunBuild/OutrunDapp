// 路由 scheme 单测（2026-09-22 方案 C）：en 无前缀 / zh 带 /zh 前缀、
// 详情页数字 id（= 链上 uint256 verseId 口径）、fixture 行 id 留在数据层
import { describe, expect, it } from 'vitest';

import {
  localePath,
  narrowVerseQuery,
  verseHref,
  versePathSegment,
} from '../../components/global/routes';
import { getFixtureVerse } from '../../lib/data/fixture-repository';

describe('localePath', () => {
  it('en 无前缀，home 为 /', () => {
    expect(localePath('en', '')).toBe('/');
    expect(localePath('en', '/')).toBe('/');
    expect(localePath('en', '/memeverse')).toBe('/memeverse');
    expect(localePath('en', '/memeverse/21')).toBe('/memeverse/21');
  });

  it('zh 带 /zh 前缀，home 为 /zh', () => {
    expect(localePath('zh', '')).toBe('/zh');
    expect(localePath('zh', '/')).toBe('/zh');
    expect(localePath('zh', '/memeverse')).toBe('/zh/memeverse');
    expect(localePath('zh', '/memeverse/21')).toBe('/zh/memeverse/21');
  });
});

describe('versePathSegment / verseHref', () => {
  it('fixture 行 id 去前缀与前导零 → 数字段', () => {
    expect(versePathSegment('verse-021')).toBe('21');
    expect(versePathSegment('verse-001')).toBe('1');
    expect(versePathSegment('verse-100')).toBe('100');
  });

  it('无法解析的段原样返回（下游 notFound 兜底）', () => {
    expect(versePathSegment('moon-verse')).toBe('moon-verse');
  });

  it('verseHref 按 locale 拼详情页地址', () => {
    expect(verseHref('en', 'verse-004')).toBe('/memeverse/4');
    expect(verseHref('zh', 'verse-004')).toBe('/zh/memeverse/4');
  });

  it('verseHref 深链：非默认页签进 query，liquidity 默认页签不带 query', () => {
    expect(verseHref('en', 'verse-021', 'pol')).toBe('/memeverse/21?tab=pol');
    expect(verseHref('en', 'verse-021', 'liquidity')).toBe('/memeverse/21');
  });

  it('verseHref vault 页签带 action 深链', () => {
    expect(verseHref('zh', 'verse-021', 'vault', 'withdraw')).toBe(
      '/zh/memeverse/21?tab=vault&action=withdraw',
    );
  });

  it('超大数字 id 原样保留（uint256 口径，不走 Number 规整）', () => {
    expect(verseHref('en', 'verse-999999999999999999999999')).toBe(
      '/memeverse/999999999999999999999999',
    );
  });
});

describe('narrowVerseQuery', () => {
  it('白名单命中的 tab/action 原样通过', () => {
    expect(narrowVerseQuery({ tab: 'vault', action: 'withdraw' })).toEqual({
      tab: 'vault',
      action: 'withdraw',
    });
    // liquidity 在白名单内，只是 verseHref 负责让它不进 query
    expect(narrowVerseQuery({ tab: 'liquidity' })).toEqual({ tab: 'liquidity', action: undefined });
  });

  it('非白名单值与大小写变体丢弃', () => {
    expect(narrowVerseQuery({ tab: 'foo', action: 'deposit' })).toEqual({
      tab: undefined,
      action: undefined,
    });
    expect(narrowVerseQuery({ tab: 'Pol' })).toEqual({ tab: undefined, action: undefined });
  });

  it('缺省（undefined）透传', () => {
    expect(narrowVerseQuery({})).toEqual({ tab: undefined, action: undefined });
  });
});

describe('getFixtureVerse 数字解析', () => {
  it('数字段（含 leading 零）与旧版 verse-xxx 形态解析到同一 fixture 行', () => {
    expect(getFixtureVerse('21')?.id).toBe('verse-021');
    expect(getFixtureVerse('021')?.id).toBe('verse-021');
    expect(getFixtureVerse('verse-021')?.id).toBe('verse-021');
  });

  it('未知数字与非法段返回 null', () => {
    expect(getFixtureVerse('999')).toBeNull();
    expect(getFixtureVerse('abc')).toBeNull();
  });
});

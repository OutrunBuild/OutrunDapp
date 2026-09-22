// 路由 scheme 单测（2026-09-22 方案 C）：en 无前缀 / zh 带 /zh 前缀、
// 详情页数字 id（= 链上 uint256 verseId 口径）、fixture 行 id 留在数据层
import { describe, expect, it } from 'vitest';

import { localePath, verseHref, versePathSegment } from '../../components/prototype/routes';
import { getPrototypeVerse } from '../../lib/data/prototype-repository';

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
});

describe('getPrototypeVerse 数字解析', () => {
  it('数字段（含 leading 零）与旧版 verse-xxx 形态解析到同一 fixture 行', () => {
    expect(getPrototypeVerse('21')?.id).toBe('verse-021');
    expect(getPrototypeVerse('021')?.id).toBe('verse-021');
    expect(getPrototypeVerse('verse-021')?.id).toBe('verse-021');
  });

  it('未知数字与非法段返回 null', () => {
    expect(getPrototypeVerse('999')).toBeNull();
    expect(getPrototypeVerse('abc')).toBeNull();
  });
});

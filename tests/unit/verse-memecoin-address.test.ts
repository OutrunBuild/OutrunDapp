// Memecoin CA 与发现页地址搜索口径（P2-4：占位符承诺「地址」搜索）：
// 已部署 = locked/unlocked（fixture-repository deployedVerseCount 同口径，创世成功后才部署）；
// 搜索 = name/symbol/CA 同路径（trim + 小写 + 子串包含）；链上合约地址天然唯一。
import { describe, expect, it } from 'vitest';

import { getFixtureSnapshot } from '../../lib/data/fixture-repository';

describe('Verse memecoin CA：地址搜索数据契约', () => {
  const verses = getFixtureSnapshot().verses;
  const deployed = verses.filter((verse) => verse.stage === 'locked' || verse.stage === 'unlocked');

  it('已部署 verse（locked/unlocked）全部携带 CA——地址搜索对部署面不落空', () => {
    expect(deployed.length).toBeGreaterThan(0);
    for (const verse of deployed) {
      expect(verse.memecoinAddress, `${verse.id} 缺 tokenStats`).toMatch(/^0x[0-9a-fA-F]{40}$/);
    }
  });

  it('未部署 verse（genesis/refund）CA=null——创世成功前无合约可搜', () => {
    for (const verse of verses.filter(
      (verse) => verse.stage === 'genesis' || verse.stage === 'refund',
    )) {
      expect(verse.memecoinAddress, `${verse.id} 不应有 CA`).toBeNull();
    }
  });

  it('CA 全局唯一（链上地址天然唯一；回归 verse-002/003 曾同址）', () => {
    const addresses = deployed.map((verse) => verse.memecoinAddress);
    expect(new Set(addresses).size).toBe(addresses.length);
  });

  it('大小写不敏感命中：样本 CA 任意大小写切片均可作搜索词', () => {
    const verse = deployed[0];
    const address = verse.memecoinAddress!;
    const slice = address.slice(2, 12);
    expect(address.toLowerCase().includes(slice.toUpperCase().toLowerCase())).toBe(true);
    // 组件过滤同款谓词（discovery-browser normalizedQuery 口径）
    const hit = (query: string) =>
      verses.some((v) => v.memecoinAddress?.toLowerCase().includes(query.trim().toLowerCase()));
    expect(hit(slice.toUpperCase())).toBe(true);
    expect(hit(address)).toBe(true);
  });
});

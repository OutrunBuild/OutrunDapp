// P2-5 回归钉子：href 语义钉在纯函数层——tab 切换合法性保序、Clear 只清筛选保位置。
// 此前仅 sort-options 纯函数有测试，回滚 discovery-browser 两处 href 不会红（fix-review F1）
import { describe, expect, it } from 'vitest';

import {
  clearFiltersHref,
  discoveryHref,
  stageTabHref,
  type DiscoveryQueryState,
} from '../../components/discovery/discovery-href';

const at = (overrides: Partial<DiscoveryQueryState> = {}): DiscoveryQueryState => ({
  stage: 'unlocked',
  sort: 'marketcap',
  order: 'asc',
  chain: '1',
  mode: 'all',
  q: 'doge',
  ...overrides,
});

describe('stageTabHref', () => {
  it('locked↔unlocked 共享排序随 tab 保留（order/chain/q 继承）', () => {
    expect(
      stageTabHref('/memeverse/explore', at({ stage: 'locked', sort: 'treasury' }), 'unlocked'),
    ).toBe('/memeverse/explore?stage=unlocked&sort=treasury&order=asc&chain=1&q=doge');
  });

  it('跨 genesis 非法排序回落 createtime', () => {
    expect(
      stageTabHref('/memeverse/explore', at({ stage: 'unlocked', sort: 'marketcap' }), 'genesis'),
    ).toBe('/memeverse/explore?stage=genesis&sort=createtime&order=asc&chain=1&q=doge');
  });

  it('点击当前 tab 排序不变（合法值保留）', () => {
    expect(stageTabHref('/zh/memeverse/explore', at(), 'unlocked')).toBe(
      '/zh/memeverse/explore?stage=unlocked&sort=marketcap&order=asc&chain=1&q=doge',
    );
  });
});

describe('clearFiltersHref', () => {
  it('只清 chain/mode/q，保留 stage/sort/order（P2-5[A]）', () => {
    expect(clearFiltersHref('/memeverse/explore', at())).toBe(
      '/memeverse/explore?stage=unlocked&sort=marketcap&order=asc',
    );
  });

  it('默认值不进 URL：desc 时省略 order', () => {
    expect(clearFiltersHref('/memeverse/explore', at({ order: 'desc' }))).toBe(
      '/memeverse/explore?stage=unlocked&sort=marketcap',
    );
  });
});

describe('discoveryHref', () => {
  it('mode 仅创世阶段写入 URL', () => {
    expect(discoveryHref('/memeverse/explore', at({ mode: 'fast' }), {})).toBe(
      '/memeverse/explore?stage=unlocked&sort=marketcap&order=asc&chain=1&q=doge',
    );
    expect(discoveryHref('/memeverse/explore', at({ stage: 'genesis', mode: 'fast' }), {})).toBe(
      '/memeverse/explore?stage=genesis&sort=marketcap&order=asc&chain=1&mode=fast&q=doge',
    );
  });
});

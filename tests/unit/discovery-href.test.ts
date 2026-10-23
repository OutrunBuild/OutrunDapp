// Href regression pins: href semantics pinned at the pure-function layer —
// tab-switch legality preserves order, Clear only resets filters and keeps
// position. Chain is mandatory (no 'all'): always written, never cleared.
// Previously only the sort-options pure function had tests, so
// reverting the two discovery-browser href sites would not go red; these pins
// close that gap.
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
  query: 'doge',
  page: 1,
  ...overrides,
});

describe('stageTabHref', () => {
  it('locked<->unlocked shared sort survives the tab switch (order/chain/q inherited)', () => {
    expect(
      stageTabHref('/memeverse/explore', at({ stage: 'locked', sort: 'treasury' }), 'unlocked'),
    ).toBe('/memeverse/explore?stage=unlocked&sort=treasury&chain=1&order=asc&query=doge');
  });

  it('sort illegal across genesis falls back to createtime', () => {
    expect(
      stageTabHref('/memeverse/explore', at({ stage: 'unlocked', sort: 'marketcap' }), 'genesis'),
    ).toBe('/memeverse/explore?stage=genesis&sort=createtime&chain=1&order=asc&query=doge');
  });

  it('clicking the current tab keeps sort unchanged (legal value preserved)', () => {
    expect(stageTabHref('/zh/memeverse/explore', at(), 'unlocked')).toBe(
      '/zh/memeverse/explore?stage=unlocked&sort=marketcap&chain=1&order=asc&query=doge',
    );
  });
});

describe('clearFiltersHref', () => {
  it('clears only mode/q, keeps stage/sort/order/chain', () => {
    expect(clearFiltersHref('/memeverse/explore', at())).toBe(
      '/memeverse/explore?stage=unlocked&sort=marketcap&chain=1&order=asc',
    );
  });

  it('defaults stay out of the URL: order omitted when desc, chain always written', () => {
    expect(clearFiltersHref('/memeverse/explore', at({ order: 'desc' }))).toBe(
      '/memeverse/explore?stage=unlocked&sort=marketcap&chain=1',
    );
  });
});

describe('discoveryHref', () => {
  it('mode written to the URL only for the genesis stage', () => {
    expect(discoveryHref('/memeverse/explore', at({ mode: 'fast' }), {})).toBe(
      '/memeverse/explore?stage=unlocked&sort=marketcap&chain=1&order=asc&query=doge',
    );
    expect(discoveryHref('/memeverse/explore', at({ stage: 'genesis', mode: 'fast' }), {})).toBe(
      '/memeverse/explore?stage=genesis&sort=marketcap&chain=1&order=asc&mode=fast&query=doge',
    );
  });
});

describe('page param', () => {
  it('page 1 stays out of the URL; later pages are written', () => {
    expect(discoveryHref('/memeverse/explore', at({ page: 1 }), {})).not.toContain('page=');
    expect(discoveryHref('/memeverse/explore', at({ page: 3 }), {})).toContain('page=3');
  });

  it('stage switch and clear reset the page; next page advances only page', async () => {
    const { stageTabHref, clearFiltersHref, nextPageHref } =
      await import('../../components/discovery/discovery-href');
    expect(stageTabHref('/memeverse/explore', at({ page: 4 }), 'locked')).not.toContain('page=');
    expect(clearFiltersHref('/memeverse/explore', at({ page: 4, query: 'x' }))).not.toContain(
      'page=',
    );
    expect(nextPageHref('/memeverse/explore', at({ page: 2 }))).toContain('page=3');
  });
});

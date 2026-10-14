// Href regression pins: href semantics pinned at the pure-function layer —
// tab-switch legality preserves order, Clear only resets filters and keeps
// position. Previously only the sort-options pure function had tests, so
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
  q: 'doge',
  ...overrides,
});

describe('stageTabHref', () => {
  it('locked<->unlocked shared sort survives the tab switch (order/chain/q inherited)', () => {
    expect(
      stageTabHref('/memeverse/explore', at({ stage: 'locked', sort: 'treasury' }), 'unlocked'),
    ).toBe('/memeverse/explore?stage=unlocked&sort=treasury&order=asc&chain=1&q=doge');
  });

  it('sort illegal across genesis falls back to createtime', () => {
    expect(
      stageTabHref('/memeverse/explore', at({ stage: 'unlocked', sort: 'marketcap' }), 'genesis'),
    ).toBe('/memeverse/explore?stage=genesis&sort=createtime&order=asc&chain=1&q=doge');
  });

  it('clicking the current tab keeps sort unchanged (legal value preserved)', () => {
    expect(stageTabHref('/zh/memeverse/explore', at(), 'unlocked')).toBe(
      '/zh/memeverse/explore?stage=unlocked&sort=marketcap&order=asc&chain=1&q=doge',
    );
  });
});

describe('clearFiltersHref', () => {
  it('clears only chain/mode/q, keeps stage/sort/order', () => {
    expect(clearFiltersHref('/memeverse/explore', at())).toBe(
      '/memeverse/explore?stage=unlocked&sort=marketcap&order=asc',
    );
  });

  it('defaults stay out of the URL: order omitted when desc', () => {
    expect(clearFiltersHref('/memeverse/explore', at({ order: 'desc' }))).toBe(
      '/memeverse/explore?stage=unlocked&sort=marketcap',
    );
  });
});

describe('discoveryHref', () => {
  it('mode written to the URL only for the genesis stage', () => {
    expect(discoveryHref('/memeverse/explore', at({ mode: 'fast' }), {})).toBe(
      '/memeverse/explore?stage=unlocked&sort=marketcap&order=asc&chain=1&q=doge',
    );
    expect(discoveryHref('/memeverse/explore', at({ stage: 'genesis', mode: 'fast' }), {})).toBe(
      '/memeverse/explore?stage=genesis&sort=marketcap&order=asc&chain=1&mode=fast&q=doge',
    );
  });
});

// Remount-key regression pins for the cross-page infinite scroll: the browser key
// must stay stable while only ?page= advances (accumulated rows + reveal progress
// survive), and any filter-axis change must still remount (accumulation resets).
import { describe, expect, it } from 'vitest';

import { discoveryBrowserKey } from '../../components/discovery/discovery-href';

type KeyInput = Parameters<typeof discoveryBrowserKey>[0];

describe('discoveryBrowserKey', () => {
  const base = {
    stage: 'genesis' as const,
    sort: 'createtime',
    order: 'desc' as const,
    chain: '1',
    mode: 'all',
    query: '',
    scenario: null,
  };

  it('ignores the page: the key input type admits no page axis', () => {
    // Type-level pin: adding `page` to the helper's input must not compile, so a
    // pageValue regression cannot be reintroduced silently.
    type HasNoPage = 'page' extends keyof KeyInput ? false : true;
    const noPage: HasNoPage = true;
    expect(noPage).toBe(true);
    expect(discoveryBrowserKey(base)).toBe(discoveryBrowserKey({ ...base }));
  });

  it('changes on every filter axis (query, stage, chain, mode, sort, order, scenario)', () => {
    const variants = [
      { ...base, query: 'doge' },
      { ...base, stage: 'locked' as const },
      { ...base, chain: '2' },
      { ...base, mode: 'fast' },
      { ...base, sort: 'endtime' },
      { ...base, order: 'asc' as const },
      { ...base, scenario: 'loading' },
    ];
    for (const variant of variants) {
      expect(discoveryBrowserKey(variant)).not.toBe(discoveryBrowserKey(base));
    }
  });
});

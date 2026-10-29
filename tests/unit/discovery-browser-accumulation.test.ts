// @vitest-environment jsdom
// Cross-page infinite scroll: advancing ?page= must accumulate prior windows instead
// of replacing them (B5-R2-P1-004). Pinned at the component layer — the href-level key
// pin lives in discovery-browser-key.test.ts.
// next/link + next/navigation are stubbed (unit scope: accumulation state, not routing).
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

vi.mock('next/link', () => ({
  default: (props: Record<string, unknown>) => createElement('a', props),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/memeverse/explore',
  useRouter: () => ({ replace: vi.fn(), prefetch: vi.fn(), push: vi.fn() }),
}));

// jsdom has no IntersectionObserver: stub the sentinel observer (unit scope covers the
// accumulation state, not the scroll trigger itself).
class StubObserver {
  observe() {}
  disconnect() {}
}
vi.stubGlobal('IntersectionObserver', StubObserver);

import { DiscoveryBrowser } from '../../components/discovery/discovery-browser';
import { getChains, getSnapshot } from '../../lib/data/fixture-repository';

afterEach(() => {
  cleanup();
});

async function renderBrowser(overrides: Partial<Parameters<typeof DiscoveryBrowser>[0]> = {}) {
  const verses = getSnapshot().verses.slice(0, 3);
  const chains = await getChains();
  const props: Parameters<typeof DiscoveryBrowser>[0] = {
    locale: 'en',
    verses,
    chains,
    chainIds: [verses[0]?.chainId ?? 1],
    hasMore: true,
    initialPage: 1,
    initialStage: 'genesis',
    initialSort: 'createtime',
    initialOrder: 'desc',
    initialChain: String(verses[0]?.chainId ?? 1),
    initialMode: 'all',
    initialQuery: '',
    ...overrides,
  };
  return render(createElement(DiscoveryBrowser, props));
}

function cardTickers(container: HTMLElement) {
  return [...container.querySelectorAll('.economy-card')].map((card) =>
    card.querySelector('.economy-card__identity h3')?.textContent?.trim(),
  );
}

describe('DiscoveryBrowser cross-page accumulation', () => {
  it('keeps page-1 rows mounted after rerender with page-2 window (no whole-blood swap)', async () => {
    const all = getSnapshot().verses;
    const page1 = all.slice(0, 2);
    const page2 = all.slice(2, 4);
    expect(new Set([...page1, ...page2].map((verse) => verse.id)).size).toBe(4);

    const { container, rerender } = await renderBrowser({ verses: page1 });
    const before = cardTickers(container);
    expect(before).toHaveLength(2);

    const chains = await getChains();
    rerender(
      createElement(DiscoveryBrowser, {
        locale: 'en',
        verses: page2,
        chains,
        chainIds: [page1[0]?.chainId ?? 1],
        hasMore: false,
        initialPage: 2,
        initialStage: 'genesis',
        initialSort: 'createtime',
        initialOrder: 'desc',
        initialChain: String(page1[0]?.chainId ?? 1),
        initialMode: 'all',
        initialQuery: '',
      }),
    );
    const after = cardTickers(container);
    // Prior window rows survive alongside the new window (accumulation, not replacement)
    for (const verse of page1) {
      expect(after.some((ticker) => ticker?.includes(verse.symbol))).toBe(true);
    }
    expect(after.length).toBeGreaterThanOrEqual(4);
  });
});

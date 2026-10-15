import { createElement, type ReactNode } from 'react';
import { renderToPipeableStream, renderToString } from 'react-dom/server';
import { Writable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';

import { PortfolioPage } from '../../components/portfolio/portfolio-page';
import { ReferralPage } from '../../components/referral/referral-page';

// Same as app-shell.test: the three header widgets depend on App Router /
// mock-wallet context; stub them out to finish SSR render in a node environment
vi.mock('@/components/global/chain-selector-dialog', () => ({
  ChainSelectorDialog: () => createElement('div', { 'data-testid': 'chain-stub' }),
}));
vi.mock('@/components/global/wallet-control', () => ({
  WalletControl: () => createElement('div', { 'data-testid': 'wallet-stub' }),
}));
vi.mock('@/components/global/locale-menu', () => ({
  LocaleMenu: () => createElement('div', { 'data-testid': 'locale-stub' }),
}));

// Controllable wallet-connection state for the ExploreCta suite below. The flag must be
// declared before the module-level renders further down (vi.mock factories are hoisted, but
// the flag read happens at render time).
let mockConnected = false;
vi.mock('@/components/global/mock-wallet', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/global/mock-wallet')>();
  return {
    ...actual,
    useMockWallet: () => ({ connected: mockConnected, toggle: () => {} }),
  };
});

// Regression guard for the no-user-participation state:
// SSR is always disconnected (mock-wallet server snapshot false), so
// UserDataGate must keep data cards entirely out of the SSR HTML — e2e visual
// baselines are sensitive to "what got rendered extra" but insensitive to a
// single attribute, so assert card class-name absence/presence here directly.
// Async server components (stage 5 data-seam conversion): the page tree embeds async children
// (OutrunShell), so legacy renderToString throws on suspension — render through the streaming
// API and wait for allReady, exactly what the fixture build's server does
function renderAsync(node: ReactNode): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let html = '';
    const sink = new Writable({
      write(chunk, _enc, cb) {
        html += chunk;
        cb();
      },
    });
    const { pipe } = renderToPipeableStream(node, {
      onAllReady() {
        pipe(sink);
        sink.end(() => resolve(html));
      },
      onError(e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    });
  });
}

const NOT_RENDERED = await renderAsync(await PortfolioPage({ locale: 'en' }));
const REF_NOT_RENDERED = await renderAsync(
  await ReferralPage({ locale: 'en', host: 'localhost:3000' }),
);

describe('no-user-participation state (disconnected SSR)', () => {
  it('portfolio: KPI/net-worth hero/four zones hidden, page intro + connect CTA kept', () => {
    expect(NOT_RENDERED).toContain('page-intro');
    expect(NOT_RENDERED).toContain('connect-cta');
    expect(NOT_RENDERED).not.toContain('pf-kpi');
    expect(NOT_RENDERED).not.toContain('pf-hero');
    expect(NOT_RENDERED).not.toContain('pf-zone');
  });

  it('referral: stats/link/pending/history hidden, mechanics intro (how it works + split bar) + connect CTA kept', () => {
    expect(REF_NOT_RENDERED).toContain('ref-how');
    expect(REF_NOT_RENDERED).toContain('ref-split');
    expect(REF_NOT_RENDERED).toContain('connect-cta');
    expect(REF_NOT_RENDERED).not.toContain('ref-stats');
    expect(REF_NOT_RENDERED).not.toContain('ref-link');
    expect(REF_NOT_RENDERED).not.toContain('ref-pending');
    expect(REF_NOT_RENDERED).not.toContain('ref-history');
  });
});

// 2026-10-15 user ruling: zero-data portfolio sections render nothing at all — no empty
// shell cards, no zero-value placeholders
import { AssetsZone } from '../../components/portfolio/assets-zone';
import { ParticipationsZone } from '../../components/portfolio/participations-zone';

describe('zero-data portfolio zones unmount (2026-10-15 user ruling)', () => {
  it('participations zone renders nothing with zero rows', () => {
    const html = renderToString(createElement(ParticipationsZone, { locale: 'en', rows: [] }));
    expect(html).not.toContain('pf-participations');
    expect(html).not.toContain('empty-state');
  });

  it('assets zone renders nothing with zero assets', () => {
    const html = renderToString(
      createElement(AssetsZone, {
        locale: 'en',
        assets: [],
        chains: [],
        reserveBalances: {},
      }),
    );
    expect(html).not.toContain('pf-assets');
  });
});

// ExploreCta (2026-10-15 user ruling): connected wallet with every portfolio zone empty keeps
// exactly one action — the jump-to-discovery CTA
import { ExploreCta } from '../../components/global/connect-wallet-cta';

describe('ExploreCta (2026-10-15 user ruling)', () => {
  it('renders the explore jump with its note when connected', () => {
    mockConnected = true;
    const html = renderToString(createElement(ExploreCta, { locale: 'en' }));
    expect(html).toContain('connect-cta');
    expect(html).toContain('Explore genesis');
    expect(html).toContain('No assets, positions or participations yet');
    mockConnected = false;
  });

  it('renders nothing when disconnected (the connect CTA owns that state)', () => {
    mockConnected = false;
    const html = renderToString(createElement(ExploreCta, { locale: 'en' }));
    expect(html).not.toContain('connect-cta');
  });
});

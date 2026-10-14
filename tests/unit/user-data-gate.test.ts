import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
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

// Regression guard for the no-user-participation state:
// SSR is always disconnected (mock-wallet server snapshot false), so
// UserDataGate must keep data cards entirely out of the SSR HTML — e2e visual
// baselines are sensitive to "what got rendered extra" but insensitive to a
// single attribute, so assert card class-name absence/presence here directly.
const NOT_RENDERED = renderToString(createElement(PortfolioPage, { locale: 'en' }));
const REF_NOT_RENDERED = renderToString(
  createElement(ReferralPage, { locale: 'en', host: 'localhost:3000' }),
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

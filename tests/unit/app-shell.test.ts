import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { OutrunShell } from '../../components/global/app-shell';

// The three header widgets (chain selector / wallet / locale menu) depend on
// App Router and mock-wallet context; none of them are subjects of the
// nav-ownership semantics under test, so stub them out to finish SSR render
// in a node environment.
vi.mock('@/components/global/chain-selector-dialog', () => ({
  ChainSelectorDialog: () => createElement('div', { 'data-testid': 'chain-stub' }),
}));
vi.mock('@/components/global/wallet-control', () => ({
  WalletControl: () => createElement('div', { 'data-testid': 'wallet-stub' }),
}));
vi.mock('@/components/global/locale-menu', () => ({
  LocaleMenu: () => createElement('div', { 'data-testid': 'locale-stub' }),
}));

// Regression guard for nav-ownership semantics: the e2e visual baselines are
// insensitive to aria/data attribute dimensions (attribute flips measured
// 0 pixel diff), so assert at the SSR HTML layer here.
function renderShell(
  props: {
    current?: 'home' | 'discover' | 'create' | 'portfolio' | 'referral' | 'faucet';
    locale?: 'en' | 'zh';
  } = {},
) {
  return renderToString(
    createElement(OutrunShell, {
      locale: 'en',
      accountAddress: '0xabc',
      children: createElement('div', null, 'main content'),
      ...props,
    }),
  );
}

const count = (html: string, needle: string) => (html.match(new RegExp(needle, 'g')) ?? []).length;

describe('OutrunShell nav-ownership semantics', () => {
  it('omitted current = non-nav surface: product shell, zero aria-current, zero active states', () => {
    const html = renderShell();
    expect(html).toContain('product-sidebar');
    expect(html).toContain('mobile-navigation');
    expect(html).not.toContain('marketing-header');
    expect(count(html, 'aria-current="page"')).toBe(0);
    expect(count(html, 'data-active="true"')).toBe(0);
  });

  it('current="discover": exactly one active state each in desktop sidebar + mobile bottom bar', () => {
    const html = renderShell({ current: 'discover' });
    expect(html).not.toContain('marketing-header');
    expect(count(html, 'aria-current="page"')).toBe(2);
    expect(count(html, 'data-active="true"')).toBe(2);
  });

  it('current="home": marketing shell, no product nav, zero aria-current', () => {
    const html = renderShell({ current: 'home' });
    expect(html).toContain('marketing-header');
    expect(html).not.toContain('product-sidebar');
    expect(html).not.toContain('mobile-navigation');
    expect(count(html, 'aria-current="page"')).toBe(0);
  });

  it('current="home": header five-entry nav + chain switcher + locale/wallet', () => {
    const html = renderShell({ current: 'home' });
    expect(count(html, 'marketing-nav__link')).toBe(5);
    expect(html).toContain('>Explore<');
    expect(html).toContain('>Portfolio<');
    expect(html).toContain('>Launch<');
    expect(html).toContain('>Referral<');
    expect(html).toContain('>Faucet<');
    // Terminal index numbers: mono decorative numbering is
    // aria-hidden and stays out of the accessible name
    expect(count(html, 'marketing-nav__index')).toBe(5);
    expect(count(html, 'aria-hidden="true">0')).toBe(5);
    // Order guard: indexes map 1:1 to entries (Launch=02, same order as
    // sidebar navItems), Explore→Launch→Portfolio→Referral→Faucet
    expect(html).toContain('aria-hidden="true">01</span>Explore');
    expect(html).toContain('aria-hidden="true">02</span>Launch');
    expect(html).toContain('aria-hidden="true">03</span>Portfolio');
    expect(html).toContain('aria-hidden="true">04</span>Referral');
    expect(html).toContain('aria-hidden="true">05</span>Faucet');
    expect(html).toContain('data-testid="chain-stub"');
    expect(html).toContain('data-testid="locale-stub"');
    expect(html).toContain('data-testid="wallet-stub"');
  });

  // aria-label dictionary guard: the nav landmark's
  // accessible name comes from the copy layer so zh pages don't announce
  // English; e2e baselines measure 0 pixel diff on this dimension, pin it at
  // the SSR layer only.
  it('zh: nav aria-label comes from the copy dictionary, no English leakage', () => {
    const productHtml = renderShell({ locale: 'zh', current: 'discover' });
    expect(count(productHtml, 'aria-label="主导航"')).toBe(1);
    expect(productHtml).toContain('aria-label="移动端主导航"');
    expect(productHtml).not.toContain('aria-label="Primary"');
    expect(productHtml).not.toContain('aria-label="Mobile primary"');

    const homeHtml = renderShell({ locale: 'zh', current: 'home' });
    expect(count(homeHtml, 'aria-label="主导航"')).toBe(1);
    expect(homeHtml).not.toContain('aria-label="Primary"');
  });
});

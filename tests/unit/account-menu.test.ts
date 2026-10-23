// @vitest-environment jsdom
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

import { OutrunShell } from '../../components/global/app-shell';
import { AccountPlaceholder } from '../../components/global/account-menu';

vi.mock('@/components/global/chain-selector-dialog', () => ({
  ChainSelectorDialog: () => createElement('div', { 'data-testid': 'chain-stub' }),
}));
vi.mock('@/components/global/wallet-control', () => ({
  WalletControl: () => createElement('div', { 'data-testid': 'wallet-stub' }),
}));
vi.mock('@/components/global/locale-menu', () => ({
  LocaleMenu: () => createElement('div', { 'data-testid': 'locale-stub' }),
}));

async function renderShell(
  props: {
    current?: 'home' | 'discover' | 'create' | 'referral' | 'faucet';
    locale?: 'en' | 'zh';
  } = {},
) {
  const element = await OutrunShell({
    locale: 'en',
    accountAddress: '0xabc',
    children: createElement('div', null, 'main content'),
    ...props,
  });
  return renderToString(element);
}

const count = (html: string, needle: string) => (html.match(new RegExp(needle, 'g')) ?? []).length;

describe('portfolio removed from navigation', () => {
  it('desktop + mobile navs carry no portfolio entry', async () => {
    const html = await renderShell({ current: 'discover' });
    expect(html).not.toContain('/portfolio');
  });

  it('exactly one active state each in sidebar + bottom bar', async () => {
    const html = await renderShell({ current: 'discover' });
    expect(count(html, 'aria-current="page"')).toBe(2);
    expect(count(html, 'data-active="true"')).toBe(2);
  });
});

describe('AccountPlaceholder structure-faithful skeleton', () => {
  it('renders icon + label-slot breathing bar, not a lone centered icon', () => {
    const html = renderToString(createElement(AccountPlaceholder, { label: 'Connect Wallet' }));
    // D1 "skeleton keeps structure": the interim button mirrors the real
    // icon + label cluster — the placeholder bar exists next to the icon.
    expect(html).toContain('wallet-control__placeholder-bar');
    // D1 degrade: the accent chrome is pinned gray while restoring.
    expect(html).toContain('data-restoring');
    // The bar is decorative; the accessible name stays on the button.
    expect(html).toContain('aria-label="Connect Wallet"');
    expect(html).toContain('data-icon="inline-start"');
  });
});

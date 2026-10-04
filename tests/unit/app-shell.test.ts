import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { OutrunShell } from '../../components/global/app-shell';

// 顶栏三件（链选择/钱包/语言菜单）依赖 App Router 与 mock-wallet 上下文，
// 均非导航归属语义的测试对象，stub 掉以在 node 环境完成 SSR 渲染。
vi.mock('@/components/global/chain-selector-dialog', () => ({
  ChainSelectorDialog: () => createElement('div', { 'data-testid': 'chain-stub' }),
}));
vi.mock('@/components/global/wallet-control', () => ({
  WalletControl: () => createElement('div', { 'data-testid': 'wallet-stub' }),
}));
vi.mock('@/components/global/locale-menu', () => ({
  LocaleMenu: () => createElement('div', { 'data-testid': 'locale-stub' }),
}));

// 导航归属语义回归防线（fix-review F-1）：e2e 视觉基线对 aria/data 属性维度不敏感
// （属性翻转实测 0 像素差），此处直接在 SSR HTML 层断言。
function renderShell(props: { current?: string } = {}) {
  return renderToString(
    createElement(
      OutrunShell,
      { locale: 'en', accountAddress: '0xabc', ...props },
      createElement('div', null, 'main content'),
    ),
  );
}

const count = (html: string, needle: string) => (html.match(new RegExp(needle, 'g')) ?? []).length;

describe('OutrunShell 导航归属语义', () => {
  it('current 省略 = 非导航面：产品壳、零 aria-current、零点亮', () => {
    const html = renderShell();
    expect(html).toContain('product-sidebar');
    expect(html).toContain('mobile-navigation');
    expect(html).not.toContain('marketing-header');
    expect(count(html, 'aria-current="page"')).toBe(0);
    expect(count(html, 'data-active="true"')).toBe(0);
  });

  it('current="discover"：桌面侧栏 + 移动底栏各恰一处点亮', () => {
    const html = renderShell({ current: 'discover' });
    expect(html).not.toContain('marketing-header');
    expect(count(html, 'aria-current="page"')).toBe(2);
    expect(count(html, 'data-active="true"')).toBe(2);
  });

  it('current="home"：营销壳、无产品导航、零 aria-current', () => {
    const html = renderShell({ current: 'home' });
    expect(html).toContain('marketing-header');
    expect(html).not.toContain('product-sidebar');
    expect(html).not.toContain('mobile-navigation');
    expect(count(html, 'aria-current="page"')).toBe(0);
  });

  it('current="account"：禁用项永不点亮（NavKey 合法但走禁用分支）', () => {
    const html = renderShell({ current: 'account' });
    expect(count(html, 'aria-current="page"')).toBe(0);
    expect(count(html, 'data-active="true"')).toBe(0);
  });
});

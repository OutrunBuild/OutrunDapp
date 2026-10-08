import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { PortfolioPage } from '../../components/portfolio/portfolio-page';
import { ReferralPage } from '../../components/referral/referral-page';

// 同 app-shell.test：顶栏三件依赖 App Router/mock-wallet 上下文，stub 掉以在 node 环境完成 SSR
vi.mock('@/components/global/chain-selector-dialog', () => ({
  ChainSelectorDialog: () => createElement('div', { 'data-testid': 'chain-stub' }),
}));
vi.mock('@/components/global/wallet-control', () => ({
  WalletControl: () => createElement('div', { 'data-testid': 'wallet-stub' }),
}));
vi.mock('@/components/global/locale-menu', () => ({
  LocaleMenu: () => createElement('div', { 'data-testid': 'locale-stub' }),
}));

// 无用户参与态回归防线（2026-10-08 用户裁定）：SSR 恒为未连接（mock-wallet 服务端
// 快照 false），UserDataGate 必须把数据卡整体挡在 SSR HTML 之外——e2e 视觉基线对
// 「多渲染了什么」敏感、对单属性不敏感，此处直接断言卡面类名缺席/在场。
const NOT_RENDERED = renderToString(createElement(PortfolioPage, { locale: 'en' }));
const REF_NOT_RENDERED = renderToString(
  createElement(ReferralPage, { locale: 'en', host: 'localhost:3000' }),
);

describe('无用户参与态（未连接 SSR）', () => {
  it('portfolio：KPI/净值 hero/四分区整体隐藏，页头标题+副题+连接 CTA 保留', () => {
    expect(NOT_RENDERED).toContain('page-intro');
    expect(NOT_RENDERED).toContain('connect-cta');
    expect(NOT_RENDERED).not.toContain('pf-kpi');
    expect(NOT_RENDERED).not.toContain('pf-hero');
    expect(NOT_RENDERED).not.toContain('pf-zone');
  });

  it('referral：统计/链接/待领/历史隐藏，机制介绍（运作方式+分账条）+连接 CTA 保留', () => {
    expect(REF_NOT_RENDERED).toContain('ref-how');
    expect(REF_NOT_RENDERED).toContain('ref-split');
    expect(REF_NOT_RENDERED).toContain('connect-cta');
    expect(REF_NOT_RENDERED).not.toContain('ref-stats');
    expect(REF_NOT_RENDERED).not.toContain('ref-link');
    expect(REF_NOT_RENDERED).not.toContain('ref-pending');
    expect(REF_NOT_RENDERED).not.toContain('ref-history');
  });
});

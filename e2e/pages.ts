// e2e shared: baseline route table and deterministic clock anchor
// (shared by visual.spec / a11y.spec)
// New page delivery: after manual three-tier spot checks, add to PAGES
// connectWallet: true = click the product-topbar wallet button before the
// screenshot/scan to enter the connected state
// (disconnected = no-user-participation state, data cards
// hidden — data-enriched layouts use the connected-state baseline;
//  *-disconnected entries lock the disconnected default state, preventing
// gate failure from leaking data back onto pages).
export const FIXED_NOW = new Date('2026-10-01T00:00:00Z');

export type VisualPage = {
  name: string;
  path: string;
  connectWallet?: boolean;
  /** zh fallback baselines lock the mobile tier only (same standard as ZH_PAGES) */
  mobileOnly?: boolean;
};

export const PAGES: VisualPage[] = [
  { name: 'home', path: '/' },
  { name: 'explore', path: '/memeverse/explore' },
  { name: 'launch', path: '/memeverse/launch', connectWallet: true },
  { name: 'launch-disconnected', path: '/memeverse/launch' },
  { name: 'verse-21', path: '/memeverse/21' },
  { name: 'portfolio', path: '/portfolio', connectWallet: true },
  { name: 'portfolio-disconnected', path: '/portfolio' },
  { name: 'referral', path: '/referral', connectWallet: true },
  { name: 'referral-disconnected', path: '/referral' },
  { name: 'faucet', path: '/faucet', connectWallet: true },
  { name: 'faucet-disconnected', path: '/faucet' },
  { name: 'design-system', path: '/design-system' },
];

export const ZH_PAGES: VisualPage[] = [
  { name: 'zh-home', path: '/zh' },
  { name: 'zh-explore', path: '/zh/memeverse/explore' },
  { name: 'zh-referral', path: '/zh/referral', connectWallet: true },
  { name: 'zh-referral-disconnected', path: '/zh/referral' },
  { name: 'zh-portfolio', path: '/zh/portfolio', connectWallet: true },
  { name: 'zh-faucet', path: '/zh/faucet', connectWallet: true },
  { name: 'zh-faucet-disconnected', path: '/zh/faucet' },
];

// Route-level 404 fallback: unmatched paths (the proxy rewrites everything to
// /en/**) bubble to the root app/not-found.tsx boundary. Status is asserted by
// the dedicated visual.spec block (200 streamed / 404 non-streamed are both
// legitimate for a dynamic not-found page).
export const FALLBACK_PAGES: VisualPage[] = [
  { name: 'not-found', path: '/not-found-baseline' },
  { name: 'zh-not-found', path: '/zh/not-found-baseline', mobileOnly: true },
];

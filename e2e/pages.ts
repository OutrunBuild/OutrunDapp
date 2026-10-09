// e2e 共享：基线路由表与确定性时钟锚点（visual.spec / a11y.spec 共用）
// 新页面交付：人工三档抽查后补进 PAGES（agent-workflow.md §3.2）
// connectWallet: true = 截图/扫描前点 product-topbar 钱包钮切到连接态
// （2026-10-08 裁定：未连接=无用户参与态，数据卡隐藏——数据富集布局走连接态基线，
//  *-disconnected 条目锁未连接默认态，防闸门失效数据泄漏回页面）。
export const FIXED_NOW = new Date('2026-10-01T00:00:00Z');

export type VisualPage = { name: string; path: string; connectWallet?: boolean };

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

// e2e 共享：基线路由表与确定性时钟锚点（visual.spec / a11y.spec 共用）
// 新页面交付：人工三档抽查后补进 PAGES（agent-workflow.md §3.2）
export const FIXED_NOW = new Date('2026-10-01T00:00:00Z');

export const PAGES = [
  { name: 'home', path: '/' },
  { name: 'explore', path: '/memeverse/explore' },
  { name: 'launch', path: '/memeverse/launch' },
  { name: 'verse-21', path: '/memeverse/21' },
  { name: 'portfolio', path: '/portfolio' },
  { name: 'design-system', path: '/design-system' },
] as const;

export const ZH_PAGES = [
  { name: 'zh-home', path: '/zh' },
  { name: 'zh-explore', path: '/zh/memeverse/explore' },
] as const;

import { IBM_Plex_Mono, IBM_Plex_Sans, Saira_Condensed } from 'next/font/google'

// Production font source. tokens.css composes these variables into
// --font-display / --font-body / --font-data. Declare each family exactly once.
//
// display 维持 swap（2026-10-09 用户否决 optional 实验）：optional 在开发态
// （dev server 静态资源不缓存，每次刷新都冷加载）与任何绕缓存的刷新下，
// 字体错过 100ms 阻塞期即整页锁死后备字体、永不换装——用户实见系统黑体
// 冒充 Noto。刷新闪变真因=Next 对动态路由段不下发 next/font preload（差分
// 实证见决议 029）；拉丁已由 font-preload.tsx 补发 preload 修复。
//
// 中文 Noto Sans SC 不在此声明（决议 029 补充 2）：next/font 形态=4 字重
// × 113 分片共 452 个不可预载 face，是刷新闪变主源；已改为全站文案子集的
// 自托管变体单文件（scripts/build-cjk-font.mjs 产物，@font-face 与预载见
// font-preload.tsx，覆盖对账 pnpm check:cjk-font）。

export const sairaCondensed = Saira_Condensed({
  weight: ['600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-d1-display',
})

export const ibmPlexSans = IBM_Plex_Sans({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-d1-body',
})

export const ibmPlexMono = IBM_Plex_Mono({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-plex-mono',
})

export const productFontClassName = [
  sairaCondensed.variable,
  ibmPlexSans.variable,
  ibmPlexMono.variable,
].join(' ')

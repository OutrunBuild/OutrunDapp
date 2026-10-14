import { IBM_Plex_Mono, IBM_Plex_Sans, Saira_Condensed } from 'next/font/google'

// Production font source. tokens.css composes these variables into
// --font-display / --font-body / --font-data. Declare each family exactly once.
//
// display stays swap: with optional, in development (dev server static assets are uncached,
// every refresh loads cold) and under any cache-bypassing refresh, a font that misses the 100ms
// block period locks the whole page onto the fallback forever, never re-dressing — users actually
// saw the system sans impersonating Noto. The real cause of refresh flicker = Next not emitting
// next/font preload for dynamic route segments; font-preload.tsx fixes the Latin side by
// re-emitting preloads.
//
// Chinese Noto Sans SC is not declared here: next/font's form =
// 4 weights × 113 shards = 452 non-preloadable faces, the main refresh-flicker source; replaced
// with a self-hosted single-file variant subsetting all site copy (artifact of
// scripts/build-cjk-font.mjs; @font-face and preload in font-preload.tsx, coverage audit via
// pnpm check:cjk-font).

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

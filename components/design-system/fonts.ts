import { IBM_Plex_Mono, IBM_Plex_Sans, Noto_Sans_SC, Saira_Condensed } from 'next/font/google'

// Production font source. tokens.css composes these variables into
// --font-display / --font-body / --font-data. Declare each family exactly once.

export const notoSansSC = Noto_Sans_SC({
  weight: ['400', '500', '600', '700'],
  preload: false,
  display: 'swap',
  variable: '--font-noto-sc',
})

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
  notoSansSC.variable,
  sairaCondensed.variable,
  ibmPlexSans.variable,
  ibmPlexMono.variable,
].join(' ')

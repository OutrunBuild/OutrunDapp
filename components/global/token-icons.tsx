import type { SVGProps } from 'react'

// Token asset identity icons (sUSDS/aUSDC serve the /faucet claim rows):
// - uAsset family (UUSD/UETH/UBNB; prefix matching also matches the Credit-variant
//   symbols, e.g. UETH(Credit)) = Outrun brand
//   emblem: yellow disc #FCEE0A + magenta-anchored glyph (logo-yellow /
//   logo-magenta-bright); geometry traced from the official mark outline, with the $
//   lightened
// - Reserve/native/yield-bearing tokens (BNB/ETH/USDC/USDT/sUSDS/aUSDC) = official
//   token icons: USDC/USDT/ETH/BNB from the CoinGecko/Trust Wallet token asset
//   sources; sUSDS = Sky's official CoinGecko-listed asset (assets.coingecko.com
//   coins/52721, green coin with a white S); aUSDC = the combined mark embedded in
//   Aave's official aave-ui-kit (USDC + Aave badge, 256 SVG) — third-party assets do
//   not wear the brand emblem; official marks are used
const TOKEN_ICON: Record<string, string> = {
  UUSD: '/tokens/uusd.svg',
  UETH: '/tokens/ueth.svg',
  UBNB: '/tokens/ubnb.svg',
  BNB: '/tokens/bnb.png',
  ETH: '/tokens/eth.png',
  USDC: '/tokens/usdc.png',
  USDT: '/tokens/usdt.png',
  sUSDS: '/tokens/susds.png',
  aUSDC: '/tokens/ausdc.svg',
}

/** Whether a known token icon exists (uAsset brand emblem + reserve/native official
 * icons, prefix matching) */
export function hasTokenIcon(symbol: string): boolean {
  return Object.keys(TOKEN_ICON).some((prefix) => symbol.startsWith(prefix))
}

export function TokenIconMark({
  symbol,
  size = 20,
  ...props
}: SVGProps<HTMLElement> & { symbol: string; size?: number }) {
  const hit = Object.entries(TOKEN_ICON).find(([prefix]) => symbol.startsWith(prefix))
  if (!hit) return null
  const style = { inlineSize: size, blockSize: size, ...props.style }
  return <img src={hit[1]} alt="" style={style} className={props.className} />
}

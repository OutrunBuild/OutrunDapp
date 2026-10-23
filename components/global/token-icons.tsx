import type { SVGProps } from 'react'

// Token asset identity icons (sUSDS/aUSDC serve the /faucet claim rows):
// - uAsset family (UUSD/UETH/UBNB; prefix matching also matches the Credit-variant
//   symbols, e.g. UETH(Credit)) = decision-log 042 dark-neon mint: near-black amber
//   disc #221E08 + brand-yellow rim ring #FCEE0A + neon magenta #FF06B5 glyph (glow
//   is baked into the asset — token icons are brand-identity chrome, exempt from the
//   data-layer zero-glow rule per that ruling); glyph scales retuned per mark so the
//   ink height sits at ~71% of the disc ($ 1.12 / ETH diamond 0.72 / BNB kites 1.07)
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

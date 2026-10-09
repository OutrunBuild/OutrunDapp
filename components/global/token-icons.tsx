import type { SVGProps } from 'react'

// 代币资产身份图标（2026-10-07 定稿；2026-10-09 扩 sUSDS/aUSDC——/faucet 领取行）：
// - uAsset 族（UUSD/UETH/UBNB，Credit 前缀匹配共用）= Outrun 品牌章 v3.1：黄地圆
//   #FCEE0A + 品红锚定字形（logo-yellow / logo-magenta-bright），几何=官方标轮廓
//   追踪 + 对标调轻 $，构造与审计见 docs/design/token-icons/README.md
// - 储备/原生/生息代币（BNB/ETH/USDC/USDT/sUSDS/aUSDC）= 官方代币图标：USDC/USDT/ETH/
//   BNB=CoinGecko/Trust Wallet 代币资产源；sUSDS=Sky 官方 CoinGecko 收录资产
//   （assets.coingecko.com coins/52721，绿币白 S）；aUSDC=Aave 官方 aave-ui-kit 内嵌
//   组合标（USDC+Aave 徽标，256 SVG）——第三方资产不套品牌章，用官方标
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

/** 是否有已知代币图标（uAsset 品牌章 + 储备/原生官方图标，前缀匹配） */
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

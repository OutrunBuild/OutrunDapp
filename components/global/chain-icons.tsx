import type { SVGProps } from 'react'

// Chain icons: official Trustwallet assets chain logos (PNG, mapped by chainId; testnets
// use their own official logos; base_sepolia falls back to the base mainnet logo when
// it has no dedicated directory)
const CHAIN_LOGO: Record<number, string> = {
  1: '/chains/ethereum.png',
  11155111: '/chains/sepolia.png',
  421614: '/chains/arbitrum.png',
  8453: '/chains/base.png',
  84532: '/chains/base.png',
  56: '/chains/bnb.png',
  97: '/chains/bnb.png',
}

export function ChainLogoMark({ chainId, size = 16, ...props }: SVGProps<HTMLElement> & { chainId: number; size?: number }) {
  const src = CHAIN_LOGO[chainId]
  if (!src) return null
  const style = { inlineSize: size, blockSize: size, ...props.style }
  return <img src={src} alt="" style={style} />
}

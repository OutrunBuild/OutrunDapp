import type { SVGProps } from 'react'

// 链图标：Trustwallet assets 官方链 logo（PNG，按 chainId 映射；测试网用各自官方 logo，
// base_sepolia 无独立目录时回落 base 主网 logo）
const CHAIN_LOGO: Record<number, string> = {
  1: '/chains/ethereum.png',
  11155111: '/chains/sepolia.png',
  8453: '/chains/base.png',
  84532: '/chains/base.png',
  56: '/chains/bnb.png',
  97: '/chains/bnb.png',
}

export function ChainLogoMark({ chainId, size = 16, ...props }: SVGProps<HTMLElement> & { chainId: number; size?: number }) {
  const src = CHAIN_LOGO[chainId]
  if (!src) return null
  const style = { inlineSize: size, blockSize: size, ...props.style }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" style={style} />
}

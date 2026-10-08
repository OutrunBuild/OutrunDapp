'use client'

import { WalletCards } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { Locale } from '@/lib/data/fixture-repository'

import { getCopy } from './copy'
import { useMockWallet } from './mock-wallet'

/**
 * 无用户参与态页级连接 CTA（2026-10-08 用户裁定）：未连接时渲染黄色主行动
 * （连接后随数据卡一并消失——闸门语义的对偶面）。样式=header 钱包钮同款
 * ax-ghost-cta（透明机身+黄描边黄字，hover 通电），水平居中；
 * 点击 = 头部 WalletControl 同一 mock 连接开关（toggle），非链上写操作。
 * 槽位节奏差异走 `className` 修饰档（组合页默认 space-7、推荐页传
 * connect-cta--ref 落卡片 space-6）；Launch 表单 submit 位的同款按钮在
 * create-form 内联（槽位几何不同、不共用本壳）。
 */
export function ConnectWalletCta({
  locale,
  className,
}: {
  locale: Locale
  className?: string
}) {
  const { connected, toggle } = useMockWallet()
  const copy = getCopy(locale)
  if (connected) return null
  return (
    <div className={className ? `connect-cta ${className}` : 'connect-cta'}>
      <Button
        type="button"
        variant="default"
        className="ax-ghost-cta connect-cta__button"
        onClick={toggle}
      >
        <WalletCards data-icon="inline-start" aria-hidden="true" />
        {copy.common.connect}
      </Button>
    </div>
  )
}

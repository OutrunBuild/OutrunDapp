'use client'

import { WalletCards } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { Locale } from '@/lib/data/fixture-repository'

import { getCopy } from './copy'
import { useMockWallet } from './mock-wallet'
import { formatHex } from './signal-ui'

export function WalletControl({ locale, address }: { locale: Locale; address: string }) {
  const { connected, toggle } = useMockWallet()
  const copy = getCopy(locale)

  return (
    <Button
      type="button"
      size="default"
      /* 皮肤=黄色幽灵主 CTA（2026-10-08 用户裁定：与首页 Explore Communities
         同款 ax-ghost-cta；variant 随全站该范式走 default 档） */
      className="wallet-control ax-ghost-cta"
      aria-pressed={connected}
      /* 极窄档（≤18.75rem）label span 被 CSS 隐藏转纯图标——aria-label 承接可访问名
         （display:none 文本不进 acc name；与可见文本同串，常规档零行为差异） */
      aria-label={connected ? formatHex(address) : copy.common.connect}
      onClick={toggle}
    >
      <WalletCards data-icon="inline-start" aria-hidden="true" />
      {connected ? (
        <span className="wallet-control__connected">
          <span>{formatHex(address)}</span>
        </span>
      ) : (
        <>
          <span className="wallet-control__label-full">{copy.common.connect}</span>
          <span className="wallet-control__label-short">{copy.common.connectShort}</span>
        </>
      )}
    </Button>
  )
}

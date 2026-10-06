'use client'

import { WalletCards } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { Locale } from '@/lib/data/fixture-repository'

import { getCopy } from './copy'
import { useMockWallet } from './mock-wallet'

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function WalletControl({ locale, address }: { locale: Locale; address: string }) {
  const { connected, toggle } = useMockWallet()
  const copy = getCopy(locale)

  return (
    <Button
      type="button"
      variant="outline"
      size="default"
      className="wallet-control"
      aria-pressed={connected}
      /* 极窄档（≤18.75rem）label span 被 CSS 隐藏转纯图标——aria-label 承接可访问名
         （display:none 文本不进 acc name；与可见文本同串，常规档零行为差异） */
      aria-label={connected ? truncateAddress(address) : copy.common.connect}
      onClick={toggle}
    >
      <WalletCards data-icon="inline-start" aria-hidden="true" />
      {connected ? (
        <span className="wallet-control__connected">
          <span>{truncateAddress(address)}</span>
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

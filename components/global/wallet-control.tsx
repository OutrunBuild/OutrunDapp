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
      onClick={toggle}
    >
      <WalletCards data-icon="inline-start" aria-hidden="true" />
      {connected ? (
        <span className="wallet-control__connected">
          <span className="status-dot" data-tone="success" aria-hidden="true" />
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

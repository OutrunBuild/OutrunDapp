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
      /* Skin = yellow ghost primary CTA — the same ax-ghost-cta
         as the home page's Explore Communities; the variant follows the site-wide
         pattern's default tier */
      className="wallet-control ax-ghost-cta"
      aria-pressed={connected}
      /* At the ultra-narrow tier (≤18.75rem) the label span is CSS-hidden into a pure
         icon — the aria-label carries the accessible name
         (display:none text does not enter the acc name; same string as the visible
         text, so zero behavior difference in the normal tier) */
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

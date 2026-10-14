'use client'

import { WalletCards } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { Locale } from '@/lib/data/fixture-repository'

import { getCopy } from './copy'
import { useMockWallet } from './mock-wallet'

/**
 * Page-level connect CTA for the no-user-participation state:
 * renders the yellow primary action while disconnected (vanishes together with the
 * data cards once connected — the dual face of the gate semantics). Styling = same
 * ax-ghost-cta as the header wallet button (transparent body + yellow border and
 * yellow text, powered up on hover), horizontally centered;
 * clicking = the same mock connect toggle as the header WalletControl (toggle), not
 * an on-chain write.
 * Slot rhythm differences go through `className` modifier tiers (portfolio page
 * defaults to space-7; the referral page passes connect-cta--ref to sit in-card at
 * space-6); the same-style button at the Launch form's submit slot is inlined in
 * create-form (different slot geometry, does not share this shell).
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

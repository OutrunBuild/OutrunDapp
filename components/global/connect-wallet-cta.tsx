'use client'

import Link from 'next/link'
import { WalletCards } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { Locale } from '@/lib/data/fixture-repository'

import { getCopy } from './copy'
import { useLiveParticipations } from './live-participations'
import { localePath } from './routes'
import { useAccountCenter } from './use-account-center'

/**
 * Page-level connect CTA for the no-user-participation state:
 * renders the yellow primary action while disconnected (vanishes together with the
 * data cards once connected — the dual face of the gate semantics). Styling = same
 * ax-ghost-cta as the header wallet button (transparent body + yellow border and
 * yellow text, powered up on hover), horizontally centered;
 * clicking = the account-center connect action (harness toggle in fixture/e2e builds,
 * wallet selector onchain), not an on-chain write.
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
  const { connected, connectAction } = useAccountCenter()
  const copy = getCopy(locale)
  if (connected) return null
  return (
    <div className={className ? `connect-cta ${className}` : 'connect-cta'}>
      <Button
        type="button"
        variant="default"
        className="ax-ghost-cta connect-cta__button"
        onClick={connectAction}
      >
        <WalletCards data-icon="inline-start" aria-hidden="true" />
        {copy.common.connect}
      </Button>
    </div>
  )
}

/**
 * Connected-but-empty counterpart of the connect CTA: when the wallet
 * is connected yet every portfolio zone is empty, the page keeps exactly one action — jump to
 * the discovery page. Same shell/skin as ConnectWalletCta (centered ax-ghost-cta); the page
 * mounts it only in the all-zones-empty state, so data present ⇒ not rendered. The onchain
 * build's zone data is client-only (wallet-provider scan), so the live participations
 * presence counts toward "not empty" too — SSR hasZoneData cannot see it.
 */
export function ExploreCta({ locale }: { locale: Locale }) {
  const { connected } = useAccountCenter()
  const liveParticipations = useLiveParticipations()
  const copy = getCopy(locale).portfolio
  if (!connected || liveParticipations) return null
  // Discovery's no-match pattern lifted into the page slot: .empty-state + h3 + lg ghost CTA
  return (
    <div className="empty-state pf-explore-empty">
      <h3>{copy.exploreNote}</h3>
      <Button
        className="ax-ghost-cta"
        size="lg"
        nativeButton={false}
        render={<Link href={localePath(locale, '/memeverse/explore')} />}
      >
        {copy.exploreCta}
      </Button>
    </div>
  )
}

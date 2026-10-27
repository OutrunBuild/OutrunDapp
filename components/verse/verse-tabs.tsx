'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

import type { Locale } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export type VerseTabKey = 'liquidity' | 'pol' | 'vault' | 'dao' | 'claim'

/**
 * Five-tab container: Locked/Unlocked detail page = head card (=Overview) + trade desk +
 * Liquidity/POL/Yield Vault/DAO/Claim Center. Panels are passed in as RSC children; this
 * component only toggles visibility. The claim tab carries a live count badge (rendered by
 * the page inside the claim-center provider; absent when nothing is claimable).
 * initialTab=URL ?tab= deep link (passed in after server-side whitelist validation): used as
 * the controlled initial value, and on mount it scrolls
 * the tab area into view — otherwise the viewport stays at the page top and the tab switch
 * is invisible.
 */
export function VerseTabs({
  locale,
  children,
  initialTab,
  claimBadge,
}: {
  locale: Locale
  children: Record<VerseTabKey, ReactNode>
  initialTab?: VerseTabKey
  /** Claim-count badge node for the fifth tab item (null = plain tab) */
  claimBadge?: ReactNode
}) {
  const copy = getCopy(locale).verseDesk
  const [tab, setTab] = useState<VerseTabKey>(initialTab ?? 'liquidity')
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!initialTab) return
    // Deep-link positioning: async blocks like chart canvas/fonts/images pushing in will shift
    // the layout above, so a single scrollIntoView
    // gets pushed away — a ResizeObserver watches document height changes and realigns on each;
    // it detaches after 3.5s to avoid fighting scrolling forever.
    // behavior must be explicit instant: the global html{scroll-behavior:smooth} resolves auto
    // into a smooth animation (per-frame/per-attempt restarts only crawl slowly); explicit
    // instant keeps later client tab switches from fighting the deep-link scroll
    const section = sectionRef.current
    if (!section) return
    const start = performance.now()
    const align = () => section.scrollIntoView({ block: 'start', behavior: 'instant' })
    align()
    const ro = new ResizeObserver(() => {
      if (performance.now() - start < 3500) align()
    })
    ro.observe(document.body)
    return () => ro.disconnect()
  }, [initialTab])

  return (
    <section ref={sectionRef} className="verse-tabs ax-glow-card" aria-label={copy.tabLiquidity}>
      <ToggleGroup
        className="verse-tabs__bar"
        value={[tab]}
        onValueChange={(value) => {
          if (value[0]) setTab(value[0] as VerseTabKey)
        }}
      >
        <ToggleGroupItem value="liquidity">{copy.tabLiquidity}</ToggleGroupItem>
        <ToggleGroupItem value="pol">{copy.tabPol}</ToggleGroupItem>
        <ToggleGroupItem value="vault">{copy.tabVault}</ToggleGroupItem>
        <ToggleGroupItem value="dao">{copy.tabDao}</ToggleGroupItem>
        <ToggleGroupItem value="claim">
          {copy.tabClaim}
          {claimBadge}
        </ToggleGroupItem>
      </ToggleGroup>
      <div className="verse-tabs__panel" data-tab={tab}>
        {children[tab]}
      </div>
    </section>
  )
}

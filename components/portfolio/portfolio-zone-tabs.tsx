'use client'

/**
 * Mobile zone tab deck: below ≤54rem, a four-segment bar sticky under the top bar
 * (to-do / assets / positions / participations; three when there are no to-dos), showing one
 * zone at a time; the KPI signal band
 * yields to tab badges at narrow viewports (the "summary as navigation" semantics is unchanged,
 * counts stay permanently visible with the tabs). Desktop ≥54rem: the tab bar is display:none
 * and the four zones show sequentially in full (spacing rhythm unified, see globals.css) — the
 * deck is only a layout wrapper, adding one transparent block to
 * the DOM hierarchy with zero visual change.
 * All zones stay resident in the DOM (RSC straight-out); without JS no zone is hidden (graceful
 * degradation); #pf-* in-page anchors inside the deck (the vault signpost card CTA etc.) may
 * target hidden zones — a native anchor cannot scroll without a box in the layout, so the deck
 * takes over as zone switch + scroll into place; page-head KPI anchors sit outside the deck and
 * keep native behavior.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'

import type { Locale } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export type PfZoneKey = 'action' | 'money' | 'positions' | 'participations'

/** #pf-* anchor → owning zone */
const ANCHOR_ZONES: Record<string, PfZoneKey> = {
  'pf-actions': 'action',
  'pf-assets': 'money',
  'pf-savings': 'money',
  'pf-positions': 'positions',
  'pf-vault': 'positions',
  'pf-participations': 'participations',
}

export function PortfolioZoneTabs({
  locale,
  initialZone,
  hasAction,
  badges,
  children,
}: {
  locale: Locale
  initialZone: PfZoneKey
  hasAction: boolean
  badges: { action: number; participations: number }
  children: Record<PfZoneKey, ReactNode>
}) {
  const copy = getCopy(locale).portfolio.tabs
  const [zone, setZone] = useState<PfZoneKey>(initialZone)
  // data-js lands in the DOM only after mount: SSR/no-JS output lacks it, so the CSS zone hiding
  // never takes effect
  const [js, setJs] = useState(false)
  const deckRef = useRef<HTMLDivElement>(null)
  useEffect(() => setJs(true), [])

  // Scroll after zone switch: a double rAF waits for React's commit before positioning (the
  // scroll-margin sticky offset lives on the CSS side)
  const reveal = (next: PfZoneKey, target?: Element | null) => {
    setZone(next)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        ;(
          target ?? deckRef.current?.querySelector(`[data-zone-wrap='${next}']`)
        )?.scrollIntoView({ block: 'start' })
      })
    })
  }

  // In-page anchor takeover: if the target zone is hidden, the native anchor jump is a no-op
  useEffect(() => {
    if (!js) return
    const deck = deckRef.current
    if (!deck) return
    const onClick = (event: Event) => {
      const anchor = (event.target as HTMLElement | null)?.closest?.("a[href^='#pf-']")
      if (!anchor) return
      const id = (anchor as HTMLAnchorElement).getAttribute('href')?.slice(1)
      if (!id) return
      const next = ANCHOR_ZONES[id]
      const target = id ? document.getElementById(id) : null
      if (!next || !target) return
      event.preventDefault()
      reveal(next, target)
    }
    deck.addEventListener('click', onClick)
    return () => deck.removeEventListener('click', onClick)
  }, [js])

  return (
    <div className="pf-deck" ref={deckRef} data-zone={zone} data-js={js || undefined}>
      <nav className="pf-zone-tabs" aria-label={copy.group}>
        <ToggleGroup
          className="pf-zone-tabs__bar"
          value={[zone]}
          onValueChange={(value) => {
            if (value[0]) reveal(value[0] as PfZoneKey)
          }}
        >
          {hasAction ? (
            <ToggleGroupItem value="action">
              {copy.action}
              {badges.action > 0 ? (
                <strong className="pf-zone-tabs__badge" data-tone="warning" data-numeric>
                  {badges.action}
                </strong>
              ) : null}
            </ToggleGroupItem>
          ) : null}
          <ToggleGroupItem value="money">{copy.money}</ToggleGroupItem>
          <ToggleGroupItem value="positions">{copy.positions}</ToggleGroupItem>
          <ToggleGroupItem value="participations">
            {copy.participations}
            {badges.participations > 0 ? (
              <strong className="pf-zone-tabs__badge" data-tone="success" data-numeric>
                {badges.participations}
              </strong>
            ) : null}
          </ToggleGroupItem>
        </ToggleGroup>
      </nav>
      {hasAction ? <div data-zone-wrap="action">{children.action}</div> : null}
      <div data-zone-wrap="money" className="pf-zone-group">
        {children.money}
      </div>
      {/* Positions/participations share the desktop tail group but each holds a mobile tab — the
          outer group is kept; the inner sub grid gap uses the same step as the group gap (step
          chosen per breakpoint, see globals.css) */}
      <div className="pf-zone-group pf-deck__tail">
        <div data-zone-wrap="positions" className="pf-zone-sub">
          {children.positions}
        </div>
        <div data-zone-wrap="participations" className="pf-zone-sub">
          {children.participations}
        </div>
      </div>
    </div>
  )
}

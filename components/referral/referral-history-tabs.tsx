'use client'

import { useState, type ReactNode } from 'react'

import type { Locale } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export type ReferralTabKey = 'transactions' | 'friends'

/**
 * Referral history dual-tab container (industry-consensus tab pattern): reuses the .verse-tabs
 * card shell and the full-width tab header grammar (yellow text + a 3px bottom-edge indicator
 * bar); the Friends tab tail carries a referral count. The two panel tables are rendered by RSC
 * and passed in via children; this component only toggles visibility (the history view is not a
 * shareable state, same semantics as PortfolioZoneTabs).
 */
export function ReferralHistory({
  locale,
  friendsCount,
  children,
}: {
  locale: Locale
  friendsCount: number
  children: Record<ReferralTabKey, ReactNode>
}) {
  const copy = getCopy(locale).referral
  const [tab, setTab] = useState<ReferralTabKey>('transactions')

  return (
    <section className="verse-tabs ax-glow-card ref-history" aria-label={copy.historyTitle}>
      <ToggleGroup
        className="verse-tabs__bar"
        value={[tab]}
        onValueChange={(value) => {
          if (value[0]) setTab(value[0] as ReferralTabKey)
        }}
      >
        <ToggleGroupItem value="transactions">{copy.tabTransactions}</ToggleGroupItem>
        <ToggleGroupItem value="friends">
          {copy.tabFriends}
          <span className="ref-tabs__count" data-numeric>
            {friendsCount}
          </span>
        </ToggleGroupItem>
      </ToggleGroup>
      <div className="verse-tabs__panel" data-tab={tab}>
        {children[tab]}
      </div>
    </section>
  )
}

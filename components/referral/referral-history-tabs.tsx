'use client'

import { useState, type ReactNode } from 'react'

import type { Locale } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export type ReferralTabKey = 'transactions' | 'friends'

/**
 * 返佣记录双签容器（2026-10-07 v3 恢复：行业共识 tabs 收尾——GMX/Jupiter/demo 同构）：
 * 复用 .verse-tabs 卡壳与通栏页签头语法（黄字 + 3px 底缘指示条），Friends 签尾
 * 带推荐人数计数。两面板表由 RSC 渲染后经 children 传入，本组件只切换显隐
 * （历史视图非可分享状态，PortfolioZoneTabs 同口径）。
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

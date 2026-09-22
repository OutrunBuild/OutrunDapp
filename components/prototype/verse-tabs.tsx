'use client'

import { useState, type ReactNode } from 'react'

import type { Locale } from '@/lib/data/prototype-repository'

import { getCopy } from './copy'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export type VerseTabKey = 'liquidity' | 'pol' | 'vault' | 'dao'

/**
 * 四标签容器（2026-09-23 用户裁定：Locked/Unlocked 详情页 = 头卡(=Overview) + 交易台 +
 * Liquidity/POL/Yield Vault/DAO）。面板以 RSC children 传入，本组件只负责切换显隐。
 */
export function VerseTabs({
  locale,
  children,
}: {
  locale: Locale
  children: Record<VerseTabKey, ReactNode>
}) {
  const copy = getCopy(locale).verseDesk
  const [tab, setTab] = useState<VerseTabKey>('liquidity')

  return (
    <section className="verse-tabs ax-glow-card" aria-label={copy.tabLiquidity}>
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
      </ToggleGroup>
      <div className="verse-tabs__panel" data-tab={tab}>
        {children[tab]}
      </div>
    </section>
  )
}

'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

import type { Locale } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export type VerseTabKey = 'liquidity' | 'pol' | 'vault' | 'dao'

/**
 * 四标签容器（2026-09-23 用户裁定：Locked/Unlocked 详情页 = 头卡(=Overview) + 交易台 +
 * Liquidity/POL/Yield Vault/DAO）。面板以 RSC children 传入，本组件只负责切换显隐。
 * initialTab=URL ?tab= 深链（服务端白名单校验后传入）：作为受控初值，并在挂载时把
 * 页签区滚进视口——否则视口停在页首，切了页签也看不见（2026-10-04 用户裁定跳转落点）。
 */
export function VerseTabs({
  locale,
  children,
  initialTab,
}: {
  locale: Locale
  children: Record<VerseTabKey, ReactNode>
  initialTab?: VerseTabKey
}) {
  const copy = getCopy(locale).verseDesk
  const [tab, setTab] = useState<VerseTabKey>(initialTab ?? 'liquidity')
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!initialTab) return
    // 深链定位：图表 canvas/字体/图片等异步块就位会推移上方布局，单次 scrollIntoView
    // 会被顶走——ResizeObserver 观测文档高度变化、变化即对齐；3.5s 后解除避免永久抢滚动。
    // behavior 必须显式 instant：全局 html{scroll-behavior:smooth} 会把 auto 解析成
    // 平滑动画（逐帧/逐次重启动画只会缓慢爬行）；之后的客户端切换不再抢滚动
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
      </ToggleGroup>
      <div className="verse-tabs__panel" data-tab={tab}>
        {children[tab]}
      </div>
    </section>
  )
}

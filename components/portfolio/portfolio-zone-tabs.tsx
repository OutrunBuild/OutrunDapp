'use client'

/**
 * 移动端分区页签 deck（决议 018）：≤54rem 顶栏下吸顶四分段（待办/资产/仓位/已参与），
 * 一次只显示一个分区；KPI 信号带在窄视口让位页签角标（「摘要即导航」语义不变，
 * 计数随页签常驻可视）。桌面 ≥54rem：页签条 display:none、四分区序贯全显
 * （间距统一节奏 2026-10-08 用户裁定，见 globals.css）——deck 只做布局包装，
 * DOM 层级多一层透明块，视觉零变化。
 * 全部分区常驻 DOM（RSC 直出），无 JS 时不隐藏任何分区（优雅降级）；
 * #pf-* 页内锚点（金库 signpost 卡 CTA 等）目标可能在隐藏分区——无盒模型
 * 原生锚点滚不动，由 deck 接管为换区 + 滚动到位。
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'

import type { Locale } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export type PfZoneKey = 'action' | 'money' | 'positions' | 'participations'

/** #pf-* 锚点 → 所属分区 */
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
  // data-js 只在挂载后落 DOM：SSR/无 JS 输出不带它，CSS 的分区隐藏永不生效
  const [js, setJs] = useState(false)
  const deckRef = useRef<HTMLDivElement>(null)
  useEffect(() => setJs(true), [])

  // 换区后滚动：双 rAF 等 React 提交后再定位（scroll-margin 吸顶偏移在 CSS 侧）
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

  // 页内锚点接管：目标分区若处于隐藏态，原生锚点跳转落空
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
      {/* 仓位/已参与同属桌面尾组，移动端各占一页签——外层组保留，
          内层 sub 网格间隙与组 gap 同档（按断点取档，见 globals.css） */}
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

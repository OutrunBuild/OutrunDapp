'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowDownWideNarrow, ArrowUp, ArrowUpNarrowWide, Search, SlidersHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { degradeToneFor } from '@/lib/prototype/scenario'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  Locale,
  FixtureChain,
  FixtureVerse,
  VerseStage,
} from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { verseHref } from '../global/routes'
import { clearFiltersHref, discoveryHref, stageTabHref } from './discovery-href'
import { EconomyCard } from './economy-card'
import { SORT_OPTIONS_BY_STAGE, sortVerses } from './sort-options'

type GenesisMode = 'all' | 'normal' | 'fast'

type DiscoveryBrowserProps = {
  locale: Locale
  scenario?: string | null,
  verses: FixtureVerse[]
  chains: FixtureChain[]
  initialStage: VerseStage
  initialSort: string
  initialOrder: 'asc' | 'desc'
  initialChain: string
  /** 'fast' = 仅看 Fast Genesis 创世卡；'normal' = 仅看普通模式（无 fastGenesis 标记） */
  initialMode: GenesisMode
  initialQuery: string
}

/** 无限滚动：每批加载体量（=3 列 × 2 行） */
const GRID_BATCH_SIZE = 6

export function DiscoveryBrowser({
  scenario,
  locale,
  verses,
  chains,
  initialStage,
  initialSort,
  initialOrder,
  initialChain,
  initialMode,
  initialQuery,
}: DiscoveryBrowserProps) {
  const copy = getCopy(locale)
  const router = useRouter()
  const pathname = usePathname()
  const [queryInput, setQueryInput] = useState(initialQuery)
  const [pending, startTransition] = useTransition()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [visibleCount, setVisibleCount] = useState(GRID_BATCH_SIZE)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const currentParams = {
    stage: initialStage,
    sort: initialSort,
    order: initialOrder,
    chain: initialChain,
    mode: initialMode,
    q: initialQuery,
  }

  function makeHref(changes: Partial<typeof currentParams>) {
    return discoveryHref(pathname, currentParams, changes)
  }

  const view = scenario ? (scenario as never as import('@/lib/prototype/scenario').ScenarioView) : null
  const tone = view ? degradeToneFor(view) : null
  const dg = copy.common.degrade
  const banner = tone
    ? {
        tone,
        title: tone === 'loading' ? dg.loadingTitle : dg.errorTitle,
        body: tone === 'loading' ? dg.loadingBody : dg.errorBody,
      }
    : null


  function replaceQuery(changes: Partial<typeof currentParams>) {
    setFiltersOpen(false)
    startTransition(() => {
      router.replace(makeHref(changes), { scroll: false })
    })
  }

  const normalizedQuery = initialQuery.trim().toLowerCase()
  // 搜索跨全部阶段（退款社区仅搜索可达：徽章可见、可进详情）；无搜索词按阶段浏览（Refund 非公共浏览态）
  const visibleVerses = sortVerses(
    verses
      .filter((verse) => (normalizedQuery ? true : verse.stage === initialStage))
      .filter((verse) => initialChain === 'all' || String(verse.governanceChain) === initialChain)
      .filter(
        (verse) =>
          initialMode === 'all' ||
          (initialMode === 'fast' ? verse.fastGenesis : !verse.fastGenesis),
      )
      .filter(
        (verse) =>
          !normalizedQuery ||
          verse.name.toLowerCase().includes(normalizedQuery) ||
          verse.symbol.toLowerCase().includes(normalizedQuery) ||
          (verse.memecoinAddress?.toLowerCase().includes(normalizedQuery) ?? false),
      ),
    initialSort,
    initialOrder,
  )

  const shownVerses = visibleVerses.slice(0, visibleCount)
  const hasMore = shownVerses.length < visibleVerses.length

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasMore) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((count) => Math.min(count + GRID_BATCH_SIZE, visibleVerses.length))
        }
      },
      { rootMargin: '320px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, visibleVerses.length])

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 480)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const stageTabs: VerseStage[] = ['genesis', 'locked', 'unlocked']
  // 排序项值集由 SORT_OPTIONS_BY_STAGE 派生（解析端/发射端/下拉三端单源防漂移），标签按 copy 配对
  const sortLabels: Record<string, string> = {
    createtime: copy.discovery.sortCreatetime,
    endtime: copy.discovery.sortEndtime,
    size: copy.discovery.sortSize,
    participants: copy.discovery.sortParticipants,
    progress: copy.discovery.sortProgress,
    unlocktime: copy.discovery.unlockTime,
    volume: copy.discovery.sortVolume,
    marketcap: copy.discovery.marketCap,
    stakingapy: copy.discovery.stakingApy,
    treasury: copy.discovery.treasuryFund,
  }
  const sortItems = SORT_OPTIONS_BY_STAGE[initialStage].map((value) => ({
    value,
    label: sortLabels[value],
  }))
  const chainItems = [
    { value: 'all', label: copy.discovery.allChains },
    ...verses
      .map((verse) => ({ value: String(verse.governanceChain), label: verse.governanceChainName }))
      .filter((item, index, items) => items.findIndex((candidate) => candidate.value === item.value) === index),
  ]
  const modeItems = [
    { value: 'all', label: copy.discovery.allModes },
    { value: 'normal', label: copy.discovery.normalMode },
    { value: 'fast', label: copy.discovery.fastGenesis },
  ]
  const hasActiveFilters =
    initialChain !== 'all' || initialMode !== 'all' || Boolean(initialQuery)

  return (
    <div className="discovery-browser" aria-busy={pending}>
      {banner ? (
        <div className="degrade-banner" data-tone={banner.tone} role={banner.tone === 'error' ? 'alert' : 'status'}>
          {banner.tone === 'loading' ? <span className="degrade-banner__spinner" aria-hidden="true" /> : null}
          <div>
            <strong>{banner.title}</strong>
            <p>{banner.body}</p>
          </div>
        </div>
      ) : null}
      <nav className="lifecycle-tabs" aria-label={copy.discovery.lifecycleLabel}>
        {stageTabs.map((stage) => (
          <Link
            href={stageTabHref(pathname, currentParams, stage)}
            key={stage}
            data-active={initialStage === stage}
            data-stage={stage}
            aria-current={initialStage === stage ? 'page' : undefined}
          >
            <span className="lifecycle-tabs__mark" aria-hidden="true" />
            <strong>{copy.common.stages[stage]}</strong>
          </Link>
        ))}
      </nav>

      {view === 'loading' ? (
        /* 骨架镜像 Locked 阶段 EconomyCard 结构（state-matrix D1「骨架保持结构」）：复用 economy-card*
           类拿到与真实卡零漂移的几何；data-skeleton 关交互并把 stage 变量钉灰阶（不带阶段色，
           2026-10-09 用户裁定——骨架与错误蒙版同为灰黑降级观感） */
        <section className="discovery-results">
          <div className="economy-grid degrade-skeleton" aria-hidden="true">
            {Array.from({ length: GRID_BATCH_SIZE }).map((_, i) => (
              <div className="economy-card" data-skeleton key={i}>
                <div className="economy-card__header">
                  <div className="economy-card__identity">
                    <h3>
                      <span className="degrade-skeleton__line degrade-skeleton__line--ticker" />
                      <span className="degrade-skeleton__line degrade-skeleton__line--name" />
                    </h3>
                  </div>
                  <div className="economy-card__cap">
                    <span className="degrade-skeleton__line degrade-skeleton__line--cap-label" />
                    <span className="degrade-skeleton__line degrade-skeleton__line--cap-value" />
                  </div>
                  <div className="economy-card__badges">
                    <span className="degrade-skeleton__badge" />
                  </div>
                </div>
                <div className="economy-card__media">
                  <span className="economy-card__media-frame">
                    <span className="degrade-skeleton__media-fill" />
                  </span>
                </div>
                <div className="economy-card__body">
                  <p className="economy-card__chains">
                    <span className="degrade-skeleton__line degrade-skeleton__line--chains-label" />
                    <span className="economy-card__chain-icons">
                      {chains.map((chain) => (
                        <span className="degrade-skeleton__chain" key={chain.chainId} />
                      ))}
                    </span>
                  </p>
                  <div className="economy-card__signal">
                    <div className="economy-progress__thresholds">
                      {Array.from({ length: 3 }).map((_, j) => (
                        <div className="economy-progress__item" key={j}>
                          <div>
                            <span className="degrade-skeleton__line degrade-skeleton__line--stat-label" />
                            <span className="degrade-skeleton__line degrade-skeleton__line--stat-value" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <dl className="economy-card__facts">
                  {Array.from({ length: 2 }).map((_, j) => (
                    <div key={j}>
                      <dt>
                        <span className="degrade-skeleton__line degrade-skeleton__line--fact-label" />
                      </dt>
                      <dd>
                        <span className="degrade-skeleton__line degrade-skeleton__line--fact-value" />
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </section>
      ) : (
      <>
      <section className="discovery-tools" aria-label={copy.discovery.filterTitle}>
        <form
          className="discovery-search"
          onSubmit={(event) => {
            event.preventDefault()
            replaceQuery({ q: queryInput.trim() })
          }}
        >
          <Field>
            <FieldLabel className="sr-only" htmlFor="verse-search">
              {copy.discovery.search}
            </FieldLabel>
            <div className="discovery-search__control">
              <Input
                id="verse-search"
                name="verse-search"
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault()
                }}
                placeholder={copy.discovery.searchPlaceholder}
                autoComplete="off"
              />
              <Button type="submit" variant="outline">
                <Search data-icon="inline-start" aria-hidden="true" />
                {copy.discovery.applySearch}
              </Button>
            </div>
          </Field>
        </form>

        <Button
          className="mobile-filter-toggle"
          type="button"
          variant="outline"
          aria-expanded={filtersOpen}
          aria-controls="discovery-filters"
          onClick={() => setFiltersOpen((value) => !value)}
        >
          <SlidersHorizontal data-icon="inline-start" aria-hidden="true" />
          {copy.discovery.filterTitle}
        </Button>

        <div className="discovery-filters" id="discovery-filters" data-open={filtersOpen}>
          {initialStage === 'genesis' ? (
            <Field>
              <FieldLabel className="sr-only" htmlFor="genesis-mode">
                {copy.discovery.mode}
              </FieldLabel>
              <Select
                name="genesis-mode"
                items={modeItems}
                value={initialMode}
                onValueChange={(value) => {
                  const mode = value === 'fast' || value === 'normal' ? value : 'all'
                  replaceQuery({ mode })
                }}
              >
                <SelectTrigger id="genesis-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false} align="start">
                  <SelectGroup>
                    {modeItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          <Field>
            <FieldLabel className="sr-only" htmlFor="governance-chain">
              {copy.discovery.chain}
            </FieldLabel>
            <Select
              name="governance-chain"
              items={chainItems}
              value={initialChain}
              onValueChange={(value) => replaceQuery({ chain: value ?? 'all' })}
            >
              <SelectTrigger id="governance-chain">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} align="start">
                <SelectGroup>
                  {chainItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel className="sr-only" htmlFor="discovery-sort">
              {copy.discovery.sort}
            </FieldLabel>
            <Select
              name="sort"
              items={sortItems}
              value={initialSort}
              onValueChange={(value) => replaceQuery({ sort: value ?? 'createtime' })}
            >
              <SelectTrigger id="discovery-sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} align="start">
                <SelectGroup>
                  {sortItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Button
            className="discovery-order-toggle"
            type="button"
            variant="outline"
            aria-label={initialOrder === 'desc' ? copy.discovery.orderDesc : copy.discovery.orderAsc}
            title={initialOrder === 'desc' ? copy.discovery.orderDesc : copy.discovery.orderAsc}
            onClick={() => replaceQuery({ order: initialOrder === 'desc' ? 'asc' : 'desc' })}
          >
            {initialOrder === 'desc' ? (
              <ArrowDownWideNarrow aria-hidden="true" />
            ) : (
              <ArrowUpNarrowWide aria-hidden="true" />
            )}
          </Button>
          {hasActiveFilters ? (
            <Link
              className="discovery-filters__clear"
              href={clearFiltersHref(pathname, currentParams)}
            >
              {copy.discovery.clear}
            </Link>
          ) : null}
        </div>
      </section>

      <section className="discovery-results">
        {visibleVerses.length > 0 ? (
          <ul className="economy-grid">
            {shownVerses.map((verse) => (
              <li key={verse.id}>
                <EconomyCard
                  locale={locale}
                  verse={verse}
                  chains={chains}
                  onOpen={() => router.push(verseHref(locale, verse.id))}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state">
            <h3>{copy.discovery.emptyTitle}</h3>
            <Button
              className="ax-ghost-cta"
              size="lg"
              nativeButton={false}
              render={<Link href={clearFiltersHref(pathname, currentParams)} />}
            >
              {copy.discovery.clear}
            </Button>
          </div>
        )}
        {shownVerses.length > 0 ? (
          <div ref={sentinelRef} className="economy-grid-sentinel" aria-hidden="true" />
        ) : null}
        {showBackToTop ? (
          <Button
            className="back-to-top"
            type="button"
            variant="outline"
            data-stage={initialStage}
            aria-label={copy.discovery.backToTop}
            title={copy.discovery.backToTop}
            onClick={() =>
              window.scrollTo({
                top: 0,
                behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
              })
            }
          >
            <ArrowUp aria-hidden="true" />
          </Button>
        ) : null}
      </section>
      </>
      )}
    </div>
  )
}

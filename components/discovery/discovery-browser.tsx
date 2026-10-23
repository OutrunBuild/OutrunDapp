'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowDownWideNarrow, ArrowUp, ArrowUpNarrowWide, Search, SlidersHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { degradeToneFor, type ScenarioView } from '../global/scenario-view'
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
import { ChainLogoMark } from '../global/chain-icons'
import { verseHref } from '../global/routes'
import { clearFiltersHref, discoveryHref, nextPageHref, stageTabHref } from './discovery-href'
import { EconomyCard } from './economy-card'
import { SORT_OPTIONS_BY_STAGE, sortVerses } from './sort-options'

type GenesisMode = 'all' | 'normal' | 'fast'

type DiscoveryBrowserProps = {
  locale: Locale
  scenario?: string | null,
  verses: FixtureVerse[]
  chains: FixtureChain[]
  /** all indexed chain ids (filter options; from the page result, never a second pull) */
  chainIds: number[]
  hasMore: boolean
  initialPage: number
  initialStage: VerseStage
  initialSort: string
  initialOrder: 'asc' | 'desc'
  initialChain: string
  /** 'fast' = show only Fast Genesis cards; 'normal' = show only normal mode (no fastGenesis flag) */
  initialMode: GenesisMode
  initialQuery: string
}

/** Infinite scroll: per-batch reveal size (= 3 columns × 2 rows) within the loaded server page */
const GRID_BATCH_SIZE = 6

export function DiscoveryBrowser({
  scenario,
  locale,
  verses,
  chains,
  chainIds,
  hasMore,
  initialPage,
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
    query: initialQuery,
    page: initialPage,
  }

  function makeHref(changes: Partial<typeof currentParams>) {
    return discoveryHref(pathname, currentParams, changes)
  }

  const view = scenario ? (scenario as never as ScenarioView) : null
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

  // Server-side filtering is already applied (stage/chain/mode/query at the data layer);
  // the client only sorts the loaded page (existing sortVerses semantics, single pass).
  const visibleVerses = sortVerses(verses, initialSort, initialOrder)

  // Within-page reveal: show the first batches instantly, reveal more on scroll; crossing
  // the page boundary navigates to ?page=+1 (server renders the next window, scroll preserved)
  const shownVerses = visibleVerses.slice(0, visibleCount)
  const pageExhausted = shownVerses.length >= visibleVerses.length
  const nextHref = hasMore && pageExhausted ? nextPageHref(pathname, currentParams) : null

  useEffect(() => {
    const node = sentinelRef.current
    if (!node) return
    if (nextHref) {
      router.prefetch(nextHref)
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            startTransition(() => {
              router.replace(nextHref, { scroll: false })
            })
          }
        },
        { rootMargin: '320px 0px' },
      )
      observer.observe(node)
      return () => observer.disconnect()
    }
    if (!pageExhausted) {
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
    }
    return undefined
  }, [nextHref, pageExhausted, visibleVerses.length, router])

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 480)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const stageTabs: VerseStage[] = ['genesis', 'locked', 'unlocked']
  // The sort option value set is derived from SORT_OPTIONS_BY_STAGE (single source for parser /
  // emitter / dropdown to prevent drift); labels are paired via copy
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
  // Chain options come from the page result's indexed id set (static TESTNETS onchain,
  // governance chains in fixture) so spoke chains stay selectable
  const chainItems = chainIds
    .map((id) => ({
      value: String(id),
      label: chains.find((chain) => chain.chainId === id)?.name ?? String(id),
    }))
    .filter((item, index, items) => items.findIndex((candidate) => candidate.value === item.value) === index)
  const modeItems = [
    { value: 'all', label: copy.discovery.allModes },
    { value: 'normal', label: copy.discovery.normalMode },
    { value: 'fast', label: copy.discovery.fastGenesis },
  ]
  const hasActiveFilters = initialMode !== 'all' || Boolean(initialQuery)

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
        /* The skeleton mirrors the Locked-stage EconomyCard structure: reusing the economy-card*
           classes yields geometry with zero drift from real cards; data-skeleton disables
           interaction and pins stage variables to grayscale (no stage colors — skeleton and error
           mask share the same gray-black degraded look) */
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
                      {chains
                        .filter((chain) => chain.env === 'mainnet')
                        .map((chain) => (
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
          autoComplete="off"
          onSubmit={(event) => {
            event.preventDefault()
            replaceQuery({ query: queryInput.trim(), page: 1 })
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
                  replaceQuery({ mode, page: 1 })
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
              onValueChange={(value) => replaceQuery({ chain: value ?? String(chainIds[0] ?? ''), page: 1 })}
            >
              <SelectTrigger id="governance-chain">
                {/* Chain identity rides the trigger too: official logo + name */}
                <SelectValue>
                  {(value: string | null) => {
                    const item = chainItems.find((candidate) => candidate.value === value)
                    return (
                      <>
                        {item ? <ChainLogoMark chainId={Number(item.value)} size={16} /> : null}
                        {item?.label ?? ''}
                      </>
                    )
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} align="start">
                <SelectGroup>
                  {chainItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      <ChainLogoMark chainId={Number(item.value)} size={16} />
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

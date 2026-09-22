'use client'

import { Fragment, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowDownWideNarrow, ArrowUp, ArrowUpNarrowWide, Search, SlidersHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
  PrototypeChain,
  PrototypeVerse,
  VerseStage,
} from '@/lib/data/prototype-repository'

import { getCopy } from './copy'
import { ChainLogoMark } from './chain-icons'
import { verseHref } from './routes'
import {
  formatAmount,
  formatMarketCap,
  formatPercent,
  formatStamp,
  FastBadge,
  StageBadge,
} from './signal-ui'

type GenesisMode = 'all' | 'normal' | 'fast'

type DiscoveryBrowserProps = {
  locale: Locale
  verses: PrototypeVerse[]
  chains: PrototypeChain[]
  initialStage: VerseStage
  initialSort: string
  initialOrder: 'asc' | 'desc'
  initialChain: string
  /** 'fast' = 仅看 Fast Mode 创世卡；'normal' = 仅看普通模式（无 fastGenesis 标记） */
  initialMode: GenesisMode
  initialQuery: string
}

function progressValue(verse: PrototypeVerse) {
  return Math.max(verse.normalProgress, verse.leverageProgress)
}

function boundedProgress(value: number) {
  return Math.min(Math.max(value, 0), 100)
}

/** 治理链在前，其余主网链按 fixture 白名单顺序跟随（omnichain 部署面） */
function omnichainChains(verse: PrototypeVerse, chains: PrototypeChain[]) {
  return [
    ...chains.filter((chain) => chain.chainId === verse.governanceChain),
    ...chains.filter((chain) => chain.chainId !== verse.governanceChain),
  ]
}

/** 无限滚动：每批加载体量（=3 列 × 2 行） */
const GRID_BATCH_SIZE = 6

export function DiscoveryBrowser({
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
    const next = { ...currentParams, ...changes }
    const params = new URLSearchParams()
    params.set('stage', next.stage)
    params.set('sort', next.sort)
    if (next.order !== 'desc') params.set('order', next.order)
    if (next.chain !== 'all') params.set('chain', next.chain)
    if (next.mode !== 'all') params.set('mode', next.mode)
    if (next.q) params.set('q', next.q)
    return `${pathname}?${params.toString()}`
  }

  function replaceQuery(changes: Partial<typeof currentParams>) {
    setFiltersOpen(false)
    startTransition(() => {
      router.replace(makeHref(changes), { scroll: false })
    })
  }

  const normalizedQuery = initialQuery.trim().toLowerCase()
  const direction = initialOrder === 'asc' ? 1 : -1
  // 搜索跨全部阶段（退款社区仅搜索可达：徽章可见、可进详情）；无搜索词按阶段浏览（Refund 非公共浏览态）
  const visibleVerses = verses
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
        verse.symbol.toLowerCase().includes(normalizedQuery),
    )
    .toSorted((a, b) => {
      if (initialSort === 'endtime') return direction * (Date.parse(a.endsAt) - Date.parse(b.endsAt))
      if (initialSort === 'participants')
        return direction * (a.participantCount - b.participantCount)
      if (initialSort === 'progress') return direction * (progressValue(a) - progressValue(b))
      if (initialSort === 'createtime')
        return direction * (Date.parse(a.createdAt) - Date.parse(b.createdAt))
      return direction * (a.participationSize - b.participationSize)
    })

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
  const sortItems = [
    { value: 'createtime', label: copy.discovery.sortCreatetime },
    { value: 'endtime', label: copy.discovery.sortEndtime },
    { value: 'size', label: copy.discovery.sortSize },
    { value: 'participants', label: copy.discovery.sortParticipants },
    { value: 'progress', label: copy.discovery.sortProgress },
  ]
  const chainItems = [
    { value: 'all', label: copy.discovery.allChains },
    ...verses
      .map((verse) => ({ value: String(verse.governanceChain), label: verse.governanceChainName }))
      .filter((item, index, items) => items.findIndex((candidate) => candidate.value === item.value) === index),
  ]
  const modeItems = [
    { value: 'all', label: copy.discovery.allModes },
    { value: 'normal', label: copy.discovery.normalMode },
    { value: 'fast', label: copy.discovery.fastMode },
  ]
  const hasActiveFilters =
    initialChain !== 'all' || initialMode !== 'all' || Boolean(initialQuery)

  function primarySignal(verse: PrototypeVerse) {
    const marketTvl = verse.markets.reduce((sum, market) => sum + market.tvl, 0)

    if (verse.stage === 'genesis') {
      const thresholdSignals = [
        { label: copy.discovery.normal, value: verse.normalProgress },
        { label: copy.discovery.leverage, value: verse.leverageProgress },
      ]

      return (
        <>
          <div className="economy-card__signal">
            <span className="economy-card__signal-label">{copy.discovery.progress}</span>
            <div className="economy-progress__thresholds">
              {thresholdSignals.map((signal, index) => (
                <Fragment key={signal.label}>
                  {index > 0 ? (
                    <span className="economy-progress__or">{copy.discovery.thresholdOr}</span>
                  ) : null}
                  <div className="economy-progress__item">
                    <div>
                      <span>{signal.label}</span>
                      <b data-numeric>{formatPercent(signal.value, locale)}%</b>
                    </div>
                    <span
                      className="economy-progress__track"
                      role="progressbar"
                      aria-label={signal.label}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(boundedProgress(signal.value))}
                    >
                      <span style={{ inlineSize: `${boundedProgress(signal.value)}%` }} />
                    </span>
                  </div>
                </Fragment>
              ))}
            </div>
          </div>
          <div className="economy-meter">
            <div className="economy-progress__item">
              <div>
                <span>{copy.discovery.preorderCapacity}</span>
                <b data-numeric>{formatPercent(verse.preorderProgress, locale)}%</b>
              </div>
              <span
                className="economy-progress__track"
                role="progressbar"
                aria-label={copy.discovery.preorderCapacity}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(boundedProgress(verse.preorderProgress))}
              >
                <span style={{ inlineSize: `${boundedProgress(verse.preorderProgress)}%` }} />
              </span>
            </div>
          </div>
        </>
      )
    }

    if (verse.stage === 'unlocked') {
      return (
        <div className="economy-card__signal">
          <span className="economy-card__signal-label">{copy.discovery.livePrice}</span>
          {verse.currentPrice === null ? (
            <strong>{copy.discovery.unavailable}</strong>
          ) : (
            <div className="economy-card__price">
              <strong data-numeric>{formatAmount(verse.currentPrice, locale)}</strong>
              <span data-direction={(verse.change24h ?? 0) >= 0 ? 'up' : 'down'} data-numeric>
                {(verse.change24h ?? 0) >= 0 ? '+' : ''}
                {formatPercent(verse.change24h ?? 0, locale)}%
              </span>
            </div>
          )}
        </div>
      )
    }

    if (verse.stage === 'locked') {
      return (
        <div className="economy-card__signal">
          <span className="economy-card__signal-label">{copy.discovery.poolLiquidity}</span>
          <strong data-numeric>
            {formatAmount(marketTvl, locale, true)} <small>{verse.raiseAsset}</small>
          </strong>
          <span className="economy-card__signal-note">
            {verse.markets.length} {copy.discovery.marketCount}
          </span>
        </div>
      )
    }

    return (
      <div className="economy-card__signal">
        <span className="economy-card__signal-label">{copy.discovery.returningCapital}</span>
        <strong data-numeric>
          {formatAmount(verse.participationSize, locale, true)} <small>{verse.raiseAsset}</small>
        </strong>
        <span className="economy-card__signal-note">{copy.discovery.refundSignal}</span>
      </div>
    )
  }

  return (
    <div className="discovery-browser" aria-busy={pending}>
      <nav className="lifecycle-tabs" aria-label={copy.discovery.lifecycleLabel}>
        {stageTabs.map((stage) => (
          <Link
            href={makeHref({ stage, sort: 'createtime' })}
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
          <Field>
            <FieldLabel className="sr-only">{copy.discovery.mode}</FieldLabel>
            <Select
              name="genesis-mode"
              items={modeItems}
              value={initialMode}
              onValueChange={(value) => {
                const mode = value === 'fast' || value === 'normal' ? value : 'all'
                replaceQuery({ mode })
              }}
            >
              <SelectTrigger>
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
          <Field>
            <FieldLabel className="sr-only">{copy.discovery.chain}</FieldLabel>
            <Select
              name="governance-chain"
              items={chainItems}
              value={initialChain}
              onValueChange={(value) => replaceQuery({ chain: value ?? 'all' })}
            >
              <SelectTrigger>
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
            <FieldLabel className="sr-only">{copy.discovery.sort}</FieldLabel>
            <Select
              name="sort"
              items={sortItems}
              value={initialSort}
              onValueChange={(value) => replaceQuery({ sort: value ?? 'createtime' })}
            >
              <SelectTrigger>
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
            <Link className="discovery-filters__clear" href={makeHref({ chain: 'all', mode: 'all', q: '' })}>
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
                <article
                  className="economy-card"
                  data-stage={verse.stage}
                  onClick={(event) => {
                    const target = event.target as HTMLElement
                    if (target.closest('a, button, [role="button"], input, select, textarea')) return
                    if (window.getSelection()?.toString()) return
                    router.push(verseHref(locale, verse.id))
                  }}
                >
                  <header className="economy-card__header">
                    <div className="economy-card__identity">
                      <h3>
                        <Link href={verseHref(locale, verse.id)}>
                          <strong className="ax-glitch-text">{verse.symbol}</strong> {verse.name}
                        </Link>
                      </h3>
                    </div>
                    {verse.projectedMarketCap != null ? (
                      <div className="economy-card__cap">
                        <span>{copy.discovery.marketCap}</span>
                        <b data-numeric>${formatMarketCap(verse.projectedMarketCap)}</b>
                      </div>
                    ) : null}
                    <div className="economy-card__badges">
                      {verse.stage === 'genesis' && verse.fastGenesis ? (
                        <FastBadge label={copy.discovery.fastMode} />
                      ) : null}
                      <StageBadge stage={verse.stage} locale={locale} />
                    </div>
                  </header>

                  <Link
                    className="economy-card__media"
                    href={verseHref(locale, verse.id)}
                    aria-label={verse.name}
                  >
                    <span className="economy-card__media-frame">
                      <img src={`/verses/${verse.id}.svg`} alt="" loading="lazy" />
                    </span>
                  </Link>
                  <div className="economy-card__body">
                    <p className="economy-card__chains">
                      <span>{copy.discovery.omnichain}</span>
                      <span className="economy-card__chain-icons">
                        {omnichainChains(verse, chains).map((chain) => (
                          <Tooltip key={chain.chainId}>
                            <TooltipTrigger render={<span className="economy-card__chain" />}>
                              <ChainLogoMark chainId={chain.chainId} size={16} />
                            </TooltipTrigger>
                            <TooltipContent>{chain.name}</TooltipContent>
                          </Tooltip>
                        ))}
                      </span>
                    </p>

                    {primarySignal(verse)}
                  </div>

                  <dl className="economy-card__facts">
                    <div>
                      <dt>{copy.discovery.totalRaised}</dt>
                      <dd data-numeric>
                        {formatAmount(verse.participationSize, locale, true)} {verse.raiseAsset}
                      </dd>
                    </div>
                    <div>
                      <dt>{copy.discovery.genesisEndtime}</dt>
                      <dd data-numeric>
                        {formatStamp(verse.endsAt)} UTC+8
                      </dd>
                    </div>
                  </dl>
                </article>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state">
            <h3>{copy.discovery.emptyTitle}</h3>
            <Button
              className="ax-glow-cta"
              size="lg"
              nativeButton={false}
              render={<Link href={`${pathname}?stage=genesis&sort=createtime`} />}
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
    </div>
  )
}

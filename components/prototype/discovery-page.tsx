import {
  getPrototypeChains,
  getPrototypeSnapshot,
  type Locale,
  type VerseStage,
} from '@/lib/data/prototype-repository'

import { OutrunShell } from './app-shell'
import { getCopy } from './copy'
import { DiscoveryBrowser } from './discovery-browser'
import { LayoutNotes, SourceRef } from './signal-ui'

type QueryValue = string | string[] | undefined

type DiscoveryPageProps = {
  locale: Locale
  searchParams: Record<string, QueryValue>
}

function first(value: QueryValue) {
  return Array.isArray(value) ? value[0] : value
}

export function DiscoveryPage({ locale, searchParams }: DiscoveryPageProps) {
  const snapshot = getPrototypeSnapshot()
  const mainnetChains = getPrototypeChains().filter((chain) => chain.env === 'mainnet')
  const copy = getCopy(locale)
  const stageValue = first(searchParams.stage)
  const stage = ['genesis', 'locked', 'unlocked'].includes(stageValue ?? '')
      ? (stageValue as VerseStage)
      : 'genesis'
  const defaultSort = 'createtime'
  const sortValue = first(searchParams.sort)
  const sort = ['createtime', 'endtime', 'size', 'participants', 'progress'].includes(sortValue ?? '')
    ? sortValue!
    : defaultSort
  const orderValue = first(searchParams.order)
  const order = orderValue === 'asc' ? 'asc' : 'desc'
  const chainValue = first(searchParams.chain)
  const availableChains = new Set(snapshot.verses.map((verse) => String(verse.governanceChain)))
  const chain = chainValue && availableChains.has(chainValue) ? chainValue : 'all'
  const modeValue = first(searchParams.mode)
  const mode = modeValue === 'fast' || modeValue === 'normal' ? modeValue : 'all'
  const query = first(searchParams.q)?.slice(0, 80) ?? ''

  return (
    <OutrunShell
      locale={locale}
      current="discover"
      accountAddress={snapshot.sampleAccount.address}
    >
      <header className="discovery-intro">
        <div>
          <h1 className="ax-fault-title">
            {copy.discovery.title}
            <span
              className="ax-fault-title__chroma"
              data-dup={copy.discovery.title}
              aria-hidden="true"
            />
            <span
              className="ax-fault-title__rip"
              data-dup={copy.discovery.title}
              aria-hidden="true"
            />
          </h1>
          <p>{copy.discovery.sub}</p>
        </div>
        <SourceRef value="docs/page-briefs/memeverse-discovery.md#2" />
      </header>
      <DiscoveryBrowser
        key={`${stage}-${sort}-${order}-${chain}-${mode}-${query}`}
        locale={locale}
        verses={snapshot.verses}
        chains={mainnetChains}
        initialStage={stage}
        initialSort={sort}
        initialOrder={order}
        initialChain={chain}
        initialMode={mode}
        initialQuery={query}
      />
      <LayoutNotes locale={locale} items={copy.discovery.notes} />
    </OutrunShell>
  )
}

import {
  getChainVersePage,
  getChains,
  getDisplayAccount,
  type Locale,
  type VerseStage,
} from '@/lib/data/fixture-repository'

import { applyScenarioToVerses, parseScenarioParam } from '../global/scenario-view'

import { OutrunShell } from '../global/app-shell'
import { getCopy } from '../global/copy'
import { DiscoveryBrowser } from './discovery-browser'
import { DISCOVERY_PAGE_SIZE } from './discovery-href'
import { legalSortForStage } from './sort-options'
import { LayoutNotes, SourceRef } from '../global/signal-ui'

type QueryValue = string | string[] | undefined

type DiscoveryPageProps = {
  locale: Locale
  searchParams: Record<string, QueryValue>
}

function first(value: QueryValue) {
  return Array.isArray(value) ? value[0] : value
}

export async function DiscoveryPage({ locale, searchParams }: DiscoveryPageProps) {
  const scenario = parseScenarioParam(first(searchParams.scenario))
  const displayAccount = await getDisplayAccount()
  // Full chain table: onchain cards resolve their registered (testnet) omnichain ids against
  // it; the fixture-mode card face and the browser skeleton filter to the mainnet trio locally
  const chains = await getChains()
  const copy = getCopy(locale)
  const stageValue = first(searchParams.stage)
  const stage = ['genesis', 'locked', 'unlocked'].includes(stageValue ?? '')
      ? (stageValue as VerseStage)
      : 'genesis'
  const sort = legalSortForStage(stage, first(searchParams.sort) ?? '')
  const orderValue = first(searchParams.order)
  const order = orderValue === 'asc' ? 'asc' : 'desc'
  const modeValue = first(searchParams.mode)
  // Mode filter applies only to the genesis stage: other stages ignore
  // mode, preventing hidden filtering
  const mode = stage === 'genesis' && (modeValue === 'fast' || modeValue === 'normal') ? modeValue : 'all'
  const query = first(searchParams.query)?.slice(0, 80) ?? ''
  // Server-side page: stage/mode/query filter at the data layer (subgraph where clause onchain,
  // in-memory slice in fixture), so server memory and the RSC payload stay bounded at any verse
  // volume. Sort/order stay client-side (existing sortVerses semantics, unchanged).
  const pageValue = Math.max(1, Math.floor(Number(first(searchParams.page))) || 1)
  const pageFilter = {
    ...(query ? {} : { stage }),
    ...(mode === 'all' ? {} : { fastGenesis: mode === 'fast' }),
    ...(query ? { query } : {}),
  }
  // Chain resolution against the static option set first (zero reads): the page read
  // then serves the selected chain's window plus the same option set for the filter.
  const chainIdsProbe = await getChainVersePage(0, pageFilter, 1, 0)
  const chainIds = chainIdsProbe?.chainIds ?? []
  const chainValue = first(searchParams.chain)
  const chainId =
    chainValue && chainIds.includes(Number(chainValue))
      ? Number(chainValue)
      : (chainIds[0] ?? 0)
  const page =
    chainId === 0
      ? { rows: [], total: 0, hasMore: false, chainIds }
      : await getChainVersePage(
          chainId,
          pageFilter,
          DISCOVERY_PAGE_SIZE,
          (pageValue - 1) * DISCOVERY_PAGE_SIZE,
        )
  const verses = applyScenarioToVerses(page.rows, scenario)

  return (
    <OutrunShell
      locale={locale}
      current="discover"
      accountAddress={displayAccount.address}
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
        key={`${stage}-${sort}-${order}-${chainId}-${mode}-${query}-${pageValue}-${scenario ?? ''}`}
        scenario={scenario}
        locale={locale}
        verses={verses}
        chains={chains}
        chainIds={chainIds}
        hasMore={page.hasMore}
        initialPage={pageValue}
        initialStage={stage}
        initialSort={sort}
        initialOrder={order}
        initialChain={String(chainId)}
        initialMode={mode}
        initialQuery={query}
      />
      <LayoutNotes locale={locale} items={copy.discovery.notes} />
    </OutrunShell>
  )
}

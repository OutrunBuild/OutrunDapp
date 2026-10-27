/**
 * (4) Participations zone: stage-grouped panels + row-style list —
 * rows follow the same ledger
 * rhythm as asset rows: tile visual anchor / identity + breakdown line (unit inline "15.25K POL",
 * zeros omitted) / right-edge main number + date subline / end-of-row action; the claimable
 * green number = the holdings row's main number, the locked row's subline = projected unlock
 * date (genesis deadline + 365d fixed lockup, a contract
 * constant). The claimable filter = in-component client-state buttons
 * (URL navigation would cause a full page refresh, same precedent as the
 * positions-zone chain filter); actions deep-link to the verse detail:
 * claim actions deep-link to each row's own verse.
 */
'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { formatUnits, type Hex } from 'viem'

import type { ParticipationRow, Locale, VerseStage } from '@/lib/data/fixture-repository'
import { erc20ReadAbi, launcherAbi, polendAbi } from '@/lib/web3/abis'

import { getCopy } from '../global/copy'
import { publishLiveParticipations } from '../global/live-participations'
import { parseVerseIdParam, verseHref } from '../global/routes'
import { formatAmount, formatDay, SectionHeading, StageBadge } from '../global/signal-ui'
import { useAccountCenter } from '../global/use-account-center'
import { useWalletProviderReader } from '../global/wallet-provider-reader'

const GROUP_ORDER: VerseStage[] = ['genesis', 'locked', 'unlocked']

/** viem multicall with allowFailure wraps every entry as {status, result}: a reverted leg
 *  unwraps to null so one bad verse skips its row instead of poisoning the whole scan */
function multicallLeg(entry: { status: string; result?: unknown } | undefined): unknown {
  return entry?.status === 'success' && entry.result !== undefined ? entry.result : null
}

/** uAsset decimals by token address: token metadata is deployment-stable, so one on-chain read
 *  per token serves every later scan — steady-state scan pays a single ledger round */
const uAssetDecimalsCache = new Map<string, number>()

/** Breakdown line: unit inline, zeros omitted (LP = four-pool total not shown);
 *  returns null when all zero */
function MakeupLine({
  locale,
  holdings,
}: {
  locale: Locale
  holdings: NonNullable<ParticipationRow['holdings']>
}) {
  const parts: string[] = []
  if (holdings.pol != null && holdings.pol > 0)
    parts.push(`${formatAmount(holdings.pol, locale, true)} POL`)
  if (holdings.pt != null && holdings.pt > 0)
    parts.push(`${formatAmount(holdings.pt, locale, true)} PT`)
  if (holdings.yt != null && holdings.yt > 0)
    parts.push(`${formatAmount(holdings.yt, locale, true)} YT`)
  if (parts.length === 0) return null
  return <span className="pf-participation-row__makeup">{parts.join(' · ')}</span>
}

function ParticipationRow({ locale, row }: { locale: Locale; row: ParticipationRow }) {
  const copy = getCopy(locale).portfolio.participations
  const href = verseHref(locale, row.verse.id)
  const claimable = row.holdings?.claimableYt ?? 0

  // Right-edge main number: genesis = participation amount; holdings = claimable YT (success
  // green); nothing claimable = -- (same language as a zero holdings value)
  const state =
    row.genesis != null ? (
      <span className="pf-participation-row__amount">
        {formatAmount(row.genesis.total, locale, true)}
        <span className="pf-participation-row__unit">{row.verse.raiseAsset}</span>
      </span>
    ) : claimable > 0 ? (
      <span className="pf-claimable">
        <span className="pf-participation-row__amount">
          +{formatAmount(claimable, locale, true)}
          <span className="pf-participation-row__unit">YT</span>
        </span>
      </span>
    ) : (
      <span className="pf-participation-row__none" aria-hidden="true">
        --
      </span>
    )

  // Date subline: locked = projected unlock date (deadline + 365d); none for genesis and
  // unlocked rows
  const dateLine =
    row.verse.stage === 'locked' ? (
      <span className="pf-participation-row__date">
        {copy.unlocksOn.replace('{d}', formatDay(row.verse.unlockAt, locale))}
      </span>
    ) : null

  // Breakdown line: genesis = deadline date; holdings = POL/PT/YT breakdown
  const makeup =
    row.holdings != null ? (
      <MakeupLine locale={locale} holdings={row.holdings} />
    ) : (
      <span className="pf-participation-row__note">
        {copy.endsOn.replace('{d}', formatDay(row.verse.endsAt, locale))}
      </span>
    )

  const cta = claimable > 0 ? copy.claim : copy.manage

  return (
    <li className="pf-participation-row">
      <span className="pf-participation-row__tile" aria-hidden="true">
        <span className="pf-participation-row__glyph">{row.verse.symbol[0]}</span>
      </span>
      <div className="pf-participation-row__id">
        <Link href={href} className="pf-participation-row__verse">
          <strong>{row.verse.symbol}</strong>
          {row.genesis != null ? (
            <span className="pf-participations__flags">
              {row.genesis.stakeRoute ? (
                <span className="pf-participations__flag">{copy.routeStake}</span>
              ) : null}
              {row.genesis.leverage > 0 ? (
                <span className="pf-participations__flag">{copy.kindLeverage}</span>
              ) : null}
              {row.genesis.preorder > 0 ? (
                <span className="pf-participations__flag">{copy.kindPreorder}</span>
              ) : null}
            </span>
          ) : null}
        </Link>
        {makeup}
      </div>
      <div className="pf-participation-row__state">
        {state}
        {dateLine}
      </div>
      <div className="pf-participation-row__action">
        <Link href={href} className="pf-table__link">
          {cta}
        </Link>
      </div>
    </li>
  )
}

/** Genesis-stage verse head for the client-side participation scan (onchain builds: the
 *  connected wallet's legs read through the wallet provider on the wallet's current chain) */
export type ParticipationCandidate = ParticipationRow['verse'] & { execChain: number }

export function ParticipationsZone({
  locale,
  rows,
  candidates,
}: {
  locale: Locale
  /** SSR sample rows (participations fixture; empty on onchain builds) */
  rows: ParticipationRow[]
  /** Genesis-stage verse heads eligible for the live scan (empty legs never render rows) */
  candidates: ParticipationCandidate[]
}) {
  const copy = getCopy(locale).portfolio.participations
  const [claimableOnly, setClaimableOnly] = useState(false)
  const center = useAccountCenter()
  const real = center.source === 'real'
  const walletReady = real && center.connected && center.address != null && center.chainId != null
  const providerReader = useWalletProviderReader(walletReady ? (center.chainId as number) : null)
  const [liveRows, setLiveRows] = useState<ParticipationRow[] | null>(null)
  // Focus re-read: participations confirmed elsewhere (verse page in this tab included) bump
  // the on-chain ledgers without remounting this zone.
  const [readNonce, setReadNonce] = useState(0)

  useEffect(() => {
    if (!walletReady || providerReader == null) return
    const onFocus = () => {
      if (document.visibilityState === 'visible') setReadNonce((nonce) => nonce + 1)
    }
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
    }
  }, [walletReady, providerReader])

  // Live scan (onchain builds): the wallet's genesis legs for every genesis-stage verse on the
  // wallet's current chain — one ledger multicall round (4 reads per verse); the decimals round
  // only runs for uAssets missing from the session cache (steady state = one round trip), never
  // one RPC per verse per read.
  useEffect(() => {
    if (!walletReady || providerReader == null) return
    const account = center.address as Hex
    const chainId = center.chainId as number
    const launcher = providerReader.addresses.MemeverseLauncher as Hex | undefined
    const polend = providerReader.addresses.POLend as Hex | undefined
    if (!launcher || !polend) return
    const scoped = candidates
      .map((head) => ({ head, id: parseVerseIdParam(head.id) }))
      .filter((entry) => entry.id != null && entry.head.execChain === chainId)
    if (scoped.length === 0) {
      setLiveRows([])
      publishLiveParticipations(false)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const ledgerCalls = scoped.flatMap(({ id }) => {
          const verseId = BigInt(id as string)
          return [
            { address: launcher, abi: launcherAbi, functionName: 'userGenesisData', args: [verseId, account] },
            { address: launcher, abi: launcherAbi, functionName: 'userPreorderData', args: [verseId, account] },
            { address: polend, abi: polendAbi, functionName: 'totalInterestPaid', args: [verseId, account] },
            { address: launcher, abi: launcherAbi, functionName: 'getUAssetByVerseId', args: [verseId] },
          ]
        })
        const ledgerResults = (await providerReader.client.multicall({
          contracts: ledgerCalls,
          allowFailure: true,
        })) as Array<{ status: string; result?: unknown }>
        const uAssetByVerse = scoped.map((_, index) => multicallLeg(ledgerResults[index * 4 + 3]))
        const uniqueUAssets = [
          ...new Set(
            uAssetByVerse.filter(
              (value): value is string => typeof value === 'string' && value.startsWith('0x'),
            ),
          ),
        ]
        const uncachedAssets = uniqueUAssets.filter((address) => !uAssetDecimalsCache.has(address))
        if (uncachedAssets.length > 0) {
          const decimalsResults = (await providerReader.client.multicall({
            contracts: uncachedAssets.map((address) => ({
              address: address as Hex,
              abi: erc20ReadAbi,
              functionName: 'decimals',
            })),
            allowFailure: true,
          })) as Array<{ status: string; result?: unknown }>
          uncachedAssets.forEach((address, index) => {
            const value = multicallLeg(decimalsResults[index])
            if (typeof value === 'number') uAssetDecimalsCache.set(address, value)
          })
        }
        const next: ParticipationRow[] = []
        scoped.forEach(({ head }, index) => {
          const genesis = multicallLeg(ledgerResults[index * 4]) as [bigint, boolean, boolean] | null
          const preorder = multicallLeg(ledgerResults[index * 4 + 1]) as [bigint, bigint, boolean] | null
          const interest = multicallLeg(ledgerResults[index * 4 + 2]) as bigint | null
          const uAsset = uAssetByVerse[index]
          if (!genesis || !preorder || interest == null || typeof uAsset !== 'string') return
          const decimals = uAssetDecimalsCache.get(uAsset)
          if (decimals == null) return
          const normal = Number(formatUnits(genesis[0], decimals))
          const leverage = Number(formatUnits(interest, decimals))
          const preorderAmount = Number(formatUnits(preorder[0], decimals))
          const total = normal + leverage + preorderAmount
          if (total <= 0) return
          next.push({
            verse: head,
            // stakeRoute is not derivable on-chain (the ledger records uAsset regardless of the
            // pay route) — the stake badge stays a fixture-sample marker
            genesis: { total, normal, leverage, preorder: preorderAmount, stakeRoute: false },
            holdings: null,
          })
        })
        next.sort((a, b) => a.verse.id.localeCompare(b.verse.id))
        if (!cancelled) {
          setLiveRows(next)
          publishLiveParticipations(next.length > 0)
        }
      } catch {
        // wholesale read failure → keep the list hidden (no fabricated rows)
        if (!cancelled) {
          setLiveRows(null)
          publishLiveParticipations(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [walletReady, center.address, center.chainId, providerReader, candidates, readNonce])

  const displayRows = !real ? rows : (liveRows ?? [])
  const rowsToRender = displayRows
  const claimableCount = rowsToRender.filter((row) => (row.holdings?.claimableYt ?? 0) > 0).length
  const visible = claimableOnly
    ? rowsToRender.filter((row) => (row.holdings?.claimableYt ?? 0) > 0)
    : rowsToRender

  const filterToggle = claimableCount > 0 && (
    <nav className="pf-participations__filter" aria-label={copy.filterClaimable}>
      <button
        type="button"
        aria-pressed={!claimableOnly}
        data-selected={!claimableOnly || undefined}
        onClick={() => setClaimableOnly(false)}
      >
        {copy.filterAll}
      </button>
      <button
        type="button"
        aria-pressed={claimableOnly}
        data-selected={claimableOnly || undefined}
        onClick={() => setClaimableOnly(true)}
      >
        {`${copy.filterClaimable} (${claimableCount})`}
      </button>
    </nav>
  )

  // An empty participation list renders nothing — no empty-state card
  if (rowsToRender.length === 0) return null

  return (
    <section className="pf-participations" id="pf-participations">
      <SectionHeading title={copy.title} description={copy.sub} aside={filterToggle} />
      <div className="pf-participations__groups">
        {GROUP_ORDER.map((stage) => {
          const group = visible.filter((row) => row.verse.stage === stage)
          if (group.length === 0) return null
          return (
            <div key={stage} className="pf-participations__group" data-stage={stage}>
              {/* Panelization: material/shadow follow the .pf-panel primitive; the stage line =
                  the panel's first child element */}
              <div className="pf-panel">
                <i className="pf-participations__stage-line" aria-hidden="true" />
                <header className="pf-participations__group-head">
                  <StageBadge stage={stage} locale={locale} />
                  <span data-numeric>{group.length}</span>
                </header>
                <ul className="pf-participations__list">
                  {group.map((row) => (
                    <ParticipationRow key={row.verse.id} locale={locale} row={row} />
                  ))}
                </ul>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

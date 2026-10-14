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
import { useState } from 'react'

import type { FixtureParticipationRow, Locale, VerseStage } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { localePath, verseHref } from '../global/routes'
import { formatAmount, formatDay, SectionHeading, StageBadge } from '../global/signal-ui'
import { Button } from '@/components/ui/button'

const GROUP_ORDER: VerseStage[] = ['genesis', 'locked', 'unlocked']

/** Breakdown line: unit inline, zeros omitted (LP = four-pool total not shown);
 *  returns null when all zero */
function MakeupLine({
  locale,
  holdings,
}: {
  locale: Locale
  holdings: NonNullable<FixtureParticipationRow['holdings']>
}) {
  const parts: string[] = []
  if (holdings.pol > 0) parts.push(`${formatAmount(holdings.pol, locale, true)} POL`)
  if (holdings.pt > 0) parts.push(`${formatAmount(holdings.pt, locale, true)} PT`)
  if (holdings.yt > 0) parts.push(`${formatAmount(holdings.yt, locale, true)} YT`)
  if (parts.length === 0) return null
  return <span className="pf-participation-row__makeup">{parts.join(' · ')}</span>
}

function ParticipationRow({ locale, row }: { locale: Locale; row: FixtureParticipationRow }) {
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

export function ParticipationsZone({ locale, rows }: { locale: Locale; rows: FixtureParticipationRow[] }) {
  const copy = getCopy(locale).portfolio.participations
  const [claimableOnly, setClaimableOnly] = useState(false)
  const claimableCount = rows.filter((row) => (row.holdings?.claimableYt ?? 0) > 0).length
  const visible = claimableOnly
    ? rows.filter((row) => (row.holdings?.claimableYt ?? 0) > 0)
    : rows

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

  if (rows.length === 0) {
    return (
      <section className="pf-participations" id="pf-participations">
        <SectionHeading title={copy.title} description={copy.sub} />
        <div className="empty-state">
          <h3>{copy.empty}</h3>
          <Button
            className="ax-ghost-cta"
            nativeButton={false}
            render={<Link href={localePath(locale, '/memeverse/explore')} />}
          >
            {copy.emptyCta}
          </Button>
        </div>
      </section>
    )
  }

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

import Link from 'next/link'

import {
  getPrototypeParticipations,
  getPrototypeSnapshot,
  type Locale,
} from '@/lib/data/prototype-repository'

import { Button } from '@/components/ui/button'
import { OutrunShell } from './app-shell'
import { getCopy } from './copy'
import { verseHref } from './routes'
import { formatAmount, formatStamp, StageBadge } from './signal-ui'

export function PortfolioPage({ locale }: { locale: Locale }) {
  const snapshot = getPrototypeSnapshot()
  const participations = getPrototypeParticipations()
  const copy = getCopy(locale)

  // 退款区块只服务「参与过且已进入退款」的组合：一个社区一行（各参与类型合并为合计），零项不渲染
  const refundRows = [...new Set(participations.map((p) => p.verseId))]
    .map((verseId) => {
      const verse = snapshot.verses.find((candidate) => candidate.id === verseId)
      const rows = participations.filter((participation) => participation.verseId === verseId)
      return verse && verse.stage === 'refund'
        ? { verse, total: rows.reduce((sum, row) => sum + row.amount, 0) }
        : null
    })
    .filter((row): row is { verse: (typeof snapshot.verses)[number]; total: number } => row !== null)

  return (
    <OutrunShell
      locale={locale}
      current="portfolio"
      accountAddress={snapshot.sampleAccount.address}
      accountSourceRef={snapshot.sampleAccount.sourceRef}
    >
      <header className="page-intro">
        <div>
          <h1>{copy.portfolio.title}</h1>
          <p>{copy.portfolio.sub}</p>
        </div>
      </header>

      {refundRows.length > 0 ? (
        <section className="portfolio-refunds" aria-labelledby="portfolio-refund-title">
          <h2 id="portfolio-refund-title">{copy.portfolio.refundTitle}</h2>
          <p className="portfolio-refunds__sub">{copy.portfolio.refundSub}</p>
          <ul className="portfolio-refunds__list">
            {refundRows.map(({ verse, total }) => (
              <li key={verse.id}>
                <article className="portfolio-refunds__row">
                  <div className="portfolio-refunds__identity">
                    <h3>
                      <Link href={verseHref(locale, verse.id)}>
                        <strong>{verse.symbol}</strong> {verse.name}
                      </Link>
                    </h3>
                    <StageBadge stage={verse.stage} locale={locale} />
                  </div>
                  <dl className="portfolio-refunds__facts">
                    <div>
                      <dt>{copy.portfolio.participated}</dt>
                      <dd data-numeric>
                        {formatAmount(total, locale, true)} {verse.raiseAsset}
                      </dd>
                    </div>
                    <div>
                      <dt>{copy.discovery.genesisEndtime}</dt>
                      <dd data-numeric>
                        {formatStamp(verse.endsAt)} <small>UTC+8</small>
                      </dd>
                    </div>
                  </dl>
                  <Button
                    className="portfolio-refunds__cta ax-ghost-cta"
                    nativeButton={false}
                    render={<Link href={verseHref(locale, verse.id)} />}
                  >
                    {copy.portfolio.refundCta}
                  </Button>
                </article>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </OutrunShell>
  )
}

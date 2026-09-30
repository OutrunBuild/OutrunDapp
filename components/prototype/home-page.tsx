import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DiscordIcon, GitHubIcon, TelegramIcon, XIcon } from '@/components/prototype/brand-icons'
import { getPrototypeSnapshot, type Locale } from '@/lib/data/prototype-repository'

import { OutrunShell } from './app-shell'
import { getCopy } from './copy'
import { MechanismPrimer } from './mechanism-primer'
import { localePath } from './routes'
import { VerseLifecycle } from './verse-lifecycle'
import { formatAmount, SourceRef } from './signal-ui'

const OUTRUN_BOOK_URL = 'https://github.com/OutrunBuild/OutrunBook'
const OUTRUN_GITHUB_URL = 'https://github.com/OutrunBuild'

function SiteFooter({ locale }: { locale: Locale }) {
  const copy = getCopy(locale)

  return (
    <footer className="site-footer">
      <div className="site-footer__main">
        <div className="site-footer__identity">
          <Link className="site-footer__brand" href={localePath(locale, '')} aria-label={copy.common.home}>
            <Image
              className="site-footer__wordmark"
              src="/brand/BRAND-01-wordmark-transparent.png"
              width={2048}
              height={527}
              alt="Outrun"
            />
          </Link>
          <p className="site-footer__statement">{copy.home.footerStatement}</p>
        </div>

        <nav className="site-footer__group" aria-labelledby="footer-protocol-title">
          <h2 id="footer-protocol-title">{copy.home.footerProtocolLabel}</h2>
          <Link href={localePath(locale, '/memeverse/explore')}>{copy.common.discover}</Link>
          <a href="#engines">{copy.common.mechanisms}</a>
          <a href="#lifecycle">{copy.common.lifecycle}</a>
        </nav>

        <nav className="site-footer__group" aria-labelledby="footer-resources-title">
          <h2 id="footer-resources-title">{copy.home.footerResourcesLabel}</h2>
          <a href={OUTRUN_BOOK_URL} target="_blank" rel="noreferrer">
            {copy.common.docs}
            <ExternalLink aria-hidden="true" />
          </a>
          <a href={OUTRUN_GITHUB_URL} target="_blank" rel="noreferrer">
            GitHub
            <ExternalLink aria-hidden="true" />
          </a>
        </nav>
      </div>

      <div className="site-footer__bottom">
        <span>&copy; 2026 Outrun &middot; {copy.home.footerTagline}</span>
        <nav className="site-footer__social" aria-label="Social links">
          <a href="https://x.com" target="_blank" rel="noreferrer" aria-label="X (Twitter)">
            <XIcon />
          </a>
          <a href="https://discord.com" target="_blank" rel="noreferrer" aria-label="Discord">
            <DiscordIcon />
          </a>
          <a href="https://t.me" target="_blank" rel="noreferrer" aria-label="Telegram">
            <TelegramIcon />
          </a>
          <a href={OUTRUN_GITHUB_URL} target="_blank" rel="noreferrer" aria-label="GitHub">
            <GitHubIcon />
          </a>
        </nav>
      </div>
    </footer>
  )
}

export function HomePage({ locale }: { locale: Locale }) {
  const snapshot = getPrototypeSnapshot()
  const copy = getCopy(locale)
  const kpi = copy.home.kpiBand

  return (
    <OutrunShell
      locale={locale}
      current="home"
      accountAddress={snapshot.sampleAccount.address}
    >
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero__copy">
          <h1 id="home-title">
            <span className="home-hero__title-lead">{copy.home.titleLead}</span>
            <span className="home-hero__title-accent">{copy.home.titleAccent}</span>
          </h1>
          <p className="home-hero__sub">{copy.home.sub}</p>
          <div className="home-hero__actions">
            <Button
              className="ax-ghost-cta"
              size="lg"
              nativeButton={false}
              render={<Link href={`${localePath(locale, '/memeverse/explore')}?stage=genesis`} />}
            >
              {copy.home.primaryCta}
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Button>
          </div>
        </div>
        <section className="home-proof-band" aria-label={kpi.label}>
          <div className="home-proof-band__item">
            <span>{kpi.tvl}</span>
            <strong data-numeric="true">{formatAmount(snapshot.homeMetrics.totalLocked, locale, true)}</strong>
          </div>
          <div className="home-proof-band__item">
            <span>{kpi.memecoins}</span>
            <strong data-numeric="true">{snapshot.homeMetrics.deployedVerseCount}</strong>
          </div>
          <div className="home-proof-band__item">
            <span>{kpi.users}</span>
            <strong data-numeric="true">{snapshot.homeMetrics.participantCount}</strong>
          </div>
        </section>
      </section>

      <section className="home-section" id="engines" aria-labelledby="engines-title">
        <header className="home-section__heading">
          <h2 id="engines-title">{copy.home.enginesTitle}</h2>
          <p>{copy.home.enginesSub}</p>
        </header>
        <div className="home-engine-strip">
          {copy.home.engines.map((engine) => (
            <article className="home-engine" key={engine.title}>
              <h3>{engine.title}</h3>
              <p>{engine.description}</p>
              <span>{engine.note}</span>
            </article>
          ))}
        </div>
      </section>

      <MechanismPrimer content={copy.home.mechanism} />

      <VerseLifecycle content={copy.home.lifecycle} />

      <section className="home-final-cta" aria-labelledby="final-cta-title">
        <div>
          <h2 id="final-cta-title">{copy.home.finalTitle}</h2>
          <p>{copy.home.finalBody}</p>
        </div>
        <div className="home-final-cta__actions">
          <Button
            className="ax-ghost-cta"
            size="lg"
            nativeButton={false}
            render={<Link href={localePath(locale, '/memeverse/explore')} />}
          >
            {copy.home.primaryCta}
            <ArrowRight data-icon="inline-end" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            nativeButton={false}
            render={<a href={OUTRUN_BOOK_URL} target="_blank" rel="noreferrer" />}
          >
            {copy.home.docsCta}
            <ExternalLink data-icon="inline-end" aria-hidden="true" />
          </Button>
        </div>
      </section>

      <SiteFooter locale={locale} />
    </OutrunShell>
  )
}

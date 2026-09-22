import { ArrowDown, MoveRight } from 'lucide-react'

type MechanismSource = {
  title: string
  description: string
}

type MechanismRight = {
  term: string
  title: string
  description: string
}

type MechanismFeeRoute = {
  asset: string
  destination: string
  description: string
}

type MechanismContent = {
  title: string
  subtitle: string
  capitalLabel: string
  sources: readonly MechanismSource[]
  pools: {
    term: string
    title: string
    description: string
  }
  pol: {
    term: string
    title: string
    description: string
  }
  splitLabel: string
  rights: readonly MechanismRight[]
  preorder: {
    term: string
    title: string
    description: string
  }
  feesTitle: string
  feesSubtitle: string
  feeRoutes: readonly MechanismFeeRoute[]
}

export function MechanismPrimer({ content }: { content: MechanismContent }) {
  return (
    <section className="home-section home-mechanism" id="mechanism" aria-labelledby="mechanism-title">
      <header className="home-section__heading">
        <h2 id="mechanism-title">{content.title}</h2>
        <p>{content.subtitle}</p>
      </header>

      <div className="home-mechanism__map">
        <div className="home-mechanism__capital">
          <div className="home-mechanism__sources">
            <strong>{content.capitalLabel}</strong>
            {content.sources.map((source) => (
              <article key={source.title}>
                <h3>{source.title}</h3>
                <p>{source.description}</p>
              </article>
            ))}
          </div>

          <span className="home-mechanism__connector" aria-hidden="true">
            <MoveRight className="home-mechanism__connector-icon" data-dir="h" />
            <ArrowDown className="home-mechanism__connector-icon" data-dir="v" />
          </span>

          <article className="home-mechanism__pools">
            <span>{content.pools.term}</span>
            <h3>{content.pools.title}</h3>
            <p>{content.pools.description}</p>
          </article>

          <span className="home-mechanism__connector" aria-hidden="true">
            <MoveRight className="home-mechanism__connector-icon" data-dir="h" />
            <ArrowDown className="home-mechanism__connector-icon" data-dir="v" />
          </span>

          <div className="home-mechanism__rights">
            <article className="home-mechanism__pol">
              <span>{content.pol.term}</span>
              <h3>{content.pol.title}</h3>
              <p>{content.pol.description}</p>
            </article>
            <span className="home-mechanism__split">{content.splitLabel}</span>
            <dl>
              {content.rights.map((right) => (
                <div key={right.term}>
                  <dt>{right.term}</dt>
                  <dd>
                    <strong>{right.title}</strong>
                    <span>{right.description}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <article className="home-mechanism__preorder">
          <span>{content.preorder.term}</span>
          <h3>{content.preorder.title}</h3>
          <p>{content.preorder.description}</p>
        </article>

        <div className="home-mechanism__fees">
          <header>
            <h3>{content.feesTitle}</h3>
            <p>{content.feesSubtitle}</p>
          </header>
          <dl>
            {content.feeRoutes.map((route) => (
              <div key={route.asset}>
                <dt>{route.asset}</dt>
                <MoveRight aria-hidden="true" className="home-mechanism__route-arrow size-4" />
                <dd>
                  <strong>{route.destination}</strong>
                  <span>{route.description}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}

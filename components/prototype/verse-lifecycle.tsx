type LifecycleBranch = {
  label: string
  title: string
  description: string
}

type LifecycleStage = {
  tone: string
  title: string
  meta: string
  description: string
  signalTitle: string
  signals: readonly string[]
  branch?: LifecycleBranch
}

type LifecycleContent = {
  title: string
  subtitle: string
  railLabel: string
  stages: readonly LifecycleStage[]
}

export function VerseLifecycle({ content }: { content: LifecycleContent }) {
  return (
    <section className="home-section verse-lifecycle" id="lifecycle" aria-labelledby="lifecycle-title">
      <header className="home-section__heading">
        <h2 id="lifecycle-title">{content.title}</h2>
        <p>{content.subtitle}</p>
      </header>

      <div className="verse-lifecycle__canvas">
        <ol className="verse-lifecycle__rail" aria-label={content.railLabel}>
          {content.stages.map((stage, index) => (
            <li className={`verse-lifecycle__step verse-lifecycle__step--${stage.tone}`} key={stage.title}>
              <article className="verse-lifecycle__summary">
                <span className="verse-lifecycle__meta">{stage.meta}</span>
                <h3>{stage.title}</h3>
                <p>{stage.description}</p>
              </article>

              <span className="verse-lifecycle__node" aria-hidden="true">
                <span data-numeric>{String(index + 1).padStart(2, '0')}</span>
              </span>

              <div className="verse-lifecycle__signals">
                <strong>{stage.signalTitle}</strong>
                <ul>
                  {stage.signals.map((signal) => (
                    <li key={signal}>{signal}</li>
                  ))}
                </ul>
                {stage.branch ? (
                  <aside className="verse-lifecycle__branch">
                    <span>{stage.branch.label}</span>
                    <strong>{stage.branch.title}</strong>
                    <p>{stage.branch.description}</p>
                  </aside>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </div>

    </section>
  )
}

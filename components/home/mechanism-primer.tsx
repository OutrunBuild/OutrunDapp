import { MoveRight } from 'lucide-react'

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
    title: string
    description: string
  }
  feesTitle: string
  feesSubtitle: string
  feeRoutes: readonly MechanismFeeRoute[]
  phaseLabels: {
    participation: string
    pools: string
    rights: string
  }
  operationNote: string
}

/**
 * 机制段 = 竖向走线图（2026-10-01 用户裁定）。
 * 同一条流程的两个渲染方向：≥54rem 三列横排（01|02|03 + 04 通栏），<54rem 纵向走线。
 * 符号语法：主线=中性 1px（CSS 画，无箭头字符）；阶段=mono 网络标签（序号由位置生成）；
 * 节点=mono 序号方块（骑在主线上，兼作接点）；分叉/分流=品红 1px 短枝（品红只染转化时刻，
 * 双线签名留给 lifecycle/壳层）。内容行统一 chip→品红箭头→目标标题＋第二行说明 语法
 * （04 费用行；创世预购行例外：无铭牌无箭头，标题即名称，2026-10-06 用户裁定）；
 * <54rem 行转纵向走线（chip→下向箭头→目标标题→说明，箭头由 CSS rotate 承担）。
 * pol/rights 键形状不可动：home-page.tsx 将其作为术语表传给 lifecycle 段 TermGlossText。
 */
export function MechanismPrimer({ content }: { content: MechanismContent }) {
  const { phaseLabels } = content

  return (
    <section className="home-section home-mechanism" id="mechanism" aria-labelledby="mechanism-title">
      <header className="home-section__heading">
        <h2 id="mechanism-title">{content.title}</h2>
        <p>{content.subtitle}</p>
      </header>

      <ol className="home-mechanism__flow">
        <li className="home-mechanism__phase" data-phase="participation">
          <span className="home-mechanism__index" aria-hidden="true">
            01
          </span>
          <div className="home-mechanism__body">
            <p className="home-mechanism__net-label">{phaseLabels.participation}</p>
            <p className="home-mechanism__capital">{content.capitalLabel}</p>
            <div className="home-mechanism__entries">
              {content.sources.map((source) => (
                <article key={source.title} className="home-mechanism__entry">
                  <h3>{source.title}</h3>
                  <p>{source.description}</p>
                </article>
              ))}
            </div>
          </div>
        </li>

        <li className="home-mechanism__phase" data-phase="pools">
          <span className="home-mechanism__index" aria-hidden="true">
            02
          </span>
          <div className="home-mechanism__body">
            <p className="home-mechanism__net-label">{phaseLabels.pools}</p>
            <span className="home-mechanism__term">{content.pools.term}</span>
            <h3>{content.pools.title}</h3>
            <p className="home-mechanism__desc">{content.pools.description}</p>
            {/* 预购=主池开放时的机制事件，归位到 02（原 DOM 孤悬在 YT 与费用之间）；
                无铭牌无行箭头——黄色「预购」chip 已删（2026-10-06 用户裁定），标题「创世预购」即名称，
                箭头无指向物（同日裁定） */}
            <div className="home-mechanism__row">
              <strong className="home-mechanism__row-title">{content.preorder.title}</strong>
              <span className="home-mechanism__row-desc">{content.preorder.description}</span>
            </div>
          </div>
        </li>

        <li className="home-mechanism__phase" data-phase="rights">
          <span className="home-mechanism__index" aria-hidden="true">
            03
          </span>
          <div className="home-mechanism__body">
            <p className="home-mechanism__net-label">{phaseLabels.rights}</p>
            <span className="home-mechanism__term">{content.pol.term}</span>
            <h3>{content.pol.title}</h3>
            <p className="home-mechanism__desc">{content.pol.description}</p>
            <p className="home-mechanism__split-label">{content.splitLabel}</p>
            <ul className="home-mechanism__fork" data-fork="split">
              {content.rights.map((right) => (
                <li key={right.term} className="home-mechanism__branch">
                  <span className="home-mechanism__branch-term">{right.term}</span>
                  <strong>{right.title}</strong>
                  <span>{right.description}</span>
                </li>
              ))}
            </ul>
          </div>
        </li>

        <li className="home-mechanism__phase" data-phase="operation">
          <span className="home-mechanism__index" aria-hidden="true">
            04
          </span>
          <div className="home-mechanism__body">
            {/* 03→04 是时序接续（手续费来自交易）而非因果，标注如实声明；04 不设网络标签（2026-10-06 用户裁定） */}
            <p className="home-mechanism__relay">{content.operationNote}</p>
            <h3>{content.feesTitle}</h3>
            <p className="home-mechanism__desc">{content.feesSubtitle}</p>
            <ul className="home-mechanism__fork" data-fork="routes">
              {content.feeRoutes.map((route) => (
                <li key={route.asset} className="home-mechanism__branch home-mechanism__row">
                  <span className="home-mechanism__row-chip">{route.asset}</span>
                  <MoveRight aria-hidden="true" className="home-mechanism__route-arrow size-4" />
                  <strong className="home-mechanism__row-title">{route.destination}</strong>
                  <span className="home-mechanism__row-desc">{route.description}</span>
                </li>
              ))}
            </ul>
          </div>
        </li>
      </ol>
    </section>
  )
}

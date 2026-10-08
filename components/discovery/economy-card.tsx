import { Fragment } from 'react'
import Link from 'next/link'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Locale, FixtureChain, FixtureVerse } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { ChainLogoMark } from '../global/chain-icons'
import { verseHref } from '../global/routes'
import {
  formatAmount,
  formatMarketCap,
  formatPercent,
  formatStamp,
  FastBadge,
  StageBadge,
} from '../global/signal-ui'

type EconomyCardProps = {
  locale: Locale
  verse: FixtureVerse
  chains: FixtureChain[]
  /** 整卡点开进详情；router.push 留在 DiscoveryBrowser 单点 */
  onOpen: () => void
}

function boundedProgress(value: number) {
  return Math.min(Math.max(value, 0), 100)
}

/** 治理链在前，其余主网链按 fixture 白名单顺序跟随（omnichain 部署面） */
function omnichainChains(verse: FixtureVerse, chains: FixtureChain[]) {
  return [
    ...chains.filter((chain) => chain.chainId === verse.governanceChain),
    ...chains.filter((chain) => chain.chainId !== verse.governanceChain),
  ]
}

export function EconomyCard({ locale, verse, chains, onOpen }: EconomyCardProps) {
  const copy = getCopy(locale)

  function primarySignal(verse: FixtureVerse) {
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
                    {/* aria-valuenow 按规范钳在 [0,100]，溢出真值经 aria-valuetext 播报（与视觉数字同口径） */}
                    <span
                      className="economy-progress__track"
                      role="progressbar"
                      aria-label={signal.label}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(boundedProgress(signal.value))}
                      aria-valuetext={`${formatPercent(signal.value, locale)}%`}
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
                aria-valuetext={`${formatPercent(verse.preorderProgress, locale)}%`}
              >
                <span style={{ inlineSize: `${boundedProgress(verse.preorderProgress)}%` }} />
              </span>
            </div>
          </div>
        </>
      )
    }

    // 锁定中/已解锁共用同一信号区（2026-09-23 用户裁定两阶段卡内容一致）
    if (verse.stage === 'locked' || verse.stage === 'unlocked') {
      return (
        <div className="economy-card__signal">
          <div className="economy-progress__thresholds">
            <div className="economy-progress__item">
              <div>
                <span>{copy.discovery.stakingApy}</span>
                {verse.stakingApy === null ? (
                  <b>{copy.discovery.unavailable}</b>
                ) : (
                  <b data-numeric>{formatPercent(verse.stakingApy, locale)}%</b>
                )}
              </div>
            </div>
            <div className="economy-progress__item">
              <div>
                <span>{copy.discovery.volume24h}</span>
                {verse.volume24h === null ? (
                  <b>{copy.discovery.unavailable}</b>
                ) : (
                  <b data-numeric>{formatMarketCap(verse.volume24h)}</b>
                )}
              </div>
            </div>
            <div className="economy-progress__item">
              <div>
                <span>{copy.discovery.participants}</span>
                <b data-numeric>{formatAmount(verse.participantCount, locale)}</b>
              </div>
            </div>
          </div>
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
    <article
      className="economy-card"
      data-stage={verse.stage}
      onClick={(event) => {
        const target = event.target as HTMLElement
        if (target.closest('a, button, [role="button"], input, select, textarea')) return
        if (window.getSelection()?.toString()) return
        onOpen()
      }}
    >
      <header className="economy-card__header">
        <div className="economy-card__identity">
          <h3>
            <Link href={verseHref(locale, verse.id)} aria-label={`${verse.symbol} ${verse.name}`}>
              {/* Symbol ≤5 字形、Name ≤12 字形，省略号计入额度（2026-10-01 用户裁定「更严格」）；全称走 aria-label */}
              <strong className="ax-glitch-text">
                {verse.symbol.length > 5 ? `${verse.symbol.slice(0, 4)}…` : verse.symbol}
              </strong>{' '}
              <span className="economy-card__name">
                {verse.name.length > 12 ? `${verse.name.slice(0, 11)}…` : verse.name}
              </span>
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
            <FastBadge label={copy.discovery.fastGenesis} note={copy.verse.fastGenesisNote} />
          ) : null}
          <StageBadge stage={verse.stage} locale={locale} />
        </div>
      </header>

      <Link className="economy-card__media" href={verseHref(locale, verse.id)} aria-label={verse.name}>
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
                <TooltipTrigger className="economy-card__chain" aria-label={chain.name}>
                  <ChainLogoMark chainId={chain.chainId} size={16} />
                </TooltipTrigger>
                <TooltipContent>{chain.name}</TooltipContent>
              </Tooltip>
            ))}
          </span>
        </p>

        {primarySignal(verse)}
      </div>

      {verse.stage === 'locked' || verse.stage === 'unlocked' ? (
        <dl className="economy-card__facts">
          <div>
            <dt>{copy.discovery.treasuryFund}</dt>
            <dd data-numeric>
              {verse.treasuryFundUsd === null
                ? copy.discovery.unavailable
                : `$${formatMarketCap(verse.treasuryFundUsd)}`}
            </dd>
          </div>
          <div>
            <dt>{copy.discovery.unlockTime}</dt>
            <dd data-numeric>{formatStamp(verse.unlockTimeAt)} UTC+8</dd>
          </div>
        </dl>
      ) : (
        <dl className="economy-card__facts">
          <div>
            <dt>{copy.discovery.totalRaised}</dt>
            <dd data-numeric>
              {formatAmount(verse.participationSize, locale, true)} {verse.raiseAsset}
            </dd>
          </div>
          <div>
            <dt>{copy.discovery.genesisEndtime}</dt>
            <dd data-numeric>{formatStamp(verse.endsAt)} UTC+8</dd>
          </div>
        </dl>
      )}
    </article>
  )
}

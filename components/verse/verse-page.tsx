import { notFound } from 'next/navigation'
import { ChevronsRight, Globe, Lock, ShieldCheck, Undo2 } from 'lucide-react'

import { DiscordIcon, TelegramIcon, XIcon } from '../global/brand-icons'

import { Button } from '@/components/ui/button'
import {
  getFixtureChains,
  getFixtureGovernanceState,
  getFixtureParticipations,
  getFixtureParticipationOptions,
  getFixturePolPosition,
  getFixtureSnapshot,
  getFixtureStaking,
  getFixtureVerse,
  getFixtureVerseTrade,
  getFixtureWalletBalances,
  type Locale,
  type FixtureParticipation,
  type FixtureVerse,
} from '@/lib/data/fixture-repository'

import { OutrunShell } from '../global/app-shell'
import { ChainLogoMark } from '../global/chain-icons'
import { getCopy } from '../global/copy'
import { VERSE_TAB_KEYS } from '../global/routes'
import { ParticipationPanel } from './participation-panel'
import { DaoPanel, LiquidityPanel, PolPanel } from './verse-tab-panels'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  formatAmount,
  FastBadge,
  formatStamp,
  LayoutNotes,
  ProgressMeter,
  SectionHeading,
  SourceRef,
} from '../global/signal-ui'
import { VerseTabs } from './verse-tabs'
import { VerseShare } from './verse-share'
import { VerseTradeDesk } from './verse-trade-desk'
import { VaultPanel } from './verse-vault-panel'

function CurrentAction({ verse, locale }: { verse: FixtureVerse; locale: Locale }) {
  const copy = getCopy(locale)
  // Genesis copy, four states: Fast threshold met=can advance now; Fast not met=triggers on
  // reaching the threshold; non-Fast met=still waits for the deadline; standard=can advance after the deadline
  const thresholdMet = verse.normalProgress >= 100 || verse.leverageProgress >= 100
  const body =
    verse.stage === 'genesis'
      ? verse.fastGenesis
        ? thresholdMet
          ? copy.verse.genesisActionFastReady
          : copy.verse.genesisActionFast
        : thresholdMet
          ? copy.verse.genesisActionMet
          : copy.verse.genesisAction
      : verse.stage === 'locked'
        ? copy.verse.lockedAction
        : verse.stage === 'unlocked'
          ? copy.verse.unlockedAction
          : copy.verse.refundAction

  return (
    <section className="action-panel ax-glow-card" aria-labelledby="current-action-title">
      <div className="action-panel__head">
        <div className="action-panel__icon" data-stage={verse.stage} aria-hidden="true">
          {verse.stage === 'genesis' ? <ChevronsRight /> : verse.stage === 'locked' ? <Lock /> : verse.stage === 'unlocked' ? <ShieldCheck /> : <Undo2 />}
        </div>
        <h2 id="current-action-title">{copy.verse.currentAction}</h2>
      </div>
      <p>{body}</p>
      {verse.stage === 'genesis' ? (
        <Button variant="outline" disabled title={copy.verse.fixedAnchor}>
          {copy.verse.advance}
        </Button>
      ) : (
        <Button variant="outline" disabled title={copy.verse.noParticipation}>
          {copy.verse.actionCta}
        </Button>
      )}
      {verse.stage === 'locked' ? (
        <div className="distribution-action">
          <strong>{copy.verse.distribution}</strong>
          <p>{copy.verse.distributionNote}</p>
        </div>
      ) : null}
      <SourceRef value={verse.sourceRef} id={verse.id} />
    </section>
  )
}

function participationKindLabel(kind: FixtureParticipation['kind'], locale: Locale) {
  const copy = getCopy(locale)
  if (kind === 'normal') return copy.verse.standardFunds
  if (kind === 'leverage') return copy.verse.leverageInterest
  return copy.verse.preorderKind
}

export async function VersePage({
  locale,
  verseId,
  tab,
  action,
}: {
  locale: Locale
  verseId: string
  /** Raw URL ?tab= value; falls back to Liquidity when not in the whitelist */
  tab?: string
  /** Raw URL ?action= value; only the vault tab accepts withdraw (vault action card initial value) */
  action?: string
}) {
  const snapshot = await getFixtureSnapshot()
  const verse = await getFixtureVerse(verseId)
  if (!verse) notFound()
  const initialTab = VERSE_TAB_KEYS.find((key) => key === tab)
  const vaultInitialView = initialTab === 'vault' && action === 'withdraw' ? 'withdraw' : undefined
  const copy = getCopy(locale)
  const participationOptions = await getFixtureParticipationOptions(verse.raiseAsset)
  // Fast Genesis threshold check: either of the two scopes met (preorder and debt principal do not count toward the threshold)
  const thresholdMet = verse.normalProgress >= 100 || verse.leverageProgress >= 100
  // Refund is the settlement state: no participation workbench/pools/generic timeline rendered;
  // collapses to a single refund settlement panel
  const isRefund = verse.stage === 'refund'
  const allParticipations = await getFixtureParticipations()
  const myRefundParticipations = isRefund
    ? allParticipations.filter((participation) => participation.verseId === verse.id)
    : []
  // Deployment-face scope consistent with the Explore cards: mainnet chains other than the
  // governance chain are Spoke chains (omnichain deployment face)
  const chains = await getFixtureChains()
  // Identity-row spokes: the verse's registered omnichainIds (minus governance) are the truth
  // on the onchain build; a null field (fixture snapshot) keeps the chains-fixture sample face
  const spokeChains =
    verse.omnichainIds == null
      ? chains.filter((chain) => chain.env === 'mainnet' && chain.chainId !== verse.governanceChain)
      : verse.omnichainIds
          .filter((id) => id !== verse.governanceChain)
          .map((id) => ({
            chainId: id,
            name: chains.find((chain) => chain.chainId === id)?.name ?? String(id),
          }))
  // Sample account's participated funds in this Verse (standard+leverage interest+preorder, all in uAsset — participations fixture)
  const myParticipation = allParticipations
    .filter(
      (participation) =>
        participation.verseId === verse.id && participation.owner === snapshot.sampleAccount.address,
    )
    .reduce((sum, participation) => sum + participation.amount, 0)
  // locked/unlocked trade desk and four-tab data (missing → panel slot state)
  const trade = await getFixtureVerseTrade(verse.id)
  if (!trade) notFound()
  const staking = await getFixtureStaking(verse.id)
  const polPosition = await getFixturePolPosition(verse.id)
  const governance = await getFixtureGovernanceState(verse.id)

  return (
    <OutrunShell
      locale={locale}
      accountAddress={snapshot.sampleAccount.address}
    >
      <header className="verse-hero" data-stage={verse.stage}>
        <div className="verse-identity">
          <span className="verse-identity__symbol" aria-hidden="true">
            {verse.symbol.slice(0, 2)}
          </span>
          {/* symbol first (users care more), name after; right edge=share group (no hero stage
              badge — the data area already carries stage signals,
              the top-right yields to the share group) */}
          <div className="verse-identity__titlerow">
            <strong className="ax-glitch-text verse-identity__ticker" data-numeric>
              {verse.symbol}
            </strong>
            <h1>{verse.name}</h1>
            <div className="verse-identity__badges">
              {verse.fastGenesis ? (
                <FastBadge label={copy.verse.fastGenesis} note={copy.verse.fastGenesisNote} />
              ) : null}
              <VerseShare locale={locale} verse={verse} />
            </div>
          </div>
          {verse.description ? <p className="verse-identity__desc">{verse.description}</p> : null}
          <div className="verse-identity__footrow">
            <div className="verse-identity__chains">
              <span>
                {copy.verse.governanceChain}
                <Tooltip>
                  <TooltipTrigger
                    className="verse-identity__chain"
                    aria-label={verse.governanceChainName}
                  >
                    <ChainLogoMark chainId={verse.governanceChain} size={16} />
                  </TooltipTrigger>
                  <TooltipContent>{verse.governanceChainName}</TooltipContent>
                </Tooltip>
              </span>
              {spokeChains.length > 0 ? (
                <span>
                  {copy.verse.spokeChains}
                  {spokeChains.map((chain) => (
                    <Tooltip key={chain.chainId}>
                      <TooltipTrigger className="verse-identity__chain" aria-label={chain.name}>
                        <ChainLogoMark chainId={chain.chainId} size={16} />
                      </TooltipTrigger>
                      <TooltipContent>{chain.name}</TooltipContent>
                    </Tooltip>
                  ))}
                </span>
              ) : null}
            </div>
            {verse.socials.length > 0 ? (
              <div className="verse-identity__socials" aria-label={copy.verse.socialLinks}>
                {verse.socials.map((social) => {
                  const Icon =
                    social.kind === 'website'
                      ? Globe
                      : social.kind === 'x'
                        ? XIcon
                        : social.kind === 'discord'
                          ? DiscordIcon
                          : TelegramIcon;
                  return (
                    <a key={social.kind} href={social.url} target="_blank" rel="noreferrer" aria-label={social.kind}>
                      <Icon aria-hidden="true" />
                    </a>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
        <SourceRef value={verse.sourceRef} id={verse.id} />
      </header>

      {/* The genesis stage keeps the dual-threshold card; locked/unlocked switch to trade desk +
          four tabs (the success check/what you can do now/metrics card blocks are covered by the
          stats bar and the four tabs) */}
      {verse.stage === 'genesis' ? (
        <section className="threshold-panel ax-glow-card" aria-labelledby="threshold-title">
        <div className="threshold-panel__intro">
          <h2 id="threshold-title">{copy.verse.successTitle}</h2>
          <p>{copy.verse.successBody}</p>
          {verse.fastGenesis ? (
            <p className="threshold-panel__fast" data-reached={thresholdMet || undefined}>
              {thresholdMet
                ? `${copy.verse.fastGenesisReached}. ${copy.verse.fastGenesisReachedNote}`
                : copy.verse.fastGenesisNote}
            </p>
          ) : null}
          <dl>
            <div>
              <dt>{copy.verse.minimum}</dt>
              <dd data-numeric>{formatAmount(verse.minSuccessThreshold, locale)} {verse.raiseAsset}</dd>
            </div>
          </dl>
        </div>
        <div className="threshold-panel__meters">
          <ProgressMeter
            label={copy.verse.standardFunds}
            value={verse.normalProgress}
            amount={verse.normalRaised}
            threshold={verse.minSuccessThreshold}
            unit={verse.raiseAsset}
            locale={locale}
          />
          <ProgressMeter
            label={copy.verse.leverageInterest}
            value={verse.leverageProgress}
            amount={verse.leverageInterest}
            threshold={verse.minSuccessThreshold}
            unit={verse.raiseAsset}
            locale={locale}
          />
        </div>
        <SourceRef value="docs/page-briefs/source-map.md#M7" />
      </section>
      ) : null}

      {isRefund ? (
        <section className="refund-settle ax-glow-card" aria-labelledby="refund-settle-title">
          <h2 id="refund-settle-title">{copy.verse.refundSettleTitle}</h2>
          {myRefundParticipations.length > 0 ? (
            <>
              <dl className="refund-settle__participations">
                {myRefundParticipations.map((participation) => (
                  <div key={participation.kind}>
                    <dt>{participationKindLabel(participation.kind, locale)}</dt>
                    <dd data-numeric>
                      {formatAmount(participation.amount, locale, true)} {verse.raiseAsset}
                    </dd>
                  </div>
                ))}
                <div className="refund-settle__total">
                  <dt>{copy.verse.refundTotal}</dt>
                  <dd data-numeric>
                    {formatAmount(
                      myRefundParticipations.reduce((sum, p) => sum + p.amount, 0),
                      locale,
                      true,
                    )}{' '}
                    {verse.raiseAsset}
                  </dd>
                </div>
              </dl>
              <Button disabled title={copy.verse.fixedAnchor}>
                {copy.verse.claimAllCta}
              </Button>
            </>
          ) : (
            <p className="refund-settle__empty">{copy.verse.refundNone}</p>
          )}
          <SourceRef value={verse.sourceRef} id={verse.id} />
        </section>
      ) : verse.stage === 'genesis' ? (
        <div className="verse-workbench" id="participate">
        <section className="workbench-primary ax-glow-card" aria-labelledby="participation-title">
          {/* No visible genesis-state title/description (would fully duplicate
              the right side's "what you can do now"); sr-only h2 keeps the section outline */}
          <h2 id="participation-title" className="sr-only">
            {copy.verse.participateTitle}
          </h2>
          <ParticipationPanel
            locale={locale}
            raiseAsset={participationOptions.raiseAsset}
            reserves={participationOptions.reserves}
            yieldSourceRegistry={participationOptions.yieldSourceRegistry}
            creditAsset={participationOptions.creditAsset}
            normalRaised={verse.normalRaised}
            preorderRaised={verse.preorderRaised}
            preorderCapacityRatio={verse.preorderCapacityRatio}
            leverageInterestRate={verse.leverageInterestRate}
            leverageDebtCap={verse.leverageDebtCap}
            leverageInterestRaised={verse.leverageInterest}
            walletBalances={await getFixtureWalletBalances()}
            sourceRef={verse.sourceRef}
            governanceChain={verse.governanceChain}
            governanceChainName={verse.governanceChainName}
          />
        </section>

        <div className="workbench-secondary">
          <CurrentAction verse={verse} locale={locale} />
          <section className="stats-panel" aria-labelledby="verse-stats-title">
            <SectionHeading title={copy.verse.metricsTitle} />
            <dl className="verse-stats">
              <div>
                <dt>{copy.verse.genesisEnds}</dt>
                <dd data-numeric>{formatStamp(verse.endsAt)}</dd>
              </div>
              <div>
                <dt>{copy.verse.participantsLabel}</dt>
                <dd data-numeric>{formatAmount(verse.participantCount, locale)}</dd>
              </div>
              {verse.projectedMarketCap != null ? (
                <div>
                  <dt>{copy.verse.estMarketCap}</dt>
                  <dd data-numeric>
                    {formatAmount(verse.projectedMarketCap, locale, true)} {verse.raiseAsset}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt>{copy.verse.yourParticipation}</dt>
                <dd data-numeric={myParticipation > 0 ? true : undefined}>
                  {myParticipation > 0
                    ? `${formatAmount(myParticipation, locale)} ${verse.raiseAsset}`
                    : copy.verse.notParticipating}
                </dd>
              </div>
            </dl>
            <SourceRef value={verse.sourceRef} id={verse.id} />
          </section>
        </div>
      </div>
      ) : (
        /* locked / unlocked: persistent trade desk area + four tabs */
        <>
          <VerseTradeDesk locale={locale} verse={verse} trade={trade} />
          <VerseTabs locale={locale} initialTab={initialTab}>
            {{
              liquidity: <LiquidityPanel locale={locale} verse={verse} trade={trade} pol={polPosition} />,
              pol: <PolPanel locale={locale} verse={verse} pol={polPosition} price={trade.tokenStats.price} />,
              vault: (
                <VaultPanel
                  locale={locale}
                  verse={verse}
                  staking={staking}
                  myMemecoin={polPosition?.myMemecoin ?? null}
                  initialView={vaultInitialView}
                />
              ),
              dao: <DaoPanel locale={locale} verse={verse} governance={governance} />,
            }}
          </VerseTabs>
        </>
      )}


      <LayoutNotes locale={locale} items={copy.verse.notes} />
    </OutrunShell>
  )
}

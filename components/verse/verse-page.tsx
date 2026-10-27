import { notFound } from 'next/navigation'
import { ChevronsRight, Globe, Info, Lock, ShieldCheck, Undo2 } from 'lucide-react'

import { DiscordIcon, TelegramIcon, XIcon } from '../global/brand-icons'

import { Button } from '@/components/ui/button'
import {
  getChains,
  getGovernanceState,
  getParticipations,
  getParticipationOptions,
  getPolPosition,
  getDisplayAccount,
  getStaking,
  getVerse,
  getVerseTrade,
  getWalletBalances,
  type Locale,
  type Verse,
} from '@/lib/data/fixture-repository'
import { executionChainId } from '@/lib/web3/chains'

import { OutrunShell } from '../global/app-shell'
import { ChainLogoMark } from '../global/chain-icons'
import { getCopy } from '../global/copy'
import { VERSE_TAB_KEYS } from '../global/routes'
import { EndGenesisButton } from './end-genesis-button'
import { MyParticipationStat } from './my-participation-stat'
import { GenesisLiveMeters, VerseLiveProvider } from './genesis-live'
import { ParticipationPanel } from './participation-panel'
import { RefundSettlement } from './refund-settlement'
import { DaoPanel, LiquidityPanel, PolPanel } from './verse-tab-panels'
import { ClaimCenterPanel, ClaimCenterProvider, ClaimTabBadge } from './claim-center'
import { sampleClaimEntitlements } from './claim-rows'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  formatAmount,
  formatMarketCap,
  FastBadge,
  LayoutNotes,
  SectionHeading,
  SourceRef,
} from '../global/signal-ui'
import { VerseTabs } from './verse-tabs'
import { VerseShare } from './verse-share'
import { VerseTradeDesk } from './verse-trade-desk'
import { VaultPanel } from './verse-vault-panel'

function CurrentAction({
  verse,
  locale,
  verseIdParam,
}: {
  verse: Verse
  locale: Locale
  /** Numeric URL segment (route 307s legacy shapes before the page renders) */
  verseIdParam: string
}) {
  const copy = getCopy(locale)
  // Genesis copy selection: threshold met × Fast × deadline passed (server render clock).
  // Met is triggerable now both before the deadline (Fast) and after it — one wording;
  // non-Fast before the deadline carries no met split (either way the deadline unlock
  // advances the verse); missed deadline = the advance goes to Refund (lifecycle.md:51-55).
  const thresholdMet = verse.normalProgress >= 100 || verse.leverageProgress >= 100
  const deadlinePassed = Date.now() >= Date.parse(verse.endsAt)
  const body =
    verse.stage === 'genesis'
      ? deadlinePassed
        ? thresholdMet
          ? copy.verse.genesisActionMetReady
          : copy.verse.genesisActionMissed
        : verse.fastGenesis && thresholdMet
          ? copy.verse.genesisActionMetReady
          : verse.fastGenesis
            ? copy.verse.genesisActionFast
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
        <EndGenesisButton
          locale={locale}
          verseIdParam={verseIdParam}
          governanceChain={verse.governanceChain}
          governanceChainName={verse.governanceChainName}
          deployedChainIds={verse.deployedChainIds}
          fastGenesis={verse.fastGenesis}
          thresholdMet={thresholdMet}
          endsAt={verse.endsAt}
        />
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
  const displayAccount = await getDisplayAccount()
  const verse = await getVerse(verseId)
  if (!verse) notFound()
  const initialTab = VERSE_TAB_KEYS.find((key) => key === tab)
  const vaultInitialView = initialTab === 'vault' && action === 'withdraw' ? 'withdraw' : undefined
  const copy = getCopy(locale)
  // Execution chain scopes the stake-source registry (SP instances differ per chain); the
  // fixture twin is chain-agnostic and ignores the id.
  const participationOptions = await getParticipationOptions(
    verse.raiseAsset,
    executionChainId(verse.governanceChain),
  )
  // Fast Genesis threshold check: either of the two scopes met (preorder and debt principal do not count toward the threshold)
  const thresholdMet = verse.normalProgress >= 100 || verse.leverageProgress >= 100
  // Refund is the settlement state: no participation workbench/pools/generic timeline rendered;
  // collapses to a single refund settlement panel
  const isRefund = verse.stage === 'refund'
  const allParticipations = await getParticipations()
  const myRefundParticipations = isRefund
    ? allParticipations.filter((participation) => participation.verseId === verse.id)
    : []
  // Deployment-face scope consistent with the Explore cards: mainnet chains other than the
  // governance chain are Spoke chains (omnichain deployment face)
  const chains = await getChains()
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
  // Sample account's equivalent genesis funds in this Verse (participations fixture): normal
  // funds plus leveraged interest converted at the verse's snapshot rate (a rate-null snapshot
  // counts the interest as itself), preorder excluded — same basis as the on-chain stat
  // (readGenesisParticipation: normal + getUserLeveragedDebt). Onchain builds carry no server
  // account, so the stats slot overrides this sample with a client wallet read
  // (my-participation-stat).
  const myParticipation = allParticipations
    .filter(
      (participation) =>
        participation.verseId === verse.id && participation.owner === displayAccount.address,
    )
    .reduce((sum, participation) => {
      if (participation.kind === 'preorder') return sum
      if (participation.kind === 'leverage') {
        return verse.leverageInterestRate
          ? sum + participation.amount / verse.leverageInterestRate
          : sum + participation.amount
      }
      return sum + participation.amount
    }, 0)
  // locked/unlocked trade desk and four-tab data (missing → panel slot state)
  const trade = await getVerseTrade(verse.id)
  if (!trade) notFound()
  const staking = await getStaking(verse.id)
  const polPosition = await getPolPosition(verse.id)
  const governance = await getGovernanceState(verse.id)

  return (
    <OutrunShell
      locale={locale}
      accountAddress={displayAccount.address}
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

      {/* The genesis stage keeps the dual-threshold card (rendered inside the live provider
          below: its meters read the post-write probe); locked/unlocked switch to trade desk +
          four tabs (the success check/what you can do now/metrics card blocks are covered by the
          stats bar and the four tabs) */}
      {isRefund ? (
        <section className="refund-settle ax-glow-card" aria-labelledby="refund-settle-title">
          <h2 id="refund-settle-title">{copy.verse.refundSettleTitle}</h2>
          {/* Refund legs: SSR sample (fixture) overridden by the connected wallet's client-side
              ledger read on onchain builds (isRefunded flags drop claimed legs) */}
          <RefundSettlement
            locale={locale}
            raiseAsset={verse.raiseAsset}
            governanceChain={verse.governanceChain}
            sample={myRefundParticipations.map(({ kind, amount }) => ({ kind, amount }))}
          />
          <SourceRef value={verse.sourceRef} id={verse.id} />
        </section>
      ) : verse.stage === 'genesis' ? (
        <VerseLiveProvider
          verseIdParam={verse.id}
          dataChainId={verse.chainId}
          deployedChainIds={verse.deployedChainIds}
          chainAggregates={verse.chainAggregates ?? null}
        >
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
          <GenesisLiveMeters
            locale={locale}
            labels={{
              standard: copy.verse.standardFunds,
              leverage: copy.verse.leverageInterest,
            }}
            unit={verse.raiseAsset}
            threshold={verse.minSuccessThreshold}
            normalRaised={verse.normalRaised}
            normalProgress={verse.normalProgress}
            leverageInterest={verse.leverageInterest}
            leverageProgress={verse.leverageProgress}
          />
        </div>
        <SourceRef value="docs/page-briefs/source-map.md#M7" />
      </section>
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
            leverageInterestRateWad={verse.leverageInterestRateWad}
            preorderCapRatioBps={verse.preorderCapRatioBps}
            preorderRemainingBase={verse.preorderRemainingBase}
            leverageInterestRaised={verse.leverageInterest}
            walletBalances={await getWalletBalances()}
            sourceRef={verse.sourceRef}
            governanceChain={verse.governanceChain}
            governanceChainName={verse.governanceChainName}
            deployedChainIds={verse.deployedChainIds}
          />
        </section>

        <div className="workbench-secondary">
          <CurrentAction verse={verse} locale={locale} verseIdParam={verseId} />
          <section className="stats-panel" aria-labelledby="verse-stats-title">
            <SectionHeading title={copy.verse.metricsTitle} />
            <dl className="verse-stats">
              <div>
                <dt>{copy.verse.omniRaised}</dt>
                {/* Cross-chain total in the same uAsset denomination on every chain (the
                    discovery cards read the same field); per-chain genesis settles
                    independently, so this total never feeds the threshold meters */}
                <dd data-numeric>
                  {formatAmount(verse.omniRaised, locale, true)} {verse.raiseAsset}
                </dd>
              </div>
              <div>
                <dt>{copy.verse.participantsLabel}</dt>
                {/* Participant count is a cross-chain total: per-chain distinct counts summed
                    over the landed set (cross-chain dedup needs an identity the contracts do
                    not carry) */}
                <dd data-numeric>{formatAmount(verse.omniParticipantCount, locale)}</dd>
              </div>
              {verse.marketCapUsd != null ? (
                <div>
                  <dt>{copy.verse.estMarketCap}</dt>
                  {/* Mechanism projection (user-ruled formula): primary-pool genesis
                      funds × 2 (POL 1:1 match doubles the pool's uAsset side), derived
                      in the data layer from the cross-chain raised total — registration
                      never stores a cap */}
                  <dd data-numeric>${formatMarketCap(verse.marketCapUsd)}</dd>
                </div>
              ) : null}
              <div>
                <dt>
                  {copy.verse.yourParticipation}
                  <Tooltip>
                    <TooltipTrigger
                      className="create-info"
                      aria-label={copy.verse.yourParticipationNote}
                    >
                      <Info aria-hidden="true" />
                    </TooltipTrigger>
                    <TooltipContent>{copy.verse.yourParticipationNote}</TooltipContent>
                  </Tooltip>
                </dt>
                <MyParticipationStat
                  locale={locale}
                  raiseAsset={verse.raiseAsset}
                  governanceChain={verse.governanceChain}
                  landedChains={verse.deployedChainIds}
                  sample={myParticipation}
                />
              </div>
            </dl>
            <SourceRef value={verse.sourceRef} id={verse.id} />
          </section>
        </div>
      </div>
        </VerseLiveProvider>
      ) : (
        /* locked / unlocked: persistent trade desk area + five tabs */
        <>
          <VerseTradeDesk locale={locale} verse={verse} trade={trade} />
          {/* The claim-center provider wraps the tabs so the fifth tab's count badge and the
              panel share one wallet-scoped entitlements read */}
          <ClaimCenterProvider
            verseIdParam={verseId}
            governanceChain={verse.governanceChain}
            deployedChainIds={verse.deployedChainIds}
            memecoinSymbol={verse.symbol}
            uAssetSymbol={verse.raiseAsset}
          >
            <VerseTabs locale={locale} initialTab={initialTab} claimBadge={<ClaimTabBadge locale={locale} />}>
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
                    price={trade.tokenStats.price}
                  />
                ),
                dao: <DaoPanel locale={locale} verse={verse} governance={governance} />,
                claim: (
                  <ClaimCenterPanel
                    locale={locale}
                    verseIdParam={verseId}
                    governanceChain={verse.governanceChain}
                    governanceChainName={verse.governanceChainName}
                    deployedChainIds={verse.deployedChainIds}
                    sample={sampleClaimEntitlements(polPosition, verse.symbol, verse.raiseAsset)}
                  />
                ),
              }}
            </VerseTabs>
          </ClaimCenterProvider>
        </>
      )}


      <LayoutNotes locale={locale} items={copy.verse.notes} />
    </OutrunShell>
  )
}

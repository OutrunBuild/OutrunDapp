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
  // 创世文案四态（lifecycle.md:53-55）：Fast 达标=即可推进；Fast 未达标=达标即触发；非 Fast 达标=仍等截止；常规=截止后可推进
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

/** 交易台四页签 key（?tab= 深链白名单——与 VerseTabs 的 ToggleGroupItem value 一致） */
const VERSE_TAB_KEYS = ['liquidity', 'pol', 'vault', 'dao'] as const

export function VersePage({
  locale,
  verseId,
  tab,
  action,
}: {
  locale: Locale
  verseId: string
  /** URL ?tab= 原始值；不在白名单内回落 Liquidity */
  tab?: string
  /** URL ?action= 原始值；当前仅 vault 页签接受 withdraw（金库操作卡初值） */
  action?: string
}) {
  const snapshot = getFixtureSnapshot()
  const verse = getFixtureVerse(verseId)
  if (!verse) notFound()
  const initialTab = VERSE_TAB_KEYS.find((key) => key === tab)
  const vaultInitialView = initialTab === 'vault' && action === 'withdraw' ? 'withdraw' : undefined
  const copy = getCopy(locale)
  const participationOptions = getFixtureParticipationOptions(verse.raiseAsset)
  // Fast Genesis 达标判定：双口径任一达标（预购与债务本金不计入——lifecycle.md:35-49）
  const thresholdMet = verse.normalProgress >= 100 || verse.leverageProgress >= 100
  // Refund 是结算态：不渲染参与工作台/资金池/通用时间线，收敛为单一退款结算面板
  const isRefund = verse.stage === 'refund'
  const myRefundParticipations = isRefund
    ? getFixtureParticipations().filter((participation) => participation.verseId === verse.id)
    : []
  // 部署面口径与 Explore 卡片一致：治理链外的其余主网链即 Spoke 链（omnichain 部署面）
  const spokeChains = getFixtureChains().filter(
    (chain) => chain.env === 'mainnet' && chain.chainId !== verse.governanceChain,
  )
  // 样本账户在本 Verse 的已参与资金（普通+杠杆利息+预购，均按 uAsset 计——participations fixture）
  const myParticipation = getFixtureParticipations()
    .filter(
      (participation) =>
        participation.verseId === verse.id && participation.owner === snapshot.sampleAccount.address,
    )
    .reduce((sum, participation) => sum + participation.amount, 0)
  // locked/unlocked 交易台与四标签数据（缺失→面板槽位态）
  const trade = getFixtureVerseTrade(verse.id)
  if (!trade) notFound()
  const staking = getFixtureStaking(verse.id)
  const polPosition = getFixturePolPosition(verse.id)
  const governance = getFixtureGovernanceState(verse.id)

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
          {/* symbol 在前（用户更关心），name 随后；右缘=分享组（2026-10-06 用户裁定：
              hero 阶段徽章删除——数据面已有阶段信号，右上角让位分享组） */}
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

      {/* 创世期保留双门槛判定卡；locked/unlocked 改走交易台+四标签（Q1 用户裁定 2026-09-23：
          成功判定/当前可以做什么/指标卡三块移除，信息由统计条与四标签覆盖） */}
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
          {/* 创世态标题/描述删除（2026-09-22 用户裁定：与右侧「当前可以做什么」完全重复）；sr-only h2 维持 section 大纲 */}
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
            walletBalances={getFixtureWalletBalances()}
            sourceRef={verse.sourceRef}
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
        /* locked / unlocked：交易台持久区 + 四标签（2026-09-23 用户裁定） */
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

import type {
  Locale,
  PrototypeGovernanceState,
  PrototypePolPosition,
  PrototypeVerse,
  PrototypeVerseTrade,
} from '@/lib/data/prototype-repository'

import { getPrototypeAssetUsdSample } from '@/lib/data/prototype-repository'

import { Info } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CactusLogo } from './cactus-logo'
import { CopyAddress } from './copy-address'
import { DaoDots, DaoFundDialog } from './dao-fund-dialog'
import { getCopy } from './copy'
import { PolMintDialog } from './pol-mint-dialog'
import { PolSplitMergeDialog } from './pol-split-merge-dialog'
import { formatAmount, formatMarketCap, formatPercent, formatStamp, SourceRef } from './signal-ui'

function Slot({ children }: { children: React.ReactNode }) {
  return <span className="ax-slot">{children}</span>
}

/** Liquidity 标签：四池总览 + 池卡（four-pools.md:9-14；APR/量=样本+读链槽位） */
export function LiquidityPanel({ locale, trade }: { locale: Locale; trade: PrototypeVerseTrade }) {
  const copy = getCopy(locale).verseDesk
  // 总览=四池合计（Q2 用户裁定）；统计条的 Liq/Vol 是主池口径，两处不同源
  const volumeTotal = trade.pools.reduce(
    (sum, pool) => (pool.volume24h != null ? sum + pool.volume24h : sum),
    0,
  )
  const hasVolume = trade.pools.some((pool) => pool.volume24h != null)

  return (
    <div className="liquidity-panel">
      <dl className="liquidity-panel__overview" data-numeric>
        <div>
          <dt>{copy.totalValueLocked}</dt>
          <dd>{`$${formatMarketCap(trade.pools.reduce((sum, pool) => sum + pool.tvl, 0))}`}</dd>
        </div>
        <div>
          <dt>{copy.liquidityVolume}</dt>
          <dd>{hasVolume ? `$${formatMarketCap(volumeTotal)}` : <Slot>{copy.onChainSlot}</Slot>}</dd>
        </div>
      </dl>
      <h3 className="panel-title">{copy.poolsTitle}</h3>
      <ul className="liquidity-panel__pools">
        {trade.pools.map((pool) => (
          <li key={pool.id} className="pool-card" data-pool={pool.pool}>
            <strong className="pool-card__pair" data-numeric>
              {pool.baseSymbol}/{pool.quoteSymbol}
            </strong>
            <dl className="pool-card__stats" data-numeric>
              <div>
                <dt>TVL</dt>
                <dd>{`$${formatMarketCap(pool.tvl)}`}</dd>
              </div>
              <div>
                <dt>{copy.liquidityVolume}</dt>
                <dd>
                  {pool.volume24h != null ? (
                    `$${formatMarketCap(pool.volume24h)}`
                  ) : (
                    <Slot>{copy.onChainSlot}</Slot>
                  )}
                </dd>
              </div>
              <div>
                <dt>{copy.aprLabel}</dt>
                <dd>
                  {pool.apr7d != null ? (
                    `${formatPercent(pool.apr7d * 100, locale)}%`
                  ) : (
                    <Slot>{copy.onChainSlot}</Slot>
                  )}
                </dd>
              </div>
            </dl>
            <Button variant="outline" size="sm" disabled>
              {copy.addLiquidity}
            </Button>
          </li>
        ))}
      </ul>
      <SourceRef value="docs/page-briefs/source-map.md#M5" />
    </div>
  )
}

/** Tokenization 标签 v2「拆分终端」（2026-09-23 用户裁定：草稿级排版升级为终端级）：
 * POL 资产卡（余额主读数 + 市场价↔名义价值仪表）⇢ 分缝（Y 型拆分符=机制隐喻）⇢ PT/YT 衍生卡。
 * 机制出处：Mint/Redeem=POL 代币（source-map.md#M14 对账行）；Split/Merge=1 POL⇄1 PT+1 YT
 * 仅锁定期（IPOLSplitter.sol:102/104，merge=等额销毁 PT+YT 1:1 换回 POL；unlock/settled 后
 * AlreadyUnlocked）；Claim YT=创世锁定后按出资比例一次性领取（MemeverseSettlementImpl.sol:88，
 * 杠杆参与者按利息比例 claimLeveragedYT）；名义价值=2×uAsset 侧（pt-yt-splitter.md §4）。 */
export function PolPanel({
  locale,
  verse,
  pol,
  price,
}: {
  locale: Locale
  verse: PrototypeVerse
  pol: PrototypePolPosition | null
  /** 主池价（trade.tokenStats.price）：Mint 弹窗的配比与 Rate 行来源；null=无样本 */
  price: number | null
}) {
  const copy = getCopy(locale).verseDesk
  const locked = verse.stage === 'locked'
  // POL-/PT-/YT-<MEME>（MemeverseLaunchImpl.sol:117-119；POLSplitterUpgradeable.sol:225-226）
  const polSymbol = `POL-${verse.symbol}`
  const ptSymbol = `PT-${verse.symbol}`
  const ytSymbol = `YT-${verse.symbol}`

  // 偏差对比刻度（2026-09-25 本体裁定：这是两个价格的对比（measure vs target），不是滑块——
  // 语言=bullet chart 语义：轴=「相对名义价值的偏差」线性刻度，两端端标 −D%/+D% 即刻度依据
  // （D=50（2026-09-25 用户裁定 ±25 不够），|Δ| 超界自动放宽到 100/200/400 并同步端标），
  // 基准=0（平价，品红 datum），市场值标位置恒=Δ/(2D)+50% 线性落点，两者之间的偏差条=|Δ| 的墨水
  const nominal = pol?.nominalValuePerPol ?? 0
  const market = pol?.marketPricePerPol ?? 0
  const deltaPct = nominal > 0 ? ((market - nominal) / nominal) * 100 : 0
  const domainPct = [50, 100, 200, 400].find((d) => Math.abs(deltaPct) <= d) ?? 400
  const marketPos = nominal > 0 ? Math.min(1, Math.max(0, 0.5 + deltaPct / (domainPct * 2))) : 0.5
  const spanWidth = Math.abs(marketPos - 0.5)
  const deltaLabel = `${deltaPct < 0 ? '−' : '+'}${formatPercent(Math.abs(deltaPct), locale)}%`

  // 计价=美元（2026-09-23 用户裁定：标价统一 $ 口径，与交易台统计条/Liquidity 面板一致；
  // 汇率=assets.json usdSample——同 SwapPanel 的 uAssetUsd 源；无样本→槽位态。
  // 市值/总供应不展示——对用户无实际价值（2026-09-23 用户裁定删除））
  const uAssetUsd = getPrototypeAssetUsdSample(verse.raiseAsset)
  const marketUsd = uAssetUsd != null && pol ? `$${formatAmount(market * uAssetUsd, locale)}` : null
  const nominalUsd = uAssetUsd != null && pol ? `$${formatAmount(nominal * uAssetUsd, locale)}` : null
  const estUsd =
    uAssetUsd != null && pol ? `$${formatMarketCap(pol.myPol * market * uAssetUsd)}` : null

  return (
    <div className="pol-panel">
      {/* 面板标题「Tokenization」删（2026-09-24 用户裁定：页签已示，冗余） */}
      {pol ? (
        <div className="pol-panel__grid">
          <section className="pol-card" data-token="pol">
            <header className="pol-card__head">
              <span className="pol-glyph">POL</span>
              <strong className="pol-card__symbol" data-numeric>
                {polSymbol}
              </strong>
              <span className="pol-card__tag">{copy.polTag}</span>
            </header>
            <div className="pol-card__balance">
              <span className="pol-label">{copy.polBalance}</span>
              {/* symbol 卡头已示，余额行不重复；估值内联尾随（2026-09-23 用户裁定） */}
              <strong className="pol-card__amount" data-numeric>
                {formatAmount(pol.myPol, locale)}
                <span className="pol-card__est">
                  · ≈ {estUsd ?? <Slot>{copy.onChainSlot}</Slot>}
                </span>
              </strong>
            </div>
            <div
              className="pol-gauge"
              role="img"
              data-numeric
              aria-label={`${copy.marketPrice} ${marketUsd ?? `${market.toFixed(4)} ${verse.raiseAsset}`} · ${copy.nominalValue} ${nominalUsd ?? `${nominal.toFixed(4)} ${verse.raiseAsset}`} · ${deltaLabel} ${copy.vsNominal} · ${copy.polScaleNote.replace('{n}', String(domainPct))}`}
            >
              <div className="pol-gauge__row">
                <span className="pol-gauge__legend pol-gauge__legend--market">
                  <span className="pol-gauge__legend-label">{copy.marketPrice}</span>
                  <strong className="pol-gauge__value pol-gauge__value--market">
                    {marketUsd ?? <Slot>{copy.onChainSlot}</Slot>}
                  </strong>
                </span>
                <span className="pol-gauge__readout" data-trend={deltaPct < 0 ? 'down' : 'up'}>
                  <em>{copy.vsNominal}</em>
                  <strong>{deltaLabel}</strong>
                </span>
              </div>
              <div className="pol-gauge__axis">
                {/* z 序=偏差条→市场值标→名义 datum：近平价时 datum 压在值标之上，0 点不消失 */}
                {spanWidth > 0.004 && (
                  <span
                    className="pol-gauge__span"
                    data-trend={deltaPct < 0 ? 'down' : 'up'}
                    style={{
                      insetInlineStart: `${(Math.min(marketPos, 0.5) * 100).toFixed(1)}%`,
                      inlineSize: `${(spanWidth * 100).toFixed(1)}%`,
                    }}
                  />
                )}
                <span
                  className="pol-gauge__mark"
                  style={{ insetInlineStart: `${(marketPos * 100).toFixed(1)}%` }}
                />
                <span className="pol-gauge__datum" style={{ insetInlineStart: '50%' }} />
                {/* 端标+中点即刻度依据（2026-09-25）：线性偏差刻度 −D%~+D%，0=平价 */}
                <span className="pol-gauge__scale" aria-hidden="true">
                  <span data-numeric>{`−${domainPct}%`}</span>
                  <span data-numeric>0</span>
                  <span data-numeric>{`+${domainPct}%`}</span>
                </span>
              </div>
              <div className="pol-gauge__row">
                <span className="pol-gauge__legend pol-gauge__legend--nominal">
                  <span className="pol-gauge__legend-label">
                    {copy.nominalValue}
                    <Tooltip>
                      <TooltipTrigger render={<span className="create-info" aria-label={copy.nominalNote} />}>
                        <Info aria-hidden="true" />
                      </TooltipTrigger>
                      <TooltipContent>{copy.nominalNote}</TooltipContent>
                    </Tooltip>
                  </span>
                  <strong className="pol-gauge__value pol-gauge__value--nominal">
                    {nominalUsd ?? <Slot>{copy.onChainSlot}</Slot>}
                  </strong>
                </span>
              </div>
            </div>
            <div className="pol-card__actions">
              <div className="pol-card__btns">
                {/* 2026-09-24 用户裁定：Mint 改弹窗（双币供给→POL，机制同 mintNote；
                    弹窗内 CTA 仍禁用——原型不伪造成交） */}
                <PolMintDialog
                  locale={locale}
                  verse={verse}
                  pol={pol}
                  price={price}
                  uAssetUsd={uAssetUsd}
                />
                {/* 2026-09-25 用户裁定：禁用=机制档位而非数据借口——Redeem 仅 unlocked 可用
                    （redeemPolNote 口径），locked 阶段机制性禁用不渲染灰钮，Mint 撑满行；
                    阶段说明 note 行同日用户裁定删除 */}
                {!locked ? (
                  <Button variant="outline" size="sm" disabled title={copy.redeemPolNote}>
                    {copy.redeemPol}
                  </Button>
                ) : null}
              </div>
            </div>
          </section>

          <div className="pol-seam" aria-hidden="true">
            <span className="pol-seam__line" />
            <span className="pol-seam__glyph">
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M1.5 8H6L14.5 3M6 8l8.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
              </svg>
            </span>
            <span className="pol-seam__line" />
          </div>

          <section className="pol-card" data-token="pt-yt">
            <div className="pol-asset" data-token="pt">
              <span className="pol-glyph pol-glyph--pt">PT</span>
              <div className="pol-asset__main">
                <strong className="pol-asset__symbol" data-numeric>
                  {ptSymbol}
                </strong>
                {/* 2026-09-25 用户裁定：机制一行注太长，行注只留全称，机制说明收进 ⊙ 气泡 */}
                <span className="pol-asset__desc">
                  {copy.ptFullName}
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span
                          className="create-info"
                          aria-label={copy.ptTip.replace('{asset}', verse.raiseAsset)}
                        />
                      }
                    >
                      <Info aria-hidden="true" />
                    </TooltipTrigger>
                    <TooltipContent>{copy.ptTip.replace('{asset}', verse.raiseAsset)}</TooltipContent>
                  </Tooltip>
                </span>
              </div>
              <div className="pol-asset__side">
                <span className="pol-label">{copy.ptBalance}</span>
                <strong className="pol-asset__amount" data-numeric>
                  {formatAmount(pol.myPt, locale)}
                </strong>
              </div>
            </div>
            <div className="pol-asset" data-token="yt">
              <span className="pol-glyph pol-glyph--yt">YT</span>
              <div className="pol-asset__main">
                <strong className="pol-asset__symbol" data-numeric>
                  {ytSymbol}
                </strong>
                <span className="pol-asset__desc">
                  {copy.ytFullName}
                  <Tooltip>
                    <TooltipTrigger
                      render={<span className="create-info" aria-label={copy.ytTip.replace('{asset}', verse.raiseAsset)} />}
                    >
                      <Info aria-hidden="true" />
                    </TooltipTrigger>
                    <TooltipContent>{copy.ytTip.replace('{asset}', verse.raiseAsset)}</TooltipContent>
                  </Tooltip>
                </span>
              </div>
              <div className="pol-asset__side">
                <span className="pol-label">{copy.ytBalance}</span>
                <strong className="pol-asset__amount" data-numeric>
                  {formatAmount(pol.myYt, locale)}
                </strong>
              </div>
            </div>
            {/* 可领 YT=创世分配的一次性领取（claimNormalYT/claimLeveragedYT），
                资格来自创世参与而非 YT 余额——资格说明收进标签旁 ⊙ 气泡（2026-09-24 用户裁定） */}
            <div className="pol-claim">
              <div className="pol-claim__info">
                <span className="pol-label">
                  {copy.claimableYt}
                  <Tooltip>
                    <TooltipTrigger render={<span className="create-info" aria-label={copy.claimYtEligibility} />}>
                      <Info aria-hidden="true" />
                    </TooltipTrigger>
                    <TooltipContent>{copy.claimYtEligibility}</TooltipContent>
                  </Tooltip>
                </span>
                <strong data-numeric>
                  {formatAmount(pol.claimableYt, locale)} {ytSymbol}
                </strong>
              </div>
              {/* 原型纪律：写操作一律禁用（可领>0 也不伪造链上成功）。
                  2026-09-26 用户裁定：Claim 钮凹陷井底+悬停——包裹层 .pol-claim__btn
                  把 hover 底钉在井底 tint（凹陷感悬停不弹起，规则见 globals.css 按钮区） */}
              <span className="pol-claim__btn">
                <Button variant="outline" size="sm" disabled>
                  {copy.claimYt}
                </Button>
              </span>
            </div>
            {/* 拆分⇄合并换向器（2026-09-25 用户裁定：补 merge + 草稿公式行升级仪器盒）：
                两行=两向，方向符章（分叉=split/汇聚=merge，同分缝 Y 型语言）+ 等式
                （token 单色次级，身份由资产行章承载）+ 动作钮。2026-09-26 用户裁定：
                locked 态两钮改弹操作窗（PolSplitMergeDialog），unlocked 保持禁用（链上已关） */}
            <div className="pol-card__actions pol-card__actions--flow">
              <div className="pol-flow">
                <div className="pol-flow__row">
                  <span className="pol-flow__dir" aria-hidden="true">
                    <svg viewBox="0 0 16 16" fill="none">
                      <path d="M1.5 8H6L14.5 3M6 8l8.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
                    </svg>
                  </span>
                  <span className="pol-flow__eq" data-numeric>
                    <span className="pol-flow__tok" data-token="pol">1 POL</span>
                    <span className="pol-flow__op">→</span>
                    <span className="pol-flow__tok" data-token="pt">1 PT</span>
                    <span className="pol-flow__op">+</span>
                    <span className="pol-flow__tok" data-token="yt">1 YT</span>
                  </span>
                  {locked ? (
                    <PolSplitMergeDialog locale={locale} verse={verse} pol={pol} mode="split" />
                  ) : (
                    <Button variant="outline" size="sm" disabled title={copy.splitClosed}>
                      {copy.splitPol}
                    </Button>
                  )}
                </div>
                <div className="pol-flow__row">
                  <span className="pol-flow__dir" aria-hidden="true">
                    <svg viewBox="0 0 16 16" fill="none">
                      <path d="M14.5 8H10L1.5 3M10 8l-8.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
                    </svg>
                  </span>
                  <span className="pol-flow__eq" data-numeric>
                    <span className="pol-flow__tok" data-token="pt">1 PT</span>
                    <span className="pol-flow__op">+</span>
                    <span className="pol-flow__tok" data-token="yt">1 YT</span>
                    <span className="pol-flow__op">→</span>
                    <span className="pol-flow__tok" data-token="pol">1 POL</span>
                  </span>
                  {locked ? (
                    <PolSplitMergeDialog locale={locale} verse={verse} pol={pol} mode="merge" />
                  ) : (
                    <Button variant="outline" size="sm" disabled title={copy.splitClosed}>
                      {copy.mergePol}
                    </Button>
                  )}
                </div>
              </div>
              {/* locked 态 note 行删（2026-09-25 用户裁定：等式行已示，冗余）；
                  unlocked 仍需 splitClosed 告知链上关闭 */}
              {!locked ? <p className="pol-card__note">{copy.splitClosed}</p> : null}
            </div>
          </section>
        </div>
      ) : (
        <p className="panel-note">
          <Slot>{copy.onChainSlot}</Slot>
        </p>
      )}
      <SourceRef value="docs/page-briefs/source-map.md#M14" />
    </div>
  )
}

/** DAO 标签：概览 + Tally 外链卡 + 当期/上期周期激励（Q11：不含提案列表） */
export function DaoPanel({
  locale,
  verse,
  governance,
}: {
  locale: Locale
  verse: PrototypeVerse
  governance: PrototypeGovernanceState | null
}) {
  const copy = getCopy(locale).verseDesk
  if (!governance) {
    return (
      <div className="dao-panel">
        <h3 className="panel-title">{copy.daoTitle.replace('{symbol}', verse.symbol)}</h3>
        <p className="panel-note">
          <Slot>{copy.onChainSlot}</Slot>
        </p>
      </div>
    )
  }

  return (
    <div className="dao-panel">
      <section className="dao-overview">
        <header className="dao-panel__head">
          <h3 className="panel-title">{copy.daoTitle.replace('{symbol}', verse.symbol)}</h3>
          <div className="dao-panel__head-governor" data-numeric>
            {governance.governorAddress ? (
              <>
                {copy.governorLabel}: <CopyAddress locale={locale} value={governance.governorAddress} />
              </>
            ) : (
              <Slot>{copy.onChainSlot}</Slot>
            )}
          </div>
          <dl className="dao-panel__head-live" data-numeric>
            <dt>{copy.liveIn}</dt>
            <dd>{verse.governanceChainName}</dd>
          </dl>
        </header>
        <dl className="dao-panel__stats" data-numeric>
          <div>
            <dt>{copy.delegates}</dt>
            <dd>
              {governance.delegates != null ? formatAmount(governance.delegates, locale) : <Slot>{copy.onChainSlot}</Slot>}
            </dd>
          </div>
          <div>
            <dt>{copy.proposals}</dt>
            <dd>
              {governance.proposalCount ? (
                <>
                  {governance.proposalCount.total}{' '}
                  <span className="stat-flag">
                    ({copy.activeCount.replace('{n}', String(governance.proposalCount.active))})
                  </span>
                </>
              ) : (
                <Slot>{copy.onChainSlot}</Slot>
              )}
            </dd>
          </div>
          <div>
            <dt>{copy.votingPower}</dt>
            <dd>
              {governance.totalVotingPower != null
                ? `${formatMarketCap(governance.totalVotingPower)} s${verse.symbol}`
                : <Slot>{copy.onChainSlot}</Slot>}
            </dd>
          </div>
          <div className="dao-panel__tally">
            <dt className="dao-panel__tally-label">
              {copy.tallyCard}
              <Tooltip>
                <TooltipTrigger render={<span className="create-info" aria-label={copy.tallyNote} />}>
                  <Info aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent>{copy.tallyNote}</TooltipContent>
              </Tooltip>
            </dt>
            <dd>
              <Button variant="outline" size="sm" disabled>
                {copy.tallyEnter}
                <CactusLogo className="dao-panel__tally-logo" />
              </Button>
            </dd>
          </div>
        </dl>
      </section>

      <div className="dao-panel__cycles">
        <section className="cycle-card" data-current>
          <header className="cycle-card__head">
            <div className="cycle-card__head-meta">
              <h4 className="panel-subtitle">{copy.cycleTitle}</h4>
            </div>
            {governance.incentivizerAddress ? (
              <span className="cycle-card__head-incentivizer">
                {copy.incentivizer}: <CopyAddress locale={locale} value={governance.incentivizerAddress} />
              </span>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              className="cycle-card__head-finalize"
              disabled={governance.finalized}
              title={copy.finalizeNote}
            >
              {copy.finalize}
            </Button>
          </header>
          <dl className="cycle-card__stats" data-numeric>
            <div>
              <dt>{copy.cycleChip}</dt>
              <dd>
                #{governance.cycleNumber}
                <span className="stat-sub">
                  ({governance.finalized ? copy.ended : `${copy.endsIn} ${formatStamp(governance.cycleEndsAt)}`})
                </span>
              </dd>
            </div>
            {governance.treasuryUAsset != null && governance.treasuryAssets ? (
              <DaoFundDialog
                locale={locale}
                title={copy.treasuryDetailsTitle}
                totalUsd={governance.treasuryUAsset}
                assets={governance.treasuryAssets}
              >
                <>
                  <dt>
                    {copy.treasury}
                    <DaoDots />
                  </dt>
                  <dd>${formatAmount(governance.treasuryUAsset, locale)}</dd>
                </>
              </DaoFundDialog>
            ) : (
              <div>
                <dt>{copy.treasury}</dt>
                <dd>
                  {governance.treasuryUAsset != null ? (
                    `$${formatAmount(governance.treasuryUAsset, locale)}`
                  ) : (
                    <Slot>{copy.onChainSlot}</Slot>
                  )}
                </dd>
              </div>
            )}
            <div>
              <dt>{copy.rewardRatio}</dt>
              <dd>
                {governance.rewardRatioBps != null
                  ? `${governance.rewardRatioBps / 100}%`
                  : <Slot>{copy.onChainSlot}</Slot>}
              </dd>
            </div>
            <div>
              <dt>{copy.cumulativePool}</dt>
              <dd>
                {governance.cumulativeIncentivePool != null
                  ? `$${formatAmount(governance.cumulativeIncentivePool, locale)}`
                  : <Slot>{copy.onChainSlot}</Slot>}
              </dd>
            </div>
            {governance.currentCycleVotes ? (
              <>
                <div>
                  <dt>{copy.cycleTotalVotes}</dt>
                  <dd>
                    {formatAmount(governance.currentCycleVotes.total, locale)}{' '}
                    <span className="stat-unit">{copy.votesUnit}</span>
                  </dd>
                </div>
                <div>
                  <dt>{copy.cycleYourVotes}</dt>
                  <dd>
                    {formatAmount(governance.currentCycleVotes.mine, locale)}{' '}
                    <span className="stat-unit">{copy.votesUnit}</span>
                  </dd>
                </div>
              </>
            ) : null}
          </dl>
          {governance.currentCycleVotes ? (
            <div className="cycle-card__banner" data-numeric>
              <span>{copy.estClaimable}</span>
              <strong>
                {governance.estimatedClaimable != null
                  ? `~$${formatAmount(governance.estimatedClaimable, locale)}`
                  : '--'}
              </strong>
            </div>
          ) : null}
          <p className="panel-note">{copy.finalizeNote}</p>
        </section>

        {governance.lastCycle ? (
          <section className="cycle-card">
            <header className="cycle-card__head">
              <div className="cycle-card__head-meta">
                <h4 className="panel-subtitle">{copy.lastCycleTitle}</h4>
                {governance.claimWindowEndsAt ? (
                  <span data-numeric>{formatStamp(governance.claimWindowEndsAt)}</span>
                ) : null}
              </div>
            </header>
            <dl className="cycle-card__stats" data-numeric>
              <div>
                <dt>{copy.lastCycleChip}</dt>
                <dd>#{governance.lastCycle.number}</dd>
              </div>
              {governance.lastCycle.treasuryAssets ? (
                <DaoFundDialog
                  locale={locale}
                  title={copy.lastTreasuryDetailsTitle}
                  totalUsd={governance.lastCycle.treasuryUAsset}
                  assets={governance.lastCycle.treasuryAssets}
                >
                  <>
                    <dt>
                      {copy.treasury}
                      <DaoDots />
                    </dt>
                    <dd>${formatAmount(governance.lastCycle.treasuryUAsset, locale)}</dd>
                  </>
                </DaoFundDialog>
              ) : (
                <div>
                  <dt>{copy.treasury}</dt>
                  <dd>${formatAmount(governance.lastCycle.treasuryUAsset, locale)}</dd>
                </div>
              )}
              {governance.lastCycle.unclaimedAssets ? (
                <DaoFundDialog
                  locale={locale}
                  title={copy.unclaimedDetailsTitle}
                  totalUsd={governance.lastCycle.remainingRewards}
                  assets={governance.lastCycle.unclaimedAssets}
                >
                  <>
                    <dt>
                      {copy.remainingRewards}
                      <DaoDots />
                    </dt>
                    <dd>${formatAmount(governance.lastCycle.remainingRewards, locale)}</dd>
                  </>
                </DaoFundDialog>
              ) : (
                <div>
                  <dt>{copy.remainingRewards}</dt>
                  <dd>${formatAmount(governance.lastCycle.remainingRewards, locale)}</dd>
                </div>
              )}
              <div>
                <dt>{copy.cycleTotalVotes}</dt>
                <dd>
                  {formatAmount(governance.lastCycle.totalVotes, locale)}{' '}
                  <span className="stat-unit">{copy.votesUnit}</span>
                </dd>
              </div>
              <div>
                <dt>{copy.cycleYourVotes}</dt>
                <dd>
                  {formatAmount(governance.lastCycle.myVotes, locale)}{' '}
                  <span className="stat-unit">{copy.votesUnit}</span>
                </dd>
              </div>
              <div>
                <dt>{copy.yourClaimable}</dt>
                <dd className="stat-action">
                  ${formatAmount(governance.lastCycle.myClaimable, locale)}
                  <Button variant="outline" size="sm" disabled title={copy.claimWindowNote}>
                    {copy.claimRewards}
                  </Button>
                </dd>
              </div>
            </dl>
            <p className="panel-note">{copy.claimWindowNote}</p>
          </section>
        ) : null}
      </div>
      <p className="panel-note">{copy.votingWeightNote}</p>
      <SourceRef value="docs/page-briefs/source-map.md#M10" />
    </div>
  )
}

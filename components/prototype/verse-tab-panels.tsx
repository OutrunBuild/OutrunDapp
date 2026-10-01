import type {
  Locale,
  PrototypeGovernanceState,
  PrototypePolPosition,
  PrototypeVerse,
  PrototypeVerseTrade,
} from '@/lib/data/prototype-repository'

import { useId } from 'react'
import { getPrototypeAssetUsdSample } from '@/lib/data/prototype-repository'

import { Info } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CactusLogo } from './cactus-logo'
import { CopyAddress } from './copy-address'
import { DaoDots, DaoFundDialog } from './dao-fund-dialog'
import { getCopy } from './copy'
import { PoolAddLiquidityDialog } from './pool-add-liquidity-dialog'
import { PoolRemoveLiquidityDialog } from './pool-remove-liquidity-dialog'
import { PolMintDialog } from './pol-mint-dialog'
import { PolRedeemLpDialog } from './pol-redeem-lp-dialog'
import { PolFlashSwapDialog } from './pol-flash-swap-dialog'
import { PolRedeemPtYtDialog } from './pol-redeem-pt-yt-dialog'
import { PolSplitMergeDialog } from './pol-split-merge-dialog'
import { formatAmount, formatDay, formatMarketCap, formatPercent, formatStamp, SourceRef } from './signal-ui'

function Slot({ children }: { children: React.ReactNode }) {
  return <span className="ax-slot">{children}</span>
}

/** Liquidity 标签：四池总览 + 池卡（four-pools.md:9-14；APR/量=样本+读链槽位）；
 *  池卡双钮 Add/Remove 2026-09-27 改弹窗（PoolAddLiquidityDialog/PoolRemoveLiquidityDialog，
 *  机制分层见各组件头注；同日用户裁定 Add 短文案） */
export function LiquidityPanel({
  locale,
  verse,
  trade,
  pol,
}: {
  locale: Locale
  verse: PrototypeVerse
  trade: PrototypeVerseTrade
  pol: PrototypePolPosition | null
}) {
  const copy = getCopy(locale).verseDesk
  // 总览=四池合计（Q2 用户裁定）；统计条的 Liq/Vol 是主池口径，两处不同源
  const volumeTotal = trade.pools.reduce(
    (sum, pool) => (pool.volume24h != null ? sum + pool.volume24h : sum),
    0,
  )
  const hasVolume = trade.pools.some((pool) => pool.volume24h != null)
  // ≈$ 换算与主池联动配比（同 PolPanel 的 uAssetUsd / price 源）
  const uAssetUsd = getPrototypeAssetUsdSample(verse.raiseAsset)

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
            {/* 三段竖排（2026-09-30 布局重构：原单行 6 元素在 ~480px 卡宽互相挤压，
                统计格被压到 54px 数值换行、四卡高矮不齐）：头行=交易对+APR 决策读数、
                数据行=TVL+24h 量、底行=全宽等分双钮 */}
            <header className="pool-card__head">
              <strong className="pool-card__pair" data-numeric>
                {pool.baseSymbol}/{pool.quoteSymbol}
              </strong>
              <span className="pool-card__apr">
                <span className="pool-card__apr-label">{copy.aprLabel}</span>
                <strong className="pool-card__apr-value" data-numeric>
                  {pool.apr7d != null ? (
                    `${formatPercent(pool.apr7d * 100, locale)}%`
                  ) : (
                    <Slot>{copy.onChainSlot}</Slot>
                  )}
                </strong>
              </span>
            </header>
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
            </dl>
            {/* 池卡双钮 Add/Remove（2026-09-27 用户裁定：新增 Remove 移除流动性、Add 改短文案）；
                2026-09-30 起收全宽等分行（同 POL 终端卡满行钮语言） */}
            <div className="pool-card__actions">
              <PoolAddLiquidityDialog
                locale={locale}
                pool={pool}
                pol={pol}
                price={trade.tokenStats.price}
                uAssetUsd={uAssetUsd}
              />
              <PoolRemoveLiquidityDialog
                locale={locale}
                pool={pool}
                pol={pol}
                price={trade.tokenStats.price}
                uAssetUsd={uAssetUsd}
              />
            </div>
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
 * AlreadyUnlocked）；Redeem PT/YT=unlocked 结算后销毁赎回（POLSplitterUpgradeable.sol:365/387，
 * 2026-09-27 换向器在 unlocked 改两行赎回）；Claim YT=创世锁定后按出资比例一次性领取
 * （MemeverseSettlementImpl.sol:88，杠杆参与者按利息比例 claimLeveragedYT）；
 * 名义价值=2×uAsset 侧（pt-yt-splitter.md §4）。 */
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
  const unlocked = verse.stage === 'unlocked'
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
  // PT/YT 每枚机制值（2026-09-27 用户裁定井读数重构）：
  // PT 腿=固定兑付率 uAssetPerPol（创世锁仓一次性登记，locked/unlocked 皆确定，非 1:1），
  // 美元=腿×uAssetUsd 样本；
  // YT 腿（双腿形态——pol-splitter.md「YT 结算兑付=uAsset+Memecoin 两币」，2026-09-28 用户裁定）：
  // memecoin 腿两阶段皆可推导（1 PT+1 YT=1 POL=M meme+U uAsset，PT 固定吃掉 uAsset 侧 →
  // 残差名义=memecoin 侧=uAssetPerPol÷主池价；unlocked 用结算样本 ytRedeemMemecoinPerUnit）；
  // uAsset 腿=ytRedeemUAssetPerUnit 样本（locked=结算预估样本（造数裁定）+unlocked=结算派生真值）。
  // 美元=(meme 腿×主池价+uAsset 腿)×uAssetUsd；样本/价缺失 → null → '--'。
  const ptLeg = pol ? pol.uAssetPerPol : null
  const ptUsd = ptLeg != null && uAssetUsd != null ? ptLeg * uAssetUsd : null
  const ytMemeLeg = !pol
    ? null
    : unlocked
      ? pol.ytRedeemMemecoinPerUnit
      : price != null && price > 0
        ? pol.uAssetPerPol / price
        : null
  const ytUAssetLeg = pol ? pol.ytRedeemUAssetPerUnit : null
  const ytUsd =
    pol == null || uAssetUsd == null || ytMemeLeg == null || ytUAssetLeg == null || price == null
      ? null
      : (ytMemeLeg * price + ytUAssetLeg) * uAssetUsd

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
                      <TooltipTrigger className="create-info" aria-label={copy.nominalNote}>
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
                {/* 2026-09-27 用户裁定：Redeem 恒禁用改弹窗（PolRedeemLpDialog——销毁 POL
                    1:1 换主池 LP 代币，机制见该组件头注）；仅 unlocked（合约 NotUnlockedStage
                    闸门，fixture 域 pol 持仓仅 locked/unlocked——与原 !locked 渲染域等价），
                    locked 机制性不渲染灰钮、Mint 撑满行（2026-09-25 用户裁定）；
                    note 行 2026-09-25 删、title 悬浮 2026-09-27 全站删 */}
                {unlocked ? (
                  <PolRedeemLpDialog locale={locale} verse={verse} pol={pol} />
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
            {/* 双生井 v3（2026-09-28 用户裁定：井=纯读对称——身份头+账目行+美元回声，井底无钮；
                机制等式升为井组头（与左 seam 分缝成「左符号右公式」）；操作统一井组下通栏：
                locked=Flash Swap/Split/Merge 三等宽、unlocked=Redeem PT/YT 两等宽 */}
            <p className="pol-twin__equation">
              <span data-numeric>{`1 ${polSymbol} = 1 PT + 1 YT`}</span>
              <Tooltip>
                <TooltipTrigger className="create-info" aria-label={copy.splitNote}>
                  <Info aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent>{copy.splitNote}</TooltipContent>
              </Tooltip>
            </p>
            <div className="pol-twin">
              <div className="pol-twin__well" data-token="pt">
                <div className="pol-twin__head">
                  <span className="pol-glyph pol-glyph--pt">PT</span>
                  <div className="pol-twin__id">
                    <strong className="pol-twin__symbol" data-numeric>
                      {ptSymbol}
                    </strong>
                    {/* 机制一行注只留全称，说明收进 ⊙ 气泡（2026-09-25 用户裁定） */}
                    <span className="pol-twin__desc">
                      {copy.ptFullName}
                      <Tooltip>
                        <TooltipTrigger
                          className="create-info"
                          aria-label={copy.ptTip.replace('{asset}', verse.raiseAsset)}
                        >
                          <Info aria-hidden="true" />
                        </TooltipTrigger>
                        <TooltipContent>{copy.ptTip.replace('{asset}', verse.raiseAsset)}</TooltipContent>
                      </Tooltip>
                    </span>
                  </div>
                </div>
                <div className="pol-twin__quote">
                  {/* 账目行=名义价值口径（2026-09-28 用户裁定：须明示非市场价格） */}
                  <span className="pol-label">
                    {copy.nominalValue}
                    <Tooltip>
                      <TooltipTrigger className="create-info" aria-label={copy.ptNominalTip}>
                        <Info aria-hidden="true" />
                      </TooltipTrigger>
                      <TooltipContent>{copy.ptNominalTip}</TooltipContent>
                    </Tooltip>
                  </span>
                  <div className="pol-twin__legs" data-numeric>
                    <span>
                      {ptLeg != null
                        ? `${formatAmount(ptLeg, locale)} ${verse.raiseAsset}`
                        : '--'}
                    </span>
                  </div>
                </div>
                <p className="pol-twin__usd" data-numeric>
                  ≈ {ptUsd != null ? `$${formatAmount(ptUsd, locale)}` : <Slot>{copy.onChainSlot}</Slot>}
                </p>
              </div>
              <div className="pol-twin__well" data-token="yt">
                <div className="pol-twin__head">
                  <span className="pol-glyph pol-glyph--yt">YT</span>
                  <div className="pol-twin__id">
                    <strong className="pol-twin__symbol" data-numeric>
                      {ytSymbol}
                    </strong>
                    <span className="pol-twin__desc">
                      {copy.ytFullName}
                      <Tooltip>
                        <TooltipTrigger
                          className="create-info"
                          aria-label={copy.ytTip.replace('{asset}', verse.raiseAsset)}
                        >
                          <Info aria-hidden="true" />
                        </TooltipTrigger>
                        <TooltipContent>{copy.ytTip.replace('{asset}', verse.raiseAsset)}</TooltipContent>
                      </Tooltip>
                    </span>
                  </div>
                </div>
                <div className="pol-twin__quote">
                  {/* 账目行=名义价值口径（2026-09-28 用户裁定：须明示非市场价格）；
                      双腿：unlocked=结算样本真值；locked=meme 腿推导+uAsset 腿预估样本（造数裁定） */}
                  <span className="pol-label">
                    {copy.nominalValue}
                    <Tooltip>
                      <TooltipTrigger className="create-info" aria-label={copy.ytNominalTip}>
                        <Info aria-hidden="true" />
                      </TooltipTrigger>
                      <TooltipContent>{copy.ytNominalTip}</TooltipContent>
                    </Tooltip>
                  </span>
                  <div className="pol-twin__legs" data-numeric>
                    <span>
                      {ytMemeLeg != null
                        ? `${formatAmount(ytMemeLeg, locale)} ${verse.symbol}`
                        : '--'}
                    </span>
                    {/* uAsset 腿：unlocked=结算样本真值；locked=结算预估样本（造数裁定） */}
                    <span className="pol-twin__leg-extra">
                      + {ytUAssetLeg != null ? `${formatAmount(ytUAssetLeg, locale)} ${verse.raiseAsset}` : '--'}
                    </span>
                  </div>
                </div>
                <p className="pol-twin__usd" data-numeric>
                  ≈ {ytUsd != null ? `$${formatAmount(ytUsd, locale)}` : <Slot>{copy.onChainSlot}</Slot>}
                </p>
              </div>
            </div>
            {/* 通栏操作区（v3 2026-09-28：井底清空纯读，操作统一井组下通栏——跨阶段位置统一；
                locked=Flash Swap/Split/Merge 三等宽（Flash Swap 属 YT 单通道——yt-flash-swap.md）、
                unlocked=Redeem PT/YT 两等宽；余额展示在各弹窗 Balance/Max） */}
            <div className="pol-card__btns">
              {unlocked ? (
                <>
                  <PolRedeemPtYtDialog
                    locale={locale}
                    verse={verse}
                    pol={pol}
                    mode="pt"
                    price={price}
                    uAssetUsd={uAssetUsd}
                  />
                  <PolRedeemPtYtDialog
                    locale={locale}
                    verse={verse}
                    pol={pol}
                    mode="yt"
                    price={price}
                    uAssetUsd={uAssetUsd}
                  />
                </>
              ) : (
                <>
                  <PolFlashSwapDialog locale={locale} verse={verse} pol={pol} uAssetUsd={uAssetUsd} />
                  <PolSplitMergeDialog locale={locale} verse={verse} pol={pol} mode="split" />
                  <PolSplitMergeDialog locale={locale} verse={verse} pol={pol} mode="merge" />
                </>
              )}
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
  const finalizeNoteId = useId()
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
                <TooltipTrigger className="create-info" aria-label={copy.tallyNote}>
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
                <span className="cycle-card__head-label">{copy.incentivizer}:</span>{' '}
                <CopyAddress locale={locale} value={governance.incentivizerAddress} />
              </span>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              className="cycle-card__head-finalize"
              disabled={governance.finalized}
              aria-describedby={finalizeNoteId}
            >
              {copy.finalize}
              <Tooltip>
                <TooltipTrigger render={<span className="create-info" aria-hidden="true" />}>
                  <Info aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent>{copy.finalizeNote}</TooltipContent>
              </Tooltip>
            </Button>
            {/* sr-only 置于按钮外：放内部会被并进按钮可访问名称，说明应由 describedby 单独播报 */}
            <span id={finalizeNoteId} className="sr-only">
              {copy.finalizeNote}
            </span>
          </header>
          <dl className="cycle-card__stats" data-numeric>
            <div>
              <dt>{copy.cycleChip}</dt>
              <dd className="stat-meta">
                #{governance.cycleNumber}{' '}
                <span className="stat-sub">
                  ({governance.finalized ? copy.ended : `${copy.endsIn} ${formatDay(governance.cycleEndsAt, locale)}`})
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
        </section>

        {governance.lastCycle ? (
          <section className="cycle-card">
            <header className="cycle-card__head">
              <div className="cycle-card__head-meta">
                <h4 className="panel-subtitle">{copy.lastCycleTitle}</h4>
              </div>
            </header>
            <dl className="cycle-card__stats" data-numeric>
              <div>
                <dt>{copy.lastCycleChip}</dt>
                <dd className="stat-meta">#{governance.lastCycle.number}</dd>
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
              {governance.lastCycle.claimableAssets ? (
                <DaoFundDialog
                  locale={locale}
                  title={copy.claimableDetailsTitle}
                  totalUsd={governance.lastCycle.myClaimable}
                  assets={governance.lastCycle.claimableAssets}
                  actionLabel={copy.claimRewards}
                >
                  <>
                    <dt className="cycle-card__claim-label">
                      {copy.yourClaimable}
                      <DaoDots />
                      <Tooltip>
                        <TooltipTrigger className="create-info" aria-label={copy.claimWindowNote}>
                          <Info aria-hidden="true" />
                        </TooltipTrigger>
                        <TooltipContent>{copy.claimWindowNote}</TooltipContent>
                      </Tooltip>
                    </dt>
                    <dd className="stat-action">
                      ${formatAmount(governance.lastCycle.myClaimable, locale)}
                      {/* 领取钮保留原位原样式；pointer-events-none 让点击穿到芯片触发器开明细弹窗
                          （原生 disabled 钮会吞点击——2026-09-30 踩坑，动作在弹窗 CTA） */}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        className="pointer-events-none"
                      >
                        {copy.claimRewards}
                      </Button>
                    </dd>
                  </>
                </DaoFundDialog>
              ) : (
                <div>
                  <dt className="cycle-card__claim-label">
                    {copy.yourClaimable}
                    <Tooltip>
                      <TooltipTrigger className="create-info" aria-label={copy.claimWindowNote}>
                        <Info aria-hidden="true" />
                      </TooltipTrigger>
                      <TooltipContent>{copy.claimWindowNote}</TooltipContent>
                    </Tooltip>
                  </dt>
                  <dd className="stat-action">
                    ${formatAmount(governance.lastCycle.myClaimable, locale)}
                    <Button variant="outline" size="sm" disabled>
                      {copy.claimRewards}
                    </Button>
                  </dd>
                </div>
              )}
            </dl>
          </section>
        ) : null}
      </div>
      <SourceRef value="docs/page-briefs/source-map.md#M10" />
    </div>
  )
}

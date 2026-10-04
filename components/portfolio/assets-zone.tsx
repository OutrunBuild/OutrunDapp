'use client'

/**
 * ②资产与跨链区（2026-10-02 裁定：跨链功能并入 Portfolio，v1 无 /bridge 独立页；
 * 同日二轮面板化：余额=Data surface 面板（可跨链行 + 只读页脚），在途=Signal panel
 * （状态面板语法）。在途列表只挂未终结消息（sent/stranded）；delivered/settled=
 * 历史不展示（PD-02 删跨链历史 + M4 否决）。
 */
import type {
  FixtureBridgeMessageView,
  FixturePsmPair,
  FixtureUsrSavings,
  FixtureWalletAsset,
  Locale,
} from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { ChainLogoMark } from '../global/chain-icons'
import { formatAmount, formatDay, SectionHeading } from '../global/signal-ui'
import { BridgeDialog, ConvertDialog, StrandedDialog, UsrSavingsDialog } from './portfolio-dialogs'

export type AssetRowView = FixtureWalletAsset & {
  /** PSM 配对（1:1 转换入口）；null=无配对不渲染该动作 */
  psm: FixturePsmPair | null
  /** 同族 USR 储蓄（存入储蓄入口）；null=无金库 */
  usr: FixtureUsrSavings | null
}

export function AssetsZone({
  locale,
  assets,
  transit,
  chains,
  reserveBalances,
}: {
  locale: Locale
  assets: AssetRowView[]
  /** 未终结跨链消息（sent/stranded） */
  transit: FixtureBridgeMessageView[]
  /** 主网链族（跨链弹窗 from/to） */
  chains: Array<{ chainId: number; name: string }>
  /** 储备资产余额表（转换弹窗 Redeem 侧 Max） */
  reserveBalances: Record<string, number>
}) {
  const copy = getCopy(locale).portfolio.assets
  const bridgeable = assets.filter((asset) => asset.bridgeable)
  const readonlyAssets = assets.filter((asset) => !asset.bridgeable)

  return (
    <section className="pf-assets" id="pf-assets">
      <SectionHeading title={copy.title} description={copy.sub} />
      <div className="pf-panel">
        <header className="pf-panel__bar">
          <span>{copy.balancesLabel}</span>
          <span data-numeric>{bridgeable.length}</span>
        </header>
        <ul className="pf-assets__list">
          {bridgeable.map((asset) => (
            <li key={asset.assetId} className="pf-asset-row" data-kind={asset.kind}>
              <div className="pf-asset-row__id">
                <strong>{asset.symbol}</strong>
                {asset.kind === 'credit' ? <span className="pf-asset-row__kind">{copy.creditNote}</span> : null}
              </div>
              <div className="pf-asset-row__total" data-numeric>
                {formatAmount(asset.total, locale, true)}
              </div>
              <div className="pf-asset-row__chains">
                {asset.chains.map((chain) => (
                  <span key={chain.chainId} className="pf-asset-row__chain">
                    <ChainLogoMark chainId={chain.chainId} size={14} aria-hidden="true" />
                    <span data-numeric>{formatAmount(chain.amount, locale, true)}</span>
                  </span>
                ))}
              </div>
              <div className="pf-asset-row__actions">
                {asset.kind === 'uasset' && asset.psm != null ? (
                  <ConvertDialog
                    locale={locale}
                    triggerLabel={copy.convertCta}
                    uAssetSymbol={asset.symbol}
                    reserveSymbol={asset.psm.reserveSymbol}
                    feeIn={asset.psm.feeIn}
                    feeOut={asset.psm.feeOut}
                    headroom={asset.psm.headroom}
                    uAssetBalance={asset.total}
                    reserveBalance={reserveBalances[asset.psm.reserveSymbol] ?? null}
                  />
                ) : null}
                {asset.kind === 'uasset' && asset.usr != null ? (
                  <UsrSavingsDialog
                    locale={locale}
                    triggerLabel={copy.saveCta}
                    mode="deposit"
                    vault={asset.usr}
                    uAssetBalance={asset.total}
                  />
                ) : null}
                <BridgeDialog
                  locale={locale}
                  triggerLabel={copy.bridgeCta}
                  assetSymbol={asset.symbol}
                  chains={chains}
                  balancesByChain={asset.chains.map((chain) => ({
                    chainId: chain.chainId,
                    name: chain.chainName,
                    amount: chain.amount,
                  }))}
                />
              </div>
            </li>
          ))}
        </ul>
        {readonlyAssets.length > 0 ? (
          <footer className="pf-panel__footer">
            <span>{copy.readonlyLabel}</span>
            {readonlyAssets.map((asset) => (
              <span key={asset.assetId}>
                <strong>{asset.symbol}</strong>{' '}
                <span data-numeric>{formatAmount(asset.total, locale, true)}</span>
              </span>
            ))}
          </footer>
        ) : null}
      </div>

      {transit.length > 0 ? (
        <div className="pf-panel pf-panel--signal pf-transit">
          <header className="pf-panel__bar">
            <span>{copy.inTransitTitle}</span>
            <span data-numeric>{transit.length}</span>
          </header>
          <ul>
            {transit.map((message) => (
              <li key={message.id} data-stage={message.stage}>
                <span className="pf-transit__route">
                  <ChainLogoMark chainId={message.fromChainId} size={14} aria-hidden="true" />
                  {message.fromChainName}
                  <span aria-hidden="true">→</span>
                  <ChainLogoMark chainId={message.toChainId} size={14} aria-hidden="true" />
                  {message.toChainName}
                </span>
                <span data-numeric>
                  {formatAmount(message.amount, locale, true)} {message.assetSymbol}
                </span>
                <span className="pf-transit__meta">
                  <span className="pf-transit__stage" data-stage={message.stage}>
                    {message.stage === 'sent' ? copy.stageSent : copy.stageStranded}
                  </span>
                  <span data-numeric>{formatDay(message.sentAt, locale)}</span>
                </span>
                {message.stage === 'stranded' ? (
                  <StrandedDialog locale={locale} triggerLabel={copy.recoverCta} message={message} />
                ) : null}
              </li>
            ))}
          </ul>
          <footer className="pf-panel__footer">{copy.inTransitSafe}</footer>
        </div>
      ) : null}
    </section>
  )
}

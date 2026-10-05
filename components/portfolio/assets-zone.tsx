'use client'

/**
 * ②资产与跨链区（2026-10-02 裁定：跨链功能并入 Portfolio，v1 无 /bridge 独立页；
 * 余额=Data surface 面板（可跨链行 + 只读页脚）。在途 Signal panel 已删
 * （2026-10-04 裁定）：sent 无需行动不占版面，stranded 由①待办区承接。
 */
import type { FixturePsmPair, FixtureWalletAsset, Locale } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { ChainLogoMark } from '../global/chain-icons'
import { formatAmount, formatMarketCap, SectionHeading } from '../global/signal-ui'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { BridgeDialog, ConvertDialog } from './portfolio-dialogs'

export type AssetRowView = FixtureWalletAsset & {
  /** PSM 配对（Convert 入口）；null=无配对不渲染该动作 */
  psm: FixturePsmPair | null
}

export function AssetsZone({
  locale,
  assets,
  chains,
  reserveBalances,
}: {
  locale: Locale
  assets: AssetRowView[]
  /** 主网链族（跨链弹窗 from/to） */
  chains: Array<{ chainId: number; name: string }>
  /** 储备资产余额表（转换弹窗 Redeem 侧 Max） */
  reserveBalances: Record<string, number>
}) {
  const copy = getCopy(locale).portfolio.assets
  const bridgeable = assets.filter((asset) => asset.bridgeable)
  // Credit 族与 uAsset 族分区（2026-10-04 用户裁定）：uAsset 在前，Credit 组带分隔铭牌
  const uassetRows = bridgeable.filter((asset) => asset.kind === 'uasset')
  const creditRows = bridgeable.filter((asset) => asset.kind === 'credit')

  const row = (asset: AssetRowView) => (
    <li key={asset.assetId} className="pf-asset-row" data-kind={asset.kind}>
      {/* UUSD 族无单一链属（多链发行），链徽会误读成 ETH——用美元记号字形当资产标识。
          链徽悬停气泡=链名（2026-10-04 用户裁定，仓位表同款） */}
      <span className="pf-asset-row__tile">
        {asset.symbol.startsWith('UUSD') ? (
          <span className="pf-asset-row__tile-glyph" aria-hidden="true">
            $
          </span>
        ) : asset.chains[0] ? (
          <Tooltip>
            <TooltipTrigger aria-label={asset.chains[0].chainName} className="pf-asset-row__icon-trigger">
              <ChainLogoMark chainId={asset.chains[0].chainId} size={20} />
            </TooltipTrigger>
            <TooltipContent>{asset.chains[0].chainName}</TooltipContent>
          </Tooltip>
        ) : (
          <ChainLogoMark chainId={1} size={20} aria-hidden="true" />
        )}
      </span>
      <div className="pf-asset-row__id">
        <strong>{asset.symbol}</strong>
        <span className="pf-asset-row__chains">
          {asset.chains.map((chain) => (
            <span key={chain.chainId} className="pf-asset-row__chain">
              <Tooltip>
                <TooltipTrigger aria-label={chain.chainName} className="pf-asset-row__icon-trigger">
                  <ChainLogoMark chainId={chain.chainId} size={14} />
                </TooltipTrigger>
                <TooltipContent>{chain.chainName}</TooltipContent>
              </Tooltip>
              <span data-numeric>{formatAmount(chain.amount, locale, true)}</span>
            </span>
          ))}
        </span>
      </div>
      <div className="pf-asset-row__balance">
        <span className="pf-asset-row__total" data-numeric>
          {formatAmount(asset.total, locale, true)}
        </span>
        {asset.usdSample != null ? (
          <span className="pf-asset-row__sub" data-numeric>
            ≈ ${formatMarketCap(asset.total * asset.usdSample)}
          </span>
        ) : null}
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
  )

  return (
    <section className="pf-assets" id="pf-assets">
      <SectionHeading title={copy.title} description={copy.sub} />
      <div className="pf-panel">
        <header className="pf-panel__bar">
          <span>{copy.balancesLabel}</span>
          <span data-numeric>{bridgeable.length}</span>
        </header>
        <ul className="pf-assets__list">{uassetRows.map(row)}</ul>
        {creditRows.length > 0 ? (
          <>
            <div className="pf-assets__group">{copy.creditGroup}</div>
            <ul className="pf-assets__list">{creditRows.map(row)}</ul>
          </>
        ) : null}
      </div>
    </section>
  )
}

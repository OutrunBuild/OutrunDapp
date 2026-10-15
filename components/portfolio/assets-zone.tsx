/**
 * (2) Assets & cross-chain zone (cross-chain lives inside Portfolio, there is no
 * standalone /bridge page; balances = a Data surface panel (bridgeable rows: uAsset section
 * first, Credit section behind a divider nameplate).
 * Sent in-transit items need no action and take no layout here; stranded items are not shown
 * anywhere (they never enter the to-do zone either).
 */
import type { FixturePsmPair, FixtureWalletAsset, Locale } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { ChainLogoMark } from '../global/chain-icons'
import { TokenIconMark } from '../global/token-icons'
import { formatAmount, formatMarketCap, SectionHeading } from '../global/signal-ui'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AssetActionsSheet, BridgeDialog, ConvertDialog } from './portfolio-dialogs'

export type AssetRowView = FixtureWalletAsset & {
  /** PSM pair (Convert entry); null = no pair, the action is not rendered */
  psm: FixturePsmPair | null
}

/**
 * Asset row: desktop = tile | identity + chain distribution | total + fiat | inline buttons;
 * mobile = a pure ledger single line (chain distribution numbers give way to chain badges,
 * buttons give way to a full-row hit layer) — tapping the row opens the bottom action panel
 * (chain distribution detail + Convert/Bridge), normalizing the row-height rhythm. The trigger
 * cannot serve double duty: the desktop button and the panel CTA are two independent instances,
 * each opening/closing without affecting the other.
 */
function AssetRow({
  locale,
  asset,
  chains,
  reserveBalances,
}: {
  locale: Locale
  asset: AssetRowView
  /** Mainnet chain family (bridge dialog from/to) */
  chains: Array<{ chainId: number; name: string }>
  /** Reserve asset balance table (Convert dialog Redeem-side Max) */
  reserveBalances: Record<string, number>
}) {
  const copy = getCopy(locale).portfolio.assets
  const balancesByChain = asset.chains.map((chain) => ({
    chainId: chain.chainId,
    name: chain.chainName,
    amount: chain.amount,
  }))
  const convert =
    asset.kind === 'uasset' && asset.psm != null ? (
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
    ) : null
  const bridge = (
    <BridgeDialog locale={locale} triggerLabel={copy.bridgeCta} assetSymbol={asset.symbol} chains={chains} balancesByChain={balancesByChain} />
  )

  return (
    <li className="pf-asset-row" data-kind={asset.kind}>
      {/* Asset identity = token icon (a chain badge expresses chain membership,
          not the asset, so it is not used for the identity slot). Chain badges remain in the
          chain-distribution row below (hover = chain name) */}
      <span className="pf-asset-row__tile">
        <TokenIconMark symbol={asset.symbol} size={20} aria-hidden="true" />
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
        {convert}
        {bridge}
      </div>
      {/* Mobile full-row hit layer (shown ≤54rem): opens the bottom action panel; on desktop the
          display:none buttons work as before */}
      <AssetActionsSheet
        locale={locale}
        title={asset.symbol}
        triggerLabel={`${asset.symbol} · ${copy.sheetLabel}`}
        chains={balancesByChain}
      >
        {convert}
        {bridge}
      </AssetActionsSheet>
    </li>
  )
}

export function AssetsZone({
  locale,
  assets,
  chains,
  reserveBalances,
}: {
  locale: Locale
  assets: AssetRowView[]
  /** Mainnet chain family (bridge dialog from/to) */
  chains: Array<{ chainId: number; name: string }>
  /** Reserve asset balance table (Convert dialog Redeem-side Max) */
  reserveBalances: Record<string, number>
}) {
  const copy = getCopy(locale).portfolio.assets
  const bridgeable = assets.filter((asset) => asset.bridgeable)
  // 2026-10-15 (user ruling): zero bridgeable rows unmount the whole zone — no empty shell card
  if (bridgeable.length === 0) return null
  // Credit family and uAsset family split into sections: uAsset first,
  // the Credit group carries a divider nameplate
  const uassetRows = bridgeable.filter((asset) => asset.kind === 'uasset')
  const creditRows = bridgeable.filter((asset) => asset.kind === 'credit')
  const rowProps = { locale, chains, reserveBalances }

  return (
    <section className="pf-assets" id="pf-assets">
      <SectionHeading title={copy.title} description={copy.sub} />
      <div className="pf-panel">
        <header className="pf-panel__bar">
          <span>{copy.balancesLabel}</span>
          <span data-numeric>{bridgeable.length}</span>
        </header>
        <ul className="pf-assets__list">
          {uassetRows.map((asset) => (
            <AssetRow key={asset.assetId} asset={asset} {...rowProps} />
          ))}
        </ul>
        {creditRows.length > 0 ? (
          <>
            <div className="pf-assets__group">{copy.creditGroup}</div>
            <ul className="pf-assets__list">
              {creditRows.map((asset) => (
                <AssetRow key={asset.assetId} asset={asset} {...rowProps} />
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </section>
  )
}

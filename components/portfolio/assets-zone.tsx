/**
 * ②资产与跨链区（2026-10-02 裁定：跨链功能并入 Portfolio，v1 无 /bridge 独立页；
 * 余额=Data surface 面板（可跨链行 + 只读页脚）。在途 Signal panel 已删
 * （2026-10-04 裁定）：sent 无需行动不占版面；stranded 展示也已删（2026-10-05 裁定）。
 */
import type { FixturePsmPair, FixtureWalletAsset, Locale } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { ChainLogoMark } from '../global/chain-icons'
import { TokenIconMark } from '../global/token-icons'
import { formatAmount, formatMarketCap, SectionHeading } from '../global/signal-ui'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AssetActionsSheet, BridgeDialog, ConvertDialog } from './portfolio-dialogs'

export type AssetRowView = FixtureWalletAsset & {
  /** PSM 配对（Convert 入口）；null=无配对不渲染该动作 */
  psm: FixturePsmPair | null
}

/**
 * 资产行（决议 018 补充）：桌面=tile | 身份+链分布 | 总量+法币 | 行内按钮（原样）；
 * 移动端=纯台账单线（链分布数值让位链徽标、按钮让位整行 hit 层）——点行开底部
 * 操作面板（链分布明细 + Convert/Bridge），行高节奏归一。触发器不可双栖：
 * 桌面按钮与面板 CTA 是两套独立实例，各自开合互不影响。
 */
function AssetRow({
  locale,
  asset,
  chains,
  reserveBalances,
}: {
  locale: Locale
  asset: AssetRowView
  /** 主网链族（跨链弹窗 from/to） */
  chains: Array<{ chainId: number; name: string }>
  /** 储备资产余额表（转换弹窗 Redeem 侧 Max） */
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
      {/* 资产身份=代币图标（2026-10-07 定稿 v3.1 印章制式；旧方案链徽/UUSD'$'字形占位
          已废——链徽只表达链属不表达资产）。链徽仍在下方链分布行（悬停=链名，
          2026-10-04 用户裁定） */}
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
      {/* 移动端整行 hit 层（≤54rem 显示）：开底部操作面板；桌面 display:none 按钮照旧 */}
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

import {
  getFixtureBridgeMessages,
  getFixtureCdpPositions,
  getFixtureChains,
  getFixturePsmPair,
  getFixturePortfolioActions,
  getFixturePortfolioSignals,
  getFixtureSnapshot,
  getFixtureUsrSavings,
  getFixtureVaultRows,
  getFixtureVoucherRows,
  getFixtureWalletAssets,
  type Locale,
} from '@/lib/data/fixture-repository'

import { OutrunShell } from '../global/app-shell'
import { getCopy } from '../global/copy'
import { ActionZone } from './action-zone'
import { AssetsZone, type AssetRowView } from './assets-zone'
import { PositionsZone } from './positions-zone'
import { VouchersZone } from './vouchers-zone'

/**
 * /portfolio（2026-10-02 四分区裁定）：①待办（只收逾期有后果项，同类聚合）②资产与跨链
 * （余额按链分布 + 跨链/1:1 转换/存入储蓄弹窗 + 在途状态——跨链功能并入本页，v1 无
 * /bridge 独立页）③仓位与储蓄（CDP 质押仓位 + USR 储蓄卡 + 收益库存单表）④参与凭证
 * （阶段分组表 + 只看可领 URL 筛选）。信号状态行=页级签名（摘要即导航，锚点直达分区）。
 */
export function PortfolioPage({
  locale,
  claimable,
}: {
  locale: Locale
  claimable?: string
}) {
  const snapshot = getFixtureSnapshot()
  const copy = getCopy(locale).portfolio
  const signals = getFixturePortfolioSignals()
  const actions = getFixturePortfolioActions()
  const messages = getFixtureBridgeMessages()
  const transit = messages.filter((message) => message.stage === 'sent' || message.stage === 'stranded')
  const stranded = messages.filter((message) => message.stage === 'stranded')
  const chains = getFixtureChains()
    .filter((chain) => chain.env === 'mainnet')
    .map((chain) => ({ chainId: chain.chainId, name: chain.name }))
  const usrSavings = getFixtureUsrSavings()
  const assets: AssetRowView[] = getFixtureWalletAssets().map((asset) => ({
    ...asset,
    psm: asset.kind === 'uasset' ? getFixturePsmPair(asset.symbol) : null,
    usr:
      asset.kind === 'uasset'
        ? (usrSavings.find((vault) => vault.uAssetSymbol === asset.symbol) ?? null)
        : null,
  }))
  const uAssetBalances: Record<string, number> = {}
  const reserveBalances: Record<string, number> = {}
  for (const asset of assets) {
    if (asset.kind === 'uasset') uAssetBalances[asset.symbol] = asset.total
    if (asset.kind === 'reserve') reserveBalances[asset.symbol] = asset.total
  }
  const claimableOnly = claimable === '1'

  const signalItems = [
    { href: '#pf-actions', tone: 'warning', label: copy.signals.todo, value: signals.actionCount },
    { href: '#pf-vouchers', tone: 'success', label: copy.signals.claimable, value: signals.claimableVerses },
    { href: '#pf-assets', tone: 'info', label: copy.signals.inTransit, value: signals.inTransit },
    { href: '#pf-assets', tone: 'danger', label: copy.signals.stranded, value: signals.stranded },
  ]

  return (
    <OutrunShell
      locale={locale}
      current="portfolio"
      accountAddress={snapshot.sampleAccount.address}
    >
      <header className="page-intro">
        <div>
          <h1 className="ax-fault-title">
            {copy.title}
            <span
              className="ax-fault-title__chroma"
              data-dup={copy.title}
              aria-hidden="true"
            />
            <span
              className="ax-fault-title__rip"
              data-dup={copy.title}
              aria-hidden="true"
            />
          </h1>
          <p>{copy.sub}</p>
          <nav className="pf-kpi" aria-label={copy.signals.groupLabel}>
            {signalItems.map((item) => (
              <a
                key={`${item.href}-${item.tone}`}
                href={item.href}
                data-tone={item.tone}
                data-zero={item.value === 0 || undefined}
              >
                <span className="pf-kpi__label">
                  <i aria-hidden="true" />
                  {item.label}
                </span>
                <strong data-numeric>{item.value}</strong>
              </a>
            ))}
          </nav>
        </div>
      </header>

      <ActionZone locale={locale} actions={actions} strandedMessages={stranded} />
      <AssetsZone
        locale={locale}
        assets={assets}
        transit={transit}
        chains={chains}
        reserveBalances={reserveBalances}
      />
      <PositionsZone
        locale={locale}
        cdpPositions={getFixtureCdpPositions()}
        usrSavings={usrSavings}
        vaultRows={getFixtureVaultRows()}
        uAssetBalances={uAssetBalances}
      />
      <VouchersZone
        locale={locale}
        rows={getFixtureVoucherRows()}
        claimableOnly={claimableOnly}
        claimableCount={signals.claimableVerses}
      />
    </OutrunShell>
  )
}

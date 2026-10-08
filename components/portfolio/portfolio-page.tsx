import {
  getFixtureCdpPositions,
  getFixtureChains,
  getFixturePsmPair,
  getFixturePortfolioActions,
  getFixtureReserveBalances,
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
import { formatAmount } from '../global/signal-ui'
import { UserDataGate } from '../global/user-data-gate'
import { ActionZone } from './action-zone'
import { AssetsZone, type AssetRowView } from './assets-zone'
import { PortfolioZoneTabs } from './portfolio-zone-tabs'
import { SavingsZone, StakedPositionsZone, VaultZone } from './positions-zone'
import { VouchersZone } from './vouchers-zone'

/**
 * /portfolio（2026-10-02 四分区裁定）：①待办（只收逾期有后果项，同类聚合）②资产与跨链
 * （余额按链分布 + 跨链/1:1 转换/存入储蓄弹窗）③仓位与储蓄（CDP 质押仓位 + USR 储蓄卡 +
 * 收益库存单表）④已参与（阶段分组表 + 可领客户端筛选）。信号状态行=页级签名（摘要
 * 即导航，锚点直达分区）；在途段已删（2026-10-04 裁定删在途卡），滞留段随待办卡锚①。
 * 2026-10-05 决议 017 质量轮：页头净值 hero（钱包+储蓄+金库待领样本折算 + 三段分配条）；
 * 2026-10-08 用户裁定分区间距统一：六分区全序列 space-7 48px（取代 017 三组节奏）。
 * 2026-10-08 用户裁定无用户参与态：未连接时 KPI/净值 hero/四分区整体隐藏
 * （UserDataGate，无数据的卡片不显示、不做零值占位），页面只剩页头标题+副题。
 */
export function PortfolioPage({ locale }: { locale: Locale }) {
  const snapshot = getFixtureSnapshot()
  const copy = getCopy(locale).portfolio
  const signals = getFixturePortfolioSignals()
  const actions = getFixturePortfolioActions()
  const chains = getFixtureChains()
    .filter((chain) => chain.env === 'mainnet')
    .map((chain) => ({ chainId: chain.chainId, name: chain.name }))
  const usrSavings = getFixtureUsrSavings()
  const assets: AssetRowView[] = getFixtureWalletAssets().map((asset) => ({
    ...asset,
    psm: asset.kind === 'uasset' ? getFixturePsmPair(asset.symbol) : null,
  }))
  const uAssetBalances: Record<string, number> = {}
  for (const asset of assets) {
    if (asset.kind === 'uasset') uAssetBalances[asset.symbol] = asset.total
  }
  const reserveBalances = getFixtureReserveBalances()

  const signalItems = [
    { href: '#pf-actions', tone: 'warning', label: copy.signals.todo, value: signals.actionCount },
    { href: '#pf-vouchers', tone: 'success', label: copy.signals.claimable, value: signals.claimableVerses },
  ]

  // 净值 hero（017）：钱包 + 储蓄 + 金库待领，fixture 样本价折算（快照口径）
  const walletUsd = assets.reduce(
    (sum, asset) => sum + (asset.usdSample != null ? asset.total * asset.usdSample : 0),
    0,
  )
  const savingsUsd = usrSavings.reduce(
    (sum, vault) => sum + (vault.usdSample != null ? vault.myAssets * vault.usdSample : 0),
    0,
  )
  const vaultRows = getFixtureVaultRows()
  const vaultReadyUsd = vaultRows.reduce((sum, row) => sum + (row.readyUsd ?? 0), 0)
  const totalUsd = walletUsd + savingsUsd + vaultReadyUsd
  const pct = (part: number) => (totalUsd > 0 ? Math.round((part / totalUsd) * 100) : 0)
  // 构成分区：0 值段不画、四舍五入到 0% 的图例项不渲染（2026-10-05 用户裁定）
  const heroParts = [
    {
      seg: 'pf-hero__seg--wallet',
      dot: 'pf-hero__dot--wallet',
      usd: walletUsd,
      label: copy.legendWallet,
    },
    {
      seg: 'pf-hero__seg--savings',
      dot: 'pf-hero__dot--savings',
      usd: savingsUsd,
      label: copy.legendSavings,
    },
    {
      seg: 'pf-hero__seg--ready',
      dot: 'pf-hero__dot--ready',
      usd: vaultReadyUsd,
      label: copy.legendReady,
    },
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
          <UserDataGate>
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
          </UserDataGate>
        </div>
        <UserDataGate>
          <div className="pf-hero">
          <span className="pf-hero__label">{copy.totalLabel}</span>
          <strong className="pf-hero__value" data-numeric>
            ≈ ${formatAmount(totalUsd, locale)}
          </strong>
          <div className="pf-hero__bar" aria-hidden="true">
            {heroParts
              .filter((part) => part.usd > 0)
              .map((part) => (
                <span key={part.seg} className={part.seg} style={{ flexGrow: part.usd }} />
              ))}
          </div>
          {/* 图例=构成的可访问文本（色点映射段色，2026-10-05 用户选 B） */}
          <p className="pf-hero__legend">
            {heroParts
              .filter((part) => pct(part.usd) > 0)
              .map((part) => (
                <span key={part.dot} className="pf-hero__legend-item">
                  <i className={`pf-hero__dot ${part.dot}`} aria-hidden="true" />
                  {part.label} <span data-numeric>{pct(part.usd)}%</span>
                </span>
              ))}
          </p>
          </div>
        </UserDataGate>
      </header>

      {/* 移动端分区页签 deck（决议 018）：≤54rem 吸顶四分段一次显一区、桌面零变化；
          无用户参与时随四分区一起隐藏（2026-10-08 裁定） */}
      <UserDataGate>
        <PortfolioZoneTabs
        locale={locale}
        initialZone={actions.length > 0 ? 'action' : 'money'}
        hasAction={actions.length > 0}
        badges={{ action: signals.actionCount, vouchers: signals.claimableVerses }}
      >
        {{
          action: <ActionZone locale={locale} actions={actions} />,
          money: (
            <>
              <AssetsZone locale={locale} assets={assets} chains={chains} reserveBalances={reserveBalances} />
              <SavingsZone locale={locale} usrSavings={usrSavings} uAssetBalances={uAssetBalances} />
            </>
          ),
          positions: (
            <>
              <StakedPositionsZone
                locale={locale}
                cdpPositions={getFixtureCdpPositions()}
                uAssetBalances={uAssetBalances}
              />
              <VaultZone locale={locale} vaultRows={vaultRows} />
            </>
          ),
          vouchers: <VouchersZone locale={locale} rows={getFixtureVoucherRows()} />,
        }}
        </PortfolioZoneTabs>
      </UserDataGate>
    </OutrunShell>
  )
}

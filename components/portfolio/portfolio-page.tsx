import {
  getCdpPositions,
  getChainVerses,
  getChains,
  getPsmPair,
  getPolPosition,
  getPortfolioActions,
  getReserveBalances,
  getPortfolioSignals,
  getDisplayAccount,
  getUsrSavings,
  getVaultRows,
  getParticipationRows,
  getVerse,
  getWalletAssets,
  type Locale,
} from '@/lib/data/fixture-repository'
import { executionChainId } from '@/lib/web3/chains'

import { OutrunShell } from '../global/app-shell'
import { getCopy } from '../global/copy'
import { ConnectWalletCta, ExploreCta } from '../global/connect-wallet-cta'
import { formatAmount } from '../global/signal-ui'
import { UserDataGate } from '../global/user-data-gate'
import { ActionZone } from './action-zone'
import type { ProtectionExitContext } from './protection-exit-dialog'
import { AssetsZone, type AssetRowView } from './assets-zone'
import { PortfolioZoneTabs } from './portfolio-zone-tabs'
import { SavingsZone, StakedPositionsZone, VaultZone } from './positions-zone'
import { ParticipationsZone } from './participations-zone'

/**
 * /portfolio, four sections: (1) to-do (only overdue items with consequences,
 * aggregated by kind) (2) assets & cross-chain (balances per chain + bridge / 1:1 convert /
 * deposit-to-savings dialogs; stranded items are not rendered) (3) positions & savings (CDP
 * staked positions + USR savings card + yield vault holdings table) (4) participations
 * (stage-grouped tables + client-side claimable filter). The signal status row = the page-level
 * signature (summary doubles as navigation, anchors jump straight to sections).
 * Page-head net-worth hero (wallet + savings + vault ready, converted at sample prices + a
 * three-segment allocation bar); the whole six-section
 * sequence sits at space-7 48px. No-user-participation state: when disconnected,
 * the KPI row / net-worth hero / four sections hide entirely (UserDataGate — cards without data
 * do not show, no zero-value placeholders), leaving only the page-head title + subtitle;
 * when disconnected, a yellow connect-wallet CTA appears below
 * the page head (ConnectWalletCta).
 */
export async function PortfolioPage({ locale }: { locale: Locale }) {
  const displayAccount = await getDisplayAccount()
  const copy = getCopy(locale).portfolio
  const signals = await getPortfolioSignals()
  const actions = await getPortfolioActions()
  const chains = (await getChains())
    .filter((chain) => chain.env === 'mainnet')
    .map((chain) => ({ chainId: chain.chainId, name: chain.name }))
  const usrSavings = await getUsrSavings()
  const walletAssets = await getWalletAssets()
  const assets: AssetRowView[] = []
  for (const asset of walletAssets) {
    assets.push({
      ...asset,
      psm: asset.kind === 'uasset' ? await getPsmPair(asset.symbol) : null,
    })
  }
  const uAssetBalances: Record<string, number> = {}
  for (const asset of assets) {
    if (asset.kind === 'uasset') uAssetBalances[asset.symbol] = asset.total
  }
  const reserveBalances = await getReserveBalances()

  // Protection-window Exit context: protection rows with a POL position sample =
  // in-page dialog; rows missing from the map → the card's Exit falls back to jumping to the
  // verse page. Price/USD samples feed the split-leg estimation and echo.
  const protectionExits: Record<string, ProtectionExitContext> = {}
  for (const action of actions) {
    if (action.kind !== 'protection' || !action.verse) continue
    // Point read by id (the actions list is small; no full verse pull)
    const verse = await getVerse(action.verse.id)
    const pol = verse ? await getPolPosition(verse.id) : null
    if (!verse || !pol) continue
    protectionExits[verse.id] = {
      verse,
      pol,
      price: verse.currentPrice,
      uAssetUsd:
        assets.find((asset) => asset.kind === 'uasset' && asset.symbol === verse.raiseAsset)
          ?.usdPrice ?? null,
    }
  }

  const signalItems = [
    { href: '#pf-actions', tone: 'warning', label: copy.signals.todo, value: signals.actionCount },
    { href: '#pf-participations', tone: 'success', label: copy.signals.claimable, value: signals.claimableVerses },
  ]
  // Zero-data sections render nothing — the signal strip and net-worth
  // hero collapse when all their values are zero (no zero-value placeholders)
  const hasSignals = signals.actionCount > 0 || signals.claimableVerses > 0

  // Net-worth hero: wallet + savings + vault ready, converted at fixture sample prices
  // (snapshot semantics)
  const walletUsd = assets.reduce(
    (sum, asset) => sum + (asset.usdPrice != null ? asset.total * asset.usdPrice : 0),
    0,
  )
  const savingsUsd = usrSavings.reduce(
    (sum, vault) => sum + (vault.usdPrice != null ? vault.myAssets * vault.usdPrice : 0),
    0,
  )
  const vaultRows = await getVaultRows()
  const vaultReadyUsd = vaultRows.reduce((sum, row) => sum + (row.readyUsd ?? 0), 0)
  const cdpPositions = await getCdpPositions()
  const participationRows = await getParticipationRows()
  // Genesis-stage verse heads for the participation zone's client-side scan (onchain builds:
  // the connected wallet's legs read through the wallet provider; getChainVerses is one row
  // per verse per chain — dedupe by id, the scan fields are chain-invariant)
  const participationCandidates = Array.from(
    new Map(
      (await getChainVerses())
        .filter((verse) => verse.stage === 'genesis')
        .map((verse) => [verse.id, verse] as const),
    ).values(),
  ).map((verse) => ({
    id: verse.id,
    symbol: verse.symbol,
    name: verse.name,
    stage: verse.stage,
    raiseAsset: verse.raiseAsset,
    endsAt: verse.endsAt,
    unlockAt: verse.unlockTimeAt,
    unlockedAt: verse.unlockedAt,
    execChain: executionChainId(verse.governanceChain),
  }))
  const hasZoneData =
    actions.length > 0 ||
    assets.length > 0 ||
    usrSavings.length > 0 ||
    cdpPositions.length > 0 ||
    vaultRows.length > 0 ||
    participationRows.length > 0
  const totalUsd = walletUsd + savingsUsd + vaultReadyUsd
  const pct = (part: number) => (totalUsd > 0 ? Math.round((part / totalUsd) * 100) : 0)
  // Allocation segments: zero-value segments are not drawn, legend items rounding to 0% are not
  // rendered
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
    <OutrunShell locale={locale} accountAddress={displayAccount.address}>
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
            {hasSignals ? (
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
            ) : null}
          </UserDataGate>
        </div>
        <UserDataGate>
          {totalUsd > 0 ? (
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
          {/* Legend = the allocation's accessible text (color dots map to segment colors) */}
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
          ) : null}
        </UserDataGate>
      </header>

      {/* The only action below the page head when there is no user participation (disappears
          along with the data cards once connected); connected with every zone empty, the
          explore CTA takes that slot instead */}
      <ConnectWalletCta locale={locale} />
      {!hasZoneData ? <ExploreCta locale={locale} /> : null}

      {/* Mobile zone tab deck: ≤54rem sticky four-segment tabs, one zone shown at a
          time, zero change on desktop; hides along with the four sections when there is no user
          participation — including when every zone's data is empty */}
      <UserDataGate>
        {/* hasZoneData keeps the fixture semantics (ExploreCta's !hasZoneData face unchanged);
            onchain builds carry no server account data, so the deck also renders for the
            client-side participation scan — every zone self-hides when empty */}
        {hasZoneData || participationCandidates.length > 0 ? (
        <PortfolioZoneTabs
        locale={locale}
        initialZone={actions.length > 0 ? 'action' : 'money'}
        hasAction={actions.length > 0}
        badges={{ action: signals.actionCount, participations: signals.claimableVerses }}
      >
        {{
          action: (
            <ActionZone locale={locale} actions={actions} protectionExits={protectionExits} />
          ),
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
                cdpPositions={cdpPositions}
                uAssetBalances={uAssetBalances}
              />
              <VaultZone locale={locale} vaultRows={vaultRows} />
            </>
          ),
          participations: (
            <ParticipationsZone locale={locale} rows={participationRows} candidates={participationCandidates} />
          ),
        }}
        </PortfolioZoneTabs>
        ) : null}
      </UserDataGate>
    </OutrunShell>
  )
}

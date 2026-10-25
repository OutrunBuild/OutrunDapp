import type { Locale, Staking, Verse } from '@/lib/data/fixture-repository'

import { CopyAddress } from '../global/copy-address'
import { getCopy } from '../global/copy'
import { formatMarketCap, formatPercent, SourceRef } from '../global/signal-ui'
import { fmtTokenAmount } from '../global/amount-format'
import { VaultActions } from './vault-actions'

/**
 * Yield Vault tab: Memecoin staking yield vault; APY=7D actual annualized.
 * Redemption is two-step async with per-entry status lists living inside the action card's
 * tabs (Redeem=waiting entries only with seconds countdown / Withdraw=matured entries only),
 * see VaultActions; staking is chain-aware (operations target the verse's governance chain).
 * Title row: title left, contract address centered (no VAULT prefix copy),
 * Live on {governance chain} right-aligned — always on one line. Header spacing rhythm:
 * head+stats tucked into .vault-overview (gap-3) + panel row gap space-4,
 * consistent with the DAO panel's head row.
 */
export function VaultPanel({
  locale,
  verse,
  staking,
  myMemecoin,
  initialView,
}: {
  locale: Locale
  verse: Verse
  staking: Staking | null
  /** Sample account's this-verse memecoin balance (pol-positions sample; Stake card Balance/Max, null=slot state) */
  myMemecoin: number | null
  /** ?action=withdraw deep link: the action card lands directly on the Withdraw sub-tab (redeem is the default state, no prop preset needed) */
  initialView?: 'withdraw'
}) {
  const copy = getCopy(locale).verseDesk
  const shareSymbol = `s${verse.symbol}`

  return (
    <div className="vault-panel">
      <section className="vault-overview">
        <header className="vault-panel__head">
          <h3 className="panel-title">{copy.vaultTitle.replace('{symbol}', verse.symbol)}</h3>
          {staking ? (
            <>
              <div className="vault-panel__head-vault" data-numeric>
                <CopyAddress locale={locale} value={staking.vaultAddress} />
              </div>
              <dl className="vault-panel__head-live" data-numeric>
                <dt>{copy.liveIn}</dt>
                <dd>{verse.governanceChainName}</dd>
              </dl>
            </>
          ) : null}
        </header>
        {staking ? (
          <dl className="vault-panel__stats" data-numeric>
            <div>
              <dt>{copy.totalStaked}</dt>
              <dd>
                {formatMarketCap(staking.totalStaked)} {verse.symbol}
              </dd>
            </div>
            <div>
              <dt>{copy.exchangeRate}</dt>
              <dd>
                1 {shareSymbol} ≈ {fmtTokenAmount(staking.assetsPerShare, locale)} {verse.symbol}
              </dd>
            </div>
            <div>
              <dt>{copy.apyLabel}</dt>
              <dd>
                {formatPercent(staking.apy7d * 100, locale)}%
              </dd>
            </div>
          </dl>
        ) : null}
      </section>
      {staking ? (
        <>
          <VaultActions
            locale={locale}
            symbol={verse.symbol}
            shareSymbol={shareSymbol}
            assetsPerShare={staking.assetsPerShare}
            claimableTotal={staking.claimableTotal}
            myShares={staking.myShares}
            myMemecoin={myMemecoin}
            pendingRedeems={staking.pendingRedeems}
            delegatee={staking.delegatee}
            governanceChain={verse.governanceChain}
            governanceChainName={verse.governanceChainName}
            initialRedeemMode={initialView}
          />
        </>
      ) : null}
      <SourceRef value="docs/page-briefs/source-map.md#M10" />
    </div>
  )
}

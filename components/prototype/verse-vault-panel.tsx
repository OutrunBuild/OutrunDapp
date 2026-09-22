import type { Locale, PrototypeStaking, PrototypeVerse } from '@/lib/data/prototype-repository'

import { CopyAddress } from './copy-address'
import { getCopy } from './copy'
import { formatAmount, formatMarketCap, formatPercent, formatStamp, SourceRef } from './signal-ui'
import { VaultActions } from './vault-actions'

/**
 * Yield Vault 标签（OB memecoin-staking.md：Memecoin 质押收益库；APY=7D 实绩年化 Q7 口径；
 * 两步异步赎回状态列表 Q8 口径；跨链质押面板 Q10 纳入）。
 */
export function VaultPanel({
  locale,
  verse,
  staking,
}: {
  locale: Locale
  verse: PrototypeVerse
  staking: PrototypeStaking | null
}) {
  const copy = getCopy(locale).verseDesk
  const shareSymbol = `s${verse.symbol}`

  return (
    <div className="vault-panel">
      <h3>{copy.vaultTitle}</h3>
      {staking ? (
        <>
          <dl className="vault-panel__stats" data-numeric>
            <div>
              <dt>{copy.vaultContract}</dt>
              <dd>
                <CopyAddress locale={locale} value={staking.vaultAddress} />
              </dd>
            </div>
            <div>
              <dt>{copy.liveIn}</dt>
              <dd>{verse.governanceChainName}</dd>
            </div>
            <div>
              <dt>{copy.totalStaked}</dt>
              <dd>
                {formatMarketCap(staking.totalStaked)} {verse.symbol}
              </dd>
            </div>
            <div>
              <dt>{copy.exchangeRate}</dt>
              <dd>
                1 {shareSymbol} ≈ {staking.assetsPerShare.toFixed(4)} {verse.symbol}
              </dd>
            </div>
            <div>
              <dt>{copy.apyLabel}</dt>
              <dd>
                {formatPercent(staking.apy7d * 100, locale)}%
              </dd>
            </div>
          </dl>
          <p className="panel-note">{copy.apyNote}</p>
          <div className="vault-panel__grid">
            <VaultActions
              locale={locale}
              symbol={verse.symbol}
              shareSymbol={shareSymbol}
              assetsPerShare={staking.assetsPerShare}
              claimableTotal={staking.claimableTotal}
              delegatee={staking.delegatee}
            />
            <div className="vault-panel__lists">
              <section>
                <h4>{copy.pendingRedeems}</h4>
                <ul data-numeric>
                  {staking.pendingRedeems.length === 0 ? (
                    <li className="panel-note">--</li>
                  ) : (
                    staking.pendingRedeems.map((entry) => (
                      <li key={entry.requestedAt}>
                        <span>
                          {formatAmount(entry.lockedAssets, locale)} {verse.symbol}
                        </span>
                        <span>{formatStamp(entry.requestedAt)}</span>
                        <span data-state={entry.ready ? 'ready' : 'waiting'}>
                          {entry.ready ? copy.ready : copy.remaining}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </section>
              <section>
                <h4>{copy.readyToWithdraw}</h4>
                <ul data-numeric>
                  {staking.claimableTotal > 0 ? (
                    <li>
                      <span>
                        {formatAmount(staking.claimableTotal, locale)} {verse.symbol}
                      </span>
                      <span>{copy.ready} ✓</span>
                    </li>
                  ) : (
                    <li className="panel-note">--</li>
                  )}
                </ul>
              </section>
              <section className="vault-panel__cross">
                <h4>{copy.crossTitle}</h4>
                <p className="panel-note">{copy.crossNote}</p>
              </section>
            </div>
          </div>
          <p className="panel-note">{copy.bufferNote}</p>
        </>
      ) : (
        <p className="panel-note">{copy.onChainSlot}</p>
      )}
      <SourceRef value="docs/page-briefs/source-map.md#M10" />
    </div>
  )
}

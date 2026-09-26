import type { Locale, PrototypeStaking, PrototypeVerse } from '@/lib/data/prototype-repository'

import { CopyAddress } from './copy-address'
import { getCopy } from './copy'
import { formatMarketCap, formatPercent, SourceRef } from './signal-ui'
import { VaultActions } from './vault-actions'

/**
 * Yield Vault 标签（OB memecoin-staking.md：Memecoin 质押收益库；APY=7D 实绩年化 Q7 口径；
 * 两步异步赎回状态列表 Q8 口径——2026-09-26 用户裁定参照 demo：列表收进操作卡标签内
 * （Redeem=仅等待中走秒倒计时 / Withdraw=仅已成熟逐笔），见 VaultActions；链感知跨链质押 Q10）。
 * 标题行（2026-09-24 用户裁定）：标题左、合约地址居中（无 VAULT 前缀文案）、
 * Live on {治理链} 右对齐——恒同一行。
 */
export function VaultPanel({
  locale,
  verse,
  staking,
  myMemecoin,
}: {
  locale: Locale
  verse: PrototypeVerse
  staking: PrototypeStaking | null
  /** 样本账户本 verse memecoin 余额（pol-positions 样本；Stake 档 Balance/Max，null=槽位态） */
  myMemecoin: number | null
}) {
  const copy = getCopy(locale).verseDesk
  const shareSymbol = `s${verse.symbol}`

  return (
    <div className="vault-panel">
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
        <>
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
          />
        </>
      ) : (
        <p className="panel-note">{copy.onChainSlot}</p>
      )}
      <SourceRef value="docs/page-briefs/source-map.md#M10" />
    </div>
  )
}

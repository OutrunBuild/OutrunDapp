import { getFixtureFaucet, getFixtureSnapshot, type Locale } from '@/lib/data/fixture-repository'

import { OutrunShell } from '../global/app-shell'
import { getCopy } from '../global/copy'

import { FaucetClaims } from './faucet-claims'

/**
 * /faucet（2026-10-09 四轮终态）：测试网水龙头=单一代币台账面板（用户裁定两卡合并、
 * 去机制解释——「这就是个水龙头」）。六功能=三币每日领取（Faucet.claim，S10）+ 一键
 * 领取（batchClaim，S10）+ PSM 面值兑换双向（Get UUSD/Back to USDC，S8——UUSD 唯一
 * 获取路径；费率/额度细节收进弹窗）。生息资产（sUSDS/aUSDC）不经 UUSD，直接
 * stakeForGenesis 进创世（S1）。数值口径：mock 三币各日限 1,000,000×1e18、冷却 24h
 * （S10/S11）；费率/余额/冷却剩余/headroom=fixture 样本（S 级）。
 */
export function FaucetPage({ locale }: { locale: Locale }) {
  const copy = getCopy(locale).faucet
  const faucet = getFixtureFaucet()
  if (!faucet) return null
  const snapshot = getFixtureSnapshot()

  return (
    <OutrunShell locale={locale} current="faucet" accountAddress={snapshot.sampleAccount.address}>
      <header className="page-intro">
        <div>
          <h1 className="ax-fault-title">
            {copy.title}
            <span className="ax-fault-title__chroma" data-dup={copy.title} aria-hidden="true" />
            <span className="ax-fault-title__rip" data-dup={copy.title} aria-hidden="true" />
          </h1>
          <p>{copy.sub}</p>
        </div>
      </header>

      <FaucetClaims locale={locale} faucet={faucet} />
    </OutrunShell>
  )
}

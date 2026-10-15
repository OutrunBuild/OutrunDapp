import { getFixtureFaucet, getFixtureSnapshot, type Locale } from '@/lib/data/fixture-repository'

import { OutrunShell } from '../global/app-shell'
import { getCopy } from '../global/copy'

import { FaucetClaims } from './faucet-claims'

/**
 * /faucet: testnet faucet = a single token ledger panel (no separate mechanism-explanation card).
 * Six functions = daily claims for three tokens (Faucet.claim) + batch claim (batchClaim) +
 * two-way PSM face-value swap (Get UUSD/Back to USDC — the only path to obtain UUSD;
 * fee/headroom details live in the dialog). Yield-bearing assets (sUSDS/aUSDC) skip UUSD and go
 * straight into genesis via stakeForGenesis. Numeric semantics: mock tokens each have a
 * daily limit of 1,000,000×1e18 and a 24h cooldown; fee/balance/cooldown remaining/
 * headroom are fixture samples.
 */
export async function FaucetPage({ locale }: { locale: Locale }) {
  const copy = getCopy(locale).faucet
  const faucet = await getFixtureFaucet()
  if (!faucet) return null
  const snapshot = await getFixtureSnapshot()

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

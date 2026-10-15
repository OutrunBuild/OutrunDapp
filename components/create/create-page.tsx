import { OutrunShell } from '../global/app-shell'
import { getCopy } from '../global/copy'
import { CreateForm } from './create-form'
import { SourceRef } from '../global/signal-ui'
import {
  getFixtureChains,
  getFixtureCreateConfig,
  getFixtureOccupiedSymbols,
  getFixtureSnapshot,
  type Locale,
} from '@/lib/data/fixture-repository'

export async function CreatePage({ locale }: { locale: Locale }) {
  const snapshot = await getFixtureSnapshot()
  // The create page originates only on mainnet chains (3 mainnets of the six-chain whitelist —
  // same scope as the discovery page's chain filter)
  const chains = (await getFixtureChains()).filter((chain) => chain.env === 'mainnet')
  const config = await getFixtureCreateConfig()
  const occupiedSymbols = await getFixtureOccupiedSymbols()
  const copy = getCopy(locale)

  return (
    <OutrunShell
      locale={locale}
      current="create"
      accountAddress={snapshot.sampleAccount.address}
    >
      <header className="page-intro create-intro">
        <div>
          <h1 className="ax-fault-title">
            {copy.create.titleLead} {copy.create.titleAccent}
            <span
              className="ax-fault-title__chroma"
              data-dup={`${copy.create.titleLead} ${copy.create.titleAccent}`}
              aria-hidden="true"
            />
            <span
              className="ax-fault-title__rip"
              data-dup={`${copy.create.titleLead} ${copy.create.titleAccent}`}
              aria-hidden="true"
            />
          </h1>
        </div>
        <SourceRef value="docs/page-briefs/memeverse-create.md#2" />
      </header>
      <CreateForm
        locale={locale}
        assets={snapshot.assets}
        chains={chains}
        /* Full six-chain list (incl. testnet stand-ins): the quote looks up the origin chain's
           native symbol by the wallet's connected chain */
        walletChains={await getFixtureChains()}
        config={config}
        occupiedSymbols={occupiedSymbols}
      />
    </OutrunShell>
  )
}

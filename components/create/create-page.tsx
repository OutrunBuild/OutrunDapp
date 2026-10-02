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

export function CreatePage({ locale }: { locale: Locale }) {
  const snapshot = getFixtureSnapshot()
  // 创建页只在主网链上发起（六链白名单的主网 3 条——architecture §5；发现页链筛选同口径）
  const chains = getFixtureChains().filter((chain) => chain.env === 'mainnet')
  const config = getFixtureCreateConfig()
  const occupiedSymbols = getFixtureOccupiedSymbols()
  const copy = getCopy(locale)

  return (
    <OutrunShell
      locale={locale}
      current="create"
      accountAddress={snapshot.sampleAccount.address}
    >
      <header className="page-intro create-intro">
        <div>
          <h1 className="ax-glitch-text ax-fault-title">
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
        /* 全六链名单（含测试网替身）：报价按钱包连接链查发起链原生币种 */
        walletChains={getFixtureChains()}
        config={config}
        occupiedSymbols={occupiedSymbols}
      />
    </OutrunShell>
  )
}

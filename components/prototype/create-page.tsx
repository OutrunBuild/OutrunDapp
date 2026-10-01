import { OutrunShell } from './app-shell'
import { getCopy } from './copy'
import { CreateForm } from './create-form'
import { SourceRef } from './signal-ui'
import {
  getPrototypeChains,
  getPrototypeCreateConfig,
  getPrototypeSnapshot,
  type Locale,
} from '@/lib/data/prototype-repository'

export function CreatePage({ locale }: { locale: Locale }) {
  const snapshot = getPrototypeSnapshot()
  // 创建页只在主网链上发起（六链白名单的主网 3 条——architecture §5；发现页链筛选同口径）
  const chains = getPrototypeChains().filter((chain) => chain.env === 'mainnet')
  const config = getPrototypeCreateConfig()
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
      <CreateForm locale={locale} assets={snapshot.assets} chains={chains} config={config} />
    </OutrunShell>
  )
}

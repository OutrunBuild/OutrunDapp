'use client'

// POL card balance readout (client half of the Tokenization tab's server PolPanel): the SSR
// carries the accountless slot and the market/nominal figures; the connected wallet's POL
// balance lands here through the shared wallet-provider probe. The ≈ valuation rides the same
// probe value through the passed market price and uAsset USD sample.
import type { Locale } from '@/lib/data/fixture-repository'

import { fmtTokenAmountExact } from '../global/amount-format'
import { formatMarketCap, formatAmount } from '../global/signal-ui'

import { useVerseBalances } from './trade-balances'

export function PolBalanceLive({
  locale,
  verseId,
  governanceChain,
  fallback,
  market,
  uAssetUsd,
}: {
  locale: Locale
  verseId: string
  governanceChain: number
  /** SSR slot value (fixture sample; null on onchain builds) */
  fallback: number | null
  /** POL/uAsset pool market price */
  market: number
  /** uAsset USD sample; null=hides the ≈ valuation */
  uAssetUsd: number | null
}) {
  const live = useVerseBalances({ verseId, governanceChain })
  const myPol = live?.pol ?? fallback
  // Exact read wins for the balance display (the float alias only feeds the ≈ valuation,
  // an estimate by construction)
  const polExact = live?.exact.pol ?? null
  const estUsd =
    uAssetUsd != null && myPol != null
      ? `$${formatMarketCap(myPol * market * uAssetUsd)}`
      : null
  return (
    <strong className="pol-card__amount" data-numeric>
      {polExact != null
        ? fmtTokenAmountExact(polExact.base, polExact.decimals, locale)
        : myPol != null
          ? formatAmount(myPol, locale)
          : '--'}
      {estUsd != null ? (
        <span className="pol-card__est">
          {/* ≈ is the separator (same as the pol-twin USD echo row); a "· ≈"
              double punctuation would leave a stranded · at line start after
              wrapping on mobile */}
          ≈ {estUsd}
        </span>
      ) : null}
    </strong>
  )
}

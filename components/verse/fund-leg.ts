// Reserve pull-leg shapes: every participation path that pays a reserve token assembles the
// same trio (token → decimals-scaled base units → display string) before handing the PSM mint
// its FundInput. Kept out of the panel so the shape stays unit-testable without a wallet: the
// caller reads decimals on chain and passes them in, this module stays synchronous and pure.
import { formatUnits, type Hex } from 'viem'

import { toBaseUnits } from '@/lib/web3/base-units'
import { fundPsmInput, type FundInput } from '@/lib/web3/session-actions'

/** One approval/pull leg as the batch builder consumes it. */
export type PullLeg = { token: Hex; amount: bigint; display: string }

export type ReserveLeg = PullLeg & {
  /** Decimals the base units were scaled with (a merged sibling leg reuses them) */
  decimals: number
  /** Display symbol of the reserve asset — one token always carries one symbol */
  symbol: string
  /** PSM mint instruction for the same amount */
  funding: FundInput
}

/** Reserve-paid leg: typed decimal amount → base units → display, plus the PSM FundInput. */
export function buildReserveLeg(input: {
  token: Hex
  /** User-typed amount, denominated in the reserve token */
  amount: string
  decimals: number
  symbol: string
}): ReserveLeg {
  const base = toBaseUnits(input.amount, input.decimals)
  return {
    token: input.token,
    amount: base,
    display: `${formatUnits(base, input.decimals)} ${input.symbol}`,
    decimals: input.decimals,
    symbol: input.symbol,
    funding: fundPsmInput(input.token, base),
  }
}

/** Pull legs for a two-leg batch: two legs on one token must merge into a single approve of
 *  the summed amount (ERC20 approve replaces — a second approve would erase the first).
 *  Address identity ignores hex casing: the legs come from different registries (yield
 *  sources vs PSM reserves) whose casing is not guaranteed to match. */
export function mergePullLegs(sibling: PullLeg, reserve: ReserveLeg): PullLeg[] {
  if (sibling.token.toLowerCase() !== reserve.token.toLowerCase()) return [sibling, reserve]
  const total = sibling.amount + reserve.amount
  return [
    {
      token: reserve.token,
      amount: total,
      display: `${formatUnits(total, reserve.decimals)} ${reserve.symbol}`,
    },
  ]
}

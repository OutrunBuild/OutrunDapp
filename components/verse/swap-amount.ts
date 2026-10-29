// Card-amount validity for the Swap panel: the typed amount must parse to a nonzero base unit
// at the selling token's decimals, or the quote layer resolves the request to no context and
// the card strands on its pending spinner. Pure and beside the panel (same seam as
// swap-plan.ts) so the decimals fallback chain stays unit-testable without mounting the card.
import { typedAmountPositive } from '../global/amount-input'

/** Decimals the typed amount is parsed at: the exact wallet read wins; without it the
 *  deployment constant decides — protocol tokens (memecoin/POL/PT/uAsset) are 18-dec by
 *  Memeverse's OutrunERC20Init (uAsset additionally enforced by the PSM init), reserves pass
 *  their Asset decimals. */
export function cardSellDecimals(input: {
  /** Decimals from the selling leg's exact balance probe (null = the probe has not landed) */
  exactDecimals: number | null
  /** The reserve Asset's decimals when the selling side is a PSM reserve */
  reserveDecimals: number | undefined
}): number {
  return input.exactDecimals ?? input.reserveDecimals ?? 18
}

/** Typed-amount validity at the selling token's decimals — never float-only. */
export function cardAmountValid(
  amount: string,
  input: { exactDecimals: number | null; reserveDecimals: number | undefined },
): boolean {
  return typedAmountPositive(amount, { decimals: cardSellDecimals(input) })
}

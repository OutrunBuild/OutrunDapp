// Claim-center card derivation — pure, display-denominated (base units are converted by the
// read layer before they get here; fixture samples arrive in the same shape). Card render
// rules follow the ledger: a card exists while the position has something to show (a zero
// claimable with an open vesting position stays — the rest is still locked in), one-shot
// cards drop out once claimed, and multi-currency claims split into a hero leg plus
// equal-basis extra legs (the POL twin-well ledger language, never one crammed line).
import type { PolPosition } from '@/lib/data/fixture-repository'

export type ClaimRowKind = 'preorder' | 'yt' | 'fees' | 'lp'

export type ClaimRowLeg = { amount: number; symbol: string }

export type ClaimRow = {
  kind: ClaimRowKind
  /** Hero readout (the card's main number) */
  main: ClaimRowLeg
  /** Additional same-basis legs, display order (uAsset first, PT second; memecoin first, uAsset second) */
  extra: ClaimRowLeg[]
  /** Preorder: cumulative claimed-to-date in memecoin (stat-sub line); null elsewhere */
  claimed: number | null
  /** Linear-unlock progress 0–1 (time-based: elapsed ÷ duration); the schedule lives in
   *  namespaced storage with no public view, so live mode reads it via raw storage slots
   *  and a failed read just leaves the slot absent (fixture samples carry it) */
  progress: number | null
  /** Claim executable now (drives the card CTA) */
  claimable: boolean
}

export type ClaimEntitlements = {
  memecoinSymbol: string
  uAssetSymbol: string
  /** Preorder position (claimable + claimed-to-date); absent = no position */
  preorder?: { claimable: number; claimed: number; progress?: number }
  /** One-shot initial YT (absent = not eligible or already claimed) */
  yt?: { claimable: number }
  /** Auxiliary-pool fee share (absent = nothing pending) */
  fees?: { uAsset: number; pt: number }
  /** Main-pool LP fees (absent = nothing pending) */
  lp?: { meme: number; uAsset: number }
}

function extras(entries: Array<[number, string]>): ClaimRowLeg[] {
  return entries.filter(([amount]) => amount > 0).map(([amount, symbol]) => ({ amount, symbol }))
}

/** Cards in display order: preorder unlock → initial YT → fee share → LP fees. */
export function deriveClaimRows(e: ClaimEntitlements): ClaimRow[] {
  const rows: ClaimRow[] = []
  if (e.preorder && (e.preorder.claimable > 0 || e.preorder.claimed > 0)) {
    rows.push({
      kind: 'preorder',
      main: { amount: e.preorder.claimable, symbol: e.memecoinSymbol },
      extra: [],
      claimed: e.preorder.claimed,
      progress: e.preorder.progress ?? null,
      claimable: e.preorder.claimable > 0,
    })
  }
  if (e.yt && e.yt.claimable > 0) {
    rows.push({
      kind: 'yt',
      main: { amount: e.yt.claimable, symbol: `YT-${e.memecoinSymbol}` },
      extra: [],
      claimed: null,
      progress: null,
      claimable: true,
    })
  }
  if (e.fees) {
    const feeLegs = extras([
      [e.fees.uAsset, e.uAssetSymbol],
      [e.fees.pt, `PT-${e.memecoinSymbol}`],
    ])
    if (feeLegs.length > 0) {
      rows.push({
        kind: 'fees',
        main: feeLegs[0],
        extra: feeLegs.slice(1),
        claimed: null,
        progress: null,
        claimable: true,
      })
    }
  }
  if (e.lp) {
    const lpExtra = extras([
      [e.lp.meme, e.memecoinSymbol],
      [e.lp.uAsset, e.uAssetSymbol],
    ])
    if (lpExtra.length > 0) {
      rows.push({
        kind: 'lp',
        main: lpExtra[0],
        extra: lpExtra.length > 1 ? lpExtra.slice(1) : [],
        claimed: null,
        progress: null,
        claimable: true,
      })
    }
  }
  return rows
}

/** Badge count = cards with a live claim action (a vesting position with 0 claimable does
 *  not ping the badge — there is nothing to do yet). */
export function claimableBadgeCount(rows: ClaimRow[]): number {
  return rows.filter((row) => row.claimable).length
}

/** Sample entitlements derived from the pol-position fixture (display denominations) —
 *  lives in this pure module so the RSC page can call it (a 'use client' export cannot be
 *  invoked from the server). Missing optional fields simply drop their cards. */
export function sampleClaimEntitlements(
  pol: PolPosition | null,
  memecoinSymbol: string,
  uAssetSymbol: string,
): ClaimEntitlements | null {
  if (!pol) return null
  const e: ClaimEntitlements = { memecoinSymbol, uAssetSymbol }
  if (
    pol.claimablePreorder != null ||
    pol.claimedPreorder != null ||
    pol.preorderProgress != null
  ) {
    e.preorder = {
      claimable: pol.claimablePreorder ?? 0,
      claimed: pol.claimedPreorder ?? 0,
      progress: pol.preorderProgress ?? undefined,
    }
  }
  if ((pol.claimableYt ?? 0) > 0) e.yt = { claimable: pol.claimableYt as number }
  if (pol.claimableUAssetFee != null || pol.claimablePtFee != null) {
    e.fees = { uAsset: pol.claimableUAssetFee ?? 0, pt: pol.claimablePtFee ?? 0 }
  }
  if (pol.claimableLpMeme != null || pol.claimableLpUAsset != null) {
    e.lp = { meme: pol.claimableLpMeme ?? 0, uAsset: pol.claimableLpUAsset ?? 0 }
  }
  return e
}


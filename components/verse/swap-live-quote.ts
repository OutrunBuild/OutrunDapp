'use client'

// Live swap-quote layer for the trade desk card. The executable pair quotes through the
// router's `quoteSwap` on the wallet provider (the same reader the write path uses), so the
// card's displayed output, min-received and price impact are the values execution will see —
// the SSR reference conversion stays the fallback for disconnected/fixture states.
//
// Cadence: amount edits debounce; while a valid quote is on screen a 10s timer refreshes it
// (per-block polling on the landing set's L2s would spray RPC; 10s ≈ 3–5 blocks) and pauses
// on hidden tabs; the click path re-checks freshness against the same cache
// (`quoteForContext`) and only re-reads when the quote aged out — a cached quote is always
// checked against the clicked request's key, never trusted by slot position.
import { useEffect, useRef, useState } from 'react'
import { formatUnits, type Hex } from 'viem'

import { getClientChainConfig } from '@/lib/web3/chains'
import { getActiveEip1193Provider } from '@/lib/web3/active-provider'
import { psmAbi } from '@/lib/web3/abis'
import { limitForDirection, type PoolKey } from '@/lib/web3/session-actions'
import { toBaseUnits } from '@/lib/web3/base-units'

import {
  readPoolKey,
  readPsmQuote,
  readPTToken,
  readSwapQuote,
  readSwapSpotOutPerIn,
  type ContractReader,
} from '../global/execution-reads'
import { getTokenDecimals, getVerseSession } from '../global/write-session'

export const QUOTE_DEBOUNCE_MS = 400
export const QUOTE_REFRESH_MS = 10_000
export const QUOTE_TTL_MS = 10_000

export type SwapDirection = 'stable-to-meme' | 'meme-to-stable'

/** Meme-leg candidate ids (the card's meme-side select rows). Each id swaps its own pool:
 *  memecoin↔uAsset primary, POL↔uAsset and PT↔uAsset auxiliary pools (four-pools.md). */
export type MemeTokenId = 'meme' | 'pol' | 'pt'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

/** Meme-leg address per selected row. Null = the verse has no such token (zero `getPT` —
 *  unreachable for a rendered card, PT deploys at launch; kept as deployment-skew defense) —
 *  the pair cannot execute. */
export function memeTokenAddressOf(
  memeTokenId: MemeTokenId,
  addresses: { memecoin: Hex; pol: Hex; pt: Hex | null },
): Hex | null {
  if (memeTokenId === 'meme') return addresses.memecoin
  if (memeTokenId === 'pol') return addresses.pol
  return addresses.pt
}

/** PT is a launch-time deployment constant — one read per verse per page life. */
const ptTokenCache = new Map<string, Promise<Hex>>()

/** PSM bindings are deployment constants too: one read per cage instance per page life. */
const psmBindingCache = new Map<string, Promise<Hex>>()

async function readPsmBinding(
  reader: ContractReader,
  psm: Hex,
  field: 'uAsset' | 'reserveToken',
): Promise<Hex> {
  const cacheKey = `${psm}:${field}`
  let pending = psmBindingCache.get(cacheKey)
  if (!pending) {
    pending = reader.read({ address: psm, abi: psmAbi, functionName: field }) as Promise<Hex>
    psmBindingCache.set(cacheKey, pending)
    pending.catch(() => {
      if (psmBindingCache.get(cacheKey) === pending) psmBindingCache.delete(cacheKey)
    })
  }
  return pending
}

async function resolveMemeLegAddress(
  memeTokenId: MemeTokenId,
  session: { reader: ContractReader; verse: { memecoin: Hex; pol: Hex }; contracts: Record<string, string> },
  chainId: number,
  verseId: string,
): Promise<Hex | null> {
  if (memeTokenId !== 'pt') {
    return memeTokenAddressOf(memeTokenId, { memecoin: session.verse.memecoin, pol: session.verse.pol, pt: null })
  }
  const splitter = session.contracts.POLSplitter as Hex | undefined
  if (!splitter) return null
  const cacheKey = `${chainId}:${verseId}`
  let pt = ptTokenCache.get(cacheKey)
  if (!pt) {
    pt = readPTToken(session.reader, splitter, BigInt(verseId))
    ptTokenCache.set(cacheKey, pt)
    pt.catch(() => {
      if (ptTokenCache.get(cacheKey) === pt) ptTokenCache.delete(cacheKey)
    })
  }
  const address = await pt
  return address === ZERO_ADDRESS ? null : address
}

export type SwapQuoteContext = {
  chainId: number
  verseId: string
  reader: ContractReader
  router: Hex
  hook: Hex
  kernel: Hex
  manifestVersion: string
  tokenIn: Hex
  tokenOut: Hex
  key: PoolKey
  zeroForOne: boolean
  /** Decimals of the POOL legs (uAsset/memecoin) — spot reads and impact use these. */
  decimalsIn: number
  decimalsOut: number
  /** Decimals of the CARD's legs: the reserve token when the stable side is a reserve. */
  cardDecimalsIn: number
  cardDecimalsOut: number
  /** Card input amount in card-input base units */
  amountIn: bigint
  /** The amount string this context was resolved for (display units) */
  amount: string
  /** Set when the stable side is a PSM reserve: the pair's swap leg always runs
   *  memecoin↔uAsset, and this PSM bridges the reserve to that uAsset (or back). */
  reserve?: {
    /** PSM instance bound to the verse's uAsset family */
    psm: Hex
    /** The reserve token bound to that PSM (e.g. USDC) */
    reserveToken: Hex
    reserveDecimals: number
    /** The verse's uAsset (the swap leg's stable side) */
    uAsset: Hex
  }
}

export type SwapQuoteValue = {
  /** quoteSwap.estimatedUserOutputAmount (raw units of tokenOut) */
  out: bigint
  feeBps: bigint
  /** Pool spot (display tokenOut per tokenIn) read in the SAME pass as the quote — the
   *  price-impact reference shares the quote's clock, never the page-load age. null = the
   *  spot leg failed or the pool is empty; only the impact row degrades. */
  spotOutPerIn: number | null
  /** Token decimals of both POOL legs — spot reads and impact use these */
  decimalsIn: number
  decimalsOut: number
  /** Decimals of the CARD's legs: the reserve token when the stable side is a reserve */
  cardDecimalsIn: number
  cardDecimalsOut: number
  /** The display-unit amount this quote answers — a quote is only valid against its own input */
  amount: string
  /** Key of the quoted request — a display value is only valid for its own key */
  key: string
  at: number
  /** PSM leg of a reserve-pair quote. Present only when the selected stable side is a PSM
   *  reserve rather than the verse's uAsset. `psmAmountIn`/`psmAmountOut` are raw units of the
   *  swap leg's own currencies (uAsset for both directions); `feeInInput` is the combined
   *  router + PSM cost converted into this card's input token, for the single fee row. */
  psm?: {
    address: Hex
    reserveToken: Hex
    /** Router swap leg only, in uAsset base units */
    uAssetAmount: bigint
    /** PSM side: uAsset minted from the reserve (buy) or reserve paid for the uAsset (sell) */
    psmAmountIn: bigint
    psmAmountOut: bigint
    /** Combined fee (router + PSM) in card-input base units */
    feeInInput: bigint
  }
}

/** Pool keys are deployment constants; one read per pair per page life is enough. */
const poolKeyCache = new Map<string, PoolKey>()
/** Single-slot quote cache: one swap card, one latest quote. */
let quoteCache: SwapQuoteValue | null = null

export function swapQuoteKey(
  chainId: number,
  verseId: string,
  tokenIn: Hex,
  tokenOut: Hex,
  amountIn: bigint,
): string {
  return `${chainId}:${verseId}:${tokenIn}:${tokenOut}:${amountIn}`
}

/** Resolve everything a quote (and the write path packing a spec) needs for this amount.
 *  The heavy halves (verse session, pool key, decimals, PT address) sit in shared caches, so
 *  repeat calls with a changed amount cost nothing beyond the quote read itself. Throws when
 *  the selected meme leg has no token (zero address) — the hook surfaces it as a failed read. */
export async function resolveSwapQuoteContext(input: {
  eoa: Hex
  chainId: number
  verseId: string
  direction: SwapDirection
  memeTokenId: MemeTokenId
  /** The verse's raise uAsset symbol (deployment key `OutrunPSM.<symbol>`). */
  uAssetSymbol: string
  /** Selected stable-side token: the verse's uAsset, or a PSM reserve address. */
  stableToken: { kind: 'uasset' } | { kind: 'reserve'; address: Hex }
  amount: string
}): Promise<SwapQuoteContext | null> {
  const resolved = getClientChainConfig(input.chainId)
  if (resolved.status !== 'ok' || resolved.config.contracts.status !== 'deployed') return null
  const contracts = resolved.config.contracts.addresses
  const provider = getActiveEip1193Provider()
  if (!provider) return null
  const session = await getVerseSession({
    provider,
    chains: [input.chainId],
    eoa: input.eoa,
    verseId: BigInt(input.verseId),
  })
  const memeAddress = await resolveMemeLegAddress(input.memeTokenId, session, input.chainId, input.verseId)
  if (memeAddress == null) {
    throw new Error('outrun: meme leg token missing for this verse')
  }
  // A reserve selection does not change the pool: the swap leg is always memecoin↔uAsset and
  // the PSM bridges the reserve to that uAsset. Only the card's input/output token changes.
  let reserve: SwapQuoteContext['reserve']
  if (input.stableToken.kind === 'reserve') {
    const psm = contracts[`OutrunPSM.${input.uAssetSymbol}`] as Hex | undefined
    if (!psm) return null
    const [reserveToken, psmUAsset] = await Promise.all([
      readPsmBinding(session.reader, psm, 'reserveToken'),
      readPsmBinding(session.reader, psm, 'uAsset'),
    ])
    // The row must describe the PSM this verse would actually route through: a selection that
    // does not match the PSM's bound reserve means the deployment table drifted.
    if (reserveToken.toLowerCase() !== input.stableToken.address.toLowerCase()) return null
    if (psmUAsset.toLowerCase() !== session.verse.uAsset.toLowerCase()) return null
    const reserveDecimals = await getTokenDecimals(session.reader, input.chainId, reserveToken)
    reserve = { psm, reserveToken, reserveDecimals, uAsset: session.verse.uAsset }
  }
  const poolTokenIn = (
    input.direction === 'stable-to-meme' ? session.verse.uAsset : memeAddress
  ) as Hex
  const poolTokenOut = (
    input.direction === 'stable-to-meme' ? memeAddress : session.verse.uAsset
  ) as Hex
  const pairCacheKey = `${input.chainId}:${poolTokenIn}:${poolTokenOut}`
  let key = poolKeyCache.get(pairCacheKey)
  if (!key) {
    key = await readPoolKey(session.reader, contracts.MemeverseSwapRouter as Hex, poolTokenIn, poolTokenOut)
    poolKeyCache.set(pairCacheKey, key)
  }
  // decimalsIn/decimalsOut describe the POOL legs (the swap card's own tokenIn/tokenOut);
  // cardDecimals* describe what the user actually types and receives. They differ only on a
  // reserve leg, where the pool still quotes memecoin↔uAsset.
  const cardTokenIn = input.direction === 'stable-to-meme' ? (reserve?.reserveToken ?? poolTokenIn) : poolTokenIn
  const cardTokenOut = input.direction === 'stable-to-meme' ? poolTokenOut : (reserve?.reserveToken ?? poolTokenOut)
  const [poolDecimalsIn, poolDecimalsOut, cardDecimalsIn, cardDecimalsOut] = await Promise.all([
    getTokenDecimals(session.reader, input.chainId, poolTokenIn),
    getTokenDecimals(session.reader, input.chainId, poolTokenOut),
    getTokenDecimals(session.reader, input.chainId, cardTokenIn),
    getTokenDecimals(session.reader, input.chainId, cardTokenOut),
  ])
  const amountIn = toBaseUnits(input.amount, cardDecimalsIn)
  // Dust below one base unit parses to 0n: no quote and no executable call — null sends
  // the live-quote path to its fallback and the click path to resolve-failed.
  if (amountIn === 0n) return null
  return {
    chainId: input.chainId,
    verseId: input.verseId,
    reader: session.reader,
    router: contracts.MemeverseSwapRouter as Hex,
    hook: contracts.MemeverseUniswapHook as Hex,
    kernel: resolved.config.kernel7702Implementation as Hex,
    manifestVersion: resolved.config.contracts.abiVersion,
    tokenIn: poolTokenIn,
    tokenOut: poolTokenOut,
    key,
    zeroForOne: poolTokenIn.toLowerCase() === key.currency0.toLowerCase(),
    decimalsIn: poolDecimalsIn,
    decimalsOut: poolDecimalsOut,
    cardDecimalsIn,
    cardDecimalsOut,
    amountIn,
    amount: input.amount,
    ...(reserve ? { reserve } : {}),
  }
}

/** Swap-leg input in pool currency units. A reserve buy starts from the reserve, so the pool
 *  leg's input is what the PSM mint pays out for it; a uAsset buy or any sell (memecoin in)
 *  uses the card amount directly on the pool leg. */
async function poolLegInputOf(ctx: SwapQuoteContext): Promise<bigint> {
  if (!ctx.reserve || ctx.tokenIn !== ctx.reserve.uAsset) return ctx.amountIn
  return readPsmQuote(ctx.reader, ctx.reserve.psm, 'mint', ctx.amountIn)
}

/** PSM par math runs on 18-dec face value: a reserve amount in its own decimals expressed at
 *  18 decimals. */
function faceOf(reserveAmount: bigint, reserveDecimals: number): bigint {
  return reserveDecimals >= 18
    ? reserveAmount / 10n ** BigInt(reserveDecimals - 18)
    : reserveAmount * 10n ** BigInt(18 - reserveDecimals)
}

/** 18-dec face value back into a reserve token's own decimals. */
function unfaceOf(faceAmount: bigint, reserveDecimals: number): bigint {
  return reserveDecimals >= 18
    ? faceAmount * 10n ** BigInt(reserveDecimals - 18)
    : faceAmount / 10n ** BigInt(18 - reserveDecimals)
}

export async function fetchSwapQuote(ctx: SwapQuoteContext, eoa: Hex): Promise<SwapQuoteValue> {
  // The executable quote and the spot the impact row measures it against ride one poll pass
  // (a block may land between the legs; bounded by one RTT, never the page-load age).
  const [poolAmountIn, spotOutPerIn] = await Promise.all([
    poolLegInputOf(ctx),
    readSwapSpotOutPerIn(ctx.reader, ctx.router, ctx.hook, ctx.key, ctx.tokenIn, ctx.decimalsIn, ctx.decimalsOut),
  ])
  const quote = await readSwapQuote(
    ctx.reader,
    ctx.router,
    ctx.key,
    {
      zeroForOne: ctx.zeroForOne,
      amountSpecified: -poolAmountIn,
      sqrtPriceLimitX96: limitForDirection(ctx.zeroForOne),
    },
    eoa,
  )
  const swapOut = quote.estimatedUserOutputAmount
  // Router fee in POOL-INPUT currency. Exact-in charges the LP leg on the input; when the
  // protocol leg settles on the output it is converted back at this quote's own rate.
  const routerFeePoolIn =
    quote.estimatedLpFeeAmount +
    (quote.protocolFeeOnInput
      ? quote.estimatedProtocolFeeAmount
      : swapOut > 0n
        ? (quote.estimatedProtocolFeeAmount * poolAmountIn) / swapOut
        : 0n)
  const base = {
    feeBps: quote.feeBps,
    spotOutPerIn,
    decimalsIn: ctx.decimalsIn,
    decimalsOut: ctx.decimalsOut,
    cardDecimalsIn: ctx.cardDecimalsIn,
    cardDecimalsOut: ctx.cardDecimalsOut,
    amount: ctx.amount,
    key: swapQuoteKey(ctx.chainId, ctx.verseId, ctx.tokenIn, ctx.tokenOut, ctx.amountIn),
    at: Date.now(),
  }
  if (!ctx.reserve) return { ...base, out: swapOut }

  // Reserve leg. Two distinct legs with different currencies, so each fee is first expressed
  // in its own currency and then converted into the card's input token for the single row.
  const isBuy = ctx.tokenIn === ctx.reserve.uAsset
  if (isBuy) {
    // Card in = reserve R; PSM mints U = quoteMint(R) uAsset; the pool spends U for memecoin.
    // PSM fee: the face value of R minus what the mint actually delivered.
    const psmFeeFace = faceOf(ctx.amountIn, ctx.reserve.reserveDecimals) - poolAmountIn
    const psmFeeCardIn =
      psmFeeFace > 0n ? unfaceOf(psmFeeFace, ctx.reserve.reserveDecimals) : 0n
    // Router fee is charged on U (uAsset); express it in the reserve the user actually paid.
    const routerFeeCardIn =
      poolAmountIn > 0n ? (routerFeePoolIn * ctx.amountIn) / poolAmountIn : 0n
    return {
      ...base,
      out: swapOut,
      psm: {
        address: ctx.reserve.psm,
        reserveToken: ctx.reserve.reserveToken,
        uAssetAmount: poolAmountIn,
        psmAmountIn: ctx.amountIn,
        psmAmountOut: poolAmountIn,
        feeInInput: routerFeeCardIn + psmFeeCardIn,
      },
    }
  }
  // Card in = memecoin; the pool pays U = swapOut uAsset; PSM redeems it for the reserve.
  const reserveOut = await readPsmQuote(ctx.reader, ctx.reserve.psm, 'redeem', swapOut)
  // PSM fee: the uAsset handed to the PSM minus the face value of what it paid back,
  // converted to memecoin at this quote's own rate.
  const psmFeeFace =
    swapOut > faceOf(reserveOut, ctx.reserve.reserveDecimals)
      ? swapOut - faceOf(reserveOut, ctx.reserve.reserveDecimals)
      : 0n
  const psmFeeCardIn = swapOut > 0n ? (psmFeeFace * poolAmountIn) / swapOut : 0n
  return {
    ...base,
    out: reserveOut,
    psm: {
      address: ctx.reserve.psm,
      reserveToken: ctx.reserve.reserveToken,
      uAssetAmount: swapOut,
      psmAmountIn: swapOut,
      psmAmountOut: reserveOut,
      // The router fee is already charged in memecoin on this direction.
      feeInInput: routerFeePoolIn + psmFeeCardIn,
    },
  }
}

/** Cache-checked quote for an already-resolved context: the click path reuses a young quote
 *  that belongs to this exact request, otherwise it re-reads. */
export async function quoteForContext(
  ctx: SwapQuoteContext,
  eoa: Hex,
): Promise<SwapQuoteValue> {
  const expected = swapQuoteKey(ctx.chainId, ctx.verseId, ctx.tokenIn, ctx.tokenOut, ctx.amountIn)
  const cached = quoteCache
  if (cached && cached.key === expected && Date.now() - cached.at <= QUOTE_TTL_MS) {
    return cached
  }
  const next = await fetchSwapQuote(ctx, eoa)
  quoteCache = next
  return next
}

export type SwapLiveQuoteInput = {
  active: boolean
  eoa: Hex | null
  chainId: number | null
  verseId: string | null
  direction: SwapDirection
  /** Selected meme-leg row — part of the quote identity: a leg switch quotes immediately */
  memeTokenId: MemeTokenId
  /** The verse's raise uAsset symbol (locates the PSM instance) */
  uAssetSymbol: string
  /** Selected stable-side token — part of the quote identity too */
  stableToken: { kind: 'uasset' } | { kind: 'reserve'; address: Hex }
  amount: string
}

export type SwapLiveQuote = {
  /** A usable quote is on screen (the display rows read its values) */
  ready: boolean
  /** Fetch in flight with nothing to show yet */
  loading: boolean
  /** The latest attempt for the current request errored — the card falls back to the
   *  reference conversion until a retry succeeds */
  failed: boolean
  value: SwapQuoteValue | null
}

export function useSwapLiveQuote(input: SwapLiveQuoteInput): SwapLiveQuote {
  const [value, setValue] = useState<SwapQuoteValue | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  // Latest-probe-wins: a slow fetch for a superseded request must not overwrite a newer one.
  const seq = useRef(0)

  const parsed = Number(input.amount)
  const amountValid = Number.isFinite(parsed) && parsed > 0
  const armed =
    input.active &&
    input.eoa != null &&
    input.chainId != null &&
    input.verseId != null &&
    amountValid

  // Debounce only the amount; identity/pair changes quote immediately (the identity key
  // resyncs the debounced value so a direction flip never waits out the timer).
  const stableKey =
    input.stableToken.kind === 'uasset' ? 'uasset' : input.stableToken.address.toLowerCase()
  const identityKey = `${input.eoa ?? ''}|${input.chainId ?? ''}|${input.verseId ?? ''}|${input.direction}|${input.memeTokenId}|${stableKey}`
  const [debouncedAmount, setDebouncedAmount] = useState(input.amount)
  const prevIdentity = useRef(identityKey)
  useEffect(() => {
    if (prevIdentity.current !== identityKey) {
      prevIdentity.current = identityKey
      setDebouncedAmount(input.amount)
      return
    }
    if (input.amount === debouncedAmount) return
    const id = setTimeout(() => setDebouncedAmount(input.amount), QUOTE_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [identityKey, input.amount, debouncedAmount])

  useEffect(() => {
    const { eoa, chainId, verseId, direction, memeTokenId, stableToken, uAssetSymbol } = input
    if (!armed || eoa == null || chainId == null || verseId == null) {
      seq.current += 1
      setValue(null)
      setLoading(false)
      setFailed(false)
      return
    }
    let cancelled = false
    const run = ++seq.current
    const load = async () => {
      setLoading(true)
      setFailed(false)
      try {
        const ctx = await resolveSwapQuoteContext({
          eoa,
          chainId,
          verseId,
          direction,
          memeTokenId,
          uAssetSymbol,
          stableToken,
          amount: debouncedAmount,
        })
        // A null context or a superseded run leaves the previous value alone: the card falls
        // back to the reference conversion and the click path re-resolves on its own.
        if (!ctx || run !== seq.current || cancelled) return
        const next = await fetchSwapQuote(ctx, eoa)
        quoteCache = next
        if (run === seq.current && !cancelled) setValue(next)
      } catch {
        // A failed read for a changed request must not keep showing the old amount's quote.
        if (run === seq.current && !cancelled) {
          setValue(null)
          setFailed(true)
        }
      } finally {
        if (run === seq.current && !cancelled) setLoading(false)
      }
    }
    void load()
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible' && run === seq.current) void load()
    }, QUOTE_REFRESH_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible' && run === seq.current) void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      seq.current += 1
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [armed, input.eoa, input.chainId, input.verseId, input.direction, input.memeTokenId, debouncedAmount])

  return { ready: value != null, loading: loading && value == null, failed, value }
}

/** Linear reference TOTAL for a quote: per-unit pool spot × display input amount — the
 *  Uniswap `midPrice.quote(inputAmount)` shape. Both sides of priceImpactOf are totals;
 *  mixing the per-unit spot with the total output only works at input = 1. A null spot or a
 *  non-positive/NaN amount flows through as null (priceImpactOf degrades to its null slot). */
export function spotReferenceOf(spotOutPerIn: number | null, amountDisplay: number): number | null {
  if (!(spotOutPerIn != null && spotOutPerIn > 0) || !(amountDisplay > 0)) return null
  return spotOutPerIn * amountDisplay
}

/** Price impact, Uniswap convention: the executable quote's shortfall against the pool spot
 *  read in the SAME pass as the quote (1 − actual/reference), minus the swap fee so the row
 *  carries pure price-movement cost and the fee stays a separate row. Clamped at 0 — a quote
 *  above the reference is upside, not negative impact. null = not computable (a null
 *  reference — unreadable spot or amount — flows through as null). */
export function priceImpactOf(referenceOut: number | null, actualOut: number, feeBps: bigint): number | null {
  if (referenceOut == null || !(referenceOut > 0) || !(actualOut > 0)) return null
  const impact = 1 - actualOut / referenceOut - Number(feeBps) / 10_000
  return impact > 0 ? impact : 0
}

export const IMPACT_WARNING = 0.05
export const IMPACT_DANGER = 0.2

/** Warning tier ≥5%, danger tier ≥20% (the danger tier disables the CTA outright; 20% is a
 *  user-set bound, looser than Uniswap's BLOCKED_PRICE_IMPACT_NON_EXPERT at 15%). */
export function impactTone(impact: number | null): 'warning' | 'danger' | null {
  if (impact == null) return null
  if (impact >= IMPACT_DANGER) return 'danger'
  if (impact >= IMPACT_WARNING) return 'warning'
  return null
}

/** minOut = out × (1 − slippage), floored to whole units — the same shape the spec's
 *  amountOutMinimum carries. */
export function minOutOf(out: bigint, slippageBps: number): bigint {
  return (out * BigInt(10_000 - Math.round(slippageBps))) / 10_000n
}

/** Display number of raw token units. */
export function toDisplay(raw: bigint, decimals: number): number {
  return Number(formatUnits(raw, decimals))
}

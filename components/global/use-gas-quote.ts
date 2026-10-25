'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPublicClient, custom, formatUnits, parseGwei, type Hex } from 'viem'

import type { Locale } from '@/lib/data/fixture-repository'
import { getClientChainConfig } from '@/lib/web3/chains'
import { useActiveEip1193Provider } from '@/lib/web3/active-provider'
import { resolveType4GasLimit } from '@/lib/web3/viem-type4-adapter'
import { readNativeUsdPrice } from '@/lib/web3/native-price'

import { getCopy } from './copy'
import { useWallets } from '@privy-io/react-auth'

/** Fee-market refresh cadence while a review window is open (ms). */
const GAS_REFRESH_MS = 20_000

/** Base-fee headroom per tier (EIP-1559: +12.5%/block, so 1.1/1.25/1.6 covers 1/2/4
 *  consecutive full blocks). */
const BASE_HEADROOM = [110n, 125n, 160n] as const
export type GasTier = { key: 'slow' | 'market' | 'fast'; maxFee: bigint; tip: bigint; fee: bigint }

/**
 * Three fee tiers from chain facts (ruling 049/050):
 *
 * - `floor` — node eth_gasPrice; already includes the chain's validator minimum
 *   (BSC = 0.1 gwei). Nothing may quote below it.
 * - `nextBase` / `p10|p50|p90` — eth_feeHistory: the next block's base fee and the
 *   priority-fee percentiles of the recent window.
 *
 * Tip tiers are the market percentiles clamped to the floor tip, with a minimum ladder so
 * a floor-bound chain does not collapse all three to the same number. maxFee adds
 * base-fee headroom on top of the tip, and is clamped to the floor again. The tip is
 * capped at `maxFee − nextBase` because that is the most the protocol can actually pay.
 */
export function buildGasTiers(input: {
  nextBase: bigint;
  floor: bigint;
  p10: bigint;
  p50: bigint;
  p90: bigint;
  gasLimit: bigint;
}): GasTier[] {
  const { nextBase, floor, p10, p50, p90, gasLimit } = input
  const floorTip = floor > nextBase ? floor - nextBase : 0n
  const atLeast = (value: bigint, min: bigint) => (value > min ? value : min)

  const slowTip = atLeast(p10, floorTip)
  const avgTip = atLeast(atLeast(p50, floorTip), (slowTip * 125n) / 100n)
  const fastTip = atLeast(atLeast(p90, floorTip), (avgTip * 130n) / 100n)
  const tips = [slowTip, avgTip, fastTip]
  const keys = ['slow', 'market', 'fast'] as const

  return keys.map((key, index) => {
    const tip = tips[index]!
    const withHeadroom = (nextBase * BASE_HEADROOM[index]!) / 100n + tip
    const maxFee = atLeast(withHeadroom, floor)
    // The protocol pays min(tip, maxFee − baseFee); keep the quoted tip payable.
    const payable = maxFee > nextBase ? maxFee - nextBase : 0n
    const quotedTip = tip < payable ? tip : payable
    return { key, maxFee, tip: quotedTip, fee: gasLimit * maxFee }
  })
}

export type GasOverride = {
  gasLimit: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
}

/**
 * Custom pair gate: both fields must parse, the total price positive, and the price must
 * cover the next block's base fee — otherwise the tx is unbroadcastable no matter the tip.
 */
export function isCustomGasValid(input: {
  base: bigint | null
  tip: bigint | null
  nextBase: bigint | null
}): boolean {
  if (input.base == null || input.tip == null) return false
  const price = input.base + input.tip
  if (price <= 0n) return false
  return input.nextBase == null || price >= input.nextBase
}

export type GasOption = {
  key: 'slow' | 'market' | 'fast'
  label: string
  fee: string
  gwei: string
  usd: string | null
}

export type GasQuote = {
  /** False until the wallet kind, limit and fee market are known (row hidden). */
  ready: boolean
  /** True once a quote has landed at least once (the review waits for it, with a timeout). */
  settled: boolean
  /** The current selection cannot be used (custom pair missing/zero). Derived, never mirrored. */
  invalid: boolean
  options: GasOption[]
  mode: 'slow' | 'market' | 'fast' | 'custom'
  select: (key: 'slow' | 'market' | 'fast') => void
  rowValue: string
  rowUsd: string | null
  symbol: string
  customOpen: boolean
  toggleCustom: () => void
  baseGwei: string
  tipGwei: string
  setBase: (value: string) => void
  setTip: (value: string) => void
  baseInvalid: boolean
  tipInvalid: boolean
  baseHint: string
  tipHint: string
  customFee: string
  feeLabel: string
  customLabel: string
  baseLabel: string
  tipLabel: string
  doneLabel: string
  gweiUnit: string
}

/**
 * Gas quote + selection for embedded wallets (ruling 046). Privy's type-4 path signs raw
 * (no wallet UI), so the review dialog owns the fee: an average-by-default summary row
 * and an in-place editor (the dialog body swaps, no stacked overlay).
 *
 * Inputs are nullable: the hook runs unconditionally in the page and goes dormant until
 * the prepared write exists.
 */
export function useGasQuote({
  locale,
  chainId,
  eoa,
  kernel,
  data,
  nonce,
  active = true,
  resetToken,
  nativeUsdPrice,
  onResolved,
}: {
  locale: Locale
  chainId: number | null
  eoa: Hex | null
  kernel: Hex | null
  data: Hex | null
  nonce?: number
  /** Poll and quote only while the review window is actually waiting for input. */
  active?: boolean
  /** Identity of the prepared write: a new token starts a fresh window (defaults reset). */
  resetToken?: unknown
  /** Test/preview override; production reads the chain's Chainlink feed. */
  nativeUsdPrice?: number | null
  onResolved: (value: GasOverride | null) => void
}): GasQuote {
  const copy = getCopy(locale)
  const { wallets } = useWallets()
  const provider = useActiveEip1193Provider()
  const [embedded, setEmbedded] = useState<boolean | null>(null)
  const [gasLimit, setGasLimit] = useState<bigint | null>(null)
  const [tiers, setTiers] = useState<GasTier[] | null>(null)
  const [baseFee, setBaseFee] = useState<bigint | null>(null)
  const [priority, setPriority] = useState<bigint | null>(null)
  const [usdPrice, setUsdPrice] = useState<number | null>(null)
  const [mode, setMode] = useState<'slow' | 'market' | 'fast' | 'custom'>('market')
  const [customOpen, setCustomOpen] = useState(false)
  const [baseGwei, setBaseGwei] = useState('')
  const [tipGwei, setTipGwei] = useState('')
  const edited = useRef(false)
  const wasActive = useRef(false)
  const lastToken = useRef<unknown>(undefined)
  // Gas limit depends only on the prepared write: one estimate per window; later ticks
  // refresh the fee market only.
  const limitCache = useRef<{ token: unknown; limit: bigint } | null>(null)
  // The USD reference moves far slower than the fee market and only annotates the row:
  // read it once per window too.
  const usdCache = useRef<{ token: unknown; price: number } | null>(null)

  useEffect(() => {
    if (!eoa) {
      setEmbedded(null)
      return
    }
    const wallet = wallets.find((entry) => entry.address.toLowerCase() === eoa.toLowerCase())
    setEmbedded(wallet?.walletClientType === 'privy')
  }, [wallets, eoa])

  // A new review window always starts at the safe default: a custom selection left over
  // from the previous window (possibly invalid) must never pre-block Confirm.
  useEffect(() => {
    if (!active) {
      wasActive.current = false
      return
    }
    if (!wasActive.current || resetToken !== lastToken.current) {
      setMode('market')
      setCustomOpen(false)
      edited.current = false
    }
    wasActive.current = true
    lastToken.current = resetToken
  }, [active, resetToken])

  // One quote per poll: gas limit (real delegated batch), the next block's base fee and
  // the priority-fee percentiles from eth_feeHistory, plus the Chainlink USD price.
  useEffect(() => {
    if (!active || embedded !== true || !provider || !eoa || !kernel || !data || chainId == null)
      return
    let cancelled = false
    const alive = () => !cancelled

    const load = async () => {
      const chain = getClientChainConfig(chainId)
      if (chain.status !== 'ok') return
      try {
        const reader = createPublicClient({
          chain: chain.config.viemChain,
          transport: custom({ request: provider.request }),
        })
        const cachedLimit =
          limitCache.current && limitCache.current.token === resetToken
            ? limitCache.current.limit
            : null
        const [limit, gasPriceHex, history, usd] = await Promise.all([
          cachedLimit != null
            ? Promise.resolve(cachedLimit)
            : resolveType4GasLimit({
                provider,
                chain: chain.config.viemChain,
                eoa,
                to: eoa,
                data,
                kernel,
                ...(nonce != null ? { nonce } : {}),
              }),
          provider.request({ method: 'eth_gasPrice' }) as Promise<string>,
          provider
            .request({
              method: 'eth_feeHistory',
              params: ['0x14', 'latest', [10, 50, 90]],
            })
            .catch(() => null) as Promise<{
            baseFeePerGas?: string[]
            reward?: string[][]
          } | null>,
          nativeUsdPrice !== undefined
            ? Promise.resolve(nativeUsdPrice)
            : usdCache.current && usdCache.current.token === resetToken
              ? Promise.resolve(usdCache.current.price)
              : chain.config.nativeUsdFeed
                ? readNativeUsdPrice(reader, chain.config.nativeUsdFeed as Hex)
                : Promise.resolve(null),
        ])
        if (!alive()) return
        const floor = BigInt(gasPriceHex)
        // eth_feeHistory: trailing baseFeePerGas is the NEXT block's base fee; reward[i]
        // carries the requested percentiles per block. Nodes without feeHistory degrade to
        // "floor only" (percentiles = 0), which still respects the chain minimum.
        const baseList = history?.baseFeePerGas ?? []
        const nextBase = baseList.length ? BigInt(baseList[baseList.length - 1]!) : 0n
        const rewards = history?.reward ?? []
        const meanReward = (index: number): bigint => {
          if (!rewards.length) return 0n
          return (
            rewards.reduce((sum, row) => sum + BigInt(row[index] ?? '0x0'), 0n) /
            BigInt(rewards.length)
          )
        }
        const p10 = meanReward(0)
        const p50 = meanReward(1)
        const p90 = meanReward(2)
        limitCache.current = { token: resetToken, limit }
        const built = buildGasTiers({ nextBase, floor, p10, p50, p90, gasLimit: limit })
        setGasLimit(limit)
        // A tick that changes nothing should not re-render the dialog.
        setTiers((prev) => (prev && sameTiers(prev, built) ? prev : built))
        setBaseFee(nextBase)
        setPriority(p50)
        if (usd != null) usdCache.current = { token: resetToken, price: usd }
        setUsdPrice(usd)
        // Refresh the custom inputs only while the user has not touched them; a poll
        // must never overwrite a half-typed custom price.
        if (!edited.current) {
          const average = built[1]!
          setBaseGwei(formatGwei(average.maxFee - average.tip))
          setTipGwei(formatGwei(average.tip))
        }
      } catch {
        // Keep the last good quote; the send path prices itself when there is none.
      }
    }

    void load()
    // Live fee market while the review window is open; the effect tears down (and the
    // interval with it) when the dialog closes. Hidden tabs skip the tick.
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, GAS_REFRESH_MS)

    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [active, embedded, provider, chainId, eoa, kernel, data, nonce, nativeUsdPrice, resetToken])

  const presets = useMemo(() => {
    if (!tiers) return null
    const labels = [copy.verse.gasSlow, copy.verse.gasMarket, copy.verse.gasFast]
    return tiers.map((tier, index) => ({ ...tier, label: labels[index]! }))
  }, [tiers, copy.verse.gasSlow, copy.verse.gasMarket, copy.verse.gasFast])

  const customBase = parseGweiInput(baseGwei)
  const customTip = parseGweiInput(tipGwei)
  // BSC's base fee is routinely 0 — the pair is valid as long as the total price is > 0
  // and covers the next block's base fee.
  const customValid = isCustomGasValid({ base: customBase, tip: customTip, nextBase: baseFee })
  const selected = mode === 'custom' ? null : (presets?.find((p) => p.key === mode) ?? null)

  useEffect(() => {
    if (embedded !== true) {
      onResolved(null)
      return
    }
    if (mode === 'custom') {
      if (!gasLimit || !customValid) {
        onResolved(null)
        return
      }
      onResolved({
        gasLimit,
        maxFeePerGas: customBase! + customTip!,
        maxPriorityFeePerGas: customTip!,
      })
      return
    }
    if (!gasLimit || !selected) {
      onResolved(null)
      return
    }
    onResolved({
      gasLimit,
      maxFeePerGas: selected.maxFee,
      maxPriorityFeePerGas: selected.tip,
    })
  }, [embedded, mode, gasLimit, selected, customBase, customTip, customValid, onResolved])

  const chain = chainId != null ? getClientChainConfig(chainId) : null
  const symbol = chain?.status === 'ok' ? chain.config.viemChain.nativeCurrency.symbol : ''
  const customFee = customValid && gasLimit != null ? gasLimit * (customBase! + customTip!) : null
  const activeFee = mode === 'custom' ? customFee : (selected?.fee ?? null)
  const ready = embedded === true && presets != null && gasLimit != null

  return {
    ready,
    settled: gasLimit != null && tiers != null,
    invalid: mode === 'custom' && !customValid,
    options:
      ready && presets
        ? presets.map((preset) => ({
            key: preset.key,
            label: preset.label,
            fee: trimAmount(formatUnits(preset.fee, 18)),
            gwei: formatGwei(preset.maxFee),
            usd: usdPrice != null ? formatUsd(preset.fee, usdPrice) : null,
          }))
        : [],
    mode,
    select: (key) => {
      setMode(key)
      setCustomOpen(false)
    },
    rowValue: activeFee != null ? `${trimAmount(formatUnits(activeFee, 18))} ${symbol}` : '—',
    rowUsd: activeFee != null && usdPrice != null ? formatUsd(activeFee, usdPrice) : null,
    symbol,
    customOpen,
    toggleCustom: () => {
      const next = !customOpen
      setCustomOpen(next)
      setMode('custom')
      if (next) {
        if (!edited.current && presets) {
          const average = presets.find((preset) => preset.key === 'market')
          if (average) {
            setBaseGwei(formatGwei(average.maxFee - average.tip))
            setTipGwei(formatGwei(average.tip))
          }
        }
        return
      }
      if (!customValid) setMode('market')
    },
    baseGwei,
    tipGwei,
    setBase: (value) => {
      edited.current = true
      setBaseGwei(value)
      setMode('custom')
    },
    setTip: (value) => {
      edited.current = true
      setTipGwei(value)
      setMode('custom')
    },
    baseInvalid: customBase == null,
    tipInvalid: customTip == null,
    baseHint:
      baseFee != null ? `${copy.verse.gasCurrentBase} ${formatGwei(baseFee)} GWEI` : '',
    tipHint:
      priority != null ? `${copy.verse.gasCurrentPriority} ${formatGwei(priority)} GWEI` : '',
    customFee:
      customFee != null
        ? `≈ ${trimAmount(formatUnits(customFee, 18))} ${symbol}`
        : copy.verse.gasInvalid,
    feeLabel: copy.verse.gasFee,
    customLabel: copy.verse.gasCustom,
    baseLabel: copy.verse.gasMaxBase,
    tipLabel: copy.verse.gasPriority,
    doneLabel: copy.verse.gasDone,
    gweiUnit: 'GWEI',
  }
}

function sameTiers(a: GasTier[], b: GasTier[]): boolean {
  if (a.length !== b.length) return false
  return a.every(
    (tier, index) =>
      tier.key === b[index]!.key &&
      tier.maxFee === b[index]!.maxFee &&
      tier.tip === b[index]!.tip,
  )
}

/** gwei with at most four decimals, no trailing zeros. */
function formatGwei(wei: bigint): string {
  const value = formatUnits(wei, 9)
  const [whole, fraction = ''] = value.split('.')
  const trimmed = fraction.slice(0, 4).replace(/0+$/, '')
  return trimmed ? `${whole}.${trimmed}` : whole
}

/** Fee readout: at most six decimals (native units are tiny). */
function trimAmount(value: string): string {
  const [whole, fraction = ''] = value.split('.')
  const trimmed = fraction.slice(0, 6).replace(/0+$/, '')
  return trimmed ? `${whole}.${trimmed}` : whole
}

/** USD readout for a wei cost; sub-cent values collapse to <$0.01. */
function formatUsd(wei: bigint, nativeUsdPrice: number): string {
  const usd = (Number(wei) / 1e18) * nativeUsdPrice
  if (!Number.isFinite(usd)) return '—'
  return usd < 0.01 ? '<$0.01' : `$${usd.toFixed(2)}`
}

function parseGweiInput(value: string): bigint | null {
  if (!value.trim()) return null
  try {
    const parsed = parseGwei(value)
    return parsed >= 0n ? parsed : null
  } catch {
    return null
  }
}

export function sanitizeGwei(input: string): string {
  const cleaned = input.replace(/[^0-9.]/g, '')
  const [whole, ...rest] = cleaned.split('.')
  return rest.length ? `${whole}.${rest.join('').slice(0, 9)}` : whole
}

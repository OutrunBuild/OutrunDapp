'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPublicClient, custom, type Hex } from 'viem'

import type { Locale, VerseChainAggregates } from '@/lib/data/fixture-repository'
import { getClientChainConfig } from '@/lib/web3/chains'
import { getActiveEip1193Provider } from '@/lib/web3/active-provider'

import { readVerseAggregates, type VerseAggregatesLedger } from '../global/execution-reads'
import { parseVerseIdParam } from '../global/routes'
import { ProgressMeter } from '../global/signal-ui'
import { useAccountCenter } from '../global/use-account-center'

/**
 * Wallet-chain live layer for the genesis workbench.
 *
 * Genesis settles per chain, so the aggregate displays follow the CONNECTED WALLET's chain
 * (within the verse's landed set): the SSR per-chain rows are the baseline, and a
 * wallet-provider probe — the same RPC that confirmed any receipt — overrides them the moment
 * it lands. A router.refresh() alone cannot serve this: the server caches are
 * stale-while-revalidate (30s/60s), so the post-write render replays pre-tx numbers, and the
 * canonical SSR props describe one fixed chain while the wallet may sit on another.
 */
export type VerseLiveValue = {
  /** Display chain: the wallet's chain when it sits in the landed set, else the canonical
   *  data chain (the chain the SSR props describe). */
  viewChainId: number
  /** Canonical chain id — the chain the SSR props (incl. `preorderRemainingBase`) describe. */
  dataChainId: number
  /** The verse's landed set (fallback: the canonical chain alone). */
  landedChains: readonly number[]
  /** SSR baseline row for the view chain; null = the source carries no row for it, so the
   *  canonical props stand. */
  chainRow: VerseChainAggregates | null
  /** Latest probe read with its chain (provider truth); null until a probe lands. */
  aggregates: (VerseAggregatesLedger & { chainId: number }) | null
  /** Bumps ONLY when a participation confirms in this tab — account-scoped client readers
   *  (「您的参与」) use it as their post-write refresh signal. Baseline probes (connect/chain
   *  moves) never bump it: they change no personal ledger. */
  writeNonce: number
  /** Baseline probe (connect/chain moves): fire-and-forget read of the view chain's
   *  aggregates; a failed read keeps the baselines. */
  probe: () => void
  /** Post-write probe: bumps writeNonce then reads — the same RPC that confirmed the
   *  receipt, so the numbers move immediately on confirmation. */
  afterWrite: () => void
}

const FALLBACK: VerseLiveValue = {
  viewChainId: 0,
  dataChainId: 0,
  landedChains: [],
  chainRow: null,
  aggregates: null,
  writeNonce: 0,
  probe: () => {},
  afterWrite: () => {},
}

const VerseLiveContext = createContext<VerseLiveValue>(FALLBACK)

export function useVerseLive(): VerseLiveValue {
  return useContext(VerseLiveContext)
}

export function VerseLiveProvider({
  verseIdParam,
  dataChainId,
  deployedChainIds,
  chainAggregates,
  children,
}: {
  /** Numeric verse id (URL-segment shape; uint256 range keeps it a string) */
  verseIdParam: string
  /** Chain whose state the canonical SSR props describe (governance chain's copy). */
  dataChainId: number
  /** Landed set; null = the source carries no per-chain presence data. */
  deployedChainIds: number[] | null
  /** Per-chain SSR baseline rows (onchain detail build; null on single-row sources). */
  chainAggregates: Record<string, VerseChainAggregates> | null
  children: ReactNode
}) {
  const center = useAccountCenter()
  const landedChains = useMemo(
    () => (deployedChainIds?.length ? deployedChainIds : [dataChainId]),
    [deployedChainIds, dataChainId],
  )
  const walletOnLanded = center.chainId != null && landedChains.includes(center.chainId)
  const viewChainId = walletOnLanded ? (center.chainId as number) : dataChainId
  const chainRow = chainAggregates?.[String(viewChainId)] ?? null
  const [aggregates, setAggregates] = useState<VerseLiveValue['aggregates']>(null)
  const [writeNonce, setWriteNonce] = useState(0)
  // Latest probe wins: a rapid second trigger's read must not be overwritten by the first's.
  const probeSeq = useRef(0)
  const verseId = parseVerseIdParam(verseIdParam)

  // Probe values describe one chain/identity's state — a move to either drops them. The
  // baseline effect below immediately re-probes the new view chain.
  useEffect(() => {
    setAggregates(null)
  }, [center.address, center.chainId])

  const probe = useCallback(() => {
    const seq = ++probeSeq.current
    const provider = getActiveEip1193Provider()
    if (!provider || verseId == null) return
    void (async () => {
      try {
        // Provider-truth chain check before any read: reads through the wallet provider serve
        // the wallet's CURRENT chain, and only a landed chain's deployment carries this verse
        // (another chain's launcher reverts InvalidVerseId).
        const live = Number.parseInt(String(await provider.request({ method: 'eth_chainId' })), 16)
        if (!landedChains.includes(live) || seq !== probeSeq.current) return
        const resolved = getClientChainConfig(live)
        if (resolved.status !== 'ok' || resolved.config.contracts.status !== 'deployed') return
        const launcher = resolved.config.contracts.addresses.MemeverseLauncher as Hex | undefined
        const polend = resolved.config.contracts.addresses.POLend as Hex | undefined
        if (!launcher || !polend) return
        const client = createPublicClient({
          chain: resolved.config.viemChain,
          transport: custom({ request: provider.request }),
        })
        const next = await readVerseAggregates(
          { read: (params) => client.readContract(params) as Promise<unknown> },
          launcher,
          polend,
          BigInt(verseId),
        )
        if (seq !== probeSeq.current) return
        setAggregates({ ...next, chainId: live })
      } catch {
        // Degrade keeps the SSR baselines; no user-facing error for a refresh read.
      }
    })()
  }, [landedChains, verseId])

  const afterWrite = useCallback(() => {
    setWriteNonce((nonce) => nonce + 1)
    probe()
  }, [probe])

  // Baseline probe: while connected on a landed chain, read the view chain's own aggregates
  // once per connect/chain move. This is what makes the meters and the panel follow a chain
  // switch, and it is the only source of `previewPreorderCapacity` for non-canonical chains
  // (the SSR overlay reads the canonical chain alone).
  useEffect(() => {
    if (center.source !== 'real' || !center.connected || !walletOnLanded) return
    probe()
  }, [center.source, center.connected, walletOnLanded, center.chainId, center.address, probe])

  const value = useMemo(
    () => ({
      viewChainId,
      dataChainId,
      landedChains,
      chainRow,
      aggregates,
      writeNonce,
      probe,
      afterWrite,
    }),
    [viewChainId, dataChainId, landedChains, chainRow, aggregates, writeNonce, probe, afterWrite],
  )
  return <VerseLiveContext.Provider value={value}>{children}</VerseLiveContext.Provider>
}

/** Threshold-panel meters over the wallet-chain aggregates: the SSR row for the view chain is
 *  the baseline, the probe overrides it once it lands, and the canonical SSR props stand when
 *  the source carries no per-chain rows (fixture build). Percent mirrors the server formula
 *  (raised / threshold × 100, unclamped). */
export function GenesisLiveMeters({
  locale,
  labels,
  unit,
  threshold,
  normalRaised,
  normalProgress,
  leverageInterest,
  leverageProgress,
}: {
  locale: Locale
  labels: { standard: string; leverage: string }
  unit: string
  threshold: number
  normalRaised: number
  normalProgress: number
  leverageInterest: number
  leverageProgress: number
}) {
  const { chainRow, aggregates } = useVerseLive()
  const asFloat = (base: bigint) => Number(base) / 1e18
  const normalAmount =
    aggregates != null
      ? asFloat(aggregates.normalBase)
      : (chainRow?.normalRaised ?? normalRaised)
  const leverageAmount =
    aggregates != null
      ? asFloat(aggregates.interestBase)
      : (chainRow?.leverageInterest ?? leverageInterest)
  // A chain-specific baseline (or probe) recomputes the percent from the threshold; the
  // canonical fallback keeps the SSR progress value (threshold 0 has no percent to derive).
  const recompute = aggregates != null || chainRow != null
  const percentOf = (amount: number, fallback: number) =>
    threshold > 0 ? (amount / threshold) * 100 : fallback
  return (
    <>
      <ProgressMeter
        label={labels.standard}
        value={recompute ? percentOf(normalAmount, normalProgress) : normalProgress}
        amount={normalAmount}
        threshold={threshold}
        unit={unit}
        locale={locale}
      />
      <ProgressMeter
        label={labels.leverage}
        value={recompute ? percentOf(leverageAmount, leverageProgress) : leverageProgress}
        amount={leverageAmount}
        threshold={threshold}
        unit={unit}
        locale={locale}
      />
    </>
  )
}

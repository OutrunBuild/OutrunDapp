'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { formatUnits, type Hex } from 'viem'

import type { Locale } from '@/lib/data/fixture-repository'
import { executionChainId } from '@/lib/web3/chains'
import { readGenesisFundsByChain } from '@/lib/data/verse-reads'

import { readGenesisParticipation } from '../global/execution-reads'
import { getCopy } from '../global/copy'
import { parseVerseIdParam } from '../global/routes'
import { formatAmount } from '../global/signal-ui'
import { useAccountCenter } from '../global/use-account-center'
import { useWalletProviderReader } from '../global/wallet-provider-reader'
import { useVerseLive } from './genesis-live'

/** 「您的参与」 stat value: equivalent genesis funds summed across the verse's LANDED chains
 *  (genesis settles per chain — normal funds + leveraged interest converted at the on-chain
 *  rate via POLend getUserLeveragedDebt; preorder excluded). Leg sources: the wallet's own
 *  chain reads through the wallet provider (same RPC that confirmed any receipt, refreshed by
 *  the live layer's writeNonce), sibling chains via the on-demand server action (the wallet
 *  provider cannot serve other chains). A missing leg renders '--', never a partial sum and
 *  never a fabricated 「未参与」; a true all-chain zero is 「未参与」. Fixture/harness builds
 *  keep the SSR sample so recorded baselines hold. */
export function MyParticipationStat({
  locale,
  raiseAsset,
  governanceChain,
  landedChains,
  sample,
}: {
  locale: Locale
  raiseAsset: string
  governanceChain: number
  /** Verse's landed set; null = the source carries no per-chain presence (governance chain alone) */
  landedChains: number[] | null
  /** SSR sample sum, equivalent-genesis-funds basis (participations fixture; 0 on onchain builds) */
  sample: number
}) {
  const copy = getCopy(locale)
  const center = useAccountCenter()
  const { writeNonce } = useVerseLive()
  const params = useParams()
  const verseId = parseVerseIdParam(params?.verseId)
  const chains = useMemo(
    () => (landedChains?.length ? landedChains : [executionChainId(governanceChain)]),
    [landedChains, governanceChain],
  )
  const chainsKey = chains.join(',')
  const walletChain = center.chainId
  const walletChainLanded = walletChain != null && chains.includes(walletChain)
  const real = center.source === 'real'
  const connected = center.connected
  const account = center.address
  const providerReader = useWalletProviderReader(walletChainLanded ? walletChain : null)
  // uAsset leg read through the wallet provider (base units, 18-dec uAsset display contract)
  const [walletLeg, setWalletLeg] = useState<bigint | null>(null)
  // Sibling legs from the server action: chain id → base-unit string
  const [chainRows, setChainRows] = useState<Record<string, string> | null>(null)
  const [readNonce, setReadNonce] = useState(0)

  // Focus re-read: a participation confirmed elsewhere in this tab bumps the on-chain ledgers
  // without remounting this stat. The live layer's writeNonce refreshes the wallet-chain leg
  // the moment a write confirms; focus/visibility re-reads both legs.
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === 'visible') setReadNonce((nonce) => nonce + 1)
    }
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  // Account/chain moves are the sanctioned reset point: both legs describe the previous
  // identity/scope.
  useEffect(() => {
    setWalletLeg(null)
    setChainRows(null)
  }, [account, walletChain])

  // Wallet-chain leg: provider read (only the wallet's current chain is servable through it).
  useEffect(() => {
    if (!real || !connected || !walletChainLanded || verseId == null || providerReader == null || account == null)
      return
    const launcher = providerReader.addresses.MemeverseLauncher as Hex | undefined
    const polend = providerReader.addresses.POLend as Hex | undefined
    if (!launcher || !polend) return
    let cancelled = false
    void (async () => {
      try {
        const base = await readGenesisParticipation(
          providerReader.reader,
          launcher,
          polend,
          BigInt(verseId),
          account as Hex,
        )
        if (!cancelled) setWalletLeg(base)
      } catch {
        // read failure keeps the '--' slot until the next trigger
        if (!cancelled) setWalletLeg(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [real, connected, walletChainLanded, providerReader, verseId, account, readNonce, writeNonce])

  // All-chain legs: on-demand server action over the landed set. A wallet-chain write does not
  // change sibling state, so writeNonce is not a dep — the wallet leg covers post-write
  // immediacy. The chain move IS a dep: which leg the provider serves changes with it. The
  // previous rows stay visible while a refetch is in flight (no '--' flash on focus); only a
  // hard failure clears to the slot state.
  useEffect(() => {
    if (!real || !connected || account == null || verseId == null) return
    let cancelled = false
    void readGenesisFundsByChain({ verseId, chains, account })
      .then((rows) => {
        if (!cancelled) setChainRows(rows)
      })
      .catch(() => {
        if (!cancelled) setChainRows(null)
      })
    return () => {
      cancelled = true
    }
  }, [real, connected, account, verseId, chainsKey, walletChainLanded, walletChain, readNonce])

  // Sum: the wallet-chain leg takes precedence for its chain (fresher); every landed chain
  // must be known, else the value is unknown ('--'), never a partial sum.
  const totalBase = useMemo(() => {
    if (chainRows == null) return null
    let sum = 0n
    for (const chain of chains) {
      if (walletChainLanded && chain === walletChain) {
        if (walletLeg == null) return null
        sum += walletLeg
      } else {
        const raw = chainRows[String(chain)]
        if (raw == null) return null
        sum += BigInt(raw)
      }
    }
    return sum
  }, [chainRows, walletChainLanded, walletChain, walletLeg, chains])

  const amount = !real ? sample : totalBase != null ? Number(formatUnits(totalBase, 18)) : null
  const body =
    amount != null && amount > 0
      ? `${formatAmount(amount, locale)} ${raiseAsset}`
      : real && connected && amount == null
        ? '--'
        : copy.verse.notParticipating

  return <dd data-numeric={amount != null && amount > 0 ? true : undefined}>{body}</dd>
}

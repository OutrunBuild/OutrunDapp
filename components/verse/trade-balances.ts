'use client'

// Verse-scoped wallet balance probe (trade desk supply sides, POL/PT/YT holdings, four-pool LP
// and the yield vault's account state). Personal values never ride the SSR path — the server
// renders accountless slots and this probe fills them through the wallet provider once
// connected on the verse's execution chain (the same provider/reader seam every write dialog
// uses, so the session tuple is shared and cached). Fixture/harness builds return null and the
// SSR samples keep rendering.
//
// Transport: every read rides Multicall3 batches (same discipline as the server data layer,
// bounded ≤50 calls per eth_call) — three dependency-ordered batches resolve PT/YT+reserve,
// then LP token addresses, then balances/vault/queue, ~4 round trips instead of 20+ parallel
// requests through the wallet provider (parallel bursts are what trip public-RPC rate limits,
// the transient failures that used to pin the card at '--').
//
// Shared runs: one page mounts far more probe consumers than distinct read shapes (the dialog
// group alone mounts several instances over the same verse), so concurrent probes of the same
// (chain, verse, account, uAsset) join ONE in-flight network run — a confirmed write (and each
// settle-window re-read it schedules) costs one batch set instead of one per mount. Reads are
// public chain state, so sharing cannot mix identities; the account is part of the key.
//
// Failure isolation: optional legs (PT/YT resolution, PSM reserve, vault state, LP tokens)
// map to their absent slots instead of blanking the whole probe — a verse without those
// deployments must not cost the swap panel its core Balance rows (allowFailure keeps a
// reverted call per-call). A failed core leg (memecoin/uAsset/pol) keeps the '--' slot rather
// than fabricating a zero balance, and a failed run retries a bounded number of times: nothing
// else re-triggers the probe until the account/chain moves or a write settles, so one
// transient error would otherwise pin every personal slot at '--' for the rest of the visit.
import { useEffect, useRef, useState } from 'react'
import { formatUnits, type Abi, type Hex } from 'viem'

import { erc20ReadAbi, psmAbi, splitterAbi, swapRouterAbi, yieldVaultAbi } from '@/lib/web3/abis'
import { useActiveEip1193Provider, type Eip1193ProviderLike } from '@/lib/web3/active-provider'

import { getVerseSession } from '../global/write-session'
import { useAccountCenter } from '../global/use-account-center'
import { useVerseExecChain } from '../global/switch-chain-cta'
import { useVerseWriteNonce } from '../global/verse-write-signal'

const PROBE_RETRIES = 3
const PROBE_RETRY_MS = 4_000

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

/** Exact wallet read for one token leg: the raw smallest-unit integer plus the token's
 * decimals. Balance gates, Max fills and balance displays derive from these integers —
 * float64 can represent a real balance only approximately (Number(formatUnits()) rounds,
 * a Max prefill re-parsed from a rounded float can exceed the true balance), so when the
 * exact read landed it must win over every number field below. */
export type ExactTokenBalance = { base: bigint; decimals: number }

/** Zero leg for an optional token that resolved as absent on-chain (no POLend → no PT/YT
 * deployment): gates fail-closed identically at any decimals, mirroring the float paths' 0. */
const EXACT_ABSENT: ExactTokenBalance = { base: 0n, decimals: 18 }

export type VerseBalancesExact = {
  memecoin: ExactTokenBalance | null
  uAsset: ExactTokenBalance | null
  pol: ExactTokenBalance | null
  pt: ExactTokenBalance | null
  yt: ExactTokenBalance | null
  /** PSM-paired reserve (USDC); absent when the family has no PSM pair on this chain */
  reserve?: ExactTokenBalance
  /** Four-pool LP token balances (UniswapLP clones, 18-dec); per-pool null=read failed/absent */
  lp: {
    main: ExactTokenBalance | null
    'pol-uasset': ExactTokenBalance | null
    'pt-uasset': ExactTokenBalance | null
    'pt-pol': ExactTokenBalance | null
  }
  /** Yield vault account state; null=the verse has no vault or the read failed */
  vault: {
    shares: ExactTokenBalance
    /** Matured withdrawable assets (claimableRedeemRequest converted through the share rate) */
    claimableTotal: ExactTokenBalance
    pending: Array<{
      lockedAssetsBase: bigint
      requestedAt: string
      maturesAt: string
      ready: boolean
      remainingMs: number
    }>
  } | null
}

export type VerseBalances = {
  memecoin: number
  uAsset: number
  pol: number
  pt: number
  yt: number
  /** PSM-paired reserve (USDC); absent when the family has no PSM pair on this chain */
  reserve?: number
  /** Four-pool LP token balances (UniswapLP clones, 18-dec); per-pool null=read failed */
  lp: {
    main: number | null
    'pol-uasset': number | null
    'pt-uasset': number | null
    'pt-pol': number | null
  }
  /** Yield vault account state; null=the verse has no vault or the read failed */
  vault: {
    shares: number
    delegatee: string | null
    /** Matured withdrawable assets (claimableRedeemRequest converted through the share rate) */
    claimableTotal: number
    pending: Array<{
      lockedAssets: number
      requestedAt: string
      maturesAt: string
      ready: boolean
      remainingMs: number
    }>
  } | null
  /** Exact wallet reads (raw base units + decimals). The number fields above are the
   * fixture-sample fallback's shape: a gate/prefill must prefer the exact leg whenever its
   * consumer's probe landed and the leg resolved. */
  exact: VerseBalancesExact
}

/** One contract read inside a multicall batch; the index it lands at is the mapping key */
type ProbeCall = { address: Hex; abi: Abi; functionName: string; args?: unknown[] }

/** viem allowFailure slot: per-call revert stays per-call, never fails the whole batch */
type ProbeSlot = { status: 'success'; result: unknown } | { status: 'failure' }

/** Everything one network run needs; identical tuples share the in-flight run */
type ProbeDeps = {
  provider: Eip1193ProviderLike
  execChain: number
  account: Hex
  verseId: string
  uAssetSymbol?: string
}

/** One full probe network run: resolve PT/YT + reserve, resolve LP addresses, then read
 * balances/vault/queue. Throws on any failed run (transport error or failed core leg) —
 * per-consumer nulling/retry is the hook's concern, not the shared run's. */
async function probeVerseBalances(deps: ProbeDeps): Promise<VerseBalances> {
  const { provider, execChain, account, verseId, uAssetSymbol } = deps
  const session = await getVerseSession({
    provider,
    chains: [execChain],
    eoa: account,
    verseId: BigInt(verseId),
  })
  const client = session.client
  const reader = session.reader
  const psm =
    uAssetSymbol != null
      ? (session.contracts[`OutrunPSM.${uAssetSymbol}`] as Hex | undefined)
      : undefined
  const splitter = session.contracts.POLSplitter as Hex | undefined
  const router = session.contracts.MemeverseSwapRouter as Hex | undefined

  const batchOf = async (list: ProbeCall[]): Promise<ProbeSlot[]> =>
    list.length === 0
      ? []
      : ((await client.multicall({
          // Heterogeneous contracts: viem's inference wants a per-call tuple; the shapes
          // are structurally valid, results are consumed per-index with per-slot casts
          contracts: list as unknown as Parameters<typeof client.multicall>[0]['contracts'],
          allowFailure: true,
        })) as unknown as ProbeSlot[])
  const pushTo = (list: ProbeCall[]) => (call: ProbeCall) => {
    list.push(call)
    return list.length - 1
  }

  // Batch 1 — optional resolution legs. PT/YT addresses and the PSM reserve feed the
  // later batches' token lists, so they resolve first in their own single call.
  const resolveCalls: ProbeCall[] = []
  const resolvePush = pushTo(resolveCalls)
  const ptIdx = splitter
    ? resolvePush({ address: splitter, abi: splitterAbi, functionName: 'getPTAndYT', args: [BigInt(verseId)] })
    : -1
  const reserveIdx = psm ? resolvePush({ address: psm, abi: psmAbi, functionName: 'reserveToken' }) : -1
  const resolved = await batchOf(resolveCalls)
  const slotOf =
    (slots: ProbeSlot[]) =>
    (index: number): { hit: boolean; value: unknown } => {
      if (index < 0) return { hit: false, value: undefined }
      const slot = slots[index]
      return slot != null && slot.status === 'success' ? { hit: true, value: slot.result } : { hit: false, value: undefined }
    }
  const resolveSlot = slotOf(resolved)
  const ptAndYt =
    ptIdx >= 0 && resolveSlot(ptIdx).hit ? (resolveSlot(ptIdx).value as [Hex, Hex]) : null
  const reserveToken =
    reserveIdx >= 0 && resolveSlot(reserveIdx).hit ? (resolveSlot(reserveIdx).value as Hex) : null
  // A verse without POLend leverage resolves PT/YT as zero addresses (the splitter does
  // not revert) — those legs read as "no such token", same as a missing contract
  const [ptRaw, ytRaw] = ptAndYt ?? [null, null]
  const pt = ptRaw != null && ptRaw !== ZERO_ADDRESS ? ptRaw : null
  const yt = ytRaw != null && ytRaw !== ZERO_ADDRESS ? ytRaw : null

  // Batch 2 — four-pool LP token addresses (pairs over the verse's five tokens, PT
  // resolved above). The addresses are inputs to batch 3's LP balance legs.
  const lpOf: Array<['main' | 'pol-uasset' | 'pt-uasset' | 'pt-pol', Hex, Hex]> = router
    ? ([
        ['main', session.verse.memecoin, session.verse.uAsset],
        ['pol-uasset', session.verse.pol, session.verse.uAsset],
        ...(pt != null
          ? ([
              ['pt-uasset', pt, session.verse.uAsset],
              ['pt-pol', pt, session.verse.pol],
            ] as ['pt-uasset' | 'pt-pol', Hex, Hex][])
          : []),
      ] as Array<['main' | 'pol-uasset' | 'pt-uasset' | 'pt-pol', Hex, Hex]>)
    : []
  const lpCalls: ProbeCall[] = []
  const lpPush = pushTo(lpCalls)
  const lpIndex = new Map<'main' | 'pol-uasset' | 'pt-uasset' | 'pt-pol', number>()
  if (router) {
    for (const [kind, a, b] of lpOf) {
      lpIndex.set(kind, lpPush({ address: router, abi: swapRouterAbi, functionName: 'lpToken', args: [a, b] }))
    }
  }
  const lpResolved = await batchOf(lpCalls)
  const lpSlot = slotOf(lpResolved)
  // lpToken answers zero addresses for pools that never had liquidity added (it does not
  // revert) — a settled verse with only some of its four pools funded reads the unfunded
  // ones as "no such token", never as a balanceOf target
  const lpAddresses: Array<['main' | 'pol-uasset' | 'pt-uasset' | 'pt-pol', Hex | null]> = lpOf.map(
    ([kind]) => {
      const hit = lpSlot(lpIndex.get(kind) ?? -1)
      return [kind, hit.hit && hit.value !== ZERO_ADDRESS ? (hit.value as Hex) : null]
    },
  )

  const legTokens: Array<{ token: Hex; kind: keyof VerseBalances | 'lpMain' | 'lpPolUAsset' | 'lpPtUAsset' | 'lpPtPol' }> = [
    { token: session.verse.memecoin, kind: 'memecoin' },
    { token: session.verse.uAsset, kind: 'uAsset' },
    { token: session.verse.pol, kind: 'pol' },
  ]
  if (pt != null) legTokens.push({ token: pt, kind: 'pt' })
  if (yt != null) legTokens.push({ token: yt, kind: 'yt' })
  if (reserveToken != null) legTokens.push({ token: reserveToken, kind: 'reserve' })
  const lpKindMap = {
    main: 'lpMain',
    'pol-uasset': 'lpPolUAsset',
    'pt-uasset': 'lpPtUAsset',
    'pt-pol': 'lpPtPol',
  } as const
  for (const [kind, token] of lpAddresses) {
    if (token != null) legTokens.push({ token, kind: lpKindMap[kind] })
  }

  // Batch 3 — balances + decimals for every leg, the vault's account cluster and its
  // queue sweep, all in one eth_call (≤4 lp + 2×10 leg + 4+1 vault + 16 queue ≤ 45 < 50).
  // The queue is a fixed 16-deep sweep: no length getter exists, idle accounts decode 0
  // on the first entry and the mapping below stops there.
  const calls: ProbeCall[] = []
  const push = pushTo(calls)
  const balIndex = new Map<keyof VerseBalances | 'lpMain' | 'lpPolUAsset' | 'lpPtUAsset' | 'lpPtPol', number>()
  const decIndex = new Map<keyof VerseBalances | 'lpMain' | 'lpPolUAsset' | 'lpPtUAsset' | 'lpPtPol', number>()
  for (const leg of legTokens) {
    balIndex.set(leg.kind, push({ address: leg.token, abi: erc20ReadAbi, functionName: 'balanceOf', args: [account] }))
    decIndex.set(leg.kind, push({ address: leg.token, abi: erc20ReadAbi, functionName: 'decimals' }))
  }
  const vaultAddr = session.verse.yieldVault
  const hasVault = vaultAddr != null && vaultAddr !== ZERO_ADDRESS
  const vaultIdx = { shares: -1, delegates: -1, claimable: -1, delay: -1, decimals: -1 }
  const queueIdx: number[] = []
  if (hasVault && vaultAddr != null) {
    vaultIdx.shares = push({ address: vaultAddr, abi: yieldVaultAbi, functionName: 'balanceOf', args: [account] })
    vaultIdx.delegates = push({ address: vaultAddr, abi: yieldVaultAbi, functionName: 'delegates', args: [account] })
    vaultIdx.claimable = push({ address: vaultAddr, abi: yieldVaultAbi, functionName: 'claimableRedeemRequest', args: [account] })
    vaultIdx.delay = push({ address: vaultAddr, abi: yieldVaultAbi, functionName: 'REDEEM_DELAY' })
    vaultIdx.decimals = push({ address: vaultAddr, abi: erc20ReadAbi, functionName: 'decimals' })
    for (let i = 0; i < 16; i += 1) {
      queueIdx.push(
        push({ address: vaultAddr, abi: yieldVaultAbi, functionName: 'redeemRequestQueues', args: [account, BigInt(i)] }),
      )
    }
  }
  const results = await batchOf(calls)
  const slot = slotOf(results)

  // Per-leg isolation: a failed optional leg reads as its absent slot (same as a missing
  // contract); a failed core leg must not fabricate 0 — that would read as "no funds" and
  // arm the insufficient-balance CTA, so it fails the run (slot '--' + retry).
  const baseByKind: Record<string, bigint> = {}
  const decimalsByKind: Record<string, number> = {}
  const rows = legTokens.map((leg): [string, number | null] => {
    const bal = slot(balIndex.get(leg.kind) ?? -1)
    const dec = slot(decIndex.get(leg.kind) ?? -1)
    if (bal.hit && dec.hit) {
      const base = BigInt(String(bal.value))
      const decimals = Number(dec.value)
      baseByKind[leg.kind] = base
      decimalsByKind[leg.kind] = decimals
      return [leg.kind, Number(formatUnits(base, decimals))]
    }
    return [leg.kind, null]
  })
  const coreFailed = rows.some(
    ([kind, value]) =>
      value == null && (kind === 'memecoin' || kind === 'uAsset' || kind === 'pol'),
  )
  if (coreFailed) throw new Error('core leg read failed')

  const byKind = Object.fromEntries(rows.filter((row) => row[1] != null)) as Record<string, number>

  // Vault account state: shares/delegate/claimable + the redeem queue with maturity
  // split. The vault is an optional leg — any failed slot in its cluster degrades to the
  // null vault slot instead of blanking the balance rows.
  let vault: VerseBalances['vault'] = null
  let vaultExact: VerseBalancesExact['vault'] = null
  if (hasVault && vaultAddr != null) {
    const shares = slot(vaultIdx.shares)
    const delegates = slot(vaultIdx.delegates)
    const claimable = slot(vaultIdx.claimable)
    const delay = slot(vaultIdx.delay)
    const vDec = slot(vaultIdx.decimals)
    if (shares.hit && delegates.hit && claimable.hit && delay.hit && vDec.hit) {
      const shareDecimals = Number(vDec.value)
      const claimableShares = BigInt(String(claimable.value))
      // convertToAssets depends on claimableShares, so it rides its own conditional
      // read; failure degrades the vault leg only
      let claimableAssetsRaw = 0n
      let convertOk = true
      if (claimableShares > 0n) {
        try {
          claimableAssetsRaw = BigInt(
            String(
              await reader.read({
                address: vaultAddr,
                abi: yieldVaultAbi,
                functionName: 'convertToAssets',
                args: [claimableShares],
              }),
            ),
          )
        } catch {
          convertOk = false
        }
      }
      if (convertOk) {
        const delayMs = Number(BigInt(String(delay.value))) * 1000
        const pending: Array<{
          lockedAssets: number
          lockedAssetsBase: bigint
          requestedAt: string
          maturesAt: string
          ready: boolean
          remainingMs: number
        }> = []
        for (let i = 0; i < 16; i += 1) {
          const entry = slot(queueIdx[i] ?? -1)
          if (!entry.hit) break
          const [lockedAssets, requestTime] = entry.value as [bigint, bigint, bigint]
          if (lockedAssets <= 0n) break
          const maturesMs = Number(requestTime) * 1000 + delayMs
          const nowMs = Date.now()
          pending.push({
            // lockedAssets is the vault ASSET amount frozen by requestRedeem
            // (_convertToAssets(shares)); it carries memecoin decimals, not share decimals
            lockedAssets: Number(formatUnits(lockedAssets, decimalsByKind.memecoin ?? 18)),
            lockedAssetsBase: lockedAssets,
            requestedAt: new Date(Number(requestTime) * 1000).toISOString(),
            maturesAt: new Date(maturesMs).toISOString(),
            ready: maturesMs <= nowMs,
            remainingMs: Math.max(0, maturesMs - nowMs),
          })
        }
        vault = {
          shares: Number(formatUnits(BigInt(String(shares.value)), shareDecimals)),
          delegatee: String(delegates.value),
          claimableTotal: Number(formatUnits(claimableAssetsRaw, decimalsByKind.memecoin ?? 18)),
          pending,
        }
        vaultExact = {
          shares: { base: BigInt(String(shares.value)), decimals: shareDecimals },
          // claimableAssetsRaw is asset-denominated (convertToAssets output): it carries
          // the vault ASSET's decimals, not the share decimals — only .base is consumed
          // today, but a future formatBaseUnits/gate here must divide by the asset radix
          claimableTotal: { base: claimableAssetsRaw, decimals: decimalsByKind.memecoin ?? 18 },
          pending: pending.map(({ lockedAssetsBase, requestedAt, maturesAt, ready, remainingMs }) => ({
            lockedAssetsBase,
            requestedAt,
            maturesAt,
            ready,
            remainingMs,
          })),
        }
      }
    }
  }

  const exactLeg = (kind: string): ExactTokenBalance | null =>
    baseByKind[kind] != null ? { base: baseByKind[kind], decimals: decimalsByKind[kind] } : null
  return {
    memecoin: byKind.memecoin ?? 0,
    uAsset: byKind.uAsset ?? 0,
    pol: byKind.pol ?? 0,
    pt: byKind.pt ?? 0,
    yt: byKind.yt ?? 0,
    ...(byKind.reserve != null ? { reserve: byKind.reserve } : {}),
    lp: {
      main: byKind.lpMain ?? null,
      'pol-uasset': byKind.lpPolUAsset ?? null,
      'pt-uasset': byKind.lpPtUAsset ?? null,
      'pt-pol': byKind.lpPtPol ?? null,
    },
    vault,
    exact: {
      // Core legs are guaranteed present (the coreFailed early-return above); optional
      // legs mirror their float counterparts: absent PT/YT read as the zero leg, absent
      // LP/reserve stay null so the sample fallback keeps deciding.
      memecoin: exactLeg('memecoin'),
      uAsset: exactLeg('uAsset'),
      pol: exactLeg('pol'),
      pt: exactLeg('pt') ?? EXACT_ABSENT,
      yt: exactLeg('yt') ?? EXACT_ABSENT,
      ...(exactLeg('reserve') != null ? { reserve: exactLeg('reserve') as ExactTokenBalance } : {}),
      lp: {
        main: exactLeg('lpMain'),
        'pol-uasset': exactLeg('lpPolUAsset'),
        'pt-uasset': exactLeg('lpPtUAsset'),
        'pt-pol': exactLeg('lpPtPol'),
      },
      vault: vaultExact,
    },
  }
}

// First caller per key owns the network run; concurrent consumers join the same promise and
// the map self-cleans on settle. A superseded consumer just ignores the awaited result —
// dropping its reference costs nothing, the shared run serves whoever is still current.
// Exported for the dedup contract tests (tests/unit/trade-balances-dedup.test.ts).
const inflightProbes = new Map<string, Promise<VerseBalances>>()

export function sharedVerseProbe(deps: ProbeDeps): Promise<VerseBalances> {
  const key = `${deps.execChain}:${deps.verseId}:${deps.account}:${deps.uAssetSymbol ?? ''}`
  const existing = inflightProbes.get(key)
  if (existing) return existing
  const run = probeVerseBalances(deps).finally(() => {
    if (inflightProbes.get(key) === run) inflightProbes.delete(key)
  })
  inflightProbes.set(key, run)
  return run
}

export function useVerseBalances(input: {
  verseId: string | null
  /** Raise uAsset symbol (PSM reserve lookup); optional — probes without a reserve leg skip it */
  uAssetSymbol?: string
  governanceChain: number
  /** Bumped by the caller on a confirmed write so the post-write balances re-read */
  refreshKey?: number
}): VerseBalances | null {
  const center = useAccountCenter()
  const { execChain, wrongChain } = useVerseExecChain(input.governanceChain)
  const [balances, setBalances] = useState<VerseBalances | null>(null)
  const walletChain = center.chainId
  const account = center.address
  // The verse's contracts live on its execution chain — another chain's same-address deployment
  // reverts InvalidVerseId, so the probe only fires in-place (no switch prompt from a read).
  const active =
    center.source === 'real' &&
    center.connected &&
    !wrongChain &&
    walletChain === execChain &&
    account != null &&
    input.verseId != null

  // Any identity/scope move (account, wallet chain, exec chain, verse) is the sanctioned
  // reset point — the values describe the previous scope, and the retry budget belongs to
  // that scope too (a same-page verse switch must not inherit the old verse's budget).
  const retries = useRef(0)
  useEffect(() => {
    setBalances(null)
    retries.current = 0
  }, [account, walletChain, execChain, input.verseId])

  // Latest probe wins: a rapid re-trigger's read must not overwrite the newer one's.
  const seq = useRef(0)
  const [retryTick, setRetryTick] = useState(0)
  // Any confirmed verse write on this page (another dialog's included) re-reads the batch —
  // balances are shared state across surfaces, the writing component alone must not be the
  // only one that converges
  const writeNonce = useVerseWriteNonce()
  // The provider registers asynchronously (the account center resolves connector.getProvider()
  // after the connected state restores — any wallet track, MetaMask included): reading it
  // imperatively at mount races that registration and a null read used to exit silently — no
  // retry, no dep change, the probe stayed dead until an unrelated trigger (a confirmed write)
  // re-ran it. The reactive hook re-fires the probe the moment the provider lands.
  const activeWalletProvider = useActiveEip1193Provider()
  useEffect(() => {
    const verseId = input.verseId
    if (!active || account == null || verseId == null) return
    const provider = activeWalletProvider
    if (!provider) return
    const run = ++seq.current
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    const fail = () => {
      if (run !== seq.current) return
      setBalances(null)
      if (retries.current < PROBE_RETRIES) {
        retries.current += 1
        retryTimer = setTimeout(() => setRetryTick((tick) => tick + 1), PROBE_RETRY_MS)
      }
    }
    void (async () => {
      try {
        const next = await sharedVerseProbe({
          provider,
          execChain,
          account: account as Hex,
          verseId,
          uAssetSymbol: input.uAssetSymbol,
        })
        if (run !== seq.current) return
        retries.current = 0
        setBalances(next)
      } catch {
        if (run !== seq.current) return
        fail()
      }
    })()
    return () => clearTimeout(retryTimer)
  }, [active, account, execChain, input.verseId, input.uAssetSymbol, input.refreshKey, retryTick, writeNonce, activeWalletProvider])

  return active ? balances : null
}

/** Trade-desk subset (swap panel supply sides). Kept as its own name for the swap panel's
 *  narrower concern; the full probe costs the same shared session. */
export function useTradeBalances(input: {
  verseId: string | null
  uAssetSymbol?: string
  governanceChain: number
  refreshKey?: number
}) {
  return useVerseBalances(input)
}

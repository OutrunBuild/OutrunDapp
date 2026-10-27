'use client'

/**
 * Claim Center (locked/unlocked fifth tab): the verse page's per-user claim surface. Four
 * rows — preorder unlock (claimUnlockedPreorderMemecoin), initial YT (claimNormalYT),
 * auxiliary-pool fee share (claimNormalFees), main-pool LP fees (hook claimFeesCore).
 * Entitlements are wallet-scoped and read through the wallet provider on the wallet's
 * current landed chain (same single-chain execution scope as EndGenesisButton: claims run
 * where the wallet sits; cross-chain aggregation is a later layer, MyParticipationStat
 * family). Fixture builds keep the SSR sample rows (e2e baselines) with inert CTAs — no
 * faked execution. Claim interaction = one confirm dialog (user ruling): the dialog IS the
 * review (amounts in, no inputs), then a §29-style direct write with the shared TxStatus.
 */
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
import { encodePacked, formatUnits, keccak256, toHex, type Hex } from 'viem'
import { Info } from 'lucide-react'

import type { Locale } from '@/lib/data/fixture-repository'
import { erc20ReadAbi, launcherAbi, swapRouterAbi } from '@/lib/web3/abis'
import {
  executionChainId,
  getClientChainConfig,
  verseExecutionChains,
  verseSwitchChainId,
} from '@/lib/web3/chains'
import { getActiveEip1193Provider, useActiveEip1193Provider } from '@/lib/web3/active-provider'
import {
  claimLpFeesCall,
  claimNormalFeesCall,
  claimNormalYTCall,
  claimPreorderCall,
} from '@/lib/web3/session-actions'

import { ActionDialogShell } from '../global/action-dialogs'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { FieldError } from '@/components/ui/field'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { readPoolKey, readVerseAddresses, type ContractReader } from '../global/execution-reads'
import { readVerseLockedAt } from '@/lib/data/verse-reads'
import { getCopy } from '../global/copy'
import { formatAmount } from '../global/signal-ui'
import { SwitchChainCta } from '../global/switch-chain-cta'
import { useAccountCenter } from '../global/use-account-center'
import { useWalletProviderReader } from '../global/wallet-provider-reader'
import { probeVerseChain } from '../global/write-session'
import { useTxCenter, type WriteSpec } from '../global/use-tx-center'
import { TxProgressDialog } from '../global/tx-progress-dialog'
import { TxSuccessDialog, type TxSuccessRow } from '../global/tx-success-dialog'
import { useTxSuccessGate } from '../global/use-tx-success'

// MemeverseLauncher ERC-7201 storage base ("outrun.storage.MemeverseLauncher", OZ
// SlotDerivation double-keccak formula) — see the vesting lane comment for the field map.
const LAUNCHER_BASE = (() => {
  const h1 = BigInt(keccak256(toHex('outrun.storage.MemeverseLauncher')))
  const inner = toHex((h1 - 1n) % (1n << 256n), { size: 32 })
  return BigInt(keccak256(inner)) & ~0xffn
})()

import {
  claimableBadgeCount,
  deriveClaimRows,
  type ClaimEntitlements,
  type ClaimRow,
  type ClaimRowKind,
} from './claim-rows'

type ClaimCenterState = {
  /** null while reads are in flight or after a failure ('--' slots); rows exist once known */
  live: ClaimEntitlements | null
  liveKnown: boolean
  /** the core read failed or timed out — the failed copy replaces the loading line */
  liveFailed: boolean
  /** Wallet-chain reader (claim writes resolve the LP pool key through it) */
  reader: ContractReader | null
  refresh: () => void
}

const ClaimCenterContext = createContext<ClaimCenterState | null>(null)

export function ClaimCenterProvider({
  verseIdParam,
  governanceChain,
  deployedChainIds,
  memecoinSymbol,
  uAssetSymbol,
  children,
}: {
  /** Numeric on-chain verse id (URL segment) */
  verseIdParam: string
  governanceChain: number
  deployedChainIds: number[] | null
  memecoinSymbol: string
  uAssetSymbol: string
  children: ReactNode
}) {
  const center = useAccountCenter()
  const real = center.source === 'real'
  const execChains = useMemo(
    () => verseExecutionChains(governanceChain, deployedChainIds),
    [governanceChain, deployedChainIds],
  )
  const chainInVerse = center.chainId != null && execChains.includes(center.chainId)
  const eligible = real && center.connected && center.address != null && chainInVerse
  const providerReader = useWalletProviderReader(eligible ? center.chainId : null)
  const [live, setLive] = useState<ClaimEntitlements | null>(null)
  const [liveKnown, setLiveKnown] = useState(false)
  const [liveFailed, setLiveFailed] = useState(false)
  const [readNonce, setReadNonce] = useState(0)
  const refresh = useCallback(() => setReadNonce((nonce) => nonce + 1), [])

  // Focus re-read: a stalled or failed testnet RPC read recovers without a manual reload
  // (MyParticipationStat family — visibility/focus bumps the read nonce).
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

  // Account/chain moves are the sanctioned reset point (MyParticipationStat family).
  useEffect(() => {
    setLive(null)
    setLiveKnown(false)
    setLiveFailed(false)
  }, [center.address, center.chainId])

  const readDeps = `${center.address ?? ''}:${center.chainId ?? ''}:${readNonce}`
  const lastRead = useRef('')

  useEffect(() => {
    if (!eligible || providerReader == null) return
    const key = `${readDeps}:${verseIdParam}`
    if (lastRead.current === key) return
    lastRead.current = key
    let cancelled = false
    const readPromise = (async (): Promise<ClaimEntitlements | null> => {
      try {
        // shared positional-tuple decode (viem returns named objects for struct outputs)
        const big = (value: unknown) => BigInt(String(value))
        const reader = providerReader.reader
        const account = center.address as Hex
        const launcher = providerReader.addresses.MemeverseLauncher as Hex | undefined
        const router = providerReader.addresses.MemeverseSwapRouter as Hex | undefined
        if (!launcher) throw new Error('outrun: missing contracts')
        const vid = BigInt(verseIdParam)
        // Base identity reads (verse tokens): the one prerequisite every card shares.
        // A failure here is a genuine environment failure → the failed state.
        const { uAsset, memecoin } = await readVerseAddresses(reader, launcher, vid)
        // ── One batched round for all card reads (user perf ruling): viem multicall with
        // allowFailure keeps per-slot status, so a reverting lane still degrades alone —
        // batching never couples card failures. EXCEPTION learned on-chain: viem does NOT
        // split `account`-carrying calls out of the aggregate — inside aggregate3 the
        // msg.sender is the multicall contract, so the scoped preorder preview silently
        // read 0. It rides as its own readContract (from = the account) beside the batch.
        // Storage-slot vesting reads ride alongside too (getStorageAt cannot join a batch). ──
        type BatchEntry = {
          address: Hex
          abi: typeof launcherAbi | typeof erc20ReadAbi | typeof swapRouterAbi
          functionName: string
          args?: readonly unknown[]
        }
        const batch: BatchEntry[] = [
          { address: uAsset, abi: erc20ReadAbi, functionName: 'decimals' },
          { address: memecoin, abi: erc20ReadAbi, functionName: 'decimals' },
          { address: launcher, abi: launcherAbi, functionName: 'userPreorderData', args: [vid, account] },
          { address: launcher, abi: launcherAbi, functionName: 'userGenesisData', args: [vid, account] },
          { address: launcher, abi: launcherAbi, functionName: 'totalNormalFunds', args: [vid] },
          { address: launcher, abi: launcherAbi, functionName: 'totalNormalClaimableYT', args: [vid] },
          { address: launcher, abi: launcherAbi, functionName: 'normalYTClaimed', args: [vid, account] },
          { address: launcher, abi: launcherAbi, functionName: 'normalFeeStates', args: [vid] },
          { address: launcher, abi: launcherAbi, functionName: 'userNormalFeeClaims', args: [vid, account] },
        ]
        if (router) {
          batch.push(
            { address: router, abi: swapRouterAbi, functionName: 'previewClaimableFees', args: [memecoin, uAsset, account] },
            { address: router, abi: swapRouterAbi, functionName: 'getHookPoolKey', args: [memecoin, uAsset] },
          )
        }
        const [metaResults, preorderNowRaw, vestProgress] = await Promise.all([
          providerReader.client.multicall({ contracts: batch as never, allowFailure: true }) as Promise<
            Array<{ status: 'success' | 'failure'; result: unknown } | null>
          >,
          // msg.sender-scoped: standalone eth_call with the account as from
          reader.read({
            address: launcher,
            abi: launcherAbi,
            functionName: 'claimablePreorderMemecoin',
            args: [vid],
            account,
          }).catch(() => null),
          // Vesting-progress lane: the launcher keeps the schedule in namespaced storage with
          // NO public view (OZ SlotDerivation erc7201 — note the DOUBLE keccak: base =
          // keccak(bytes32(keccak(ns) − 1)) & ~0xff). Field offsets (append-only struct):
          // preorderVestingDuration @ +11, preorderStates mapping @ +18, PreorderState.
          // settlementTimestamp @ entry +2. Dual-source gate (user discipline ruling): the
          // slot clock only renders when it agrees with the subgraph's stage-change locked-at
          // (±1h) — a bad slot derivation (or bad read) degrades the progress slot instead of
          // showing a wrong percentage. Fixture builds carry progress samples directly.
          (async (): Promise<number | undefined> => {
            try {
              const client = providerReader.client
              const [durRaw, settledRaw, lockedAt] = await Promise.all([
                client.getStorageAt({ address: launcher, slot: toHex(LAUNCHER_BASE + 11n, { size: 32 }) }),
                client.getStorageAt({
                  address: launcher,
                  slot: toHex(
                    BigInt(keccak256(encodePacked(['uint256', 'uint256'], [vid, LAUNCHER_BASE + 18n]))) + 2n,
                    { size: 32 },
                  ),
                }),
                // authoritative second source (server action; rides this round in parallel)
                readVerseLockedAt({ chainId: center.chainId as number, verseId: verseIdParam }),
              ])
              const duration = Number(BigInt(durRaw ?? '0x0'))
              if (!(duration > 0)) return undefined
              const settled = Number(BigInt(settledRaw ?? '0x0') & 0xffffffffffn)
              // Dual-source agreement: no subgraph timestamp, or >1h apart → no progress slot.
              if (lockedAt == null || Math.abs(settled - lockedAt) > 3_600) return undefined
              if (!(settled > 0)) return 0
              const elapsed = Math.floor(Date.now() / 1000) - settled
              if (elapsed <= 0) return 0
              return Math.min(1, elapsed / duration)
            } catch {
              return undefined
            }
          })(),
        ])
        // Per-slot decode: a failure slot yields null → that card degrades alone.
        const slot = (i: number): readonly unknown[] | null => {
          const r = metaResults[i]
          if (r == null || r.status !== 'success') return null
          const v = r.result
          return Array.isArray(v) ? v : v != null && typeof v === 'object' ? Object.values(v as Record<string, unknown>) : null
        }
        const scalar = (i: number): bigint | null => {
          const r = metaResults[i]
          if (r == null || r.status !== 'success') return null
          try {
            return BigInt(String(r.result))
          } catch {
            return null
          }
        }
                const uAssetDec = scalar(0) != null ? Number(scalar(0)) : 18
        const memeDec = scalar(1) != null ? Number(scalar(1)) : 18
        const asAmount = (base: bigint, decimals: number) => Number(formatUnits(base, decimals))
        const e: ClaimEntitlements = { memecoinSymbol, uAssetSymbol }
        // Preorder unlock (batch slot 2 + the standalone scoped preview).
        const preorderTuple = slot(2)
        const preorderNow = preorderNowRaw != null ? big(preorderNowRaw) : null
        if (preorderTuple != null && preorderNow != null) {
          const funds = big(preorderTuple[0])
          const claimed = big(preorderTuple[1])
          if (funds > 0n || claimed > 0n || preorderNow > 0n) {
            e.preorder = {
              claimable: asAmount(preorderNow, memeDec),
              claimed: asAmount(claimed, memeDec),
              progress: vestProgress,
            }
          }
        }
        // Pro-rata base (slots 3+4) — the formula base the YT and fee cards both derive from.
        const genesisTuple = slot(3)
        const normalFunds = scalar(4)
        const proRata =
          genesisTuple != null && normalFunds != null && big(genesisTuple[0]) > 0n && normalFunds > 0n
            ? { userFund: big(genesisTuple[0]), normalFunds }
            : null
        // One-shot initial YT (slots 5+6).
        const totalYt = scalar(5)
        const ytClaimedRaw = metaResults[6]
        if (proRata && totalYt != null && ytClaimedRaw?.status === 'success' && !Boolean(ytClaimedRaw.result)) {
          const pending = (totalYt * proRata.userFund) / proRata.normalFunds
          if (pending > 0n) e.yt = { claimable: asAmount(pending, uAssetDec) }
        }
        // Auxiliary-pool fee share (slots 7+8).
        const feeStateTuple = slot(7)
        const feeClaimsTuple = slot(8)
        if (proRata && feeStateTuple != null && feeClaimsTuple != null) {
          const pendingUAsset = (big(feeStateTuple[0]) * proRata.userFund) / proRata.normalFunds - big(feeClaimsTuple[0])
          const pendingPt = (big(feeStateTuple[1]) * proRata.userFund) / proRata.normalFunds - big(feeClaimsTuple[1])
          if (pendingUAsset > 0n || pendingPt > 0n) {
            e.fees = { uAsset: asAmount(pendingUAsset, uAssetDec), pt: asAmount(pendingPt, uAssetDec) }
          }
        }
        // Main-pool LP fees (slots 9+10; present only when a router is configured).
        const lpTuple = metaResults.length > 10 ? slot(9) : null
        const keyTuple = metaResults.length > 10 ? slot(10) : null
        if (lpTuple != null && keyTuple != null) {
          const memeFirst = String(keyTuple[0]).toLowerCase() === memecoin.toLowerCase()
          const lpMeme = big(memeFirst ? lpTuple[0] : lpTuple[1])
          const lpUAsset = big(memeFirst ? lpTuple[1] : lpTuple[0])
          if (lpMeme > 0n || lpUAsset > 0n) {
            e.lp = { meme: asAmount(lpMeme, memeDec), uAsset: asAmount(lpUAsset, uAssetDec) }
          }
        }
        // Every data slot failed → an environment failure, not an empty wallet; the failed
        // copy (with focus-retry) is the honest slot.
        if (
          e.preorder == null &&
          e.yt == null &&
          e.fees == null &&
          e.lp == null
        ) {
          return null
        }
        return e
      } catch {
        // base-identity failure lands in the failed state; the focus listener retries
        return null
      }
    })()
    // A stalled testnet RPC read must not pin the loading state forever (20s deadline — the
    // race resolves into the failed state and the focus listener re-reads).
    const deadline = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 20_000)
    })
    void Promise.race([readPromise, deadline]).then((e) => {
      if (cancelled) return
      if (e == null) {
        setLiveFailed(true)
        return
      }
      setLive(e)
      setLiveKnown(true)
    })
    return () => {
      cancelled = true
    }
  }, [eligible, providerReader, readDeps, verseIdParam, memecoinSymbol, uAssetSymbol, center.address])

  const state = useMemo<ClaimCenterState>(
    () => ({ live, liveKnown, liveFailed, reader: providerReader?.reader ?? null, refresh }),
    [live, liveKnown, liveFailed, providerReader, refresh],
  )
  return <ClaimCenterContext.Provider value={state}>{children}</ClaimCenterContext.Provider>
}

function useClaimCenter(): ClaimCenterState | null {
  return useContext(ClaimCenterContext)
}

/** Tab badge: cyan functional signal with the claimable count; absent when nothing is
 *  actionable (unconnected, reads pending, or zero claimable rows). Fixture builds show
 *  no badge — their rows are samples, not the viewer's own claims. */
export function ClaimTabBadge({ locale }: { locale: Locale }) {
  const center = useAccountCenter()
  const ctx = useClaimCenter()
  if (center.source !== 'real' || ctx == null || !ctx.liveKnown || ctx.live == null) return null
  const count = claimableBadgeCount(deriveClaimRows(ctx.live))
  if (count === 0) return null
  const copy = getCopy(locale).verseDesk
  return (
    <span
      className="claim-tab-badge"
      aria-label={copy.claimBadgeLabel.replace('{n}', String(count))}
    >
      {count}
    </span>
  )
}

function rowTitleKey(kind: ClaimRowKind) {
  switch (kind) {
    case 'preorder':
      return 'claimRowPreorder'
    case 'yt':
      return 'claimRowYt'
    case 'fees':
      return 'claimRowFees'
    default:
      return 'claimRowLp'
  }
}

function rowNoteKey(kind: ClaimRowKind) {
  switch (kind) {
    case 'preorder':
      return 'claimPreorderNote'
    case 'yt':
      return 'claimYtNote'
    case 'fees':
      return 'claimFeesNote'
    default:
      return 'claimLpNote'
  }
}

export function ClaimCenterPanel({
  locale,
  verseIdParam,
  governanceChain,
  governanceChainName,
  deployedChainIds,
  sample,
}: {
  locale: Locale
  verseIdParam: string
  governanceChain: number
  governanceChainName: string
  deployedChainIds: number[] | null
  /** Fixture-build sample rows (SSR) */
  sample: ClaimEntitlements | null
}) {
  const copy = getCopy(locale).verseDesk
  const common = getCopy(locale).common
  const center = useAccountCenter()
  const ctx = useClaimCenter()
  const activeProvider = useActiveEip1193Provider()
  const tx = useTxCenter()
  const { successOpen, setSuccessOpen, receipt } = useTxSuccessGate(tx)
  // Receipt legs snapshotted at the click (pendingRow closes with the receipt).
  const [claimRows, setClaimRows] = useState<TxSuccessRow[]>([])
  const [pendingRow, setPendingRow] = useState<ClaimRow | null>(null)
  const [resolving, setResolving] = useState(false)
  const [resolveFailed, setResolveFailed] = useState(false)
  const sampleMode = center.source !== 'real'

  const execChains = useMemo(
    () => verseExecutionChains(governanceChain, deployedChainIds),
    [governanceChain, deployedChainIds],
  )
  const chainInVerse = center.chainId != null && execChains.includes(center.chainId)
  const wrongChain = !sampleMode && center.connected && (center.chainId == null || !chainInVerse)
  const switchChainId = verseSwitchChainId(governanceChain, deployedChainIds)
  const switchChainName =
    switchChainId === executionChainId(governanceChain)
      ? governanceChainName
      : (() => {
          const config = getClientChainConfig(switchChainId)
          return config.status === 'ok' ? config.config.viemChain.name : String(switchChainId)
        })()

  const entitlements = sampleMode ? sample : (ctx?.live ?? null)
  const failed =
    !sampleMode && center.connected && !wrongChain && ctx != null && ctx.liveFailed
  const reading =
    !sampleMode && center.connected && !wrongChain && ctx != null && !ctx.liveKnown
  const rows = entitlements != null ? deriveClaimRows(entitlements) : []

  async function startClaim(row: ClaimRow): Promise<void> {
    if (sampleMode || resolving) return
    setClaimRows(
      [row.main, ...row.extra].map((leg) => ({
        label: common.txReceived,
        value: formatAmount(leg.amount, locale),
        symbol: leg.symbol,
      })),
    )
    const provider = activeProvider ?? getActiveEip1193Provider()
    const eoa = center.address as Hex | null
    const reader = ctx?.reader ?? null
    if (!provider || eoa == null) {
      setResolveFailed(true)
      return
    }
    setResolving(true)
    setResolveFailed(false)
    try {
      const chainId = await probeVerseChain(provider, execChains)
      const resolved = getClientChainConfig(chainId)
      if (resolved.status !== 'ok' || resolved.config.contracts.status !== 'deployed') {
        setResolveFailed(true)
        return
      }
      const launcher = resolved.config.contracts.addresses.MemeverseLauncher as Hex | undefined
      if (launcher == null) {
        setResolveFailed(true)
        return
      }
      const vid = BigInt(verseIdParam)
      let target: Hex
      let callData: Hex
      let functionName: string
      if (row.kind === 'preorder') {
        ;({ target, callData } = claimPreorderCall(launcher, vid))
        functionName = 'claimUnlockedPreorderMemecoin'
      } else if (row.kind === 'yt') {
        ;({ target, callData } = claimNormalYTCall(launcher, vid))
        functionName = 'claimNormalYT'
      } else if (row.kind === 'fees') {
        ;({ target, callData } = claimNormalFeesCall(launcher, vid))
        functionName = 'claimNormalFees'
      } else {
        // LP fees live on the hook: resolve the main-pool key through the wallet-chain reader.
        const router = resolved.config.contracts.addresses.MemeverseSwapRouter as Hex | undefined
        if (router == null || reader == null) {
          setResolveFailed(true)
          return
        }
        const { uAsset, memecoin } = await readVerseAddresses(reader, launcher, vid)
        const key = await readPoolKey(reader, router, memecoin, uAsset)
        ;({ target, callData } = claimLpFeesCall(key.hooks, key, eoa))
        functionName = 'claimFeesCore'
      }
      // The review object is a state-machine anchor only (never rendered — §29).
      const spec: WriteSpec = {
        review: {
          chainId,
          account: eoa,
          targetContract: target,
          functionName,
          inputs: `verse ${verseIdParam}`,
          minOutput: '—',
          fee: '—',
          gasPayer: eoa,
          authorizationChange: '—',
          estimatedGas: '—',
          nativeBalance: '—',
        },
        expectedChainId: chainId,
        batchCallData: callData,
        direct: { to: target, data: callData },
        quoteId: `claim:${row.kind}:${chainId}:${verseIdParam}:${Date.now()}`,
        minOutput: '—',
        slippageBps: 0,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        manifestVersion: resolved.config.contracts.abiVersion,
        crossChain: false,
        writeScope: { kind: 'verse', chainId, verseId: verseIdParam },
      }
      await tx.executeDirect(spec)
    } catch {
      setResolveFailed(true)
    } finally {
      setResolving(false)
    }
  }

  function closeDialog(): void {
    setPendingRow(null)
    tx.reset()
    ctx?.refresh()
  }

  return (
    <div className="claim-center">
      {!sampleMode && !center.connected ? (
        <div className="claim-center__gate">
          <p>{copy.claimConnect}</p>
          <Button variant="outline" onClick={center.connectAction}>
            {common.connect}
          </Button>
        </div>
      ) : wrongChain ? (
        <div className="claim-center__gate">
          <SwitchChainCta
            locale={locale}
            execChain={switchChainId}
            chainName={switchChainName}
            onSwitch={center.switchChainAction}
            variant="outline"
          />
        </div>
      ) : failed ? (
        <p className="claim-center__empty">{copy.claimFailed}</p>
      ) : reading ? (
        <p className="claim-center__empty">{copy.claimReading}</p>
      ) : rows.length === 0 ? (
        <p className="claim-center__empty">{copy.claimEmpty}</p>
      ) : (
        <ul className="claim-cards">
          {rows.map((row) => (
            <li key={row.kind} className="claim-card" data-kind={row.kind}>
              <header className="claim-card__head">
                <strong className="claim-card__title">{copy[rowTitleKey(row.kind)]}</strong>
                <Tooltip>
                  <TooltipTrigger className="create-info" aria-label={copy[rowNoteKey(row.kind)]}>
                    <Info aria-hidden="true" />
                  </TooltipTrigger>
                  <TooltipContent>{copy[rowNoteKey(row.kind)]}</TooltipContent>
                </Tooltip>
              </header>
              {/* Readout = the POL twin-well ledger anatomy: micro label once, hero number,
                  equal-basis extra legs stacked below (never one crammed line) */}
              <div className="claim-card__readout">
                <span className="pol-label">{copy.claimableLabel}</span>
                <p className="claim-card__amount" data-numeric>
                  {formatAmount(row.main.amount, locale)} <span className="claim-card__unit">{row.main.symbol}</span>
                </p>
                {row.extra.map((leg) => (
                  <p key={leg.symbol} className="claim-card__leg" data-numeric>
                    + {formatAmount(leg.amount, locale)} {leg.symbol}
                  </p>
                ))}
              </div>
              {row.kind === 'preorder' ? (
                <div className="claim-card__vest">
                  {row.progress != null ? (
                    <div className="claim-card__meter-row">
                      <span
                        className="claim-card__meter"
                        role="progressbar"
                        aria-label={copy.claimPreorderNote}
                        aria-valuenow={Math.round(row.progress * 100)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <span
                          className="claim-card__meter-fill"
                          style={{ inlineSize: `${Math.min(100, Math.round(row.progress * 100))}%` }}
                        />
                      </span>
                      <span className="claim-card__meter-pct" data-numeric>
                        {Math.round(row.progress * 100)}%
                      </span>
                    </div>
                  ) : null}
                  {row.claimed != null ? (
                    <p className="claim-card__sub">
                      {copy.claimedLabel}{' '}
                      <span data-numeric>
                        {formatAmount(row.claimed, locale)} {entitlements?.memecoinSymbol ?? ''}
                      </span>
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div className="claim-card__actions">
                <Button
                  variant="outline"
                  size="sm"
                  className="claim-card__cta"
                  disabled={sampleMode || !row.claimable || tx.running}
                  onClick={() => setPendingRow(row)}
                >
                  {copy.claimCta}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {resolveFailed ? <FieldError>{common.degrade.errorBody}</FieldError> : null}
      <Dialog open={pendingRow != null || tx.active} onOpenChange={(open) => !open && closeDialog()}>
        {pendingRow != null ? (
          <ActionDialogShell title={copy.claimDialogTitle} closeLabel={common.close}>
            <div className="claim-confirm">
              <p className="claim-confirm__title">{copy[rowTitleKey(pendingRow.kind)]}</p>
              <dl className="claim-confirm__legs" data-numeric>
                {[pendingRow.main, ...pendingRow.extra].map((leg) => (
                  <div key={leg.symbol}>
                    <dt>{copy.claimableLabel}</dt>
                    <dd>
                      {formatAmount(leg.amount, locale)} {leg.symbol}
                    </dd>
                  </div>
                ))}
              </dl>
              <Button
                className="ax-ghost-cta"
                size="lg"
                disabled={resolving || tx.running}
                onClick={() => void startClaim(pendingRow)}
              >
                {copy.claimCta}
              </Button>
            </div>
          </ActionDialogShell>
        ) : null}
      </Dialog>
      {/* Feedback pair (2026-10-26 弹窗序列纪律): progress = its own button-less dialog
          stacked on the confirm dialog (always second-to-last); confirmed yields to the
          generic receipt dialog, the last one. */}
      <TxProgressDialog
        locale={locale}
        title={copy.claimDialogTitle}
        state={tx.display}
        open={tx.active && !successOpen}
        onDismiss={tx.reset}
      />
      <TxSuccessDialog
        locale={locale}
        title={copy.claimDoneTitle}
        lead={copy.claimDoneLead}
        accent={copy.claimDoneAccent}
        rows={claimRows}
        txHash={receipt?.hash}
        txChainId={receipt?.chainId}
        open={successOpen}
        onOpenChange={(next) => {
          setSuccessOpen(next)
          if (!next) closeDialog()
        }}
      />
    </div>
  )
}

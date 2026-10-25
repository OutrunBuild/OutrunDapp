'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, ExternalLink, Info, RotateCcw, WalletCards } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Locale, Asset, YieldSource } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { localePath, parseVerseIdParam } from '../global/routes'
import { SwitchChainCta } from '../global/switch-chain-cta'
import { formatAmount, formatPercent, ProgressMeter, SourceRef } from '../global/signal-ui'
import { AMOUNT_MAX_CHARS, amountToInputString, sanitizeAmount } from '../global/amount-input'
import { TxStatus } from '../global/tx-status'
import { ChevronLeft } from 'lucide-react'
import { GasEditor, GasSummaryRow } from '../global/gas-setting'
import { useGasQuote } from '../global/use-gas-quote'
import { useAccountCenter } from '../global/use-account-center'
import { useTxCenter, type WriteSpec } from '../global/use-tx-center'
import { ActionDialogShell } from '../global/action-dialogs'
import { formatHex } from '../global/signal-ui'
import {
  deriveVersePreorderUsed,
  readAllowances,
  readErc20Meta,
  type ContractReader,
} from '../global/execution-reads'
import { useVerseLive } from './genesis-live'
import {
  getTokenDecimals,
  getVerseSession,
  prefetchVerseSession,
  probeVerseChain,
  VerseChainError,
  type VerseWriteContext,
} from '../global/write-session'
import {
  executionChainId,
  getClientChainConfig,
  verseExecutionChains,
  verseSwitchChainId,
} from '@/lib/web3/chains'
import { formatBaseUnits, formatWadPercent, toBaseUnits } from '@/lib/web3/base-units'
import {
  leverageDebtBase,
  preorderCapBase,
  psmMintQuote,
  stakeMintBase,
} from '@/lib/web3/contract-formulas'
import { erc20ReadAbi } from '@/lib/web3/abis'
import { getActiveEip1193Provider, useActiveEip1193Provider } from '@/lib/web3/active-provider'
import {
  approvalCall,
  buildSessionWrite,
  fundCreditInput,
  fundPsmInput,
  fundStakeInput,
  fundUAssetInput,
  genesisAndPreorderCall,
  genesisByPsmCall,
  genesisByTokenCall,
  genesisCall,
  leveragedGenesisAndPreorderCall,
  leveragedGenesisByPsmCall,
  leveragedGenesisCall,
  leveragedGenesisWithCreditCall,
  preorderByPsmCall,
  preorderCall,
  type BatchExecution,
} from '@/lib/web3/session-actions'
import { useParams, useRouter } from 'next/navigation'
import { createPublicClient, custom, formatUnits, type Hex } from 'viem'

// Preorder is an independent path at the same level as standard/leverage genesis; standard/leverage modes offer one-click preorder
type ParticipationMode = 'standard' | 'leverage' | 'preorder'
// credit=leverage interest paid directly as genesis credits (leverage mode only; one of the two interest payment methods, burned at lock time)
// direct=direct participation: raise uAsset direct payment and reserve-asset par direct swap merged into one path (distinguished by the payment asset dropdown)
type ParticipationRoute = 'direct' | 'stake' | 'credit'

// Preorder capacity formula coefficient (capacity=(standard funds+leverage debt principal)×70%×capacity ratio; one-off ratio, not annualized)
const PREORDER_CAP_RATE = 0.7

/** Help copy template fill: {asset}=selected payment asset, {raise}=this Verse's raise uAsset symbol,
 *  {fee}=PSM mint-side fee rate on the face-value path */
function fill(template: string, values: { asset: string; raise?: string; fee?: string }) {
  return template
    .replace(/\{asset\}/g, values.asset)
    .replace(/\{raise\}/g, values.raise ?? '')
    .replace(/\{fee\}/g, values.fee ?? '')
}

export function ParticipationPanel({
  locale,
  raiseAsset,
  reserves,
  yieldSourceRegistry,
  creditAsset,
  normalRaised,
  preorderRaised,
  preorderCapacityRatio,
  leverageInterestRate,
  leverageDebtCap,
  leverageInterestRateWad,
  preorderCapRatioBps,
  preorderRemainingBase,
  leverageInterestRaised,
  walletBalances,
  sourceRef,
  governanceChain,
  governanceChainName,
  deployedChainIds,
}: {
  locale: Locale
  raiseAsset: Asset | null
  reserves: Asset[]
  yieldSourceRegistry: YieldSource[]
  creditAsset: Asset | null
  normalRaised: number
  preorderRaised: number
  preorderCapacityRatio: number | null
  leverageInterestRate: number | null
  leverageDebtCap: number | null
  /** Exact 18-dec wad of the one-off leverage rate (chain raw); null = unread */
  leverageInterestRateWad: string | null
  /** Exact preorder capacity ratio in bps (chain raw); null = unread */
  preorderCapRatioBps: number | null
  /** Chain `previewPreorderCapacity` remaining, uAsset 18-dec base units; null = unread */
  preorderRemainingBase: string | null
  leverageInterestRaised: number
  /** Sample wallet balances (symbol→cross-chain total, balances fixture; symbols missing from the snapshot are absent from the table → slot state) */
  walletBalances: Record<string, number>
  sourceRef: string
  /** Verse's governance chain (execution chain; vault-actions' MAINNET_TO_TESTNET convention) */
  governanceChain: number
  governanceChainName: string
  /** Chains whose subgraph actually holds this verse (landed set); null = source carries no
   *  per-chain presence data (fixture snapshot), so only the governance chain can execute */
  deployedChainIds: number[] | null
}) {
  const copy = getCopy(locale)
  const [mode, setMode] = useState<ParticipationMode>('standard')
  const [route, setRoute] = useState<ParticipationRoute>('direct')
  const [asset, setAsset] = useState('')
  // One-click preorder payment asset is independent of the main payment asset selection (preorder amount also split into Pay with + amount side by side)
  const [preorderAsset, setPreorderAsset] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [amount, setAmount] = useState('')
  const [preorderEnabled, setPreorderEnabled] = useState(false)
  const [preorderAmount, setPreorderAmount] = useState('')
  const [reviewing, setReviewing] = useState(false)
  // Live wallet chain mismatch (provider truth at click time): the cached wagmi/Privy chainId
  // can go stale after an in-wallet network switch — nobody subscribes chainChanged app-side.
  const [liveWrongChain, setLiveWrongChain] = useState(false)
  // Real pipeline (replaces the retired timer simulation): review dialog → wallet popup.
  // Every wired funding combination executes (see the wiredKind matrix below); a route whose
  // pay assets resolve no on-chain target (e.g. a stake source without an SP binding) stays
  // unwired and shows the review note instead of a submit action.
  const center = useAccountCenter()
  const { connected, connectAction, switchChainAction: switchChain } = center
  const tx = useTxCenter()
  const live = useVerseLive()
  const params = useParams()
  const router = useRouter()
  const rawVerseId = params?.verseId
  const verseId = parseVerseIdParam(rawVerseId)
  const [resolving, setResolving] = useState(false)
  const [resolveFailed, setResolveFailed] = useState(false)
  // Preparation generation: the dialog opens before the reads return, so a closed/re-submitted
  // window must never be handed the previous window's spec (stale amounts would be signed).
  const prepareSeq = useRef(0)
  // Prepared write shown by the review dialog; Confirm releases it to the wallet pipeline
  // (gas settings from the dialog are merged in at that moment).
  const [pendingSpec, setPendingSpec] = useState<WriteSpec | null>(null)
  const [gasOverride, setGasOverride] = useState<{
    gasLimit: bigint
    maxFeePerGas: bigint
    maxPriorityFeePerGas: bigint
  } | null>(null)
  // The gas editor replaces the dialog body (no stacked overlay); `gasLeaving` drives the
  // fade-out half of the swap so the two views never cross-fade into a mush.
  const [gasEditing, setGasEditing] = useState(false)
  const [gasLeaving, setGasLeaving] = useState(false)
  const gasTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const gasBackRef = useRef<HTMLButtonElement | null>(null)
  const gasRowRef = useRef<HTMLButtonElement | null>(null)
  const gasEditPrev = useRef(false)
  const gasQuote = useGasQuote({
    locale,
    chainId: pendingSpec?.review.chainId ?? null,
    eoa: (pendingSpec?.review.account as Hex | undefined) ?? null,
    kernel: (pendingSpec?.kernel as Hex | undefined) ?? null,
    data: pendingSpec?.batchCallData ?? null,
    active: pendingSpec != null && tx.display === 'idle',
    resetToken: pendingSpec,
    onResolved: setGasOverride,
  })

  // Open only once everything the dialog paints is in hand: the prepared write and, for the
  // embedded wallet, its fee quote. Opening earlier pops the Network Fee row into an already
  // rendered card, which reads as a layout jitter — the body must paint once, complete.
  useEffect(() => {
    if (reviewing || pendingSpec == null) return
    const open = () => {
      setResolving(false)
      setReviewing(true)
    }
    if (gasQuote.settled) {
      open()
      return
    }
    // A quote that never settles must not strand the click: the wallet prices itself when the
    // dApp passes no fee, so the row is optional and the review still opens.
    const id = setTimeout(open, 4000)
    return () => clearTimeout(id)
  }, [gasQuote.settled, pendingSpec, reviewing])

  // A confirmed participation is the only writer to this panel's aggregate numbers: re-read
  // them through the wallet provider (the same RPC that confirmed the receipt) as soon as the
  // receipt lands. The close-time router.refresh() alone replays the pre-tx numbers off the
  // server's 30s/60s SWR caches, so the probe — not the refresh — is what makes the numbers
  // move immediately. afterWrite (not the baseline probe) also bumps writeNonce for the
  // account-scoped readers.
  const { afterWrite } = live
  useEffect(() => {
    if (tx.display === 'confirmed') afterWrite()
  }, [tx.display, afterWrite])

  // Fade-out, swap, fade-in. Reduced motion is handled in CSS (transition off).
  useEffect(() => {
    return () => {
      if (gasTimer.current) clearTimeout(gasTimer.current)
    }
  }, [])

  // Hand focus to the back control / summary row after the swap so the dialog card
  // itself never holds the focus ring.
  useEffect(() => {
    if (gasEditing === gasEditPrev.current) return
    gasEditPrev.current = gasEditing
    const target = gasEditing ? gasBackRef.current : gasRowRef.current
    target?.focus({ preventScroll: true })
  }, [gasEditing])

  // Leaving the gas view never strands an invalid custom price: fall back to the average
  // preset so Confirm cannot sit disabled with the error hidden behind the other view.
  function leaveGasView(): void {
    if (gasQuote.invalid) gasQuote.select('market')
    switchGasView(false)
  }

  function switchGasView(next: boolean): void {
    if (next === gasEditing || gasLeaving) return
    setGasLeaving(true)
    gasTimer.current = setTimeout(() => {
      gasTimer.current = null
      setGasEditing(next)
      setGasLeaving(false)
    }, 110)
  }
  const [invalid, setInvalid] = useState(false)

  // Pay-asset balances read client-side through the wallet provider: personal values never ride
  // SSR — same pattern as the faucet PSM dialog; the SSR sample table below stays the
  // fixture/e2e source so recorded baselines keep their balances.
  const activeProvider = useActiveEip1193Provider()
  const [liveBalances, setLiveBalances] = useState<
    Record<string, { base: bigint; decimals: number }>
  >({})
  // Bumped when a confirmed participation closes — re-reads this panel's own live balances
  // (refresh scope = what this action changed, never a page-wide table clear)
  const [balanceNonce, setBalanceNonce] = useState(0)
  const liveReadEligible =
    center.source === 'real' && connected && center.chainId != null && center.address != null
  const numericAmount = Number(amount || 0)
  const numericPreorder = Number(preorderAmount || 0)
  const preorderOnly = mode === 'preorder'
  // Route set varies by mode: leverage has no stake option, standard has no genesis-credit option — leftover selections across modes fall back to direct participation
  const effectiveRoute: ParticipationRoute =
    route === 'stake' && mode === 'leverage'
      ? 'direct'
      : route === 'credit' && mode !== 'leverage'
        ? 'direct'
        : preorderOnly
          ? 'direct'
          : route
  const raiseAssetSymbol = raiseAsset?.symbol ?? ''
  // Stake source → participating asset, two levels: the asset group is fixed only after a source is selected
  const activeSource =
    yieldSourceRegistry.find((source) => source.id === sourceId) ?? yieldSourceRegistry[0] ?? null
  // Direct participation=raise uAsset direct payment (preferred) + PSM-paired reserve asset par direct swap; stake=selected source's asset group; credit=leverage interest paid directly as genesis credits;
  // preorder payment asset group matches direct participation (preorder also gets the Pay with dropdown — uAsset direct payment or reserve par direct swap; preorder amount still denominated in the raise uAsset)
  const preorderAssets = raiseAsset ? [raiseAsset, ...reserves] : reserves
  const routeAssets = preorderOnly
    ? preorderAssets
    : effectiveRoute === 'direct'
      ? raiseAsset
        ? [raiseAsset, ...reserves]
        : reserves
      : effectiveRoute === 'stake'
        ? (activeSource?.assets ?? [])
        : creditAsset
          ? [creditAsset]
          : []
  const payAssetRecord = routeAssets.find((item) => item.symbol === asset) ?? routeAssets[0] ?? null
  const payAsset = payAssetRecord?.symbol ?? ''
  // Pay-asset balance table key (symbol=address pairs): every wired pay option — raise uAsset,
  // reserves, credit, plus the active stake source's assets while the stake route is open (the
  // uAsset pseudo-id resolves against the deployment table at read time)
  const payOptionKey = [
    raiseAsset,
    ...reserves,
    creditAsset,
    ...(effectiveRoute === 'stake' ? (activeSource?.assets ?? []) : []),
  ]
    .filter((asset): asset is Asset => asset != null)
    .map((asset) => `${asset.symbol}=${asset.id}`)
    .join('|')
  useEffect(() => {
    if (!liveReadEligible) return
    const provider = activeProvider ?? getActiveEip1193Provider()
    const chainId = center.chainId
    const eoa = center.address as Hex | null
    if (!provider || chainId == null || eoa == null) return
    const resolved = getClientChainConfig(chainId)
    if (resolved.status !== 'ok' || resolved.config.contracts.status !== 'deployed') return
    // symbol→address: option ids are contract addresses except the uAsset pseudo-id
    const targets = new Map<string, string>()
    for (const entry of payOptionKey ? payOptionKey.split('|') : []) {
      const sep = entry.indexOf('=')
      if (sep <= 0) continue
      const symbol = entry.slice(0, sep)
      const id = entry.slice(sep + 1)
      const addr = id.startsWith('uasset:')
        ? resolved.config.contracts.addresses[`UAsset.${symbol}`]
        : id
      if (addr) targets.set(symbol, addr)
    }
    if (targets.size === 0) return
    let cancelled = false
    const client = createPublicClient({
      chain: resolved.config.viemChain,
      transport: custom({ request: provider.request }),
    })
    const reader: ContractReader = { read: (params) => client.readContract(params) as Promise<unknown> }
    void (async () => {
      // One parallel read per payable token (decimals come from the chain+token cache): a
      // per-token serial loop turns N tokens into N wallet round trips on every selection.
      const rows = await Promise.all(
        [...targets].map(async ([symbol, addr]) => {
          try {
            const [raw, decimals] = await Promise.all([
              client.readContract({
                address: addr as Hex,
                abi: erc20ReadAbi,
                functionName: 'balanceOf',
                args: [eoa],
              }),
              readErc20Meta(reader, addr as Hex).then((meta) => meta.decimals),
            ])
            return [symbol, { base: BigInt(String(raw)), decimals }] as const
          } catch {
            // per-token failure → symbol absent → slot renders '--'
            return null
          }
        }),
      )
      if (cancelled) return
      const next: Record<string, { base: bigint; decimals: number }> = {}
      for (const row of rows) if (row) next[row[0]] = row[1]
      setLiveBalances(next)
    })()
    return () => {
      cancelled = true
    }
  }, [liveReadEligible, center.chainId, center.address, activeProvider, payOptionKey, balanceNonce])
  const amountInvalid = invalid && numericAmount <= 0
  const preorderInvalid = invalid && !preorderOnly && preorderEnabled && numericPreorder <= 0
  // The PSM mints at par minus the on-chain mint fee (tin): a reserve payment lands as
  // amount × (1 − tin) uAsset. The rate rides the reserve option (chain read on the onchain
  // build, PSM pair sample in fixture mode); an unread rate falls back to par and renders no
  // fee row (null 不渲染) instead of inventing one.
  const payIsUAssetSymbol = payAsset === '' || payAsset === raiseAssetSymbol
  const reserveFee =
    effectiveRoute === 'direct' && !payIsUAssetSymbol ? (payAssetRecord?.psmFeeIn ?? null) : null
  // uAsset the payment actually buys: par for uAsset, par minus tin for a reserve
  const netUAsset = (amount: number) =>
    reserveFee != null ? amount * (1 - reserveFee) : amount
  // ---- Wallet-chain aggregates: SSR baseline row + same-source probe override -----------------
  // Genesis settles per chain, so every aggregate display/gate follows the wallet's chain (see
  // genesis-live): baseline = the server's per-chain row for the view chain (canonical props
  // stand when the source carries no rows), override = the wallet-provider probe reading — the
  // same RPC that confirmed the receipt, so post-write numbers move immediately.
  const liveAggregates = live.aggregates
  const normalRaisedB = live.chainRow?.normalRaised ?? normalRaised
  const interestRaisedB = live.chainRow?.leverageInterest ?? leverageInterestRaised
  const preorderRaisedB = live.chainRow?.preorderRaised ?? preorderRaised
  const asBaseFloat = (base: bigint) => Number(base) / 1e18
  const liveUsedBase =
    liveAggregates != null
      ? deriveVersePreorderUsed(
          liveAggregates,
          preorderCapRatioBps != null ? BigInt(preorderCapRatioBps) : null,
        )
      : null
  const preorderRaisedE = liveUsedBase != null ? asBaseFloat(liveUsedBase) : preorderRaisedB

  // Leverage: one-off interest rate (locked at registration, not annualized); borrowed funds=interest÷rate (UI term; mechanism basis is the POLend debt quota); headroom=debt cap−debt built
  const leverageRate = leverageInterestRate != null && leverageInterestRate > 0 ? leverageInterestRate : null
  const leverageReady = leverageRate != null && leverageDebtCap != null
  // The probe's debt principal is the chain-computed quota (interest÷rate on-chain); the
  // baseline path keeps the float division over the subgraph interest total.
  const leverageCurrentDebt =
    liveAggregates != null
      ? asBaseFloat(liveAggregates.debtBase)
      : leverageRate != null
        ? interestRaisedB / leverageRate
        : null
  const leverageQuota =
    leverageRate != null && numericAmount > 0 ? netUAsset(numericAmount) / leverageRate : null
  const leverageHeadroom =
    leverageRate != null && leverageDebtCap != null && leverageCurrentDebt != null
      ? Math.max(leverageDebtCap - leverageCurrentDebt, 0)
      : null
  const leverageExceeded = leverageQuota != null && leverageHeadroom != null && leverageQuota > leverageHeadroom
  // Stake path conversion: sy asset converted to uAsset at real-time value (fixture anchorValue sample rate; a missing rate sample does not open a placeholder slot — it falls back to par 1);
  // direct=par minus the PSM mint fee (reserveFee), uAsset=par
  const convertedAmount =
    numericAmount *
    (effectiveRoute === 'stake'
      ? (payAssetRecord?.anchorValue ?? 1)
      : reserveFee != null
        ? 1 - reserveFee
        : 1)
  // One-click preorder cap=genesis funds converted to uAsset (direct=par minus tin, stake=anchorValue rate; leverage=borrowed funds)×70%×capacity ratio; missing capacity ratio=null → slot only
  const genesisFunds = mode === 'leverage' ? (leverageQuota ?? 0) : convertedAmount
  const preorderCap =
    preorderCapacityRatio != null && genesisFunds > 0
      ? genesisFunds * PREORDER_CAP_RATE * preorderCapacityRatio
      : null
  const modeLabel =
    mode === 'standard' ? copy.verse.standardMode : mode === 'leverage' ? copy.verse.leverageMode : copy.verse.preorderMode
  // Review screen row model (grouped): pay group=perspective of the token actually paid (interest/principal/preorder), the into-genesis rows (what actually enters genesis)=uAsset after conversion or borrowing;
  // total only when pay rows share one asset (leverage interest and preorder are both uAsset → added directly; stake asset + preorder in different assets are not forced together)
  const preorderRowAmount = preorderOnly ? numericAmount : numericPreorder
  // Preorder payment asset independently selectable (par minus the PSM mint fee on the reserve
  // leg, value equals the denominated amount): the preorder tab uses the main selection, one-click preorder uses the preorder asset selection, both fall back to the raise uAsset
  const effectivePreorderRecord =
    preorderAssets.find((item) => item.symbol === preorderAsset) ?? preorderAssets[0] ?? null
  const effectivePreorderAsset = effectivePreorderRecord?.symbol ?? ''
  const preorderRowAsset = preorderOnly ? payAsset : effectivePreorderAsset
  const preorderFee =
    !preorderOnly &&
    preorderEnabled &&
    effectivePreorderAsset !== '' &&
    effectivePreorderAsset !== raiseAssetSymbol
      ? (effectivePreorderRecord?.psmFeeIn ?? null)
      : preorderOnly
        ? reserveFee
        : null
  const netPreorderAmount =
    preorderFee != null ? preorderRowAmount * (1 - preorderFee) : preorderRowAmount
  const preorderPayRow =
    preorderEnabled || preorderOnly
      ? { label: copy.verse.preorderAmountLabel, amount: preorderRowAmount, asset: preorderRowAsset }
      : null
  const mainPayRow = preorderOnly
    ? null
    : {
        label: mode === 'leverage' ? copy.verse.leverageInterestLabel : copy.verse.genesisPayLabel,
        amount: numericAmount,
        asset: payAsset,
      }
  const payRows = [mainPayRow, preorderPayRow].filter(
    (row): row is { label: string; amount: number; asset: string } => row != null,
  )
  const sameAssetPay = payRows.length > 1 && payRows.every((row) => row.asset === payRows[0].asset)
  const totalPaid = sameAssetPay ? payRows.reduce((sum, row) => sum + row.amount, 0) : null
  // You-pay figure: when the legs share one asset the TOTAL outflow is the group's ONLY
  // line — no sub-items under it (pay amount = total, no children);
  // preorder has its peer figure in the enter-genesis group and is not repeated.
  // Multi-asset legs (reserve/credit interest + uAsset preorder) cannot sum → each leg
  // renders its own row so both paid tokens show.
  const payHeroLabel = preorderOnly ? copy.verse.preorderAmountLabel : copy.verse.payAmount
  const payHeroAmount = totalPaid ?? mainPayRow?.amount ?? preorderRowAmount
  // Multi-asset legs take leg labels (interest / preorder): the preorder figure already has
  // its peer row in the enter-genesis group, so repeating 「预购金额」 with the same number
  // here would read as a duplicate; the leg label states what the payment is for instead.
  const payReviewRows =
    payRows.length > 1 && !sameAssetPay
      ? payRows.map((row, index) => ({
          ...row,
          label:
            index === 0
              ? mode === 'leverage'
                ? copy.verse.reviewPayInterest
                : copy.verse.genesisPayLabel
              : copy.verse.reviewPayPreorder,
        }))
      : [{ label: payHeroLabel, amount: payHeroAmount ?? 0, asset: payRows[0].asset }]
  // Preorder funds buy in only after the main pool opens — mechanically not genesis capital,
  // but the review card shows the preorder amount as a PEER figure of the genesis amount
  // preorder-only still has no into-genesis group
  const genesisRow = preorderOnly
    ? null
    : mode === 'leverage'
      ? { label: copy.verse.leverageDebtQuota, amount: leverageQuota ?? 0 }
      : { label: copy.verse.genesisAmount, amount: convertedAmount }

  function resetReview() {
    // Bumping the generation also strands the in-flight preparation (its `finally` no longer
    // owns the flag), so the close must clear it here — otherwise `resolving` sticks and the
    // form CTA stays disabled until a reload.
    prepareSeq.current += 1
    setResolving(false)
    setReviewing(false)
    // Closing a confirmed panel = the verse aggregates changed: refresh the server tree
    // (raised/progress/participants) and re-read this panel's live balances — the page must
    // not wait for a manual reload.
    if (tx.display === 'confirmed') {
      router.refresh()
      setBalanceNonce((nonce) => nonce + 1)
      // A landed participation empties the form's amount fields (route/asset selections
      // stay); a dismissed or failed flow keeps them for retry/revise.
      setAmount('')
      setPreorderAmount('')
    }
    tx.reset()
    setInvalid(false)
    setPendingSpec(null)
    setGasOverride(null)
    setGasEditing(false)
    setGasLeaving(false)
    if (gasTimer.current) {
      clearTimeout(gasTimer.current)
      gasTimer.current = null
    }
  }

  // Participation is per chain: every chain whose subgraph actually holds this verse runs
  // genesis locally, so the gate is the landed set — not the governance chain. A wallet outside
  // it switches; the target is the governance chain when it landed, otherwise the first landed
  // chain (the registration request is not proof, so omnichainIds[0] cannot decide this).
  const execChains = useMemo(
    () => verseExecutionChains(governanceChain, deployedChainIds),
    [governanceChain, deployedChainIds],
  )
  const governanceExecChain = executionChainId(governanceChain)
  const switchChainId = verseSwitchChainId(governanceChain, deployedChainIds)
  const chainLabelOf = (id: number) => {
    if (id === governanceExecChain) return governanceChainName
    const config = getClientChainConfig(id)
    return config.status === 'ok' ? config.config.viemChain.name : String(id)
  }
  const switchChainName = chainLabelOf(switchChainId)
  // A prepared write belongs to the chain it was read on: a wallet that moves during review
  // would otherwise sign it on another chain. The cached chainId is exactly what goes stale
  // after an in-wallet switch, so ask the provider and reset only on a real move.
  const preparedChainId = pendingSpec?.expectedChainId ?? null
  useEffect(() => {
    if (!reviewing || tx.display !== 'idle' || preparedChainId == null) return
    // The cache agreeing with the spec is the normal case (the review was just prepared on
    // the probed chain): nothing new to verify, so no extra round trip. A disagreement means
    // either the cache went stale or the wallet moved — only the provider can tell them apart.
    if (center.chainId === preparedChainId) return
    const provider = getActiveEip1193Provider()
    if (!provider) return
    let cancelled = false
    void probeVerseChain(provider, execChains)
      .then((live) => {
        if (!cancelled && live !== preparedChainId) resetReview()
      })
      .catch(() => {
        // No longer on an executable chain — the same reset applies, the CTA takes over.
        if (!cancelled) resetReview()
      })
    return () => {
      cancelled = true
    }
  }, [center.chainId, execChains, preparedChainId, reviewing, tx.display])

  // Wired execution matrix (funding truth = IOutrunRouter matrix): uAsset-direct legs hit the
  // launcher (single genesis/preorder) or the router (combined); reserve legs mint through the
  // registered PSM (genesisByPSM / leveragedGenesisByPSM / preorderByPSM, router pulls the
  // reserve); stake legs go through the SP (genesisByToken, router pulls the SP's depositable
  // token); credit escrow stays on POLend. Combined preorder legs carry their own FundInput —
  // uAsset-direct or PSM reserve mint (fundPsmInput), per the router's per-leg source matrix;
  // preorder-only + reserve pay rides preorderByPSM in one transaction. NATIVE legs resolve no
  // pull token and stay disabled.
  const payIsUAsset = payAsset !== '' && payAsset === raiseAssetSymbol
  const payIsReserve = effectiveRoute === 'direct' && payAsset !== '' && !payIsUAsset
  const stakeReady = effectiveRoute === 'stake' && payAssetRecord?.sp != null
  const preorderPayIsUAsset = preorderRowAsset !== '' && preorderRowAsset === raiseAssetSymbol
  // PSM-paid preorder leg: the preorder asset group is [raise uAsset, ...reserves], so a
  // non-empty symbol differing from the raise asset is a reserve by construction.
  const preorderPayIsPsm = preorderRowAsset !== '' && preorderRowAsset !== raiseAssetSymbol
  const preorderPayWired = preorderPayIsUAsset || preorderPayIsPsm
  type WiredKind = 'genesis' | 'genesis-preorder' | 'preorder-only' | 'leverage' | 'leverage-preorder'
  const wiredKind: WiredKind | null =
    mode === 'leverage'
      ? !leverageReady
        ? null
        : preorderEnabled
          ? // Leveraged combined entry rides the router's leveragedGenesisAndPreorder: the
            // interest leg funds per route (credit escrow / uAsset-direct / reserve PSM mint)
            // and the preorder leg carries its own FundInput (uAsset-direct or PSM mint)
            (effectiveRoute === 'credit' ||
              (effectiveRoute === 'direct' && (payIsUAsset || payIsReserve))) &&
              preorderPayWired
            ? 'leverage-preorder'
            : null
          : // Wired leverage interest routes mirror the on-chain entries: credit escrow and
            // uAsset-direct on POLend, reserve pay on the router's leveragedGenesisByPSM
            effectiveRoute === 'credit' ||
              (effectiveRoute === 'direct' && (payIsUAsset || payIsReserve))
            ? 'leverage'
            : null
      : preorderOnly
        ? payIsUAsset || payIsReserve
          ? 'preorder-only'
          : null
        : effectiveRoute === 'stake'
          ? stakeReady
            ? preorderEnabled
              ? preorderPayWired
                ? 'genesis-preorder'
                : null
              : 'genesis'
            : null
          : effectiveRoute === 'direct'
            ? preorderEnabled
              ? preorderPayWired
                ? 'genesis-preorder'
                : null
              : 'genesis'
            : null
  const chainInVerse = center.chainId != null && execChains.includes(center.chainId)
  const wrongChain =
    center.source === 'real' && connected && (center.chainId == null || !chainInVerse)
  // Only a wallet outside the landed set switches: a wallet on any landed chain participates
  // there (genesis settles per chain), so the switch CTA never fires for a sibling chain.
  const executionReady =
    center.source === 'real' &&
    connected &&
    center.chainSupported &&
    center.address != null &&
    verseId != null &&
    wiredKind !== null

  // Click-path budget: the write's static half (verse registry + uAsset decimals) is warmed on
  // the first interaction with the panel, so the review dialog's Confirm enables on the
  // allowance read alone. Triggered by use rather than by mount: a visitor who only reads the
  // page costs no read, and the dialog itself never waits for this (it opens on the live chain
  // check). Keyed by chain+account, so a wallet switch re-warms for the chain it lands on.
  const warmed = useRef<string | null>(null)
  function warmSession(): void {
    const provider = activeProvider ?? getActiveEip1193Provider()
    const eoa = center.address as Hex | null
    if (!provider || eoa == null || verseId == null) return
    // Only landed chains: a launcher without this verse reverts InvalidVerseId.
    if (!chainInVerse) return
    const key = `${execChains.join(',')}:${eoa.toLowerCase()}`
    if (warmed.current === key) return
    warmed.current = key
    prefetchVerseSession({ provider, chains: execChains, eoa, verseId: BigInt(verseId) })
  }

  // Preorder tab: Verse-level capacity (on-chain preorderMaxCapacity)=(standard genesis funds+leverage debt principal)×70%×capacity ratio;
  // debt principal=interest received÷rate; used=on-chain preorder total snapshot (fixture preorderRaised); remaining=capacity−used (first come, first served)
  const versePreorderBase =
    liveAggregates != null
      ? asBaseFloat(liveAggregates.normalBase + liveAggregates.debtBase)
      : leverageRate != null
        ? normalRaisedB + interestRaisedB / leverageRate
        : null
  const versePreorderCap =
    preorderCapacityRatio != null && versePreorderBase != null
      ? versePreorderBase * PREORDER_CAP_RATE * preorderCapacityRatio
      : null
  // With a probe the remaining is the chain's own preview — exact, no float reconstruction.
  const versePreorderRemaining =
    liveAggregates != null
      ? asBaseFloat(liveAggregates.remainingPreorderBase)
      : versePreorderCap != null
        ? Math.max(versePreorderCap - preorderRaisedB, 0)
        : null
  const versePreorderPercent =
    versePreorderCap != null && versePreorderCap > 0
      ? (preorderRaisedE / versePreorderCap) * 100
      : 0
  // ---- Exact money math (integer, mirrors the contracts) -------------------------------------
  // Everything quoted, gated or executed is computed in base units from the typed string. The
  // float figures below stay only as fallbacks for chain sources that are unread (rate/tin/
  // stake preview) and for non-monetary presentation (progress meters, rate percentages).
  const payDecimals = payAssetRecord?.decimals ?? 18
  const preorderDecimals = effectivePreorderRecord?.decimals ?? 18
  const mainBase = toBaseUnits(amount, payDecimals)
  const preorderInputBase = toBaseUnits(preorderOnly ? amount : preorderAmount, preorderDecimals)
  const mainTinWad = payAssetRecord?.psmFeeInWad ? BigInt(payAssetRecord.psmFeeInWad) : null
  const preorderTinWad =
    effectivePreorderRecord?.psmFeeInWad ? BigInt(effectivePreorderRecord.psmFeeInWad) : null
  // uAsset that actually enters genesis from the main leg: par for uAsset, the exact PSM mint
  // for a reserve, the chain per-unit stake preview for the stake route. null = source unread.
  const mainMintBase: bigint | null =
    effectiveRoute === 'stake'
      ? payAssetRecord?.anchorPreviewBase
        ? stakeMintBase(mainBase, payDecimals, BigInt(payAssetRecord.anchorPreviewBase))
        : null
      : payIsUAsset
        ? mainBase
        : mainTinWad != null
          ? psmMintQuote(mainBase, payDecimals, mainTinWad).amountOut
          : null
  const preorderMintBase: bigint | null = preorderPayIsUAsset
    ? preorderInputBase
    : preorderTinWad != null
      ? psmMintQuote(preorderInputBase, preorderDecimals, preorderTinWad).amountOut
      : null
  const rateWad = leverageInterestRateWad != null ? BigInt(leverageInterestRateWad) : null
  const debtBase =
    rateWad != null && rateWad > 0n && mainMintBase != null && mainMintBase > 0n
      ? leverageDebtBase(mainMintBase, rateWad)
      : null
  const genesisFundsBase = mode === 'leverage' ? debtBase : mainMintBase
  const exactCapBase =
    preorderCapRatioBps != null && genesisFundsBase != null && genesisFundsBase > 0n
      ? preorderCapBase(genesisFundsBase, BigInt(preorderCapRatioBps))
      : null
  // The SSR remaining prop was read on the canonical chain alone — it applies only while the
  // view chain IS the canonical chain; any other chain gets its remaining from the probe
  // (null until it lands → slot state, never another chain's number).
  const exactRemainingBase =
    liveAggregates != null
      ? liveAggregates.remainingPreorderBase
      : live.viewChainId === live.dataChainId && preorderRemainingBase != null
        ? BigInt(preorderRemainingBase)
        : null
  // Exact amount text with a float fallback (unread chain source only).
  const moneyText = (base: bigint | null, decimals: number, fallback: number) =>
    base != null ? formatBaseUnits(base, decimals, locale) : formatAmount(fallback, locale)

  // ---- Exact display strings (truncated, never rounded up) -----------------------------------
  const genesisEnterText =
    mode === 'leverage'
      ? moneyText(debtBase, 18, leverageQuota ?? 0)
      : moneyText(mainMintBase, 18, convertedAmount)
  const preorderEnterText = moneyText(preorderMintBase, 18, netPreorderAmount)
  const mainPayText = formatBaseUnits(mainBase, payDecimals, locale)
  const preorderPayText = formatBaseUnits(preorderInputBase, preorderDecimals, locale)
  const leverageDebtText = moneyText(debtBase, 18, leverageQuota ?? 0)
  const leverageRateText =
    rateWad != null && rateWad > 0n
      ? formatWadPercent(rateWad, locale)
      : leverageRate != null
        ? formatPercent(leverageRate * 100, locale)
        : null
  const capText =
    exactCapBase != null
      ? formatBaseUnits(exactCapBase, 18, locale)
      : preorderCap != null
        ? formatAmount(preorderCap, locale)
        : null
  const remainingText =
    exactRemainingBase != null
      ? formatBaseUnits(exactRemainingBase, 18, locale)
      : versePreorderRemaining != null
        ? formatAmount(versePreorderRemaining, locale)
        : null
  // Conversion-fee sub-line: exact from the tin wad when the chain read landed; float sample
  // fallback only while unread. Zero fee renders nothing.
  const feeLegText = (
    tinWad: bigint | null,
    inputBase: bigint,
    decimals: number,
    floatRate: number | null,
    floatBase: number,
    asset: string,
  ): { percentText: string; feeText: string; asset: string } | null => {
    if (inputBase <= 0n) return null
    if (tinWad != null) {
      const { feeIn } = psmMintQuote(inputBase, decimals, tinWad)
      if (feeIn === 0n) return null
      return {
        percentText: formatWadPercent(tinWad, locale),
        feeText: formatBaseUnits(feeIn, decimals, locale),
        asset,
      }
    }
    if (floatRate == null || floatRate <= 0 || floatBase <= 0) return null
    return {
      percentText: formatPercent(floatRate * 100, locale),
      feeText: formatAmount(floatBase * floatRate, locale),
      asset,
    }
  }

  // Exact comparison in uAsset units when the chain sources are read (the typed reserve is
  // quoted to its minted uAsset first); float fallback only while a source is unread.
  const preorderExceeded =
    exactCapBase != null && preorderMintBase != null
      ? preorderMintBase > exactCapBase
      : preorderCap != null && numericPreorder > preorderCap
  const preorderCapNote =
    preorderCapacityRatio != null
      ? copy.verse.preorderCapNote.replace(
          '{ratio}',
          formatPercent(preorderCapacityRatio * 100, locale),
        )
      : null
  const preorderTabExceeded =
    preorderOnly &&
    (exactRemainingBase != null && mainMintBase != null
      ? mainMintBase > exactRemainingBase
      : versePreorderRemaining != null && numericAmount > versePreorderRemaining)
  // One-click preorder shares the verse-level capacity the preorder tab already gates on: the
  // per-user cap (preorderCap) can pass while the verse's remaining capacity cannot (the chain
  // reverts InvalidLength), so the submit gate must honour both. Unknown remaining → no gate
  // (null renders nothing), matching the tab's snapshot-missing discipline.
  const oneClickRemainingExceeded =
    !preorderOnly &&
    preorderEnabled &&
    (exactRemainingBase != null && preorderMintBase != null
      ? preorderMintBase > exactRemainingBase
      : versePreorderRemaining != null && numericPreorder > versePreorderRemaining)

  // Payment asset wallet balance. The connected build reads exact base units (bigint) — the
  // balance gate and Max fill use those integers directly; fixture samples stay float and are
  // display-only (never a gate on the real build).
  const exactBalanceOf = (symbol: string) =>
    center.source === 'real' ? (liveBalances[symbol] ?? null) : null
  const sampleBalanceOf = (symbol: string) =>
    center.source === 'real' ? null : (walletBalances[symbol] ?? null)
  const balanceTextOf = (symbol: string): string | null => {
    const exact = exactBalanceOf(symbol)
    if (exact != null) return formatBaseUnits(exact.base, exact.decimals, locale)
    const sample = sampleBalanceOf(symbol)
    return sample != null ? formatAmount(sample, locale) : null
  }
  // Exact balance as an input-fill string: full precision, trailing fraction zeros trimmed
  // (the input cap is 40 chars; "1000" must stay "1000", never "1").
  const trimFractionZeros = (value: string): string =>
    value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value
  const balanceFillOf = (symbol: string): string => {
    const exact = exactBalanceOf(symbol)
    if (exact != null) return trimFractionZeros(formatUnits(exact.base, exact.decimals))
    const sample = sampleBalanceOf(symbol)
    return sample != null ? amountToInputString(sample) : ''
  }
  const balanceZeroOf = (symbol: string): boolean => {
    const exact = exactBalanceOf(symbol)
    if (exact != null) return exact.base === 0n
    const sample = sampleBalanceOf(symbol)
    return sample == null || sample <= 0
  }
  const walletBalanceText = balanceTextOf(payAsset)
  const preorderWalletBalanceText = balanceTextOf(effectivePreorderAsset)
  const mainBalanceBase = exactBalanceOf(payAsset)?.base ?? null
  const preorderBalanceBase = exactBalanceOf(effectivePreorderAsset)?.base ?? null
  // Insufficient balance: exact integer comparison when the wallet read landed; the fixture
  // sample falls back to the float comparison for demo parity.
  const balanceShort =
    mainBalanceBase != null
      ? mainBase > mainBalanceBase
      : sampleBalanceOf(payAsset) != null &&
        Number.isFinite(numericAmount) &&
        numericAmount > (sampleBalanceOf(payAsset) as number)
  const showBalanceShort =
    balanceShort && !preorderTabExceeded && !(mode === 'leverage' && leverageExceeded)
  const preorderBalanceShort =
    preorderBalanceBase != null
      ? preorderInputBase > preorderBalanceBase
      : sampleBalanceOf(effectivePreorderAsset) != null &&
        Number.isFinite(numericPreorder) &&
        numericPreorder > (sampleBalanceOf(effectivePreorderAsset) as number)


  /** Provider-truth chain check fired before any on-chain read leaves the page: the cached
   *  chainId gate can lie (stale connector state), and a launcher without this verse reverts
   *  InvalidVerseId — ask the wallet live, flip the CTA to the network switch when the live
   *  chain is outside the verse's landed set. */
  /** Re-read the provider's chain after a switch attempt and drive the switch CTA. */
  async function recheckLiveChain(): Promise<void> {
    const provider = getActiveEip1193Provider()
    if (!provider) return
    try {
      await probeVerseChain(provider, execChains)
      setLiveWrongChain(false)
    } catch {
      setLiveWrongChain(true)
    }
  }

  /** Assemble the write (reads + calldata + review data) for the review dialog; the
   *  wallet call itself happens on the dialog's Confirm. */
  async function prepareSpec(session: VerseWriteContext): Promise<WriteSpec | null> {
    if (!executionReady || wiredKind == null) return null
    const eoa = center.address as Hex | null
    if (!eoa) return null
    // Everything execution-shaped comes from the session: its chain is the chain the wallet
    // actually answered on (probed), so the spec can never be assembled against a stale one.
    const chainId = session.chainId
    const resolved = getClientChainConfig(chainId)
    if (resolved.status !== 'ok' || resolved.config.contracts.status !== 'deployed') return null
    const contracts = resolved.config.contracts.addresses
    const launcher = contracts.MemeverseLauncher as Hex
    const polend = contracts.POLend as Hex
    const router = contracts.OutrunRouter as Hex
    const kernel = resolved.config.kernel7702Implementation as Hex
    const hook = contracts.MemeverseUniswapHook as Hex
    try {
      const { reader } = session
      const uAsset = session.verse.uAsset
      const decimals = session.uAssetDecimals
      // Typed decimal string -> uAsset base units, exactly (never via float). Digits beyond
      // the asset precision are truncated, matching what the chain can represent.
      const toBase = (raw: string): bigint => toBaseUnits(raw, decimals)
      // Per-kind amounts (display → base units) and the pull legs behind the approval:
      // same-token legs arrive merged (one approve per token — ERC20 approve replaces, two
      // legs on one token must never emit two approves).
      let action
      let functionName: string
      let inputs: string
      let spender: Hex
      let target: Hex
      let pulls: { token: Hex; amount: bigint; display: string }[]
      if (wiredKind === 'genesis') {
        if (effectiveRoute === 'stake') {
          // Stake route (IOutrunRouter.genesisByToken): the pay asset is the SP's depositable
          // token; the router converts it through the SP's SY and stakes for genesis — the pull
          // token is the pay asset itself, the approval spender the router.
          if (!payAssetRecord?.sp) throw new Error('stake pay asset carries no SP')
          const token = payAssetRecord.id as Hex
          const sp = payAssetRecord.sp as Hex
          const tokenDecimals = await getTokenDecimals(reader, chainId, token)
          const amountBase = toBaseUnits(amount, tokenDecimals)
          action = genesisByTokenCall(router, {
            sp,
            tokenIn: token,
            tokenAmount: amountBase,
            minSyOut: 0n,
            verseId: BigInt(verseId),
            genesisUser: eoa,
            minUAssetMinted: 0n,
          })
          functionName = 'genesisByToken'
          inputs = `${formatUnits(amountBase, tokenDecimals)} ${payAsset}`
          target = router
          spender = router
          pulls = [
            { token, amount: amountBase, display: `${formatUnits(amountBase, tokenDecimals)} ${payAsset}` },
          ]
        } else if (payIsUAsset) {
          const amountBase = toBase(amount)
          action = genesisCall(launcher, { verseId: BigInt(verseId), amountInUAsset: amountBase, user: eoa })
          functionName = 'genesis'
          inputs = `${formatUnits(amountBase, decimals)} ${raiseAssetSymbol}`
          target = launcher
          spender = launcher
          pulls = [
            { token: uAsset, amount: amountBase, display: `${formatUnits(amountBase, decimals)} ${raiseAssetSymbol}` },
          ]
        } else {
          // Reserve pay (IOutrunRouter.genesisByPSM): the router mints uAsset through the
          // registered PSM pair and forwards it — the pull token is the reserve.
          if (!payAssetRecord) throw new Error('reserve pay asset missing')
          const reserve = payAssetRecord.id as Hex
          const reserveDecimals = await getTokenDecimals(reader, chainId, reserve)
          const amountBase = toBaseUnits(amount, reserveDecimals)
          action = genesisByPsmCall(router, {
            uAsset,
            reserveToken: reserve,
            amountIn: amountBase,
            verseId: BigInt(verseId),
            genesisUser: eoa,
          })
          functionName = 'genesisByPSM'
          inputs = `${formatUnits(amountBase, reserveDecimals)} ${payAsset}`
          target = router
          spender = router
          pulls = [
            { token: reserve, amount: amountBase, display: `${formatUnits(amountBase, reserveDecimals)} ${payAsset}` },
          ]
        }
      } else if (wiredKind === 'genesis-preorder') {
        const preorderBase = toBase(preorderAmount)
        const preorderDisplay = `${formatUnits(preorderBase, decimals)} ${raiseAssetSymbol}`
        if (effectiveRoute === 'stake') {
          // Stake genesis leg + preorder leg: two different pull tokens → two approve legs;
          // the combined entry rides the router's genesisAndPreorder. The preorder leg carries
          // its own FundInput — uAsset-direct or PSM mint for a reserve-paid preorder.
          if (!payAssetRecord?.sp) throw new Error('stake pay asset carries no SP')
          const token = payAssetRecord.id as Hex
          const sp = payAssetRecord.sp as Hex
          const tokenDecimals = await getTokenDecimals(reader, chainId, token)
          const genesisBase = toBaseUnits(amount, tokenDecimals)
          const genesisDisplay = `${formatUnits(genesisBase, tokenDecimals)} ${payAsset}`
          if (preorderPayIsUAsset) {
            action = genesisAndPreorderCall(router, {
              verseId: BigInt(verseId),
              genesis: fundStakeInput(sp, token, genesisBase),
              preorder: fundUAssetInput(preorderBase),
              user: eoa,
            })
            functionName = 'genesisAndPreorder'
            inputs = `${genesisDisplay} + ${preorderDisplay}`
            target = router
            spender = router
            pulls = [
              { token, amount: genesisBase, display: genesisDisplay },
              { token: uAsset, amount: preorderBase, display: preorderDisplay },
            ]
          } else {
            if (!effectivePreorderRecord) throw new Error('preorder reserve asset missing')
            const preorderReserve = effectivePreorderRecord.id as Hex
            const preorderReserveDecimals = await getTokenDecimals(reader, chainId, preorderReserve)
            const preorderReserveBase = toBaseUnits(preorderAmount, preorderReserveDecimals)
            const preorderReserveDisplay =
              `${formatUnits(preorderReserveBase, preorderReserveDecimals)} ${effectivePreorderAsset}`
            action = genesisAndPreorderCall(router, {
              verseId: BigInt(verseId),
              genesis: fundStakeInput(sp, token, genesisBase),
              preorder: fundPsmInput(preorderReserve, preorderReserveBase),
              user: eoa,
            })
            functionName = 'genesisAndPreorder'
            inputs = `${genesisDisplay} + ${preorderReserveDisplay}`
            target = router
            spender = router
            pulls =
              preorderReserve === token
                ? [
                    {
                      token,
                      amount: genesisBase + preorderReserveBase,
                      display: `${formatUnits(genesisBase + preorderReserveBase, tokenDecimals)} ${payAsset}`,
                    },
                  ]
                : [
                    { token, amount: genesisBase, display: genesisDisplay },
                    { token: preorderReserve, amount: preorderReserveBase, display: preorderReserveDisplay },
                  ]
          }
        } else if (payIsUAsset) {
          const genesisBase = toBase(amount)
          if (preorderPayIsUAsset) {
            // Both legs draw the raise uAsset, so one merged uAsset pull approves the router
            // for the total.
            const totalBase = genesisBase + preorderBase
            action = genesisAndPreorderCall(router, {
              verseId: BigInt(verseId),
              genesis: fundUAssetInput(genesisBase),
              preorder: fundUAssetInput(preorderBase),
              user: eoa,
            })
            functionName = 'genesisAndPreorder'
            inputs = `${formatUnits(genesisBase, decimals)} + ${formatUnits(preorderBase, decimals)} ${raiseAssetSymbol}`
            target = router
            spender = router
            pulls = [
              { token: uAsset, amount: totalBase, display: `${formatUnits(totalBase, decimals)} ${raiseAssetSymbol}` },
            ]
          } else {
            // uAsset genesis + Psm preorder: two pull tokens → two approve legs; the typed
            // preorder amount is reserve-denominated and books the fee-adjusted mint.
            if (!effectivePreorderRecord) throw new Error('preorder reserve asset missing')
            const preorderReserve = effectivePreorderRecord.id as Hex
            const preorderReserveDecimals = await getTokenDecimals(reader, chainId, preorderReserve)
            const preorderReserveBase = toBaseUnits(preorderAmount, preorderReserveDecimals)
            const preorderReserveDisplay =
              `${formatUnits(preorderReserveBase, preorderReserveDecimals)} ${effectivePreorderAsset}`
            action = genesisAndPreorderCall(router, {
              verseId: BigInt(verseId),
              genesis: fundUAssetInput(genesisBase),
              preorder: fundPsmInput(preorderReserve, preorderReserveBase),
              user: eoa,
            })
            functionName = 'genesisAndPreorder'
            inputs = `${formatUnits(genesisBase, decimals)} ${raiseAssetSymbol} + ${preorderReserveDisplay}`
            target = router
            spender = router
            pulls = [
              { token: uAsset, amount: genesisBase, display: `${formatUnits(genesisBase, decimals)} ${raiseAssetSymbol}` },
              { token: preorderReserve, amount: preorderReserveBase, display: preorderReserveDisplay },
            ]
          }
        } else {
          // Psm genesis leg (reserve): the router mints the genesis uAsset through the PSM pair;
          // the preorder leg carries its own FundInput — uAsset-direct or PSM mint. When both
          // legs pay the same reserve, the pulls merge into one approve of the summed amount.
          if (!payAssetRecord) throw new Error('reserve pay asset missing')
          const reserve = payAssetRecord.id as Hex
          const reserveDecimals = await getTokenDecimals(reader, chainId, reserve)
          const genesisBase = toBaseUnits(amount, reserveDecimals)
          const genesisDisplay = `${formatUnits(genesisBase, reserveDecimals)} ${payAsset}`
          if (preorderPayIsUAsset) {
            action = genesisAndPreorderCall(router, {
              verseId: BigInt(verseId),
              genesis: fundPsmInput(reserve, genesisBase),
              preorder: fundUAssetInput(preorderBase),
              user: eoa,
            })
            functionName = 'genesisAndPreorder'
            inputs = `${genesisDisplay} + ${preorderDisplay}`
            target = router
            spender = router
            pulls = [
              { token: reserve, amount: genesisBase, display: genesisDisplay },
              { token: uAsset, amount: preorderBase, display: preorderDisplay },
            ]
          } else {
            if (!effectivePreorderRecord) throw new Error('preorder reserve asset missing')
            const preorderReserve = effectivePreorderRecord.id as Hex
            const preorderReserveDecimals = await getTokenDecimals(reader, chainId, preorderReserve)
            const preorderReserveBase = toBaseUnits(preorderAmount, preorderReserveDecimals)
            const preorderReserveDisplay =
              `${formatUnits(preorderReserveBase, preorderReserveDecimals)} ${effectivePreorderAsset}`
            const sameReserve = preorderReserve === reserve
            action = genesisAndPreorderCall(router, {
              verseId: BigInt(verseId),
              genesis: fundPsmInput(reserve, genesisBase),
              preorder: fundPsmInput(preorderReserve, preorderReserveBase),
              user: eoa,
            })
            functionName = 'genesisAndPreorder'
            inputs = `${genesisDisplay} + ${preorderReserveDisplay}`
            target = router
            spender = router
            pulls = sameReserve
              ? [
                  {
                    token: reserve,
                    amount: genesisBase + preorderReserveBase,
                    display: `${formatUnits(genesisBase + preorderReserveBase, reserveDecimals)} ${payAsset}`,
                  },
                ]
              : [
                  { token: reserve, amount: genesisBase, display: genesisDisplay },
                  { token: preorderReserve, amount: preorderReserveBase, display: preorderReserveDisplay },
                ]
          }
        }
      } else if (wiredKind === 'preorder-only') {
        if (payIsUAsset) {
          const preorderBase = toBase(preorderOnly ? amount : preorderAmount)
          action = preorderCall(launcher, {
            verseId: BigInt(verseId),
            amountInUAsset: preorderBase,
            user: eoa,
          })
          functionName = 'preorder'
          inputs = `${formatUnits(preorderBase, decimals)} ${raiseAssetSymbol}`
          target = launcher
          spender = launcher
          pulls = [
            { token: uAsset, amount: preorderBase, display: `${formatUnits(preorderBase, decimals)} ${raiseAssetSymbol}` },
          ]
        } else {
          // Reserve-paid preorder (IOutrunRouter.preorderByPSM): one transaction — the router
          // mints the uAsset through the registered PSM pair and forwards the full mint into
          // launcher preorder; the pull token is the reserve.
          if (!payAssetRecord) throw new Error('reserve pay asset missing')
          const reserve = payAssetRecord.id as Hex
          const reserveDecimals = await getTokenDecimals(reader, chainId, reserve)
          const reserveBase = toBaseUnits(preorderOnly ? amount : preorderAmount, reserveDecimals)
          const reserveDisplay = `${formatUnits(reserveBase, reserveDecimals)} ${payAsset}`
          action = preorderByPsmCall(router, {
            uAsset,
            reserveToken: reserve,
            amountIn: reserveBase,
            verseId: BigInt(verseId),
            preorderUser: eoa,
          })
          functionName = 'preorderByPSM'
          inputs = reserveDisplay
          target = router
          spender = router
          pulls = [{ token: reserve, amount: reserveBase, display: reserveDisplay }]
        }
      } else if (wiredKind === 'leverage-preorder') {
        // Router leveragedGenesisAndPreorder: the interest leg funds per route and the preorder
        // leg carries its own FundInput (uAsset-direct or PSM mint). Credit and mixed-reserve
        // routes pull two tokens → two approve legs; same-token legs merge into one pull.
        const preorderBase = toBase(preorderAmount)
        const preorderDisplay = `${formatUnits(preorderBase, decimals)} ${raiseAssetSymbol}`
        if (effectiveRoute === 'credit') {
          // Deployment tables key credits per family (GenesisCredit.<SYM>); a bare key exists
          // nowhere — fail visibly instead of handing undefined to getTokenDecimals
          const credit = contracts[`GenesisCredit.${raiseAssetSymbol}`] as Hex | undefined
          if (!credit) throw new Error(`GenesisCredit.${raiseAssetSymbol} not deployed`)
          const creditDecimals = await getTokenDecimals(reader, chainId, credit)
          const interestBase = toBaseUnits(amount, creditDecimals)
          if (preorderPayIsUAsset) {
            action = leveragedGenesisAndPreorderCall(router, {
              verseId: BigInt(verseId),
              genesis: fundCreditInput(interestBase),
              preorder: fundUAssetInput(preorderBase),
              user: eoa,
            })
            functionName = 'leveragedGenesisAndPreorder'
            inputs = `${formatUnits(interestBase, creditDecimals)} ${payAsset} + ${preorderDisplay}`
            target = router
            spender = router
            pulls = [
              { token: credit, amount: interestBase, display: `${formatUnits(interestBase, creditDecimals)} ${payAsset}` },
              { token: uAsset, amount: preorderBase, display: preorderDisplay },
            ]
          } else {
            if (!effectivePreorderRecord) throw new Error('preorder reserve asset missing')
            const preorderReserve = effectivePreorderRecord.id as Hex
            const preorderReserveDecimals = await getTokenDecimals(reader, chainId, preorderReserve)
            const preorderReserveBase = toBaseUnits(preorderAmount, preorderReserveDecimals)
            const preorderReserveDisplay =
              `${formatUnits(preorderReserveBase, preorderReserveDecimals)} ${effectivePreorderAsset}`
            action = leveragedGenesisAndPreorderCall(router, {
              verseId: BigInt(verseId),
              genesis: fundCreditInput(interestBase),
              preorder: fundPsmInput(preorderReserve, preorderReserveBase),
              user: eoa,
            })
            functionName = 'leveragedGenesisAndPreorder'
            inputs = `${formatUnits(interestBase, creditDecimals)} ${payAsset} + ${preorderReserveDisplay}`
            target = router
            spender = router
            pulls = [
              { token: credit, amount: interestBase, display: `${formatUnits(interestBase, creditDecimals)} ${payAsset}` },
              { token: preorderReserve, amount: preorderReserveBase, display: preorderReserveDisplay },
            ]
          }
        } else if (payIsUAsset && preorderPayIsUAsset) {
          // uAsset-direct leverage interest with a uAsset preorder: both legs pay the raise
          // asset itself
          const interestBase = toBase(amount)
          const totalBase = interestBase + preorderBase
          action = leveragedGenesisAndPreorderCall(router, {
            verseId: BigInt(verseId),
            genesis: fundUAssetInput(interestBase),
            preorder: fundUAssetInput(preorderBase),
            user: eoa,
          })
          functionName = 'leveragedGenesisAndPreorder'
          inputs = `${formatUnits(interestBase, decimals)} + ${preorderDisplay}`
          target = router
          spender = router
          pulls = [
            { token: uAsset, amount: totalBase, display: `${formatUnits(totalBase, decimals)} ${raiseAssetSymbol}` },
          ]
        } else if (payIsUAsset) {
          // uAsset-direct interest + PSM preorder: the router mints the preorder uAsset through
          // the PSM pair — the interest pulls uAsset, the preorder pulls the reserve.
          if (!effectivePreorderRecord) throw new Error('preorder reserve asset missing')
          const preorderReserve = effectivePreorderRecord.id as Hex
          const preorderReserveDecimals = await getTokenDecimals(reader, chainId, preorderReserve)
          const preorderReserveBase = toBaseUnits(preorderAmount, preorderReserveDecimals)
          const preorderReserveDisplay =
            `${formatUnits(preorderReserveBase, preorderReserveDecimals)} ${effectivePreorderAsset}`
          const interestBase = toBase(amount)
          action = leveragedGenesisAndPreorderCall(router, {
            verseId: BigInt(verseId),
            genesis: fundUAssetInput(interestBase),
            preorder: fundPsmInput(preorderReserve, preorderReserveBase),
            user: eoa,
          })
          functionName = 'leveragedGenesisAndPreorder'
          inputs = `${formatUnits(interestBase, decimals)} ${raiseAssetSymbol} + ${preorderReserveDisplay}`
          target = router
          spender = router
          pulls = [
            { token: uAsset, amount: interestBase, display: `${formatUnits(interestBase, decimals)} ${raiseAssetSymbol}` },
            { token: preorderReserve, amount: preorderReserveBase, display: preorderReserveDisplay },
          ]
        } else {
          // Reserve interest leg (Psm): the router mints the interest uAsset through the PSM
          // pair — the quota preview above already nets the mint fee (tin) via netUAsset. The
          // preorder leg is uAsset-direct or PSM mint; two reserve legs on one token merge.
          if (!payAssetRecord) throw new Error('reserve pay asset missing')
          const reserve = payAssetRecord.id as Hex
          const reserveDecimals = await getTokenDecimals(reader, chainId, reserve)
          const interestBase = toBaseUnits(amount, reserveDecimals)
          const interestDisplay = `${formatUnits(interestBase, reserveDecimals)} ${payAsset}`
          if (preorderPayIsUAsset) {
            action = leveragedGenesisAndPreorderCall(router, {
              verseId: BigInt(verseId),
              genesis: fundPsmInput(reserve, interestBase),
              preorder: fundUAssetInput(preorderBase),
              user: eoa,
            })
            functionName = 'leveragedGenesisAndPreorder'
            inputs = `${interestDisplay} + ${preorderDisplay}`
            target = router
            spender = router
            pulls = [
              { token: reserve, amount: interestBase, display: interestDisplay },
              { token: uAsset, amount: preorderBase, display: preorderDisplay },
            ]
          } else {
            if (!effectivePreorderRecord) throw new Error('preorder reserve asset missing')
            const preorderReserve = effectivePreorderRecord.id as Hex
            const preorderReserveDecimals = await getTokenDecimals(reader, chainId, preorderReserve)
            const preorderReserveBase = toBaseUnits(preorderAmount, preorderReserveDecimals)
            const preorderReserveDisplay =
              `${formatUnits(preorderReserveBase, preorderReserveDecimals)} ${effectivePreorderAsset}`
            const sameReserve = preorderReserve === reserve
            action = leveragedGenesisAndPreorderCall(router, {
              verseId: BigInt(verseId),
              genesis: fundPsmInput(reserve, interestBase),
              preorder: fundPsmInput(preorderReserve, preorderReserveBase),
              user: eoa,
            })
            functionName = 'leveragedGenesisAndPreorder'
            inputs = `${interestDisplay} + ${preorderReserveDisplay}`
            target = router
            spender = router
            pulls = sameReserve
              ? [
                  {
                    token: reserve,
                    amount: interestBase + preorderReserveBase,
                    display: `${formatUnits(interestBase + preorderReserveBase, reserveDecimals)} ${payAsset}`,
                  },
                ]
              : [
                  { token: reserve, amount: interestBase, display: interestDisplay },
                  { token: preorderReserve, amount: preorderReserveBase, display: preorderReserveDisplay },
                ]
          }
        }
      } else {
        // On-chain leverage single-leg entries mirror the wired interest routes: credit
        // escrow and uAsset-direct live on POLend (IPOLend), reserve pay on the router's
        // leveragedGenesisByPSM. Builder and pull token must follow the route — approving a
        // token the contract never pulls reverts the batch.
        if (effectiveRoute === 'credit') {
          // Deployment tables key credits per family (GenesisCredit.<SYM>); a bare key exists
          // nowhere — fail visibly instead of handing undefined to getTokenDecimals
          const credit = contracts[`GenesisCredit.${raiseAssetSymbol}`] as Hex | undefined
          if (!credit) throw new Error(`GenesisCredit.${raiseAssetSymbol} not deployed`)
          const creditDecimals = await getTokenDecimals(reader, chainId, credit)
          const interestBase = toBaseUnits(amount, creditDecimals)
          action = leveragedGenesisWithCreditCall(polend, {
            verseId: BigInt(verseId),
            creditAmount: interestBase,
            user: eoa,
          })
          functionName = 'leveragedGenesisWithCredit'
          inputs = `${formatUnits(interestBase, creditDecimals)} ${payAsset}`
          target = polend
          spender = polend
          pulls = [
            { token: credit, amount: interestBase, display: `${formatUnits(interestBase, creditDecimals)} ${payAsset}` },
          ]
        } else if (payIsUAsset) {
          // uAsset-direct leverage: interest paid in the raise asset itself
          const interestBase = toBase(amount)
          action = leveragedGenesisCall(polend, {
            verseId: BigInt(verseId),
            interestAmount: interestBase,
            user: eoa,
          })
          functionName = 'leveragedGenesis'
          inputs = `${formatUnits(interestBase, decimals)} ${payAsset}`
          target = polend
          spender = polend
          pulls = [
            { token: uAsset, amount: interestBase, display: `${formatUnits(interestBase, decimals)} ${payAsset}` },
          ]
        } else {
          // Reserve interest (IOutrunRouter.leveragedGenesisByPSM): the router mints the
          // interest uAsset through the PSM pair and books the debt — the pull token is the
          // reserve.
          if (!payAssetRecord) throw new Error('reserve pay asset missing')
          const reserve = payAssetRecord.id as Hex
          const reserveDecimals = await getTokenDecimals(reader, chainId, reserve)
          const interestBase = toBaseUnits(amount, reserveDecimals)
          action = leveragedGenesisByPsmCall(router, {
            uAsset,
            reserveToken: reserve,
            amountIn: interestBase,
            verseId: BigInt(verseId),
            genesisUser: eoa,
          })
          functionName = 'leveragedGenesisByPSM'
          inputs = `${formatUnits(interestBase, reserveDecimals)} ${payAsset}`
          target = router
          spender = router
          pulls = [
            { token: reserve, amount: interestBase, display: `${formatUnits(interestBase, reserveDecimals)} ${payAsset}` },
          ]
        }
      }
      // Allowance is the only must-read-now read on the click path; the legs run in parallel
      // (one round trip for the whole batch).
      const allowances = await readAllowances(
        reader,
        eoa,
        pulls.map((leg) => ({ token: leg.token, spender })),
      )
      const approvalLegs: BatchExecution[] = []
      const approvalDisplays: string[] = []
      pulls.forEach((leg, index) => {
        if ((allowances[index] ?? 0n) < leg.amount) {
          approvalLegs.push(approvalCall(leg.token, spender, leg.amount))
          approvalDisplays.push(leg.display)
        }
      })
      const { calls, calldata: batch } = buildSessionWrite({
        hook,
        action,
        ...(approvalLegs.length === 1 ? { approval: approvalLegs[0] } : {}),
        ...(approvalLegs.length > 1 ? { approvals: approvalLegs } : {}),
      })
      const spec: WriteSpec = {
        review: {
          chainId,
          account: eoa,
          // Target follows the wired entry: single-leg uAsset genesis/preorder on the launcher,
          // credit and uAsset-direct leverage on POLend, everything else on the router.
          targetContract: target,
          functionName,
          inputs,
          minOutput: '—',
          fee: '—',
          gasPayer: eoa,
          // Lists exactly the approvals the batch executes — a pull leg already covered by
          // its allowance is not an authorization change.
          authorizationChange: approvalDisplays.length > 0 ? approvalDisplays.join(' + ') : '—',
          // The review panel renders no gas fields: the fee row comes from useGasQuote once
          // the dialog is open, so estimating here would only delay the dialog.
          estimatedGas: '—',
          nativeBalance: '—',
        },
        kernel,
        expectedChainId: chainId,
        batchCallData: batch,
        calls,
        quoteId: `${verseId}:${wiredKind}:${pulls.reduce((sum, leg) => sum + leg.amount, 0n)}`,
        minOutput: '—',
        slippageBps: 0,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        manifestVersion: resolved.config.contracts.abiVersion,
        crossChain: false,
        // Participation changes this verse's server-rendered aggregates on the chain it
        // executes on — declaring the scope hands the post-write server refresh (cache
        // invalidation + prime + re-render) to the tx center's central wiring.
        writeScope: { kind: 'verse', chainId, verseId: String(verseId) },
      }
      return spec
    } catch {
      // The caller owns the failure state: a stranded generation must not paint an error
      // line into a newer review window.
      return null
    }
  }

  /**
   * Open the review window and prepare its write.
   *
   * The click path is exactly two wallet round trips: the live chain check (which must pass
   * before a dialog may open — a wrong chain must never reach it) and then the allowance read,
   * which runs behind the already-open dialog. Everything else (verse registry, decimals) is
   * prefetched, and the gas row is quoted inside the dialog. Previously the dialog waited for
   * six serial reads (two eth_chainId, the verse tuple, decimals, balance+allowance,
   * estimateGas+balance) — that wait is what read as "the window takes seconds to appear".
   * Confirm stays disabled until the spec lands (`pendingSpec == null`).
   */
  function startPreparation(): void {
    warmSession()
    const seq = ++prepareSeq.current
    setPendingSpec(null)
    setGasOverride(null)
    setResolveFailed(false)
    setResolving(true)
    void (async () => {
      let handedOff = false
      try {
        const provider = getActiveEip1193Provider()
        const eoa = center.address as Hex | null
        if (!provider || !eoa || verseId == null) return
        // The session read is also the live-chain gate: it probes the provider and refuses a
        // chain outside the verse's landed set, so a click that cannot execute never opens a
        // review. A warmed session makes this one round trip; only the allowance follows.
        const session = await getVerseSession({
          provider,
          chains: execChains,
          eoa,
          verseId: BigInt(verseId),
        })
        if (seq !== prepareSeq.current) return
        setLiveWrongChain(false)
        const spec = await prepareSpec(session)
        if (seq !== prepareSeq.current) return
        setResolveFailed(spec == null)
        if (!spec) {
          setReviewing(true)
          return
        }
        // The open effect below takes over: it waits for the fee quote so the card renders in
        // one pass, and only then releases the form CTA.
        setPendingSpec(spec)
        handedOff = true
      } catch (error) {
        if (seq !== prepareSeq.current) return
        if (error instanceof VerseChainError) {
          setLiveWrongChain(true)
          return
        }
        // The chain gate passed but the static half could not be read: open the review so the
        // degrade line sits next to a disabled Confirm instead of failing silently.
        setReviewing(true)
        setResolveFailed(true)
      } finally {
        // On success `resolving` stays set until the review actually paints (see the open
        // effect), so the form CTA cannot start a second preparation in that window.
        if (!handedOff && seq === prepareSeq.current) setResolving(false)
      }
    })()
  }

  /** Balance/Max row (same structure as swap-panel; token symbol not repeated, shown by the adjacent Pay with;
   *  snapshot missing=-- + Max disabled). Text/fill are preformatted from exact base units. */
  function balanceRow(
    balanceText: string | null,
    fill: string,
    onMax: () => void,
    zero: boolean,
  ) {
    return (
      <span className="swap-panel__balance">
        {copy.verseDesk.balance}:{' '}
        {balanceText != null ? <span data-numeric>{balanceText}</span> : '--'}
        <button
          type="button"
          className="swap-panel__max"
          disabled={zero}
          onClick={onMax}
        >
          {copy.verseDesk.max}
        </button>
      </span>
    )
  }

  // Amount input Field: stake branch gets its own row; direct/credit/preorder side by side with Pay with
  const amountField = (
    <Field
      data-invalid={
        amountInvalid ||
        (mode === 'leverage' && leverageExceeded) ||
        preorderTabExceeded ||
        balanceShort
          ? true
          : undefined
      }
    >
      <div className="participation-field-head">
        <FieldLabel htmlFor="participation-amount">
          {preorderOnly
            ? copy.verse.preorderAmountLabel
            : mode === 'leverage'
              ? copy.verse.leverageInterestLabel
              : copy.verse.amount}
        </FieldLabel>
        {balanceRow(walletBalanceText, balanceFillOf(payAsset), () => {
          setAmount(balanceFillOf(payAsset))
          resetReview()
        }, balanceZeroOf(payAsset))}
      </div>
      <Input
        id="participation-amount"
        name="participation-amount"
        className="numeric-input"
        inputMode="decimal"
        autoComplete="off"
        value={amount}
        maxLength={AMOUNT_MAX_CHARS}
        aria-invalid={
          amountInvalid ||
          (mode === 'leverage' && leverageExceeded) ||
          preorderTabExceeded ||
          balanceShort
            ? true
            : undefined
        }
        aria-describedby={showBalanceShort ? 'participation-balance-error' : undefined}
        onChange={(event) => {
          setAmount(sanitizeAmount(event.target.value))
          resetReview()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault()
        }}
        placeholder={copy.verse.amountPlaceholder}
      />
      {amountInvalid ? <FieldError>{copy.verse.inputError}</FieldError> : null}
      {preorderTabExceeded && versePreorderRemaining != null ? (
        <FieldError>
          {copy.verse.preorderCapacityExceeded.replace(
            '{cap}',
            `${remainingText ?? ''} ${raiseAssetSymbol}`,
          )}
        </FieldError>
      ) : null}
      {preorderOnly && versePreorderRemaining != null ? (
        <FieldDescription>
          {copy.verse.preorderHeadroom}{' '}
          <b data-numeric>
            {remainingText} {raiseAssetSymbol}
          </b>
        </FieldDescription>
      ) : null}
      {mode === 'leverage' && leverageExceeded && leverageHeadroom != null ? (
        <FieldError>
          {copy.verse.leverageCapExceeded.replace(
            '{quota}',
            `${formatAmount(leverageHeadroom, locale)} ${raiseAssetSymbol}`,
          )}
        </FieldError>
      ) : null}
      {showBalanceShort ? (
        <FieldError id="participation-balance-error">{copy.common.insufficientBalance}</FieldError>
      ) : null}
      {mode === 'leverage' && leverageQuota != null && leverageRate != null ? (
        <FieldDescription>
          {copy.verse.leverageDebtQuota}{' '}
          <b data-numeric>
            {leverageDebtText} {raiseAssetSymbol}
          </b>
        </FieldDescription>
      ) : null}
      {mode === 'leverage' && leverageHeadroom != null ? (
        <FieldDescription>
          {copy.verse.leverageCapHeadroom}{' '}
          <b data-numeric>
            {formatAmount(leverageHeadroom, locale)} {raiseAssetSymbol}
          </b>
        </FieldDescription>
      ) : null}
    </Field>
  )

  // Review runs in a small popup over the intact form (the inline card read too empty; dialog
  // body below). Single stage: figure summary, then straight to the wallet popup (no in-site
  // review station — no double review).
  // Meta strip = mode + preorder flag. Pay assets are deliberately NOT listed here: every
  // leg already carries its own symbol in the ledger below, so the strip would repeat them;
  // preorder-only's mode label already IS 「预购」.
  const reviewMetaParts =
    mode !== 'preorder' && preorderEnabled ? [modeLabel, copy.verse.preorderMode] : [modeLabel]

  // Ledger value cell: the figure plus, when that leg converts through the PSM, its derived
  // fee as a subordinate second line on the same right-aligned axis. Pairing is spatial, so
  // no indentation or duplicate fee rows are needed.
  const reviewValue = (
    amountText: string,
    asset: string,
    fee?: { percentText: string; feeText: string; asset: string } | null,
  ) => (
    <span className="participation-review__value">
      <span data-numeric>
        {amountText} {asset}
      </span>
      {fee != null ? (
        <span className="participation-review__fee" data-numeric>
          {copy.verse.conversionFee} {fee.percentText}% · {fee.feeText} {fee.asset}
        </span>
      ) : null}
    </span>
  )
  // Fee leg attached to the figure it converts: the genesis amount in standard mode, the paid
  // interest in leverage mode (the genesis figure there is the borrowed quota, not a payment)
  const genesisFee =
    mode === 'leverage'
      ? null
      : feeLegText(mainTinWad, mainBase, payDecimals, reserveFee, numericAmount, payAsset)
  const interestFee =
    mode === 'leverage'
      ? feeLegText(mainTinWad, mainBase, payDecimals, reserveFee, numericAmount, payAsset)
      : null
  const preorderFeeLeg = preorderPayIsUAsset
    ? null
    : feeLegText(
        preorderTinWad,
        preorderInputBase,
        preorderDecimals,
        preorderFee,
        numericPreorder,
        effectivePreorderAsset,
      )
  // Preorder-only tab has no enters-genesis group, so its conversion fee rides the pay row
  const preorderOnlyFeeLeg = preorderOnly
    ? feeLegText(mainTinWad, mainBase, payDecimals, reserveFee, numericAmount, preorderRowAsset)
    : null

  // Confirm and success share one ledger skeleton: the same meta
  // strip, the same groups, the same rows and value stacks — only the head and the action
  // pair change. Extracted here so a state can never drift into a second layout.
  const genesisSection = genesisRow ? (
    <section
      className="participation-review__group participation-review__group--genesis"
      aria-label={copy.verse.genesisGroupTitle}
    >
      <h4 className="participation-review__group-label">{copy.verse.genesisGroupTitle}</h4>
      <div className="participation-review__rows">
        <div className="participation-review__row participation-review__row--genesis">
          <span>{genesisRow.label}</span>
          {reviewValue(genesisEnterText, raiseAssetSymbol, genesisFee)}
        </div>
        {mode === 'leverage' && leverageRate != null ? (
          <div className="participation-review__row participation-review__row--muted">
            <span>{copy.verse.leverageInterestRateLabel}</span>
            <span data-numeric>{leverageRateText}%</span>
          </div>
        ) : null}
        {mode === 'leverage' && numericAmount > 0 ? (
          <div className="participation-review__row participation-review__row--genesis">
            <span>{copy.verse.leverageInterestPaidLabel}</span>
            {reviewValue(moneyText(mainMintBase, 18, netUAsset(numericAmount)), raiseAssetSymbol, interestFee)}
          </div>
        ) : null}
        {preorderEnabled ? (
          <div className="participation-review__row participation-review__row--genesis">
            <span>{copy.verse.preorderAmountLabel}</span>
            {reviewValue(preorderEnterText, raiseAssetSymbol, preorderFeeLeg)}
          </div>
        ) : null}
      </div>
    </section>
  ) : null
  // Exact pay rows: the SAME row model as before, with amounts rendered from typed-string
  // base units (merged same-asset legs sum in integers; multi-asset legs keep their own token).
  const payRowsExact = (() => {
    if (preorderOnly) return [{ ...payReviewRows[0]!, amountText: preorderPayText }]
    if (payRows.length > 1 && sameAssetPay) {
      const totalBase = mainBase + preorderInputBase
      return [{ ...payReviewRows[0]!, amountText: formatBaseUnits(totalBase, payDecimals, locale) }]
    }
    if (payRows.length > 1) {
      return [
        { ...payReviewRows[0]!, amountText: mainPayText },
        { ...payReviewRows[1]!, amountText: preorderPayText },
      ]
    }
    return [{ ...payReviewRows[0]!, amountText: mainPayText }]
  })()
  const paySection = (
    <section
      className="participation-review__group participation-review__group--pay"
      aria-label={copy.verse.payGroupTitle}
    >
      <h4 className="participation-review__group-label">{copy.verse.payGroupTitle}</h4>
      <div className="participation-review__rows">
        {payRowsExact.map((row) => (
          <div className="participation-review__row participation-review__row--pay" key={row.label}>
            <span>{row.label}</span>
            {reviewValue(row.amountText, row.asset, preorderOnly ? preorderOnlyFeeLeg : null)}
          </div>
        ))}
      </div>
    </section>
  )
  // Explorer for the success receipt link: the review chain's registry entry (client-safe).
  const successChainId = tx.context.review?.chainId ?? pendingSpec?.review.chainId ?? null
  const successChain = successChainId != null ? getClientChainConfig(successChainId) : null
  const successExplorer = successChain?.status === 'ok' ? successChain.config.explorer : null
  // Unwired route: Confirm is omitted, so the action row must not keep a half-width column
  const singleAction = center.source === 'real' && wiredKind == null

  return (
    <form
      className="participation-form"
      autoComplete="off"
      // First hover/tap/focus warms the session (see warmSession): a pointer that reaches the
      // form is the earliest reliable signal that this visitor will write.
      onPointerEnter={warmSession}
      onFocusCapture={warmSession}
      onSubmit={(event) => {
        event.preventDefault()
        if (
          numericAmount <= 0 ||
          balanceShort ||
          (mode === 'leverage' && (!leverageReady || leverageExceeded)) ||
          (preorderOnly && (versePreorderRemaining == null || preorderTabExceeded)) ||
          (!preorderOnly &&
            preorderEnabled &&
            (numericPreorder <= 0 ||
              preorderExceeded ||
              oneClickRemainingExceeded ||
              preorderBalanceShort))
        ) {
          setInvalid(true)
          return
        }
        startPreparation()
      }}
    >
      <FieldSet>
        <FieldLegend>{copy.verse.participateTitle}</FieldLegend>
        <FieldGroup>
          <Field>
            {/* Top-level mode toggle: tab style, bottom edge line doubles as divider (ax-echo-bar signature line anchors below it), distinct from the route segmented control */}
            <ToggleGroup
              className="participation-toggle participation-toggle--mode ax-echo-bar"
              variant="outline"
              spacing={0}
              aria-label={copy.verse.modeLabel}
              value={[mode]}
              onValueChange={(value) => {
                if (!value[0] || value[0] === mode) return
                setMode(value[0] as ParticipationMode)
                // Mode-scoped inputs are cleared on switch: the shared
                // amount state means a different thing per mode (participation / interest / preorder)
                setAmount('')
                setPreorderAmount('')
                setPreorderEnabled(false)
                resetReview()
              }}
            >
              <ToggleGroupItem value="standard">{copy.verse.standardMode}</ToggleGroupItem>
              <ToggleGroupItem value="leverage">{copy.verse.leverageMode}</ToggleGroupItem>
              <ToggleGroupItem value="preorder">{copy.verse.preorderMode}</ToggleGroupItem>
            </ToggleGroup>
            {preorderOnly ? <FieldDescription>{copy.verse.preorderHelp}</FieldDescription> : null}
          </Field>

          {!preorderOnly ? (
            <Field>
              <FieldLabel>{copy.verse.route}</FieldLabel>
              <ToggleGroup
                className="participation-toggle participation-toggle--routes"
                variant="outline"
                spacing={0}
                value={[effectiveRoute]}
                onValueChange={(value) => {
                  if (!value[0]) return
                  setRoute(value[0] as ParticipationRoute)
                  resetReview()
                }}
              >
                <ToggleGroupItem value="direct" disabled={!raiseAsset && reserves.length === 0}>
                  {copy.verse.directRoute}
                </ToggleGroupItem>
                {mode === 'leverage' ? (
                  <ToggleGroupItem value="credit" disabled={!creditAsset}>
                    {copy.verse.leverageCreditRoute}
                  </ToggleGroupItem>
                ) : (
                  <ToggleGroupItem value="stake" disabled={yieldSourceRegistry.length === 0}>
                    {copy.verse.stakeRoute}
                  </ToggleGroupItem>
                )}
              </ToggleGroup>
              {/* Route description kept only for stake (describes route behavior); direct/credit payment-method descriptions moved below the Pay with dropdown */}
              {effectiveRoute === 'stake' ? (
                <FieldDescription>{fill(copy.verse.stakeHelp, { asset: payAsset, raise: raiseAssetSymbol })}</FieldDescription>
              ) : null}
            </Field>
          ) : null}

          {/* Preorder tab: Verse-level capacity progress bar (used/cap), placed before payment asset + amount as constraint context;
              snapshot missing → capacity area not rendered, CTA disabled (null renders nothing) */}
          {preorderOnly && versePreorderCap != null ? (
            <Field>
              <ProgressMeter
                label={copy.verse.preorderCapacityLabel}
                value={versePreorderPercent}
                amount={preorderRaisedE}
                threshold={versePreorderCap}
                unit={raiseAssetSymbol}
                locale={locale}
              />
              <FieldDescription>{preorderCapNote}</FieldDescription>
            </Field>
          ) : null}

          {effectiveRoute === 'stake' ? (
            /* Stake route three cells in one row: source/participating asset/amount in one row, amount column widest */
            <div className="participation-trio">
              <Field>
                <FieldLabel htmlFor="stake-source">{copy.verse.stakeSourceLabel}</FieldLabel>
                <Select
                  name="stake-source"
                  items={yieldSourceRegistry.map((source) => ({ value: source.id, label: source.name }))}
                  value={activeSource?.id ?? ''}
                  onValueChange={(value) => {
                    if (value) setSourceId(value)
                    setAsset('')
                    resetReview()
                  }}
                >
                  <SelectTrigger id="stake-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false} align="start">
                    <SelectGroup>
                      {yieldSourceRegistry.map((source) => (
                        <SelectItem key={source.id} value={source.id}>
                          {source.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="stake-asset">{copy.verse.stakeAssetLabel}</FieldLabel>
                {routeAssets.length > 1 ? (
                  <Select
                    name="stake-asset"
                    items={routeAssets.map((item) => ({ value: item.symbol, label: item.symbol }))}
                    value={payAsset}
                    onValueChange={(value) => {
                      if (value) setAsset(value)
                      resetReview()
                    }}
                  >
                    <SelectTrigger id="stake-asset">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false} align="start">
                      <SelectGroup>
                        {routeAssets.map((item) => (
                          <SelectItem key={item.id} value={item.symbol}>
                            {item.symbol}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                ) : payAsset ? (
                  <p className="participation-fixed-asset" data-numeric>
                    {payAsset}
                  </p>
                ) : null}
              </Field>
              {amountField}
            </div>
          ) : (
            /* Payment asset and amount side by side (a single row with one cell each takes too much space); preorder payment asset group matches direct payment (uAsset direct payment + reserve par direct swap) */
            <div className="participation-duo">
              <Field>
                <FieldLabel htmlFor="payment-asset">{copy.verse.payAsset}</FieldLabel>
                {routeAssets.length > 1 ? (
                  <Select
                    name="payment-asset"
                    items={routeAssets.map((item) => ({ value: item.symbol, label: item.symbol }))}
                    value={payAsset}
                    onValueChange={(value) => {
                      if (value) setAsset(value)
                      resetReview()
                    }}
                  >
                    <SelectTrigger id="payment-asset">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false} align="start">
                      <SelectGroup>
                        {routeAssets.map((item) => (
                          <SelectItem key={item.id} value={item.symbol}>
                            {item.symbol}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                ) : payAsset ? (
                  <p className="participation-fixed-asset" data-numeric>
                    {payAsset}
                  </p>
                ) : null}
                {/* Payment-method description right under the Pay with dropdown: preorder/standard/leverage direct/credit uniformly dispatched.
                    A reserve payment states the on-chain PSM mint fee it pays on arrival; an unread rate keeps the par sentence. */}
                <FieldDescription>
                  {fill(
                    preorderOnly
                      ? payAsset === raiseAssetSymbol
                        ? copy.verse.uassetHelp
                        : reserveFee != null
                          ? copy.verse.directHelpFee
                          : copy.verse.directHelp
                      : effectiveRoute === 'credit'
                        ? copy.verse.leverageCreditHelp
                        : payAsset === raiseAssetSymbol
                          ? mode === 'leverage'
                            ? copy.verse.leverageUassetHelp
                            : copy.verse.uassetHelp
                          : mode === 'leverage'
                            ? reserveFee != null
                              ? copy.verse.leverageDirectHelpFee
                              : copy.verse.leverageDirectHelp
                            : reserveFee != null
                              ? copy.verse.directHelpFee
                              : copy.verse.directHelp,
                    {
                      asset: payAsset,
                      raise: raiseAssetSymbol,
                      ...(reserveFee != null
                        ? { fee: `${formatPercent(reserveFee * 100, locale)}%` }
                        : {}),
                    },
                  )}
                </FieldDescription>
              </Field>
              {amountField}
            </div>
          )}

          {!preorderOnly ? (
            <>
              <Field>
                <ToggleGroup
                  className="participation-toggle"
                  variant="outline"
                  spacing={0}
                  aria-label={copy.verse.oneClickPreorder}
                  value={preorderEnabled ? ['enabled'] : []}
                  onValueChange={(value) => {
                    setPreorderEnabled(value.includes('enabled'))
                    resetReview()
                  }}
                >
                  <ToggleGroupItem value="enabled">{copy.verse.oneClickPreorder}</ToggleGroupItem>
                </ToggleGroup>
              </Field>

              {preorderEnabled ? (
                <div className="participation-duo">
                  <Field>
                    <FieldLabel htmlFor="preorder-asset">{copy.verse.payAsset}</FieldLabel>
                    {preorderAssets.length > 1 ? (
                      <Select
                        name="preorder-asset"
                        items={preorderAssets.map((item) => ({ value: item.symbol, label: item.symbol }))}
                        value={effectivePreorderAsset}
                        onValueChange={(value) => {
                          if (value) setPreorderAsset(value)
                          resetReview()
                        }}
                      >
                        <SelectTrigger id="preorder-asset">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent alignItemWithTrigger={false} align="start">
                          <SelectGroup>
                            {preorderAssets.map((item) => (
                              <SelectItem key={item.id} value={item.symbol}>
                                {item.symbol}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    ) : effectivePreorderAsset ? (
                      <p className="participation-fixed-asset" data-numeric>
                        {effectivePreorderAsset}
                      </p>
                    ) : null}
                  </Field>
                  <Field data-invalid={
                    preorderInvalid || preorderExceeded || oneClickRemainingExceeded || preorderBalanceShort
                      ? true
                      : undefined
                  }>
                    <div className="participation-field-head">
                      <FieldLabel htmlFor="preorder-amount">{copy.verse.preorderAmountLabel}</FieldLabel>
                      {balanceRow(
                        preorderWalletBalanceText,
                        balanceFillOf(effectivePreorderAsset),
                        () => {
                          setPreorderAmount(balanceFillOf(effectivePreorderAsset))
                          resetReview()
                        },
                        balanceZeroOf(effectivePreorderAsset),
                      )}
                    </div>
                  <Input
                    id="preorder-amount"
                    name="preorder-amount"
                    className="numeric-input"
                    inputMode="decimal"
                    autoComplete="off"
                    value={preorderAmount}
                    maxLength={AMOUNT_MAX_CHARS}
                    aria-invalid={
                      preorderInvalid || preorderExceeded || oneClickRemainingExceeded || preorderBalanceShort
                        ? true
                        : undefined
                    }
                    aria-describedby={
                      preorderBalanceShort && !preorderExceeded ? 'preorder-balance-error' : undefined
                    }
                    onChange={(event) => {
                      setPreorderAmount(sanitizeAmount(event.target.value))
                      resetReview()
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229))
                        event.preventDefault()
                    }}
                    placeholder={copy.verse.amountPlaceholder}
                  />
                  {preorderInvalid ? <FieldError>{copy.verse.inputError}</FieldError> : null}
                  {preorderExceeded && preorderCap != null ? (
                    <FieldError>
                      {copy.verse.preorderCapExceeded.replace(
                        '{cap}',
                        `${capText ?? ''} ${raiseAssetSymbol}`,
                      )}
                    </FieldError>
                  ) : null}
                  {oneClickRemainingExceeded && versePreorderRemaining != null ? (
                    <FieldError>
                      {copy.verse.preorderCapacityExceeded.replace(
                        '{cap}',
                        `${remainingText ?? ''} ${raiseAssetSymbol}`,
                      )}
                    </FieldError>
                  ) : null}
                  {preorderBalanceShort && !preorderExceeded ? (
                    <FieldError id="preorder-balance-error">
                      {copy.common.insufficientBalance}
                    </FieldError>
                  ) : null}
                  {preorderCap != null && preorderCapNote != null ? (
                    <FieldDescription>
                      {copy.verse.preorderCapLabel}
                      <Tooltip>
                        <TooltipTrigger className="create-info" aria-label={preorderCapNote}>
                          <Info aria-hidden="true" />
                        </TooltipTrigger>
                        <TooltipContent>{preorderCapNote}</TooltipContent>
                      </Tooltip>
                      :{' '}
                      {/* unit stays outside data-numeric — a mono space before the symbol reads
                          twice as wide as a normal word space (swap-panel balance pattern) */}
                      <b data-numeric>{formatAmount(preorderCap, locale)}</b> <b>{raiseAssetSymbol}</b>
                    </FieldDescription>
                  ) : null}
                  </Field>
                </div>
              ) : null}
            </>
          ) : null}
        </FieldGroup>
      </FieldSet>

      <SourceRef value={sourceRef} />
      {/* CTA slot ladder: disconnected = the whole slot becomes the login button (same
          connectAction as the header wallet button; drafts stay filled — Launch submit-slot
          convention). A wallet outside the verse's landed chains never reaches the review
          dialog: the form CTA itself becomes the network switch —
          participation runs on any chain that actually holds the verse. */}
      {!connected ? (
        <Button
          type="button"
          variant="default"
          className="ax-ghost-cta"
          size="lg"
          onClick={connectAction}
        >
          <WalletCards data-icon="inline-start" aria-hidden="true" />
          {copy.common.connect}
        </Button>
      ) : wrongChain || liveWrongChain ? (
        <SwitchChainCta
          locale={locale}
          execChain={switchChainId}
          chainName={switchChainName}
          onSwitch={switchChain}
          onSwitched={() => void recheckLiveChain()}
          className="ax-ghost-cta"
          size="lg"
        />
      ) : (
        <Button
          type="submit"
          className="ax-ghost-cta"
          size="lg"
          // `resolving` also covers the preparation window (chain check before the dialog
          // opens): a double submit must not start a second preparation generation.
          disabled={
            resolving ||
            (mode === 'leverage' && !leverageReady) ||
            (preorderOnly && versePreorderRemaining == null)
          }
        >
          {copy.verse.review}
        </Button>
      )}
      {reviewing ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) resetReview()
          }}
        >
          <ActionDialogShell
            title={
              gasEditing
                ? copy.verse.gasNetworkFee
                : tx.display === 'confirmed'
                  ? copy.verse.reviewTitleDone
                  : copy.verse.reviewTitle
            }
            closeLabel={copy.common.close}
            toolbar={
              gasEditing ? (
                <button
                  ref={gasBackRef}
                  type="button"
                  className="pol-mint__back"
                  aria-label={copy.common.back}
                  onClick={() => leaveGasView()}
                >
                  <ChevronLeft aria-hidden="true" size={16} />
                </button>
              ) : undefined
            }
          >
            <div
              className="participation-review participation-review--dialog"
              data-leaving={gasLeaving ? 'true' : undefined}
              aria-live="polite"
            >
              {gasEditing && gasQuote.ready ? (
                <GasEditor
                  quote={gasQuote}
                  title={copy.verse.gasTitle}
                  onDone={() => leaveGasView()}
                />
              ) : (
              <>
              <p className="participation-review__meta">{reviewMetaParts.join(' · ')}</p>
              {tx.display === 'idle' ? (
                <>
                  {genesisSection}
                  {paySection}
                  {gasQuote.ready ? (
                    <GasSummaryRow
                      buttonRef={gasRowRef}
                      label={copy.verse.gasNetworkFee}
                      value={gasQuote.rowValue}
                      usd={gasQuote.rowUsd}
                      onEdit={() => switchGasView(true)}
                    />
                  ) : null}
                  <SourceRef value={sourceRef} />
                  {gasQuote.ready && gasQuote.invalid ? (
                    <FieldError>{copy.verse.gasInvalid}</FieldError>
                  ) : null}
                  {center.source === 'real' && wiredKind == null ? (
                    <p className="participation-review__note" role="note">
                      {fill(copy.verse.reviewUnwired, { asset: payAsset })}
                    </p>
                  ) : null}
                  <div
                    className={
                      singleAction
                        ? 'participation-review__actions participation-review__actions--single'
                        : 'participation-review__actions'
                    }
                  >
                    <Button variant="outline" onClick={resetReview}>
                      <RotateCcw data-icon="inline-start" aria-hidden="true" />
                      {copy.verse.revise}
                    </Button>
                    {center.source === 'real' && !connected ? (
                      <Button className="ax-ghost-cta" onClick={connectAction}>
                        {copy.common.connect}
                      </Button>
                    ) : wrongChain || liveWrongChain ? (
                      <SwitchChainCta
                        locale={locale}
                        execChain={switchChainId}
                        chainName={switchChainName}
                        onSwitch={switchChain}
                        onSwitched={startPreparation}
                        className="ax-ghost-cta"
                      />
                    ) : center.source === 'real' && wiredKind == null ? null : (
                      <Button
                        className="ax-ghost-cta"
                        // `tx.running` is deliberately absent: while running this row is
                        // replaced by the progress strip, so it can only ever be a stuck
                        // session flag that freezes a fresh window.
                        disabled={
                          resolving ||
                          pendingSpec == null ||
                          (gasQuote.ready && gasQuote.invalid)
                        }
                        data-blocked={
                          resolving
                            ? 'resolving'
                            : pendingSpec == null
                              ? 'unprepared'
                              : gasQuote.ready && gasQuote.invalid
                                ? 'gas-invalid'
                                : undefined
                        }
                        onClick={() => {
                          // The dialog opens before the allowance read returns, so Confirm can
                          // only fire once the spec is in hand (a failed preparation keeps it
                          // disabled and shows the degrade line instead).
                          if (!pendingSpec) return
                          const spec = gasOverride ? { ...pendingSpec, ...gasOverride } : pendingSpec
                          // Keep the dialog mounted: its body switches to the three-step
                          // status as soon as the flow starts.
                          void tx.executeSession(spec)
                        }}
                      >
                        {copy.verse.confirm}
                      </Button>
                    )}
                  </div>
                </>
              ) : tx.display === 'confirmed' ? (
                <div className="tx-success">
                  <div className="tx-success__head">
                    <span className="review-check" aria-hidden="true">
                      <Check />
                    </span>
                    <p className="tx-success__title">
                      {copy.verse.participateDoneLead}
                      {copy.verse.participateDoneAccent ? (
                        <span className="create-success-pop__title-accent">
                          {copy.verse.participateDoneAccent}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="tx-success__rows">
                    {payRowsExact.map((row) => (
                      <div
                        key={row.label}
                        className="participation-review__row participation-review__row--pay tx-success__paid"
                      >
                        <span>{row.label}</span>
                        <span data-numeric>
                          {row.amountText} {row.asset}
                        </span>
                      </div>
                    ))}
                  </div>
                  {tx.context.txHash && successExplorer ? (
                    <a
                      className="tx-success__hash"
                      href={`${successExplorer}/tx/${tx.context.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span className="tx-success__hash-label">{copy.verse.txHash}</span>
                      <span className="tx-success__hash-value">
                        <span data-numeric>{formatHex(tx.context.txHash)}</span>
                        <ExternalLink aria-hidden="true" className="size-3.5" />
                      </span>
                    </a>
                  ) : null}
                  <Button
                    className="ax-ghost-cta"
                    nativeButton={false}
                    render={<Link href={localePath(locale, '/portfolio')} />}
                  >
                    {copy.verse.viewPortfolio}
                  </Button>
                </div>
              ) : (
                <TxStatus locale={locale} state={tx.display} />
              )}
              {resolveFailed ? <FieldError>{copy.common.degrade.errorBody}</FieldError> : null}
              </>
              )}
            </div>
          </ActionDialogShell>
        </Dialog>
      ) : null}
    </form>
  )
}

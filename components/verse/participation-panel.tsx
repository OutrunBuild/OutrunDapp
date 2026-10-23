'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Info, RotateCcw } from 'lucide-react'

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
import type { Locale, FixtureAsset, FixtureYieldSource } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { localePath, parseVerseIdParam } from '../global/routes'
import { SwitchChainCta } from '../global/switch-chain-cta'
import { formatAmount, formatPercent, ProgressMeter, SourceRef } from '../global/signal-ui'
import { AMOUNT_MAX_CHARS, amountToInputString, sanitizeAmount } from '../global/amount-input'
import { TxStatus } from '../global/tx-status'
import { useAccountCenter } from '../global/use-account-center'
import { useTxCenter, type WriteSpec } from '../global/use-tx-center'
import { ActionDialogShell } from '../global/action-dialogs'
import {
  readErc20Meta,
  readErc20State,
  readVerseAddresses,
  type ContractReader,
} from '../global/execution-reads'
import { getClientChainConfig } from '@/lib/web3/chains'
import { erc20ReadAbi } from '@/lib/web3/abis'
import { getActiveEip1193Provider, useActiveEip1193Provider } from '@/lib/web3/active-provider'
import {
  approvalCall,
  buildSessionWrite,
  fundCreditInput,
  fundUAssetInput,
  genesisAndPreorderCall,
  genesisCall,
  leveragedGenesisAndPreorderCall,
  leveragedGenesisCall,
  leveragedGenesisWithCreditCall,
  preorderCall,
  type BatchExecution,
} from '@/lib/web3/session-actions'
import { useParams, useRouter } from 'next/navigation'
import { createPublicClient, custom, formatUnits, parseUnits, type Hex } from 'viem'

// Preorder is an independent path at the same level as standard/leverage genesis; standard/leverage modes offer one-click preorder
type ParticipationMode = 'standard' | 'leverage' | 'preorder'
// credit=leverage interest paid directly as genesis credits (leverage mode only; one of the two interest payment methods, burned at lock time)
// direct=direct participation: raise uAsset direct payment and reserve-asset par direct swap merged into one path (distinguished by the payment asset dropdown)
type ParticipationRoute = 'direct' | 'stake' | 'credit'

// Preorder capacity formula coefficient (capacity=(standard funds+leverage debt principal)×70%×capacity ratio; one-off ratio, not annualized)
const PREORDER_CAP_RATE = 0.7

/** Help copy template fill: {asset}=selected payment asset, {raise}=this Verse's raise uAsset symbol,
 *  {fee}=PSM mint-side fee rate on the face-value path */
function fill(template: string, values: { asset: string; raise: string; fee?: string }) {
  return template
    .replace(/\{asset\}/g, values.asset)
    .replace(/\{raise\}/g, values.raise)
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
  leverageInterestRaised,
  walletBalances,
  sourceRef,
  governanceChain,
  governanceChainName,
}: {
  locale: Locale
  raiseAsset: FixtureAsset | null
  reserves: FixtureAsset[]
  yieldSourceRegistry: FixtureYieldSource[]
  creditAsset: FixtureAsset | null
  normalRaised: number
  preorderRaised: number
  preorderCapacityRatio: number | null
  leverageInterestRate: number | null
  leverageDebtCap: number | null
  leverageInterestRaised: number
  /** Sample wallet balances (symbol→cross-chain total, balances fixture; symbols missing from the snapshot are absent from the table → slot state) */
  walletBalances: Record<string, number>
  sourceRef: string
  /** Verse's governance chain (execution chain; vault-actions' MAINNET_TO_TESTNET convention) */
  governanceChain: number
  governanceChainName: string
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
  // Real pipeline (replaces the retired timer simulation): review dialog → wallet popup
  // Type-4 session. Stake-route and reserve-leg participation resolve no addresses and stay
  // disabled onchain; uAsset-direct genesis/preorder and leverage-credit execute.
  const center = useAccountCenter()
  const { connected, switchChainAction: switchChain } = center
  const tx = useTxCenter()
  const params = useParams()
  const router = useRouter()
  const rawVerseId = params?.verseId
  const verseId = parseVerseIdParam(rawVerseId)
  const [resolving, setResolving] = useState(false)
  const [resolveFailed, setResolveFailed] = useState(false)
  const [invalid, setInvalid] = useState(false)

  // Pay-asset balances read client-side through the wallet provider (2026-10-21 ruling:
  // personal values never ride SSR — same pattern as the faucet PSM dialog; the SSR sample
  // table below stays the fixture/e2e source so recorded baselines keep their balances).
  const activeProvider = useActiveEip1193Provider()
  const [liveBalances, setLiveBalances] = useState<Record<string, number>>({})
  // Bumped when a confirmed participation closes — re-reads this panel's own live balances
  // (refresh scope = what this action changed, never a page-wide table clear)
  const [balanceNonce, setBalanceNonce] = useState(0)
  const liveReadEligible =
    center.source === 'real' && connected && center.chainId != null && center.address != null
  const payOptionKey = [raiseAsset, ...reserves, creditAsset]
    .filter((asset): asset is FixtureAsset => asset != null)
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
      const next: Record<string, number> = {}
      for (const [symbol, addr] of targets) {
        try {
          const [raw, meta] = await Promise.all([
            client.readContract({
              address: addr as Hex,
              abi: erc20ReadAbi,
              functionName: 'balanceOf',
              args: [eoa],
            }),
            readErc20Meta(reader, addr as Hex),
          ])
          next[symbol] = Number(formatUnits(BigInt(String(raw)), meta.decimals))
        } catch {
          // per-token failure → symbol absent → slot renders '--'
        }
      }
      if (!cancelled) setLiveBalances(next)
    })()
    return () => {
      cancelled = true
    }
  }, [liveReadEligible, center.chainId, center.address, activeProvider, payOptionKey, balanceNonce])
  const balanceTable = center.source === 'real' ? liveBalances : walletBalances
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
  // Leverage: one-off interest rate (locked at registration, not annualized); borrowed funds=interest÷rate (UI term; mechanism basis is the POLend debt quota); headroom=debt cap−debt built
  const leverageRate = leverageInterestRate != null && leverageInterestRate > 0 ? leverageInterestRate : null
  const leverageReady = leverageRate != null && leverageDebtCap != null
  const leverageCurrentDebt = leverageRate != null ? leverageInterestRaised / leverageRate : null
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
  const preorderExceeded = preorderCap != null && numericPreorder > preorderCap
  // 上限行 ⊙ 气泡 = 同一公式的文案形态，比例填参与上限计算的当前值（onchain 构建=链上 getLauncherParameters 读数）
  const preorderCapNote =
    preorderCapacityRatio != null
      ? copy.verse.preorderCapNote.replace(
          '{ratio}',
          formatPercent(preorderCapacityRatio * 100, locale),
        )
      : null
  // Preorder tab: Verse-level capacity (on-chain preorderMaxCapacity)=(standard genesis funds+leverage debt principal)×70%×capacity ratio;
  // debt principal=interest received÷rate; used=on-chain preorder total snapshot (fixture preorderRaised); remaining=capacity−used (first come, first served)
  const versePreorderBase = leverageRate != null ? normalRaised + leverageInterestRaised / leverageRate : null
  const versePreorderCap =
    preorderCapacityRatio != null && versePreorderBase != null
      ? versePreorderBase * PREORDER_CAP_RATE * preorderCapacityRatio
      : null
  const versePreorderRemaining =
    versePreorderCap != null ? Math.max(versePreorderCap - preorderRaised, 0) : null
  const versePreorderPercent =
    versePreorderCap != null && versePreorderCap > 0 ? (preorderRaised / versePreorderCap) * 100 : 0
  const preorderTabExceeded =
    preorderOnly && versePreorderRemaining != null && numericAmount > versePreorderRemaining
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
  // You-pay figure: the TOTAL outflow (direct payment + preorder) is the group's ONLY line —
  // no sub-items under it (user rulings 2026-10-21: pay amount = total, no children);
  // preorder has its peer figure in the enter-genesis group and is not repeated (round 4).
  // Multi-asset rows cannot sum → the direct payment stands in (wired path is single-asset).
  const payHeroLabel = preorderOnly ? copy.verse.preorderAmountLabel : copy.verse.payAmount
  const payHeroAmount = totalPaid ?? mainPayRow?.amount ?? preorderRowAmount
  // Preorder funds buy in only after the main pool opens — mechanically not genesis capital,
  // but the review card shows the preorder amount as a PEER figure of the genesis amount
  // (user ruling 2026-10-21 round 3); preorder-only still has no into-genesis group
  const genesisRow = preorderOnly
    ? null
    : mode === 'leverage'
      ? { label: copy.verse.leverageDebtQuota, amount: leverageQuota ?? 0 }
      : { label: copy.verse.genesisAmount, amount: convertedAmount }

  function resetReview() {
    setReviewing(false)
    // Closing a confirmed panel = the verse aggregates changed: refresh the server tree
    // (raised/progress/participants) and re-read this panel's live balances (user ruling
    // 2026-10-23 — the page must not wait for a manual reload).
    if (tx.display === 'confirmed') {
      router.refresh()
      setBalanceNonce((nonce) => nonce + 1)
    }
    tx.reset()
    setInvalid(false)
  }

  // Payment asset wallet balance (source of Balance/Max; snapshot-missing symbol=undefined → null slot state)
  const walletBalance = balanceTable[payAsset] ?? null
  const preorderWalletBalance = balanceTable[effectivePreorderAsset] ?? null
  // Insufficient balance: balance known and input > balance; existing cap-type errors take display priority, single error row
  const balanceShort =
    walletBalance != null && Number.isFinite(numericAmount) && numericAmount > walletBalance
  const showBalanceShort =
    balanceShort && !preorderTabExceeded && !(mode === 'leverage' && leverageExceeded)
  const preorderBalanceShort =
    preorderWalletBalance != null &&
    Number.isFinite(numericPreorder) &&
    numericPreorder > preorderWalletBalance

  // Wired execution matrix (uAsset-direct + leverage-credit only; stake route and reserve
  // legs resolve no token addresses and stay disabled onchain).
  const payIsUAsset = payAsset !== '' && payAsset === raiseAssetSymbol
  const preorderPayIsUAsset = preorderRowAsset !== '' && preorderRowAsset === raiseAssetSymbol
  type WiredKind = 'genesis' | 'genesis-preorder' | 'preorder-only' | 'leverage' | 'leverage-preorder'
  const wiredKind: WiredKind | null =
    mode === 'leverage'
      ? !leverageReady
        ? null
        : preorderEnabled
          ? // Leveraged combined entry rides the router's leveragedGenesisAndPreorder: the
            // interest route mirrors the single-leg matrix (credit escrow / uAsset-direct)
            // and the preorder leg must be uAsset-paid (a Psm preorder leg stays unwired);
            // reserve legs resolve no pull token and stay disabled
            (effectiveRoute === 'credit' || (effectiveRoute === 'direct' && payIsUAsset)) &&
              preorderPayIsUAsset
              ? 'leverage-preorder'
              : null
          : // Two wired leverage routes mirror the two on-chain entries: credit escrow and
            // uAsset-direct interest; the reserve leg (direct route, non-uAsset pay) resolves
            // no pull token and stays disabled
            effectiveRoute === 'credit' || (effectiveRoute === 'direct' && payIsUAsset)
            ? 'leverage'
            : null
      : preorderOnly
        ? payIsUAsset
          ? 'preorder-only'
          : null
        : effectiveRoute === 'direct' && payIsUAsset
          ? preorderEnabled
            ? preorderPayIsUAsset
              ? 'genesis-preorder'
              : null
            : 'genesis'
          : null
  // Verse execution chain (vault-actions' convention: fixture governance ids are mainnet,
  // the current chainset runs the testnet twin); a wallet on another chain must switch,
  // otherwise every on-chain read targets a launcher without this verse (InvalidVerseId).
  const MAINNET_TO_TESTNET: Record<number, number> = { 1: 421614, 8453: 84532, 56: 97 }
  const execChain = MAINNET_TO_TESTNET[governanceChain] ?? governanceChain
  const wrongChain = center.source === 'real' && connected && center.chainId !== execChain
  const executionReady =
    center.source === 'real' &&
    connected &&
    center.chainSupported &&
    center.address != null &&
    verseId != null &&
    wiredKind !== null

  /** Provider-truth chain check fired before any on-chain read leaves the page: the cached
   *  chainId gate can lie (stale connector state), and the wrong-chain launcher reverts
   *  InvalidVerseId — ask the wallet live, flip the CTA to the network switch on mismatch. */
  async function ensureLiveChain(): Promise<boolean> {
    const provider = getActiveEip1193Provider()
    if (!provider) return false
    try {
      const live = (await provider.request({ method: 'eth_chainId' })) as string
      const ok = Number.parseInt(live, 16) === execChain
      setLiveWrongChain(!ok)
      return ok
    } catch {
      return false
    }
  }

  async function buildAndStart(): Promise<void> {
    if (!executionReady || resolving || wiredKind == null) return
    const provider = getActiveEip1193Provider()
    const eoa = center.address as Hex | null
    const chainId = center.chainId
    if (!provider || !eoa || chainId == null) return
    if (!(await ensureLiveChain())) return
    const resolved = getClientChainConfig(chainId)
    if (resolved.status !== 'ok' || resolved.config.contracts.status !== 'deployed') return
    const contracts = resolved.config.contracts.addresses
    const launcher = contracts.MemeverseLauncher as Hex
    const polend = contracts.POLend as Hex
    const router = contracts.OutrunRouter as Hex
    const kernel = resolved.config.kernel7702Implementation as Hex
    const hook = contracts.MemeverseUniswapHook as Hex
    setResolving(true)
    setResolveFailed(false)
    try {
      const client = createPublicClient({
        chain: resolved.config.viemChain,
        transport: custom({ request: provider.request }),
      })
      const reader: ContractReader = {
        read: (readParams) => client.readContract(readParams) as Promise<unknown>,
      }
      const verse = await readVerseAddresses(reader, launcher, BigInt(verseId))
      const uAsset = verse.uAsset
      const { decimals } = await readErc20Meta(reader, uAsset)
      const toBase = (display: number): bigint =>
        parseUnits(String(display), decimals)
      // Per-kind amounts (display → base units) and the pull legs behind the approval:
      // same-token legs arrive merged (one approve per token — ERC20 approve replaces, two
      // legs on one token must never emit two approves).
      let action
      let functionName: string
      let inputs: string
      let spender: Hex
      let pulls: { token: Hex; amount: bigint; display: string }[]
      if (wiredKind === 'genesis') {
        const amountBase = toBase(numericAmount)
        action = genesisCall(launcher, { verseId: BigInt(verseId), amountInUAsset: amountBase, user: eoa })
        functionName = 'genesis'
        inputs = `${formatUnits(amountBase, decimals)} ${raiseAssetSymbol}`
        spender = launcher
        pulls = [
          { token: uAsset, amount: amountBase, display: `${formatUnits(amountBase, decimals)} ${raiseAssetSymbol}` },
        ]
      } else if (wiredKind === 'genesis-preorder') {
        // Combined entry moved to the router (IOutrunRouter.genesisAndPreorder): both legs
        // draw the raise uAsset, so one merged uAsset pull approves the router for the total.
        const genesisBase = toBase(numericAmount)
        const preorderBase = toBase(numericPreorder)
        const totalBase = genesisBase + preorderBase
        action = genesisAndPreorderCall(router, {
          verseId: BigInt(verseId),
          genesis: fundUAssetInput(genesisBase),
          preorder: fundUAssetInput(preorderBase),
          user: eoa,
        })
        functionName = 'genesisAndPreorder'
        inputs = `${formatUnits(genesisBase, decimals)} + ${formatUnits(preorderBase, decimals)} ${raiseAssetSymbol}`
        spender = router
        pulls = [
          { token: uAsset, amount: totalBase, display: `${formatUnits(totalBase, decimals)} ${raiseAssetSymbol}` },
        ]
      } else if (wiredKind === 'preorder-only') {
        const preorderBase = toBase(preorderRowAmount)
        action = preorderCall(launcher, {
          verseId: BigInt(verseId),
          amountInUAsset: preorderBase,
          user: eoa,
        })
        functionName = 'preorder'
        inputs = `${formatUnits(preorderBase, decimals)} ${raiseAssetSymbol}`
        spender = launcher
        pulls = [
          { token: uAsset, amount: preorderBase, display: `${formatUnits(preorderBase, decimals)} ${raiseAssetSymbol}` },
        ]
      } else if (wiredKind === 'leverage-preorder') {
        // Router leveragedGenesisAndPreorder: the interest leg funds per route and the
        // preorder leg stays uAsset. Credit route pulls two tokens → two approve legs; the
        // uAsset-direct route merges into one pull like genesis-preorder.
        const preorderBase = toBase(numericPreorder)
        const preorderDisplay = `${formatUnits(preorderBase, decimals)} ${raiseAssetSymbol}`
        if (effectiveRoute === 'credit') {
          // Deployment tables key credits per family (GenesisCredit.<SYM>); a bare key exists
          // nowhere — fail visibly instead of handing undefined to readErc20Meta
          const credit = contracts[`GenesisCredit.${raiseAssetSymbol}`] as Hex | undefined
          if (!credit) throw new Error(`GenesisCredit.${raiseAssetSymbol} not deployed`)
          const { decimals: creditDecimals } = await readErc20Meta(reader, credit)
          const interestBase = parseUnits(String(numericAmount), creditDecimals)
          action = leveragedGenesisAndPreorderCall(router, {
            verseId: BigInt(verseId),
            genesis: fundCreditInput(interestBase),
            preorder: fundUAssetInput(preorderBase),
            user: eoa,
          })
          functionName = 'leveragedGenesisAndPreorder'
          inputs = `${formatUnits(interestBase, creditDecimals)} ${payAsset} + ${preorderDisplay}`
          spender = router
          pulls = [
            { token: credit, amount: interestBase, display: `${formatUnits(interestBase, creditDecimals)} ${payAsset}` },
            { token: uAsset, amount: preorderBase, display: preorderDisplay },
          ]
        } else {
          // uAsset-direct leverage interest: both legs pay the raise asset itself
          const interestBase = toBase(numericAmount)
          const totalBase = interestBase + preorderBase
          action = leveragedGenesisAndPreorderCall(router, {
            verseId: BigInt(verseId),
            genesis: fundUAssetInput(interestBase),
            preorder: fundUAssetInput(preorderBase),
            user: eoa,
          })
          functionName = 'leveragedGenesisAndPreorder'
          inputs = `${formatUnits(interestBase, decimals)} + ${preorderDisplay}`
          spender = router
          pulls = [
            { token: uAsset, amount: totalBase, display: `${formatUnits(totalBase, decimals)} ${raiseAssetSymbol}` },
          ]
        }
      } else {
        // Two on-chain leverage entries mirror the two wired routes (IPOLend): the credit
        // route escrows GenesisCredit via leveragedGenesisWithCredit; the uAsset-direct
        // route pulls uAsset interest via leveragedGenesis. Builder and pull token must
        // follow the route — approving a token the contract never pulls reverts the batch.
        if (effectiveRoute === 'credit') {
          // Deployment tables key credits per family (GenesisCredit.<SYM>); a bare key exists
          // nowhere — fail visibly instead of handing undefined to readErc20Meta
          const credit = contracts[`GenesisCredit.${raiseAssetSymbol}`] as Hex | undefined
          if (!credit) throw new Error(`GenesisCredit.${raiseAssetSymbol} not deployed`)
          const { decimals: creditDecimals } = await readErc20Meta(reader, credit)
          const interestBase = parseUnits(String(numericAmount), creditDecimals)
          action = leveragedGenesisWithCreditCall(polend, {
            verseId: BigInt(verseId),
            creditAmount: interestBase,
            user: eoa,
          })
          functionName = 'leveragedGenesisWithCredit'
          inputs = `${formatUnits(interestBase, creditDecimals)} ${payAsset}`
          spender = polend
          pulls = [
            { token: credit, amount: interestBase, display: `${formatUnits(interestBase, creditDecimals)} ${payAsset}` },
          ]
        } else {
          // uAsset-direct leverage: interest paid in the raise asset itself
          const interestBase = toBase(numericAmount)
          action = leveragedGenesisCall(polend, {
            verseId: BigInt(verseId),
            interestAmount: interestBase,
            user: eoa,
          })
          functionName = 'leveragedGenesis'
          inputs = `${formatUnits(interestBase, decimals)} ${payAsset}`
          spender = polend
          pulls = [
            { token: uAsset, amount: interestBase, display: `${formatUnits(interestBase, decimals)} ${payAsset}` },
          ]
        }
      }
      // Allowances are the only must-read-now reads on the click path; one per pull token.
      const approvalLegs: BatchExecution[] = []
      const approvalDisplays: string[] = []
      for (const leg of pulls) {
        const { allowance } = await readErc20State(reader, leg.token, eoa, spender)
        if (allowance < leg.amount) {
          approvalLegs.push(approvalCall(leg.token, spender, leg.amount))
          approvalDisplays.push(leg.display)
        }
      }
      const { calls, calldata: batch } = buildSessionWrite({
        hook,
        action,
        ...(approvalLegs.length === 1 ? { approval: approvalLegs[0] } : {}),
        ...(approvalLegs.length > 1 ? { approvals: approvalLegs } : {}),
      })
      let estimatedGas = '—'
      let nativeBalance = '—'
      try {
        const [gas, balance] = await Promise.all([
          client.estimateGas({ account: eoa, to: eoa, data: batch }),
          client.getBalance({ address: eoa }),
        ])
        estimatedGas = gas.toString()
        nativeBalance = formatUnits(balance, 18)
      } catch {
        const balance = await client.getBalance({ address: eoa })
        nativeBalance = formatUnits(balance, 18)
      }
      const spec: WriteSpec = {
        review: {
          chainId,
          account: eoa,
          // Combined entrypoints live on the router; single-leg genesis/preorder stay on
          // the launcher and single-leg leverage on POLend.
          targetContract:
            wiredKind === 'leverage'
              ? polend
              : wiredKind === 'genesis' || wiredKind === 'preorder-only'
                ? launcher
                : router,
          functionName,
          inputs,
          minOutput: '—',
          fee: '—',
          gasPayer: eoa,
          // Lists exactly the approvals the batch executes — a pull leg already covered by
          // its allowance is not an authorization change.
          authorizationChange: approvalDisplays.length > 0 ? approvalDisplays.join(' + ') : '—',
          estimatedGas,
          nativeBalance,
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
      }
      // Review-less execution (user ruling 2026-10-23: the dialog IS the review — no
      // second station panel; the wallet popup follows immediately).
      void tx.executeSession(spec)
    } catch {
      setResolveFailed(true)
    } finally {
      setResolving(false)
    }
  }

  /** Balance/Max row (same structure as swap-panel; token symbol not repeated, shown by the adjacent Pay with;
   *  snapshot missing=-- + Max disabled) */
  function balanceRow(balance: number | null, onMax: () => void) {
    return (
      <span className="swap-panel__balance">
        {copy.verseDesk.balance}:{' '}
        {balance != null ? <span data-numeric>{formatAmount(balance, locale)}</span> : '--'}
        <button
          type="button"
          className="swap-panel__max"
          disabled={balance == null || balance <= 0}
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
        {balanceRow(walletBalance, () => {
          setAmount(amountToInputString(walletBalance ?? 0))
          resetReview()
        })}
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
            `${formatAmount(versePreorderRemaining, locale)} ${raiseAssetSymbol}`,
          )}
        </FieldError>
      ) : null}
      {preorderOnly && versePreorderRemaining != null ? (
        <FieldDescription>
          {copy.verse.preorderHeadroom}{' '}
          <b data-numeric>
            {formatAmount(versePreorderRemaining, locale)} {raiseAssetSymbol}
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
            {formatAmount(leverageQuota, locale)} {raiseAssetSymbol}
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

  // Review runs in a small popup over the intact form (2026-10-21 round 6: the inline card
  // read too empty; dialog body below). Single stage: figure summary, then the wallet
  // popup directly (2026-10-23 ruling: TxReviewPanel station deleted — no double review).
  const reviewMetaParts = [modeLabel, `${copy.verse.payAsset} ${payAsset}`]

  return (
    <form
      className="participation-form"
      autoComplete="off"
      onSubmit={(event) => {
        event.preventDefault()
        if (
          numericAmount <= 0 ||
          balanceShort ||
          (mode === 'leverage' && (!leverageReady || leverageExceeded)) ||
          (preorderOnly && (versePreorderRemaining == null || preorderTabExceeded)) ||
          (!preorderOnly &&
            preorderEnabled &&
            (numericPreorder <= 0 || preorderExceeded || preorderBalanceShort))
        ) {
          setInvalid(true)
          return
        }
        // Live chain check at dialog-open time: a stale cached chainId must not open a
        // review dialog that can only fail — the form CTA flips to the network switch.
        void ensureLiveChain().then((ok) => {
          if (ok) setReviewing(true)
        })
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
                // Mode-scoped inputs are cleared on switch (user ruling 2026-10-23): the shared
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
                amount={preorderRaised}
                threshold={versePreorderCap}
                unit={raiseAssetSymbol}
                locale={locale}
              />
              <FieldDescription>{copy.verse.preorderCapacityNote}</FieldDescription>
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
                  <Field data-invalid={preorderInvalid || preorderExceeded || preorderBalanceShort ? true : undefined}>
                    <div className="participation-field-head">
                      <FieldLabel htmlFor="preorder-amount">{copy.verse.preorderAmountLabel}</FieldLabel>
                      {balanceRow(preorderWalletBalance, () => {
                        setPreorderAmount(amountToInputString(preorderWalletBalance ?? 0))
                        resetReview()
                      })}
                    </div>
                  <Input
                    id="preorder-amount"
                    name="preorder-amount"
                    className="numeric-input"
                    inputMode="decimal"
                    autoComplete="off"
                    value={preorderAmount}
                    maxLength={AMOUNT_MAX_CHARS}
                    aria-invalid={preorderInvalid || preorderExceeded || preorderBalanceShort ? true : undefined}
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
                        `${formatAmount(preorderCap, locale)} ${raiseAssetSymbol}`,
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
      {/* Wrong chain never reaches the review dialog: the form CTA itself becomes the
          network switch (user ruling 2026-10-22) — participation runs on the verse's chain. */}
      {wrongChain || liveWrongChain ? (
        <SwitchChainCta
          locale={locale}
          execChain={execChain}
          chainName={governanceChainName}
          onSwitch={switchChain}
          onSwitched={() => void ensureLiveChain()}
          className="ax-ghost-cta"
          size="lg"
        />
      ) : (
        <Button
          type="submit"
          className="ax-ghost-cta"
          size="lg"
          disabled={(mode === 'leverage' && !leverageReady) || (preorderOnly && versePreorderRemaining == null)}
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
          <ActionDialogShell title={copy.verse.reviewTitle} closeLabel={copy.common.close}>
            <div className="participation-review participation-review--dialog" aria-live="polite">
              <p className="participation-review__meta">{reviewMetaParts.join(' · ')}</p>
              {tx.display === 'idle' ? (
                <>
                  {genesisRow ? (
                    <section
                      className="participation-review__group participation-review__group--genesis"
                      aria-label={copy.verse.genesisGroupTitle}
                    >
                      <h4 className="participation-review__group-label">
                        {copy.verse.genesisGroupTitle}
                      </h4>
                      <div className="participation-review__rows">
                        <div className="participation-review__row participation-review__row--genesis">
                          <span>{genesisRow.label}</span>
                          <span data-numeric>
                            {formatAmount(genesisRow.amount, locale)} {raiseAssetSymbol}
                          </span>
                        </div>
                        {reserveFee != null && numericAmount > 0 ? (
                          <div className="participation-review__row participation-review__row--genesis">
                            <span>{copy.verse.conversionFee}</span>
                            <span data-numeric>
                              {formatPercent(reserveFee * 100, locale)}% ·{' '}
                              {formatAmount(numericAmount * reserveFee, locale)} {payAsset}
                            </span>
                          </div>
                        ) : null}
                        {preorderEnabled ? (
                          <div className="participation-review__row participation-review__row--genesis">
                            <span>{copy.verse.preorderAmountLabel}</span>
                            <span data-numeric>
                              {formatAmount(netPreorderAmount, locale)} {raiseAssetSymbol}
                            </span>
                          </div>
                        ) : null}
                        {preorderFee != null && numericPreorder > 0 ? (
                          <div className="participation-review__row participation-review__row--genesis">
                            <span>{copy.verse.conversionFee}</span>
                            <span data-numeric>
                              {formatPercent(preorderFee * 100, locale)}% ·{' '}
                              {formatAmount(numericPreorder * preorderFee, locale)} {effectivePreorderAsset}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </section>
                  ) : null}
                  <section
                    className="participation-review__group participation-review__group--pay"
                    aria-label={copy.verse.payGroupTitle}
                  >
                    <h4 className="participation-review__group-label">{copy.verse.payGroupTitle}</h4>
                    <div className="participation-review__rows">
                      <div className="participation-review__row participation-review__row--pay">
                        <span>{payHeroLabel}</span>
                        <span data-numeric>
                          {formatAmount(payHeroAmount, locale)} {payRows[0].asset}
                        </span>
                      </div>
                      {preorderOnly && preorderFee != null && numericAmount > 0 ? (
                        <div className="participation-review__row participation-review__row--pay">
                          <span>{copy.verse.conversionFee}</span>
                          <span data-numeric>
                            {formatPercent(preorderFee * 100, locale)}% ·{' '}
                            {formatAmount(numericAmount * preorderFee, locale)} {preorderRowAsset}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </section>
                  <SourceRef value={sourceRef} />
                  <div className="participation-review__actions">
                    <Button variant="outline" onClick={resetReview}>
                      <RotateCcw data-icon="inline-start" aria-hidden="true" />
                      {copy.verse.revise}
                    </Button>
                    <Button
                      className="ax-ghost-cta"
                      disabled={
                        resolving ||
                        tx.running ||
                        liveWrongChain ||
                        (center.source === 'real' && !executionReady)
                      }
                      onClick={() => void buildAndStart()}
                    >
                      {copy.verse.confirmPrototype}
                    </Button>
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
                  {payHeroAmount != null && payRows[0] ? (
                    <div className="participation-review__row participation-review__row--pay tx-success__paid">
                      <span>{payHeroLabel}</span>
                      <span data-numeric>
                        {formatAmount(payHeroAmount, locale)} {payRows[0].asset}
                      </span>
                    </div>
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
            </div>
          </ActionDialogShell>
        </Dialog>
      ) : null}
    </form>
  )
}

'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { ArrowDown, ArrowLeftRight, ArrowUpDown, ChevronLeft } from 'lucide-react'
import { formatUnits, type Hex } from 'viem'
import { toBaseUnits } from '@/lib/web3/base-units'

import type {
  Locale,
  PolPosition,
} from '@/lib/data/fixture-repository'
import { buildSessionWrite } from '@/lib/web3/session-actions'

import { getCopy } from '../global/copy'
import { useAccountCenter } from '../global/use-account-center'
import { useTxCenter, useClearOnConfirmed, type WriteSpec } from '../global/use-tx-center'
import { TxProgressDialog } from '../global/tx-progress-dialog'
import { TxSuccessDialog } from '../global/tx-success-dialog'
import { useTxSuccessGate } from '../global/use-tx-success'
import { formatAmount, formatPercent } from '../global/signal-ui'
import { readAllowances } from '../global/execution-reads'
import { ActionDialogShell, DialogCta } from '../global/action-dialogs'
import { GasEditor, GasSummaryRow } from '../global/gas-setting'
import { useGasQuote, type GasOverride } from '../global/use-gas-quote'
import {
  AMOUNT_MAX_CHARS,
  amountToInputString,
  evaluateAmountBalance,
  sanitizeAmount,
  trimFractionZeros,
} from '../global/amount-input'
import { parseVerseIdParam } from '../global/routes'
import { useVerseExecChain } from '../global/switch-chain-cta'
import { fmtTokenAmount, fmtTokenAmountExact, fmtUsd } from '../global/amount-format'
import { getSlippageIssue, slippageToNumber } from '../global/slippage-input'
import { SwapSettings } from '../global/swap-settings'
import { Dialog } from '@/components/ui/dialog'
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SwapTokenSelectDialog, type SwapTokenOption } from './swap-token-select-dialog'
import { buildSwapPlan, swapApprovalLegs, swapFeeBps } from './swap-plan'
import { cardAmountValid } from './swap-amount'
import {
  cardOutOf,
  impactTone,
  minOutOf,
  priceImpactOf,
  quoteForContext,
  resolveSwapQuoteContext,
  spotReferenceOf,
  toDisplay,
  useSwapLiveQuote,
  type MemeTokenId,
} from './swap-live-quote'
import { useTradeBalances } from './trade-balances'

/** One formatted swap leg — the amount is 6-dp display tier, the symbol rides the ticker face */
type SwapLeg = { amount: string; symbol: string }

/** What the confirm dialog freezes at click time — the success screen re-reads these, never
 *  the (already cleared) form. Price impact stays off the dialog: danger
 *  is already blocked at the CTA gate, warning lives on the card's details rows. */
type SwapSnapshot = {
  pay: SwapLeg
  receive: SwapLeg
  minReceived: SwapLeg
  feePercent: string
}

function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)
}

/**
 * Standard Swap panel: the top-right settings button holds slippage/deadline;
 * the details rows keep only rate/price impact/min received/swap fee; no static explainer copy.
 * Quote layer: the executable legs (uAsset↔memecoin/POL/PT) quote live through the wallet
 * provider (`quoteSwap`), so output/min-received/price-impact are the values execution will
 * see; while
 * the quote for the current input is pending the output slot shows the pending spinner — the
 * linear reference conversion never stands in for a quote (market convention, Uniswap-style);
 * disconnected/fixture states and failed reads keep the SSR reference conversion (onchain
 * builds render real market prices, fixture builds the e2e samples). CTA is a state machine — the button itself
 * states why it cannot fire. Confirm flow mirrors the participation review dialog: click
 * resolves everything the dialog paints (quote freshness, allowance, embedded gas estimate),
 * then one ActionDialogShell walks review → three-step status → swap-complete (the 7702
 * session batch folds the exact-amount approval into the signed bundle, so no approval row).
 * The input/output side tokens open a select dialog: stable side=
 * uAsset + its PSM-paired reserves
 * (par 1:1), Meme side=memecoin/POL/PT — each meme leg swaps its own pool (memecoin↔uAsset
 * primary; POL↔uAsset and PT↔uAsset auxiliary, four-pools.md); reserve legs have no verse
 * pool (the PSM par channel is their exit) and stay listed but disabled with the reason on
 * the row (onchain builds only). YT stays off the card: Flash Swap is a single
 * POL↔YT channel tool (both buy and sell specify the YT amount), living in the Tokenization
 * page's YT-well dedicated dialog PolFlashSwapDialog.
 */
export function SwapPanel({
  locale,
  memecoinSymbol,
  memecoinName,
  uAssetSymbol,
  price,
  uAssetUsd,
  memecoinBalance,
  uAssetBalance,
  reserves,
  reserveBalance,
  pol,
  governanceChain,
  governanceChainName,
}: {
  locale: Locale
  /** The verse's memecoin ticker */
  memecoinSymbol: string
  /** Token full name (verse.name fixture) — secondary text of the select dialog row */
  memecoinName: string
  /** The verse's raise uAsset; null = unresolved from the deployment tables — the uAsset
   *  option stays listed but unpickable (unavailable) and every symbol-keyed lookup fails
   *  closed instead of borrowing a deployed family's contracts */
  uAssetSymbol: string | null
  /** Main-pool price: 1 Memecoin = price uAsset (onchain builds: real candles; fixture: sample) */
  price: number
  /** uAsset USD price (onchain builds: PSM par / Chainlink feed; null=hide the USD conversion row) */
  uAssetUsd: number | null
  /** Account memecoin/uAsset balance (SSR samples; onchain personal values are client-side probes; null=slot --) */
  memecoinBalance: number | null
  uAssetBalance: number | null
  /** Reserves payable on the PSM par channel (getParticipationOptions export). `id` is the
   *  reserve token address on deployed builds (the onchain adapter keys assets by address);
   *  `name` is the token's own name, falling back to its symbol. */
  reserves: { id: string; symbol: string; name?: string; decimals?: number }[]
  /** Reserve wallet balance (probe value on onchain builds; null=slot '--') */
  reserveBalance: number | null
  /** POL/PT pool price and balance sample (null=quote/balance slot state) */
  pol: PolPosition | null
  /** Verse governance chain + display name (execution-chain gate; SwitchChainCta target) */
  governanceChain: number
  governanceChainName: string
}) {
  const copy = getCopy(locale).verseDesk
  const common = getCopy(locale).common
  const verseCopy = getCopy(locale).verse
  const center = useAccountCenter()
  const { connected, connectAction: toggle } = center
  const { execChain, wrongChain, switchChain } = useVerseExecChain(governanceChain)
  const tx = useTxCenter()
  // Confirmed → receipt gate: the success dialog is the flow's last dialog, stacked over
  // the confirm dialog (whose body stays in review form underneath).
  const { successOpen, setSuccessOpen, receipt } = useTxSuccessGate(tx)
  const params = useParams()
  const rawVerseId = params?.verseId
  const verseId = parseVerseIdParam(rawVerseId)
  const [resolving, setResolving] = useState(false)
  const [resolveFailed, setResolveFailed] = useState(false)
  const [direction, setDirection] = useState<'stable-to-meme' | 'meme-to-stable'>('stable-to-meme')
  const buyLabelId = useId()
  // Symbol alias for string-typed consumers; '' when unresolved (never a known-symbol guess)
  const uAssetLabel = uAssetSymbol ?? ''
  const [stableId, setStableId] = useState(uAssetLabel)
  const [memeId, setMemeId] = useState<MemeTokenId>('meme')
  // Opens with empty input (amount input defaults to empty 0.00, not prefilled with balance);
  // flip/token change preserves input
  const [amount, setAmount] = useState('')
  // The settings-layer controlled value is stored as a string and shown verbatim
  // (keep the trailing dot instead of swallowing it, inline error for non-whole minutes),
  // numeric derivation goes through slippageToNumber
  const [slippageText, setSlippageText] = useState('0.5')
  const [deadlineText, setDeadlineText] = useState('10')
  const [rateInverted, setRateInverted] = useState(false)
  useClearOnConfirmed(tx.display, () => setAmount(''))

  // Confirm dialog (review → three-step status → swap complete), participation-review shaped
  const [confirming, setConfirming] = useState(false)
  const [pendingSpec, setPendingSpec] = useState<WriteSpec | null>(null)
  const [gasOverride, setGasOverride] = useState<GasOverride | null>(null)
  const [gasEditing, setGasEditing] = useState(false)
  const [snapshot, setSnapshot] = useState<SwapSnapshot | null>(null)

  // Wallet-provider balance probe (onchain builds): fills the supply-side Balance rows the SSR
  // leaves slotted — accountless server payload, personal values client-side only. Fixture
  // builds keep the SSR samples (probe returns null). Re-reads when a swap confirms here.
  const [settleTick, setSettleTick] = useState(0)
  const prevDisplayRef = useRef<string | null>(null)
  useEffect(() => {
    if (tx.display === 'confirmed' && prevDisplayRef.current !== 'confirmed') {
      setSettleTick((tick) => tick + 1)
    }
    prevDisplayRef.current = tx.display
  }, [tx.display])
  const walletBalances = useTradeBalances({
    verseId,
    uAssetSymbol: uAssetSymbol ?? undefined,
    governanceChain,
    refreshKey: settleTick,
  })
  const displayMemecoinBalance = walletBalances?.memecoin ?? memecoinBalance
  const displayUAssetBalance = walletBalances?.uAsset ?? uAssetBalance
  const displayReserveBalance = walletBalances?.reserve ?? reserveBalance
  const displayPolBalance = walletBalances?.pol ?? pol?.myPol ?? null
  const displayPtBalance = walletBalances?.pt ?? pol?.myPt ?? null
  // Exact wallet reads win over the float aliases whenever the probe landed (float64 can
  // round a real balance upward — a Max prefill re-parsed from it would trip the gate);
  // non-executable legs (reserves on real builds) carry no exact read.
  const exactMemecoin = walletBalances?.exact.memecoin ?? null
  const exactUAsset = walletBalances?.exact.uAsset ?? null

  // Stable-side candidates: raise uAsset + PSM-paired reserves. Every reserve listed here is
  // routable on real builds (the PSM bridges it to the verse uAsset in the same batch), so no
  // row is disabled for lack of a route; a build without the PSM pair simply lists none.
  const realMode = center.source === 'real'
  const reserveId = (reserve: { id: string; symbol: string }): string =>
    reserve.id.startsWith('0x') ? reserve.id : reserve.symbol
  const stableOptions: SwapTokenOption[] = [
    {
      id: uAssetLabel,
      symbol: uAssetLabel,
      name: copy.mintSideUasset,
      balance: displayUAssetBalance,
      exact: exactUAsset,
      // Unresolved raise asset: listed but unpickable (no deployment-table contracts behind it)
      unavailable: uAssetSymbol == null ? true : undefined,
    },
    ...reserves.map((reserve) => ({
      id: reserveId(reserve),
      symbol: reserve.symbol,
      name: reserve.name ?? reserve.symbol,
      balance: displayReserveBalance,
      exact: walletBalances?.exact.reserve ?? null,
    })),
  ]
  // uAsset price per 1 token: reserves=par 1; POL=POL/uAsset pool price (fixture sample);
  // PT=PT/POL pool price×POL pool price
  // (YT not on this card; its implied price lives in pol-flash-swap-dialog)
  const polSymbol = `POL-${memecoinSymbol}`
  const ptSymbol = `PT-${memecoinSymbol}`
  const polPrice = pol ? pol.marketPricePerPol : null
  const memeOptions: SwapTokenOption[] = [
    {
      id: 'meme',
      symbol: memecoinSymbol,
      name: memecoinName,
      balance: displayMemecoinBalance,
      exact: exactMemecoin,
    },
    {
      id: 'pol',
      symbol: polSymbol,
      name: copy.polTag,
      balance: displayPolBalance,
      exact: walletBalances?.exact.pol ?? null,
    },
    {
      id: 'pt',
      symbol: ptSymbol,
      name: copy.ptFullName,
      balance: displayPtBalance,
      exact: walletBalances?.exact.pt ?? null,
    },
  ]
  const priceInUAsset = new Map<string, number | null>([
    [uAssetLabel, 1],
    ...reserves.map((reserve) => [reserveId(reserve), 1] as const),
    ['meme', price > 0 ? price : null],
    ['pol', polPrice],
    ['pt', pol != null && polPrice != null && pol.ptPricePerPol != null ? polPrice * pol.ptPricePerPol : null],
  ])

  const stableSide = stableOptions.find((token) => token.id === stableId) ?? stableOptions[0]
  const memeSide = memeOptions.find((token) => token.id === memeId) ?? memeOptions[0]
  const sellToken = direction === 'stable-to-meme' ? stableSide : memeSide
  const buyToken = direction === 'stable-to-meme' ? memeSide : stableSide
  const sellBalance = sellToken.balance
  const buyBalance = buyToken.balance
  const sellExact = sellToken.exact ?? null
  // The selling leg's Asset decimals when that side is a PSM reserve (undefined on the
  // protocol legs, which are 18-dec by deployment — swap-amount.ts owns the fallback).
  const sellReserveDecimals = reserves.find(
    (reserve) => reserveId(reserve) === sellToken.id,
  )?.decimals
  // Reference conversion (linear via both sides' reference prices) — the display fallback for
  // states without a live quote (disconnected / fixture / probe failure); execution always
  // quotes on-chain.
  const parsed = Number(amount)
  // Never float-only: sub-unit dust stays invalid, or the quote layer resolves the request to
  // no context and the card strands on its pending spinner.
  const valid = cardAmountValid(amount, {
    exactDecimals: sellExact?.decimals ?? null,
    reserveDecimals: sellReserveDecimals,
  })
  // Shared balance gate (amount-input.ts, the family single source): the exact read wins,
  // the float sample is the fallback, and an unknown balance (probe in flight or failed)
  // fails closed — an unread balance must never arm the CTA. The `valid &&` conjunction is
  // display-layer only: a float sample's dust corner must not paint the insufficient-balance
  // error on an amount that is already invalid at its decimals.
  const amountGate = evaluateAmountBalance(amount, sellBalance, sellExact)
  const overBalance = valid && amountGate.overBalance
  const sellPrice = priceInUAsset.get(sellToken.id) ?? null
  const buyPrice = priceInUAsset.get(buyToken.id) ?? null
  const pairRate =
    sellPrice != null && buyPrice != null && buyPrice > 0 ? sellPrice / buyPrice : null
  const referenceQuote = valid && pairRate != null ? parsed * pairRate : null
  // While slippage is out of bounds, no (1−s/100) derivation (s>100 yields negative tokens);
  // min received/max slippage rows fall back to slots
  const slippage = slippageToNumber(slippageText)
  const slippageIssue = getSlippageIssue(slippage)
  const slippageBps = Math.round(slippage * 100)
  const referenceMinReceived =
    referenceQuote != null && slippageIssue == null ? referenceQuote * (1 - slippage / 100) : null
  // Onchain execution. Every listed pair is routable: uAsset↔meme directly, a reserve↔meme
  // through the PSM in the same batch. Everything resolves through the wallet provider: verse
  // registry → pool key → quote → allowance → session batch. No page prop threading: verseId
  // comes from the route.
  const verseIdValid = verseId != null
  const pairExecutable = !stableSide.unavailable && !memeSide.unavailable
  // A reserve selection keeps the pool leg on memecoin↔uAsset and bridges the difference
  // through the PSM; the quote layer needs to know which side it is pricing.
  const stableIsReserve = stableOptions.slice(1).some((token) => token.id === stableSide.id)
  const stableToken = stableIsReserve
    ? ({ kind: 'reserve', address: stableSide.id as Hex } as const)
    : ({ kind: 'uasset' } as const)
  const executionReady =
    realMode &&
    connected &&
    center.chainSupported &&
    !wrongChain &&
    center.chainId != null &&
    center.address != null &&
    verseIdValid &&
    pairExecutable
  const live = useSwapLiveQuote({
    // A dust amount has no request to quote (the context resolves to null): disarming keeps
    // the card off its pending spinner and stops the 10s retry loop for a request that can
    // never succeed.
    active: executionReady && valid,
    eoa: center.address as Hex | null,
    chainId: center.chainId,
    verseId,
    direction,
    memeTokenId: memeId,
    uAssetSymbol,
    stableToken,
    amount,
  })
  // Live-quote display halves: the values execution will see. A quote only answers its own
  // request — during the debounce window the latest quote still describes the previous amount.
  // In the live pipeline that gap is a pending state (spinner slot + fetching CTA), never the
  // linear reference conversion: spot price × input can sit orders of magnitude off a deep
  // route's real fill, and echoing it as the output fabricates a quote. The reference
  // conversion prices only the states the live pipeline cannot reach — fixture/disconnected,
  // and live reads that failed.
  const liveQuote = live.value
  const liveUsable = executionReady && liveQuote != null && liveQuote.amount === amount
  const quotePending = executionReady && valid && !liveUsable && !live.failed
  const referenceUsable = !executionReady || live.failed
  const liveOutDisplay = liveUsable && liveQuote ? cardOutOf(liveQuote) : null
  const displayOut = liveOutDisplay ?? (referenceUsable ? referenceQuote : null)
  // The buy side floors on the CARD's output token; a reserve leg's output decimals differ
  // from the pool leg's, so the quote carries both.
  const cardOutDecimals = liveQuote?.cardDecimalsOut ?? liveQuote?.decimalsOut ?? 18
  const liveMinReceived =
    liveUsable && liveQuote && slippageIssue == null
      ? `${fmtTokenAmount(toDisplay(minOutOf(liveQuote.out, slippageBps), cardOutDecimals), locale)} ${buyToken.symbol}`
      : null
  const minReceivedText =
    slippageIssue == null
      ? (liveMinReceived ??
        (referenceUsable && referenceMinReceived != null
          ? `${fmtTokenAmount(referenceMinReceived, locale)} ${buyToken.symbol}`
          : null))
      : null
  // Impact measures the executable quote against the pool spot captured in the SAME quote
  // pass — never against the page-load reference conversion, whose drift since page load
  // would masquerade as impact. The reference is the spot × input (per-unit spot × total in
  // = total reference); the quote's own fee is subtracted (fee keeps its own row); without a
  // live quote or an unreadable spot there is nothing honest to print.
  const impact =
    liveUsable && liveQuote != null && liveOutDisplay != null
      ? priceImpactOf(spotReferenceOf(liveQuote.spotOutPerIn, Number(liveQuote.amount)), liveOutDisplay, liveQuote.feeBps)
      : null
  const impactToneNow = impactTone(impact)
  // Uniswap's readout: fixed two decimals, and a positive impact that rounds to 0.00 shows
  // "<0.01%" instead of a bare zero — the row must never read as "no measurement".
  let impactText: string | null = null
  if (impact != null) {
    impactText = formatPercent(impact * 100, locale, 2)
    if (impact > 0 && impactText === '0.00') impactText = '<0.01'
  }
  // Fee rate = one row for the whole transaction, as a percentage of the card's input token.
  // The router fee comes from the same quoteSwap preview execution runs; on a reserve leg the
  // PSM face-value fee rides along (already converted by the quote layer). Without a live quote
  // there is no honest rate to print (dynamic fee → '--' slot).
  const feeBpsTotal =
    liveUsable && liveQuote != null
      ? swapFeeBps({ quote: liveQuote, cardInBase: toBaseUnits(amount, liveQuote.cardDecimalsIn) })
      : null
  const swapFeeText =
    feeBpsTotal != null ? `${formatPercent(feeBpsTotal / 100, locale, 2)}%` : null

  async function startSwap(): Promise<void> {
    if (!executionReady || !valid || amountGate.blocked || slippageIssue != null || resolving) return
    const eoa = center.address as Hex | null
    const chainId = center.chainId
    if (!eoa || chainId == null || verseId == null) return
    setResolving(true)
    setResolveFailed(false)
    try {
      // Static halves (session, pool key, decimals, PT address) come from the shared caches
      // the live quote layer warmed; the click adds only the allowance read beside a
      // cache-checked quote refresh, both in parallel.
      const ctx = await resolveSwapQuoteContext({
        eoa,
        chainId,
        verseId,
        direction,
        memeTokenId: memeId,
        uAssetSymbol,
        stableToken,
        amount,
      })
      if (!ctx) {
        setResolveFailed(true)
        setResolving(false)
        return
      }
      // Three execution shapes share one quote pipeline:
      //  - uAsset leg: approve the pool input, swap exact-in.
      //  - reserve buy (reserve → mint uAsset → memecoin): approve the reserve to the PSM, mint
      //    (deterministic par output), approve that exact uAsset to the router, then the same
      //    exact-in swap inside the session window.
      //  - reserve sell (memecoin → uAsset → redeem): the router's swapExactInToReserve does
      //    both legs in one call, so the batch is one approval plus one router action.
      const reserve = ctx.reserve
      const isBuy = reserve != null && ctx.tokenIn === reserve.uAsset
      const [quote, allowances] = await Promise.all([
        quoteForContext(ctx, eoa),
        readAllowances(ctx.reader, eoa, swapApprovalLegs(ctx)),
      ])
      const minOut = minOutOf(quote.out, slippageBps)
      const deadlineSecs = BigInt(
        Math.floor(Date.now() / 1000) + (Number(deadlineText) || 10) * 60,
      )
      const plan = buildSwapPlan({
        ctx,
        minOut,
        minUAssetOut:
          reserve != null && !isBuy && quote.psm != null
            ? minOutOf(quote.psm.uAssetAmount, slippageBps)
            : 0n,
        amountIn: ctx.amountIn,
        uAssetIn: quote.psm?.uAssetAmount ?? 0n,
        deadline: deadlineSecs,
        eoa,
        allowances,
      })
      const { calls, calldata: batch } = buildSessionWrite({
        hook: ctx.hook,
        action: plan.action,
        ...(plan.approvals.length === 1 ? { approval: plan.approvals[0] } : {}),
        ...(plan.approvals.length > 1 ? { approvals: plan.approvals } : {}),
        ...(plan.preActions.length > 0 ? { preActions: plan.preActions } : {}),
        swapSession: true,
      })
      const spec: WriteSpec = {
        review: {
          chainId,
          account: eoa,
          targetContract: plan.target,
          functionName: plan.functionName,
          inputs: `${formatUnits(ctx.amountIn, ctx.cardDecimalsIn)} ${sellToken.symbol}`,
          minOutput: `${formatUnits(minOut, ctx.cardDecimalsOut)} ${buyToken.symbol}`,
          fee: `${formatPercent(swapFeeBps({ quote, cardInBase: ctx.amountIn }) / 100, locale, 2)}%`,
          gasPayer: eoa,
          // The 7702 session batch folds the exact-amount approval into the signed bundle —
          // no separate approval step exists to surface.
          authorizationChange: '—',
          estimatedGas: '—',
          nativeBalance: '—',
        },
        kernel: ctx.kernel,
        expectedChainId: chainId,
        batchCallData: batch,
        calls,
        quoteId: quote.key,
        minOutput: minOut.toString(),
        slippageBps,
        deadline: Number(deadlineSecs),
        manifestVersion: ctx.manifestVersion,
        crossChain: false,
        writeScope: { kind: 'verse', chainId, verseId },
      }
      const legOf = (raw: bigint, decimals: number, symbol: string): SwapLeg => ({
        amount: fmtTokenAmount(toDisplay(raw, decimals), locale),
        symbol,
      })
      setSnapshot({
        pay: legOf(ctx.amountIn, ctx.cardDecimalsIn, sellToken.symbol),
        receive: legOf(quote.out, ctx.cardDecimalsOut, buyToken.symbol),
        minReceived: legOf(minOut, ctx.cardDecimalsOut, buyToken.symbol),
        feePercent: `${formatPercent(swapFeeBps({ quote, cardInBase: ctx.amountIn }) / 100, locale, 2)}%`,
      })
      setPendingSpec(spec)
      // `resolving` stays held until the dialog opens (the open effect below releases it)
    } catch (error) {
      // Dev-only: the UI collapses every prepare failure into one generic line.
      if (process.env.NODE_ENV !== 'production') {
        console.error('[swap] prepare failed', error)
      }
      setResolveFailed(true)
      setResolving(false)
    }
  }

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
  // embedded wallet, its fee quote (external wallets price in their own prompt, so they do
  // not wait). Opening earlier pops the Network Fee row into an already rendered card.
  useEffect(() => {
    if (confirming || pendingSpec == null) return
    const open = () => {
      setResolving(false)
      setConfirming(true)
    }
    if (gasQuote.wallet === 'external' || gasQuote.settled) {
      open()
      return
    }
    // A quote that never settles must not strand the click: the wallet prices itself when the
    // dApp passes no fee, so the row is optional and the dialog still opens.
    const id = setTimeout(open, 4000)
    return () => clearTimeout(id)
  }, [confirming, pendingSpec, gasQuote.wallet, gasQuote.settled])

  function closeConfirm(): void {
    // While a signature/broadcast is in flight the dialog is the only progress surface —
    // it stays until the flow settles.
    if (tx.running) return
    tx.reset()
    setConfirming(false)
    setPendingSpec(null)
    setSnapshot(null)
    setGasEditing(false)
  }

  function leaveGasView(): void {
    // Leaving the gas view never strands an invalid custom price: fall back to the market
    // preset so Confirm cannot sit disabled behind the other view.
    if (gasQuote.invalid) gasQuote.select('market')
    setGasEditing(false)
  }

  // USD conversion: each side's uAsset price × uAssetUsd (reserves borrow the PSM
  // par-equivalent uAsset price). The pool-side price rides the quote's own spot read —
  // same pass as the output — so pool drift since page load cannot masquerade as gain or
  // loss in the echo (spotOutPerIn is the pool leg's out-per-in: the meme-side price when
  // selling, its reciprocal when buying). Reference states (no live quote) keep the page
  // snapshot on both halves — the reference conversion already prices both sides with it —
  // and a live output with an unreadable spot echoes no pool-side USD row.
  // display formatting goes through global/amount-format (fmtUsd/fmtTokenAmount) — raw float
  // products carry precision noise
  const livePoolPrice =
    liveUsable && liveQuote != null && liveQuote.spotOutPerIn != null && liveQuote.spotOutPerIn > 0
      ? direction === 'stable-to-meme'
        ? 1 / liveQuote.spotOutPerIn
        : liveQuote.spotOutPerIn
      : null
  const sellEchoPrice =
    direction === 'meme-to-stable' ? (liveUsable ? livePoolPrice : sellPrice) : sellPrice
  const buyEchoPrice =
    direction === 'stable-to-meme' ? (liveUsable ? livePoolPrice : buyPrice) : buyPrice
  const sellUsd =
    uAssetUsd == null || !valid || sellEchoPrice == null
      ? null
      : fmtUsd(parsed * sellEchoPrice * uAssetUsd, locale)
  const buyUsd =
    uAssetUsd == null || displayOut == null || buyEchoPrice == null
      ? null
      : fmtUsd(displayOut * buyEchoPrice * uAssetUsd, locale)
  // Rate row: the executable quote's own price (received ÷ input — fee and impact included,
  // recomputed as quotes move); the reference pair prices only the no-quote states. Either
  // side unknown → '--' slot. The input-side token sits on the left by default (1 sell ≈ N
  // buy — follows the direction flip); reversible via the flip button. No route row:
  // execution paths are this verse's own pools.
  const executionRate = liveUsable && liveOutDisplay != null && valid ? liveOutDisplay / parsed : null
  const rateValue = executionRate ?? (referenceUsable ? pairRate : null)
  const rateReady = rateValue != null && rateValue > 0

  // CTA state machine: the button itself states why it cannot fire (market convention; the
  // dead silent-disabled swap button is gone). Disconnected/wrong-chain states live in
  // DialogCta's own branches.
  const cta: { label: string; disabled: boolean } = !valid
    ? { label: copy.swapEnterAmount, disabled: true }
    : overBalance
      ? { label: fillTemplate(copy.swapInsufficientBalance, { symbol: sellToken.symbol }), disabled: true }
      : realMode && amountGate.balanceUnknown
        ? { label: copy.swapBalanceUnavailable, disabled: true }
        : slippageIssue != null
          ? { label: copy.swapInvalidSlippage, disabled: true }
          : realMode && !pairExecutable
            ? { label: copy.swapPairUnavailable, disabled: true }
            : resolving || quotePending
              ? { label: copy.swapFetchingQuote, disabled: true }
              : tx.running || confirming
                ? { label: copy.swapAction, disabled: true }
                : realMode
                  ? impactToneNow === 'danger'
                    ? { label: copy.swapHighImpact, disabled: true }
                    : { label: copy.swapAction, disabled: false }
                  : { label: copy.swapAction, disabled: true }

  return (
    <section className="swap-panel ax-glow-card" aria-labelledby="swap-title">
      <div className="swap-panel__head">
        <h2 id="swap-title">{copy.swapTitle}</h2>
        {/* Industry convention: ghost icon gear + popover settings layer (the sole
            implementation=SwapSettings; Esc/outside-click close and focus
            return to the trigger are built into Popover) */}
        <SwapSettings
          locale={locale}
          settingsLabel={copy.settingsTitle}
          slippageTip={copy.slippageTip}
          slippageValue={slippageText}
          onSlippageValue={setSlippageText}
          deadline={{ tip: copy.deadlineTip, value: deadlineText, onValue: setDeadlineText }}
        />
      </div>
      <div className="swap-panel__field">
        <div className="swap-panel__field-head">
          <span>{copy.swapSell}</span>
          <span className="swap-panel__balance">
            {copy.balance}:{' '}
            {sellExact != null ? (
              <span data-numeric>{fmtTokenAmountExact(sellExact.base, sellExact.decimals, locale)}</span>
            ) : sellBalance != null ? (
              <span data-numeric>{formatAmount(sellBalance, locale)}</span>
            ) : (
              '--'
            )}
            <button
              type="button"
              className="swap-panel__max"
              disabled={sellExact != null ? sellExact.base === 0n : sellBalance == null || sellBalance <= 0}
              onClick={() =>
                setAmount(
                  sellExact != null
                    ? trimFractionZeros(formatUnits(sellExact.base, sellExact.decimals))
                    : amountToInputString(sellBalance ?? 0),
                )
              }
            >
              {copy.max}
            </button>
          </span>
        </div>
        <div className="swap-panel__field-row">
          <Input
            className="numeric-input"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            maxLength={AMOUNT_MAX_CHARS}
            onChange={(event) => setAmount(sanitizeAmount(event.target.value))}
            aria-label={`${copy.swapSell} ${sellToken.symbol}`}
            aria-invalid={overBalance || undefined}
            aria-describedby={overBalance ? 'swap-balance-error' : undefined}
          />
          <SwapTokenSelectDialog
            locale={locale}
            selectedId={sellToken.id}
            options={direction === 'stable-to-meme' ? stableOptions : memeOptions}
            unavailableNote={copy.swapPairUnavailable}
            onSelect={(id) => {
              if (direction === 'stable-to-meme') setStableId(id)
              else setMemeId(id as MemeTokenId)
            }}
          />
        </div>
        {overBalance ? (
          <FieldError id="swap-balance-error">{common.insufficientBalance}</FieldError>
        ) : null}
        {sellUsd != null ? <span className="swap-panel__field-usd">≈ ${sellUsd}</span> : null}
      </div>
      <button
        type="button"
        className="swap-panel__flip"
        onClick={() => setDirection(direction === 'stable-to-meme' ? 'meme-to-stable' : 'stable-to-meme')}
        aria-label={`${sellToken.symbol} ⇄ ${buyToken.symbol}`}
      >
        <ArrowUpDown aria-hidden="true" size={18} />
      </button>
      <div className="swap-panel__field" role="group" aria-labelledby={buyLabelId}>
        <div className="swap-panel__field-head">
          <span id={buyLabelId}>{copy.swapBuy}</span>
          <span>
            {copy.balance}:{' '}
            {buyToken.exact != null ? (
              <span data-numeric>{fmtTokenAmountExact(buyToken.exact.base, buyToken.exact.decimals, locale)}</span>
            ) : buyBalance != null ? (
              <span data-numeric>{formatAmount(buyBalance, locale)}</span>
            ) : (
              '--'
            )}
          </span>
        </div>
        <div className="swap-panel__field-row">
          <output
            className="swap-panel__output numeric-input"
            data-numeric
            aria-busy={quotePending || undefined}
            aria-label={`${copy.swapBuy} ${buyToken.symbol}`}
          >
            {displayOut != null ? fmtTokenAmount(displayOut, locale) : '0.00'}
            {quotePending ? <span className="swap-panel__pending-spinner" aria-hidden="true" /> : null}
          </output>
          <SwapTokenSelectDialog
            locale={locale}
            selectedId={buyToken.id}
            options={direction === 'stable-to-meme' ? memeOptions : stableOptions}
            unavailableNote={copy.swapPairUnavailable}
            onSelect={(id) => {
              if (direction === 'stable-to-meme') setMemeId(id as MemeTokenId)
              else setStableId(id)
            }}
          />
        </div>
        {buyUsd != null ? <span className="swap-panel__field-usd">≈ ${buyUsd}</span> : null}
      </div>
      <dl className="swap-panel__details">
        <div>
          <dt>{copy.swapRate}</dt>
          <dd className="swap-panel__rate">
            <span data-numeric>
              {rateReady
                ? rateInverted
                  ? `1 ${buyToken.symbol} ≈ ${fmtTokenAmount(1 / (rateValue as number), locale)} ${sellToken.symbol}`
                  : `1 ${sellToken.symbol} ≈ ${fmtTokenAmount(rateValue as number, locale)} ${buyToken.symbol}`
                : '--'}
            </span>
            <button
              type="button"
              className="swap-panel__rate-flip"
              onClick={() => setRateInverted((v) => !v)}
              disabled={!rateReady}
              aria-label={copy.swapRateFlip}
            >
              <ArrowLeftRight aria-hidden="true" size={12} />
            </button>
          </dd>
        </div>
        <div>
          <dt>{copy.priceImpact}</dt>
          <dd>
            {impactText != null ? (
              <span data-numeric data-tone={impactToneNow ?? undefined}>
                {impactText}%
              </span>
            ) : (
              '--'
            )}
          </dd>
        </div>
        <div>
          <dt>{copy.minReceived}</dt>
          <dd data-numeric>{minReceivedText ?? '--'}</dd>
        </div>
        <div>
          <dt>{copy.swapFee}</dt>
          <dd data-numeric>{swapFeeText ?? '--'}</dd>
        </div>
      </dl>
      <DialogCta
        locale={locale}
        connected={connected}
        onConnect={toggle}
        onAction={() => void startSwap()}
        label={cta.label}
        disabled={cta.disabled}
        connectLabel={copy.swapCta}
        switchChainTo={
          wrongChain
            ? { execChain, chainName: governanceChainName, onSwitch: switchChain }
            : undefined
        }
      />
      {resolveFailed ? (
        <FieldError>{common.degrade.errorBody}</FieldError>
      ) : null}
      {confirming ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) closeConfirm()
          }}
        >
          <ActionDialogShell
            title={gasEditing ? verseCopy.gasNetworkFee : copy.swapConfirmTitle}
            closeLabel={common.close}
            toolbar={
              gasEditing ? (
                <button
                  type="button"
                  className="pol-mint__back"
                  aria-label={common.back}
                  onClick={() => leaveGasView()}
                >
                  <ChevronLeft aria-hidden="true" size={16} />
                </button>
              ) : undefined
            }
          >
            <div aria-live="polite">
              {gasEditing && gasQuote.ready ? (
                <GasEditor quote={gasQuote} title={verseCopy.gasTitle} onDone={() => leaveGasView()} />
              ) : (
                <>
                  {snapshot ? (
                    <div className="swap-review">
                      <div className="swap-review__leg">
                        <span className="swap-review__label">{copy.flashYouPay}</span>
                        <span className="swap-review__amount">
                          <span data-numeric className="swap-review__pay">
                            {snapshot.pay.amount}
                          </span>{' '}
                          <span className="ax-ticker">{snapshot.pay.symbol}</span>
                        </span>
                      </div>
                      <span className="pol-mint__arrow" aria-hidden="true">
                        <ArrowDown size={16} />
                      </span>
                      <div className="swap-review__leg">
                        <span className="swap-review__label">{copy.mintYouReceive}</span>
                        <span className="swap-review__amount">
                          <span data-numeric className="swap-review__receive">
                            {snapshot.receive.amount}
                          </span>{' '}
                          <span className="ax-ticker">{snapshot.receive.symbol}</span>
                        </span>
                      </div>
                      <span className="swap-review__min">
                        {copy.minReceived}
                        <span data-numeric className="swap-review__min-value">
                          {snapshot.minReceived.amount} {snapshot.minReceived.symbol}
                        </span>
                      </span>
                      <dl className="swap-review__meta">
                        <div className="swap-review__meta-row">
                          <dt>{copy.swapFee}</dt>
                          <dd data-numeric>{snapshot.feePercent}</dd>
                        </div>
                        {gasQuote.ready ? (
                          <div className="swap-review__meta-row">
                            <GasSummaryRow
                              label={verseCopy.gasNetworkFee}
                              value={gasQuote.rowValue}
                              usd={gasQuote.rowUsd}
                              onEdit={() => setGasEditing(true)}
                            />
                          </div>
                        ) : null}
                      </dl>
                      {gasQuote.ready && gasQuote.invalid ? (
                        <FieldError>{verseCopy.gasInvalid}</FieldError>
                      ) : null}
                      <div className="swap-review__actions">
                        <Button variant="outline" onClick={closeConfirm}>
                          {verseCopy.revise}
                        </Button>
                        <Button
                          className="ax-ghost-cta"
                          // The review body stays mounted under the progress dialog while the
                          // write runs, so tx.running must lock the confirm against re-entry.
                          disabled={
                            pendingSpec == null ||
                            tx.running ||
                            (gasQuote.ready && gasQuote.invalid)
                          }
                          onClick={() => {
                            if (!pendingSpec) return
                            const spec = gasOverride
                              ? { ...pendingSpec, ...gasOverride }
                              : pendingSpec
                            void tx.executeSession(spec)
                          }}
                        >
                          {copy.swapConfirmTitle}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
              {resolveFailed ? <FieldError>{common.degrade.errorBody}</FieldError> : null}
            </div>
          </ActionDialogShell>
        </Dialog>
      ) : null}
      {/* Feedback pair (dialog stacking discipline): progress = its own button-less dialog
          stacked on the confirm dialog (always second-to-last); confirmed yields to the
          generic receipt dialog, the last one. Receipt legs read the click-time snapshot
          (the form's amount clears on landing). */}
      <TxProgressDialog
        locale={locale}
        title={copy.swapConfirmTitle}
        state={tx.display}
        open={tx.active && !successOpen}
        onDismiss={tx.reset}
      />
      <TxSuccessDialog
        locale={locale}
        title={copy.swapDoneTitle}
        lead={copy.swapDoneLead}
        accent={copy.swapDoneAccent}
        rows={
          snapshot
            ? [
                { label: copy.flashYouPay, value: `${snapshot.pay.amount} ${snapshot.pay.symbol}` },
                {
                  label: copy.swapReceived,
                  value: `${snapshot.receive.amount} ${snapshot.receive.symbol}`,
                },
              ]
            : []
        }
        txHash={receipt?.hash}
        txChainId={receipt?.chainId}
        open={successOpen}
        onOpenChange={(next) => {
          setSuccessOpen(next)
          if (!next) closeConfirm()
        }}
      />
    </section>
  )
}

'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { ArrowDown, ArrowLeftRight } from 'lucide-react'

import type { Locale, PolPosition, Verse } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { useVerseBalances } from './trade-balances'
import { useAccountCenter } from '../global/use-account-center'
import { ActionDialogShell, DialogCta } from '../global/action-dialogs'
import { useTxCenter, useClearOnConfirmed, type WriteSpec } from '../global/use-tx-center'
import { TxProgressDialog } from '../global/tx-progress-dialog'
import { TxSuccessDialog, type TxSuccessRow } from '../global/tx-success-dialog'
import { useTxSuccessGate } from '../global/use-tx-success'
import {
  readAllowances,
  type ContractReader,
} from '../global/execution-reads'
import { getTokenDecimals, getVerseSession } from '../global/write-session'
import { splitterAbi } from '@/lib/web3/abis'
import { getActiveEip1193Provider } from '@/lib/web3/active-provider'
import {
  approvalCall,
  buildSessionWrite,
  flashPolToYtCall,
  flashYtToPolCall,
  MAX_SQRT_PRICE_X96,
  MIN_SQRT_PRICE_X96,
} from '@/lib/web3/session-actions'
import { useParams } from 'next/navigation'
import { parseVerseIdParam } from '../global/routes'
import { useVerseExecChain } from '../global/switch-chain-cta'
import { formatUnits, type Hex } from 'viem'
import { estimateBaseUnitsCeil, estimateBaseUnitsFloor, toBaseUnits } from '@/lib/web3/base-units'
import { SettingsTip, SwapSettings } from '../global/swap-settings'
import { formatAmount, formatPercent } from '../global/signal-ui'
import { AMOUNT_MAX_CHARS, amountToInputString, sanitizeAmount, trimFractionZeros, typedAmountPositive } from '../global/amount-input'
import { fmtTokenAmount, fmtTokenAmountExact, fmtUsd } from '../global/amount-format'
import { getSlippageIssue, slippageToNumber } from '../global/slippage-input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

/**
 * Flash Swap action dialog: YT's dedicated tool, living on the Tokenization page's YT well.
 * Mechanism: single POL↔YT channel reusing PT/POL pool liquidity; both buy
 * and sell "specify the YT amount" —
 * buy=receive y YT, pay y−R (R=in-pool realization of y PT, cap=Max paid);
 * sell=receive y−Q (floor=Min received).
 * Counterparty side shown as uAsset instead of POL (lower comprehension
 * cost) — the frontend converts the composite via the POL/uAsset pool price; on-chain it still
 * settles in POL through the Flash Swap.
 * Linear reference price: 1 YT ≈ (1−PT/POL pool price)×POL/uAsset pool price (implied price,
 * 1 POL=1 PT+1 YT); fee=single application of the PT/POL pool dynamic fee.
 * Buy/sell share one layout (no flip): upper block=YT-driven input, lower block=
 * uAsset-derived read-only; the mode bar only changes labels and the protection row's direction.
 * Gate is locked only (well-bottom gating; after unlock split/merge closes and Flash Swap
 * becomes unavailable with it, moving to settlement redemption).
 * Settings gear keeps only slippage (the contract has no deadline parameter; optional limit
 * price + expiry are advanced items not built — same scope as the Split/Merge dialog).
 * Opens with empty input (amount input defaults to empty 0.00, not prefilled with balance);
 * recalculates as usual after clearing/changing the number; mode switch preserves input.
 * CTA discipline same as the Mint dialog: disconnected=Connect Wallet clickable to toggle mock
 * connection; connected=action button disabled (no faked execution).
 */
export function PolFlashSwapDialog({
  locale,
  verse,
  pol,
  uAssetUsd,
}: {
  locale: Locale
  verse: Verse
  pol: PolPosition
  /** uAsset USD sample price; null=hide the USD conversion row */
  uAssetUsd: number | null
}) {
  const copy = getCopy(locale).verseDesk
  const common = getCopy(locale).common
  const center = useAccountCenter()
  const { connected, connectAction: toggle } = center
  const { execChain, wrongChain, switchChain } = useVerseExecChain(verse.governanceChain)
  const tx = useTxCenter()
  const { successOpen, setSuccessOpen, receipt } = useTxSuccessGate(tx)
  // Receipt legs snapshotted at the click (the amount clears on landing).
  const [flashRows, setFlashRows] = useState<TxSuccessRow[]>([])
  const params = useParams()
  const rawVerseId = params?.verseId
  const verseId = parseVerseIdParam(rawVerseId)
  const [mode, setMode] = useState<'buy' | 'sell'>('buy')
  const [resolving, setResolving] = useState(false)
  const [resolveFailed, setResolveFailed] = useState(false)
  const legLabelId = useId()
  const balanceErrorId = useId()
  // Opens with empty input (amount input defaults to empty 0.00)
  const [amount, setAmount] = useState('')
  // The settings-layer controlled value is stored as a string and shown verbatim
  // (keep the trailing dot instead of swallowing it; numeric derivation goes through
  // slippageToNumber)
  const [slippageText, setSlippageText] = useState('0.5')
  const [rateInverted, setRateInverted] = useState(false)
  useClearOnConfirmed(tx.display, () => setAmount(''))

  // Wallet-provider YT/uAsset balances (onchain builds); re-reads when a flash swap confirms.
  const [settleTick, setSettleTick] = useState(0)
  const prevDisplayRef = useRef<string | null>(null)
  useEffect(() => {
    if (tx.display === 'confirmed' && prevDisplayRef.current !== 'confirmed') {
      setSettleTick((tick) => tick + 1)
    }
    prevDisplayRef.current = tx.display
  }, [tx.display])
  const live = useVerseBalances({
    verseId,
    uAssetSymbol: verse.raiseAsset,
    governanceChain: verse.governanceChain,
    refreshKey: settleTick,
  })
  const myYtLive = live?.yt ?? pol.myYt
  const myUAssetLive = live?.uAsset ?? pol.myUAsset
  // Exact wallet reads win over the float aliases whenever the probe landed (float64 can
  // round a real balance upward — a Max prefill re-parsed from it would trip the gate)
  const ytExact = live?.exact.yt ?? null
  const uExactDisplay = live?.exact.uAsset ?? null

  const ytSymbol = `YT-${verse.symbol}`
  const clean = (raw: string) => setAmount(sanitizeAmount(raw))

  // uAsset-denominated implied price (counterparty side uses uAsset
  // directly, lower comprehension cost — two steps internally:
  // 1 POL=1 PT+1 YT → 1 YT ≈ 1 POL − PT pool market price, then converted to
  // uAsset via the POL/uAsset pool price;
  // on-chain it still settles in POL via Flash Swap, the frontend composes the POL/uAsset pool legs)
  const ytPerUAsset = (1 - pol.ptPricePerPol) * pol.marketPricePerPol
  const parsed = Number(amount)
  const valid = typedAmountPositive(amount, ytExact) && ytPerUAsset > 0
  // Buy and sell both use the linear reference price: paid/received uAsset = YT amount × implied
  // price (execution price is decided by pool state, see the leverage warning)
  const uAssetLeg = valid ? parsed * ytPerUAsset : null
  // Insufficient balance: sell=exceeds YT holdings; buy=derived pay leg exceeds the uAsset
  // balance (lower block is read-only, the error belongs to the driving input). A null balance
  // (accountless slot) never blocks — the chain enforces real holdings at execution.
  // Sell compares exact base units when the probe landed (the Max prefill round-trips through
  // the input string); the buy leg is a reference-price float estimate (execution re-quotes
  // on-chain with the real balance enforced), so it keeps the float comparison.
  const overBalance =
    mode === 'sell'
      ? ytExact != null
        ? Number.isFinite(parsed) && toBaseUnits(amount, ytExact.decimals) > ytExact.base
        : myYtLive != null && parsed > myYtLive
      : uAssetLeg != null && myUAssetLive != null && uAssetLeg > myUAssetLive
  // Slippage validation (see getSlippageIssue/slippageToNumber in global/slippage-input):
  // while out of bounds, protected-value derivation falls back to the '--' slot
  const slippage = slippageToNumber(slippageText)
  const slippageIssue = getSlippageIssue(slippage)
  const protectedLeg =
    uAssetLeg != null && slippageIssue == null
      ? uAssetLeg * (mode === 'buy' ? 1 + slippage / 100 : 1 - slippage / 100)
      : null
  // Execution: buy = POL→exact YT (maxPOLIn bound), sell = exact YT→POL (minPOLOut floor).
  // POL legs derive from the uAsset-denominated display via the POL/uAsset pool price.
  const executionReady =
    center.source === 'real' &&
    connected &&
    center.chainSupported &&
    !wrongChain &&
    center.chainId != null &&
    center.address != null &&
    verseId != null &&
    pol.marketPricePerPol > 0

  async function startFlashReview(): Promise<void> {
    setFlashRows(
      mode === 'buy'
        ? [
            ...(uAssetLeg != null
              ? [
                  {
                    label: common.txYouPaid,
                    value: `≈ ${fmtTokenAmount(uAssetLeg, locale)}`,
                    symbol: verse.raiseAsset,
                  },
                ]
              : []),
            { label: common.txReceived, value: fmtTokenAmount(parsed, locale), symbol: ytSymbol },
          ]
        : [
            { label: common.txYouPaid, value: fmtTokenAmount(parsed, locale), symbol: ytSymbol },
            ...(uAssetLeg != null
              ? [
                  {
                    label: common.txReceived,
                    value: `≈ ${fmtTokenAmount(uAssetLeg, locale)}`,
                    symbol: verse.raiseAsset,
                  },
                ]
              : []),
          ],
    )
    if (!executionReady || !valid || overBalance || slippageIssue != null || resolving) return
    const provider = getActiveEip1193Provider()
    const eoa = center.address as Hex | null
    const chainId = center.chainId
    if (!provider || !eoa || chainId == null || verseId == null) return
    setResolving(true)
    setResolveFailed(false)
    try {
      // 静态半命中页面预热缓存（0 往返），点击链路只剩一轮并行 allowance 读
      // One executable chain: a provider answering another chain is refused (VerseChainError),
      // never silently read — these dialogs' figures are loaded for this chain only.
      const session = await getVerseSession({
        provider,
        chains: [chainId],
        eoa,
        verseId: BigInt(verseId),
      })
      const contracts = session.contracts
      const router = contracts.MemeverseYTFlashSwapRouter as Hex
      const splitter = contracts.POLSplitter as Hex
      const reader: ContractReader = session.reader
      const yt = (await reader.read({
        address: splitter,
        abi: splitterAbi,
        functionName: 'getYT',
        args: [BigInt(verseId)],
      })) as Hex
      const [ytDecimals, polDecimals] = await Promise.all([
        getTokenDecimals(reader, chainId, yt),
        getTokenDecimals(reader, chainId, session.verse.pol),
      ])
      const ytAmount = toBaseUnits(amount, ytDecimals)
      if (ytAmount === 0n) throw new Error('typed amount below one base unit')
      const protectedPol =
        protectedLeg != null && pol.marketPricePerPol > 0
          ? protectedLeg / pol.marketPricePerPol
          : null
      if (protectedPol == null) {
        setResolveFailed(true)
        return
      }
      const deadlineSecs = BigInt(Math.floor(Date.now() / 1000) + 600)
      let action
      let pullToken: Hex
      let pullAmount: bigint
      let functionName: string
      let inputs: string
      let minOutput: string
      if (mode === 'buy') {
        // max-in bound ceils / min-out bound floors (Uniswap rounding convention); the
        // estimate converts in one total hop (String() would emit scientific notation in
        // the dust range and viem's parseUnits rejects it outright)
        const maxPolIn = estimateBaseUnitsCeil(protectedPol, polDecimals)
        action = flashPolToYtCall(router, {
          verseId: BigInt(verseId),
          exactYTOut: ytAmount,
          maxPOLIn: maxPolIn,
          sqrtPriceLimitX96: MAX_SQRT_PRICE_X96 - 1n,
          recipient: eoa,
          deadline: deadlineSecs,
        })
        pullToken = session.verse.pol
        pullAmount = maxPolIn
        functionName = 'swapPOLForExactYT'
        inputs = `${formatUnits(ytAmount, ytDecimals)} ${ytSymbol}`
        minOutput = `${formatUnits(ytAmount, ytDecimals)} ${ytSymbol}`
      } else {
        const minPolOut = estimateBaseUnitsFloor(protectedPol, polDecimals)
        action = flashYtToPolCall(router, {
          verseId: BigInt(verseId),
          exactYTIn: ytAmount,
          minPOLOut: minPolOut,
          sqrtPriceLimitX96: MIN_SQRT_PRICE_X96 + 1n,
          recipient: eoa,
          deadline: deadlineSecs,
        })
        pullToken = yt
        pullAmount = ytAmount
        functionName = 'swapExactYTForPOL'
        inputs = `${formatUnits(ytAmount, ytDecimals)} ${ytSymbol}`
        minOutput = `${formatUnits(minPolOut, polDecimals)} POL-${verse.symbol}`
      }
      const [allowance] = await readAllowances(reader, eoa, [{ token: pullToken, spender: router }])
      const approval =
        allowance < pullAmount
          ? approvalCall(pullToken, router, pullAmount)
          : undefined
      const { calls, calldata: batch } = buildSessionWrite({ hook: session.hook, action, approval, swapSession: true })
      const pullDecimals = mode === 'buy' ? polDecimals : ytDecimals
      const pullSymbol = mode === 'buy' ? `POL-${verse.symbol}` : ytSymbol
      const spec: WriteSpec = {
        review: {
          chainId,
          account: eoa,
          targetContract: router,
          functionName,
          inputs,
          minOutput,
          fee: '—',
          gasPayer: eoa,
          authorizationChange: approval
              ? `${formatUnits(pullAmount, pullDecimals)} ${pullSymbol}`
              : '—',
          estimatedGas: '—',
          nativeBalance: '—',
        },
        kernel: session.kernel,
        expectedChainId: chainId,
        batchCallData: batch,
        calls,
        quoteId: `flash:${verseId}:${mode}:${ytAmount}`,
        minOutput: mode === 'buy' ? ytAmount.toString() : minOutput,
        slippageBps: Math.round(slippage * 100),
        deadline: Number(deadlineSecs),
        manifestVersion: session.manifestVersion,
        crossChain: false,
        writeScope: { kind: 'verse', chainId, verseId },
      }
      void tx.executeSession(spec)
    } catch {
      setResolveFailed(true)
    } finally {
      setResolving(false)
    }
  }
  // Large-number layering scope=global/amount-format (fmtUsd/fmtTokenAmount; raw products carry
  // float64 tail noise and must go through the layer);
  // fee row=user fee rate sample (relative to the paid amount, read directly from fixture with no
  // derivation — the sample is not a precise value; the too-high rollback scope see the
  // flashFeeNote tooltip and the fixture comment)
  // ≈$: both sides denominated in uAsset × uAssetUsd
  const uAssetUsdText =
    uAssetUsd == null || uAssetLeg == null ? null : fmtUsd(uAssetLeg * uAssetUsd, locale)
  const ytUsd =
    uAssetUsd == null || !valid ? null : fmtUsd(parsed * ytPerUAsset * uAssetUsd, locale)

  return (
    <>
      <Dialog>
      <DialogTrigger data-slot="button" render={<Button variant="outline" size="sm" />}>
        {copy.flashSwap}
      </DialogTrigger>
      <ActionDialogShell
        title={copy.flashSwap}
        closeLabel={common.close}
        toolbar={
          /* Slippage only: the contract has no deadline; optional limit price + expiry not done
             (see the component header note) */
          <SwapSettings
            locale={locale}
            settingsLabel={copy.flashSettingsTitle}
            slippageTip={copy.slippageTip}
            slippageValue={slippageText}
            onSlippageValue={setSlippageText}
          />
        }
      >

          {/* Mode bar: tab-style ToggleGroup same as the vault action cards (buy=exact-out pay cap,
              sell=receive floor) */}
          <ToggleGroup
            className="vault-actions__bar"
            value={[mode]}
            onValueChange={(value) => {
              const next = value[0] as 'buy' | 'sell' | undefined
              if (!next) return
              setMode(next)
            }}
          >
            <ToggleGroupItem value="buy">{copy.flashBuy}</ToggleGroupItem>
            <ToggleGroupItem value="sell">{copy.flashSell}</ToggleGroupItem>
          </ToggleGroup>

          {/* Upper block=YT-driven input: shared by buy/sell (source of truth: both directions
              specify the YT amount), Sell gets Max, Buy does not */}
          <div className="swap-panel__field">
            <div className="swap-panel__field-head">
              <span>YT</span>
              <span className="swap-panel__balance">
                {copy.balance}:{' '}
                {ytExact != null ? (
                  <span data-numeric>{fmtTokenAmountExact(ytExact.base, ytExact.decimals, locale)}</span>
                ) : myYtLive != null ? (
                  <span data-numeric>{formatAmount(myYtLive, locale)}</span>
                ) : (
                  '--'
                )}
                {mode === 'sell' ? (
                  <button
                    type="button"
                    className="swap-panel__max"
                    disabled={ytExact != null ? ytExact.base === 0n : myYtLive == null || myYtLive <= 0}
                    onClick={() =>
                      clean(
                        ytExact != null
                          ? trimFractionZeros(formatUnits(ytExact.base, ytExact.decimals))
                          : amountToInputString(myYtLive ?? 0),
                      )
                    }
                  >
                    {copy.max}
                  </button>
                ) : null}
              </span>
            </div>
            <div className="swap-panel__field-row">
              <Input
                className="numeric-input"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                maxLength={AMOUNT_MAX_CHARS}
                onChange={(event) => clean(event.target.value)}
                aria-label={`${copy.flashSwap} ${ytSymbol}`}
                aria-invalid={overBalance || undefined}
                aria-describedby={overBalance ? balanceErrorId : undefined}
              />
              <div className="swap-panel__token">
                <strong>{ytSymbol}</strong>
              </div>
            </div>
            {overBalance ? (
              <FieldError id={balanceErrorId}>{common.insufficientBalance}</FieldError>
            ) : null}
            {ytUsd != null ? <span className="swap-panel__field-usd">≈ ${ytUsd}</span> : null}
          </div>

          <span className="pol-mint__arrow" aria-hidden="true">
            <ArrowDown size={16} />
          </span>

          {/* Lower block=uAsset-derived read-only (counterparty side=uAsset;
              converted internally via the POL/uAsset pool):
              Buy=You pay (cap see the Max paid row), Sell=You receive (floor see the Min received row) */}
          <div className="swap-panel__field" role="group" aria-labelledby={legLabelId}>
            <div className="swap-panel__field-head">
              <span id={legLabelId}>{mode === 'buy' ? copy.flashYouPay : copy.youReceive}</span>
              <span className="swap-panel__balance">
                {copy.balance}:{' '}
                {uExactDisplay != null ? (
                  <span data-numeric>{fmtTokenAmountExact(uExactDisplay.base, uExactDisplay.decimals, locale)}</span>
                ) : myUAssetLive != null ? (
                  <span data-numeric>{formatAmount(myUAssetLive, locale)}</span>
                ) : (
                  '--'
                )}
              </span>
            </div>
            <div className="swap-panel__field-row">
              <output
                className="swap-panel__output numeric-input"
                data-numeric
                aria-label={`${mode === 'buy' ? copy.flashYouPay : copy.youReceive} ${verse.raiseAsset}`}
              >
                {uAssetLeg != null ? fmtTokenAmount(uAssetLeg, locale) : '0.00'}
              </output>
              <div className="swap-panel__token">
                <strong>{verse.raiseAsset}</strong>
              </div>
            </div>
            {uAssetUsdText != null ? (
              <span className="swap-panel__field-usd">≈ ${uAssetUsdText}</span>
            ) : null}
          </div>

          <dl className="swap-panel__details">
            <div>
              <dt>
                {copy.swapRate}
                <SettingsTip text={copy.flashRateTip} />
              </dt>
              <dd className="swap-panel__rate">
                <span data-numeric>
                  {ytPerUAsset > 0
                    ? rateInverted
                      ? `1 ${verse.raiseAsset} ≈ ${fmtTokenAmount(1 / ytPerUAsset, locale)} ${ytSymbol}`
                      : `1 ${ytSymbol} ≈ ${fmtTokenAmount(ytPerUAsset, locale)} ${verse.raiseAsset}`
                    : '--'}
                </span>
                <button
                  type="button"
                  className="swap-panel__rate-flip"
                  onClick={() => setRateInverted((v) => !v)}
                  disabled={!(ytPerUAsset > 0)}
                  aria-label={copy.swapRateFlip}
                >
                  <ArrowLeftRight aria-hidden="true" size={12} />
                </button>
              </dd>
            </div>
            <div>
              <dt>{mode === 'buy' ? copy.maxPaid : copy.minReceived}</dt>
              <dd data-numeric>
                {protectedLeg != null ? `${fmtTokenAmount(protectedLeg, locale)} ${verse.raiseAsset}` : '--'}
              </dd>
            </div>
            <div>
              <dt>
                {copy.flashFeeLabel}
                <SettingsTip text={copy.flashFeeNote} />
              </dt>
              <dd data-numeric>
                {pol.flashUserFeeRate != null
                  ? `${formatPercent(pol.flashUserFeeRate * 100, locale)}%`
                  : '--'}
              </dd>
            </div>
          </dl>

          <DialogCta
            locale={locale}
            connected={connected}
            onConnect={toggle}
            onAction={() => void startFlashReview()}
            label={mode === 'buy' ? copy.flashBuy : copy.flashSell}
            connectLabel={copy.swapCta}
            disabled={!valid || overBalance || slippageIssue != null || !executionReady || resolving || tx.running}
            switchChainTo={
              wrongChain
                ? { execChain, chainName: verse.governanceChainName, onSwitch: switchChain }
                : undefined
            }
          />
          {resolveFailed ? <FieldError>{common.degrade.errorBody}</FieldError> : null}
      </ActionDialogShell>
      </Dialog>
      {/* Feedback pair (2026-10-26 弹窗序列纪律): progress = its own button-less dialog
          (second-to-last), confirmed yields to the generic receipt dialog (last). */}
      <TxProgressDialog
        locale={locale}
        title={copy.flashSwap}
        state={tx.display}
        open={tx.active && !successOpen}
        onDismiss={tx.reset}
      />
      <TxSuccessDialog
        locale={locale}
        title={copy.flashSwapDoneTitle}
        lead={copy.flashSwapDoneLead}
        accent={copy.flashSwapDoneAccent}
        rows={flashRows}
        txHash={receipt?.hash}
        txChainId={receipt?.chainId}
        open={successOpen}
        onOpenChange={setSuccessOpen}
      />
    </>
  )
}

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
import { readAllowances, readLiquidityQuote } from '../global/execution-reads'
import { getTokenDecimals, getVerseSession } from '../global/write-session'
import { getActiveEip1193Provider } from '@/lib/web3/active-provider'
import {
  approvalCall,
  buildSessionWrite,
  mintPolCall,
} from '@/lib/web3/session-actions'
import { useParams } from 'next/navigation'
import { formatUnits, type Hex } from 'viem'
import { toBaseUnits } from '@/lib/web3/base-units'
import { mintPolEstimateFromPrice, mintPolTargetFromQuote } from '@/lib/web3/mint-pol'
import { SwapSettings } from '../global/swap-settings'
import { formatAmount } from '../global/signal-ui'
import { AMOUNT_MAX_CHARS, amountToInputString, sanitizeAmount, trimFractionZeros, typedAmountPositive } from '../global/amount-input'
import { fmtTokenAmount, fmtTokenAmountExact, fmtUsd } from '../global/amount-format'
import { getSlippageIssue, slippageToNumber } from '../global/slippage-input'
import { parseVerseIdParam } from '../global/routes'
import { useVerseExecChain } from '../global/switch-chain-cta'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

/**
 * Mint POL dialog (functional structure mirrors a dual-token supply
 * dialog, visuals adapted to this site's brand). Mechanism: uAsset + memecoin supplied at the
 * main-pool ratio, POL minted 1:1 against the amount actually added to the pool
 * (mintPOLToken carries both sides' desired/min +
 * deadline; POL:main-pool LP=1:1).
 * Output estimate: the uAsset leg per POL at the main-pool price (sqrt(price) at 18 decimals),
 * not `uAssetPerPol` — that field is the PT backing ratio recorded once at settlement and only
 * equals the current conversion at the settlement price.
 * Submitted target: the router's quote at click time (`quoteExactAmountsForLiquidity`), so the
 * exact-mode mint can never ask for more than the typed budgets after the pool moves; meta copy
 * such as "illustrative" or "reads on-chain values" never enters the UI — no disclaimers needed.
 * The CTA arms the real pipeline (disconnected=Connect Wallet clickable to toggle connection;
 * connected=Mint runs prepare → review → Type-4 / wallet_sendCalls).
 */
export function PolMintDialog({
  locale,
  verse,
  pol,
  price,
  uAssetUsd,
}: {
  locale: Locale
  verse: Verse
  pol: PolPosition
  /** Main-pool price: 1 memecoin = price uAsset (derived from the fixture candle close); null=no sample */
  price: number | null
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
  // Receipt legs snapshotted at the click (both input fields clear on landing).
  const [mintRows, setMintRows] = useState<TxSuccessRow[]>([])
  const params = useParams()
  const rawVerseId = params?.verseId
  const verseId = parseVerseIdParam(rawVerseId)
  const [memeAmount, setMemeAmount] = useState('')
  const receiveLabelId = useId()
  const memeBalanceErrorId = useId()
  const uBalanceErrorId = useId()
  const [uAmount, setUAmount] = useState('')
  // The settings-layer controlled value is stored as a string and shown verbatim
  // (keep the trailing dot instead of swallowing it, inline error for non-whole minutes),
  // numeric derivation goes through slippageToNumber
  const [slippageText, setSlippageText] = useState('0.5')
  const [deadlineText, setDeadlineText] = useState('10')
  const [rateInverted, setRateInverted] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [resolveFailed, setResolveFailed] = useState(false)
  useClearOnConfirmed(tx.display, () => {
    setMemeAmount('')
    setUAmount('')
  })

  // Wallet-provider balances (onchain builds): fills the supply-side Balance rows the SSR leaves
  // slotted; re-reads when a mint confirms here. Fixture builds keep the SSR samples.
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
  const myMemecoinLive = live?.memecoin ?? pol.myMemecoin
  const myUAssetLive = live?.uAsset ?? pol.myUAsset
  const myPolLive = live?.pol ?? pol.myPol
  // Exact wallet reads win over the float aliases whenever the probe landed (float64 can
  // round a real balance upward — a Max prefill re-parsed from it would trip the gate)
  const memeExact = live?.exact.memecoin ?? null
  const uExact = live?.exact.uAsset ?? null

  const polSymbol = `POL-${verse.symbol}`
  const memeVal = Number(memeAmount)
  const uVal = Number(uAmount)
  const valid = typedAmountPositive(memeAmount, memeExact) && typedAmountPositive(uAmount, uExact)
  // A null balance (accountless slot) never blocks — the chain enforces real holdings at execution
  const memeOver =
    memeExact != null
      ? Number.isFinite(memeVal) && toBaseUnits(memeAmount, memeExact.decimals) > memeExact.base
      : myMemecoinLive != null && memeVal > myMemecoinLive
  const uOver =
    uExact != null
      ? Number.isFinite(uVal) && toBaseUnits(uAmount, uExact.decimals) > uExact.base
      : myUAssetLive != null && uVal > myUAssetLive
  // POL output = the uAsset side ÷ the uAsset leg per POL at the current main-pool price.
  // uAssetPerPol would only hold at the settlement price and overstates the mint afterwards.
  const uAssetDecimals = uExact?.decimals ?? 18
  const memecoinDecimals = memeExact?.decimals ?? 18
  const polOut =
    valid && price != null && price > 0
      ? mintPolEstimateFromPrice({ uAssetAmount: uVal, price, uAssetDecimals, memecoinDecimals })
      : null
  // Slippage validation (see getSlippageIssue/slippageToNumber in global/slippage-input):
  // while out of bounds, protected-value derivation falls back to the '--' slot
  const slippage = slippageToNumber(slippageText)
  const slippageIssue = getSlippageIssue(slippage)
  const minPol = polOut != null && slippageIssue == null ? polOut * (1 - slippage / 100) : null
  const executionReady =
    center.source === 'real' &&
    connected &&
    center.chainSupported &&
    !wrongChain &&
    center.chainId != null &&
    center.address != null &&
    verseId != null

  async function startMintReview(): Promise<void> {
    if (!executionReady || !valid || memeOver || uOver || slippageIssue != null || resolving) return
    const provider = getActiveEip1193Provider()
    const eoa = center.address as Hex | null
    const chainId = center.chainId
    if (!provider || !eoa || chainId == null || verseId == null) return
    setResolving(true)
    setResolveFailed(false)
    try {
      // 静态半命中页面预热缓存（0 往返）；点击链路只剩一轮并行 allowance 读
      // One executable chain: a provider answering another chain is refused (VerseChainError),
      // never silently read — these dialogs' figures are loaded for this chain only.
      const session = await getVerseSession({
        provider,
        chains: [chainId],
        eoa,
        verseId: BigInt(verseId),
      })
      const launcher = session.contracts.MemeverseLauncher as Hex
      const [memeDecimals, uDecimals, polDecimals] = await Promise.all([
        getTokenDecimals(session.reader, chainId, session.verse.memecoin),
        getTokenDecimals(session.reader, chainId, session.verse.uAsset),
        getTokenDecimals(session.reader, chainId, session.verse.pol),
      ])
      const memeDesired = toBaseUnits(memeAmount, memeDecimals)
      const uDesired = toBaseUnits(uAmount, uDecimals)
      if (memeDesired === 0n || uDesired === 0n) throw new Error('typed amount below one base unit')
      const slippageBps = Math.round(slippage * 100)
      const memeMin = (memeDesired * BigInt(10000 - slippageBps)) / 10000n
      const uMin = (uDesired * BigInt(10000 - slippageBps)) / 10000n
      // Exact-mode target from the pool's current composition (the launcher re-quotes it and
      // rejects any budget shortfall); 1 POL of reference liquidity keeps the quote precise.
      // Runs alongside the allowance legs: both must be fresh at the click.
      const router = session.contracts.MemeverseSwapRouter as Hex | undefined
      if (!router) throw new Error('outrun: mint POL router missing')
      const referenceLiquidity = 10n ** BigInt(polDecimals)
      const [quote, [memeAllow, uAllow]] = await Promise.all([
        readLiquidityQuote(
          session.reader,
          router,
          session.verse.uAsset,
          session.verse.memecoin,
          referenceLiquidity,
        ),
        readAllowances(session.reader, eoa, [
          { token: session.verse.memecoin, spender: launcher },
          { token: session.verse.uAsset, spender: launcher },
        ]),
      ])
      const outDesired = mintPolTargetFromQuote({
        uAssetDesired: uDesired,
        memecoinDesired: memeDesired,
        referenceLiquidity,
        quotedUAsset: quote.amountA,
        quotedMemecoin: quote.amountB,
        slippageBps,
      })
      const deadlineSecs = BigInt(Math.floor(Date.now() / 1000) + (Number(deadlineText) || 10) * 60)
      const approvals = [
        ...(memeAllow < memeDesired
          ? [approvalCall(session.verse.memecoin, launcher, memeDesired)]
          : []),
        ...(uAllow < uDesired
          ? [approvalCall(session.verse.uAsset, launcher, uDesired)]
          : []),
      ]
      const action = mintPolCall(launcher, {
        verseId: BigInt(verseId),
        amountInUAssetDesired: uDesired,
        amountInMemecoinDesired: memeDesired,
        amountInUAssetMin: uMin,
        amountInMemecoinMin: memeMin,
        amountOutDesired: outDesired,
        deadline: deadlineSecs,
      })
      const { calls, calldata: batch } = buildSessionWrite({
        hook: session.hook,
        approvals,
        action,
      })
      const spec: WriteSpec = {
        review: {
          chainId,
          account: eoa,
          targetContract: launcher,
          functionName: 'mintPOLToken',
          inputs: `${formatUnits(memeDesired, memeDecimals)} ${verse.symbol} + ${formatUnits(uDesired, uDecimals)} ${verse.raiseAsset}`,
          minOutput: outDesired > 0n ? `${formatUnits(outDesired, polDecimals)} ${polSymbol}` : '—',
          fee: '—',
          gasPayer: eoa,
          authorizationChange:
            approvals.length > 0
              ? `${verse.symbol} + ${verse.raiseAsset}`
              : '—',
          // 审阅面板不渲染 gas 字段（网络费行来自 useGasQuote），点击链路不预估
          estimatedGas: '—',
          nativeBalance: '—',
        },
        kernel: session.kernel,
        expectedChainId: chainId,
        batchCallData: batch,
        calls,
        quoteId: `mint:${verseId}:${memeDesired}:${uDesired}`,
        minOutput: outDesired.toString(),
        slippageBps,
        deadline: Number(deadlineSecs),
        manifestVersion: session.manifestVersion,
        crossChain: false,
        writeScope: { kind: 'verse', chainId, verseId },
      }
      // Receipt legs snapshotted at the click (both input fields clear on landing); the
      // received leg is the quoted exact-mode target, not the form's price-derived estimate.
      const quotedOut = outDesired > 0n ? Number(formatUnits(outDesired, polDecimals)) : null
      setMintRows([
        {
          label: common.txYouSupplied,
          value: fmtTokenAmount(Number(memeAmount), locale),
          symbol: verse.symbol,
        },
        {
          label: common.txYouSupplied,
          value: fmtTokenAmount(Number(uAmount), locale),
          symbol: verse.raiseAsset,
        },
        ...(quotedOut != null
          ? [
              {
                label: common.txReceived,
                value: `≈ ${fmtTokenAmount(quotedOut, locale)}`,
                symbol: polSymbol,
              },
            ]
          : []),
      ])
      void tx.executeSession(spec)
    } catch (error) {
      // Dev-only: the UI collapses every prepare failure into one generic line.
      if (process.env.NODE_ENV !== 'production') {
        console.error('[pol-mint] prepare failed', error)
      }
      setResolveFailed(true)
    } finally {
      setResolving(false)
    }
  }

  // Two-side linkage: both sides equal in value across the main pool's full range;
  // the other side is back-computed at the price ratio
  const onMemeInput = (raw: string) => {
    setMemeAmount(raw)
    const value = Number(raw)
    setUAmount(price != null && price > 0 && value > 0 ? amountToInputString(value * price) : '')
  }
  const onUInput = (raw: string) => {
    setUAmount(raw)
    const value = Number(raw)
    setMemeAmount(price != null && price > 0 && value > 0 ? amountToInputString(value / price) : '')
  }

  // display formatting goes through global/amount-format (fmtUsd/fmtTokenAmount) — raw float
  // products carry precision noise
  const memeUsd =
    uAssetUsd == null || !valid || price == null || price <= 0
      ? null
      : fmtUsd(memeVal * price * uAssetUsd, locale)
  const uUsd = uAssetUsd == null || !valid ? null : fmtUsd(uVal * uAssetUsd, locale)

  return (
    <>
      <Dialog>
      {/* data-slot pinned back to button: base-ui Trigger's render merge overwrites the rendered
          element's data-slot, while the theme bridge (skins like the tab area's "cyan console")
          matches on [data-slot='button'] — without pinning it back the skin diverges from the
          Redeem/Split buttons in the same row */}
      <DialogTrigger data-slot="button" render={<Button variant="outline" size="sm" />}>
        {copy.mintPol}
      </DialogTrigger>
      <ActionDialogShell
        title={copy.mintDialogTitle}
        closeLabel={common.close}
        toolbar={
          <SwapSettings
            locale={locale}
            settingsLabel={copy.mintSettingsTitle}
            slippageTip={copy.mintSlippageTip}
            slippageValue={slippageText}
            onSlippageValue={setSlippageText}
            deadline={{ tip: copy.mintDeadlineTip, value: deadlineText, onValue: setDeadlineText }}
          />
        }
      >

          <span className="pol-mint__label">{copy.mintSupply}</span>
          <div className="swap-panel__field">
            <div className="swap-panel__field-head">
              <span>{copy.mintSideMeme}</span>
              <span className="swap-panel__balance">
                {copy.balance}:{' '}
                {memeExact != null ? (
                  <span data-numeric>{fmtTokenAmountExact(memeExact.base, memeExact.decimals, locale)}</span>
                ) : myMemecoinLive != null ? (
                  <span data-numeric>{formatAmount(myMemecoinLive, locale)}</span>
                ) : (
                  '--'
                )}
                <button
                  type="button"
                  className="swap-panel__max"
                  disabled={memeExact != null ? memeExact.base === 0n : myMemecoinLive == null || myMemecoinLive <= 0}
                  onClick={() =>
                    onMemeInput(
                      memeExact != null
                        ? trimFractionZeros(formatUnits(memeExact.base, memeExact.decimals))
                        : amountToInputString(myMemecoinLive ?? 0),
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
                value={memeAmount}
                maxLength={AMOUNT_MAX_CHARS}
                onChange={(event) => onMemeInput(sanitizeAmount(event.target.value))}
                aria-label={`${copy.mintSupply} ${verse.symbol}`}
                aria-invalid={memeOver || undefined}
                aria-describedby={memeOver ? memeBalanceErrorId : undefined}
              />
              <div className="swap-panel__token">
                <strong>{verse.symbol}</strong>
              </div>
            </div>
            {memeOver ? (
              <FieldError id={memeBalanceErrorId}>{common.insufficientBalance}</FieldError>
            ) : null}
            {memeUsd != null ? <span className="swap-panel__field-usd">≈ ${memeUsd}</span> : null}
          </div>
          <div className="swap-panel__field">
            <div className="swap-panel__field-head">
              <span>{copy.mintSideUasset}</span>
              <span className="swap-panel__balance">
                {copy.balance}:{' '}
                {uExact != null ? (
                  <span data-numeric>{fmtTokenAmountExact(uExact.base, uExact.decimals, locale)}</span>
                ) : myUAssetLive != null ? (
                  <span data-numeric>{formatAmount(myUAssetLive, locale)}</span>
                ) : (
                  '--'
                )}
                <button
                  type="button"
                  className="swap-panel__max"
                  disabled={uExact != null ? uExact.base === 0n : myUAssetLive == null || myUAssetLive <= 0}
                  onClick={() =>
                    onUInput(
                      uExact != null
                        ? trimFractionZeros(formatUnits(uExact.base, uExact.decimals))
                        : amountToInputString(myUAssetLive ?? 0),
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
                value={uAmount}
                maxLength={AMOUNT_MAX_CHARS}
                onChange={(event) => onUInput(sanitizeAmount(event.target.value))}
                aria-label={`${copy.mintSupply} ${verse.raiseAsset}`}
                aria-invalid={uOver || undefined}
                aria-describedby={uOver ? uBalanceErrorId : undefined}
              />
              <div className="swap-panel__token">
                <strong>{verse.raiseAsset}</strong>
              </div>
            </div>
            {uOver ? (
              <FieldError id={uBalanceErrorId}>{common.insufficientBalance}</FieldError>
            ) : null}
            {uUsd != null ? <span className="swap-panel__field-usd">≈ ${uUsd}</span> : null}
          </div>

          <span className="pol-mint__arrow" aria-hidden="true">
            <ArrowDown size={16} />
          </span>

          <div className="swap-panel__field" role="group" aria-labelledby={receiveLabelId}>
            <div className="swap-panel__field-head">
              <span id={receiveLabelId}>{copy.mintYouReceive}</span>
              <span>
                {copy.balance}:{' '}
                {myPolLive != null ? (
                  <>
                    <span data-numeric>{formatAmount(myPolLive, locale)}</span> {polSymbol}
                  </>
                ) : (
                  '--'
                )}
              </span>
            </div>
            <div className="swap-panel__field-row">
              <output
                className="swap-panel__output numeric-input"
                data-numeric
                aria-label={`${copy.mintYouReceive} ${polSymbol}`}
              >
                {polOut != null ? fmtTokenAmount(polOut, locale) : '0.00'}
              </output>
              <div className="swap-panel__token">
                <strong>{polSymbol}</strong>
              </div>
            </div>
          </div>

          {valid ? (
            <dl className="swap-panel__details">
              <div>
                <dt>{copy.swapRate}</dt>
                <dd className="swap-panel__rate">
                  <span data-numeric>
                    {price != null && price > 0
                      ? rateInverted
                        ? `1 ${verse.raiseAsset} ≈ ${fmtTokenAmount(1 / price, locale)} ${verse.symbol}`
                        : `1 ${verse.symbol} ≈ ${fmtTokenAmount(price, locale)} ${verse.raiseAsset}`
                      : '--'}
                  </span>
                  <button
                    type="button"
                    className="swap-panel__rate-flip"
                    onClick={() => setRateInverted((v) => !v)}
                    disabled={!(price != null && price > 0)}
                    aria-label={copy.swapRateFlip}
                  >
                    <ArrowLeftRight aria-hidden="true" size={12} />
                  </button>
                </dd>
              </div>
              <div>
                <dt>{copy.minReceived}</dt>
                <dd data-numeric>
                  {minPol != null ? `${fmtTokenAmount(minPol, locale)} ${polSymbol}` : '--'}
                </dd>
              </div>
              <div>
                <dt>{copy.maxSlippage}</dt>
                <dd data-numeric>{slippageIssue == null ? `${slippage}%` : '--'}</dd>
              </div>
            </dl>
          ) : null}
          <DialogCta
            locale={locale}
            connected={connected}
            onConnect={toggle}
            onAction={() => void startMintReview()}
            label={copy.mintPol}
            connectLabel={copy.swapCta}
            disabled={!valid || memeOver || uOver || slippageIssue != null || !executionReady || resolving || tx.running}
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
        title={copy.mintDialogTitle}
        state={tx.display}
        open={tx.active && !successOpen}
        onDismiss={tx.reset}
      />
      <TxSuccessDialog
        locale={locale}
        title={copy.mintDoneTitle}
        lead={copy.mintDoneLead}
        accent={copy.mintDoneAccent}
        rows={mintRows}
        txHash={receipt?.hash}
        txChainId={receipt?.chainId}
        open={successOpen}
        onOpenChange={setSuccessOpen}
      />
    </>
  )
}

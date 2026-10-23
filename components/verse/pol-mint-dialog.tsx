'use client'

import { useId, useState } from 'react'
import { ArrowDown, ArrowLeftRight } from 'lucide-react'

import type { Locale, FixturePolPosition, FixtureVerse } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { useAccountCenter } from '../global/use-account-center'
import { ActionDialogShell, DialogCta } from '../global/action-dialogs'
import { useTxCenter, type WriteSpec } from '../global/use-tx-center'
import { TxStatus } from '../global/tx-status'
import {
  estimateSession,
  readErc20Meta,
  readErc20State,
  resolveVerseSession,
} from '../global/execution-reads'
import { getActiveEip1193Provider } from '@/lib/web3/active-provider'
import {
  approvalCall,
  buildSessionWrite,
  mintPolCall,
} from '@/lib/web3/session-actions'
import { useParams } from 'next/navigation'
import { formatUnits, parseUnits, type Hex } from 'viem'
import { SwapSettings } from '../global/swap-settings'
import { formatAmount } from '../global/signal-ui'
import { AMOUNT_MAX_CHARS, amountToInputString, sanitizeAmount } from '../global/amount-input'
import { fmtTokenAmount, fmtUsd } from '../global/amount-format'
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
 * Simulated quote: ratio and output are linear-derivation samples (price=main-pool candle close,
 * uAssetPerPol=fixture); meta copy such as "illustrative" or "reads on-chain values" never
 * enters the UI — no disclaimers needed;
 * the CTA does not fake on-chain execution (disconnected=Connect
 * Wallet clickable to toggle connection; connected=Mint disabled).
 */
export function PolMintDialog({
  locale,
  verse,
  pol,
  price,
  uAssetUsd,
}: {
  locale: Locale
  verse: FixtureVerse
  pol: FixturePolPosition
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

  const polSymbol = `POL-${verse.symbol}`
  const memeVal = Number(memeAmount)
  const uVal = Number(uAmount)
  const valid = Number.isFinite(memeVal) && memeVal > 0 && Number.isFinite(uVal) && uVal > 0
  const memeOver = memeVal > pol.myMemecoin
  const uOver = uVal > pol.myUAsset
  // POL output = uAsset side ÷ uAsset-per-POL (linear-derivation sample; production reads on-chain values)
  const polOut = valid && pol.uAssetPerPol > 0 ? uVal / pol.uAssetPerPol : null
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
      const session = await resolveVerseSession({
        request: provider.request,
        chainId,
        eoa,
        verseId: BigInt(verseId),
      })
      const launcher = session.contracts.MemeverseLauncher as Hex
      const [memeDecimals, uDecimals, polDecimals] = await Promise.all([
        readErc20Meta(session.reader, session.verse.memecoin).then((meta) => meta.decimals),
        readErc20Meta(session.reader, session.verse.uAsset).then((meta) => meta.decimals),
        readErc20Meta(session.reader, session.verse.pol).then((meta) => meta.decimals),
      ])
      const memeDesired = parseUnits(memeAmount, memeDecimals)
      const uDesired = parseUnits(uAmount, uDecimals)
      const slippageBps = Math.round(slippage * 100)
      const memeMin = (memeDesired * BigInt(10000 - slippageBps)) / 10000n
      const uMin = (uDesired * BigInt(10000 - slippageBps)) / 10000n
      const outDesired = polOut != null ? parseUnits(String(polOut), polDecimals) : 0n
      const deadlineSecs = BigInt(Math.floor(Date.now() / 1000) + (Number(deadlineText) || 10) * 60)
      const [memeAllow, uAllow] = await Promise.all([
        readErc20State(session.reader, session.verse.memecoin, eoa, launcher).then((state) => state.allowance),
        readErc20State(session.reader, session.verse.uAsset, eoa, launcher).then((state) => state.allowance),
      ])
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
      const { estimatedGas, nativeBalance } = await estimateSession(
        { client: session.client, reader: session.reader, eoa },
        batch,
      )
      const spec: WriteSpec = {
        review: {
          chainId,
          account: eoa,
          targetContract: launcher,
          functionName: 'mintPOLToken',
          inputs: `${formatUnits(memeDesired, memeDecimals)} ${verse.symbol} + ${formatUnits(uDesired, uDecimals)} ${verse.raiseAsset}`,
          minOutput: polOut != null ? `${formatUnits(outDesired, polDecimals)} ${polSymbol}` : '—',
          fee: '—',
          gasPayer: eoa,
          authorizationChange:
            approvals.length > 0
              ? `${verse.symbol} + ${verse.raiseAsset}`
              : '—',
          estimatedGas,
          nativeBalance,
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
      }
      void tx.executeSession(spec)
    } catch {
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
                {copy.balance}: <span data-numeric>{formatAmount(pol.myMemecoin, locale)}</span>
                <button type="button" className="swap-panel__max" onClick={() => onMemeInput(amountToInputString(pol.myMemecoin))}>
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
                {copy.balance}: <span data-numeric>{formatAmount(pol.myUAsset, locale)}</span>
                <button type="button" className="swap-panel__max" onClick={() => onUInput(amountToInputString(pol.myUAsset))}>
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
                {copy.balance}: <span data-numeric>{formatAmount(pol.myPol, locale)}</span> {polSymbol}
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
          
          {tx.active && !tx.reviewing ? <TxStatus locale={locale} state={tx.display} /> : null}
      </ActionDialogShell>
    </Dialog>
  )
}

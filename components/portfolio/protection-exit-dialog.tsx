'use client'

import { useId, useState } from 'react'

import type {
  FixturePolPosition,
  FixtureVerse,
  Locale,
} from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { useAccountCenter } from '../global/use-account-center'
import { useTxCenter, type WriteSpec } from '../global/use-tx-center'
import { TxStatus } from '../global/tx-status'
import {
  estimateSession,
  readErc20Meta,
  readErc20State,
  resolveVerseSession,
} from '../global/execution-reads'
import { parseVerseIdParam } from '../global/routes'
import { getActiveEip1193Provider } from '@/lib/web3/active-provider'
import {
  approvalCall,
  buildSessionWrite,
  redeemMemecoinLiquidityCall,
  redeemMemecoinLiquidityUnwrapCall,
} from '@/lib/web3/session-actions'
import { useParams } from 'next/navigation'
import { formatUnits, parseUnits, type Hex } from 'viem'
import { ActionDialogShell, AmountField, DetailRows, DialogCta } from '../global/action-dialogs'
import { slippageToNumber, getSlippageIssue } from '../global/slippage-input'
import { formatAmount } from '../global/signal-ui'
import { SwapSettings } from '../global/swap-settings'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import { FieldError } from '@/components/ui/field'

/** Protection-window card Exit context (portfolio-page prefetches per protection row; missing
 *  row = the card falls back to jumping to the verse page) */
export type ProtectionExitContext = {
  verse: FixtureVerse
  pol: FixturePolPosition
  /** Main pool price (uAsset per memecoin, last candles close semantics); null = the memecoin
   *  leg renders as 0.00 */
  price: number | null
  /** uAsset USD sample (assets usdSample); null = the USD echo row is not rendered */
  uAssetUsd: number | null
}

/**
 * Protection-window Exit dialog (the to-do zone protection card's Exit opens an in-page dialog,
 * not a jump to the verse page). Mechanism = the two redeemMemecoinLiquidity
 * overloads: LP mode = unwrap=false, POL swapped 1:1 into
 * main-pool LP, direct transfer (price-insensitive, the contract has no slippage param → no gear,
 * same semantics as PolRedeemLpDialog); split mode = unwrap=true, the LP is split on the spot into
 * memecoin+uAsset, the 6-param form mandates minOut×2+deadline (the 3-param unwrap throws
 * SlippageProtectionRequired directly) → the gear
 * (SwapSettings) + Min received/Max slippage rows (pool-remove-liquidity-dialog precedent).
 * Output leg order = the memecoin main leg first, same order as the amount well displays (memecoin
 * leg on top). Leg estimation:
 * uAsset = amount×uAssetPerPol; memecoin = amount×uAssetPerPol÷main pool price (derived from the
 * pool price ratio pro-rata); the ≈$ echo shares PolRedeemPtYtDialog's conversion source; missing
 * sample → the row is not rendered. CTA discipline follows the ActionDialogShell family:
 * disconnected = a clickable Connect, connected = the action button is disabled (no faked
 * settlement); the amount defaults to empty; the insufficient-balance short
 * sentence is handled by AmountField.
 */
export function ProtectionExitDialog({
  locale,
  context,
  triggerLabel,
}: {
  locale: Locale
  context: ProtectionExitContext
  triggerLabel: string
}) {
  const action = getCopy(locale).portfolio.action
  const assetsCopy = getCopy(locale).portfolio.assets
  const common = getCopy(locale).common
  const center = useAccountCenter()
  const { connected, connectAction: toggle } = center
  const tx = useTxCenter()
  const params = useParams()
  const rawVerseId = params?.verseId
  // Numeric verse id: route segment on verse pages, legacy verse-NNN row id on /portfolio.
  const legacy = /^verse-(\d+)$/i.exec(context.verse.id)
  // Legacy fixture ids carry leading zeros (verse-021 → 021); strip before BigInt use.
  const legacyId = legacy ? legacy[1].replace(/^0+(?=\d)/, '') : null
  const verseId = parseVerseIdParam(rawVerseId) ?? legacyId
  const { verse, pol, price, uAssetUsd } = context

  const [mode, setMode] = useState<'lp' | 'split'>('lp')
  const [amount, setAmount] = useState('')
  const [resolving, setResolving] = useState(false)
  const [resolveFailed, setResolveFailed] = useState(false)
  const [slippageText, setSlippageText] = useState('0.5')
  const [deadlineText, setDeadlineText] = useState('10')
  const receiveLabelId = useId()

  const polSymbol = `POL-${verse.symbol}`
  // Main pool LP pair semantics (same as PolRedeemLpDialog: {MEME}/{uAsset} LP)
  const lpSymbol = `${verse.symbol}/${verse.raiseAsset} LP`
  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0
  const executionReady =
    center.source === 'real' &&
    connected &&
    center.chainSupported &&
    center.chainId != null &&
    center.address != null &&
    verseId != null

  async function startExitReview(): Promise<void> {
    if (!executionReady || !valid || resolving) return
    if (mode === 'split' && slippageIssue != null) return
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
      const { decimals } = await readErc20Meta(session.reader, session.verse.pol)
      const amountBase = parseUnits(amount, decimals)
      const { allowance } = await readErc20State(session.reader, session.verse.pol, eoa, launcher)
      const approval =
        allowance < amountBase
          ? approvalCall(session.verse.pol, launcher, amountBase)
          : undefined
      let action
      let functionName: string
      let minOutput: string
      if (mode === 'lp') {
        action = redeemMemecoinLiquidityCall(launcher, { verseId: BigInt(verseId), amountInPOL: amountBase })
        functionName = 'redeemMemecoinLiquidity'
        minOutput = `${formatUnits(amountBase, decimals)} ${verse.symbol}/${verse.raiseAsset} LP`
      } else {
        // currency0/1 order follows the sorted main-pool pair.
        const sorted =
          session.verse.memecoin.toLowerCase() < session.verse.uAsset.toLowerCase()
        const uMin =
          minU != null
            ? parseUnits(String(minU), (await readErc20Meta(session.reader, session.verse.uAsset)).decimals)
            : 0n
        const mMin =
          minM != null
            ? parseUnits(String(minM), (await readErc20Meta(session.reader, session.verse.memecoin)).decimals)
            : 0n
        const deadlineSecs = BigInt(Math.floor(Date.now() / 1000) + (Number(deadlineText) || 10) * 60)
        action = redeemMemecoinLiquidityUnwrapCall(launcher, {
          verseId: BigInt(verseId),
          amountInPOL: amountBase,
          amount0Min: sorted ? mMin : uMin,
          amount1Min: sorted ? uMin : mMin,
          deadline: deadlineSecs,
        })
        functionName = 'redeemMemecoinLiquidity(unwrap)'
        minOutput = [
          minM != null ? `${minM} ${verse.symbol}` : null,
          minU != null ? `${minU} ${verse.raiseAsset}` : null,
        ]
          .filter(Boolean)
          .join(' + ')
      }
      const { calls, calldata: batch } = buildSessionWrite({ hook: session.hook, action, approval })
      const { estimatedGas, nativeBalance } = await estimateSession(
        { client: session.client, reader: session.reader, eoa },
        batch,
      )
      const spec: WriteSpec = {
        review: {
          chainId,
          account: eoa,
          targetContract: launcher,
          functionName,
          inputs: `${formatUnits(amountBase, decimals)} POL-${verse.symbol}`,
          minOutput: minOutput === '' ? '—' : minOutput,
          fee: '—',
          gasPayer: eoa,
          authorizationChange: approval
              ? `${formatUnits(amountBase, decimals)} POL-${verse.symbol}`
              : '—',
          estimatedGas,
          nativeBalance,
        },
        kernel: session.kernel,
        expectedChainId: chainId,
        batchCallData: batch,
        calls,
        quoteId: `exit:${verseId}:${mode}:${amountBase}`,
        minOutput: minOutput === '' ? '—' : minOutput,
        slippageBps: mode === 'split' ? Math.round(slippage * 100) : 0,
        deadline: Math.floor(Date.now() / 1000) + 3600,
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

  // LP mode: the 1:1 main-pool construction identity — no missing-sample slot: 1:1 is exact,
  // no placeholder state
  const lpOut = valid ? parsed : null
  // Split mode: the uAsset leg = uAssetPerPol; the memecoin leg = derived from the main pool
  // price ratio (missing sample → 0.00 slot)
  const uOut = valid ? parsed * pol.uAssetPerPol : null
  const mOut =
    valid && price != null && price > 0 ? (parsed * pol.uAssetPerPol) / price : null

  const slippage = slippageToNumber(slippageText)
  const slippageIssue = getSlippageIssue(slippage)
  const minU = uOut != null && slippageIssue == null ? uOut * (1 - slippage / 100) : null
  const minM = mOut != null && slippageIssue == null ? mOut * (1 - slippage / 100) : null

  // ≈$ echo (same source as PolRedeemPtYtDialog: uAsset leg×uAssetUsd, memecoin
  // leg×price×uAssetUsd)
  const uUsd = uOut != null && uAssetUsd != null ? uOut * uAssetUsd : null
  const mUsd =
    mOut != null && price != null && uAssetUsd != null ? mOut * price * uAssetUsd : null

  return (
    <Dialog>
      {/* data-slot pinned back to button: the theme bridge matches the skin by
          [data-slot='button']; the card-bottom CTA uses the same style */}
      <DialogTrigger data-slot="button" render={<Button variant="outline" />}>
        {triggerLabel}
      </DialogTrigger>
      <ActionDialogShell
        title={action.exitTitle}
        closeLabel={common.close}
        toolbar={
          mode === 'split' ? (
            <SwapSettings
              locale={locale}
              settingsLabel={action.exitSettingsTitle}
              slippageTip={action.exitSlippageTip}
              slippageValue={slippageText}
              onSlippageValue={setSlippageText}
              deadline={{
                tip: action.exitDeadlineTip,
                value: deadlineText,
                onValue: setDeadlineText,
              }}
            />
          ) : undefined
        }
      >
        <div className="pf-dialog__chips" role="group" aria-label={action.exitTitle}>
          <button
            type="button"
            data-selected={mode === 'lp' || undefined}
            onClick={() => setMode('lp')}
          >
            {action.exitModeLp}
          </button>
          <button
            type="button"
            data-selected={mode === 'split' || undefined}
            onClick={() => setMode('split')}
          >
            {action.exitModeSplit.replace('{m}', verse.symbol).replace('{u}', verse.raiseAsset)}
          </button>
        </div>

        <AmountField
          locale={locale}
          label={polSymbol}
          balance={pol.myPol}
          balanceLabel={assetsCopy.balance}
          maxLabel={assetsCopy.max}
          value={amount}
          onValue={setAmount}
          tokenSymbol={polSymbol}
          ariaLabel={`${action.exitTitle} ${polSymbol}`}
        />

        {/* Receive box: LP = single leg; split = two legs in one box (memecoin main leg first; the
            inter-row hairline comes from the ~ sibling selector — same as pool-remove-liquidity) */}
        {mode === 'lp' ? (
          <div className="swap-panel__field" role="group" aria-labelledby={receiveLabelId}>
            <div className="swap-panel__field-head">
              <span id={receiveLabelId}>{action.exitReceive}</span>
            </div>
            <div className="swap-panel__field-row">
              <output
                className="swap-panel__output numeric-input"
                data-numeric
                aria-label={`${action.exitReceive} ${lpSymbol}`}
              >
                {lpOut != null ? formatAmount(lpOut, locale) : '0.00'}
              </output>
              <div className="swap-panel__token">
                <strong>{lpSymbol}</strong>
              </div>
            </div>
          </div>
        ) : (
          <div className="swap-panel__field" role="group" aria-labelledby={receiveLabelId}>
            <div className="swap-panel__field-head">
              <span id={receiveLabelId}>{action.exitReceive}</span>
            </div>
            <div className="swap-panel__field-row">
              <output
                className="swap-panel__output numeric-input"
                data-numeric
                aria-label={`${action.exitReceive} ${verse.symbol}`}
              >
                {mOut != null ? formatAmount(mOut, locale) : '0.00'}
              </output>
              <div className="swap-panel__token">
                <strong>{verse.symbol}</strong>
              </div>
            </div>
            {mUsd != null ? (
              <span className="swap-panel__field-usd">≈ ${formatAmount(mUsd, locale)}</span>
            ) : null}
            <div className="swap-panel__field-row">
              <output
                className="swap-panel__output numeric-input"
                data-numeric
                aria-label={`${action.exitReceive} ${verse.raiseAsset}`}
              >
                {uOut != null ? formatAmount(uOut, locale) : '0.00'}
              </output>
              <div className="swap-panel__token">
                <strong>{verse.raiseAsset}</strong>
              </div>
            </div>
            {uUsd != null ? (
              <span className="swap-panel__field-usd">≈ ${formatAmount(uUsd, locale)}</span>
            ) : null}
          </div>
        )}

        {/* minOut×2+deadline is contract-enforced (SlippageProtectionRequired) → detail rows in
            split mode (same as pool-remove-liquidity: Min received legs joined with ' + ',
            Max slippage) */}
        {mode === 'split' && valid ? (
          <DetailRows
            rows={[
              [
                action.exitMinReceived,
                <span key="min" data-numeric>
                  {minM != null || minU != null
                    ? [
                        minM != null ? `${formatAmount(minM, locale)} ${verse.symbol}` : null,
                        minU != null ? `${formatAmount(minU, locale)} ${verse.raiseAsset}` : null,
                      ]
                        .filter(Boolean)
                        .join(' + ')
                    : '--'}
                </span>,
              ],
              [
                action.exitMaxSlippage,
                <span key="slip" data-numeric>
                  {slippageIssue == null ? `${slippage}%` : '--'}
                </span>,
              ],
            ]}
          />
        ) : null}

        <DialogCta
          locale={locale}
          connected={connected}
          onConnect={toggle}
          onAction={() => void startExitReview()}
          label={action.exitCta}
          disabled={!valid || !executionReady || resolving || tx.running}
        />
        {resolveFailed ? <FieldError>{common.degrade.errorBody}</FieldError> : null}
        
        {tx.active && !tx.reviewing ? <TxStatus locale={locale} state={tx.display} /> : null}
      </ActionDialogShell>
    </Dialog>
  )
}

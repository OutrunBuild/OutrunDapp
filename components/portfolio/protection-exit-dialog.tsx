'use client'

import { useId, useState } from 'react'

import type {
  FixturePolPosition,
  FixtureVerse,
  Locale,
} from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { useMockWallet } from '../global/mock-wallet'
import { formatAmount } from '../global/signal-ui'
import { ActionDialogShell, AmountField, DetailRows, DialogCta } from '../global/action-dialogs'
import { slippageToNumber, getSlippageIssue } from '../global/slippage-input'
import { SwapSettings } from '../global/swap-settings'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'

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
  const { connected, toggle } = useMockWallet()
  const { verse, pol, price, uAssetUsd } = context

  const [mode, setMode] = useState<'lp' | 'split'>('lp')
  const [amount, setAmount] = useState('')
  const [slippageText, setSlippageText] = useState('0.5')
  const [deadlineText, setDeadlineText] = useState('10')
  const receiveLabelId = useId()

  const polSymbol = `POL-${verse.symbol}`
  // Main pool LP pair semantics (same as PolRedeemLpDialog: {MEME}/{uAsset} LP)
  const lpSymbol = `${verse.symbol}/${verse.raiseAsset} LP`
  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0

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

        <DialogCta locale={locale} connected={connected} onConnect={toggle} label={action.exitCta} />
      </ActionDialogShell>
    </Dialog>
  )
}

'use client'

import { useId, useState } from 'react'
import { ArrowDown, ArrowLeftRight } from 'lucide-react'

import type { Locale, FixturePolPosition, FixtureVerse } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { useMockWallet } from '../global/mock-wallet'
import { ActionDialogShell, DialogCta } from '../global/action-dialogs'
import { SwapSettings } from '../global/swap-settings'
import { formatAmount } from '../global/signal-ui'
import { AMOUNT_MAX_CHARS, amountToInputString, sanitizeAmount } from '../global/amount-input'
import { fmtTokenAmount, fmtUsd } from '../global/amount-format'
import { getSlippageIssue, slippageToNumber } from '../global/slippage-input'
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
 * Wallet clickable to toggle mock connection; connected=Mint disabled).
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
  const { connected, toggle } = useMockWallet()
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
            label={copy.mintPol}
            connectLabel={copy.swapCta}
          />
      </ActionDialogShell>
    </Dialog>
  )
}

'use client'

import { useId, useState } from 'react'
import { ArrowDown, ArrowLeftRight } from 'lucide-react'

import type { Locale, FixturePolPosition, FixtureVerseTrade } from '@/lib/data/fixture-repository'

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
 * Add Liquidity dialog (the Liquidity pool card's Add button; functional structure same as the
 * Mint POL dialog, visuals reuse the .pol-mint-*
 * shell). Mechanism:
 * all four pools unified=router addLiquidity: both sides supplied at the pool ratio, LP tokens
 * minted honoring both sides' desired/min + deadline —
 * LP minted amount = quote side × lpPerQuote (markets fixture mint-rate sample,
 * totalSupply/R_quote — the classic v2-style
 * formula; all four pools ship a mint-rate sample so the output always derives; a pool missing
 * the sample would degrade to 0.00 — samples are fabricated to produce numbers,
 * no empty slots).
 * Add Liquidity yields LP, not POL — the mintPOLToken entry, which
 * mints POL 1:1 to the main pool by the added amount, belongs to the Tokenization tab's Mint
 * dialog (PolMintDialog); the two entries are mechanically separate.
 * Ratio linkage: main pool=main-pool price (tokenStats.price), POL/uAsset=fixture
 * marketPricePerPol sample, the two PT pools=anchor-rate derivation sample (see the
 * ptAnchorRatio note below).
 * Same discipline as Mint: the quote is a linear-derivation sample; CTA disconnected=
 * Connect Wallet clickable to toggle mock connection,
 * connected=Add Liquidity disabled, no faked on-chain execution.
 */
export function PoolAddLiquidityDialog({
  locale,
  pool,
  pol,
  price,
  uAssetUsd,
}: {
  locale: Locale
  /** Pool card row data (pool identifier + both sides' symbols) */
  pool: FixtureVerseTrade['pools'][number]
  /** POL/PT position sample (source of balances/ratios); null=slot state (balance '--') */
  pol: FixturePolPosition | null
  /** Main-pool price: 1 memecoin = price uAsset (used only for main-pool linkage); null=no sample */
  price: number | null
  /** uAsset USD sample price; null=hide the USD conversion row */
  uAssetUsd: number | null
}) {
  const copy = getCopy(locale).verseDesk
  const common = getCopy(locale).common
  const { connected, toggle } = useMockWallet()
  const [baseAmount, setBaseAmount] = useState('')
  const receiveLabelId = useId()
  const baseBalanceErrorId = useId()
  const quoteBalanceErrorId = useId()
  const [quoteAmount, setQuoteAmount] = useState('')
  // The settings-layer controlled value is stored as a string and shown verbatim
  // (keep the trailing dot instead of swallowing it, inline error for non-whole minutes),
  // numeric derivation goes through slippageToNumber
  const [slippageText, setSlippageText] = useState('0.5')
  const [deadlineText, setDeadlineText] = useState('10')
  const [rateInverted, setRateInverted] = useState(false)

  // Supply-side balances: main pool=memecoin/uAsset, POL/uAsset=POL/uAsset, PT pools=PT/+ (uAsset or POL)
  const baseBalance =
    pol == null
      ? null
      : pool.pool === 'main'
        ? pol.myMemecoin
        : pool.pool === 'pol-uasset'
          ? pol.myPol
          : pol.myPt
  const quoteBalance = pol == null ? null : pool.pool === 'pt-pol' ? pol.myPol : pol.myUAsset
  // POL/uAsset pool market price sample (shared by the POL side's ≈$ conversion and the PT/POL pool's quote side)
  const polPrice = pol?.marketPricePerPol ?? null
  // LP name = same pair scope as the pool card + LP suffix (the v4 position system has no ERC20
  // LP naming source of truth;
  // display-layer naming follows industry convention; each of the four pools gets its own name)
  const lpSymbol = `${pool.baseSymbol}/${pool.quoteSymbol} LP`
  // 1 base = ratio quote. The two PT pools use anchor-rate derived samples (never
  // non-linked/'--'): 1 PT = uAssetPerPol uAsset (fixed redemption rate);
  // the PT/POL pool then converts via the POL/uAsset market price: 1 PT = uAssetPerPol÷marketPricePerPol POL
  const ptAnchorRatio =
    pol != null && pol.marketPricePerPol > 0
      ? pool.pool === 'pt-uasset'
        ? pol.uAssetPerPol
        : pol.uAssetPerPol / pol.marketPricePerPol
      : null
  const ratio =
    pool.pool === 'main' ? price : pool.pool === 'pol-uasset' ? polPrice : ptAnchorRatio
  const baseVal = Number(baseAmount)
  const quoteVal = Number(quoteAmount)
  const valid = Number.isFinite(baseVal) && baseVal > 0 && Number.isFinite(quoteVal) && quoteVal > 0
  const baseOver = baseBalance != null && baseVal > baseBalance
  const quoteOver = quoteBalance != null && quoteVal > quoteBalance
  // LP minted = quote side × lpPerQuote (mint rate fixture sample, linear derivation; production reads on-chain values)
  const lpOut = valid && pool.lpPerQuote != null && pool.lpPerQuote > 0 ? quoteVal * pool.lpPerQuote : null
  // Slippage validation (see getSlippageIssue/slippageToNumber in global/slippage-input):
  // while out of bounds, protected-value derivation falls back to the '--' slot
  const slippage = slippageToNumber(slippageText)
  const slippageIssue = getSlippageIssue(slippage)
  const minLp = lpOut != null && slippageIssue == null ? lpOut * (1 - slippage / 100) : null

  // Two-side linkage: pools with a ratio sample back-compute the other side via ratio (same as
  // PolMintDialog, clearing one side also clears the other);
  // ratio missing (PT pools without a pol record) → both sides input independently without interference
  const onBaseInput = (raw: string) => {
    setBaseAmount(raw)
    if (ratio == null || ratio <= 0) return
    const value = Number(raw)
    setQuoteAmount(value > 0 ? amountToInputString(value * ratio) : '')
  }
  const onQuoteInput = (raw: string) => {
    setQuoteAmount(raw)
    if (ratio == null || ratio <= 0) return
    const value = Number(raw)
    setBaseAmount(value > 0 ? amountToInputString(value / ratio) : '')
  }

  // display formatting goes through global/amount-format (fmtUsd/fmtTokenAmount) — raw float
  // products carry precision noise;
  // ≈$ conversion prices (in uAsset): base side main pool/POL pool have market price samples,
  // PT side=anchor rate uAssetPerPol;
  // quote side uAsset=1, PT/POL pool=polPrice
  const baseUsdPrice =
    pool.pool === 'main' ? price : pool.pool === 'pol-uasset' ? polPrice : pol?.uAssetPerPol ?? null
  const quoteUsdPrice = pool.pool === 'pt-pol' ? polPrice : 1
  const baseUsd =
    uAssetUsd == null || !valid || baseUsdPrice == null || baseUsdPrice <= 0
      ? null
      : fmtUsd(baseVal * baseUsdPrice * uAssetUsd, locale)
  const quoteUsd =
    uAssetUsd == null || !valid || quoteUsdPrice == null || quoteUsdPrice <= 0
      ? null
      : fmtUsd(quoteVal * quoteUsdPrice * uAssetUsd, locale)

  return (
    <Dialog>
      {/* data-slot pinned back to button: same as PolMintDialog — the theme bridge matches skins
          on [data-slot='button'];
          .pool-card [data-slot='button'] pool card row styling keeps matching */}
      <DialogTrigger data-slot="button" render={<Button variant="outline" size="sm" />}>
        {/* The pool card button uses the short copy Add (dialog title/CTA keep the full name) */}
        {copy.addLiquidityShort}
      </DialogTrigger>
      <ActionDialogShell
        title={copy.addLiquidityDialogTitle}
        closeLabel={common.close}
        toolbar={
          <SwapSettings
            locale={locale}
            settingsLabel={copy.addLiquiditySettingsTitle}
            slippageTip={copy.addLiquiditySlippageTip}
            slippageValue={slippageText}
            onSlippageValue={setSlippageText}
            deadline={{
              tip: copy.addLiquidityDeadlineTip,
              value: deadlineText,
              onValue: setDeadlineText,
            }}
          />
        }
      >

          <span className="pol-mint__label">{copy.mintSupply}</span>
          <div className="swap-panel__field">
            <div className="swap-panel__field-head">
              <span>{pool.baseSymbol}</span>
              <span className="swap-panel__balance">
                {copy.balance}:{' '}
                {baseBalance == null ? (
                  '--'
                ) : (
                  <span data-numeric>{formatAmount(baseBalance, locale)}</span>
                )}
                <button
                  type="button"
                  className="swap-panel__max"
                  disabled={baseBalance == null || baseBalance <= 0}
                  onClick={() => onBaseInput(amountToInputString(baseBalance ?? 0))}
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
                value={baseAmount}
                maxLength={AMOUNT_MAX_CHARS}
                onChange={(event) => onBaseInput(sanitizeAmount(event.target.value))}
                aria-label={`${copy.addLiquidityDialogTitle} ${pool.baseSymbol}`}
                aria-invalid={baseOver || undefined}
                aria-describedby={baseOver ? baseBalanceErrorId : undefined}
              />
              <div className="swap-panel__token">
                <strong>{pool.baseSymbol}</strong>
              </div>
            </div>
            {baseOver ? (
              <FieldError id={baseBalanceErrorId}>{common.insufficientBalance}</FieldError>
            ) : null}
            {baseUsd != null ? <span className="swap-panel__field-usd">≈ ${baseUsd}</span> : null}
          </div>
          <div className="swap-panel__field">
            <div className="swap-panel__field-head">
              <span>{pool.quoteSymbol}</span>
              <span className="swap-panel__balance">
                {copy.balance}:{' '}
                {quoteBalance == null ? (
                  '--'
                ) : (
                  <span data-numeric>{formatAmount(quoteBalance, locale)}</span>
                )}
                <button
                  type="button"
                  className="swap-panel__max"
                  disabled={quoteBalance == null || quoteBalance <= 0}
                  onClick={() => onQuoteInput(amountToInputString(quoteBalance ?? 0))}
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
                value={quoteAmount}
                maxLength={AMOUNT_MAX_CHARS}
                onChange={(event) => onQuoteInput(sanitizeAmount(event.target.value))}
                aria-label={`${copy.addLiquidityDialogTitle} ${pool.quoteSymbol}`}
                aria-invalid={quoteOver || undefined}
                aria-describedby={quoteOver ? quoteBalanceErrorId : undefined}
              />
              <div className="swap-panel__token">
                <strong>{pool.quoteSymbol}</strong>
              </div>
            </div>
            {quoteOver ? (
              <FieldError id={quoteBalanceErrorId}>{common.insufficientBalance}</FieldError>
            ) : null}
            {quoteUsd != null ? <span className="swap-panel__field-usd">≈ ${quoteUsd}</span> : null}
          </div>

          <span className="pol-mint__arrow" aria-hidden="true">
            <ArrowDown size={16} />
          </span>

          <div className="swap-panel__field" role="group" aria-labelledby={receiveLabelId}>
            <div className="swap-panel__field-head">
              <span id={receiveLabelId}>{copy.mintYouReceive}</span>
            </div>
            <div className="swap-panel__field-row">
              <output
                className="swap-panel__output numeric-input"
                data-numeric
                aria-label={`${copy.mintYouReceive} ${lpSymbol}`}
              >
                {lpOut != null ? fmtTokenAmount(lpOut, locale) : '0.00'}
              </output>
              <div className="swap-panel__token">
                <strong>{lpSymbol}</strong>
              </div>
            </div>
          </div>

          {valid ? (
            <dl className="swap-panel__details">
              <div>
                <dt>{copy.swapRate}</dt>
                <dd className="swap-panel__rate">
                  <span data-numeric>
                    {ratio != null && ratio > 0
                      ? rateInverted
                        ? `1 ${pool.quoteSymbol} ≈ ${fmtTokenAmount(1 / ratio, locale)} ${pool.baseSymbol}`
                        : `1 ${pool.baseSymbol} ≈ ${fmtTokenAmount(ratio, locale)} ${pool.quoteSymbol}`
                      : '--'}
                  </span>
                  <button
                    type="button"
                    className="swap-panel__rate-flip"
                    onClick={() => setRateInverted((v) => !v)}
                    disabled={!(ratio != null && ratio > 0)}
                    aria-label={copy.swapRateFlip}
                  >
                    <ArrowLeftRight aria-hidden="true" size={12} />
                  </button>
                </dd>
              </div>
              <div>
                <dt>{copy.minReceived}</dt>
                <dd data-numeric>
                  {minLp != null ? `${fmtTokenAmount(minLp, locale)} ${lpSymbol}` : '--'}
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
            label={copy.addLiquidity}
            connectLabel={copy.swapCta}
          />
      </ActionDialogShell>
    </Dialog>
  )
}

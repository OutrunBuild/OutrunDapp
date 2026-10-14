'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
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
import type { Locale, FixtureAsset, FixtureYieldSource } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { localePath } from '../global/routes'
import { formatAmount, ProgressMeter, SourceRef } from '../global/signal-ui'
import { AMOUNT_MAX_CHARS, amountToInputString, sanitizeAmount } from '../global/amount-input'
import { TxStatus } from '../global/tx-status'
import { useTxSimulation } from '../global/tx-simulation'

// Preorder is an independent path at the same level as standard/leverage genesis; standard/leverage modes offer one-click preorder
type ParticipationMode = 'standard' | 'leverage' | 'preorder'
// credit=leverage interest paid directly as genesis credits (leverage mode only; one of the two interest payment methods, burned at lock time)
// direct=direct participation: raise uAsset direct payment and reserve-asset par direct swap merged into one path (distinguished by the payment asset dropdown)
type ParticipationRoute = 'direct' | 'stake' | 'credit'

// Preorder capacity formula coefficient (capacity=(standard funds+leverage debt principal)×70%×capacity ratio; one-off ratio, not annualized)
const PREORDER_CAP_RATE = 0.7

/** Help copy template fill: {asset}=selected payment asset, {raise}=this Verse's raise uAsset symbol */
function fill(template: string, values: { asset: string; raise: string }) {
  return template.replace(/\{asset\}/g, values.asset).replace(/\{raise\}/g, values.raise)
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
  // Tx signing simulation: after confirmation the frontend advances on a timer, no wallet
  const { txState, beginSigning, resetTx } = useTxSimulation()
  const [invalid, setInvalid] = useState(false)
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
  // Leverage: one-off interest rate (locked at registration, not annualized); borrowed funds=interest÷rate (UI term; mechanism basis is the POLend debt quota); headroom=debt cap−debt built
  const leverageRate = leverageInterestRate != null && leverageInterestRate > 0 ? leverageInterestRate : null
  const leverageReady = leverageRate != null && leverageDebtCap != null
  const leverageCurrentDebt = leverageRate != null ? leverageInterestRaised / leverageRate : null
  const leverageQuota = leverageRate != null && numericAmount > 0 ? numericAmount / leverageRate : null
  const leverageHeadroom =
    leverageRate != null && leverageDebtCap != null && leverageCurrentDebt != null
      ? Math.max(leverageDebtCap - leverageCurrentDebt, 0)
      : null
  const leverageExceeded = leverageQuota != null && leverageHeadroom != null && leverageQuota > leverageHeadroom
  // Stake path conversion: sy asset converted to uAsset at real-time value (fixture anchorValue sample rate; a missing rate sample does not open a placeholder slot — it falls back to par 1);
  // direct=par 1:1 direct swap (PSM par, directHelp scope)
  const convertedAmount = numericAmount * (effectiveRoute === 'stake' ? (payAssetRecord?.anchorValue ?? 1) : 1)
  // One-click preorder cap=genesis funds converted to uAsset (direct=PSM par 1:1, stake=anchorValue rate; leverage=borrowed funds)×70%×capacity ratio; missing capacity ratio=null → slot only
  const genesisFunds = mode === 'leverage' ? (leverageQuota ?? 0) : convertedAmount
  const preorderCap =
    preorderCapacityRatio != null && genesisFunds > 0
      ? genesisFunds * PREORDER_CAP_RATE * preorderCapacityRatio
      : null
  const preorderExceeded = preorderCap != null && numericPreorder > preorderCap
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
  // Preorder payment asset independently selectable (par 1:1, value equals the denominated amount): the preorder tab uses the main selection, one-click preorder uses the preorder asset selection, both fall back to the raise uAsset
  const effectivePreorderAsset =
    preorderAssets.find((item) => item.symbol === preorderAsset)?.symbol ?? preorderAssets[0]?.symbol ?? ''
  const preorderRowAsset = preorderOnly ? payAsset : effectivePreorderAsset
  const payRows: Array<{ label: string; amount: number; asset: string }> = preorderOnly
    ? [{ label: copy.verse.preorderAmountLabel, amount: preorderRowAmount, asset: preorderRowAsset }]
    : [
        {
          label: mode === 'leverage' ? copy.verse.leverageInterestLabel : copy.verse.payAmount,
          amount: numericAmount,
          asset: payAsset,
        },
        ...(preorderEnabled
          ? [{ label: copy.verse.preorderAmountLabel, amount: preorderRowAmount, asset: preorderRowAsset }]
          : []),
      ]
  const sameAssetPay = payRows.length > 1 && payRows.every((row) => row.asset === payRows[0].asset)
  const totalPaid = sameAssetPay ? payRows.reduce((sum, row) => sum + row.amount, 0) : null
  // Preorder funds buy in only after the main pool opens, not into genesis — preorder-only has no into-genesis group
  const genesisRow = preorderOnly
    ? null
    : mode === 'leverage'
      ? { label: copy.verse.leverageDebtQuota, amount: leverageQuota ?? 0 }
      : { label: copy.verse.genesisAmount, amount: convertedAmount }

  function resetReview() {
    setReviewing(false)
    resetTx()
    setInvalid(false)
  }

  // Payment asset wallet balance (source of Balance/Max; snapshot-missing symbol=undefined → null slot state)
  const walletBalance = walletBalances[payAsset] ?? null
  const preorderWalletBalance = walletBalances[effectivePreorderAsset] ?? null
  // Insufficient balance: balance known and input > balance; existing cap-type errors take display priority, single error row
  const balanceShort =
    walletBalance != null && Number.isFinite(numericAmount) && numericAmount > walletBalance
  const showBalanceShort =
    balanceShort && !preorderTabExceeded && !(mode === 'leverage' && leverageExceeded)
  const preorderBalanceShort =
    preorderWalletBalance != null &&
    Number.isFinite(numericPreorder) &&
    numericPreorder > preorderWalletBalance

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

  if (reviewing) {
    return (
      <div className="participation-review" aria-live="polite">
        <div className="participation-review__heading">
          <span className="review-check" aria-hidden="true">
            <Check />
          </span>
          <div>
            <h3>{copy.verse.reviewTitle}</h3>
          </div>
        </div>
        <div className="participation-review__rows">
          <div className="participation-review__row">
            <span>{copy.verse.modeLabel}</span>
            <span>{modeLabel}</span>
          </div>
          <div className="participation-review__row">
            <span>{copy.verse.payAsset}</span>
            <span data-numeric>{payAsset}</span>
          </div>
        </div>
        {genesisRow ? (
          <section
            className="participation-review__group participation-review__group--genesis"
            aria-label={copy.verse.genesisGroupTitle}
          >
            <h4 className="participation-review__group-label">{copy.verse.genesisGroupTitle}</h4>
            <div className="participation-review__rows">
              <div className="participation-review__row participation-review__row--genesis">
                <span>{genesisRow.label}</span>
                <span data-numeric>
                  {formatAmount(genesisRow.amount, locale)} {raiseAssetSymbol}
                </span>
              </div>
            </div>
          </section>
        ) : null}
        <section className="participation-review__group" aria-label={copy.verse.payGroupTitle}>
          <h4 className="participation-review__group-label">{copy.verse.payGroupTitle}</h4>
          <div className="participation-review__rows">
            {payRows.map((row) => (
              <div key={row.label} className="participation-review__row">
                <span>{row.label}</span>
                <span data-numeric>
                  {formatAmount(row.amount, locale)} {row.asset}
                </span>
              </div>
            ))}
            {totalPaid != null ? (
              <div className="participation-review__row participation-review__row--total">
                <span>{copy.verse.totalPaid}</span>
                <span data-numeric>
                  {formatAmount(totalPaid, locale)} {payRows[0].asset}
                </span>
              </div>
            ) : null}
          </div>
        </section>
        <SourceRef value={sourceRef} />
        {txState === 'idle' ? (
          <div className="participation-review__actions">
            <Button
              variant="outline"
              onClick={() => {
                setReviewing(false)
                resetTx()
              }}
            >
              <RotateCcw data-icon="inline-start" aria-hidden="true" />
              {copy.verse.revise}
            </Button>
            <Button className="ax-ghost-cta" onClick={beginSigning}>
              {copy.verse.confirmPrototype}
            </Button>
          </div>
        ) : txState === 'confirmed' ? (
          <div className="tx-success">
            <div className="tx-success__head">
              <span className="review-check" aria-hidden="true">
                <Check />
              </span>
              <p className="tx-success__title">{copy.verse.participateDone}</p>
            </div>
            <Button
              className="ax-ghost-cta"
              nativeButton={false}
              render={<Link href={localePath(locale, '/portfolio')} />}
            >
              {copy.verse.viewPortfolio}
            </Button>
          </div>
        ) : (
          <TxStatus locale={locale} state={txState} />
        )}
      </div>
    )
  }

  return (
    <form
      className="participation-form"
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
        setReviewing(true)
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
                if (!value[0]) return
                setMode(value[0] as ParticipationMode)
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
                {/* Payment-method description right under the Pay with dropdown: preorder/standard/leverage direct/credit uniformly dispatched */}
                <FieldDescription>
                  {fill(
                    preorderOnly
                      ? payAsset === raiseAssetSymbol
                        ? copy.verse.uassetHelp
                        : copy.verse.directHelp
                      : effectiveRoute === 'credit'
                        ? copy.verse.leverageCreditHelp
                        : payAsset === raiseAssetSymbol
                          ? mode === 'leverage'
                            ? copy.verse.leverageUassetHelp
                            : copy.verse.uassetHelp
                          : mode === 'leverage'
                            ? copy.verse.leverageDirectHelp
                            : copy.verse.directHelp,
                    { asset: payAsset, raise: raiseAssetSymbol },
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
                  {preorderCap != null ? (
                    <FieldDescription>
                      {copy.verse.preorderCapLabel}
                      {' '}
                      <b data-numeric>
                        {formatAmount(preorderCap, locale)} {raiseAssetSymbol}
                      </b>
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
      <Button
        type="submit"
        className="ax-ghost-cta"
        size="lg"
        disabled={(mode === 'leverage' && !leverageReady) || (preorderOnly && versePreorderRemaining == null)}
      >
        {copy.verse.review}
      </Button>
    </form>
  )
}

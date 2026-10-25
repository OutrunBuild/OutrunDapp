'use client'

import type { Ref } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

import type { GasQuote } from './use-gas-quote'
import { sanitizeGwei } from './use-gas-quote'

/**
 * Gas presentational halves. The review dialog swaps its body
 * between the summary row and this editor — no stacked overlay. State lives in
 * `useGasQuote`; the page owns the fade transition.
 */
export function GasSummaryRow({
  label,
  value,
  usd,
  onEdit,
  buttonRef,
}: {
  label: string
  value: string
  usd: string | null
  onEdit: () => void
  buttonRef?: Ref<HTMLButtonElement>
}) {
  return (
    <button ref={buttonRef} type="button" className="gas-row" onClick={onEdit}>
      <span className="gas-row__label">{label}</span>
      <span className="gas-row__value">
        <span data-numeric>{value}</span>
        {usd ? (
          <span className="gas-row__usd" data-numeric>
            ({usd})
          </span>
        ) : null}
      </span>
      <ChevronRight aria-hidden="true" className="gas-row__chevron" />
    </button>
  )
}

export function GasEditor({
  quote,
  title,
  onDone,
}: {
  quote: GasQuote
  title: string
  onDone: () => void
}) {
  return (
    <div className="gas-editor">
      <div className="gas-editor__options" role="radiogroup" aria-label={title}>
        {quote.options.map((option) => (
          <button
            key={option.key}
            type="button"
            role="radio"
            aria-checked={quote.mode === option.key}
            className="gas-option"
            data-active={quote.mode === option.key ? 'true' : undefined}
            onClick={() => quote.select(option.key)}
          >
            <span className="gas-option__label">{option.label}</span>
            <span className="gas-option__gwei" data-numeric>
              {option.gwei} {quote.gweiUnit}
            </span>
            <span className="gas-option__fee">
              {option.usd ? <i data-numeric>≈ {option.usd}</i> : null}
              <span data-numeric>
                {option.fee} {quote.symbol}
              </span>
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="gas-editor__custom"
        aria-expanded={quote.customOpen}
        data-active={quote.mode === 'custom' ? 'true' : undefined}
        onClick={quote.toggleCustom}
      >
        <span>{quote.customLabel}</span>
        <ChevronDown aria-hidden="true" className="size-3.5" />
      </button>

      {quote.customOpen ? (
        <div className="gas-custom">
          <div className="gas-custom__fields">
            <label className="gas-custom__field">
              <span className="gas-custom__field-label">{quote.baseLabel}</span>
              <span className="gas-custom__input">
                <input
                  className="numeric-input"
                  inputMode="decimal"
                  aria-invalid={quote.baseInvalid || undefined}
                  value={quote.baseGwei}
                  onChange={(event) => quote.setBase(sanitizeGwei(event.target.value))}
                />
                <i>{quote.gweiUnit}</i>
              </span>
              <span className="gas-custom__hint">{quote.baseHint}</span>
            </label>

            <label className="gas-custom__field">
              <span className="gas-custom__field-label">{quote.tipLabel}</span>
              <span className="gas-custom__input">
                <input
                  className="numeric-input"
                  inputMode="decimal"
                  aria-invalid={quote.tipInvalid || undefined}
                  value={quote.tipGwei}
                  onChange={(event) => quote.setTip(sanitizeGwei(event.target.value))}
                />
                <i>{quote.gweiUnit}</i>
              </span>
              <span className="gas-custom__hint">{quote.tipHint}</span>
            </label>
          </div>

          <div className="gas-custom__total">
            <span>{quote.feeLabel}</span>
            <span data-numeric>{quote.customFee}</span>
          </div>
        </div>
      ) : null}

      <Button type="button" size="lg" className="ax-ghost-cta gas-editor__done" onClick={onDone}>
        {quote.doneLabel}
      </Button>
    </div>
  )
}

'use client'

/**
 * Swap settings layer (slippage/deadline gear Popover) — the sole implementation shared
 * by the swap card and the verse trade dialog family (Mint POL/add liquidity/remove
 * liquidity/Flash Swap) and the portfolio protection-exit dialog. Controlled convention:
 * value stores the string as typed —
 * typing intermediate states (trailing dot/empty string) never pass through Number()
 * into storage; a number state would silently swallow 0.25 into 25, making the
 * whole-minute in-place error unreachable; value derivation happens at the consumer via
 * slippageToNumber/deadlineToNumber.
 * The error id internally uses useId (one instance per card in pool dialogs to avoid
 * collisions).
 */
import { useId } from 'react'
import { Info, Settings2 } from 'lucide-react'

import type { Locale } from '@/lib/data/fixture-repository'

import { getCopy } from './copy'
import { sanitizeAmount } from './amount-input'
import {
  DEADLINE_PRESETS,
  SLIPPAGE_PRESETS,
  deadlineToNumber,
  getSlippageIssue,
  isWholeMinutes,
  slippageErrorCopyKey,
  slippageToNumber,
} from './slippage-input'
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** Explanation bubble next to setting/detail-row labels (reuses the create page's ⊙ tip
 * language; equally usable in detail-row contexts) */
export function SettingsTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger className="create-info" aria-label={text}>
        <Info aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  )
}

/** Gear settings layer (controlled component): slippage/deadline values are
 * display-as-typed strings; preset clicks write back String(preset); omitting the
 * deadline group = the deadline row is not rendered (for contracts without a deadline
 * param, e.g. Flash Swap — an optional limit price + expiry is out of scope, matching
 * its component header note) */
export function SwapSettings({
  locale,
  settingsLabel,
  slippageTip,
  slippageValue,
  onSlippageValue,
  deadline,
}: {
  locale: Locale
  /** Gear aria-label (named per context: swap card/Mint/add liquidity/remove
   * liquidity…) */
  settingsLabel: string
  slippageTip: string
  slippageValue: string
  onSlippageValue: (next: string) => void
  deadline?: {
    tip: string
    value: string
    onValue: (next: string) => void
  }
}) {
  const copy = getCopy(locale).verseDesk
  const slippageErrorId = useId()
  const deadlineErrorId = useId()
  const slippageIssue = getSlippageIssue(slippageToNumber(slippageValue))
  const deadlineValid = deadline != null ? isWholeMinutes(deadlineToNumber(deadline.value)) : true

  return (
    <Popover>
      <PopoverTrigger
        className="swap-panel__settings-toggle"
        aria-label={settingsLabel}
        render={
          <button type="button">
            <Settings2 aria-hidden="true" />
          </button>
        }
      />
      <PopoverContent className="swap-settings" side="bottom" align="end">
        <div className="swap-settings__row">
          <span className="swap-settings__label">
            {copy.slippageTolerance}
            <SettingsTip text={slippageTip} />
          </span>
          <div className="swap-settings__options">
            {SLIPPAGE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                data-selected={slippageToNumber(slippageValue) === preset}
                onClick={() => onSlippageValue(String(preset))}
              >
                {preset}%
              </button>
            ))}
            <span className="swap-settings__unit">
              <Input
                className="swap-settings__custom numeric-input"
                inputMode="decimal"
                aria-label={`${copy.slippageTolerance} %`}
                aria-invalid={slippageIssue != null || undefined}
                aria-describedby={slippageIssue != null ? slippageErrorId : undefined}
                value={slippageValue}
                onChange={(event) => onSlippageValue(sanitizeAmount(event.target.value))}
              />
              <b aria-hidden="true">%</b>
            </span>
          </div>
          {slippageIssue != null ? (
            <FieldError id={slippageErrorId}>
              {copy[slippageErrorCopyKey(slippageIssue)]}
            </FieldError>
          ) : null}
        </div>
        {deadline != null ? (
          <div className="swap-settings__row">
            <span className="swap-settings__label">
              {copy.transactionDeadline}
              <SettingsTip text={deadline.tip} />
            </span>
            <div className="swap-settings__options">
              {DEADLINE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  data-selected={deadlineToNumber(deadline.value) === preset}
                  onClick={() => deadline.onValue(String(preset))}
                >
                  {preset}
                </button>
              ))}
              <span className="swap-settings__unit">
                <Input
                  className="swap-settings__custom numeric-input"
                  inputMode="numeric"
                  aria-label={`${copy.transactionDeadline} min`}
                  aria-invalid={!deadlineValid || undefined}
                  aria-describedby={!deadlineValid ? deadlineErrorId : undefined}
                  value={deadline.value}
                  onChange={(event) => deadline.onValue(sanitizeAmount(event.target.value))}
                />
                <b aria-hidden="true">min</b>
              </span>
            </div>
            {!deadlineValid ? (
              <FieldError id={deadlineErrorId}>{copy.deadlineWholeMinutes}</FieldError>
            ) : null}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

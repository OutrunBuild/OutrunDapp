'use client'

/**
 * Shared primitives for transaction dialogs:
 * ActionDialogShell (.pol-mint card shell) / AmountField (.swap-panel__field
 * family amount field) / DetailRows (detail row group) / DialogCta (disconnected =
 * clickable Connect; connected = action button disabled — the prototype ViewModel
 * does not fake on-chain execution). The CSS layer fully reuses the verse page's
 * existing classes; the sole React implementation lives in this file;
 * consumers = portfolio dialog family + verse trade dialog family
 * (mint/add liquidity/remove liquidity/flash-swap), plus the faucet swap dialog and
 * the portfolio protection-exit dialog.
 */
import { useId } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import type { Locale } from '@/lib/data/fixture-repository'

import { getCopy } from './copy'
import { formatAmount } from './signal-ui'
import { SwitchChainCta } from './switch-chain-cta'
import { AMOUNT_MAX_CHARS, amountToInputString, sanitizeAmount } from './amount-input'
import { Button } from '@/components/ui/button'
import { DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

/** Dialog shell: title + toolbar slot (optional, left of the ✕ — e.g. settings gear) +
 * content (reuses the .pol-mint card signature) */
export function ActionDialogShell({
  title,
  closeLabel,
  toolbar,
  children,
}: {
  title: string
  closeLabel: string
  toolbar?: ReactNode
  children: React.ReactNode
}) {
  return (
    <DialogContent className="pol-mint-pop">
      <div className="pol-mint ax-glow-card">
        <header className="pol-mint__head">
          <DialogTitle className="pol-mint__title">{title}</DialogTitle>
          <div className="pol-mint__controls">
            {toolbar}
            <DialogClose render={<button type="button" className="pol-mint__close" aria-label={closeLabel} />}>
              <X aria-hidden="true" size={16} />
            </DialogClose>
          </div>
        </header>
        {children}
      </div>
    </DialogContent>
  )
}

/** Amount field (.swap-panel__field family): label + balance/Max + input + token
 * symbol on the right */
export function AmountField({
  locale,
  label,
  balance,
  balanceLabel,
  maxLabel,
  value,
  onValue,
  tokenSymbol,
  ariaLabel,
}: {
  locale: Locale
  label: string
  balance: number | null
  balanceLabel: string
  maxLabel: string
  value: string
  onValue: (next: string) => void
  tokenSymbol: string
  ariaLabel: string
}) {
  const errorId = useId()
  // Insufficient balance: balance is known and input > balance; the error copy is one
  // short line without numbers
  const parsed = Number(value)
  const overBalance = balance != null && Number.isFinite(parsed) && parsed > balance
  return (
    <div className="swap-panel__field">
      <div className="swap-panel__field-head">
        <span>{label}</span>
        <span className="swap-panel__balance">
          {/* Token symbol is already shown on the right of the input; the balance row does
              not repeat it */}
          {`${balanceLabel}: ${balance == null ? '--' : formatAmount(balance, locale)}`}
          {balance != null && balance > 0 ? (
            <button
              type="button"
              className="swap-panel__max"
              onClick={() => onValue(amountToInputString(balance))}
            >
              {maxLabel}
            </button>
          ) : null}
        </span>
      </div>
      <div className="swap-panel__field-row">
        <Input
          className="numeric-input"
          inputMode="decimal"
          placeholder="0.00"
          value={value}
          maxLength={AMOUNT_MAX_CHARS}
          aria-label={ariaLabel}
          aria-invalid={overBalance || undefined}
          aria-describedby={overBalance ? errorId : undefined}
          onChange={(event) => onValue(sanitizeAmount(event.target.value))}
        />
        <div className="swap-panel__token">
          <strong>{tokenSymbol}</strong>
        </div>
      </div>
      {overBalance ? (
        <FieldError id={errorId}>{getCopy(locale).common.insufficientBalance}</FieldError>
      ) : null}
    </div>
  )
}

/** Detail row group (.swap-panel__details) */
export function DetailRows({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="swap-panel__details">
      {rows.map(([term, data]) => (
        <div key={term}>
          <dt>{term}</dt>
          <dd>{data}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Primary CTA: disconnected = Connect (clickable); connected = action button (disabled
 * by default — no faked execution; pass a conditional predicate to disabled for gating,
 * e.g. PSM Convert's balance/allowance predicate; title carries the hover note for the
 * connected-disabled state). Pass onAction to arm the real pipeline (review → Type-4);
 * without it the button stays inert, exactly the prototype convention. */
export function DialogCta({
  locale,
  connected,
  onConnect,
  onAction,
  label,
  disabled = true,
  title,
  connectLabel,
  switchChainTo,
}: {
  locale: Locale
  connected: boolean
  onConnect: () => void
  /** Real-pipeline entry (optional): clicked instead of staying disabled when connected */
  onAction?: () => void
  label: string
  /** Disabled predicate for the connected action button (default = always disabled,
   * prototype convention) */
  disabled?: boolean
  /** Title for the connected action button (hover note, e.g. the swap card's
   * "prototype does not send transactions" note) */
  title?: string
  /** Copy override for the disconnected button (default = common.connect; verse trading
   * contexts use verseDesk.swapCta) */
  connectLabel?: string
  /** Wrong-chain override: when set and connected, the CTA becomes the
   * network switch instead of the action — the desk never fires on-chain reads off-chain */
  switchChainTo?: {
    execChain: number
    chainName: string
    onSwitch: (chainId: number) => void
  }
}) {
  if (connected && switchChainTo) {
    return (
      <SwitchChainCta
        locale={locale}
        execChain={switchChainTo.execChain}
        chainName={switchChainTo.chainName}
        onSwitch={switchChainTo.onSwitch}
        className="swap-panel__cta"
      />
    )
  }
  return connected ? (
    <Button className="swap-panel__cta" disabled={onAction ? disabled : true} title={title} onClick={onAction}>
      {label}
    </Button>
  ) : (
    <Button className="swap-panel__cta" onClick={onConnect}>
      {connectLabel ?? getCopy(locale).common.connect}
    </Button>
  )
}

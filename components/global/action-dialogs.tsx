'use client'

/**
 * Shared primitives for transaction dialogs:
 * ActionDialogShell (.pol-mint card shell) / AmountField (.swap-panel__field
 * family amount field) / DetailRows (detail row group) / DialogCta (disconnected =
 * clickable Connect; disabled by default with a gating predicate; onAction arms the
 * real pipeline — without it the button stays inert). The CSS layer fully reuses the verse page's
 * existing classes; the sole React implementation lives in this file;
 * consumers = portfolio dialog family + verse trade dialog family
 * (mint/add liquidity/remove liquidity/flash-swap/redeem LP/redeem PT-YT/split-merge/
 * token select/DAO fund), plus the faucet swap dialog, the portfolio protection-exit
 * dialog and the verse share dialog.
 */
import { useId } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { formatUnits } from 'viem'
import type { Locale } from '@/lib/data/fixture-repository'

import { getCopy } from './copy'
import { fmtTokenAmountExact } from './amount-format'
import { formatAmount } from './signal-ui'
import { SwitchChainCta } from './switch-chain-cta'
import {
  AMOUNT_MAX_CHARS,
  amountToInputString,
  evaluateAmountBalance,
  sanitizeAmount,
  trimFractionZeros,
} from './amount-input'
import { Button } from '@/components/ui/button'
import { DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

/** Dialog shell: title + toolbar slot (optional, left of the ✕ — e.g. settings gear) +
 * content (reuses the .pol-mint card signature); compactTop pulls the title one spacing
 * step closer to the top edge (receipt dialogs). Menu-like popups drop the glow signature
 * or carry their own DialogContent skin via glow/contentClass. */
export function ActionDialogShell({
  title,
  titleClassName,
  closeLabel,
  toolbar,
  compactTop,
  glow = true,
  contentClass = 'pol-mint-pop',
  dataStage,
  children,
}: {
  title: React.ReactNode
  /** Extra class on the title (rich-title heads, e.g. the verse share card) */
  titleClassName?: string
  closeLabel: string
  toolbar?: ReactNode
  /** Receipt density: smaller title-to-edge gap (TxSuccessDialog only) */
  compactTop?: boolean
  /** ax-glow-card signature on the .pol-mint card; menu-like popups (token select /
   * DAO fund / verse share) turn it off */
  glow?: boolean
  /** DialogContent skin class; .pol-mint-pop is the standard action-dialog skin */
  contentClass?: string
  /** data-stage hook on DialogContent (stage-skinned dialogs, e.g. verse share) */
  dataStage?: string
  children: React.ReactNode
}) {
  const cardClass = ['pol-mint', glow && 'ax-glow-card', compactTop && 'pol-mint--compact-top']
    .filter(Boolean)
    .join(' ')
  return (
    <DialogContent className={contentClass} data-stage={dataStage}>
      <div className={cardClass}>
        <header className="pol-mint__head">
          <DialogTitle
            className={titleClassName ? `pol-mint__title ${titleClassName}` : 'pol-mint__title'}
          >
            {title}
          </DialogTitle>
          <div className="pol-mint__controls">
            {toolbar}
            <DialogClose render={<button type="button" className="pol-mint__close" aria-label={closeLabel} />}>
              <X aria-hidden="true" size={17} />
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
  exactBalance,
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
  /** Exact wallet read (raw base units + decimals); wins over `balance` for the gate, the
   * Max fill and the balance display when present — float64 balances can round a real
   * balance upward and would let the gate reject the very Max fill it prefilled */
  exactBalance?: { base: bigint; decimals: number } | null
  balanceLabel: string
  maxLabel: string
  value: string
  onValue: (next: string) => void
  tokenSymbol: string
  ariaLabel: string
}) {
  const errorId = useId()
  // Insufficient balance: balance is known and input > balance; the error copy is one
  // short line without numbers. The predicate lives in amount-input so the CTA gate and
  // this row cannot drift.
  const { overBalance } = evaluateAmountBalance(value, balance, exactBalance)
  const balanceText =
    exactBalance != null
      ? fmtTokenAmountExact(exactBalance.base, exactBalance.decimals, locale)
      : balance == null
        ? '--'
        : formatAmount(balance, locale)
  const maxEnabled =
    exactBalance != null ? exactBalance.base > 0n : balance != null && balance > 0
  return (
    <div className="swap-panel__field">
      <div className="swap-panel__field-head">
        <span>{label}</span>
        <span className="swap-panel__balance">
          {/* Token symbol is already shown on the right of the input; the balance row does
              not repeat it */}
          {`${balanceLabel}: ${balanceText}`}
          {maxEnabled ? (
            <button
              type="button"
              className="swap-panel__max"
              onClick={() =>
                onValue(
                  exactBalance != null
                    ? trimFractionZeros(formatUnits(exactBalance.base, exactBalance.decimals))
                    : amountToInputString(balance ?? 0),
                )
              }
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
 * e.g. PSM Convert's balance/allowance predicate). Pass onAction to arm the real pipeline (review → Type-4);
 * without it the button stays inert, exactly the prototype convention. */
export function DialogCta({
  locale,
  connected,
  onConnect,
  onAction,
  label,
  disabled = true,
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
    <Button className="swap-panel__cta" disabled={onAction ? disabled : true} onClick={onAction}>
      {label}
    </Button>
  ) : (
    <Button className="swap-panel__cta" onClick={onConnect}>
      {connectLabel ?? getCopy(locale).common.connect}
    </Button>
  )
}

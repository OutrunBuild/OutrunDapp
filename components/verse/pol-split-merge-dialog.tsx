'use client'

import { useId, useState } from 'react'
import { X } from 'lucide-react'

import type { Locale, FixturePolPosition, FixtureVerse } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { useMockWallet } from '../global/mock-wallet'
import { formatAmount } from '../global/signal-ui'
import { AMOUNT_MAX_CHARS, amountToInputString, sanitizeAmount } from '../global/amount-input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { FieldError } from '@/components/ui/field'

/**
 * Split/Merge POL action dialog (the PT/YT card action bar's Split/Merge buttons each open
 * this dialog;
 * no Rate row and no output area — 1:1 identity, output is
 * a restatement of the input, redundant).
 * Mechanism: Split=1 POL → 1 PT + 1 YT, Merge=burn equal PT and YT for
 * the same amount of POL — strictly 1:1, the contract has no slippage/no deadline
 * parameters → no settings gear;
 * gate is locked only (unlock/settled reverts with AlreadyUnlocked; after unlock this dialog
 * is not rendered — the bar switches to Redeem PT/YT);
 * CTA discipline same as the Mint dialog: disconnected=Connect Wallet clickable to toggle mock
 * connection, connected=action button disabled
 * (no faked on-chain execution, no disclaimers).
 * No valuation row (the split input ≈$ conversion is omitted; PT/YT have no
 * independent price samples to begin with).
 * Max disabled at zero: amountToInputString(0)
 * returns an empty string and clicking has no visible effect = dead-button look — when the
 * fillable amount is ≤0 Max goes disabled
 * (merge dual boxes=maxMerge=min(PT,YT), split=POL balance); a 0 balance is an honest disabled state.
 */
export function PolSplitMergeDialog({
  locale,
  verse,
  pol,
  mode,
}: {
  locale: Locale
  verse: FixtureVerse
  pol: FixturePolPosition
  mode: 'split' | 'merge'
}) {
  const copy = getCopy(locale).verseDesk
  const common = getCopy(locale).common
  const { connected, toggle } = useMockWallet()
  // merge's two sides are always equal (the contract burns the same amount on both sides) → a single state drives both input boxes
  const [amount, setAmount] = useState('')
  const balanceErrorId = useId()

  const polSymbol = `POL-${verse.symbol}`
  const ptSymbol = `PT-${verse.symbol}`
  const ytSymbol = `YT-${verse.symbol}`
  const maxMerge = Math.min(pol.myPt, pol.myYt)
  const clean = (raw: string) => setAmount(sanitizeAmount(raw))
  // merge's two inputs share one amount → the error row mounts in a single place after the YT
  // box, both inputs carry the same aria
  const parsed = Number(amount)
  const overBalance = mode === 'split' ? parsed > pol.myPol : parsed > maxMerge

  return (
    <Dialog>
      {/* data-slot pinned back to button: same as PolMintDialog — the theme bridge matches skins on [data-slot='button'] */}
      <DialogTrigger data-slot="button" render={<Button variant="outline" size="sm" />}>
        {mode === 'split' ? copy.splitPol : copy.mergePol}
      </DialogTrigger>
      <DialogContent className="pol-mint-pop">
        <div className="pol-mint ax-glow-card">
          <header className="pol-mint__head">
            <DialogTitle className="pol-mint__title">
              {mode === 'split' ? copy.splitDialogTitle : copy.mergeDialogTitle}
            </DialogTitle>
            <div className="pol-mint__controls">
              <DialogClose
                render={
                  <button type="button" className="pol-mint__close" aria-label={common.close} />
                }
              >
                <X aria-hidden="true" size={16} />
              </DialogClose>
            </div>
          </header>

          {mode === 'split' ? (
            <div className="swap-panel__field">
              <div className="swap-panel__field-head">
                <span>POL</span>
                <span className="swap-panel__balance">
                  {copy.balance}: <span data-numeric>{formatAmount(pol.myPol, locale)}</span>
                  <button type="button" className="swap-panel__max" disabled={pol.myPol <= 0} onClick={() => clean(amountToInputString(pol.myPol))}>
                    {copy.max}
                  </button>
                </span>
              </div>
              <div className="swap-panel__field-row">
                <Input
                  className="numeric-input"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  maxLength={AMOUNT_MAX_CHARS}
                  onChange={(event) => clean(event.target.value)}
                  aria-label={`${copy.splitDialogTitle} ${polSymbol}`}
                  aria-invalid={overBalance || undefined}
                  aria-describedby={overBalance ? balanceErrorId : undefined}
                />
                <div className="swap-panel__token">
                  <strong>{polSymbol}</strong>
                </div>
              </div>
              {overBalance ? (
                <FieldError id={balanceErrorId}>{common.insufficientBalance}</FieldError>
              ) : null}
            </div>
          ) : (
            <>
              <div className="swap-panel__field">
                <div className="swap-panel__field-head">
                  <span>PT</span>
                  <span className="swap-panel__balance">
                    {copy.balance}: <span data-numeric>{formatAmount(pol.myPt, locale)}</span>
                    <button type="button" className="swap-panel__max" disabled={maxMerge <= 0} onClick={() => clean(amountToInputString(maxMerge))}>
                      {copy.max}
                    </button>
                  </span>
                </div>
                <div className="swap-panel__field-row">
                  <Input
                    className="numeric-input"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    maxLength={AMOUNT_MAX_CHARS}
                    onChange={(event) => clean(event.target.value)}
                    aria-label={`${copy.mergeDialogTitle} ${ptSymbol}`}
                    aria-invalid={overBalance || undefined}
                    aria-describedby={overBalance ? balanceErrorId : undefined}
                  />
                  <div className="swap-panel__token">
                    <strong>{ptSymbol}</strong>
                  </div>
                </div>
              </div>
              <div className="swap-panel__field">
                <div className="swap-panel__field-head">
                  <span>YT</span>
                  <span className="swap-panel__balance">
                    {copy.balance}: <span data-numeric>{formatAmount(pol.myYt, locale)}</span>
                    <button type="button" className="swap-panel__max" disabled={maxMerge <= 0} onClick={() => clean(amountToInputString(maxMerge))}>
                      {copy.max}
                    </button>
                  </span>
                </div>
                <div className="swap-panel__field-row">
                  <Input
                    className="numeric-input"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    maxLength={AMOUNT_MAX_CHARS}
                    onChange={(event) => clean(event.target.value)}
                    aria-label={`${copy.mergeDialogTitle} ${ytSymbol}`}
                    aria-invalid={overBalance || undefined}
                    aria-describedby={overBalance ? balanceErrorId : undefined}
                  />
                  <div className="swap-panel__token">
                    <strong>{ytSymbol}</strong>
                  </div>
                </div>
                {overBalance ? (
                  <FieldError id={balanceErrorId}>{common.insufficientBalance}</FieldError>
                ) : null}
              </div>
            </>
          )}

          {connected ? (
            <Button className="swap-panel__cta" disabled>
              {mode === 'split' ? copy.splitPol : copy.mergePol}
            </Button>
          ) : (
            <Button className="swap-panel__cta" onClick={toggle}>
              {copy.swapCta}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

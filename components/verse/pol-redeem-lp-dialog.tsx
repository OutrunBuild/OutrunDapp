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
 * Redeem POL action dialog (the POL asset card's Redeem button).
 * Mechanism: burning POL returns main-pool (memecoin/uAsset)
 * LP tokens 1:1 by main-pool construction
 * (amountInLP=amountInPOL). The unwrap=false direct LP transfer path is not price
 * sensitive → the contract has no slippage/deadline parameters → no settings gear
 * (the unwrap=true split into memecoin+uAsset 6-parameter slippage entry does not belong in
 * this dialog). Gate is unlocked only (locked/unsettled states revert with NotUnlockedStage).
 * The You receive row stays: 1:1 identity, but the input POL and the output LP token are
 * different identities (unlike the Split/Merge dialog, which drops the
 * output area — this is not a restatement of the input); LP display symbol=main-pool pair
 * scope {MEME}/{uAsset} LP (repository main pool pair; consistent with the two pool dialogs'
 * lpSymbol convention — on-chain the ERC20 of every pool statically shares symbol "MLP"/name
 * "Memeverse LP", so pools can only be told apart by the pair scope);
 * opens with empty input; CTA discipline as before:
 * disconnected=Connect Wallet clickable; connected=action button disabled (no faked execution).
 */
export function PolRedeemLpDialog({
  locale,
  verse,
  pol,
}: {
  locale: Locale
  verse: FixtureVerse
  pol: FixturePolPosition
}) {
  const copy = getCopy(locale).verseDesk
  const common = getCopy(locale).common
  const { connected, toggle } = useMockWallet()
  // Opens with empty input (amount input defaults to empty 0.00, not prefilled with balance)
  const [amount, setAmount] = useState('')
  const balanceErrorId = useId()

  const polSymbol = `POL-${verse.symbol}`
  // Main-pool LP pair scope (repository main pool pair [verse.symbol, verse.raiseAsset])
  const lpSymbol = `${verse.symbol}/${verse.raiseAsset} LP`
  const clean = (raw: string) => setAmount(sanitizeAmount(raw))

  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0
  const overBalance = parsed > pol.myPol
  // 1:1 identity by main-pool construction (amountInLP=amountInPOL), no sample/slot branch
  const lpOut = valid ? parsed : null

  return (
    <Dialog>
      {/* data-slot pinned back to button: same as PolMintDialog — the theme bridge matches skins on [data-slot='button'] */}
      <DialogTrigger data-slot="button" render={<Button variant="outline" size="sm" />}>
        {copy.redeemPol}
      </DialogTrigger>
      <DialogContent className="pol-mint-pop">
        <div className="pol-mint ax-glow-card">
          <header className="pol-mint__head">
            <DialogTitle className="pol-mint__title">{copy.redeemPolDialogTitle}</DialogTitle>
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

          <div className="swap-panel__field">
            <div className="swap-panel__field-head">
              <span>POL</span>
              <span className="swap-panel__balance">
                {copy.balance}: <span data-numeric>{formatAmount(pol.myPol, locale)}</span>
                <button type="button" className="swap-panel__max" onClick={() => clean(amountToInputString(pol.myPol))}>
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
                aria-label={`${copy.redeemPol} ${polSymbol}`}
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

          <dl className="swap-panel__details">
            <div>
              <dt>{copy.youReceive}</dt>
              <dd data-numeric>
                {lpOut != null ? formatAmount(lpOut, locale) : '0.00'} {lpSymbol}
              </dd>
            </div>
          </dl>

          {connected ? (
            <Button className="swap-panel__cta" disabled>
              {copy.redeemPol}
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

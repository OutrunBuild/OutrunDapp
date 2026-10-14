'use client'

/**
 * Get UUSD dialog (UUSD is obtainable only via PSM, and yield-bearing assets go straight through
 * stakeForGenesis without touching UUSD): two-way PSM face-value swap (Get = USDC→UUSD mint /
 * Back = UUSD→USDC redeem), mechanism facts (face value 1:1, tin/tout fees, mint bounded
 * by stockCap headroom, no slippage/deadline params → no settings gear). Primitives reuse
 * global/action-dialogs; CTA semantics = when disconnected, a clickable Connect toggles the mock
 * connection; when connected, the action button is gated only by input (no onClick, no faked
 * settlement) — same as ConvertDialog.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'

import type { FixtureFaucet, Locale } from '@/lib/data/fixture-repository'

import { ActionDialogShell, AmountField, DetailRows, DialogCta } from '../global/action-dialogs'
import { getCopy } from '../global/copy'
import { useMockWallet } from '../global/mock-wallet'
import { formatAmount, formatPercent } from '../global/signal-ui'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'

export function FaucetSwapDialog({ locale, swap }: { locale: Locale; swap: FixtureFaucet['swap'] }) {
  const copy = getCopy(locale).faucet
  const { connected, toggle } = useMockWallet()
  const [mode, setMode] = useState<'get' | 'back'>('get')
  const [amount, setAmount] = useState('')
  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0
  const fee = mode === 'get' ? swap.feeIn : swap.feeOut
  const balance = mode === 'get' ? swap.myReserve : swap.myUAsset
  const paySymbol = mode === 'get' ? swap.reserveSymbol : swap.uAssetSymbol
  const outSymbol = mode === 'get' ? swap.uAssetSymbol : swap.reserveSymbol

  return (
    <Dialog>
      <DialogTrigger data-slot="button" render={<Button className="ax-ghost-cta" size="sm" />}>
        {copy.swapCta}
      </DialogTrigger>
      <ActionDialogShell title={copy.swapTitle} closeLabel={getCopy(locale).common.close}>
        <div className="pf-dialog__chips" role="group">
          <button type="button" data-selected={mode === 'get' || undefined} onClick={() => setMode('get')}>
            {copy.modeGet}
          </button>
          <button type="button" data-selected={mode === 'back' || undefined} onClick={() => setMode('back')}>
            {copy.modeBack}
          </button>
        </div>
        <AmountField
          locale={locale}
          label={copy.amount}
          balance={balance}
          balanceLabel={copy.balance}
          maxLabel={copy.max}
          value={amount}
          onValue={setAmount}
          tokenSymbol={paySymbol}
          ariaLabel={`${copy.amount} (${paySymbol})`}
        />
        <DetailRows
          rows={[
            [
              copy.rate,
              <span key="rate" data-numeric>
                {mode === 'get'
                  ? `1 ${swap.reserveSymbol} = 1 ${swap.uAssetSymbol}`
                  : `1 ${swap.uAssetSymbol} = 1 ${swap.reserveSymbol}`}
              </span>,
            ],
            [
              copy.fee,
              fee == null ? (
                '--'
              ) : (
                <span key="fee" data-numeric>
                  {formatPercent(fee * 100, locale)}%
                </span>
              ),
            ],
            [
              copy.youReceive,
              valid && fee != null ? (
                <span key="receive" data-numeric>
                  {formatAmount(parsed * (1 - fee), locale)} {outSymbol}
                </span>
              ) : (
                '--'
              ),
            ],
            // Mint headroom constrains only the Get (mint) direction (PSM stockCap; same
            // semantics as ConvertDialog)
            ...(mode === 'get'
              ? ([
                  [
                    copy.headroom,
                    swap.headroom == null ? (
                      '--'
                    ) : (
                      <span key="headroom" data-numeric>
                        {formatAmount(swap.headroom, locale)} {swap.uAssetSymbol}
                      </span>
                    ),
                  ],
                ] as Array<[string, ReactNode]>)
              : []),
          ]}
        />
        <DialogCta
          locale={locale}
          connected={connected}
          onConnect={toggle}
          label={mode === 'get' ? copy.ctaGet : copy.ctaBack}
          disabled={!valid}
        />
      </ActionDialogShell>
    </Dialog>
  )
}

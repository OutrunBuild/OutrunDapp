'use client'

/**
 * Portfolio action dialog family: bridge send / PSM convert / CDP redeem / USR deposit-withdraw.
 * The shell and field primitives (ActionDialogShell/AmountField/DetailRows/
 * DialogCta) live in components/global/action-dialogs.tsx, shared with the verse tx dialog
 * family (CSS language unchanged); CTAs follow the same semantics as VaultActions: disconnected =
 * a clickable Connect Wallet toggles the mock connection, connected = the action button is
 * disabled, no faked on-chain success.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import type { Locale } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { useMockWallet } from '../global/mock-wallet'
import { ChainLogoMark } from '../global/chain-icons'
import { formatAmount, formatPercent } from '../global/signal-ui'
import { ActionDialogShell, AmountField, DetailRows, DialogCta } from '../global/action-dialogs'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import { Sheet, SheetClose, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'

// ---------------------------------------------------------------------------
// Bridge send (a pure transfer in two phases: send → arrival; send ≠ done, the done color
// belongs only to the arrival terminal state)
// ---------------------------------------------------------------------------

export function BridgeDialog({
  locale,
  triggerLabel,
  assetSymbol,
  chains,
  balancesByChain,
}: {
  locale: Locale
  triggerLabel: string
  assetSymbol: string
  /** Selectable chains (mainnet family) */
  chains: Array<{ chainId: number; name: string }>;
  /** This asset's per-chain balances (source for the From-side Max; chains without balance are
   *  selectable but Max is unavailable) */
  balancesByChain: Array<{ chainId: number; name: string; amount: number }>;
}) {
  const copy = getCopy(locale).portfolio.assets
  const { connected, toggle } = useMockWallet()
  const [fromChain, setFromChain] = useState(balancesByChain[0]?.chainId ?? chains[0]?.chainId ?? 1)
  const [toChain, setToChain] = useState(
    chains.find((chain) => chain.chainId !== (balancesByChain[0]?.chainId ?? 1))?.chainId ??
      chains[1]?.chainId ??
      1,
  )
  const [amount, setAmount] = useState('')
  const fromBalance = balancesByChain.find((row) => row.chainId === fromChain)?.amount ?? 0
  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0

  return (
    <Dialog>
      <DialogTrigger data-slot="button" render={<Button variant="outline" size="xs" />}>
        {triggerLabel}
      </DialogTrigger>
      <ActionDialogShell title={copy.bridgeTitle} closeLabel={getCopy(locale).common.close}>
        <div className="pf-dialog__chips" role="group" aria-label={copy.bridgeFrom}>
          {chains.map((chain) => (
            <button
              key={chain.chainId}
              type="button"
              data-selected={fromChain === chain.chainId || undefined}
              onClick={() => {
                setFromChain(chain.chainId)
                if (toChain === chain.chainId) {
                  const next = chains.find((item) => item.chainId !== chain.chainId)
                  if (next) setToChain(next.chainId)
                }
              }}
            >
              {`${copy.bridgeFrom} · ${chain.name}`}
            </button>
          ))}
        </div>
        <div className="pf-dialog__chips" role="group" aria-label={copy.bridgeTo}>
          {chains
            .filter((chain) => chain.chainId !== fromChain)
            .map((chain) => (
              <button
                key={chain.chainId}
                type="button"
                data-selected={toChain === chain.chainId || undefined}
                onClick={() => setToChain(chain.chainId)}
              >
                {`${copy.bridgeTo} · ${chain.name}`}
              </button>
            ))}
        </div>
        <AmountField
          locale={locale}
          label={copy.amount}
          balance={fromBalance}
          balanceLabel={copy.balance}
          maxLabel={copy.max}
          value={amount}
          onValue={setAmount}
          tokenSymbol={assetSymbol}
          ariaLabel={`${copy.amount} (${assetSymbol})`}
        />
        <DetailRows
          rows={[
            [
              copy.bridgeEstimate,
              valid ? (
                <span data-numeric>
                  {formatAmount(parsed, locale)} {assetSymbol}
                </span>
              ) : (
                '--'
              ),
            ],
            [copy.bridgeFee, '--'],
          ]}
        />
        <DialogCta locale={locale} connected={connected} onConnect={toggle} label={copy.bridgeSend} />
      </ActionDialogShell>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// PSM convert (mechanism is a 1:1 swap; the title omits "1:1".
// Arrival is post-fee; the headroom row appears only on the Mint card)
// ---------------------------------------------------------------------------

export function ConvertDialog({
  locale,
  triggerLabel,
  uAssetSymbol,
  reserveSymbol,
  feeIn,
  feeOut,
  headroom,
  uAssetBalance,
  reserveBalance,
}: {
  locale: Locale
  triggerLabel: string
  uAssetSymbol: string
  reserveSymbol: string
  /** Mint fee (ratio); null = no pair sample → the headroom/fee rows fall back to slots */
  feeIn: number | null
  feeOut: number
  headroom: number | null
  uAssetBalance: number | null
  reserveBalance: number | null
}) {
  const copy = getCopy(locale).portfolio.assets
  const { connected, toggle } = useMockWallet()
  const [mode, setMode] = useState<'mint' | 'redeem'>('mint')
  const [amount, setAmount] = useState('')
  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0
  const fee = mode === 'mint' ? feeIn : feeOut
  const balance = mode === 'mint' ? reserveBalance : uAssetBalance
  const balanceSymbol = mode === 'mint' ? reserveSymbol : uAssetSymbol
  const mintBlocked = mode === 'mint' && headroom != null && headroom <= 0
  const overBalance = balance != null && Number.isFinite(parsed) && parsed > balance

  return (
    <Dialog>
      <DialogTrigger data-slot="button" render={<Button variant="outline" size="xs" />}>
        {triggerLabel}
      </DialogTrigger>
      <ActionDialogShell title={`${copy.convertTitle} · ${uAssetSymbol}`} closeLabel={getCopy(locale).common.close}>
        <div className="pf-dialog__chips" role="group">
          <button type="button" data-selected={mode === 'mint' || undefined} onClick={() => setMode('mint')}>
            {copy.convertIn.replace('{u}', uAssetSymbol)}
          </button>
          <button type="button" data-selected={mode === 'redeem' || undefined} onClick={() => setMode('redeem')}>
            {copy.convertOut.replace('{r}', reserveSymbol)}
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
          tokenSymbol={balanceSymbol}
          ariaLabel={`${copy.amount} (${balanceSymbol})`}
        />
        <DetailRows
          rows={[
            [
              copy.convertRate,
              <span key="rate" data-numeric>
                1 {uAssetSymbol} = 1 {reserveSymbol}
              </span>,
            ],
            [
              copy.convertFee,
              fee == null ? (
                '--'
              ) : (
                <span key="fee" data-numeric>
                  {formatPercent(fee * 100, locale)}%
                </span>
              ),
            ],
            // Mint cap headroom constrains only the Mint direction (PSM mint cap); not shown on the
            // Redeem card
            ...(mode === 'mint'
              ? ([
                  [
                    copy.convertHeadroom,
                    headroom == null ? (
                      '--'
                    ) : (
                      <span key="headroom" data-numeric>
                        {formatAmount(headroom, locale)} {uAssetSymbol}
                      </span>
                    ),
                  ],
                ] as [string, ReactNode][])
              : []),
          ]}
        />
        <DialogCta
          locale={locale}
          connected={connected}
          onConnect={toggle}
          label={copy.convertSubmit}
          disabled={!valid || mintBlocked || overBalance}
        />
      </ActionDialogShell>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// CDP redeem (the only debt-reducing path; returns the borrowed uAsset, collateral
// goes back to the wallet)
// ---------------------------------------------------------------------------

export function CdpRedeemDialog({
  locale,
  triggerLabel,
  uAssetSymbol,
  collateralSymbol,
  collateralAmount,
  debt,
  uAssetBalance,
}: {
  locale: Locale
  triggerLabel: string
  uAssetSymbol: string
  collateralSymbol: string
  collateralAmount: number
  debt: number
  uAssetBalance: number | null
}) {
  const copy = getCopy(locale).portfolio.positions
  const { connected, toggle } = useMockWallet()
  const [amount, setAmount] = useState('')
  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0 && parsed <= debt

  return (
    <Dialog>
      <DialogTrigger data-slot="button" render={<Button variant="outline" size="xs" />}>
        {triggerLabel}
      </DialogTrigger>
      <ActionDialogShell title={`${copy.cdpRedeem} · ${uAssetSymbol}`} closeLabel={getCopy(locale).common.close}>
        <AmountField
          locale={locale}
          label={copy.amount}
          balance={uAssetBalance}
          balanceLabel={copy.balance}
          maxLabel={copy.max}
          value={amount}
          onValue={setAmount}
          tokenSymbol={uAssetSymbol}
          ariaLabel={`${copy.amount} (${uAssetSymbol})`}
        />
        <DetailRows
          rows={[
            [
              copy.cdpBorrowed,
              <span key="debt" data-numeric>
                {formatAmount(debt, locale)} {uAssetSymbol}
              </span>,
            ],
            [
              copy.cdpCollateral,
              <span key="collateral" data-numeric>
                {formatAmount(collateralAmount, locale)} {collateralSymbol}
              </span>,
            ],
          ]}
        />
        <DialogCta
          locale={locale}
          connected={connected}
          onConnect={toggle}
          label={copy.cdpRedeem}
          disabled={!valid}
        />
      </ActionDialogShell>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// USR deposit/withdraw (share-index conversion: deposit uAsset to get shares; withdraw shares to
// get uAsset)
// ---------------------------------------------------------------------------

export function UsrSavingsDialog({
  locale,
  triggerLabel,
  mode,
  vault,
  uAssetBalance,
}: {
  locale: Locale
  triggerLabel: string
  mode: 'deposit' | 'withdraw'
  vault: {
    shareSymbol: string
    uAssetSymbol: string
    rate: number
    rateActive: boolean
    myShares: number
    myAssets: number
  }
  uAssetBalance: number | null
}) {
  const copy = getCopy(locale).portfolio.savings
  const { connected, toggle } = useMockWallet()
  const [amount, setAmount] = useState('')
  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0
  const index = vault.myShares > 0 ? vault.myAssets / vault.myShares : 1

  return (
    <Dialog>
      <DialogTrigger data-slot="button" render={<Button variant="outline" />}>
        {triggerLabel}
      </DialogTrigger>
      <ActionDialogShell
        title={`${copy.badge} · ${vault.uAssetSymbol}`}
        closeLabel={getCopy(locale).common.close}
      >
        <AmountField
          locale={locale}
          label={copy.amount}
          balance={mode === 'deposit' ? uAssetBalance : vault.myShares}
          balanceLabel={copy.balance}
          maxLabel={copy.max}
          value={amount}
          onValue={setAmount}
          tokenSymbol={mode === 'deposit' ? vault.uAssetSymbol : vault.shareSymbol}
          ariaLabel={`${copy.amount} (${mode === 'deposit' ? vault.uAssetSymbol : vault.shareSymbol})`}
        />
        <DetailRows
          rows={[
            [
              copy.apy,
              <span key="rate" data-numeric data-state={vault.rateActive ? 'active' : 'inactive'}>
                {formatPercent(vault.rate * 100, locale)}%
              </span>,
            ],
            [
              copy.myDeposit,
              <span key="deposit" data-numeric>
                {formatAmount(vault.myAssets, locale)} {vault.uAssetSymbol}
              </span>,
            ],
          ]}
        />
        {valid ? (
          <p className="panel-note" data-numeric>
            {mode === 'deposit'
              ? `≈ ${formatAmount(parsed / index, locale)} ${vault.shareSymbol}`
              : `≈ ${formatAmount(parsed * index, locale)} ${vault.uAssetSymbol}`}
          </p>
        ) : null}
        <DialogCta
          locale={locale}
          connected={connected}
          onConnect={toggle}
          label={mode === 'deposit' ? copy.depositCta : copy.withdrawCta}
        />
      </ActionDialogShell>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Asset bottom action panel (mobile asset rows carry no inline buttons): triggered by a full-row
// hit layer, chain distribution detail + CTA row (children = the Convert/Bridge dialog triggers).
// Tapping a CTA does NOT collapse the panel — the nested dialog opens via its own base-ui Portal
// stacked above the panel. Only the ≤54rem hit layer is visible;
// desktop inline buttons work as before (the trigger cannot serve double duty, two independent
// instances open/close independently).
// ---------------------------------------------------------------------------

export function AssetActionsSheet({
  locale,
  title,
  triggerLabel,
  chains,
  children,
}: {
  locale: Locale
  title: string
  /** Hit layer accessible name (symbol + the asset-actions label, joined by a middle dot) */
  triggerLabel: string
  chains: Array<{ chainId: number; name: string; amount: number }>
  /** CTA row (Convert/Bridge dialog triggers) */
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        nativeButton={false}
        render={<div className="pf-asset-row__hit" />}
        aria-label={triggerLabel}
      />
      <SheetContent className="pf-asset-sheet">
        <div className="pol-mint ax-glow-card">
          <header className="pol-mint__head">
            <SheetTitle className="pol-mint__title">{title}</SheetTitle>
            <div className="pol-mint__controls">
              <SheetClose
                render={<button type="button" className="pol-mint__close" aria-label={getCopy(locale).common.close} />}
              >
                <X aria-hidden="true" size={16} />
              </SheetClose>
            </div>
          </header>
          <ul className="pf-asset-sheet__chains">
            {chains.map((chain) => (
              <li key={chain.chainId}>
                <span className="pf-asset-sheet__chain">
                  <ChainLogoMark chainId={chain.chainId} size={16} aria-hidden="true" />
                  <span>{chain.name}</span>
                </span>
                <span data-numeric>{formatAmount(chain.amount, locale, true)}</span>
              </li>
            ))}
          </ul>
          {/* CTA row = nested dialog triggers: the task dialog's Portal mounts stacked above the
              panel (iOS stack style); the panel keeps carrying the context — the panel must not
              collapse on click, the dialog tree unmounts with the panel content */}
          <div className="pf-asset-sheet__cta">{children}</div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

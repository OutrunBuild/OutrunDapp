'use client'

/**
 * Generic transaction-success dialog (2026-10-26 用户裁定: ONE success UI for every
 * transaction on the site). Anatomy is extracted from the participation-genesis receipt
 * (participation-panel confirmed state, components.md 交易签名状态 row): green ✓ plate +
 * two-tone title head, receipt ledger rows, explorer hash link, one full-width CTA. The
 * shell header carries the flow's own done-title. Echo rows must be captured by the caller
 * at click time — live flow state is usually cleared by the time the receipt opens.
 */
import { Check, ExternalLink } from 'lucide-react'
import Link from 'next/link'

import type { Locale } from '@/lib/data/fixture-repository'
import { getClientChainConfig } from '@/lib/web3/chains'

import { getCopy } from './copy'
import { formatHex } from './signal-ui'
import { ActionDialogShell } from './action-dialogs'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'

export type TxSuccessRow = { label: string; value: string; symbol?: string }

export function TxSuccessDialog({
  locale,
  open,
  onOpenChange,
  title,
  lead,
  accent,
  rows,
  txHash,
  txChainId,
  cta,
}: {
  locale: Locale
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Shell header title (the flow's done-title, e.g. 参与成功). */
  title: string
  /** Body two-tone title: lead word + green accent word (empty accent = no split, en). */
  lead: string
  accent: string
  /** Receipt echo legs. */
  rows: readonly TxSuccessRow[]
  /** Optional receipt link: rendered only when the chain resolves an explorer URL. */
  txHash?: string | null
  txChainId?: number | null
  /** Primary nav CTA; absent = a full-width Close that dismisses the dialog. */
  cta?: { label: string; href: string }
}) {
  const copy = getCopy(locale)
  const chain = txChainId != null ? getClientChainConfig(txChainId) : null
  const explorer = chain?.status === 'ok' ? chain.config.explorer : null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ActionDialogShell title={title} closeLabel={copy.common.close} compactTop>
        <div className="tx-success">
          <div className="tx-success__head">
            <span className="review-check" aria-hidden="true">
              <Check />
            </span>
            <p className="tx-success__title">
              {lead}
              {accent ? <span className="create-success-pop__title-accent">{accent}</span> : null}
            </p>
          </div>
          {rows.length > 0 ? (
            <div className="tx-success__rows">
              {rows.map((row) => (
                <div key={`${row.label}·${row.value}`} className="tx-success__row">
                  <span>{row.label}</span>
                  <span data-numeric>
                    {row.value}
                    {row.symbol ? <> <span className="ax-ticker">{row.symbol}</span></> : null}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          {txHash && explorer ? (
            <a
              className="tx-success__hash"
              href={`${explorer}/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
            >
              <span className="tx-success__hash-label">{copy.verse.txHash}</span>
              <span className="tx-success__hash-value">
                <span data-numeric>{formatHex(txHash)}</span>
                <ExternalLink aria-hidden="true" className="size-3.5" />
              </span>
            </a>
          ) : null}
          {cta ? (
            <Button className="ax-ghost-cta" nativeButton={false} render={<Link href={cta.href} />}>
              {cta.label}
            </Button>
          ) : (
            <Button className="ax-ghost-cta" onClick={() => onOpenChange(false)}>
              {copy.common.close}
            </Button>
          )}
        </div>
      </ActionDialogShell>
    </Dialog>
  )
}

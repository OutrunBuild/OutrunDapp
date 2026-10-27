'use client'

/**
 * Generic write-progress dialog (2026-10-26 用户裁定): execution progress lives in its own
 * dialog — never a strip appended to the action dialog — and carries no buttons; it is
 * always the second-to-last dialog, yielding on confirmed to a success dialog
 * (components/global/tx-success-dialog.tsx) that closes the sequence. Cancelled/reverted
 * outcomes stay here until dismissed via the shell ✕ (error rows meanwhile render in the
 * underlying action dialog). Harness builds never open it (tx.active is inert).
 */
import type { Locale } from '@/lib/data/fixture-repository'

import { getCopy } from './copy'
import { ActionDialogShell } from './action-dialogs'
import { TxStatus, type TxState } from './tx-status'
import { Dialog } from '@/components/ui/dialog'

export function TxProgressDialog({
  locale,
  title,
  state,
  open,
  onDismiss,
}: {
  locale: Locale
  title: string
  state: TxState
  open: boolean
  onDismiss: () => void
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss()
      }}
    >
      <ActionDialogShell title={title} closeLabel={getCopy(locale).common.close}>
        <div className="tx-progress-body">
          <TxStatus locale={locale} state={state} />
        </div>
      </ActionDialogShell>
    </Dialog>
  )
}

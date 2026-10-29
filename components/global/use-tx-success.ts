'use client'

import { useEffect, useState } from 'react'

import type { WriteFlow } from './use-tx-center'

export type TxReceipt = { hash: string | null; chainId: number | null }

/**
 * Confirmed → success-dialog gate: captures the receipt link
 * before reset clears the tx context, opens the success dialog (the flow's last dialog)
 * and resets the write flow so the progress dialog never re-opens behind the receipt.
 * Echo rows stay each caller's click-time capture — they cannot be re-derived from flow
 * state once the inputs clear.
 */
export function useTxSuccessGate(tx: WriteFlow): {
  successOpen: boolean
  setSuccessOpen: (open: boolean) => void
  receipt: TxReceipt | null
} {
  const [successOpen, setSuccessOpen] = useState(false)
  const [receipt, setReceipt] = useState<TxReceipt | null>(null)
  useEffect(() => {
    if (tx.display === 'confirmed') {
      setReceipt({ hash: tx.context.txHash, chainId: tx.context.review?.chainId ?? null })
      setSuccessOpen(true)
      tx.reset()
    }
  }, [tx.display, tx.reset])
  return { successOpen, setSuccessOpen, receipt }
}

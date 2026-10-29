'use client'

import { Check, LoaderCircle } from 'lucide-react'

import type { Locale } from '@/lib/data/fixture-repository'

import { getCopy } from './copy'

export type TxState =
  | 'idle'
  | 'signing'
  | 'confirming'
  | 'confirmed'
  | 'cancelled'
  | 'cancelled-after-send'
  | 'reverted'

const TX_ORDER = ['signing', 'confirming', 'confirmed'] as const

/**
 * Transaction-signing status strip with three steps:
 * awaiting signature → confirming on-chain → confirmed.
 * The prototype has no wallet: signature/on-chain progress is simulated by the caller
 * on timers; no hash/gas, key-facts row omitted.
 * aria: transaction state is critical information; the container is assertive.
 */
export function TxStatus({ locale, state }: { locale: Locale; state: TxState }) {
  const copy = getCopy(locale)
  const labels = [copy.verse.txSign, copy.verse.txSubmit, copy.verse.txDone]

  // Terminal states: rejected signature = Cancelled with a non-failure tone;
  // revert = Reverted with a failure tone + reason placeholder. A cancel that lands after
  // broadcast is still Cancelled, but the write WAS sent — its note says so.
  if (state === 'cancelled' || state === 'cancelled-after-send' || state === 'reverted') {
    const reverted = state === 'reverted'
    const notes = {
      cancelled: copy.verse.txCancelledNote,
      'cancelled-after-send': copy.verse.txCancelledAfterSendNote,
      reverted: copy.verse.txRevertedNote,
    }
    return (
      <div
        className="tx-status__outcome"
        data-outcome={reverted ? 'reverted' : 'cancelled'}
        role={reverted ? 'alert' : 'status'}
      >
        <strong>{reverted ? copy.verse.txReverted : copy.verse.txCancelled}</strong>
        <p>{notes[state]}</p>
      </div>
    )
  }

  // Terminal confirmed renders all steps done: the spinner is progress-only and
  // must never spin on a settled state (a stuck spinner reads as "hung").
  const current = state === 'confirmed' ? TX_ORDER.length : TX_ORDER.indexOf(state as 'signing' | 'confirming')

  return (
    <ol className="tx-status" aria-live="assertive">
      {labels.map((label, index) => (
        <li
          key={label}
          className="tx-status__step"
          data-state={index < current ? 'done' : index === current ? 'active' : 'pending'}
        >
          {index < current ? (
            <Check aria-hidden="true" />
          ) : index === current ? (
            <LoaderCircle className="tx-status__spinner" aria-hidden="true" />
          ) : (
            <span className="tx-status__dot" aria-hidden="true" />
          )}
          {label}
        </li>
      ))}
    </ol>
  )
}

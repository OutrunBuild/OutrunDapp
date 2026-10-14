'use client'

import { useEffect, useRef, useState } from 'react'

import type { TxState } from './tx-status'

/**
 * Transaction-signing simulation driver: awaiting signature ≈1.6s → confirming
 * on-chain ≈1.2s → confirmed; the prototype has no wallet, so the frontend advances it
 * on timers, and pending timers are cleared on unmount.
 * Confirmed-state display differences stay with the caller
 * (registration flow = onConfirmed auto-dialog; participation flow = inline echo
 * block).
 */
export function useTxSimulation(onConfirmed?: () => void) {
  const [txState, setTxState] = useState<TxState>('idle')
  const txTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => txTimers.current.forEach(clearTimeout), [])
  // The confirmed-state callback reads the latest render's closure (a callback
  // captured on the first frame by the timer would read a stale value)
  const onConfirmedRef = useRef(onConfirmed)
  onConfirmedRef.current = onConfirmed

  function beginSigning() {
    setTxState('signing')
    txTimers.current.push(setTimeout(() => setTxState('confirming'), 1600))
    txTimers.current.push(
      setTimeout(() => {
        setTxState('confirmed')
        onConfirmedRef.current?.()
      }, 2800),
    )
  }

  /** Resets to idle for flows such as return-to-edit */
  function resetTx() {
    setTxState('idle')
  }

  return { txState, beginSigning, resetTx }
}

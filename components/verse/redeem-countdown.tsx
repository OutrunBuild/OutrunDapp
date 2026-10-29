'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Redemption waiting countdown (ticking seconds): counts down to the row's absolute maturity
 * deadline (pure display-layer tick, not an on-chain write), stops at 0; template carries the
 * `{t}` placeholder (copy.remaining). Wall rows additionally fire `onMature` once when the
 * real clock crosses the deadline — the same tick the display lands on 00:00:00 — so the host
 * can re-probe and flip the row's Pending/Withdraw split with the countdown instead of after
 * the next probe trigger; sample (frozen) rows never fire.
 *
 * Two time bases. Frozen rows (sample data) fix the timeline origin exactly once from the
 * snapshot (deadline − remainingMs = the sample anchor): a freshly dated remainingMs after a
 * confirmed-write re-read must not rebase a countdown already on screen, and the first paint
 * still renders `remainingMs` — a clock-free value — so SSR and hydration agree byte for byte.
 * Wall rows (client-probed) read the real clock on every render instead: the probe ran before
 * the row mounted, so anchoring the timeline on the snapshot would carry the probe-to-mount gap
 * as a permanent offset (performance.md: display countdowns store the deadline, not "remaining
 * + probe time"). A re-probe snapshot never rebases either base.
 */
export function RedeemCountdown({
  maturesAt,
  remainingMs,
  template,
  timeBase = 'frozen',
  onMature,
}: {
  maturesAt: string
  remainingMs: number
  template: string
  /** 'wall' = client-probed rows tick the real clock; 'frozen' = sample rows keep the frozen anchor */
  timeBase?: 'wall' | 'frozen'
  /** Fired once per instance when a wall row's real clock crosses the deadline (display-to-probe
   * sync, not a display feature); the host throttles and collapses rows into one re-probe. */
  onMature?: () => void
}) {
  const deadlineMs = Date.parse(maturesAt)
  // Origin frozen on the first render (useRef keeps its first argument).
  const originRef = useRef(Number.isFinite(deadlineMs) ? deadlineMs - remainingMs : null)
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)
  useEffect(() => {
    setElapsedMs(0)
    const start = Date.now()
    const id = setInterval(() => setElapsedMs(Date.now() - start), 1000)
    return () => clearInterval(id)
  }, [])
  const origin = originRef.current
  // Wall rows read the real clock on every render (the interval's state bump keeps the render
  // loop going); frozen rows run the snapshot-anchored timeline frozen at first render.
  const wallLeft =
    timeBase === 'wall' && Number.isFinite(deadlineMs)
      ? Math.max(0, deadlineMs - Date.now())
      : null
  const left =
    wallLeft ??
    (origin == null || elapsedMs == null
      ? Math.max(0, remainingMs)
      : Math.max(0, deadlineMs - origin - elapsedMs))
  const pad = (n: number) => String(n).padStart(2, '0')
  const time = `${pad(Math.floor(left / 3_600_000))}:${pad(Math.floor((left % 3_600_000) / 60_000))}:${pad(Math.floor((left % 60_000) / 1000))}`
  const [before, after] = template.split('{t}')
  // Zero-crossing signal: matured flips false→true exactly when the display lands on 00:00:00
  // (the deadline never rebases, so it never flips back). Fired in an effect — the render pass
  // itself must stay pure — and once per instance: a re-mount (tab re-entry) re-fires and
  // covers zero-crossings that happened while the row was unmounted.
  const matured = timeBase === 'wall' && Number.isFinite(deadlineMs) && left === 0
  const firedRef = useRef(false)
  useEffect(() => {
    if (!matured || firedRef.current) return
    firedRef.current = true
    onMature?.()
  }, [matured, onMature])
  return (
    <span data-state="waiting">
      {before}
      <span data-numeric>{time}</span>
      {after}
    </span>
  )
}

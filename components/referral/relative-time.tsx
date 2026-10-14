'use client'

import { useEffect, useState } from 'react'

import type { FixtureReferral, Locale } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'

/** Minute-granularity relative time copy; no timer — no rolling refresh while the page is open */
export function formatRelative(at: string, locale: Locale, now: number) {
  const ago = getCopy(locale).referral.ago
  const minutes = Math.max(0, Math.round((now - new Date(at).getTime()) / 60_000))
  if (minutes < 1) return ago.justNow
  if (minutes < 60) return ago.min.replaceAll('{n}', String(minutes))
  const hours = Math.round(minutes / 60)
  if (hours < 24) return ago.hour.replaceAll('{n}', String(hours))
  return ago.day.replaceAll('{n}', String(Math.round(hours / 24)))
}

/**
 * Relative time (referral history Time column).
 * The server's first frame already renders the relative time (the RSC passes in now, zero
 * hydration delta — no "date → relative" flicker); after mount it recomputes by the client clock
 * (deterministic output under the e2e frozen clock).
 */
export function RelativeTime({
  at,
  locale,
  now,
}: {
  at: FixtureReferral['transactions'][number]['at']
  locale: Locale
  now: number
}) {
  const [label, setLabel] = useState(() => formatRelative(at, locale, now))

  useEffect(() => {
    setLabel(formatRelative(at, locale, Date.now()))
  }, [at, locale])

  return (
    <time dateTime={at} suppressHydrationWarning>
      {label}
    </time>
  )
}

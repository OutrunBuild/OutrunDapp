'use client'

import { Check, Copy } from 'lucide-react'

import { getCopy } from './copy'
import { formatHex } from './signal-ui'
import { useCopy } from './use-copy'
import type { Locale } from '@/lib/data/fixture-repository'

/** Address copy atom (truncation = formatHex, copy behavior = useCopy,
 * shared site-wide; full = render the whole address, e.g. roomy dialog rows) */
export function CopyAddress({
  locale,
  value,
  head,
  tail,
  full = false,
}: {
  locale: Locale
  value: string
  head?: number
  tail?: number
  full?: boolean
}) {
  const copy = getCopy(locale).common
  const { copied, copy: copyToClipboard } = useCopy()
  const text = full ? value : formatHex(value, head, tail)
  return (
    <button
      type="button"
      className="token-strip__copy"
      onClick={() => copyToClipboard(value)}
      title={value}
      aria-label={copy.copyAddress}
    >
      <span data-numeric>{text}</span>
      {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
    </button>
  )
}

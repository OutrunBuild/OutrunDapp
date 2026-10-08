'use client'

import { Check, Copy } from 'lucide-react'

import { getCopy } from './copy'
import { formatHex } from './signal-ui'
import { useCopy } from './use-copy'
import type { Locale } from '@/lib/data/fixture-repository'

/** 地址复制原子（2026-10-07 由 verse/ 迁入 global；截断=formatHex、复制行为=useCopy 全站共享） */
export function CopyAddress({ locale, value }: { locale: Locale; value: string }) {
  const copy = getCopy(locale).common
  const { copied, copy: copyToClipboard } = useCopy()
  const short = formatHex(value)
  return (
    <button
      type="button"
      className="token-strip__copy"
      onClick={() => copyToClipboard(value)}
      title={copy.copyAddress}
      aria-label={copy.copyAddress}
    >
      <span data-numeric>{short}</span>
      {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
    </button>
  )
}

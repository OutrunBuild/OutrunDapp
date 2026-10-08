'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

import { getCopy } from './copy'
import type { Locale } from '@/lib/data/fixture-repository'

/** 地址复制原子（2026-10-07 由 verse/ 迁入 global：verse 与 referral 两域共用） */
export function CopyAddress({ locale, value }: { locale: Locale; value: string }) {
  const copy = getCopy(locale).common
  const [copied, setCopied] = useState(false)
  const short = `${value.slice(0, 6)}…${value.slice(-4)}`
  return (
    <button
      type="button"
      className="token-strip__copy"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1600)
        })
      }}
      title={copy.copyAddress}
      aria-label={copy.copyAddress}
    >
      <span data-numeric>{short}</span>
          {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
    </button>
  )
}

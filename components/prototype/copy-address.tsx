'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

import { getCopy } from './copy'
import type { Locale } from '@/lib/data/prototype-repository'

/** CA 复制原子：唯一需要客户端交互的统计条元素 */
export function CopyAddress({ locale, value }: { locale: Locale; value: string }) {
  const copy = getCopy(locale).verseDesk
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
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
    </button>
  )
}

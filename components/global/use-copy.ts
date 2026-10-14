'use client'

import { useState } from 'react'

/** Shared clipboard copy hook (CopyAddress / VerseShare / ReferralLinkPanel):
 *  success → copied resets after 1600ms; optional-chained clipboard, .then
 *  only, no .catch, no unmount cleanup */
export function useCopy() {
  const [copied, setCopied] = useState(false)
  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    })
  }
  const reset = () => setCopied(false)
  return { copied, copy, reset }
}

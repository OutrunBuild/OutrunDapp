'use client'

import { useState } from 'react'

/** 剪贴板复制 hook（2026-10-08 三处手写体收敛：CopyAddress / VerseShare / ReferralLinkPanel）：
 *  成功→copied 1600ms 回落；语义照抄收敛前——可选链 clipboard、仅 .then、无 .catch、无卸载清理 */
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

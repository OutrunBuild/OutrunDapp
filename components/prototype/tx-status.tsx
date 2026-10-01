'use client'

import { Check, LoaderCircle } from 'lucide-react'

import type { Locale } from '@/lib/data/prototype-repository'

import { getCopy } from './copy'

export type TxState = 'idle' | 'signing' | 'confirming' | 'confirmed'

const TX_ORDER = ['signing', 'confirming', 'confirmed'] as const

/**
 * 交易签名状态条 = component-contract §8 TransactionStatus 首个原型落地
 * （state-matrix T4 等待签名 → T5 上链确认 → T6 已确认）。
 * 原型无钱包：签名/上链由调用方定时模拟推进，无 hash/gas，关键事实行省略。
 * aria：交易状态是关键信息，容器 assertive（契约 §8）。
 */
export function TxStatus({ locale, state }: { locale: Locale; state: 'signing' | 'confirming' | 'confirmed' }) {
  const copy = getCopy(locale)
  const labels = [copy.verse.txSign, copy.verse.txSubmit, copy.verse.txDone]
  const current = TX_ORDER.indexOf(state)

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

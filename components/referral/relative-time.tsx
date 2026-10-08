'use client'

import { useEffect, useState } from 'react'

import type { FixtureReferral, Locale } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'

/** 分钟粒度相对时间文案；无定时器——页面驻留期间不滚动刷新 */
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
 * 相对时间（返佣流水 Time 列，参照重设计 2026-10-07）。
 * 服务端首帧即渲染相对时间（RSC 传入 now，水合零差异——无「日期→相对」闪变）；
 * 挂载后改按客户端时钟重算（e2e 冻结时钟下输出确定）。
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

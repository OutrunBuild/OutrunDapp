'use client'

import type { ReactNode } from 'react'

import { useMockWallet } from './mock-wallet'

/**
 * 用户数据闸门（2026-10-08 用户裁定）：无用户参与（mock 钱包未连接，真钱包接入前
 * 唯一「参与」信号）时不渲染子树——收益组合/推荐页的数据卡片整体隐藏而非零值展示；
 * 机制介绍类内容（如 referral 运作方式）不归本闸门管辖，由页面自行留在外面。
 * 与 PortfolioZoneTabs/ReferralHistory 同构：RSC 渲染的面板经 children 传入，
 * 本组件只切换显隐；SSR 与首帧客户端快照恒为未连接，无水合闪变。
 */
export function UserDataGate({ children }: { children: ReactNode }) {
  const { connected } = useMockWallet()
  if (!connected) return null
  return <>{children}</>
}

'use client'

import { useSyncExternalStore } from 'react'

/**
 * 原型级模拟连接状态（真钱包接入前的统一占位，2026-09-24 用户裁定）：
 * 头部 WalletControl 两处实例与 Swap CTA 共享同一开关，点击任一处在全站切换
 * Connected（fixture acct-001 地址由壳层/面板各自传入展示）/Disconnected。
 * 仅切换展示态，不伪造任何链上写操作成功。
 *
 * chainId = 模拟「钱包当前连接网络」（2026-09-24 用户裁定：链切换唯一入口=
 * header GS-2 链选择器，卡内芯片已删）：默认取选择器默认链 chains[0]=
 * Ethereum Sepolia(11155111)；switchChain 只改本地展示态——对应真钱包的
 * 切换网络请求，不是链上写操作。
 */
const DEFAULT_CHAIN_ID = 11155111

let connected = false
let chainId = DEFAULT_CHAIN_ID
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function toggle() {
  connected = !connected
  emit()
}

function switchChain(next: number) {
  chainId = next
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return connected
}

function getChainSnapshot() {
  return chainId
}

/** SSR 快照：服务端恒为未连接（模拟状态仅存在于客户端会话内） */
function getServerSnapshot() {
  return false
}

function getChainServerSnapshot() {
  return DEFAULT_CHAIN_ID
}

export function useMockWallet(): {
  connected: boolean
  chainId: number
  toggle: () => void
  switchChain: (chainId: number) => void
} {
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const network = useSyncExternalStore(subscribe, getChainSnapshot, getChainServerSnapshot)
  return { connected: value, chainId: network, toggle, switchChain }
}

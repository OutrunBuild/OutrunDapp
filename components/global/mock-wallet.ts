'use client'

import { useSyncExternalStore } from 'react'

/**
 * Prototype-level mock connection state (the unified placeholder until a real wallet
 * is integrated):
 * the two header WalletControl instances and the Swap CTA share one toggle; clicking
 * any of them switches Connected/Disconnected site-wide (the fixture acct-001 address
 * is passed in for display by the shell/panels separately).
 * Only display state flips; no on-chain write is faked as successful.
 *
 * chainId = mocks "the wallet's currently connected network"; the header chain
 * selector is the single entry point for chain switching: defaults to the selector's
 * default chain chains[0] =
 * Ethereum Sepolia (chainId 11155111); switchChain only changes local display state —
 * the counterpart of a real wallet's switch-network request, not an on-chain write.
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

/** SSR snapshot: the server is always disconnected (mock state exists only within the
 * client session) */
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

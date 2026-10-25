'use client'

import { useMemo } from 'react'
import { createPublicClient, custom, type PublicClient } from 'viem'

import { getClientChainConfig } from '@/lib/web3/chains'
import { getActiveEip1193Provider, useActiveEip1193Provider } from '@/lib/web3/active-provider'

import type { ContractReader } from './execution-reads'

export type WalletProviderReader = {
  client: PublicClient
  reader: ContractReader
  addresses: Record<string, string>
}

/** Wallet-provider-bound public client for a given chain (null when the chain is undeployed or
 *  no provider exists). Reads route through the wallet's RPC — the client-side path for
 *  personal values (they never ride the server path). Consumers gate the
 *  chainId they pass (a verse-scoped read must pass the verse's execution chain — another
 *  chain's deployment reverts InvalidVerseId). */
export function useWalletProviderReader(chainId: number | null): WalletProviderReader | null {
  const activeProvider = useActiveEip1193Provider()
  return useMemo(() => {
    if (chainId == null) return null
    const resolved = getClientChainConfig(chainId)
    if (resolved.status !== 'ok' || resolved.config.contracts.status !== 'deployed') return null
    const provider = activeProvider ?? getActiveEip1193Provider()
    if (!provider) return null
    const client = createPublicClient({
      chain: resolved.config.viemChain,
      transport: custom({ request: provider.request }),
    })
    return {
      client,
      reader: { read: (params) => client.readContract(params) as Promise<unknown> },
      addresses: resolved.config.contracts.addresses as Record<string, string>,
    }
  }, [chainId, activeProvider])
}

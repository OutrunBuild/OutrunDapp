// Privy + wagmi assembly (architecture.md §6.1/§6.2/§7).
// - App id comes only from NEXT_PUBLIC_PRIVY_APP_ID (the secret never enters the frontend, §14).
// - wagmi transports carry no RPC URLs and no keys: every chain's transport delegates to the
//   active wallet's EIP-1193 provider and fails closed when nothing is connected. Server-side
//   reads keep using the resolved Alchemy/Infura endpoints (public-client.ts); the wallet
//   provider only serves the connected account's own calls (code/balance/simulation/send).
import { useSyncExternalStore } from 'react';

import { PrivyProvider } from '@privy-io/react-auth';
import { createConfig } from '@privy-io/wagmi';
import { custom, type Transport } from 'viem';
import { arbitrumSepolia, baseSepolia, bscTestnet } from 'viem/chains';

/**
 * Wallet-available chains: testnets only (§26 chainset). Mainnets stay structurally
 * undeployed until their deployment certification round — listing them here makes the
 * embedded wallet default to mainnet (mainnet.rpc.privy.systems 400) and breaks switching.
 */
export const WALLET_CHAINS = [arbitrumSepolia, baseSepolia, bscTestnet] as const;

export type Eip1193Request = (args: { method: string; params?: unknown }) => Promise<unknown>;
export type Eip1193ProviderLike = { request: Eip1193Request };

let activeProvider: Eip1193ProviderLike | null = null;
let providerRevision = 0;
const providerListeners = new Set<() => void>();

function emitProvider(): void {
  providerListeners.forEach((listener) => listener());
}

/**
 * Register (or clear) the active wallet's EIP-1193 provider backing all six transports.
 * The stored wrapper binds request to the instance: Privy embedded providers implement
 * request() on the prototype and read this inside it, and every consumer extracts the
 * reference (viem custom({request})) — an unbound store turns every wallet RPC into a
 * TypeError that read probes silently swallow as "not claimable".
 */
export function setActiveEip1193Provider(provider: Eip1193ProviderLike | null): void {
  activeProvider = provider === null ? null : { request: (args) => provider.request(args) };
  providerRevision += 1;
  emitProvider();
}

export function getActiveEip1193Provider(): Eip1193ProviderLike | null {
  return activeProvider;
}

/**
 * Provider-direct network switch: wallet_switchEthereumChain straight to the active
 * provider, wallet_addEthereumChain on 4902 (chain not added). The wagmi/Privy connector
 * path can run on stale state (cached chainId lies after an in-wallet switch; nobody
 * app-side subscribes chainChanged) — the switch rides the same provider truth the
 * execution gate reads. Returns false when no provider or the wallet rejects.
 */
export async function switchProviderChain(chainId: number): Promise<boolean> {
  const provider = activeProvider;
  if (!provider) return false;
  const hex = `0x${chainId.toString(16)}`;
  const chain = WALLET_CHAINS.find((entry) => entry.id === chainId);
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: hex }],
    });
    return true;
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 4902 || !chain) return false;
    try {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: hex,
            chainName: chain.name,
            nativeCurrency: chain.nativeCurrency,
            rpcUrls: [...chain.rpcUrls.default.http],
            ...(chain.blockExplorers?.default.url
              ? { blockExplorerUrls: [chain.blockExplorers.default.url] }
              : {}),
          },
        ],
      });
      return true;
    } catch {
      return false;
    }
  }
}

function subscribeProvider(listener: () => void): () => void {
  providerListeners.add(listener);
  return () => {
    providerListeners.delete(listener);
  };
}

/**
 * Subscribable provider readiness: returns the active provider (or null). Components
 * that read it inside effects must include the revision in their deps so a late
 * connector.getProvider() registration re-runs probes instead of leaving them stale.
 */
export function useActiveEip1193Provider(): Eip1193ProviderLike | null {
  useSyncExternalStore(
    subscribeProvider,
    () => providerRevision,
    () => providerRevision,
  );
  return getActiveEip1193Provider();
}

async function registryRequest(args: { method: string; params?: unknown }): Promise<unknown> {
  if (!activeProvider) throw new Error('outrun: no active wallet provider');
  return activeProvider.request(args);
}

/** One provider-backed transport per chain (own seam: unit tests pin this, not wagmi internals). */
export function buildChainTransports(): Record<(typeof WALLET_CHAINS)[number]['id'], Transport> {
  const transport = () =>
    custom(
      {
        request: registryRequest,
      },
      // Fail-closed must be immediate: no silent retries when no wallet is connected.
      { retryCount: 0 },
    );
  return {
    [arbitrumSepolia.id]: transport(),
    [baseSepolia.id]: transport(),
    [bscTestnet.id]: transport(),
  };
}

export function buildWagmiConfig(): ReturnType<typeof createConfig> {
  return createConfig({
    chains: WALLET_CHAINS,
    transports: buildChainTransports(),
  });
}

export function getPrivyAppId(env?: Record<string, string | undefined>): string | null {
  // Default (no-arg) path must use static member access so Next inlines
  // NEXT_PUBLIC_PRIVY_APP_ID into the client bundle at build time; dynamic
  // env['…'] lookups are never inlined (Next docs: environment-variables).
  const raw =
    env === undefined ? process.env.NEXT_PUBLIC_PRIVY_APP_ID : env['NEXT_PUBLIC_PRIVY_APP_ID'];
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  return trimmed ? trimmed : null;
}

/** False in fixture mode / e2e / any build without an app id: the providers shell then
 * renders children unwrapped and the account machine rests at Disconnected. */
export function isWeb3Configured(env?: Record<string, string | undefined>): boolean {
  return getPrivyAppId(env) !== null;
}

type PrivyConfig = NonNullable<Parameters<typeof PrivyProvider>[0]['config']>;

/**
 * Minimal Privy client config: Google/X OAuth + external wallets only (no email OTP).
 * Embedded EOAs auto-mint on OAuth login for users without a wallet; no login modal
 * styling and no wallet list here — the product Login dialog is our own UI (§7),
 * never the third-party default modal.
 */
export function buildPrivyConfig(): PrivyConfig {
  return {
    loginMethods: ['google', 'twitter', 'wallet'],
    // Testnets only: keeps the embedded wallet off mainnet (mainnet.rpc.privy.systems 400).
    supportedChains: [...WALLET_CHAINS],
    // BSC Testnet first: Faucet hub + the only verse-bearing chain (new sessions land here).
    defaultChain: bscTestnet,
    embeddedWallets: {
      ethereum: {
        createOnLogin: 'users-without-wallets',
      },
    },
  };
}

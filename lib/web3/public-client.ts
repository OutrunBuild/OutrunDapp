// Read-side RPC client (architecture.md §5): viem fallback transport with health ranking and
// multicall batching. Wallet-side wiring (Privy/Kernel/Type-4) is stage 6 -- this module must stay
// free of wallet concerns. Chains that resolve to not-configured (or undeployed without RPC)
// return null; callers map that to the structured unavailable state, never to a public RPC.
import { createPublicClient, fallback, http, type PublicClient } from 'viem';
import { getChainConfig } from './chains';

const clients = new Map<number, PublicClient>();

export function getPublicClient(chainId: number): PublicClient | null {
  const resolved = getChainConfig(chainId);
  if (resolved.status !== 'ok' || !resolved.config.rpc) return null;
  let client = clients.get(chainId);
  if (!client) {
    client = createPublicClient({
      chain: resolved.config.viemChain,
      transport: fallback(
        [http(resolved.config.rpc.primary), http(resolved.config.rpc.fallback)],
        // viem probes both endpoints periodically and ranks by latency/stability
        { rank: true },
      ),
      // readContract calls issued in the same tick aggregate into one multicall3 batch
      batch: { multicall: true },
    });
    clients.set(chainId, client);
  }
  return client;
}

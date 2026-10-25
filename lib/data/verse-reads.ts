'use server';

// On-demand cross-chain account reads. Genesis settles per chain, and the wallet provider
// only serves the wallet's CURRENT chain — an all-chain personal figure therefore needs the
// server's per-chain RPC access for the sibling legs. This is an explicit client-initiated
// action (never part of the SSR tree), reading exactly the accounts' genesis funds for the
// verse's landed chains, nothing else.

import { getOnchainRepository } from '@/lib/data/repository';

/** Per-chain equivalent genesis funds (uAsset 18-dec base units, string-serialized) for one
 *  account across the verse's landed chains. A chain whose read fails is absent from the map —
 *  the caller degrades that leg to '--', never to a fabricated zero. */
export async function readGenesisFundsByChain(input: {
  verseId: string;
  chains: number[];
  account: string;
}): Promise<Record<string, string>> {
  if (!/^0x[0-9a-fA-F]{40}$/.test(input.account) || !/^\d+$/.test(input.verseId)) return {};
  const rpc = getOnchainRepository();
  const rows = await Promise.all(
    input.chains.map(async (chainId) => ({
      chainId,
      result: await rpc.getAccountGenesisFunds(chainId, BigInt(input.verseId), input.account),
    })),
  );
  const out: Record<string, string> = {};
  for (const { chainId, result } of rows) {
    if (result.status === 'ok') out[String(chainId)] = result.data.toString();
  }
  return out;
}

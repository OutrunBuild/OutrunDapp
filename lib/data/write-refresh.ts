'use server';

// Post-write server refresh — the action the tx center calls when a write with a declared
// scope confirms (see write-refresh-core.ts for the mechanism). Everything on the page that
// renders server data for that verse — progress meters, participant count, thresholds, and
// any field added later — converges in the caller's router.refresh() that follows.
//
// Fixture/harness builds never invoke this (no write ever confirms there); importing it stays
// side-effect-free (the onchain adapter's boot warm-up is env-gated).

import { getGraphRepository } from '@/lib/data/graph/graph-repository';
import { getOnchainRepository } from '@/lib/data/repository';
import { getVerse, invalidateVerseConfig } from '@/lib/data/onchain-source';

import { orchestrateVerseRefresh } from './write-refresh-core';

export async function refreshVerseAfterWrite(input: {
  chainId: number;
  verseId: string;
  /** The write's tx hash — gates subgraph freshness on the receipt's own block. */
  txHash?: string;
}): Promise<void> {
  await orchestrateVerseRefresh(
    {
      getWriteBlock: async (chainId, txHash) => {
        if (txHash) {
          const receipt = await getOnchainRepository().getTransactionReceipt(chainId, txHash);
          if (receipt.status === 'ok' && receipt.data) return receipt.data.blockNumber;
        }
        // No hash (or receipt unreadable): the finality-lagged head is the best stand-in.
        const block = await getOnchainRepository().getSafeBlockNumber(chainId);
        return block.status === 'ok' ? block.data : null;
      },
      getIndexedBlock: (chainId) => getGraphRepository().getIndexedBlock(chainId),
      invalidateVerse: (verseId) => getGraphRepository().invalidateVerse(verseId),
      invalidateVerseConfig,
      primeVerse: (verseId) => getVerse(verseId),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    },
    input,
  );
}

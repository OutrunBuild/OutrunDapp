// Shared mapping helpers. Every entity primary key embeds the chainId ("{chainId}-…"); the chain
// comes from dataSource.network() (graph-node exposes no numeric chainId for studio networks).
import { dataSource, ethereum } from '@graphprotocol/graph-ts';

export function chainId(): string {
  const network = dataSource.network();
  if (network == 'arbitrum-sepolia') return '421614';
  if (network == 'base-sepolia') return '84532';
  if (network == 'chapel') return '97'; // The Graph canonical id for BNB Smart Chain Testnet
  return network; // unknown network: fall back to its name so keys stay unique per network
}

export function chainIdInt(): i32 {
  const network = dataSource.network();
  if (network == 'arbitrum-sepolia') return 421614;
  if (network == 'base-sepolia') return 84532;
  if (network == 'chapel') return 97;
  return 0;
}

/** {chainId}-{scope}-{txHash}-{logIndex} */
export function scopedId(scope: string, event: ethereum.Event): string {
  return (
    chainId() +
    '-' +
    scope +
    '-' +
    event.transaction.hash.toHexString() +
    '-' +
    event.logIndex.toString()
  );
}

/** Launcher Stage enum order: 0 Genesis / 1 Refund / 2 Locked / 3 Unlocked (frozen ABI) */
export function stageName(stage: i32): string {
  if (stage == 0) return 'genesis';
  if (stage == 1) return 'refund';
  if (stage == 2) return 'locked';
  return 'unlocked';
}

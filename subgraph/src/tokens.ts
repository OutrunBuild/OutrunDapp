// POLSplitter operations (split/merge/redeem) and MemecoinYieldVault activity for dynamically
// deployed vaults. PT/YT/POL token Transfer indexing is intentionally absent: current product
// surfaces consume domain events and RPC balance reads; raw transfer replay has no query path
// (and would grow unbounded on mainnet).
import { Merge, RedeemPT, RedeemYT, Split } from '../generated/PolSplitter/PolSplitter';
import {
  AccumulateYields,
  DelegateChanged,
  Deposit,
  RedeemRequest,
  Withdraw,
} from '../generated/templates/MemecoinYieldVault/MemecoinYieldVault';
import { ParticipationClaim, VaultActivity } from '../generated/schema';
import { BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { chainIdInt, scopedId } from './utils';

export function handleSplit(event: Split): void {
  const e = new ParticipationClaim(scopedId(event.params.verseId.toString() + '-pol-split', event));
  e.chainId = chainIdInt();
  e.verseId = event.params.verseId;
  e.kind = 'pol-split';
  e.receiver = event.params.user;
  e.polAmount = event.params.polAmount;
  e.ptAmount = event.params.ptAmount;
  e.ytAmount = event.params.ytAmount;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
}

export function handleMerge(event: Merge): void {
  const e = new ParticipationClaim(scopedId(event.params.verseId.toString() + '-pol-merge', event));
  e.chainId = chainIdInt();
  e.verseId = event.params.verseId;
  e.kind = 'pol-merge';
  e.receiver = event.params.user;
  // merging consumes `amount` PT plus `amount` YT and mints `polAmount` POL
  e.ptAmount = event.params.amount;
  e.ytAmount = event.params.amount;
  e.polAmount = event.params.polAmount;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
}

export function handleRedeemPT(event: RedeemPT): void {
  const e = new ParticipationClaim(scopedId(event.params.verseId.toString() + '-redeem-pt', event));
  e.chainId = chainIdInt();
  e.verseId = event.params.verseId;
  e.kind = 'redeem-pt';
  e.receiver = event.params.to;
  e.ptAmount = event.params.ptAmount;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
}

export function handleRedeemYT(event: RedeemYT): void {
  const e = new ParticipationClaim(scopedId(event.params.verseId.toString() + '-redeem-yt', event));
  e.chainId = chainIdInt();
  e.verseId = event.params.verseId;
  e.kind = 'redeem-yt';
  e.receiver = event.params.to;
  e.ytAmount = event.params.ytAmount;
  e.uAssetAmount = event.params.uAssetAmount;
  e.memecoinAmount = event.params.memecoinAmount;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
}

function writeVault(kind: string, event: ethereum.Event): VaultActivity {
  const e = new VaultActivity(scopedId('vault-' + kind, event));
  e.chainId = chainIdInt();
  e.vault = event.address;
  e.kind = kind;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  return e;
}

export function handleVaultDeposit(event: Deposit): void {
  const e = writeVault('deposit', event);
  e.sender = event.params.sender;
  e.owner = event.params.owner;
  e.assets = event.params.assets;
  e.shares = event.params.shares;
  e.save();
}

export function handleVaultWithdraw(event: Withdraw): void {
  const e = writeVault('withdraw', event);
  e.sender = event.params.sender;
  e.receiver = event.params.receiver;
  e.owner = event.params.owner;
  e.assets = event.params.assets;
  e.shares = event.params.shares;
  e.save();
}

export function handleVaultRedeemRequest(event: RedeemRequest): void {
  const e = writeVault('redeem-request', event);
  e.controller = event.params.controller;
  e.owner = event.params.owner;
  e.sender = event.params.sender;
  e.shares = event.params.shares;
  e.assets = event.params.lockedAssets;
  e.save();
}

export function handleVaultDelegateChanged(event: DelegateChanged): void {
  const e = writeVault('delegate-changed', event);
  e.owner = event.params.delegator;
  e.fromDelegate = event.params.fromDelegate;
  e.toDelegate = event.params.toDelegate;
  e.save();
}

export function handleVaultAccumulateYields(event: AccumulateYields): void {
  const e = writeVault('yields-accumulated', event);
  e.yieldSource = event.params.yieldSource;
  e.yieldAmount = event.params.yield_;
  e.exchangeRate = event.params.exchangeRate;
  e.save();
}

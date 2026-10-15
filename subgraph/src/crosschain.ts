// LayerZero send/receive events: uAsset OFT bridges (per-family static sources), Memecoin OFT
// (template), omnichain staking compose flow (Staker) and the interoperation entry. Token
// Transfer events are intentionally not indexed (no product query path; RPC owns balances).
import { OFTReceived as UAssetOftReceivedUeth, OFTSent as UAssetOftSentUeth } from '../generated/UAssetUeth/UAssetUeth';
import { OFTReceived as UAssetOftReceivedUusd, OFTSent as UAssetOftSentUusd } from '../generated/UAssetUusd/UAssetUusd';
import { OFTReceived as UAssetOftReceivedUbnb, OFTSent as UAssetOftSentUbnb } from '../generated/UAssetUbnb/UAssetUbnb';
import {
  OFTReceived as MemecoinOftReceived,
  OFTSent as MemecoinOftSent,
} from '../generated/templates/Memecoin/Memecoin';
import {
  ComposeRejected,
  OmnichainMemecoinStakingProcessed,
  StakingComposeSettled,
} from '../generated/Staker/Staker';
import { OmnichainMemecoinStaking as InteropStaking } from '../generated/Interoperation/Interoperation';
import { LayerZeroMessage } from '../generated/schema';
import { BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { chainId, chainIdInt, scopedId } from './utils';

function writeMessage(
  kind: string,
  guid: Bytes | null,
  srcEid: BigInt | null,
  dstEid: BigInt | null,
  token: Bytes | null,
  account: Bytes | null,
  amountSentLD: BigInt | null,
  amountReceivedLD: BigInt | null,
  amount: BigInt | null,
  remainder: BigInt | null,
  event: ethereum.Event,
): void {
  const e = new LayerZeroMessage(scopedId('lz-' + kind, event));
  e.chainId = chainIdInt();
  e.kind = kind;
  e.guid = guid;
  e.srcEid = srcEid;
  e.dstEid = dstEid;
  e.token = token;
  e.account = account;
  e.amountSentLD = amountSentLD;
  e.amountReceivedLD = amountReceivedLD;
  e.amount = amount;
  e.remainder = remainder;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
}

// --- uAsset OFT bridges -------------------------------------------------------------

export function handleUAssetOftSentUeth(event: UAssetOftSentUeth): void {
  writeMessage('oft-sent', event.params.guid, null, event.params.dstEid, event.address, event.params.fromAddress, event.params.amountSentLD, event.params.amountReceivedLD, null, null, event);
}
export function handleUAssetOftReceivedUeth(event: UAssetOftReceivedUeth): void {
  writeMessage('oft-received', event.params.guid, event.params.srcEid, null, event.address, event.params.toAddress, null, event.params.amountReceivedLD, null, null, event);
}
export function handleUAssetOftSentUusd(event: UAssetOftSentUusd): void {
  writeMessage('oft-sent', event.params.guid, null, event.params.dstEid, event.address, event.params.fromAddress, event.params.amountSentLD, event.params.amountReceivedLD, null, null, event);
}
export function handleUAssetOftReceivedUusd(event: UAssetOftReceivedUusd): void {
  writeMessage('oft-received', event.params.guid, event.params.srcEid, null, event.address, event.params.toAddress, null, event.params.amountReceivedLD, null, null, event);
}
export function handleUAssetOftSentUbnb(event: UAssetOftSentUbnb): void {
  writeMessage('oft-sent', event.params.guid, null, event.params.dstEid, event.address, event.params.fromAddress, event.params.amountSentLD, event.params.amountReceivedLD, null, null, event);
}
export function handleUAssetOftReceivedUbnb(event: UAssetOftReceivedUbnb): void {
  writeMessage('oft-received', event.params.guid, event.params.srcEid, null, event.address, event.params.toAddress, null, event.params.amountReceivedLD, null, null, event);
}

// --- Memecoin OFT (template) ----------------------------------------------------------

export function handleMemecoinOftSent(event: MemecoinOftSent): void {
  writeMessage('oft-sent', event.params.guid, null, event.params.dstEid, event.address, event.params.fromAddress, event.params.amountSentLD, event.params.amountReceivedLD, null, null, event);
}

export function handleMemecoinOftReceived(event: MemecoinOftReceived): void {
  writeMessage('oft-received', event.params.guid, event.params.srcEid, null, event.address, event.params.toAddress, null, event.params.amountReceivedLD, null, null, event);
}

// --- Omnichain staking flow ------------------------------------------------------------

export function handleInteroperationStaking(event: InteropStaking): void {
  writeMessage('interoperation', event.params.guid, null, null, event.params.memecoin, event.params.sender, event.params.amountSentLD, null, event.params.amount, event.params.remainder, event);
}

export function handleStakingProcessed(event: OmnichainMemecoinStakingProcessed): void {
  writeMessage('staking-processed', event.params.guid, null, null, event.params.memecoin, event.params.receiver, null, null, event.params.amount, null, event);
}

export function handleStakingComposeSettled(event: StakingComposeSettled): void {
  writeMessage('compose-settled', event.params.guid, null, null, event.params.memecoin, event.params.receiver, null, null, event.params.amount, null, event);
}

export function handleComposeRejected(event: ComposeRejected): void {
  writeMessage('compose-rejected', event.params.guid, null, null, event.params.token, null, null, null, event.params.amount, null, event);
}

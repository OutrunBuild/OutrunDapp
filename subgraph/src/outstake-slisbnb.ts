// OutrunStakingPosition.slisBNB (BSC Testnet only): separate file so the arb/base manifests
// without this data source never compile these imports.
import {
  Redeem as RedeemSlisbnb,
  Stake as StakeSlisbnb,
  StakeForGenesis as StakeForGenesisSlisbnb,
} from '../generated/StakingPositionSlisbnb/StakingPositionSlisbnb';
import { CdpPositionEvent } from '../generated/schema';
import { chainIdInt, scopedId } from './utils';

export function handleCdpStakeSlisbnb(event: StakeSlisbnb): void {
  const e = new CdpPositionEvent(scopedId(event.params.positionId.toString() + '-stake', event));
  e.chainId = chainIdInt();
  e.positionId = event.params.positionId;
  e.kind = 'stake';
  e.owner = event.params.owner;
  e.amountInSY = event.params.amountInSY;
  e.mintedUAsset = event.params.mintedUAsset;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
}

export function handleCdpStakeForGenesisSlisbnb(event: StakeForGenesisSlisbnb): void {
  const e = new CdpPositionEvent(scopedId(event.params.positionId.toString() + '-stake-genesis', event));
  e.chainId = chainIdInt();
  e.positionId = event.params.positionId;
  e.kind = 'stake-for-genesis';
  e.owner = event.params.positionOwner;
  e.verseId = event.params.verseId;
  e.mintedUAsset = event.params.mintedUAsset;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
}

export function handleCdpRedeemSlisbnb(event: RedeemSlisbnb): void {
  const e = new CdpPositionEvent(scopedId(event.params.positionId.toString() + '-redeem', event));
  e.chainId = chainIdInt();
  e.positionId = event.params.positionId;
  e.kind = 'redeem';
  e.owner = event.params.owner;
  e.syRedeemed = event.params.syRedeemed;
  e.principalBurned = event.params.principalBurned;
  e.interestPaid = event.params.interestPaid;
  e.receiver = event.params.receiver;
  e.tokenOut = event.params.tokenOut;
  e.amountTokenOut = event.params.amountTokenOut;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
}

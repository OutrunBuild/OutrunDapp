// POLend leveraged-genesis participation and claim history (leveraged genesis, credit-funded
// genesis, leveraged refunds, leveraged YT claims, residual claims).
import { BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';
import {
  ClaimLeveragedYT,
  ClaimRefund,
  ClaimResidual,
  CreditRefunded,
  LeveragedGenesis,
  LeveragedGenesisWithCredit,
} from '../generated/Polend/Polend';
import {
  LeveragedGenesisParticipation,
  ParticipationClaim,
  ParticipationRefund,
  ProtocolStats,
  Verse,
  VerseParticipant,
} from '../generated/schema';
import { chainId, chainIdInt, scopedId } from './utils';

function stats(): ProtocolStats {
  const id = chainId() + '-protocol';
  let row = ProtocolStats.load(id);
  if (row === null) {
    row = new ProtocolStats(id);
    row.chainId = chainIdInt();
    row.verseCount = 0;
    row.deployedVerseCount = 0;
    row.participantCount = 0;
    row.participationTotal = BigInt.fromI32(0);
    row.save();
  }
  return row;
}

/** Mirror of verse-participation accumulateFunds (one copy per mapping file: mappings are
 * per-datasource and cannot share code that touches the other's entities). */
function accumulateLeveraged(verseId: BigInt, amount: BigInt, account: Bytes): void {
  const verse = Verse.load(chainId() + '-' + verseId.toString());
  if (verse === null) return;
  verse.totalLeveragedInterest = verse.totalLeveragedInterest.plus(amount);
  const markerId = chainId() + '-' + verseId.toString() + '-' + account.toHexString();
  if (VerseParticipant.load(markerId) === null) {
    const marker = new VerseParticipant(markerId);
    marker.chainId = chainIdInt();
    marker.verseId = verseId;
    marker.account = account;
    marker.save();
    verse.participantCount = verse.participantCount + 1;
    const aggregate = stats();
    aggregate.participantCount = aggregate.participantCount + 1;
    aggregate.save();
  }
  const aggregate = stats();
  aggregate.participationTotal = aggregate.participationTotal.plus(amount);
  aggregate.save();
  verse.save();
}

function leveraged(eventKind: string, kind: string, verseId: BigInt, payer: Bytes, user: Bytes, amount: BigInt, event: ethereum.Event): void {
  const e = new LeveragedGenesisParticipation(scopedId(verseId.toString() + '-' + eventKind, event));
  e.chainId = chainIdInt();
  e.verseId = verseId;
  e.kind = kind;
  e.payer = payer;
  e.user = user;
  e.amount = amount;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
}

export function handleLeveragedGenesis(event: LeveragedGenesis): void {
  leveraged('lev-genesis', 'direct', event.params.verseId, event.params.payer, event.params.user, event.params.interestAmount, event);
  accumulateLeveraged(event.params.verseId, event.params.interestAmount, event.params.user);
}

export function handleLeveragedGenesisWithCredit(event: LeveragedGenesisWithCredit): void {
  leveraged('lev-genesis-credit', 'credit', event.params.verseId, event.params.payer, event.params.user, event.params.creditAmount, event);
  accumulateLeveraged(event.params.verseId, event.params.creditAmount, event.params.user);
}

export function handlePolendClaimRefund(event: ClaimRefund): void {
  const e = new ParticipationRefund(scopedId(event.params.verseId.toString() + '-lev-refund', event));
  e.chainId = chainIdInt();
  e.verseId = event.params.verseId;
  e.kind = 'leveraged';
  e.receiver = event.params.to;
  e.amount = event.params.refundedAmount;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
}

export function handleCreditRefunded(event: CreditRefunded): void {
  const e = new ParticipationRefund(scopedId(event.params.verseId.toString() + '-credit-refund', event));
  e.chainId = chainIdInt();
  e.verseId = event.params.verseId;
  e.kind = 'leveraged-credit';
  e.receiver = event.params.to;
  e.amount = event.params.amount;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
}

export function handleClaimLeveragedYT(event: ClaimLeveragedYT): void {
  const e = new ParticipationClaim(scopedId(event.params.verseId.toString() + '-claim-lev-yt', event));
  e.chainId = chainIdInt();
  e.verseId = event.params.verseId;
  e.kind = 'leveraged-yt';
  e.receiver = event.params.to;
  e.ytAmount = event.params.amount;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
}

export function handleClaimResidual(event: ClaimResidual): void {
  const e = new ParticipationClaim(scopedId(event.params.verseId.toString() + '-claim-residual', event));
  e.chainId = chainIdInt();
  e.verseId = event.params.verseId;
  e.kind = 'residual';
  e.receiver = event.params.to;
  e.uAssetAmount = event.params.uAssetAmount;
  e.memecoinAmount = event.params.memecoinAmount;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
}

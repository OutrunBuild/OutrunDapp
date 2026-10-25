// Verse registration / lifecycle (MemeverseLauncher + registration hub) and plain genesis /
// preorder participation history. Event shapes come from the frozen ABIs; the RegisterMemeverse
// tuple carries every dynamically deployed contract address, which is where templates attach.
import { BigInt, Bytes } from '@graphprotocol/graph-ts';
import {
  ChangeStage,
  ClaimNormalFees,
  ClaimNormalYT,
  ClaimPreorderMemecoin,
  Genesis,
  Preorder,
  RegisterMemeverse,
  Refund,
  RefundPreorder,
  SetExternalInfo,
} from '../generated/Launcher/Launcher';
import {
  GenesisParticipation,
  ParticipationClaim,
  ParticipationRefund,
  PreorderParticipation,
  ProtocolStats,
  Verse,
  VerseParticipant,
  VerseStageChange,
} from '../generated/schema';
import {
  MemecoinDaoGovernor as MemecoinDaoGovernorTemplate,
  MemecoinYieldVault as MemecoinYieldVaultTemplate,
  GovernanceCycleIncentivizer as GovernanceCycleIncentivizerTemplate,
  Memecoin as MemecoinTemplate,
} from '../generated/templates';
import { chainId, chainIdInt, scopedId, stageName } from './utils';

function zero(): BigInt {
  return BigInt.fromI32(0);
}

/** Chain-wide totals row (see ProtocolStats in schema.graphql): one row per chain, updated by
 * every handler that changes a counted quantity. Home metrics read this row alone. */
function stats(): ProtocolStats {
  const id = chainId() + '-protocol';
  let row = ProtocolStats.load(id);
  if (row === null) {
    row = new ProtocolStats(id);
    row.chainId = chainIdInt();
    row.verseCount = 0;
    row.deployedVerseCount = 0;
    row.participantCount = 0;
    row.participationTotal = zero();
    row.save();
  }
  return row;
}

function countDeployed(stage: string): boolean {
  return stage == 'locked' || stage == 'unlocked';
}

/** Add participation amounts to the verse's running totals and register the distinct
 * participant (idempotent: the same address counts once no matter how many legs it uses). */
export function accumulateFunds(
  verseId: BigInt,
  genesisAmount: BigInt,
  leveragedAmount: BigInt,
  preorderAmount: BigInt,
  account: Bytes,
): void {
  const verse = Verse.load(chainId() + '-' + verseId.toString());
  if (verse === null) return;
  verse.totalGenesisFunds = verse.totalGenesisFunds.plus(genesisAmount);
  verse.totalLeveragedInterest = verse.totalLeveragedInterest.plus(leveragedAmount);
  verse.totalPreorderFunds = verse.totalPreorderFunds.plus(preorderAmount);
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
  aggregate.participationTotal = aggregate.participationTotal.plus(
    genesisAmount.plus(leveragedAmount).plus(preorderAmount),
  );
  aggregate.save();
  verse.save();
}

export function handleRegisterMemeverse(event: RegisterMemeverse): void {
  const verse = new Verse(chainId() + '-' + event.params.verseId.toString());
  verse.chainId = chainIdInt();
  verse.verseId = event.params.verseId;
  verse.name = event.params.verse.name;
  verse.symbol = event.params.verse.symbol;
  verse.uri = event.params.verse.uri;
  verse.description = event.params.verse.desc;
  verse.uAsset = event.params.verse.uAsset;
  verse.stage = stageName(event.params.verse.currentStage);
  verse.flashGenesis = event.params.verse.flashGenesis;
  verse.memecoin = event.params.verse.memecoin;
  verse.pol = event.params.verse.pol;
  verse.yieldVault = event.params.verse.yieldVault;
  verse.governor = event.params.verse.governor;
  verse.incentivizer = event.params.verse.incentivizer;
  verse.endTime = event.params.verse.endTime;
  verse.unlockTime = event.params.verse.unlockTime;
  verse.omnichainIds = event.params.verse.omnichainIds;
  verse.communities = [];
  verse.registeredAtBlock = event.block.number;
  verse.registeredAtTimestamp = event.block.timestamp;
  verse.registeredTx = event.transaction.hash;
  verse.totalGenesisFunds = zero();
  verse.totalLeveragedInterest = zero();
  verse.totalPreorderFunds = zero();
  verse.participantCount = 0;
  verse.save();

  const aggregate = stats();
  aggregate.verseCount = aggregate.verseCount + 1;
  if (countDeployed(verse.stage)) aggregate.deployedVerseCount = aggregate.deployedVerseCount + 1;
  aggregate.save();

  MemecoinTemplate.create(event.params.verse.memecoin);
  MemecoinYieldVaultTemplate.create(event.params.verse.yieldVault);
  MemecoinDaoGovernorTemplate.create(event.params.verse.governor);
  GovernanceCycleIncentivizerTemplate.create(event.params.verse.incentivizer);
}

export function handleChangeStage(event: ChangeStage): void {
  const verse = Verse.load(chainId() + '-' + event.params.verseId.toString());
  const nextStage = stageName(event.params.currentStage);
  if (verse !== null) {
    const wasDeployed = countDeployed(verse.stage);
    verse.stage = nextStage;
    verse.save();
    if (!wasDeployed && countDeployed(nextStage)) {
      const aggregate = stats();
      aggregate.deployedVerseCount = aggregate.deployedVerseCount + 1;
      aggregate.save();
    }
  }
  const change = new VerseStageChange(
    scopedId(event.params.verseId.toString() + '-stage-' + event.block.number.toString(), event),
  );
  change.chainId = chainIdInt();
  change.verseId = event.params.verseId;
  change.stage = stageName(event.params.currentStage);
  change.blockNumber = event.block.number;
  change.blockTimestamp = event.block.timestamp;
  change.tx = event.transaction.hash;
  change.save();
}

export function handleSetExternalInfo(event: SetExternalInfo): void {
  const verse = Verse.load(chainId() + '-' + event.params.verseId.toString());
  if (verse === null) return;
  verse.uri = event.params.uri;
  verse.description = event.params.description;
  verse.communities = event.params.community;
  verse.save();
}

export function handleGenesis(event: Genesis): void {
  const e = new GenesisParticipation(scopedId(event.params.verseId.toString() + '-genesis', event));
  e.chainId = chainIdInt();
  e.verseId = event.params.verseId;
  e.payer = event.params.payer;
  e.depositer = event.params.depositer;
  e.amount = event.params.amount;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
  accumulateFunds(event.params.verseId, event.params.amount, zero(), zero(), event.params.depositer);
}

export function handlePreorder(event: Preorder): void {
  const e = new PreorderParticipation(scopedId(event.params.verseId.toString() + '-preorder', event));
  e.chainId = chainIdInt();
  e.verseId = event.params.verseId;
  e.caller = event.params.caller;
  e.user = event.params.user;
  e.amountInUAsset = event.params.amountInUAsset;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
  accumulateFunds(event.params.verseId, zero(), zero(), event.params.amountInUAsset, event.params.user);
}

export function handleRefund(event: Refund): void {
  const e = new ParticipationRefund(scopedId(event.params.verseId.toString() + '-refund', event));
  e.chainId = chainIdInt();
  e.verseId = event.params.verseId;
  e.kind = 'genesis';
  e.receiver = event.params.receiver;
  e.amount = event.params.refundAmount;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
}

export function handleRefundPreorder(event: RefundPreorder): void {
  const e = new ParticipationRefund(scopedId(event.params.verseId.toString() + '-refund-preorder', event));
  e.chainId = chainIdInt();
  e.verseId = event.params.verseId;
  e.kind = 'preorder';
  e.receiver = event.params.receiver;
  e.amount = event.params.refundAmount;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
}

export function handleClaimNormalFees(event: ClaimNormalFees): void {
  const e = new ParticipationClaim(scopedId(event.params.verseId.toString() + '-claim-fees', event));
  e.chainId = chainIdInt();
  e.verseId = event.params.verseId;
  e.kind = 'normal-fees';
  e.receiver = event.params.receiver;
  e.uAssetAmount = event.params.uAssetAmount;
  e.ptAmount = event.params.ptAmount;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
}

export function handleClaimNormalYT(event: ClaimNormalYT): void {
  const e = new ParticipationClaim(scopedId(event.params.verseId.toString() + '-claim-yt', event));
  e.chainId = chainIdInt();
  e.verseId = event.params.verseId;
  e.kind = 'normal-yt';
  e.receiver = event.params.receiver;
  e.ytAmount = event.params.claimedAmount;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
}

export function handleClaimPreorderMemecoin(event: ClaimPreorderMemecoin): void {
  const e = new ParticipationClaim(scopedId(event.params.verseId.toString() + '-claim-preorder', event));
  e.chainId = chainIdInt();
  e.verseId = event.params.verseId;
  e.kind = 'preorder-memecoin';
  e.receiver = event.params.user;
  e.memecoinAmount = event.params.amount;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
}

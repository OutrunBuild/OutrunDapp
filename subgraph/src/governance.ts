// DAO governance (per-verse Governor template) and cycle rewards / treasury activity
// (GovernanceCycleIncentivizer template).
import {
  ProposalCanceled,
  ProposalCreated,
  ProposalExecuted,
  ProposalQueued,
  VoteCast,
} from '../generated/templates/MemecoinDaoGovernor/MemecoinDaoGovernor';
import {
  CycleFinalized,
  CycleStarted,
  RewardClaimed,
  TreasuryAssetSpendRecorded,
  TreasuryIncomeRecorded,
} from '../generated/templates/GovernanceCycleIncentivizer/GovernanceCycleIncentivizer';
import {
  GovernanceCycle,
  GovernanceProposal,
  GovernanceRewardClaim,
  GovernanceVote,
  TreasuryActivity,
} from '../generated/schema';
import { BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { chainId, chainIdInt, scopedId } from './utils';

function proposalId(governor: Bytes, proposalId: BigInt): string {
  return chainId() + '-' + governor.toHexString() + '-' + proposalId.toString();
}

function setProposalStatus(governor: Bytes, id: BigInt, status: string, etaSeconds: BigInt | null): void {
  const p = GovernanceProposal.load(proposalId(governor, id));
  if (p === null) return;
  p.status = status;
  p.etaSeconds = etaSeconds;
  p.save();
}

export function handleProposalCreated(event: ProposalCreated): void {
  const p = new GovernanceProposal(proposalId(event.address, event.params.proposalId));
  p.chainId = chainIdInt();
  p.governor = event.address;
  p.proposalId = event.params.proposalId;
  p.proposer = event.params.proposer;
  p.targets = changetype<Array<Bytes>>(event.params.targets);
  p.values = event.params.values;
  p.description = event.params.description;
  p.voteStart = event.params.voteStart;
  p.voteEnd = event.params.voteEnd;
  p.status = 'created';
  p.etaSeconds = null;
  p.blockTimestamp = event.block.timestamp;
  p.tx = event.transaction.hash;
  p.save();
}

export function handleProposalCanceled(event: ProposalCanceled): void {
  setProposalStatus(event.address, event.params.proposalId, 'canceled', null);
}

export function handleProposalQueued(event: ProposalQueued): void {
  setProposalStatus(event.address, event.params.proposalId, 'queued', event.params.etaSeconds);
}

export function handleProposalExecuted(event: ProposalExecuted): void {
  setProposalStatus(event.address, event.params.proposalId, 'executed', null);
}

export function handleVoteCast(event: VoteCast): void {
  const v = new GovernanceVote(
    proposalId(event.address, event.params.proposalId) + '-' + event.params.voter.toHexString(),
  );
  v.chainId = chainIdInt();
  v.governor = event.address;
  v.proposalId = event.params.proposalId;
  v.voter = event.params.voter;
  v.support = event.params.support;
  v.weight = event.params.weight;
  v.reason = event.params.reason;
  v.blockTimestamp = event.block.timestamp;
  v.tx = event.transaction.hash;
  v.save();
}

function cycleId(incentivizer: Bytes, cycleId: BigInt): string {
  return chainId() + '-' + incentivizer.toHexString() + '-' + cycleId.toString();
}

export function handleCycleStarted(event: CycleStarted): void {
  const c = new GovernanceCycle(cycleId(event.address, event.params.cycleId));
  c.chainId = chainIdInt();
  c.incentivizer = event.address;
  c.cycleId = event.params.cycleId;
  c.startTime = event.params.startTime;
  c.endTime = event.params.endTime;
  c.status = 'started';
  c.treasuryTokens = changetype<Array<Bytes>>(event.params.tokens);
  c.treasuryBalances = event.params.balances;
  c.rewardTokens = [];
  c.rewards = [];
  c.blockTimestamp = event.block.timestamp;
  c.tx = event.transaction.hash;
  c.save();
}

export function handleCycleFinalized(event: CycleFinalized): void {
  const c = new GovernanceCycle(cycleId(event.address, event.params.cycleId));
  c.chainId = chainIdInt();
  c.incentivizer = event.address;
  c.cycleId = event.params.cycleId;
  c.startTime = BigInt.fromI32(0);
  c.endTime = event.params.endTime;
  c.status = 'finalized';
  c.treasuryTokens = changetype<Array<Bytes>>(event.params.treasuryTokens);
  c.treasuryBalances = event.params.balances;
  c.rewardTokens = changetype<Array<Bytes>>(event.params.rewardTokens);
  c.rewards = event.params.rewards;
  c.blockTimestamp = event.block.timestamp;
  c.tx = event.transaction.hash;
  c.save();
}

export function handleRewardClaimed(event: RewardClaimed): void {
  const e = new GovernanceRewardClaim(
    cycleId(event.address, event.params.cycleId) +
      '-' +
      event.params.user.toHexString() +
      '-' +
      event.params.token.toHexString(),
  );
  e.chainId = chainIdInt();
  e.incentivizer = event.address;
  e.cycleId = event.params.cycleId;
  e.user = event.params.user;
  e.token = event.params.token;
  e.amount = event.params.amount;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
}

function writeTreasury(kind: string, cycleId: BigInt, token: Bytes, counterparty: Bytes | null, amount: BigInt, event: ethereum.Event): void {
  const e = new TreasuryActivity(
    scopedId('treasury-' + kind + '-' + cycleId.toString() + '-' + token.toHexString(), event),
  );
  e.chainId = chainIdInt();
  e.incentivizer = event.address;
  e.cycleId = cycleId;
  e.kind = kind;
  e.token = token;
  e.counterparty = counterparty;
  e.amount = amount;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
}

export function handleTreasuryIncome(event: TreasuryIncomeRecorded): void {
  writeTreasury('income', event.params.cycleId, event.params.token, event.params.sender, event.params.amount, event);
}

export function handleTreasurySpend(event: TreasuryAssetSpendRecorded): void {
  writeTreasury('spend', event.params.cycleId, event.params.token, event.params.receiver, event.params.amount, event);
}

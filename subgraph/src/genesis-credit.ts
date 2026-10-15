// GenesisCredit merkle claims (hub-chain-only deployments): separate file so remote-chain
// manifests without these data sources never compile these imports.
import { BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { Claimed as CreditClaimedUeth } from '../generated/GenesisCreditUeth/GenesisCreditUeth';
import { Claimed as CreditClaimedUusd } from '../generated/GenesisCreditUusd/GenesisCreditUusd';
import { Claimed as CreditClaimedUbnb } from '../generated/GenesisCreditUbnb/GenesisCreditUbnb';
import { GenesisCreditClaim } from '../generated/schema';
import { chainIdInt, scopedId } from './utils';

function writeCreditClaim(user: Bytes, amount: BigInt, event: ethereum.Event): void {
  const e = new GenesisCreditClaim(scopedId('credit-claim', event));
  e.chainId = chainIdInt();
  e.credit = event.address;
  e.user = user;
  e.amount = amount;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
}

export function handleGenesisCreditClaimedUeth(event: CreditClaimedUeth): void {
  writeCreditClaim(event.params.user, event.params.amount, event);
}
export function handleGenesisCreditClaimedUusd(event: CreditClaimedUusd): void {
  writeCreditClaim(event.params.user, event.params.amount, event);
}
export function handleGenesisCreditClaimedUbnb(event: CreditClaimedUbnb): void {
  writeCreditClaim(event.params.user, event.params.amount, event);
}

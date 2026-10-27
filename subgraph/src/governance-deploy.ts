// Settlement-deployed governance contracts. The launcher's RegisterMemeverse event fires at
// REGISTRATION, when vault/governor/incentivizer are still zeros (they deploy at settlement,
// governance chain only); ChangeStage carries no addresses — so the Verse row kept registration
// zeros forever. The proxy deployer emits the real addresses when it actually deploys, which is
// where this mapping rewrites the row and attaches the vault/governor/incentivizer templates to
// the real contracts (they previously attached to the registration-time zero addresses and
// indexed nothing).
import { DeployGovernorAndIncentivizer, DeployYieldVault } from '../generated/ProxyDeployer/ProxyDeployer';
import { Verse } from '../generated/schema';
import {
  GovernanceCycleIncentivizer as GovernanceCycleIncentivizerTemplate,
  MemecoinDaoGovernor as MemecoinDaoGovernorTemplate,
  MemecoinYieldVault as MemecoinYieldVaultTemplate,
} from '../generated/templates';
import { chainId } from './utils';

export function handleDeployYieldVault(event: DeployYieldVault): void {
  const verse = Verse.load(chainId() + '-' + event.params.uniqueId.toString());
  if (verse === null) return;
  verse.yieldVault = event.params.yieldVault;
  verse.save();
  MemecoinYieldVaultTemplate.create(event.params.yieldVault);
}

export function handleDeployGovernorAndIncentivizer(event: DeployGovernorAndIncentivizer): void {
  const verse = Verse.load(chainId() + '-' + event.params.uniqueId.toString());
  if (verse === null) return;
  verse.governor = event.params.governor;
  verse.incentivizer = event.params.incentivizer;
  verse.save();
  MemecoinDaoGovernorTemplate.create(event.params.governor);
  GovernanceCycleIncentivizerTemplate.create(event.params.incentivizer);
}

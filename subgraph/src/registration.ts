// Registration-hub-only source (MemeverseRegistrationCenter on BSC Testnet): kept in its own
// mapping file because remote-chain manifests do not include the data source, so importing its
// generated types from a shared file would break those builds.
import { Registration } from '../generated/RegistrationCenter/RegistrationCenter';
import { SymbolRegistration } from '../generated/schema';
import { chainId, chainIdInt } from './utils';

export function handleRegistration(event: Registration): void {
  const e = new SymbolRegistration(chainId() + '-' + event.params.uniqueId.toString());
  e.chainId = chainIdInt();
  e.uniqueId = event.params.uniqueId;
  e.name = event.params.param.name;
  e.symbol = event.params.param.symbol;
  e.uri = event.params.param.uri;
  e.description = event.params.param.desc;
  e.communities = event.params.param.communities;
  e.durationDays = event.params.param.durationDays;
  e.uAsset = event.params.param.uAsset;
  e.omnichainIds = event.params.param.omnichainIds;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
}

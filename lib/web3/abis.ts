// Frozen ABI registry (contracts/abi/v1-rc/, governed by manifest.json + check-abi-manifest in CI).
// Only the read-side ABIs the RPC data layer calls are imported; write-path ABIs (Router/Kernel/
// Permit2) land with the stage-6 transaction pipeline. The generic ERC20 read ABI is the frozen
// MockUSDC ABI (balanceOf/allowance/decimals/symbol/totalSupply are chain-standard).
import type { Abi } from 'viem';
import mockUsdcJson from '../../contracts/abi/v1-rc/MockUSDC.json';
import faucetJson from '../../contracts/abi/v1-rc/Faucet.json';
import genesisCreditJson from '../../contracts/abi/v1-rc/GenesisCredit.json';
import launcherJson from '../../contracts/abi/v1-rc/MemeverseLauncherUpgradeable.json';
import registrationCenterJson from '../../contracts/abi/v1-rc/MemeverseRegistrationCenterUpgradeable.json';
import hookJson from '../../contracts/abi/v1-rc/MemeverseUniswapHookUpgradeable.json';
import hookLensJson from '../../contracts/abi/v1-rc/MemeverseUniswapHookLens.json';
import psmJson from '../../contracts/abi/v1-rc/OutrunPSMUpgradeable.json';
import usrVaultJson from '../../contracts/abi/v1-rc/OutrunUSRVaultUpgradeable.json';
import stakingPositionJson from '../../contracts/abi/v1-rc/OutrunStakingPositionUpgradeable.json';

const asAbi = (json: unknown) => json as Abi;

export const erc20ReadAbi = asAbi(mockUsdcJson);
export const faucetAbi = asAbi(faucetJson);
export const genesisCreditAbi = asAbi(genesisCreditJson);
export const launcherAbi = asAbi(launcherJson);
export const registrationCenterAbi = asAbi(registrationCenterJson);
export const hookAbi = asAbi(hookJson);
export const hookLensAbi = asAbi(hookLensJson);
export const psmAbi = asAbi(psmJson);
export const usrVaultAbi = asAbi(usrVaultJson);
export const stakingPositionAbi = asAbi(stakingPositionJson);

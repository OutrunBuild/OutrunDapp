// Frozen ABI registry (contracts/abi/v1-rc/, governed by manifest.json + check-abi-manifest in CI).
// Only the ABIs the RPC data layer and the stage-6 transaction pipeline call are imported.
// The generic ERC20 read ABI is the frozen MockUSDC ABI (balanceOf/allowance/decimals/symbol/
// totalSupply are chain-standard); ERC20 approve calldata for session batches reuses it.
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
import kernelJson from '../../contracts/abi/v1-rc/Kernel.json';
import swapRouterJson from '../../contracts/abi/v1-rc/MemeverseSwapRouter.json';
import ytFlashRouterJson from '../../contracts/abi/v1-rc/MemeverseYTFlashSwapRouter.json';
import outrunRouterJson from '../../contracts/abi/v1-rc/OutrunRouter.json';
import permit2Json from '../../contracts/abi/v1-rc/Permit2.json';
import polendJson from '../../contracts/abi/v1-rc/POLendUpgradeable.json';
import governorJson from '../../contracts/abi/v1-rc/MemecoinDaoGovernorUpgradeable.json';
import registrarOmnichainJson from '../../contracts/abi/v1-rc/MemeverseRegistrarOmnichain.json';
import splitterJson from '../../contracts/abi/v1-rc/POLSplitterUpgradeable.json';
import universalAssetsJson from '../../contracts/abi/v1-rc/OutrunUniversalAssetsUpgradeable.json';
import yieldVaultJson from '../../contracts/abi/v1-rc/MemecoinYieldVault.json';
import mockOutrunSusdsSyJson from '../../contracts/abi/v1-rc/MockOutrunSUSDSSYUpgradeable.json';

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
// Stage-6 write path (Kernel session batches + Router entries + Permit2).
export const kernelAbi = asAbi(kernelJson);
export const swapRouterAbi = asAbi(swapRouterJson);
export const ytFlashRouterAbi = asAbi(ytFlashRouterJson);
export const outrunRouterAbi = asAbi(outrunRouterJson);
export const permit2Abi = asAbi(permit2Json);
export const polendAbi = asAbi(polendJson);
export const governorAbi = asAbi(governorJson);
export const registrarOmnichainAbi = asAbi(registrarOmnichainJson);
export const splitterAbi = asAbi(splitterJson);
// UAsset OFT surface (send/quoteSend) lives on the UniversalAssets ABI.
export const uAssetOftAbi = asAbi(universalAssetsJson);
export const yieldVaultAbi = asAbi(yieldVaultJson);
// Generic SY-adapter read ABI: getTokensIn/previewDeposit share one signature across every frozen
// SY variant (mock + live), so one representative ABI decodes them all — same pattern as
// erc20ReadAbi borrowing the MockUSDC ABI.
export const syReadAbi = asAbi(mockOutrunSusdsSyJson);

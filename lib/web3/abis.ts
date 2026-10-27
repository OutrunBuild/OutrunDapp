// Frozen ABI registry (contracts/abi/v1-rc2/, governed by manifest.json + check-abi-manifest in CI).
// Only the ABIs the RPC data layer and the stage-6 transaction pipeline call are imported.
// The generic ERC20 read ABI is the frozen MockUSDC ABI (balanceOf/allowance/decimals/symbol/
// totalSupply are chain-standard); ERC20 approve calldata for session batches reuses it.
import type { Abi } from 'viem';
import mockUsdcJson from '../../contracts/abi/v1-rc2/MockUSDC.json';
import faucetJson from '../../contracts/abi/v1-rc2/Faucet.json';
import genesisCreditJson from '../../contracts/abi/v1-rc2/GenesisCredit.json';
import launcherJson from '../../contracts/abi/v1-rc2/MemeverseLauncherUpgradeable.json';
import registrationCenterJson from '../../contracts/abi/v1-rc2/MemeverseRegistrationCenterUpgradeable.json';
import hookJson from '../../contracts/abi/v1-rc2/MemeverseUniswapHookUpgradeable.json';
import hookLensJson from '../../contracts/abi/v1-rc2/MemeverseUniswapHookLens.json';
import psmJson from '../../contracts/abi/v1-rc2/OutrunPSMUpgradeable.json';
import usrVaultJson from '../../contracts/abi/v1-rc2/OutrunUSRVaultUpgradeable.json';
import stakingPositionJson from '../../contracts/abi/v1-rc2/OutrunStakingPositionUpgradeable.json';
import kernelJson from '../../contracts/abi/v1-rc2/Kernel.json';
import swapRouterJson from '../../contracts/abi/v1-rc2/MemeverseSwapRouter.json';
import ytFlashRouterJson from '../../contracts/abi/v1-rc2/MemeverseYTFlashSwapRouter.json';
import outrunRouterJson from '../../contracts/abi/v1-rc2/OutrunRouter.json';
import permit2Json from '../../contracts/abi/v1-rc2/Permit2.json';
import polendJson from '../../contracts/abi/v1-rc2/POLendUpgradeable.json';
import governorJson from '../../contracts/abi/v1-rc2/MemecoinDaoGovernorUpgradeable.json';
import incentivizerJson from '../../contracts/abi/v1-rc2/GovernanceCycleIncentivizerUpgradeable.json';
import registrarOmnichainJson from '../../contracts/abi/v1-rc2/MemeverseRegistrarOmnichain.json';
import splitterJson from '../../contracts/abi/v1-rc2/POLSplitterUpgradeable.json';
import universalAssetsJson from '../../contracts/abi/v1-rc2/OutrunUniversalAssetsUpgradeable.json';
import yieldVaultJson from '../../contracts/abi/v1-rc2/MemecoinYieldVault.json';
import mockOutrunSusdsSyJson from '../../contracts/abi/v1-rc2/MockOutrunSUSDSSYUpgradeable.json';

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
export const incentivizerAbi = asAbi(incentivizerJson);
export const registrarOmnichainAbi = asAbi(registrarOmnichainJson);
export const splitterAbi = asAbi(splitterJson);
// UAsset OFT surface (send/quoteSend) lives on the UniversalAssets ABI.
export const uAssetOftAbi = asAbi(universalAssetsJson);
export const yieldVaultAbi = asAbi(yieldVaultJson);
// Generic SY-adapter read ABI: getTokensIn/previewDeposit share one signature across every frozen
// SY variant (mock + live), so one representative ABI decodes them all — same pattern as
// erc20ReadAbi borrowing the MockUSDC ABI.
export const syReadAbi = asAbi(mockOutrunSusdsSyJson);

// Session write-action builders (architecture.md §6.3 + frozen contract specs per
// source-map.md M1–M4/S1/S4/S8/S11). Pure encodeFunctionData over the frozen v1-rc ABIs:
// each builder returns one Router (or Hook/Faucet/PSM/USR/Governor) call; the caller wraps
// it as the Router leg of buildSessionBatch (approvals? → action, with the hook's
// begin/end session guards only on swapSession paths).
// Amounts are bigint base units; the dialogs convert display strings before calling in.
import { encodeFunctionData, maxUint256, type Hex } from 'viem';

import {
  erc20ReadAbi,
  faucetAbi,
  governorAbi,
  hookAbi,
  launcherAbi,
  outrunRouterAbi,
  polendAbi,
  psmAbi,
  registrationCenterAbi,
  registrarOmnichainAbi,
  splitterAbi,
  stakingPositionAbi,
  swapRouterAbi,
  uAssetOftAbi,
  yieldVaultAbi,
  ytFlashRouterAbi,
  usrVaultAbi,
} from './abis';
import { buildSessionBatch, encodeKernelExecute, type BatchExecution } from './kernel';

export type { BatchExecution };

/** ERC20 approve leg (exact default; unlimited only when the caller passes maxUint256). */
export function approvalCall(token: Hex, spender: Hex, amount: bigint): BatchExecution {
  return {
    target: token,
    value: 0n,
    callData: encodeFunctionData({
      abi: erc20ReadAbi,
      functionName: 'approve',
      args: [spender, amount],
    }),
  };
}

/** Unlimited-approval sentinel (explicit user opt-in only, §14). */
export const UNLIMITED_APPROVAL = maxUint256;

export function beginSessionCall(hook: Hex): BatchExecution {
  return {
    target: hook,
    value: 0n,
    callData: encodeFunctionData({ abi: hookAbi, functionName: 'beginAccountSession' }),
  };
}

export function endSessionCall(hook: Hex): BatchExecution {
  return {
    target: hook,
    value: 0n,
    callData: encodeFunctionData({ abi: hookAbi, functionName: 'endAccountSession' }),
  };
}

export type PoolKey = {
  currency0: Hex;
  currency1: Hex;
  fee: number;
  tickSpacing: number;
  hooks: Hex;
};

export type SwapParams = {
  zeroForOne: boolean;
  amountSpecified: bigint;
  sqrtPriceLimitX96: bigint;
};

// Uniswap v4 TickMath bounds (canonical constants).
export const MIN_SQRT_PRICE_X96 = 4295128739n;
export const MAX_SQRT_PRICE_X96 = 1461446703485210103287273052203988822378723970342n;

export function limitForDirection(zeroForOne: boolean): bigint {
  return zeroForOne ? MIN_SQRT_PRICE_X96 + 1n : MAX_SQRT_PRICE_X96 - 1n;
}

export type ExactInputSwap = {
  key: PoolKey;
  zeroForOne: boolean;
  amountIn: bigint;
  amountOutMinimum: bigint;
  recipient: Hex;
  deadline: bigint;
  hookData?: Hex;
};

/** Exact-input swap leg: amountInMaximum is 0, protection rides amountOutMinimum (§M2 §3.1). */
export function swapExactInputCall(router: Hex, swap: ExactInputSwap): BatchExecution {
  return {
    target: router,
    value: 0n,
    callData: encodeFunctionData({
      abi: swapRouterAbi,
      functionName: 'swap',
      args: [
        {
          currency0: swap.key.currency0,
          currency1: swap.key.currency1,
          fee: swap.key.fee,
          tickSpacing: swap.key.tickSpacing,
          hooks: swap.key.hooks,
        },
        {
          zeroForOne: swap.zeroForOne,
          amountSpecified: -swap.amountIn,
          sqrtPriceLimitX96: limitForDirection(swap.zeroForOne),
        },
        swap.recipient,
        swap.deadline,
        swap.amountOutMinimum,
        0n,
        swap.hookData ?? '0x',
      ],
    }),
  };
}

export function addLiquidityCall(
  router: Hex,
  input: {
    currency0: Hex;
    currency1: Hex;
    amount0Desired: bigint;
    amount1Desired: bigint;
    amount0Min: bigint;
    amount1Min: bigint;
    to: Hex;
    deadline: bigint;
  },
): BatchExecution {
  return {
    target: router,
    value: 0n,
    callData: encodeFunctionData({
      abi: swapRouterAbi,
      functionName: 'addLiquidity',
      args: [
        input.currency0,
        input.currency1,
        input.amount0Desired,
        input.amount1Desired,
        input.amount0Min,
        input.amount1Min,
        input.to,
        input.deadline,
      ],
    }),
  };
}

export function removeLiquidityCall(
  router: Hex,
  input: {
    currency0: Hex;
    currency1: Hex;
    liquidity: bigint;
    amount0Min: bigint;
    amount1Min: bigint;
    to: Hex;
    deadline: bigint;
  },
): BatchExecution {
  return {
    target: router,
    value: 0n,
    callData: encodeFunctionData({
      abi: swapRouterAbi,
      functionName: 'removeLiquidity',
      args: [
        input.currency0,
        input.currency1,
        input.liquidity,
        input.amount0Min,
        input.amount1Min,
        input.to,
        input.deadline,
      ],
    }),
  };
}

export function genesisCall(
  launcher: Hex,
  input: { verseId: bigint; amountInUAsset: bigint; user: Hex },
): BatchExecution {
  return {
    target: launcher,
    value: 0n,
    callData: encodeFunctionData({
      abi: launcherAbi,
      functionName: 'genesis',
      args: [input.verseId, input.amountInUAsset, input.user],
    }),
  };
}

// IOutrunRouter.FundSource — combined-entrypoint funding sources (router ABI).
export const FUND_SOURCE = {
  UAsset: 0,
  Psm: 1,
  Stake: 2,
  Credit: 3,
} as const;

export type FundSourceId = (typeof FUND_SOURCE)[keyof typeof FUND_SOURCE];

/** FundInput: zero-address token/sp placeholders; the min floors are Stake-source-only
 * (ABI tuple encodes field by field). Non-zero unused fields revert FundFieldMustBeZero. */
export type FundInput = {
  source: FundSourceId;
  token: Hex;
  amount: bigint;
  sp: Hex;
  minSyOut: bigint;
  minUAssetMinted: bigint;
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Hex;

export function fundUAssetInput(amount: bigint): FundInput {
  return {
    source: FUND_SOURCE.UAsset,
    token: ZERO_ADDRESS,
    amount,
    sp: ZERO_ADDRESS,
    minSyOut: 0n,
    minUAssetMinted: 0n,
  };
}

export function fundCreditInput(amount: bigint): FundInput {
  return {
    source: FUND_SOURCE.Credit,
    token: ZERO_ADDRESS,
    amount,
    sp: ZERO_ADDRESS,
    minSyOut: 0n,
    minUAssetMinted: 0n,
  };
}

/** Psm leg (IOutrunRouter FundInput): token = the PSM reserve token the router mints uAsset
 * through; sp and both floors stay zero (FundFieldMustBeZero). */
export function fundPsmInput(reserveToken: Hex, amount: bigint): FundInput {
  return {
    source: FUND_SOURCE.Psm,
    token: reserveToken,
    amount,
    sp: ZERO_ADDRESS,
    minSyOut: 0n,
    minUAssetMinted: 0n,
  };
}

/** Stake leg: token converts through the SP's SY (genesisByToken parity). minSyOut 0 disables the
 * deposit floor and minUAssetMinted 0 the mint floor — v1 has no slippage slot and the mint is
 * value-parity, so both stay disabled. */
export function fundStakeInput(sp: Hex, tokenIn: Hex, amount: bigint, minSyOut = 0n): FundInput {
  return {
    source: FUND_SOURCE.Stake,
    token: tokenIn,
    amount,
    sp,
    minSyOut,
    minUAssetMinted: 0n,
  };
}

/** Combined genesis+preorder entry (IOutrunRouter genesisAndPreorder): both legs pull the
 * raise uAsset from the session account, so the approval spender is the router. */
export function genesisAndPreorderCall(
  router: Hex,
  input: { verseId: bigint; genesis: FundInput; preorder: FundInput; user: Hex },
): BatchExecution {
  return {
    target: router,
    value: 0n,
    callData: encodeFunctionData({
      abi: outrunRouterAbi,
      functionName: 'genesisAndPreorder',
      args: [input.verseId, input.genesis, input.preorder, input.user],
    }),
  };
}

/** Leveraged combined entry (IOutrunRouter leveragedGenesisAndPreorder): the interest leg
 * funds per route (credit escrow or uAsset-direct) and the preorder leg stays uAsset. */
export function leveragedGenesisAndPreorderCall(
  router: Hex,
  input: { verseId: bigint; genesis: FundInput; preorder: FundInput; user: Hex },
): BatchExecution {
  return {
    target: router,
    value: 0n,
    callData: encodeFunctionData({
      abi: outrunRouterAbi,
      functionName: 'leveragedGenesisAndPreorder',
      args: [input.verseId, input.genesis, input.preorder, input.user],
    }),
  };
}

export function preorderCall(
  launcher: Hex,
  input: { verseId: bigint; amountInUAsset: bigint; user: Hex },
): BatchExecution {
  return {
    target: launcher,
    value: 0n,
    callData: encodeFunctionData({
      abi: launcherAbi,
      functionName: 'preorder',
      args: [input.verseId, input.amountInUAsset, input.user],
    }),
  };
}

export function refundCall(launcher: Hex, verseId: bigint): BatchExecution {
  return {
    target: launcher,
    value: 0n,
    callData: encodeFunctionData({ abi: launcherAbi, functionName: 'refund', args: [verseId] }),
  };
}

/** Permissionless stage advance (anyone calls; the facade routes Genesis→Locked/Refund and
 *  Locked→Unlocked adaptively) — the End Genesis CTA's single leg. */
export function changeStageCall(launcher: Hex, verseId: bigint): BatchExecution {
  return {
    target: launcher,
    value: 0n,
    callData: encodeFunctionData({
      abi: launcherAbi,
      functionName: 'changeStage',
      args: [verseId],
    }),
  };
}

export function refundPreorderCall(launcher: Hex, verseId: bigint): BatchExecution {
  return {
    target: launcher,
    value: 0n,
    callData: encodeFunctionData({
      abi: launcherAbi,
      functionName: 'refundPreorder',
      args: [verseId],
    }),
  };
}

export function claimPreorderCall(launcher: Hex, verseId: bigint): BatchExecution {
  return {
    target: launcher,
    value: 0n,
    callData: encodeFunctionData({
      abi: launcherAbi,
      functionName: 'claimUnlockedPreorderMemecoin',
      args: [verseId],
    }),
  };
}

export function mintPolCall(
  launcher: Hex,
  input: {
    verseId: bigint;
    amountInUAssetDesired: bigint;
    amountInMemecoinDesired: bigint;
    amountInUAssetMin: bigint;
    amountInMemecoinMin: bigint;
    amountOutDesired: bigint;
    deadline: bigint;
  },
): BatchExecution {
  return {
    target: launcher,
    value: 0n,
    callData: encodeFunctionData({
      abi: launcherAbi,
      functionName: 'mintPOLToken',
      args: [
        input.verseId,
        input.amountInUAssetDesired,
        input.amountInMemecoinDesired,
        input.amountInUAssetMin,
        input.amountInMemecoinMin,
        input.amountOutDesired,
        input.deadline,
      ],
    }),
  };
}

export function redeemMemecoinLiquidityCall(
  launcher: Hex,
  input: { verseId: bigint; amountInPOL: bigint },
): BatchExecution {
  return {
    target: launcher,
    value: 0n,
    callData: encodeFunctionData({
      abi: launcherAbi,
      functionName: 'redeemMemecoinLiquidity',
      args: [input.verseId, input.amountInPOL],
    }),
  };
}

/** Unwrap overload: splits into memecoin+uAsset with slippage protection (6 params). */
export function redeemMemecoinLiquidityUnwrapCall(
  launcher: Hex,
  input: {
    verseId: bigint;
    amountInPOL: bigint;
    amount0Min: bigint;
    amount1Min: bigint;
    deadline: bigint;
  },
): BatchExecution {
  // Overload disambiguation by arity (viem 2.55 takes plain names only).
  const overload = (launcherAbi as readonly unknown[]).filter(
    (entry) =>
      typeof entry === 'object' &&
      entry !== null &&
      (entry as { type?: unknown }).type === 'function' &&
      (entry as { name?: unknown }).name === 'redeemMemecoinLiquidity' &&
      ((entry as { inputs?: unknown }).inputs as readonly unknown[]).length === 6,
  );
  return {
    target: launcher,
    value: 0n,
    callData: encodeFunctionData({
      abi: overload as typeof launcherAbi,
      functionName: 'redeemMemecoinLiquidity',
      args: [
        input.verseId,
        input.amountInPOL,
        true,
        input.amount0Min,
        input.amount1Min,
        input.deadline,
      ],
    }),
  };
}

export function registerMemeverseCall(
  launcher: Hex,
  input: {
    name: string;
    symbol: string;
    uniqueId: bigint;
    endTime: bigint;
    unlockTime: bigint;
    omnichainIds: number[];
    uAsset: Hex;
    flashGenesis: boolean;
  },
): BatchExecution {
  return {
    target: launcher,
    value: 0n,
    callData: encodeFunctionData({
      abi: launcherAbi,
      functionName: 'registerMemeverse',
      args: [
        input.name,
        input.symbol,
        input.uniqueId,
        input.endTime,
        input.unlockTime,
        input.omnichainIds,
        input.uAsset,
        input.flashGenesis,
      ],
    }),
  };
}

export function registerAtCenterCall(
  center: Hex,
  param: {
    name: string;
    symbol: string;
    uri: string;
    desc: string;
    communities: string[];
    durationDays: bigint;
    omnichainIds: number[];
    uAsset: Hex;
    flashGenesis: boolean;
  },
  value?: bigint,
): BatchExecution {
  return {
    target: center,
    value: value ?? 0n,
    callData: encodeFunctionData({
      abi: registrationCenterAbi,
      functionName: 'registration',
      args: [
        {
          name: param.name,
          symbol: param.symbol,
          uri: param.uri,
          desc: param.desc,
          communities: param.communities,
          durationDays: param.durationDays,
          omnichainIds: param.omnichainIds,
          uAsset: param.uAsset,
          flashGenesis: param.flashGenesis,
        },
      ],
    }),
  };
}

/** Spoke-side entry (421614/84532): forwards the same param to the hub center. */
export function registerAtSpokeCall(
  registrar: Hex,
  param: {
    name: string;
    symbol: string;
    uri: string;
    desc: string;
    communities: string[];
    durationDays: bigint;
    omnichainIds: number[];
    uAsset: Hex;
    flashGenesis: boolean;
  },
  value: bigint,
): BatchExecution {
  return {
    target: registrar,
    value,
    callData: encodeFunctionData({
      abi: registrarOmnichainAbi,
      functionName: 'registerAtCenter',
      args: [
        {
          name: param.name,
          symbol: param.symbol,
          uri: param.uri,
          desc: param.desc,
          communities: param.communities,
          durationDays: param.durationDays,
          omnichainIds: param.omnichainIds,
          uAsset: param.uAsset,
          flashGenesis: param.flashGenesis,
        },
        value,
      ],
    }),
  };
}

export function leveragedGenesisCall(
  polend: Hex,
  input: { verseId: bigint; interestAmount: bigint; user: Hex },
): BatchExecution {
  return {
    target: polend,
    value: 0n,
    callData: encodeFunctionData({
      abi: polendAbi,
      functionName: 'leveragedGenesis',
      args: [input.verseId, input.interestAmount, input.user],
    }),
  };
}

/** Leverage-credit entry (IPOLend): escrows GenesisCredit — the pull token is the family
 * credit, NOT the market uAsset that plain leveragedGenesis pulls. */
export function leveragedGenesisWithCreditCall(
  polend: Hex,
  input: { verseId: bigint; creditAmount: bigint; user: Hex },
): BatchExecution {
  return {
    target: polend,
    value: 0n,
    callData: encodeFunctionData({
      abi: polendAbi,
      functionName: 'leveragedGenesisWithCredit',
      args: [input.verseId, input.creditAmount, input.user],
    }),
  };
}

export function genesisByTokenCall(
  router: Hex,
  input: {
    sp: Hex;
    tokenIn: Hex;
    tokenAmount: bigint;
    minSyOut: bigint;
    verseId: bigint;
    genesisUser: Hex;
    minUAssetMinted: bigint;
  },
  value?: bigint,
): BatchExecution {
  return {
    target: router,
    value: value ?? 0n,
    callData: encodeFunctionData({
      abi: outrunRouterAbi,
      functionName: 'genesisByToken',
      args: [
        input.sp,
        input.tokenIn,
        input.tokenAmount,
        input.minSyOut,
        input.verseId,
        input.genesisUser,
        input.minUAssetMinted,
      ],
    }),
  };
}

export function genesisByPsmCall(
  router: Hex,
  input: { uAsset: Hex; reserveToken: Hex; amountIn: bigint; verseId: bigint; genesisUser: Hex },
  value?: bigint,
): BatchExecution {
  return {
    target: router,
    value: value ?? 0n,
    callData: encodeFunctionData({
      abi: outrunRouterAbi,
      functionName: 'genesisByPSM',
      args: [input.uAsset, input.reserveToken, input.amountIn, input.verseId, input.genesisUser],
    }),
  };
}

/** Single-leg leveraged PSM interest entry (IOutrunRouter.leveragedGenesisByPSM): the router
 * mints uAsset through the registered PSM pair and books the borrowed debt — the pull token is
 * the reserve, not the uAsset. */
export function leveragedGenesisByPsmCall(
  router: Hex,
  input: { uAsset: Hex; reserveToken: Hex; amountIn: bigint; verseId: bigint; genesisUser: Hex },
  value?: bigint,
): BatchExecution {
  return {
    target: router,
    value: value ?? 0n,
    callData: encodeFunctionData({
      abi: outrunRouterAbi,
      functionName: 'leveragedGenesisByPSM',
      args: [input.uAsset, input.reserveToken, input.amountIn, input.verseId, input.genesisUser],
    }),
  };
}

/** Single-leg preorder PSM entry (IOutrunRouter.preorderByPSM): the router mints uAsset through
 * the registered PSM pair and forwards the full mint into launcher preorder — one transaction for
 * a reserve-paid preorder. The pull token is the reserve, not the uAsset. */
export function preorderByPsmCall(
  router: Hex,
  input: { uAsset: Hex; reserveToken: Hex; amountIn: bigint; verseId: bigint; preorderUser: Hex },
  value?: bigint,
): BatchExecution {
  return {
    target: router,
    value: value ?? 0n,
    callData: encodeFunctionData({
      abi: outrunRouterAbi,
      functionName: 'preorderByPSM',
      args: [input.uAsset, input.reserveToken, input.amountIn, input.verseId, input.preorderUser],
    }),
  };
}

export function psmMintCall(psm: Hex, to: Hex, amountIn: bigint, value?: bigint): BatchExecution {
  return {
    target: psm,
    value: value ?? 0n,
    callData: encodeFunctionData({ abi: psmAbi, functionName: 'mint', args: [to, amountIn] }),
  };
}

export function psmRedeemCall(psm: Hex, to: Hex, amountIn: bigint): BatchExecution {
  return {
    target: psm,
    value: 0n,
    callData: encodeFunctionData({ abi: psmAbi, functionName: 'redeem', args: [to, amountIn] }),
  };
}

export function usrDepositCall(vault: Hex, assets: bigint, receiver: Hex): BatchExecution {
  return {
    target: vault,
    value: 0n,
    callData: encodeFunctionData({
      abi: usrVaultAbi,
      functionName: 'deposit',
      args: [assets, receiver],
    }),
  };
}

export function usrRedeemCall(
  vault: Hex,
  shares: bigint,
  receiver: Hex,
  owner: Hex,
): BatchExecution {
  return {
    target: vault,
    value: 0n,
    callData: encodeFunctionData({
      abi: usrVaultAbi,
      functionName: 'redeem',
      args: [shares, receiver, owner],
    }),
  };
}

export function faucetClaimCall(faucet: Hex, token: Hex): BatchExecution {
  return {
    target: faucet,
    value: 0n,
    callData: encodeFunctionData({ abi: faucetAbi, functionName: 'claim', args: [token] }),
  };
}

/**
 * Multi-token claim leg (Faucet.batchClaim, atomic on the contract). Direct-call
 * builders (target + callData) double as direct EOA fields: Faucet claims never
 * ride a Kernel session — session guards are hook-swap-only.
 */
export function faucetBatchClaimCall(faucet: Hex, tokens: Hex[]): BatchExecution {
  return {
    target: faucet,
    value: 0n,
    callData: encodeFunctionData({ abi: faucetAbi, functionName: 'batchClaim', args: [tokens] }),
  };
}

export function claimFeesCoreCall(hook: Hex, key: PoolKey, recipient: Hex): BatchExecution {
  return {
    target: hook,
    value: 0n,
    callData: encodeFunctionData({
      abi: hookAbi,
      functionName: 'claimFeesCore',
      args: [
        {
          key: {
            currency0: key.currency0,
            currency1: key.currency1,
            fee: key.fee,
            tickSpacing: key.tickSpacing,
            hooks: key.hooks,
          },
          recipient,
        },
      ],
    }),
  };
}

export function castVoteCall(governor: Hex, proposalId: bigint, support: number): BatchExecution {
  return {
    target: governor,
    value: 0n,
    callData: encodeFunctionData({
      abi: governorAbi,
      functionName: 'castVote',
      args: [proposalId, support],
    }),
  };
}

export function splitCall(splitter: Hex, verseId: bigint, polAmount: bigint): BatchExecution {
  return {
    target: splitter,
    value: 0n,
    callData: encodeFunctionData({
      abi: splitterAbi,
      functionName: 'split',
      args: [verseId, polAmount],
    }),
  };
}

export function mergeCall(splitter: Hex, verseId: bigint, amount: bigint): BatchExecution {
  return {
    target: splitter,
    value: 0n,
    callData: encodeFunctionData({
      abi: splitterAbi,
      functionName: 'merge',
      args: [verseId, amount],
    }),
  };
}

export function redeemPtCall(
  splitter: Hex,
  input: { verseId: bigint; ptAmount: bigint; to: Hex },
): BatchExecution {
  return {
    target: splitter,
    value: 0n,
    callData: encodeFunctionData({
      abi: splitterAbi,
      functionName: 'redeemPT',
      args: [input.verseId, input.ptAmount, input.to],
    }),
  };
}

export function redeemYtCall(
  splitter: Hex,
  input: { verseId: bigint; ytAmount: bigint; to: Hex },
): BatchExecution {
  return {
    target: splitter,
    value: 0n,
    callData: encodeFunctionData({
      abi: splitterAbi,
      functionName: 'redeemYT',
      args: [input.verseId, input.ytAmount, input.to],
    }),
  };
}

export function flashYtToPolCall(
  router: Hex,
  input: {
    verseId: bigint;
    exactYTIn: bigint;
    minPOLOut: bigint;
    sqrtPriceLimitX96: bigint;
    recipient: Hex;
    deadline: bigint;
  },
): BatchExecution {
  const zero = '0x0000000000000000000000000000000000000000' as Hex;
  return {
    target: router,
    value: 0n,
    callData: encodeFunctionData({
      abi: ytFlashRouterAbi,
      functionName: 'swapExactYTForPOL',
      args: [
        input.verseId,
        input.exactYTIn,
        input.minPOLOut,
        input.sqrtPriceLimitX96,
        input.recipient,
        input.deadline,
        zero,
      ],
    }),
  };
}

export function flashPolToYtCall(
  router: Hex,
  input: {
    verseId: bigint;
    exactYTOut: bigint;
    maxPOLIn: bigint;
    sqrtPriceLimitX96: bigint;
    recipient: Hex;
    deadline: bigint;
  },
): BatchExecution {
  const zero = '0x0000000000000000000000000000000000000000' as Hex;
  return {
    target: router,
    value: 0n,
    callData: encodeFunctionData({
      abi: ytFlashRouterAbi,
      functionName: 'swapPOLForExactYT',
      args: [
        input.verseId,
        input.exactYTOut,
        input.maxPOLIn,
        input.sqrtPriceLimitX96,
        input.recipient,
        input.deadline,
        zero,
      ],
    }),
  };
}

export type OftSendParam = {
  dstEid: number;
  to: Hex;
  amountLD: bigint;
  minAmountLD: bigint;
  extraOptions: Hex;
  composeMsg: Hex;
  oftCmd: Hex;
};

export function oftSendCall(
  uAsset: Hex,
  sendParam: OftSendParam,
  nativeFee: bigint,
  refundAddress: Hex,
  value: bigint,
): BatchExecution {
  return {
    target: uAsset,
    value,
    callData: encodeFunctionData({
      abi: uAssetOftAbi,
      functionName: 'send',
      args: [
        {
          dstEid: sendParam.dstEid,
          to: sendParam.to,
          amountLD: sendParam.amountLD,
          minAmountLD: sendParam.minAmountLD,
          extraOptions: sendParam.extraOptions,
          composeMsg: sendParam.composeMsg,
          oftCmd: sendParam.oftCmd,
        },
        { nativeFee, lzTokenFee: 0n },
        refundAddress,
      ],
    }),
  };
}

export function stakingRedeemCall(
  sp: Hex,
  input: {
    positionId: bigint;
    syRedeemed: bigint;
    receiver: Hex;
    tokenOut: Hex;
    minTokenOut: bigint;
  },
): BatchExecution {
  return {
    target: sp,
    value: 0n,
    callData: encodeFunctionData({
      abi: stakingPositionAbi,
      functionName: 'redeem',
      args: [input.positionId, input.syRedeemed, input.receiver, input.tokenOut, input.minTokenOut],
    }),
  };
}

export function vaultDepositCall(vault: Hex, assets: bigint, receiver: Hex): BatchExecution {
  return {
    target: vault,
    value: 0n,
    callData: encodeFunctionData({
      abi: yieldVaultAbi,
      functionName: 'deposit',
      args: [assets, receiver],
    }),
  };
}

export function vaultRequestRedeemCall(
  vault: Hex,
  input: { shares: bigint; controller: Hex; owner: Hex },
): BatchExecution {
  return {
    target: vault,
    value: 0n,
    callData: encodeFunctionData({
      abi: yieldVaultAbi,
      functionName: 'requestRedeem',
      args: [input.shares, input.controller, input.owner],
    }),
  };
}

export function vaultWithdrawCall(
  vault: Hex,
  input: { assets: bigint; receiver: Hex; owner: Hex },
): BatchExecution {
  return {
    target: vault,
    value: 0n,
    callData: encodeFunctionData({
      abi: yieldVaultAbi,
      functionName: 'withdraw',
      args: [input.assets, input.receiver, input.owner],
    }),
  };
}

export type SessionWriteInput = {
  hook: Hex;
  action: BatchExecution;
  approval?: BatchExecution;
  approvals?: BatchExecution[];
  /**
   * Hook-pool swap actions only (MemeverseSwapRouter.swap/swapWithPermit2 and the YT flash
   * swaps): the hook's beforeSwap/afterSwap revert AccountSessionNotActive without an active
   * session (SwapFacet.sol beforeSwapLogic; MemeverseYTFlashSwapRouter._validateAndResolve
   * also requires active == msg.sender). Every other action — OutrunRouter genesis/preorder/
   * redeem, POLend, launcher, PSM, SwapRouter liquidity, POLSplitter — runs paths that never
   * read activePrincipal, so the guards would be inert extra legs.
   */
  swapSession?: boolean;
};

/**
 * The same batch in both shapes the transaction center needs: `calls` for external wallets
 * (EIP-5792 wallet_sendCalls) and `calldata` for embedded wallets (Kernel execute type-4).
 * Default shape is approvals → action; `swapSession: true` wraps the action in the hook's
 * begin/endAccountSession guards (valid in a 5792 batch because a smart-account sender has
 * code — begin checks only `msg.sender.code.length`).
 */
export function buildSessionWrite(input: SessionWriteInput): {
  calls: BatchExecution[];
  calldata: Hex;
} {
  const calls = buildSessionBatch({
    ...(input.approval ? { approval: input.approval } : {}),
    ...(input.approvals ? { approvals: input.approvals } : {}),
    ...(input.swapSession ? { beginAccountSession: beginSessionCall(input.hook) } : {}),
    routerAction: input.action,
    ...(input.swapSession ? { endAccountSession: endSessionCall(input.hook) } : {}),
  });
  return { calls, calldata: encodeKernelExecute(calls) };
}

export function encodeSessionCalldata(input: SessionWriteInput): Hex {
  return buildSessionWrite(input).calldata;
}

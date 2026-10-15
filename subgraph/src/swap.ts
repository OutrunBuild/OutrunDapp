// Swap / liquidity / fee / referral / YT flash swap history. Pools come from the hook's
// PoolInitialized; raw swaps from the UniswapV4 PoolManager Swap event (v4-core standard,
// subgraph/abis/UniswapV4PoolManager.json).
import { Swap as PoolManagerSwap } from '../generated/PoolManager/PoolManager';
import {
  FeesClaimed as HookFeesClaimed,
  LPFeeCollected as HookLPFeeCollected,
  LiquidityAdded as HookLiquidityAdded,
  LiquidityRemoved as HookLiquidityRemoved,
  PoolInitializationAuthorized as HookPoolInitializationAuthorized,
  PoolInitialized as HookPoolInitialized,
  ProtocolFeeCollected as HookProtocolFeeCollected,
  ReferralRebateAccrued as HookReferralRebateAccrued,
  ReferralRebateClaimed as HookReferralRebateClaimed,
} from '../generated/Hook/Hook';
import {
  YTFlashSwapPOLForYT,
  YTFlashSwapYTForPOL,
} from '../generated/YTFlashSwapRouter/YTFlashSwapRouter';
import {
  Pool,
  PoolFee,
  PoolLiquidity,
  PoolSwap,
  ReferralRebate,
  YTFlashSwap,
} from '../generated/schema';
import { BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { chainId, chainIdInt, scopedId } from './utils';

function poolKey(poolId: Bytes): string {
  return chainId() + '-' + poolId.toHexString();
}

function savePoolFee(
  poolId: Bytes,
  kind: string,
  user: Bytes | null,
  currency: Bytes,
  amount: BigInt,
  feePerShare: BigInt | null,
  treasury: Bytes | null,
  pairedCurrency: Bytes | null,
  pairedAmount: BigInt | null,
  event: ethereum.Event,
): void {
  const e = new PoolFee(scopedId(poolId.toHexString() + '-fee-' + kind, event));
  e.chainId = chainIdInt();
  e.poolId = poolId;
  e.kind = kind;
  e.user = user;
  e.currency = currency;
  e.amount = amount;
  e.feePerShare = feePerShare;
  e.treasury = treasury;
  e.pairedCurrency = pairedCurrency;
  e.pairedAmount = pairedAmount;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
}

export function handlePoolInitialized(event: HookPoolInitialized): void {
  const p = new Pool(poolKey(event.params.poolId));
  p.chainId = chainIdInt();
  p.poolId = event.params.poolId;
  p.currency0 = event.params.currency0;
  p.currency1 = event.params.currency1;
  p.liquidityToken = event.params.liquidityToken;
  p.startPriceX96 = null;
  p.createdAtBlock = event.block.number;
  p.createdAtTimestamp = event.block.timestamp;
  p.save();
}

export function handlePoolInitializationAuthorized(event: HookPoolInitializationAuthorized): void {
  const p = Pool.load(poolKey(event.params.poolId));
  if (p === null) return;
  p.startPriceX96 = event.params.startPriceX96;
  p.save();
}

function saveLiquidity(kind: string, poolId: Bytes, provider: Bytes, to: Bytes | null, liquidity: BigInt, amount0: BigInt, amount1: BigInt, event: ethereum.Event): void {
  const e = new PoolLiquidity(scopedId(poolId.toHexString() + '-liq-' + kind, event));
  e.chainId = chainIdInt();
  e.poolId = poolId;
  e.kind = kind;
  e.provider = provider;
  e.to = to;
  e.liquidity = liquidity;
  e.amount0 = amount0;
  e.amount1 = amount1;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
}

export function handleLiquidityAdded(event: HookLiquidityAdded): void {
  saveLiquidity('add', event.params.poolId, event.params.provider, event.params.to, event.params.liquidity, event.params.amount0, event.params.amount1, event);
}

export function handleLiquidityRemoved(event: HookLiquidityRemoved): void {
  saveLiquidity('remove', event.params.poolId, event.params.provider, null, event.params.liquidity, event.params.amount0, event.params.amount1, event);
}

export function handleFeesClaimed(event: HookFeesClaimed): void {
  savePoolFee(event.params.poolId, 'claimed', event.params.user, event.params.currency0, event.params.fee0Amount, null, null, event.params.currency1, event.params.fee1Amount, event);
  savePoolFee(event.params.poolId, 'claimed', event.params.user, event.params.currency1, event.params.fee1Amount, null, null, event.params.currency0, event.params.fee0Amount, event);
}

export function handleLPFeeCollected(event: HookLPFeeCollected): void {
  savePoolFee(event.params.poolId, 'lp', null, event.params.currency, event.params.amount, event.params.feePerShare, null, null, null, event);
}

export function handleProtocolFeeCollected(event: HookProtocolFeeCollected): void {
  savePoolFee(event.params.poolId, 'protocol', null, event.params.currency, event.params.amount, null, event.params.treasury, null, null, event);
}

export function handlePoolSwap(event: PoolManagerSwap): void {
  const e = new PoolSwap(scopedId(event.params.id.toHexString() + '-swap', event));
  e.chainId = chainIdInt();
  e.poolId = event.params.id;
  e.sender = event.params.sender;
  e.amount0 = event.params.amount0;
  e.amount1 = event.params.amount1;
  e.sqrtPriceX96 = event.params.sqrtPriceX96;
  e.liquidity = event.params.liquidity;
  e.tick = BigInt.fromI32(event.params.tick);
  e.fee = BigInt.fromI32(event.params.fee);
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
}

export function handleReferralRebateAccrued(event: HookReferralRebateAccrued): void {
  const e = new ReferralRebate(scopedId('rebate-accrued', event));
  e.chainId = chainIdInt();
  e.kind = 'accrued';
  e.referrer = event.params.referrer;
  e.recipient = null;
  e.currency = event.params.currency;
  e.amount = event.params.amount;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
}

export function handleReferralRebateClaimed(event: HookReferralRebateClaimed): void {
  const e = new ReferralRebate(scopedId('rebate-claimed', event));
  e.chainId = chainIdInt();
  e.kind = 'claimed';
  e.referrer = event.params.referrer;
  e.recipient = event.params.recipient;
  e.currency = event.params.currency;
  e.amount = event.params.amount;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
}

function saveYtFlash(direction: string, verseId: BigInt, payer: Bytes, recipient: Bytes, exactYT: BigInt, polAmount: BigInt, referrer: Bytes, event: ethereum.Event): void {
  const e = new YTFlashSwap(scopedId(verseId.toString() + '-ytflash-' + direction, event));
  e.chainId = chainIdInt();
  e.verseId = verseId;
  e.direction = direction;
  e.payer = payer;
  e.recipient = recipient;
  e.exactYT = exactYT;
  e.polAmount = polAmount;
  e.referrer = referrer;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
}

export function handleYTFlashSwapPOLForYT(event: YTFlashSwapPOLForYT): void {
  saveYtFlash('pol-for-yt', event.params.verseId, event.params.payer, event.params.recipient, event.params.exactYTOut, event.params.polInUsed, event.params.referrer, event);
}

export function handleYTFlashSwapYTForPOL(event: YTFlashSwapYTForPOL): void {
  saveYtFlash('yt-for-pol', event.params.verseId, event.params.payer, event.params.recipient, event.params.exactYTIn, event.params.polOut, event.params.referrer, event);
}

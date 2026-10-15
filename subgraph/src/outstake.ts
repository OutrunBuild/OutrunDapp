// OutStake position events and user activity: CDP stake/redeem, PSM face-value swaps, USR vault
// deposits/withdrawals, GenesisCredit merkle claims. Family instances (per uAsset / per SY) emit
// structurally identical events; each data source gets its own handler because codegen event
// classes are nominal per source.
import { BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { Redeem as RedeemSusds, Stake as StakeSusds, StakeForGenesis as StakeForGenesisSusds } from '../generated/StakingPositionSusds/StakingPositionSusds';
import { Redeem as RedeemAusdc, Stake as StakeAusdc, StakeForGenesis as StakeForGenesisAusdc } from '../generated/StakingPositionAusdc/StakingPositionAusdc';
import { SwapMintForUAsset as SwapMintUeth, SwapRedeemForReserve as SwapRedeemUeth } from '../generated/PsmUeth/PsmUeth';
import { SwapMintForUAsset as SwapMintUusd, SwapRedeemForReserve as SwapRedeemUusd } from '../generated/PsmUusd/PsmUusd';
import { SwapMintForUAsset as SwapMintUbnb, SwapRedeemForReserve as SwapRedeemUbnb } from '../generated/PsmUbnb/PsmUbnb';
import { Deposit as UsrDepositUeth, Withdraw as UsrWithdrawUeth } from '../generated/UsrVaultUeth/UsrVaultUeth';
import { Deposit as UsrDepositUusd, Withdraw as UsrWithdrawUusd } from '../generated/UsrVaultUusd/UsrVaultUusd';
import { Deposit as UsrDepositUbnb, Withdraw as UsrWithdrawUbnb } from '../generated/UsrVaultUbnb/UsrVaultUbnb';
import {
  CdpPositionEvent,
  PsmSwap,
  UsrVaultActivity,
} from '../generated/schema';
import { chainIdInt, scopedId } from './utils';

function writeStake(positionId: BigInt, owner: Bytes, amountInSY: BigInt, mintedUAsset: BigInt, event: ethereum.Event): void {
  const e = new CdpPositionEvent(scopedId(positionId.toString() + '-stake', event));
  e.chainId = chainIdInt();
  e.positionId = positionId;
  e.kind = 'stake';
  e.owner = owner;
  e.amountInSY = amountInSY;
  e.mintedUAsset = mintedUAsset;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
}

function writeStakeForGenesis(positionId: BigInt, owner: Bytes, verseId: BigInt, mintedUAsset: BigInt, event: ethereum.Event): void {
  const e = new CdpPositionEvent(scopedId(positionId.toString() + '-stake-genesis', event));
  e.chainId = chainIdInt();
  e.positionId = positionId;
  e.kind = 'stake-for-genesis';
  e.owner = owner;
  e.verseId = verseId;
  e.mintedUAsset = mintedUAsset;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
}

function writeRedeem(positionId: BigInt, owner: Bytes, syRedeemed: BigInt, principalBurned: BigInt, interestPaid: BigInt, receiver: Bytes, tokenOut: Bytes, amountTokenOut: BigInt, event: ethereum.Event): void {
  const e = new CdpPositionEvent(scopedId(positionId.toString() + '-redeem', event));
  e.chainId = chainIdInt();
  e.positionId = positionId;
  e.kind = 'redeem';
  e.owner = owner;
  e.syRedeemed = syRedeemed;
  e.principalBurned = principalBurned;
  e.interestPaid = interestPaid;
  e.receiver = receiver;
  e.tokenOut = tokenOut;
  e.amountTokenOut = amountTokenOut;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
}

function writePsmSwap(kind: string, reserveToken: Bytes, to: Bytes, amountIn: BigInt, amountOut: BigInt, fee: BigInt, event: ethereum.Event): void {
  const e = new PsmSwap(scopedId('psm-' + kind, event));
  e.chainId = chainIdInt();
  e.psm = event.address;
  e.kind = kind;
  e.reserveToken = reserveToken;
  e.to = to;
  e.amountIn = amountIn;
  e.amountOut = amountOut;
  e.fee = fee;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
}

function writeUsrVault(kind: string, owner: Bytes, assets: BigInt, shares: BigInt, event: ethereum.Event): void {
  const e = new UsrVaultActivity(scopedId('usr-' + kind, event));
  e.chainId = chainIdInt();
  e.vault = event.address;
  e.kind = kind;
  e.owner = owner;
  e.assets = assets;
  e.shares = shares;
  e.blockTimestamp = event.block.timestamp;
  e.tx = event.transaction.hash;
  e.save();
}

// --- StakingPosition family handlers -----------------------------------------------

export function handleCdpStakeSusds(event: StakeSusds): void {
  writeStake(event.params.positionId, event.params.owner, event.params.amountInSY, event.params.mintedUAsset, event);
}
export function handleCdpStakeForGenesisSusds(event: StakeForGenesisSusds): void {
  writeStakeForGenesis(event.params.positionId, event.params.positionOwner, event.params.verseId, event.params.mintedUAsset, event);
}
export function handleCdpRedeemSusds(event: RedeemSusds): void {
  writeRedeem(event.params.positionId, event.params.owner, event.params.syRedeemed, event.params.principalBurned, event.params.interestPaid, event.params.receiver, event.params.tokenOut, event.params.amountTokenOut, event);
}
export function handleCdpStakeAusdc(event: StakeAusdc): void {
  writeStake(event.params.positionId, event.params.owner, event.params.amountInSY, event.params.mintedUAsset, event);
}
export function handleCdpStakeForGenesisAusdc(event: StakeForGenesisAusdc): void {
  writeStakeForGenesis(event.params.positionId, event.params.positionOwner, event.params.verseId, event.params.mintedUAsset, event);
}
export function handleCdpRedeemAusdc(event: RedeemAusdc): void {
  writeRedeem(event.params.positionId, event.params.owner, event.params.syRedeemed, event.params.principalBurned, event.params.interestPaid, event.params.receiver, event.params.tokenOut, event.params.amountTokenOut, event);
}

// --- PSM family handlers -------------------------------------------------------------

export function handlePsmMintUeth(event: SwapMintUeth): void {
  writePsmSwap('mint', event.params.reserveToken, event.params.to, event.params.amountIn, event.params.amountOut, event.params.feeIn, event);
}
export function handlePsmRedeemUeth(event: SwapRedeemUeth): void {
  writePsmSwap('redeem', event.params.reserveToken, event.params.to, event.params.amountIn, event.params.amountOut, event.params.feeOut, event);
}
export function handlePsmMintUusd(event: SwapMintUusd): void {
  writePsmSwap('mint', event.params.reserveToken, event.params.to, event.params.amountIn, event.params.amountOut, event.params.feeIn, event);
}
export function handlePsmRedeemUusd(event: SwapRedeemUusd): void {
  writePsmSwap('redeem', event.params.reserveToken, event.params.to, event.params.amountIn, event.params.amountOut, event.params.feeOut, event);
}
export function handlePsmMintUbnb(event: SwapMintUbnb): void {
  writePsmSwap('mint', event.params.reserveToken, event.params.to, event.params.amountIn, event.params.amountOut, event.params.feeIn, event);
}
export function handlePsmRedeemUbnb(event: SwapRedeemUbnb): void {
  writePsmSwap('redeem', event.params.reserveToken, event.params.to, event.params.amountIn, event.params.amountOut, event.params.feeOut, event);
}

// --- USR vault family handlers --------------------------------------------------------

export function handleUsrDepositUeth(event: UsrDepositUeth): void {
  writeUsrVault('deposit', event.params.owner, event.params.assets, event.params.shares, event);
}
export function handleUsrWithdrawUeth(event: UsrWithdrawUeth): void {
  writeUsrVault('withdraw', event.params.owner, event.params.assets, event.params.shares, event);
}
export function handleUsrDepositUusd(event: UsrDepositUusd): void {
  writeUsrVault('deposit', event.params.owner, event.params.assets, event.params.shares, event);
}
export function handleUsrWithdrawUusd(event: UsrWithdrawUusd): void {
  writeUsrVault('withdraw', event.params.owner, event.params.assets, event.params.shares, event);
}
export function handleUsrDepositUbnb(event: UsrDepositUbnb): void {
  writeUsrVault('deposit', event.params.owner, event.params.assets, event.params.shares, event);
}
export function handleUsrWithdrawUbnb(event: UsrWithdrawUbnb): void {
  writeUsrVault('withdraw', event.params.owner, event.params.assets, event.params.shares, event);
}

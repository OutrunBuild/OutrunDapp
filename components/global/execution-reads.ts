// Onchain execution reads: verse registry, pool keys, quotes and token state, all through
// the active wallet provider (no server keys on the client path). The reader interface keeps
// resolution logic unit-testable without a chain (§11.1).
import { createPublicClient, custom, type Abi, type Chain, type Hex } from 'viem';

import { erc20ReadAbi, hookAbi, launcherAbi, polendAbi, psmAbi, splitterAbi, swapRouterAbi } from '@/lib/web3/abis';
import { preorderCapacityCeilingBase } from '@/lib/web3/contract-formulas';
import { getClientChainConfig } from '@/lib/web3/chains';
import type { Eip1193Request } from '@/lib/web3/active-provider';
import { tracePhase } from '@/lib/web3/click-trace';
import { poolIdOf, priceQuotePerBase } from '@/lib/web3/pool-quote';
import type { PoolKey } from '@/lib/web3/session-actions';

export type ContractReader = {
  read(params: {
    address: Hex;
    abi: Abi;
    functionName: string;
    args?: readonly unknown[];
    /** eth_call from-address for msg.sender-scoped views (e.g. claimablePreorderMemecoin) */
    account?: Hex;
  }): Promise<unknown>;
};

export type VerseAddresses = {
  uAsset: Hex;
  memecoin: Hex;
  pol: Hex;
  yieldVault: Hex;
  governor: Hex;
};

function asTupleArray(value: unknown): readonly unknown[] {
  if (Array.isArray(value)) return value;
  // viem decodes named struct outputs into an object keyed by field name, inserted in
  // ABI declaration order — Object.values restores the positional tuple either way.
  if (value !== null && typeof value === 'object') return Object.values(value);
  throw new Error('outrun: unexpected tuple shape from contract read');
}

function asHex(value: unknown): Hex {
  if (typeof value === 'string' && value.startsWith('0x')) return value as Hex;
  throw new Error('outrun: expected address from contract read');
}

/** getMemeverseByVerseId tuple indices (name, symbol, uri, desc, uAsset, stage, flash, memecoin, pol, vault, governor, incentivizer, end, unlock, omnichain). */
export async function readVerseAddresses(
  reader: ContractReader,
  launcher: Hex,
  verseId: bigint,
): Promise<VerseAddresses> {
  const tuple = asTupleArray(
    await reader.read({ address: launcher, abi: launcherAbi, functionName: 'getMemeverseByVerseId', args: [verseId] }),
  );
  return {
    uAsset: asHex(tuple[4]),
    memecoin: asHex(tuple[7]),
    pol: asHex(tuple[8]),
    yieldVault: asHex(tuple[9]),
    governor: asHex(tuple[10]),
  };
}

/** Connected account's per-kind genesis ledger in uAsset base units: standard funds and
 *  preorder funds (launcher ledgers, with their one-shot refund flags) plus leveraged interest
 *  (POLend's totalInterestPaid already sums the real-uAsset and credit slices —
 *  POLendUpgradeable.sol:663). Plain mapping reads, so an unknown verse or non-participant
 *  decodes as zero instead of reverting. The interest leg's refund-claimed state lives in
 *  POLend's private claimFlags (no view exposes it) — the amount is all the chain offers. */
export type GenesisLedger = {
  normal: bigint;
  normalRefunded: boolean;
  preorder: bigint;
  preorderRefunded: boolean;
  interest: bigint;
};

export async function readGenesisLedger(
  reader: ContractReader,
  launcher: Hex,
  polend: Hex,
  verseId: bigint,
  account: Hex,
): Promise<GenesisLedger> {
  const [genesis, preorder, interest] = await Promise.all([
    reader.read({ address: launcher, abi: launcherAbi, functionName: 'userGenesisData', args: [verseId, account] }),
    reader.read({ address: launcher, abi: launcherAbi, functionName: 'userPreorderData', args: [verseId, account] }),
    reader.read({ address: polend, abi: polendAbi, functionName: 'totalInterestPaid', args: [verseId, account] }),
  ]);
  const genesisTuple = asTupleArray(genesis);
  const preorderTuple = asTupleArray(preorder);
  return {
    normal: BigInt(String(genesisTuple[0])),
    normalRefunded: Boolean(genesisTuple[1]),
    preorder: BigInt(String(preorderTuple[0])),
    preorderRefunded: Boolean(preorderTuple[2]),
    interest: BigInt(String(interest)),
  };
}

/** 「您的参与」 single-value form: equivalent genesis funds. Normal genesis funds plus the
 *  leveraged interest converted at the on-chain rate — POLend's getUserLeveragedDebt does the
 *  conversion on-chain ((real+credit interest) × 1e18 ÷ interestRate, POLendUpgradeable.sol:
 *  700-712), so no client-side rate math. Preorder funds are not part of this stat. The market
 *  is registered at launch (MemeverseLaunchImpl.sol:84), so the debt view never hits its
 *  InvalidState guard on a live verse. */
export async function readGenesisParticipation(
  reader: ContractReader,
  launcher: Hex,
  polend: Hex,
  verseId: bigint,
  account: Hex,
): Promise<bigint> {
  const [genesis, leveragedDebt] = await Promise.all([
    reader.read({ address: launcher, abi: launcherAbi, functionName: 'userGenesisData', args: [verseId, account] }),
    reader.read({ address: polend, abi: polendAbi, functionName: 'getUserLeveragedDebt', args: [verseId, account] }),
  ]);
  return BigInt(String(asTupleArray(genesis)[0])) + BigInt(String(leveragedDebt));
}

/** Verse-level genesis aggregates, all uAsset 18-dec base units. The post-write probe reads
 *  these through the wallet provider (same RPC that confirmed the receipt) so the panel's
 *  numbers refresh immediately instead of waiting out the server-side SWR caches. Sourced from
 *  launcher `totalNormalFunds` + `previewPreorderCapacity` and POLend `getLeveragedDebtInfo`
 *  (interest total / debt principal), mirroring what the subgraph aggregates for SSR. */
export type VerseAggregatesLedger = {
  normalBase: bigint;
  interestBase: bigint;
  debtBase: bigint;
  remainingPreorderBase: bigint;
};

export async function readVerseAggregates(
  reader: ContractReader,
  launcher: Hex,
  polend: Hex,
  verseId: bigint,
): Promise<VerseAggregatesLedger> {
  const [normal, remaining, debtInfo] = await Promise.all([
    reader.read({ address: launcher, abi: launcherAbi, functionName: 'totalNormalFunds', args: [verseId] }),
    reader.read({ address: launcher, abi: launcherAbi, functionName: 'previewPreorderCapacity', args: [verseId] }),
    reader.read({ address: polend, abi: polendAbi, functionName: 'getLeveragedDebtInfo', args: [verseId] }),
  ]);
  // getLeveragedDebtInfo is one named struct: [totalLeveragedInterest, totalLeveragedDebt, …]
  const info = asTupleArray(debtInfo);
  return {
    normalBase: BigInt(String(normal)),
    interestBase: BigInt(String(info[0])),
    debtBase: BigInt(String(info[1])),
    remainingPreorderBase: BigInt(String(remaining)),
  };
}

/** Used preorder funds reconstructed from the probe reads: the launcher only exposes the
 *  capacity REMAINING (`previewPreorderCapacity`), so used = chain-exact ceiling − remaining
 *  (floor-clamped). `preorderCapacityCeilingBase` is the single-step chain formula — the
 *  two-step per-user variant would leak its rounding gap into the reconstruction. Null ratio
 *  (unread config) leaves the reconstruction to the caller's fallback. */
export function deriveVersePreorderUsed(
  ledger: Pick<VerseAggregatesLedger, 'normalBase' | 'debtBase' | 'remainingPreorderBase'>,
  ratioBps: bigint | null,
): bigint | null {
  if (ratioBps == null) return null;
  const ceiling = preorderCapacityCeilingBase(ledger.normalBase + ledger.debtBase, ratioBps);
  return ceiling > ledger.remainingPreorderBase
    ? ceiling - ledger.remainingPreorderBase
    : 0n;
}

export async function readPoolKey(
  reader: ContractReader,
  router: Hex,
  tokenA: Hex,
  tokenB: Hex,
): Promise<PoolKey> {
  const tuple = asTupleArray(
    await reader.read({ address: router, abi: swapRouterAbi, functionName: 'getHookPoolKey', args: [tokenA, tokenB] }),
  );
  return {
    currency0: asHex(tuple[0]),
    currency1: asHex(tuple[1]),
    fee: Number(tuple[2]),
    tickSpacing: Number(tuple[3]),
    hooks: asHex(tuple[4]),
  };
}

export type SwapQuote = {
  feeBps: bigint;
  estimatedUserInputAmount: bigint;
  estimatedUserOutputAmount: bigint;
  /** Fee split of the same preview: the pair the card's single fee row folds together. */
  estimatedProtocolFeeAmount: bigint;
  estimatedLpFeeAmount: bigint;
  /** True when both fee legs settle on the input side; false means the protocol leg is
   *  taken from the output and must be converted to input units before being added. */
  protocolFeeOnInput: boolean;
};

export async function readSwapQuote(
  reader: ContractReader,
  router: Hex,
  key: PoolKey,
  params: { zeroForOne: boolean; amountSpecified: bigint; sqrtPriceLimitX96: bigint },
  trader: Hex,
): Promise<SwapQuote> {
  const tuple = asTupleArray(
    await tracePhase('quote', () =>
      reader.read({
        address: router,
        abi: swapRouterAbi,
        functionName: 'quoteSwap',
        args: [
          {
            currency0: key.currency0,
            currency1: key.currency1,
            fee: key.fee,
            tickSpacing: key.tickSpacing,
            hooks: key.hooks,
          },
          {
            zeroForOne: params.zeroForOne,
            amountSpecified: params.amountSpecified,
            sqrtPriceLimitX96: params.sqrtPriceLimitX96,
          },
          trader,
        ],
      }),
    ),
  );
  return {
    feeBps: BigInt(String(tuple[0])),
    estimatedUserInputAmount: BigInt(String(tuple[1])),
    estimatedUserOutputAmount: BigInt(String(tuple[2])),
    estimatedProtocolFeeAmount: BigInt(String(tuple[3] ?? 0)),
    estimatedLpFeeAmount: BigInt(String(tuple[4] ?? 0)),
    protocolFeeOnInput: Boolean(tuple[5]),
  };
}

/** PSM par-swap quote: the contract's mint/redeem preview, identical to execution output in
 *  the non-dust domain (fee-only math, no price input). Used to price the reserve leg of a
 *  swap and to convert between the card's input token and the pool's uAsset leg. */
export async function readPsmQuote(
  reader: ContractReader,
  psm: Hex,
  mode: 'mint' | 'redeem',
  amount: bigint,
): Promise<bigint> {
  return BigInt(
    String(
      await tracePhase('psm-quote', () =>
        reader.read({
          address: psm,
          abi: psmAbi,
          functionName: mode === 'mint' ? 'quoteMint' : 'quoteRedeem',
          args: [amount],
        }),
      ),
    ),
  );
}

/** Same-clock spot reference for the price-impact row, in display units of tokenOut per
 *  tokenIn. Derives the pool price exactly the way the SSR trade desk does — LP supply off
 *  the hook, then the router's full-range amount quote at the live sqrtPrice
 *  (MemeverseSwapRouter.quoteAmountsForLiquidity) — so the ratio is the pool's spot price at
 *  read time. Runs inside the quote poll's Promise.all, which is the point: impact must never
 *  compare a fresh quote against a page-load-age price. Null (pool absent, zero LP, or any
 *  read error) degrades only the impact row — the quote itself stays usable. */
export async function readSwapSpotOutPerIn(
  reader: ContractReader,
  router: Hex,
  hook: Hex,
  key: PoolKey,
  tokenIn: Hex,
  decimalsIn: number,
  decimalsOut: number,
): Promise<number | null> {
  try {
    const lpSupply = BigInt(
      String(
        await reader.read({
          address: hook,
          abi: hookAbi,
          functionName: 'cachedLpTotalSupply',
          args: [poolIdOf(key)],
        }),
      ),
    );
    if (lpSupply <= 0n) return null;
    const tuple = asTupleArray(
      await reader.read({
        address: router,
        abi: swapRouterAbi,
        functionName: 'quoteAmountsForLiquidity',
        args: [key.currency0, key.currency1, lpSupply],
      }),
    );
    const amount0 = BigInt(String(tuple[0]));
    const amount1 = BigInt(String(tuple[1]));
    const inIsCurrency0 = tokenIn.toLowerCase() === key.currency0.toLowerCase();
    const [amountInLeg, amountOutLeg] = inIsCurrency0 ? [amount0, amount1] : [amount1, amount0];
    return priceQuotePerBase(amountInLeg, decimalsIn, amountOutLeg, decimalsOut);
  } catch {
    return null;
  }
}

export async function readErc20Meta(
  reader: ContractReader,
  token: Hex,
): Promise<{ decimals: number }> {
  const decimals = await reader.read({ address: token, abi: erc20ReadAbi, functionName: 'decimals' });
  return { decimals: Number(decimals) };
}

/**
 * 点击链路上唯一必须现查的读：每个 pull 腿一条 allowance，腿之间并行（一轮往返）。
 * 余额是展示读，不进点击链路 —— 弹窗打开前读它只会让窗口晚到。
 */
export async function readAllowances(
  reader: ContractReader,
  owner: Hex,
  legs: readonly { token: Hex; spender: Hex }[],
): Promise<bigint[]> {
  return tracePhase(
    'allowance',
    () =>
      Promise.all(
        legs.map(async (leg) =>
          BigInt(
            String(
              await reader.read({
                address: leg.token,
                abi: erc20ReadAbi,
                functionName: 'allowance',
                args: [owner, leg.spender],
              }),
            ),
          ),
        ),
      ),
    `${legs.length} leg${legs.length === 1 ? '' : 's'}`,
  );
}

/** Router quote of the amounts one reference amount of LP needs at the pool's current price.
 *  Amounts are rounded up by the router, so a target derived from them never exceeds the
 *  caller's budgets. */
export async function readLiquidityQuote(
  reader: ContractReader,
  router: Hex,
  tokenA: Hex,
  tokenB: Hex,
  referenceLiquidity: bigint,
): Promise<{ amountA: bigint; amountB: bigint }> {
  const tuple = asTupleArray(
    await reader.read({
      address: router,
      abi: swapRouterAbi,
      functionName: 'quoteExactAmountsForLiquidity',
      args: [tokenA, tokenB, referenceLiquidity],
    }),
  );
  return { amountA: BigInt(String(tuple[0])), amountB: BigInt(String(tuple[1])) };
}

export type PoolSideKind = 'meme' | 'uasset' | 'pol' | 'pt';

/** Pool id → [base, quote] side kinds (main/pol-uasset/pt-uasset/pt-pol). */
export function poolSideKinds(poolId: string): [PoolSideKind, PoolSideKind] {
  if (poolId === 'main') return ['meme', 'uasset'];
  if (poolId === 'pol-uasset') return ['pol', 'uasset'];
  if (poolId === 'pt-uasset') return ['pt', 'uasset'];
  return ['pt', 'pol'];
}

export async function resolvePoolTokens(
  reader: ContractReader,
  session: { verse: VerseAddresses; contracts: Record<string, string> },
  poolId: string,
  verseId: bigint,
): Promise<{ base: Hex; quote: Hex }> {
  const [baseKind, quoteKind] = poolSideKinds(poolId);
  const resolve = async (kind: PoolSideKind): Promise<Hex> => {
    if (kind === 'meme') return session.verse.memecoin;
    if (kind === 'uasset') return session.verse.uAsset;
    if (kind === 'pol') return session.verse.pol;
    return readPTToken(reader, session.contracts.POLSplitter as Hex, verseId);
  };
  const [base, quote] = await Promise.all([resolve(baseKind), resolve(quoteKind)]);
  return { base, quote };
}

/** Splitter PT address (`getPT`) — zero until launch: PT/YT deploy once via initializeVerse
 *  in the launcher's launch path (POLSplitterUpgradeable.sol:213; MemeverseLaunchImpl.sol:329,
 *  leverage-independent), so callers treat zero as "no PT leg". */
export async function readPTToken(
  reader: ContractReader,
  splitter: Hex,
  verseId: bigint,
): Promise<Hex> {
  return (await reader.read({
    address: splitter,
    abi: splitterAbi,
    functionName: 'getPT',
    args: [verseId],
  })) as Hex;
}

export type VerseSession = {
  client: ReturnType<typeof createPublicClient>;
  reader: ContractReader;
  contracts: Record<string, string>;
  verse: VerseAddresses;
  kernel: Hex;
  hook: Hex;
  launcher: Hex;
  eoa: Hex;
  chain: Chain;
  chainId: number;
  manifestVersion: string;
};

/**
 * Resolve everything a verse write needs in one shot: chain contracts, verse registry
 * (uAsset/memecoin/pol/vault/governor) and a provider-backed reader. Throws when the
 * chain is unsupported or the deployment is incomplete — callers surface the degrade copy.
 */
export async function resolveVerseSession(input: {
  request: Eip1193Request;
  chainId: number;
  eoa: Hex;
  verseId: bigint;
}): Promise<VerseSession> {
  const resolved = getClientChainConfig(input.chainId);
  if (resolved.status !== 'ok' || resolved.config.contracts.status !== 'deployed') {
    throw new Error('outrun: chain not deployed');
  }
  const contracts = resolved.config.contracts.addresses;
  const launcher = contracts.MemeverseLauncher as Hex | undefined;
  const hook = contracts.MemeverseUniswapHook as Hex;
  const kernel = resolved.config.kernel7702Implementation as Hex;
  if (!launcher) throw new Error('outrun: launcher missing');
  const client = createPublicClient({
    chain: resolved.config.viemChain,
    transport: custom({ request: input.request }),
  });
  const reader: ContractReader = {
    read: (readParams) => client.readContract(readParams) as Promise<unknown>,
  };
  const verse = await readVerseAddresses(reader, launcher, input.verseId);
  return {
    client,
    reader,
    contracts,
    verse,
    kernel,
    hook,
    launcher,
    eoa: input.eoa,
    chain: resolved.config.viemChain,
    chainId: input.chainId,
    manifestVersion: resolved.config.contracts.abiVersion,
  };
}


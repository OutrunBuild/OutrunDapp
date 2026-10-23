// Onchain execution reads: verse registry, pool keys, quotes and token state, all through
// the active wallet provider (no server keys on the client path). The reader interface keeps
// resolution logic unit-testable without a chain (§11.1).
import { createPublicClient, custom, formatUnits, type Abi, type Chain, type Hex } from 'viem';

import { erc20ReadAbi, launcherAbi, splitterAbi, swapRouterAbi } from '@/lib/web3/abis';
import { getClientChainConfig } from '@/lib/web3/chains';
import type { Eip1193Request } from '@/lib/web3/active-provider';
import type { PoolKey } from '@/lib/web3/session-actions';

export type ContractReader = {
  read(params: {
    address: Hex;
    abi: Abi;
    functionName: string;
    args?: readonly unknown[];
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
};

export async function readSwapQuote(
  reader: ContractReader,
  router: Hex,
  key: PoolKey,
  params: { zeroForOne: boolean; amountSpecified: bigint; sqrtPriceLimitX96: bigint },
  trader: Hex,
): Promise<SwapQuote> {
  const tuple = asTupleArray(
    await reader.read({
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
  );
  return {
    feeBps: BigInt(String(tuple[0])),
    estimatedUserInputAmount: BigInt(String(tuple[1])),
    estimatedUserOutputAmount: BigInt(String(tuple[2])),
  };
}

export async function readErc20Meta(
  reader: ContractReader,
  token: Hex,
): Promise<{ decimals: number }> {
  const decimals = await reader.read({ address: token, abi: erc20ReadAbi, functionName: 'decimals' });
  return { decimals: Number(decimals) };
}

export async function readErc20State(
  reader: ContractReader,
  token: Hex,
  owner: Hex,
  spender: Hex,
): Promise<{ balance: bigint; allowance: bigint }> {
  const [balance, allowance] = await Promise.all([
    reader.read({ address: token, abi: erc20ReadAbi, functionName: 'balanceOf', args: [owner] }),
    reader.read({ address: token, abi: erc20ReadAbi, functionName: 'allowance', args: [owner, spender] }),
  ]);
  return { balance: BigInt(String(balance)), allowance: BigInt(String(allowance)) };
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
    const splitter = session.contracts.POLSplitter as Hex;
    return (await reader.read({
      address: splitter,
      abi: splitterAbi,
      functionName: 'getPT',
      args: [verseId],
    })) as Hex;
  };
  const [base, quote] = await Promise.all([resolve(baseKind), resolve(quoteKind)]);
  return { base, quote };
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

/** Gas estimate + native balance for the review panel (estimate may fall back to '—'). */
export async function estimateSession(
  session: Pick<VerseSession, 'client' | 'reader'> & { eoa: Hex },
  batch: Hex,
): Promise<{ estimatedGas: string; nativeBalance: string }> {
  try {
    const [gas, balance] = await Promise.all([
      session.client.estimateGas({ account: session.eoa, to: session.eoa, data: batch }),
      session.client.getBalance({ address: session.eoa }),
    ]);
    return { estimatedGas: gas.toString(), nativeBalance: formatUnits(balance, 18) };
  } catch {
    const balance = await session.client.getBalance({ address: session.eoa });
    return { estimatedGas: '—', nativeBalance: formatUnits(balance, 18) };
  }
}

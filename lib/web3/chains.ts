// Six-chain registry (architecture.md §5): the single source of chain configuration.
// Testnet entries load deployments/{chainId}.json (the only legal contract-address source) and
// resolve ${VAR} ENV placeholders at startup. Mainnet entries are structurally undeployed until
// their deployment certification round: no addresses, no RPC provisioning, no subgraph endpoint --
// zero addresses are forbidden anywhere. A deployed chain whose RPC placeholders cannot resolve
// fails closed to not-configured; public RPCs never enter onchain fallback transports.
import { z } from 'zod';
import type { Chain } from 'viem';
import { getAddress } from 'viem';
import { arbitrumSepolia, base, baseSepolia, bsc, bscTestnet, mainnet } from 'viem/chains';
import deployment421614 from '../../deployments/421614.json';
import deployment84532 from '../../deployments/84532.json';
import deployment97 from '../../deployments/97.json';

export type EnvLookup = Record<string, string | undefined>;

export const CHAIN_IDS = [1, 8453, 56, 421614, 84532, 97] as const;
export const MAINNET_CHAIN_IDS = [1, 8453, 56] as const;
export const TESTNET_CHAIN_IDS = [421614, 84532, 97] as const;

/** Wallet-execution chain for a verse governed on `governanceChainId`: mainnet governance chains
 * execute on their testnet twin while mainnets are undeployed; testnet ids are their own. */
export function executionChainId(governanceChainId: number): number {
  const twin: Record<number, number> = { 1: 421614, 8453: 84532, 56: 97 };
  return twin[governanceChainId] ?? governanceChainId;
}

/** Chains where a verse can execute locally: the landed set (chains whose subgraph actually
 * holds the verse) when the source carries per-chain presence, otherwise the governance
 * chain's execution twin. The registration request (`omnichainIds`) is not evidence — a target
 * can be requested and never receive the LayerZero delivery. Ascending id order is part of the
 * contract: the switch target below is "the first landed chain", so callers cannot reorder it. */
export function verseExecutionChains(
  governanceChainId: number,
  deployedChainIds: readonly number[] | null,
): number[] {
  const ids =
    deployedChainIds && deployedChainIds.length > 0 ? deployedChainIds : [governanceChainId];
  return [...new Set(ids.map(executionChainId))].sort((a, b) => a - b);
}

/** Network-switch target for a wallet outside the verse's execution set: the governance chain
 * when it actually landed, otherwise the first landed chain (never a registration-only id). */
export function verseSwitchChainId(
  governanceChainId: number,
  deployedChainIds: readonly number[] | null,
): number {
  const chains = verseExecutionChains(governanceChainId, deployedChainIds);
  const governanceChain = executionChainId(governanceChainId);
  return chains.includes(governanceChain) ? governanceChain : chains[0]!;
}

// Kernel V3.3 delegation implementation is the same address on all six chains (§5); per-chain
// runtime codehashes are the 2026-08-30 onchain observations registered in §5
const KERNEL_7702_IMPLEMENTATION = '0xd6CEDDe84be40893d153Be9d467CD6aD37875b28';
const MAINNET_KERNEL_CODEHASHES: Record<number, string> = {
  1: '0xd748c6060679ccb34583963e5edc21299e4c6723e7c7a80561d255861ed209b7',
  8453: '0xe5b56d82025d2358308f77833fe29c3856b1a7a0f7a4b9f86b1fd77da3e3b4fb',
  56: '0xcad500ade34248a6e7e84f6594cbbe31391fa26910527c9d131e39e42e75cc63',
};

const ZERO_ADDRESS = '0x' + '0'.repeat(40);
const hexAddress = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const nonZeroAddress = hexAddress.refine((a) => a !== ZERO_ADDRESS, {
  message: 'zero address is not a deployment',
});
const codehash = z.string().regex(/^0x[0-9a-fA-F]{64}$/);

// deployments/{chainId}.json shape (deployed chains). eip7702TxType/authorizationPolicy/
// gasPaymentPolicy are protocol-wide invariants locked by literals.
export const deploymentSchema = z.object({
  chainId: z.number().int().positive(),
  environment: z.enum(['mainnet', 'testnet']),
  rpc: z.object({ primary: z.string().min(1), fallback: z.string().min(1) }),
  explorer: z.string().url(),
  layerZeroEid: z.number().int().nonnegative(),
  finalityPolicy: z.object({ safeBlockLag: z.number().int().positive() }),
  contracts: z
    .record(z.string(), nonZeroAddress)
    .refine((r) => Object.keys(r).length > 0, { message: 'empty contract record' }),
  deploymentBlock: z.number().int().nonnegative(),
  abiVersion: z.string().min(1),
  implementationCodehashes: z.record(hexAddress, codehash),
  kernel7702Implementation: hexAddress,
  kernel7702Codehash: codehash,
  /** Chainlink native/USD aggregator (optional): absent -> gas USD line is not shown. */
  nativeUsdFeed: hexAddress.optional(),
  eip7702TxType: z.literal('0x04'),
  authorizationPolicy: z.literal('chain-specific'),
  gasPaymentPolicy: z.literal('user-pays-native'),
  subgraphEndpoint: z.string().min(1),
  features: z.array(z.string().min(1)),
});

// Static facts for the structurally-undeployed mainnet entries (explorer/layerZeroEid/Kernel
// chain observations from §5). RPC provisioning and finality lags land with the mainnet
// deployment certification round, not now -- null until then.
const undeployedEntrySchema = z.object({
  chainId: z.number().int().positive(),
  environment: z.literal('mainnet'),
  explorer: z.string().url(),
  layerZeroEid: z.number().int().nonnegative(),
  kernel7702Implementation: hexAddress,
  kernel7702Codehash: codehash,
  /** Chainlink native/USD aggregator (optional): absent -> gas USD line is not shown. */
  nativeUsdFeed: hexAddress.optional(),
  eip7702TxType: z.literal('0x04'),
  authorizationPolicy: z.literal('chain-specific'),
  gasPaymentPolicy: z.literal('user-pays-native'),
});

type MainnetEntry = z.infer<typeof undeployedEntrySchema>;

type RegistryEntry =
  | { kind: 'deployed'; viemChain: Chain; deployment: unknown }
  | { kind: 'undeployed'; viemChain: Chain; meta: MainnetEntry };

const mainnetEntry = (
  chainId: number,
  viemChain: Chain,
  explorer: string,
  layerZeroEid: number,
): RegistryEntry => ({
  kind: 'undeployed',
  viemChain,
  meta: {
    chainId,
    environment: 'mainnet',
    explorer,
    layerZeroEid,
    kernel7702Implementation: KERNEL_7702_IMPLEMENTATION,
    kernel7702Codehash: MAINNET_KERNEL_CODEHASHES[chainId]!,
    eip7702TxType: '0x04',
    authorizationPolicy: 'chain-specific',
    gasPaymentPolicy: 'user-pays-native',
  },
});

const REGISTRY = new Map<number, RegistryEntry>([
  [1, mainnetEntry(1, mainnet, 'https://etherscan.io', 30101)],
  [8453, mainnetEntry(8453, base, 'https://basescan.org', 30184)],
  [56, mainnetEntry(56, bsc, 'https://bscscan.com', 30102)],
  [421614, { kind: 'deployed', viemChain: arbitrumSepolia, deployment: deployment421614 }],
  [84532, { kind: 'deployed', viemChain: baseSepolia, deployment: deployment84532 }],
  [97, { kind: 'deployed', viemChain: bscTestnet, deployment: deployment97 }],
]);

export type DeployedContracts = {
  status: 'deployed';
  addresses: Record<string, string>;
  abiVersion: string;
  deploymentBlock: number;
  implementationCodehashes: Record<string, string>;
};
export type UndeployedContracts = { status: 'undeployed' };

export type OutrunChainConfig = {
  chainId: number;
  environment: 'mainnet' | 'testnet';
  viemChain: Chain;
  explorer: string;
  layerZeroEid: number;
  /** Safe-block lag for finality gating; null until the chain's deployment certification */
  finalityPolicy: { safeBlockLag: number } | null;
  contracts: DeployedContracts | UndeployedContracts;
  kernel7702Implementation: string;
  kernel7702Codehash: string;
  /** Chainlink native/USD aggregator; null when the chain has no feed wired. */
  nativeUsdFeed: string | null;
  eip7702TxType: '0x04';
  authorizationPolicy: 'chain-specific';
  gasPaymentPolicy: 'user-pays-native';
  /** Resolved Alchemy primary + Infura fallback; null when unprovisioned (undeployed chains) */
  rpc: { primary: string; fallback: string } | null;
  /** Studio/Network query endpoint; null keeps RPC-only operation (silent Graph degrade) */
  subgraphEndpoint: string | null;
  features: readonly string[];
};

export type ResolvedChain =
  { status: 'ok'; config: OutrunChainConfig } | { status: 'not-configured'; reason: string };

const PLACEHOLDER_RE = /\$\{([A-Z][A-Z0-9_]*)\}/g;

function resolveTemplate(template: string, env: EnvLookup): { value: string; missing: string[] } {
  const missing: string[] = [];
  const value = template.replace(PLACEHOLDER_RE, (_whole, name: string) => {
    const v = env[name];
    if (!v) {
      missing.push(name);
      return _whole;
    }
    return v;
  });
  return { value, missing };
}

/** Zod-parse a deployments/{chainId}.json payload pinned to the expected chain id (fail-closed) */
export function parseDeployment(
  raw: unknown,
  expectedChainId: number,
): { ok: true; data: z.infer<typeof deploymentSchema> } | { ok: false; reason: string } {
  const pinned = deploymentSchema.extend({ chainId: z.literal(expectedChainId) });
  const parsed = pinned.safeParse(raw);
  if (!parsed.success) {
    const paths = [...new Set(parsed.error.issues.map((i) => i.path.join('.')))].join(', ');
    return { ok: false, reason: `deployments/${expectedChainId}.json rejected: ${paths}` };
  }
  return { ok: true, data: parsed.data };
}

/** Resolve one chain's config against an ENV lookup (pure: pass an explicit env in tests) */
export function resolveOutrunChain(chainId: number, env: EnvLookup = process.env): ResolvedChain {
  const entry = REGISTRY.get(chainId);
  if (!entry) return { status: 'not-configured', reason: `unknown chainId ${chainId}` };

  if (entry.kind === 'undeployed') {
    const parsed = undeployedEntrySchema.safeParse(entry.meta);
    if (!parsed.success || parsed.data.chainId !== entry.viemChain.id) {
      return { status: 'not-configured', reason: `mainnet ${chainId} entry rejected` };
    }
    return assembleUndeployedConfig(chainId, entry.viemChain, parsed.data);
  }

  const parsed = parseDeployment(entry.deployment, chainId);
  if (!parsed.ok) return { status: 'not-configured', reason: parsed.reason };
  const d = parsed.data;
  if (d.chainId !== entry.viemChain.id) {
    return { status: 'not-configured', reason: `chainId ${chainId} mismatches viem chain` };
  }

  // Deployed chains require both RPC endpoints; the subgraph endpoint may stay unprovisioned
  // (Graph queries degrade to not-configured while RPC keeps working)
  const primary = resolveTemplate(d.rpc.primary, env);
  const fallback = resolveTemplate(d.rpc.fallback, env);
  const missing = [...new Set([...primary.missing, ...fallback.missing])];
  if (missing.length) {
    return {
      status: 'not-configured',
      reason: `chain ${chainId} missing RPC env: ${missing.join(', ')}`,
    };
  }
  const subgraph = resolveTemplate(d.subgraphEndpoint, env);

  return assembleDeployedConfig(chainId, entry.viemChain, d, {
    rpc: { primary: primary.value, fallback: fallback.value },
    subgraphEndpoint: subgraph.missing.length ? null : subgraph.value,
  });
}

const resolvedCache = new Map<number, ResolvedChain>();

/** Process-level cached resolution (server startup semantics; tests use resolveOutrunChain) */
export function getChainConfig(chainId: number): ResolvedChain {
  let r = resolvedCache.get(chainId);
  if (!r) {
    r = resolveOutrunChain(chainId);
    resolvedCache.set(chainId, r);
  }
  return r;
}

type Deployment = z.infer<typeof deploymentSchema>;

// EIP-55 normalization at the registry boundary (AC-3): deployment files carry raw hex
// casing, but every viem send path validates checksums — normalize once here so all
// downstream readers, encoders and comparisons see canonical addresses.
const checksumValues = (record: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(record).map(([key, value]) => [key, getAddress(value)]));
const checksumKeys = (record: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(record).map(([key, value]) => [getAddress(key), value]));

/** The deployed-chain field mapping lives here once: both resolution paths transpose the same
 *  deployment schema, and differ only in transport (server resolves ENV placeholders, the
 *  client has none). Adding a field here reaches both paths in the same edit. */
function assembleDeployedConfig(
  chainId: number,
  viemChain: Chain,
  d: Deployment,
  transport: { rpc: OutrunChainConfig['rpc']; subgraphEndpoint: string | null },
): ResolvedChain {
  return {
    status: 'ok',
    config: {
      chainId,
      environment: d.environment,
      viemChain,
      explorer: d.explorer,
      layerZeroEid: d.layerZeroEid,
      finalityPolicy: d.finalityPolicy,
      contracts: {
        status: 'deployed',
        addresses: checksumValues(d.contracts),
        abiVersion: d.abiVersion,
        deploymentBlock: d.deploymentBlock,
        implementationCodehashes: checksumKeys(d.implementationCodehashes),
      },
      kernel7702Implementation: getAddress(d.kernel7702Implementation),
      kernel7702Codehash: d.kernel7702Codehash,
      nativeUsdFeed: d.nativeUsdFeed ? getAddress(d.nativeUsdFeed) : null,
      eip7702TxType: '0x04',
      authorizationPolicy: 'chain-specific',
      gasPaymentPolicy: 'user-pays-native',
      rpc: transport.rpc,
      subgraphEndpoint: transport.subgraphEndpoint,
      features: d.features,
    },
  };
}

/** Client entry: the null transport is produced here, not passed by a caller, so a browser
 *  build can never carry an RPC endpoint or subgraph URL (wallet-provider reads only, §14). */
function assembleClientConfig(chainId: number, viemChain: Chain, d: Deployment): ResolvedChain {
  return assembleDeployedConfig(chainId, viemChain, d, { rpc: null, subgraphEndpoint: null });
}

/** Undeployed mainnet shape: no ENV dependence, so both paths share this literal verbatim. */
function assembleUndeployedConfig(
  chainId: number,
  viemChain: Chain,
  meta: MainnetEntry,
): ResolvedChain {
  return {
    status: 'ok',
    config: {
      chainId,
      environment: 'mainnet',
      viemChain,
      explorer: meta.explorer,
      layerZeroEid: meta.layerZeroEid,
      finalityPolicy: null,
      contracts: { status: 'undeployed' },
      kernel7702Implementation: meta.kernel7702Implementation,
      kernel7702Codehash: meta.kernel7702Codehash,
      nativeUsdFeed: null,
      eip7702TxType: '0x04',
      authorizationPolicy: 'chain-specific',
      gasPaymentPolicy: 'user-pays-native',
      rpc: null,
      subgraphEndpoint: null,
      features: [],
    },
  };
}

/**
 * Client-safe chain resolution (browser-safe): deployment addresses + kernel + viemChain
 * only, no ENV lookup. Wallet-provider reads/sends use this; server RPC stays on
 * resolveOutrunChain/getChainConfig with fail-closed RPC gating.
 */
export function resolveClientChain(chainId: number): ResolvedChain {
  const entry = REGISTRY.get(chainId);
  if (!entry) return { status: 'not-configured', reason: `unknown chainId ${chainId}` };
  if (entry.kind === 'undeployed') {
    // Undeployed mainnet entries carry no ENV dependence — same shape as the server path.
    const parsed = undeployedEntrySchema.safeParse(entry.meta);
    if (!parsed.success || parsed.data.chainId !== entry.viemChain.id) {
      return { status: 'not-configured', reason: `mainnet ${chainId} entry rejected` };
    }
    return assembleUndeployedConfig(chainId, entry.viemChain, parsed.data);
  }
  const parsed = parseDeployment(entry.deployment, chainId);
  if (!parsed.ok) return { status: 'not-configured', reason: parsed.reason };
  const d = parsed.data;
  if (d.chainId !== entry.viemChain.id) {
    return { status: 'not-configured', reason: `chainId ${chainId} mismatches viem chain` };
  }
  return assembleClientConfig(chainId, entry.viemChain, d);
}

const clientResolvedCache = new Map<number, ResolvedChain>();

/** Cached client-safe resolution (browser + unit-test safe, no ENV dependence). */
export function getClientChainConfig(chainId: number): ResolvedChain {
  let r = clientResolvedCache.get(chainId);
  if (!r) {
    r = resolveClientChain(chainId);
    clientResolvedCache.set(chainId, r);
  }
  return r;
}

// lib/web3 chain registry contract tests (stage 5 step 2):
// - six-chain config snapshot: three testnets deployed from deployments/*.json with resolved RPC
//   endpoints, three mainnets structurally undeployed (zero addresses must not appear anywhere)
// - bad configs fail closed to not-configured (missing field / wrong chainId / zero address /
//   wrong tx type)
// - ${VAR} ENV placeholder resolution: deployed chains require RPC envs; a missing subgraph env
//   only nulls subgraphEndpoint (RPC keeps working)
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  CHAIN_IDS,
  MAINNET_CHAIN_IDS,
  TESTNET_CHAIN_IDS,
  parseDeployment,
  resolveOutrunChain,
  verseExecutionChains,
  verseSwitchChainId,
  type EnvLookup,
  type OutrunChainConfig,
} from '../../../lib/web3/chains';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const rawDeployment = (id: number) =>
  JSON.parse(readFileSync(join(repo, 'deployments', `${id}.json`), 'utf8'));

const FULL_ENV = {
  ALCHEMY_KEY_ARB_SEPOLIA: 'alchemy-arb',
  INFURA_KEY_ARB_SEPOLIA: 'infura-arb',
  ALCHEMY_KEY_BASE_SEPOLIA: 'alchemy-base',
  INFURA_KEY_BASE_SEPOLIA: 'infura-base',
  ALCHEMY_KEY_BSC_TESTNET: 'alchemy-bsc',
  INFURA_KEY_BSC_TESTNET: 'infura-bsc',
  SUBGRAPH_ENDPOINT_ARB_SEPOLIA: 'https://api.thegraph.com/deployments/id/arb',
  SUBGRAPH_ENDPOINT_BASE_SEPOLIA: 'https://api.thegraph.com/deployments/id/base',
  SUBGRAPH_ENDPOINT_BSC_TESTNET: 'https://api.thegraph.com/deployments/id/bsc',
};
const RPC_ENV = {
  ALCHEMY_KEY_ARB_SEPOLIA: FULL_ENV.ALCHEMY_KEY_ARB_SEPOLIA,
  INFURA_KEY_ARB_SEPOLIA: FULL_ENV.INFURA_KEY_ARB_SEPOLIA,
  ALCHEMY_KEY_BASE_SEPOLIA: FULL_ENV.ALCHEMY_KEY_BASE_SEPOLIA,
  INFURA_KEY_BASE_SEPOLIA: FULL_ENV.INFURA_KEY_BASE_SEPOLIA,
  ALCHEMY_KEY_BSC_TESTNET: FULL_ENV.ALCHEMY_KEY_BSC_TESTNET,
  INFURA_KEY_BSC_TESTNET: FULL_ENV.INFURA_KEY_BSC_TESTNET,
};

const okConfig = (chainId: number, env: EnvLookup = FULL_ENV): OutrunChainConfig => {
  const r = resolveOutrunChain(chainId, env);
  if (r.status !== 'ok')
    throw new Error(`chain ${chainId} unexpectedly not-configured: ${r.reason}`);
  return r.config;
};

describe('six-chain registry snapshot', () => {
  it('covers exactly the six §5 chains', () => {
    expect([...CHAIN_IDS].sort((a, b) => a - b)).toEqual([1, 56, 97, 8453, 84532, 421614]);
    expect([...TESTNET_CHAIN_IDS].sort((a, b) => a - b)).toEqual([97, 84532, 421614]);
    expect([...MAINNET_CHAIN_IDS].sort((a, b) => a - b)).toEqual([1, 56, 8453]);
  });

  it('resolves the three testnets as deployed with §5 field values', () => {
    const arb = okConfig(421614);
    expect(arb.environment).toBe('testnet');
    expect(arb.viemChain.id).toBe(421614);
    expect(arb.explorer).toBe('https://sepolia.arbiscan.io');
    expect(arb.layerZeroEid).toBe(40231);
    expect(arb.finalityPolicy).toEqual({ safeBlockLag: 24 });
    expect(arb.contracts).toMatchObject({
      status: 'deployed',
      abiVersion: 'v1-rc2',
      deploymentBlock: 318640845,
    });
    expect(
      Object.keys(arb.contracts.status === 'deployed' ? arb.contracts.addresses : {}),
    ).toHaveLength(38);
    expect(arb.eip7702TxType).toBe('0x04');
    expect(arb.authorizationPolicy).toBe('chain-specific');
    expect(arb.gasPaymentPolicy).toBe('user-pays-native');
    expect(arb.kernel7702Implementation).toBe('0xd6CEDDe84be40893d153Be9d467CD6aD37875b28');
    expect(arb.kernel7702Codehash).toBe(
      '0xbf56eb9abfca858cf7aef8c86b97b93fe776547de7793b0dc25d801ae26fc9ac',
    );
    expect(arb.rpc).toEqual({
      primary: 'https://arb-sepolia.g.alchemy.com/v2/alchemy-arb',
      fallback: 'https://arbitrum-sepolia.infura.io/v3/infura-arb',
    });
    expect(arb.subgraphEndpoint).toBe('https://api.thegraph.com/deployments/id/arb');
    expect(arb.features).toHaveLength(13);

    const bscChain = okConfig(97);
    expect(
      Object.keys(bscChain.contracts.status === 'deployed' ? bscChain.contracts.addresses : {}),
    ).toHaveLength(40);
    expect(bscChain.finalityPolicy).toEqual({ safeBlockLag: 15 });

    const baseChain = okConfig(84532);
    expect(
      Object.keys(baseChain.contracts.status === 'deployed' ? baseChain.contracts.addresses : {}),
    ).toHaveLength(40);
    expect(baseChain.finalityPolicy).toEqual({ safeBlockLag: 12 });
  });

  it('resolves the three mainnets as structurally undeployed with no zero addresses', () => {
    const expected = new Map([
      [
        1,
        {
          explorer: 'https://etherscan.io',
          eid: 30101,
          codehash: '0xd748c6060679ccb34583963e5edc21299e4c6723e7c7a80561d255861ed209b7',
        },
      ],
      [
        8453,
        {
          explorer: 'https://basescan.org',
          eid: 30184,
          codehash: '0xe5b56d82025d2358308f77833fe29c3856b1a7a0f7a4b9f86b1fd77da3e3b4fb',
        },
      ],
      [
        56,
        {
          explorer: 'https://bscscan.com',
          eid: 30102,
          codehash: '0xcad500ade34248a6e7e84f6594cbbe31391fa26910527c9d131e39e42e75cc63',
        },
      ],
    ] as Array<[number, { explorer: string; eid: number; codehash: string }]>);
    for (const [id, e] of expected) {
      const c = okConfig(id);
      expect(c.environment, `chain ${id}`).toBe('mainnet');
      expect(c.contracts).toEqual({ status: 'undeployed' });
      expect(c.viemChain.id).toBe(id);
      expect(c.explorer).toBe(e.explorer);
      expect(c.layerZeroEid).toBe(e.eid);
      expect(c.finalityPolicy).toBeNull();
      expect(c.rpc).toBeNull();
      expect(c.subgraphEndpoint).toBeNull();
      expect(c.features).toEqual([]);
      expect(c.kernel7702Codehash).toBe(e.codehash);
      expect(c.kernel7702Implementation).toBe('0xd6CEDDe84be40893d153Be9d467CD6aD37875b28');
      expect(c.eip7702TxType).toBe('0x04');
      // the zero address must not appear in any shape (Permit2's leading zeros are fine)
      expect(JSON.stringify(c)).not.toContain('0x0000000000000000000000000000000000000000');
    }
  });
});

describe('bad configs fail closed to not-configured', () => {
  const cases: Array<[string, (raw: Record<string, unknown>) => void]> = [
    ['missing explorer', (raw) => delete raw.explorer],
    [
      'missing finalityPolicy.safeBlockLag',
      (raw) => delete (raw.finalityPolicy as Record<string, unknown>).safeBlockLag,
    ],
    ['wrong chainId', (raw) => (raw.chainId = 999)],
    [
      'zero contract address',
      (raw) =>
        ((raw.contracts as Record<string, string>).MemeverseLauncher =
          '0x0000000000000000000000000000000000000000'),
    ],
    [
      'bad address format',
      (raw) => ((raw.contracts as Record<string, string>).MemeverseLauncher = '0x123'),
    ],
    ['wrong eip7702TxType', (raw) => (raw.eip7702TxType = '0x02')],
    ['bad kernel codehash length', (raw) => (raw.kernel7702Codehash = '0xabc')],
    ['empty contract record', (raw) => (raw.contracts = {})],
    ['negative deploymentBlock', (raw) => (raw.deploymentBlock = -1)],
  ];
  for (const [name, mutate] of cases) {
    it(`rejects ${name}`, () => {
      const raw = rawDeployment(421614);
      mutate(raw);
      const r = parseDeployment(raw, 421614);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toContain('rejected');
    });
  }

  it('unknown chainId resolves to not-configured', () => {
    const r = resolveOutrunChain(31337, FULL_ENV);
    expect(r).toMatchObject({ status: 'not-configured' });
  });
});

describe('ENV placeholder resolution', () => {
  it('fails closed when a deployed chain lacks RPC env', () => {
    const r = resolveOutrunChain(421614, {});
    expect(r.status).toBe('not-configured');
    if (r.status === 'not-configured') {
      expect(r.reason).toContain('ALCHEMY_KEY_ARB_SEPOLIA');
      expect(r.reason).toContain('INFURA_KEY_ARB_SEPOLIA');
    }
  });

  it('nulls only the subgraph endpoint when its env is missing (RPC keeps working)', () => {
    const c = okConfig(84532, RPC_ENV);
    expect(c.rpc?.primary).toBe('https://base-sepolia.g.alchemy.com/v2/alchemy-base');
    expect(c.subgraphEndpoint).toBeNull();
  });

  it('resolves all three testnets against the full env', () => {
    for (const id of TESTNET_CHAIN_IDS) {
      const c = okConfig(id);
      expect(c.rpc).not.toBeNull();
      expect(c.subgraphEndpoint).toMatch(/^https:\/\/api\.thegraph\.com\//);
    }
  });
});

// Participation gate semantics: the executable set is the landed set (chains whose subgraph
// holds the verse), never the registration request. The switch target prefers the governance
// chain but must fall back to a chain that actually landed.
describe('verse execution chains', () => {
  it('uses the landed set and prefers the landed governance chain', () => {
    expect(verseExecutionChains(97, [421614, 84532, 97])).toEqual([97, 84532, 421614]);
    expect(verseSwitchChainId(97, [421614, 84532, 97])).toBe(97);
  });

  it('sorts the landed set so the fallback target cannot depend on caller order', () => {
    expect(verseExecutionChains(97, [84532, 421614])).toEqual([84532, 421614]);
    expect(verseSwitchChainId(97, [84532, 421614])).toBe(84532);
  });

  it('falls back to the first landed chain when the governance chain never landed', () => {
    expect(verseSwitchChainId(97, [421614, 84532])).toBe(84532);
  });

  it('maps mainnet ids inside the landed set, not only the governance id', () => {
    expect(verseExecutionChains(97, [8453, 1])).toEqual([84532, 421614]);
    expect(verseSwitchChainId(97, [8453, 1])).toBe(84532);
  });

  it('maps a mainnet governance id to its testnet twin and dedupes', () => {
    expect(verseExecutionChains(56, [97, 97, 84532])).toEqual([97, 84532]);
    expect(verseSwitchChainId(56, [97, 97, 84532])).toBe(97);
    expect(verseSwitchChainId(56, [421614, 84532])).toBe(84532);
  });

  it('keeps the governance chain when the source carries no presence data (fixture)', () => {
    expect(verseExecutionChains(1, null)).toEqual([421614]);
    expect(verseSwitchChainId(1, null)).toBe(421614);
  });

  it('treats an empty landed set like no data instead of allowing nothing', () => {
    expect(verseExecutionChains(8453, [])).toEqual([84532]);
    expect(verseSwitchChainId(8453, [])).toBe(84532);
  });
});

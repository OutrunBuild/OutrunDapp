#!/usr/bin/env node
// generate-deployment-artifacts.mjs — assemble contracts/abi/v1-rc/manifest.json and
// deployments/{421614,84532,97}.json from:
//   /tmp/outrun-deploy-full.json      address-keyed chain reads (tx/block/codehash/impl)
//   /tmp/outrun-abi-sha256.txt        per-ABI-file sha256 lines from export-abi.mjs
// then validate both through scripts/deployment-schema.mjs (fail-closed, nothing is
// written unless the schemas pass). Chain set: 421614/84532/97.
// Regen procedure: rerun the frozen-worktree export, the chain sweeps, then this script —
// do not hand-edit the artifacts.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chainConfigSchema, manifestSchema, toChecksumAddress } from './deployment-schema.mjs';

const REPO = new URL('.', import.meta.url).pathname + '../';
const full = JSON.parse(readFileSync('/tmp/outrun-deploy-full.json', 'utf8'));

const COMMITS = {
  memeverse: 'f07e068120a815762f80de6898ff074edab27da8',
  outstake: '2c033a89a247013d76482af2bd10ec2670b0647f',
  kernel: 'cd697c7e21715d015e0643af22310a99aa17433b',
};
const KERNEL = {
  implementation: toChecksumAddress('0xd6cedde84be40893d153be9d467cd6ad37875b28'),
  // Measured via public RPCs (bsc-testnet-rpc.publicnode.com, sepolia.base.org,
  // sepolia-rollup.arbitrum.io/rpc).
  codehash: {
    97: '0x5143969744cb305cedc9748f191ce11fb77fab00ae1e08f8d3beeeb0219239bd',
    84532: '0x0b7b78a4c39a523ebfc23394a547dffd0b9eb0276740e8ce59b6b87287ded3af',
    421614: '0xbf56eb9abfca858cf7aef8c86b97b93fe776547de7793b0dc25d801ae26fc9ac',
  },
  observedBlock: { 97: null, 84532: null, 421614: 318790661 },
};
const CHAINS = [
  {
    id: 421614,
    env: 'ARB_SEPOLIA',
    explorer: 'https://sepolia.arbiscan.io',
    layerZeroEid: 40231, // ARBITRUM_SEPOLIA_EID from deployment .env
    safeBlockLag: 24, // v1-rc engineering default (rollup); tunable
    alchemyHost: 'arb-sepolia.g.alchemy.com',
    infuraHost: 'arbitrum-sepolia.infura.io',
  },
  {
    id: 84532,
    env: 'BASE_SEPOLIA',
    explorer: 'https://sepolia.basescan.org',
    layerZeroEid: 40245, // BASE_SEPOLIA_EID from deployment .env
    safeBlockLag: 12, // v1-rc engineering default (rollup); tunable
    alchemyHost: 'base-sepolia.g.alchemy.com',
    infuraHost: 'base-sepolia.infura.io',
  },
  {
    id: 97,
    env: 'BSC_TESTNET',
    explorer: 'https://testnet.bscscan.com',
    layerZeroEid: 40102, // BSC_TESTNET_EID from deployment .env
    safeBlockLag: 15, // v1-rc engineering default; tunable
    alchemyHost: 'bnb-testnet.g.alchemy.com',
    infuraHost: 'bsc-testnet.infura.io',
  },
];
const FEATURES = [
  'swap',
  'genesis',
  'preorder',
  'pol',
  'vault',
  'dao',
  'referral',
  'faucet',
  'psm',
  'usr',
  'cdp',
  'bridge',
  'crossChainStaking',
];
// Permit2 address comes from deployment truth, not memory: every deployed
// MemeverseSwapRouter's `permit2()` immutable (read on-chain, three chains) equals the
// frozen script's CANONICAL_PERMIT2 constant. Empirically that address is the genuine
// Uniswap Permit2 canonical singleton — same address, live (9152 bytes) on Ethereum
// mainnet and all three testnets; Sourcify-verified against official Uniswap source
// (solc 0.8.17, optimizer 1000000 — Uniswap's own build config). Per-chain runtime
// codehash differs BY DESIGN: Permit2's DOMAIN_SEPARATOR immutable hashes chainId.
const PERMIT2 = toChecksumAddress('0x000000000022d473030f116ddee9f6b43ac78ba3');
// Bytecode differs per chain (independently deployed instances); measured
// via public RPCs, same sweep as the other codehashes.
const PERMIT2_CODEHASH = {
  97: '0xc9fc98683a624e287416c3560ef5f91675fa759668a377d4ce0adc080f315f3d',
  84532: '0xdcde65555316946c298e4c60c6213eb5c3aeab4354d1f3fac5427236bcbb9ebe',
  421614: '0x055d90ff6146107f315c7c306b841138ec59c541a8e4e04df787c38ce400a1e4',
};
const POOL_MANAGER = {
  97: toChecksumAddress('0xee88a92d87ed2e037a0c2f1bed6bab49e375be0c'), // self-deployed (poolmanager batch)
  84532: toChecksumAddress('0x05e73354cfdd6745c338b50bcfdfa3aa6fa03408'), // official
  421614: toChecksumAddress('0xfb3e0c6f74eb1a21cc1da29aec80d2dfe6c9a317'), // official
};

// ABI-file sha256 lines: "sha256 <hash>  <path>"
const abis = {};
for (const line of readFileSync('/tmp/outrun-abi-sha256.txt', 'utf8').split('\n')) {
  const m = line.match(/^sha256 ([0-9a-f]{64})\s+(\S+)$/);
  if (m) {
    const name = m[2]
      .split('/')
      .pop()
      .replace(/\.json$/, '');
    abis[name] = m[1];
  }
}

function row(chain, displayName) {
  const hit = full[String(chain)].find((e) => e.name === displayName);
  if (!hit) throw new Error(`deploy-full row not found: ${chain} ${displayName}`);
  return hit;
}
function deployedEntry({ abi, row, status = 'deployed', note }) {
  return {
    abi,
    address: toChecksumAddress(row.address),
    status,
    ...(row.implementation ? { implementation: toChecksumAddress(row.implementation) } : {}),
    ...(row.tx ? { deploymentTx: row.tx } : {}),
    ...(row.block != null ? { deploymentBlock: parseInt(row.block, 16) } : {}),
    ...(row.codehash ? { runtimeCodehash: row.codehash } : {}),
    ...(note ? { note } : {}),
  };
}
function undeployedEntry(abi, note) {
  return { abi, address: null, status: 'undeployed', note };
}
function dynamicEntry({ abi, row, note }) {
  return {
    abi,
    address: null,
    status: 'dynamic',
    implementation: toChecksumAddress(row.address),
    ...(row.tx ? { deploymentTx: row.tx } : {}),
    ...(row.block != null ? { deploymentBlock: parseInt(row.block, 16) } : {}),
    ...(row.codehash ? { runtimeCodehash: row.codehash } : {}),
    note: note ?? 'per-verse instances are deployed at runtime via MemeverseProxyDeployer',
  };
}
function instancesEntry({ abi, instances, note }) {
  return {
    abi,
    address: null,
    status: 'deployed',
    instances: Object.fromEntries(
      Object.entries(instances).map(([k, r]) => [
        k,
        {
          address: toChecksumAddress(r.address),
          ...(r.implementation ? { implementation: toChecksumAddress(r.implementation) } : {}),
          ...(r.tx ? { deploymentTx: r.tx } : {}),
          ...(r.block != null ? { deploymentBlock: parseInt(r.block, 16) } : {}),
          ...(r.codehash ? { runtimeCodehash: r.codehash } : {}),
        },
      ]),
    ),
    ...(note ? { note } : {}),
  };
}

// Per-chain contract maps. Keys = canonical manifest names.
function manifestContracts(chain) {
  const isBsc = chain === 97;
  const isBase = chain === 84532;
  const c = {
    MemeverseLauncher: deployedEntry({
      abi: 'MemeverseLauncherUpgradeable',
      row: row(chain, 'MemeverseLauncher'),
    }),
    MemeverseRegistrarOmnichain: isBsc
      ? undeployedEntry(
          'MemeverseRegistrarOmnichain',
          'center chain (97) uses MemeverseRegistrarAtLocal; user entry there is MemeverseRegistrationCenter',
        )
      : deployedEntry({
          abi: 'MemeverseRegistrarOmnichain',
          row: row(chain, 'MemeverseRegistrarAtLocal'),
          note: 'same CREATE3 address hosts the Omnichain registrar form on remote chains',
        }),
    MemeverseFeePreviewReader: deployedEntry({
      abi: 'MemeverseFeePreviewReader',
      row: row(chain, 'MemeverseFeePreviewReader'),
    }),
    POLend: deployedEntry({ abi: 'POLendUpgradeable', row: row(chain, 'POLend') }),
    POLSplitter: deployedEntry({ abi: 'POLSplitterUpgradeable', row: row(chain, 'POLSplitter') }),
    MemeverseSwapRouter: deployedEntry({
      abi: 'MemeverseSwapRouter',
      row: row(chain, 'MemeverseSwapRouter'),
    }),
    MemeverseYTFlashSwapRouter: deployedEntry({
      abi: 'MemeverseYTFlashSwapRouter',
      row: row(chain, 'MemeverseYTFlashSwapRouter'),
    }),
    MemeverseUniswapHookLens: deployedEntry({
      abi: 'MemeverseUniswapHookLens',
      row: row(chain, 'MemeverseUniswapHookLens'),
    }),
    MemeverseUniswapHook: deployedEntry({
      abi: 'MemeverseUniswapHookUpgradeable',
      row: row(chain, 'MemeverseUniswapHook'),
    }),
    Permit2: {
      abi: 'Permit2',
      address: PERMIT2,
      status: 'deployed',
      runtimeCodehash: PERMIT2_CODEHASH[chain],
      note: 'address = MemeverseSwapRouter.permit2() immutable on all three chains (frozen script CANONICAL_PERMIT2); Uniswap canonical Permit2 singleton — same address live on Ethereum mainnet; per-chain codehash differs by design (chainId inside the DOMAIN_SEPARATOR immutable)',
    },
    Memecoin: dynamicEntry({ abi: 'Memecoin', row: row(chain, 'Memecoin') }),
    MemePol: dynamicEntry({ abi: 'MemePol', row: row(chain, 'MemePol') }),
    UniswapLP: dynamicEntry({ abi: 'UniswapLP', row: row(chain, 'UniswapLP') }),
    MemecoinYieldVault: dynamicEntry({
      abi: 'MemecoinYieldVault',
      row: row(chain, 'MemecoinYieldVault'),
    }),
    MemecoinDaoGovernor: dynamicEntry({
      abi: 'MemecoinDaoGovernorUpgradeable',
      row: row(chain, 'MemecoinDaoGovernorUpgradeable'),
    }),
    GovernanceCycleIncentivizer: dynamicEntry({
      abi: 'GovernanceCycleIncentivizerUpgradeable',
      row: row(chain, 'GovernanceCycleIncentivizerUpgradeable'),
    }),
    PrincipalToken: deployedEntry({
      abi: 'PrincipalToken',
      row: row(chain, 'PrincipalToken'),
      note: 'genesis-pair instance; per-verse pairs deploy dynamically via POLSplitter',
    }),
    YieldToken: deployedEntry({
      abi: 'YieldToken',
      row: row(chain, 'YieldToken'),
      note: 'genesis-pair instance; per-verse pairs deploy dynamically via POLSplitter',
    }),
    OmnichainMemecoinStaker: deployedEntry({
      abi: 'OmnichainMemecoinStakerUpgradeable',
      row: row(chain, 'OmnichainMemecoinStaker'),
    }),
    MemeverseOmnichainInteroperation: deployedEntry({
      abi: 'MemeverseOmnichainInteroperation',
      row: row(chain, 'MemeverseOmnichainInteroperation'),
    }),
    OutrunRouter: deployedEntry({ abi: 'OutrunRouter', row: row(chain, 'OutrunRouter') }),
    OutrunStakingPosition: instancesEntry({
      abi: 'OutrunStakingPositionUpgradeable',
      instances: Object.fromEntries(
        full[String(chain)]
          .filter((e) => e.name.startsWith('OutrunStakingPosition ('))
          .map((e) => [e.name.slice(e.name.indexOf('(') + 1, -1), e]),
      ),
    }),
    OutrunPSM: instancesEntry({
      abi: 'OutrunPSMUpgradeable',
      instances: Object.fromEntries(
        full[String(chain)]
          .filter((e) => e.name.startsWith('OutrunPSM ('))
          .map((e) => [e.name.slice(e.name.indexOf('(') + 1, -1), e]),
      ),
    }),
    OutrunUSRVault: instancesEntry({
      abi: 'OutrunUSRVaultUpgradeable',
      instances: Object.fromEntries(
        full[String(chain)]
          .filter((e) => e.name.startsWith('OutrunUSRVault ('))
          .map((e) => [e.name.slice(e.name.indexOf('(') + 1, -1), e]),
      ),
    }),
    UAsset: instancesEntry({
      abi: 'OutrunUniversalAssetsUpgradeable',
      instances: {
        UETH: row(chain, 'UETH'),
        UUSD: row(chain, 'UUSD'),
        UBNB: row(chain, 'UBNB'),
      },
    }),
    Faucet: deployedEntry({ abi: 'Faucet', row: row(chain, 'Faucet') }),
    MockUSDC: deployedEntry({ abi: 'MockUSDC', row: row(chain, 'MockUSDC') }),
    MockSUSDS: deployedEntry({ abi: 'MockSUSDS', row: row(chain, 'MockSUSDS') }),
    MockAUSDC: deployedEntry({ abi: 'MockAUSDC', row: row(chain, 'MockAUSDC') }),
    MockOutrunAUSDCSY: deployedEntry({
      abi: 'MockOutrunAUSDCSYUpgradeable',
      row: row(chain, 'MockOutrunAUSDCSY'),
    }),
    MockOutrunSUSDSSY: deployedEntry({
      abi: 'MockOutrunSUSDSSYUpgradeable',
      row: row(chain, 'MockOutrunSUSDSSY'),
    }),
    OutrunWstETHSY: undeployedEntry(
      'OutrunWstETHSYUpgradeable',
      'Sepolia-targeted batch; chain not in the testnet set (421614/84532/97)',
    ),
    OutrunStakedUSDeSY: undeployedEntry(
      'OutrunStakedUSDeSYUpgradeable',
      'Sepolia-targeted batch; chain not in the testnet set (421614/84532/97)',
    ),
    OutrunSlisBNBSY: isBsc
      ? deployedEntry({ abi: 'OutrunSlisBNBSYUpgradeable', row: row(chain, 'OutrunSlisBNBSY') })
      : undeployedEntry('OutrunSlisBNBSYUpgradeable', 'BSC Testnet only'),
    OutrunAaveV3SY: isBase
      ? deployedEntry({ abi: 'OutrunAaveV3SYUpgradeable', row: row(chain, 'OutrunAaveV3SY') })
      : undeployedEntry('OutrunAaveV3SYUpgradeable', 'Base Sepolia only'),
  };
  if (isBsc) {
    c.MemeverseRegistrationCenter = deployedEntry({
      abi: 'MemeverseRegistrationCenterUpgradeable',
      row: row(chain, 'MemeverseRegistrationCenter'),
    });
  }
  // GenesisCreditRegistry and the credit trio live on ALL three chains (CREATE3
  // same address everywhere): BSC is the claim home chain (merkle minting is
  // homeChainEid-gated), Base/Arb instances are OFT bridge endpoints only.
  c.GenesisCreditRegistry = deployedEntry({
    abi: 'GenesisCredit',
    row: row(chain, 'GenesisCreditRegistry'),
    note: 'registry dispenses per-verse GenesisCredit credits (home chain = BSC Testnet per GENESIS_CREDIT_HOME_EID); abi field points at the credit token ABI — the registry itself is not a frontend call target',
  });
  c.GenesisCredit = instancesEntry({
    abi: 'GenesisCredit',
    instances: {
      UETH: row(chain, 'cUETH'),
      UUSD: row(chain, 'cUUSD'),
      UBNB: row(chain, 'cUBNB'),
    },
    note: "this generation's credit trio, dispensed via Faucet claimHeld",
  });
  return c;
}

const manifest = {
  abiVersion: 'v1-rc',
  memeverseCommit: COMMITS.memeverse,
  outstakeCommit: COMMITS.outstake,
  kernelTagCommit: COMMITS.kernel,
  abis,
  chains: Object.fromEntries(
    CHAINS.map(({ id }) => [
      String(id),
      {
        kernel7702: {
          implementation: KERNEL.implementation,
          runtimeCodehash: KERNEL.codehash[id],
          observedBlock: KERNEL.observedBlock[id],
        },
        contracts: manifestContracts(id),
      },
    ]),
  ),
};
manifestSchema.parse(manifest);

for (const { id, env, explorer, layerZeroEid, safeBlockLag, alchemyHost, infuraHost } of CHAINS) {
  const contracts = {};
  const mc = manifest.chains[String(id)].contracts;
  for (const [name, entry] of Object.entries(mc)) {
    if (entry.status === 'deployed') {
      if (entry.instances) {
        for (const [k, detail] of Object.entries(entry.instances))
          contracts[`${name}.${k}`] = detail.address;
      } else {
        contracts[name] = entry.address;
      }
    }
  }
  // Trusted infra beyond the ABI list: pool manager + credit factory.
  contracts.UniswapV4PoolManager = POOL_MANAGER[id];

  // Keyed by checksummed implementation address: raw impl rows share names across
  // instances (three rows all named OutrunPSMUpgradeable), a name key would collide.
  // Membership is derived from the manifest's own implementation records (single source):
  // singleton impls + instance impls + dynamic templates.
  const rowByAddress = new Map(full[String(id)].map((e) => [e.address.toLowerCase(), e]));
  const implementationCodehashes = {};
  const collectImpl = (label, impl) => {
    const r = rowByAddress.get(impl.toLowerCase());
    if (!r?.codehash) throw new Error(`implementation row without codehash: ${label} ${impl}`);
    implementationCodehashes[toChecksumAddress(impl)] = r.codehash;
  };
  for (const [name, entry] of Object.entries(mc)) {
    if (entry.implementation) collectImpl(name, entry.implementation);
    if (entry.status === 'dynamic' && entry.address) collectImpl(name, entry.address);
    for (const [inst, detail] of Object.entries(entry.instances ?? {})) {
      if (detail.implementation) collectImpl(`${name}.${inst}`, detail.implementation);
    }
  }

  const deploymentBlock = Math.min(
    ...full[String(id)].map((e) => parseInt(e.block, 16)).filter((b) => Number.isInteger(b)),
  );

  const config = {
    chainId: id,
    environment: 'testnet',
    rpc: {
      primary: `https://${alchemyHost}/v2/\${ALCHEMY_KEY_${env}}`,
      fallback: `https://${infuraHost}/v3/\${INFURA_KEY_${env}}`,
    },
    explorer,
    layerZeroEid,
    finalityPolicy: { safeBlockLag },
    contracts,
    deploymentBlock,
    abiVersion: 'v1-rc',
    implementationCodehashes,
    kernel7702Implementation: KERNEL.implementation,
    kernel7702Codehash: KERNEL.codehash[id],
    eip7702TxType: '0x04',
    authorizationPolicy: 'chain-specific',
    gasPaymentPolicy: 'user-pays-native',
    subgraphEndpoint: `\${SUBGRAPH_ENDPOINT_${env}}`,
    features: FEATURES,
  };
  chainConfigSchema.parse(config);
  writeFileSync(join(REPO, 'deployments', `${id}.json`), JSON.stringify(config, null, 2) + '\n');
}

writeFileSync(
  join(REPO, 'contracts/abi/v1-rc/manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);
console.log(
  'wrote contracts/abi/v1-rc/manifest.json + deployments/{421614,84532,97}.json (schema-validated)',
);

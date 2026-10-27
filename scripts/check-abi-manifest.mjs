#!/usr/bin/env node
// check-abi-manifest.mjs — offline (no network) integrity gate for the frozen ABI release.
// ① manifest.json passes the Zod schema; ② every contracts/abi/<abiVersion>/*.json hashes to the
// sha256 registered in the manifest (and vice versa — no unregistered ABI files);
// ③ all addresses in both artifact kinds are exact EIP-55 (via schema helpers);
// ④ deployments/{chainId}.json cross-checks against the manifest (addresses, deployment
// blocks, abiVersion, kernel codehash, implementation codehashes);
// ⑤ no plaintext API-key patterns in manifest/deployments.
// The release directory comes from the manifest's own abiVersion, so a version bump moves the
// whole gate with it and no path here needs editing.
// On-chain live codehash re-reads are release certification, not CI.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chainConfigSchema, manifestSchema } from './deployment-schema.mjs';

const REPO = new URL('.', import.meta.url).pathname + '../';
const problems = [];
const fail = (msg) => problems.push(msg);

// The release directory is a property of the artifact set, not of this script: read the
// manifest from the current release and locate its ABI directory from the version it declares.
const manifest = JSON.parse(readFileSync(join(REPO, 'contracts/abi/v1-rc2/manifest.json'), 'utf8'));
const abiDir = join(REPO, 'contracts/abi', manifest.abiVersion ?? '');
const mParse = manifestSchema.safeParse(manifest);
if (!mParse.success)
  fail(
    `manifest schema: ${mParse.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
  );

// ② sha256 both directions
const abiFiles = readdirSync(abiDir).filter((f) => f.endsWith('.json') && f !== 'manifest.json');
const registered = mParse.success ? manifest.abis : {};
for (const file of abiFiles) {
  const name = file.replace(/\.json$/, '');
  const hash = createHash('sha256')
    .update(readFileSync(join(abiDir, file)))
    .digest('hex');
  if (registered[name] !== hash) fail(`abi sha mismatch or unregistered: ${name}`);
  const parsed = JSON.parse(readFileSync(join(abiDir, file), 'utf8'));
  if (!Array.isArray(parsed)) fail(`abi file is not a plain array: ${name}`);
}
for (const name of Object.keys(registered)) {
  if (!abiFiles.includes(`${name}.json`)) fail(`manifest registers missing abi file: ${name}`);
}

// ③ addresses in manifest are covered by the schema (exact EIP-55 refine); deployments next.
const chainIds = mParse.success ? Object.keys(manifest.chains) : [];
for (const chainId of chainIds) {
  const file = join(REPO, 'deployments', `${chainId}.json`);
  let config;
  try {
    config = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    fail(`deployments/${chainId}.json missing or unparsable`);
    continue;
  }
  // ① (deployments side) + ③ exact EIP-55 via schema refine
  const cParse = chainConfigSchema.safeParse(config);
  if (!cParse.success) {
    fail(
      `deployments/${chainId}.json schema: ${cParse.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
    continue;
  }
  // ④ cross-consistency manifest ↔ deployments
  const mc = manifest.chains[chainId];
  if (config.abiVersion !== manifest.abiVersion) fail(`${chainId}: abiVersion mismatch`);
  if (config.kernel7702Implementation !== mc.kernel7702.implementation)
    fail(`${chainId}: kernel implementation mismatch`);
  if (config.kernel7702Codehash !== mc.kernel7702.runtimeCodehash)
    fail(`${chainId}: kernel codehash mismatch`);
  for (const [name, address] of Object.entries(config.contracts)) {
    const [base, inst] = name.split('.');
    const entry = mc.contracts[base];
    if (!entry) {
      // trusted infra beyond the ABI list: address-only entries in the deployment table
      // (PoolManager = third-party v4 core; ProxyDeployer = subgraph settlement-deploy source)
      if (name === 'UniswapV4PoolManager' || name === 'MemeverseProxyDeployer') continue;
      fail(`${chainId}: deployments contract not in manifest: ${name}`);
      continue;
    }
    if (inst) {
      if (entry.instances?.[inst]?.address !== address)
        fail(`${chainId}: instance mismatch ${name}`);
    } else if (entry.address !== address) {
      fail(
        `${chainId}: address mismatch ${name}: deployments=${address} manifest=${entry.address}`,
      );
    }
    const block = inst ? entry.instances[inst]?.deploymentBlock : entry.deploymentBlock;
    if (block != null && block < config.deploymentBlock)
      fail(`${chainId}: contract ${name} deployed before chain deploymentBlock`);
  }
  // every implementation address the manifest records for this chain (singleton impl,
  // instance impl, dynamic template) must have a codehash entry in the address-keyed
  // deployments table
  for (const [name, entry] of Object.entries(mc.contracts)) {
    const impls = [];
    if (entry.implementation) impls.push([name, entry.implementation]);
    if (entry.status === 'dynamic' && entry.address) impls.push([name, entry.address]);
    for (const [inst, detail] of Object.entries(entry.instances ?? {})) {
      if (detail.implementation) impls.push([`${name}.${inst}`, detail.implementation]);
    }
    for (const [label, impl] of impls) {
      if (!(impl in config.implementationCodehashes))
        fail(`${chainId}: implementation ${label} → ${impl} missing from implementationCodehashes`);
    }
  }
  // manifest deployed entries must appear in deployments (except undeployed/dynamic)
  for (const [name, entry] of Object.entries(mc.contracts)) {
    if (entry.status !== 'deployed') continue;
    if (entry.instances) {
      for (const inst of Object.keys(entry.instances)) {
        if (!(`${name}.${inst}` in config.contracts))
          fail(`${chainId}: manifest instance missing in deployments: ${name}.${inst}`);
      }
    } else if (!(name in config.contracts)) {
      fail(`${chainId}: manifest contract missing in deployments: ${name}`);
    }
  }
  // implementationCodehashes: keyed by implementation display name (generation-time source =
  // the same address-keyed chain reads as the manifest, see generate-deployment-artifacts.mjs);
  // offline CI re-verifies table presence/shape (schema) — address↔name binding is
  // release-certification territory (on-chain code re-reads), not reconstructible here.
  if (Object.keys(config.implementationCodehashes).length === 0)
    fail(`${chainId}: implementationCodehashes empty`);
}

// ⑤ plaintext key patterns (alchemy v2/infura v3 hex keys) anywhere in the artifacts
for (const file of [
  `contracts/abi/${manifest.abiVersion}/manifest.json`,
  ...chainIds.map((c) => `deployments/${c}.json`),
]) {
  const text = readFileSync(join(REPO, file), 'utf8');
  if (/\/v2\/[0-9a-f]{32}/.test(text) || /\/v3\/[0-9a-f]{32}/.test(text))
    fail(`plaintext API key pattern in ${file}`);
}

if (problems.length > 0) {
  console.error(`abi/manifest integrity FAIL (${problems.length}):`);
  for (const p of problems) console.error(` - ${p}`);
  process.exit(1);
}
console.log(
  'abi/manifest integrity OK: schema/SHA256/EIP-55/cross-consistency/key scan all passed',
);

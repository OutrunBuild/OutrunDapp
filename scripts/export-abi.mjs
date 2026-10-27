#!/usr/bin/env node
// export-abi.mjs — extract plain ABI arrays from a frozen Foundry build output.
//
// Usage:
//   node scripts/export-abi.mjs --src <forge-out-dir> --list <abi-list.json> --repo <memeverse|outstake|kernel>
//
// - Walks --src for artifact JSONs (compatible with Foundry's per-source
//   `out/<dir>/<Contract>.json` layout and the flat `out/<Contract>.json` layout), takes the
//   top-level `abi` array.
// - Filters by the --repo key of the list file; names not in the list are skipped.
// - A listed name with no artifact fails the run (no silent misses).
// - Writes `contracts/abi/v1-rc/<Name>.json` (content = JSON.stringify(abi, null, 2) + "\n").
//   Names shared by two repos in the list file go to `contracts/abi/v1-rc/<repo>/<Name>.json`
//   with a stdout declaration; a flat-name collision at write time also falls back to the
//   repo subdirectory.
// - Prints one `sha256 <hash>  <path>` line per file (consumed by manifest generation).
// - `--version <v1-rc|v1-rc2>` selects the release directory (defaults to the current one).

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { CURRENT_ABI_VERSION } from './deployment-schema.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!key.startsWith('--')) throw new Error(`unexpected argument: ${key}`);
    args[key.slice(2)] = argv[i + 1];
  }
  for (const required of ['src', 'list', 'repo']) {
    if (!args[required]) throw new Error(`missing --${required}`);
  }
  return args;
}

function walkJsonFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walkJsonFiles(full));
    } else if (entry.endsWith('.json')) {
      out.push(full);
    }
  }
  return out;
}

const { src, list, repo, version } = parseArgs(process.argv.slice(2));
const abiVersion = version ?? CURRENT_ABI_VERSION;
const listData = JSON.parse(readFileSync(list, 'utf8'));
const names = listData[repo];
if (!Array.isArray(names) || names.length === 0) {
  throw new Error(`list file has no array for repo "${repo}"`);
}

const sharedNames = new Set(
  Object.entries(listData)
    .filter(([key]) => key !== repo)
    .flatMap(([, values]) => values)
    .filter((name) => names.includes(name)),
);

const srcDir = resolve(src);
if (!existsSync(srcDir)) throw new Error(`--src not found: ${srcDir}`);
const wanted = new Map(names.map((name) => [name, null]));

for (const file of walkJsonFiles(srcDir)) {
  const base = file.slice(0, -5).split('/').pop();
  if (!wanted.has(base)) continue;
  let artifact;
  try {
    artifact = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    continue; // non-JSON payload despite extension; forge writes some ancillary files
  }
  if (!Array.isArray(artifact.abi)) continue;
  if (wanted.get(base) === null) {
    wanted.set(base, { abi: artifact.abi, file });
  } else {
    // Same contract name from multiple source files: keep the first, note the duplicate.
    const kept = wanted.get(base);
    process.stderr.write(
      `warning: duplicate artifact for ${base}; keeping ${kept.file}, skipping ${file}\n`,
    );
  }
}

const missing = [...wanted.entries()].filter(([, v]) => v === null).map(([k]) => k);
if (missing.length > 0) {
  throw new Error(`artifacts not found under ${srcDir}: ${missing.join(', ')}`);
}

const outRoot = resolve(new URL('.', import.meta.url).pathname, `../contracts/abi/${abiVersion}`);
mkdirSync(outRoot, { recursive: true });

for (const [name, { abi }] of wanted) {
  let target = join(outRoot, `${name}.json`);
  if (sharedNames.has(name)) {
    target = join(outRoot, repo, `${name}.json`);
    console.log(`shared name across repos: ${name} -> ${relative(process.cwd(), target)}`);
  } else if (existsSync(target)) {
    target = join(outRoot, repo, `${name}.json`);
    console.log(`flat name collision fallback: ${name} -> ${relative(process.cwd(), target)}`);
  }
  mkdirSync(join(target, '..'), { recursive: true });
  const content = JSON.stringify(abi, null, 2) + '\n';
  writeFileSync(target, content);
  const hash = createHash('sha256').update(content).digest('hex');
  console.log(`sha256 ${hash}  ${relative(process.cwd(), target)}`);
}

#!/usr/bin/env node
// Root runtime checker. Modes:
//   --strict           local/CI: exact Node from .node-version, Corepack 0.34.5, pnpm 11.24.0
//   --vercel --require-package   Vercel: record actual node, require package.json engines
// No project deps are installed by this script (see bootstrap-pnpm.mjs).
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');
const vercel = args.has('--vercel');
const requirePackage = args.has('--require-package');
const problems = [];

const nodeVersion = process.version.slice(1);
const actualMajor = nodeVersion.split('.')[0];
const runtimeNote = { mode: vercel ? 'vercel' : 'local', node: nodeVersion };

if (existsSync('.node-version')) {
  const pinned = readFileSync('.node-version', 'utf8').trim();
  if (strict) {
    if (nodeVersion !== pinned)
      problems.push(`node ${nodeVersion} != pinned ${pinned} (.node-version)`);
  } else if (vercel) {
    if (actualMajor !== pinned.split('.')[0])
      problems.push(`vercel node major ${actualMajor} != pinned major ${pinned.split('.')[0]}`);
    console.log(
      `vercel node: ${nodeVersion} (pinned ${pinned}; platform rolls patches — recorded, not asserted)`,
    );
  }
} else {
  problems.push('.node-version missing');
}

function toolOk(cmd, argsArr, want) {
  try {
    const out = execFileSync(cmd, argsArr, { encoding: 'utf8' }).trim();
    const v = out.split(/\s+/).pop().replace(/^v/, '');
    if (want && !v.startsWith(want + '.') && v !== want) problems.push(`${cmd} ${v} != ${want}`);
    return v;
  } catch {
    problems.push(`${cmd} unavailable`);
    return null;
  }
}

const corepackV = toolOk('corepack', ['--version'], '0.34.5');
let pnpmV = null;
try {
  pnpmV = execFileSync('pnpm', ['--version'], { encoding: 'utf8' }).trim();
  if (!pnpmV.startsWith('11.24.')) problems.push(`pnpm ${pnpmV} != 11.24.x`);
} catch {
  if (!vercel)
    problems.push(
      'pnpm unavailable (run: corepack enable && corepack install --global pnpm@11.24.0)',
    );
}

if (requirePackage) {
  if (!existsSync('package.json')) problems.push('--require-package set but package.json missing');
  else {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    const e = pkg.engines || {};
    if (e.node !== '24.x') problems.push(`engines.node ${e.node} != 24.x`);
    if (e.pnpm !== '11.24.0') problems.push(`engines.pnpm ${e.pnpm} != 11.24.0`);
    if (pkg.packageManager !== 'pnpm@11.24.0')
      problems.push(`packageManager ${pkg.packageManager} != pnpm@11.24.0`);
  }
} else if (!existsSync('package.json')) {
  console.log('note: no frontend workspace yet — package checks deferred (no package.json yet)');
}

console.log(
  JSON.stringify(
    { ...runtimeNote, corepack: corepackV, pnpm: pnpmV, result: problems.length ? 'FAIL' : 'OK' },
    null,
    0,
  ),
);
if (problems.length) {
  for (const p of problems) console.error(' -', p);
  process.exit(1);
}

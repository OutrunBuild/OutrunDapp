#!/usr/bin/env node
// Vercel custom Install Command: install and verify
// Corepack 0.34.5 BEFORE touching the lockfile, activate pnpm 11.24.0, then
// frozen install. No project deps needed to run this script itself.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opts });

// --check-only: verify versions + lockfile sync without global installs
const checkOnly = process.argv.includes('--check-only');
const cv = execFileSync('corepack', ['--version'], { encoding: 'utf8' }).trim();
if (!cv.startsWith('0.34.5')) {
  if (checkOnly) {
    console.error(`corepack ${cv} != 0.34.5 (run without --check-only to install)`);
    process.exit(1);
  }
  // npm --ignore-scripts install of pinned corepack (pre-lockfile, no lifecycle scripts)
  run('npm', ['install', '--global', '--ignore-scripts', 'corepack@0.34.5']);
  const cv2 = execFileSync('corepack', ['--version'], { encoding: 'utf8' }).trim();
  if (!cv2.startsWith('0.34.5')) {
    console.error(`corepack ${cv2} != 0.34.5 after install`);
    process.exit(1);
  }
}

if (!checkOnly) {
  // activate pinned pnpm
  run('corepack', ['enable']);
  run('corepack', ['install', '--global', 'pnpm@11.24.0']);
}

// frozen install (requires lockfile; workspaces only)
if (existsSync('pnpm-lock.yaml')) {
  run('pnpm', ['install', '--frozen-lockfile']);
} else {
  console.log('no pnpm-lock.yaml yet — runtime bootstrap complete, install deferred');
}
console.log(`bootstrap ok: corepack ${cv}, node ${process.version}`);

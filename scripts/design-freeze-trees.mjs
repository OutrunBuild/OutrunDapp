// Single source of truth for the design-freeze tree scope, consumed by both
// scripts/write-design-artifact-manifest.mjs (writer) and
// scripts/check-design-freeze.mjs (gate) so the two walks cannot diverge.
// Skip rules: .DS_Store files and .mimosa dirs (plugin session state — the
// security hook writes them next to intercepted commands, they are not
// design artifacts).
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const TREES = [
  'DESIGN.md',
  'PRODUCT.md',
  '.node-version',
  '.prettierrc.json',
  '.prettierignore',
  'docs/design/brand',
  'docs/design/logo-variants',
  'docs/design/token-icons',
  'docs/design/decision-log.md',
  'scripts/design-freeze-trees.mjs',
  'scripts/write-design-artifact-manifest.mjs',
  'scripts/check-design-freeze.mjs',
  'scripts/check-runtime.mjs',
  'scripts/bootstrap-pnpm.mjs',
];

const SKIP_FILES = new Set(['.DS_Store']);
const SKIP_DIRS = new Set(['.mimosa']);

export function collectTreeFiles(root = process.cwd()) {
  const out = [];
  const walk = (rel) => {
    const abs = join(root, rel);
    if (statSync(abs).isFile()) {
      out.push(rel);
      return;
    }
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      if (SKIP_FILES.has(e.name) || (e.isDirectory() && SKIP_DIRS.has(e.name))) continue;
      walk(join(rel, e.name));
    }
  };
  for (const t of TREES) {
    if (existsSync(join(root, t))) walk(t);
  }
  return out;
}

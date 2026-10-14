#!/usr/bin/env node
// Write docs/design/final-artifacts.sha256 — the frozen manifest of
// every design artifact in the watched trees (tree scope and skip rules are
// shared with the gate via scripts/design-freeze-trees.mjs). The manifest file
// itself is always excluded from its own listing.
// Usage: node scripts/write-design-artifact-manifest.mjs --output <file> [--exclude <path>]...
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { collectTreeFiles } from './design-freeze-trees.mjs';

const args = process.argv.slice(2);
const outIdx = args.indexOf('--output');
const OUT = outIdx >= 0 ? args[outIdx + 1] : 'docs/design/final-artifacts.sha256';
const EXCLUDES = new Set(args.filter((_, i) => args[i - 1] === '--exclude'));

async function main() {
  const lines = [];
  let count = 0;
  for (const rel of collectTreeFiles()) {
    if (rel === OUT || EXCLUDES.has(rel)) continue;
    const buf = await readFile(rel);
    lines.push(`${createHash('sha256').update(buf).digest('hex')}  ${rel}`);
    count++;
  }
  lines.sort((a, b) => a.slice(66).localeCompare(b.slice(66)));
  await writeFile(OUT, lines.join('\n') + '\n');
  console.log(`final-artifacts.sha256: ${count} files frozen → ${OUT}`);
}

await main();

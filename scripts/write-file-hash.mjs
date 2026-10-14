#!/usr/bin/env node
// Single-file SHA256 writer. Node stdlib only.
// Usage: node scripts/write-file-hash.mjs --input <path> --output <path>
// Writes "<sha256>  <input-path>\n" (sha256sum format) to --output.
// Refuses to overwrite an existing output whose recorded hash for the same
// input path differs from the freshly computed one (tamper guard).
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { argv, exit } from 'node:process';

function arg(name) {
  const i = argv.indexOf(`--${name}`);
  if (i === -1 || i + 1 >= argv.length) {
    console.error(`missing --${name} <value>`);
    exit(2);
  }
  return argv[i + 1];
}

const input = arg('input');
const output = arg('output');

if (!existsSync(input)) {
  console.error(`input not found: ${input}`);
  exit(2);
}

const digest = createHash('sha256').update(readFileSync(input)).digest('hex');
const line = `${digest}  ${input}\n`;

if (existsSync(output)) {
  const prev = readFileSync(output, 'utf8').trim();
  const prevHash = prev.split(/\s+/)[0] || '';
  const prevPath = prev.split(/\s+/).slice(1).join(' ') || '';
  if (prevPath === input && prevHash !== digest) {
    console.error(
      `refusing overwrite: ${output} records ${prevHash} for ${input}, computed ${digest}. ` +
        'Input changed since last record — resolve manually (this guard exists so hash updates are deliberate).',
    );
    exit(1);
  }
}

writeFileSync(output, line);
console.log(line.trim());

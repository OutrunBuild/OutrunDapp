#!/usr/bin/env node
// Stage-01 14C/E: verify the handoff approval block against the canonical payload,
// the frozen artifact manifest, and the CURRENT architecture.md hash.
//   node scripts/check-handoff-integrity.mjs --canonical <approval-payload.json> \
//     --handoff <stage-01-handoff.md> --manifest <final-artifacts.sha256> \
//     --architecture docs/architecture.md
//   node scripts/check-handoff-integrity.mjs --self-test   (tamper matrix on temp copies)
//
// Immutable fields (Agent writes, humans never edit): scope, artifactVersion,
// architectureHash, artifactHash, blockingIssues. Mutable: status, signer, signedAt.
// A handoff whose architectureHash differs from the live file is SUPERSEDED
// (non-zero exit); the checker never rewrites it.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
function arg(n) {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
}

function parseHandoff(mdPath) {
  const md = readFileSync(mdPath, 'utf8');
  const blocks = [...md.matchAll(/```json\s*([\s\S]*?)```/g)].map((m) => m[1]);
  if (blocks.length !== 1)
    throw new Error(`expected exactly 1 fenced json block, found ${blocks.length}`);
  return { block: JSON.parse(blocks[0]), count: blocks.length };
}

function fail(msg) {
  console.error(`CHECK FAIL: ${msg}`);
  process.exit(1);
}

function verify({ canonical, handoff, manifest, architecture }) {
  const payload = JSON.parse(readFileSync(canonical, 'utf8'));
  const { block } = parseHandoff(handoff);

  for (const k of ['scope', 'artifactVersion', 'architectureHash', 'blockingIssues']) {
    const a = JSON.stringify(payload[k]);
    const b = JSON.stringify(block[k]);
    if (a !== b) fail(`immutable field mismatch: ${k}\n  canonical: ${a}\n  handoff:   ${b}`);
  }
  if (payload.artifactHash !== undefined) fail('canonical payload must not contain artifactHash');
  for (const k of [
    'status',
    'scope',
    'artifactVersion',
    'architectureHash',
    'artifactHash',
    'blockingIssues',
    'signer',
    'signedAt',
  ]) {
    if (!(k in block)) fail(`handoff block missing field: ${k}`);
  }
  if (!['pending', 'approved', 'rejected'].includes(block.status))
    fail(`bad status: ${block.status}`);
  if (block.status === 'approved' && (!block.signer || !block.signedAt))
    fail('approved requires signer + signedAt');

  const manifestDigest = createHash('sha256').update(readFileSync(manifest)).digest('hex');
  if (block.artifactHash !== manifestDigest)
    fail(
      `artifactHash != sha256(${manifest})\n  handoff: ${block.artifactHash}\n  actual:  ${manifestDigest}`,
    );

  const archDigest = createHash('sha256').update(readFileSync(architecture)).digest('hex');
  if (block.architectureHash !== archDigest) {
    console.error(
      `SUPERSEDED: handoff architectureHash ${block.architectureHash.slice(0, 16)}… != live ${archDigest.slice(0, 16)}…`,
    );
    console.error(
      'architecture changed after this handoff was written — regenerate payload/manifest/hashes and re-sign from the changed stage.',
    );
    process.exit(2);
  }
  console.log(
    `handoff OK: status=${block.status} scope=${block.scope} v${block.artifactVersion} arch=${archDigest.slice(0, 12)}… artifact=${manifestDigest.slice(0, 12)}… chain=${JSON.stringify(block.blockingIssues)}`,
  );
  return true;
}

if (args.includes('--self-test')) {
  const dir = mkdtempSync(join(tmpdir(), 'handoff-selftest-'));
  try {
    const c = join(dir, 'payload.json'),
      h = join(dir, 'handoff.md'),
      m = join(dir, 'manifest.sha256'),
      a = join(dir, 'arch.md');
    writeFileSync(m, 'deadbeef  x\n');
    const arch = 'architecture-v1';
    const payload = {
      scope: 'stage-01-design-system-style-anchor',
      artifactVersion: '1.0.0',
      architectureHash: createHash('sha256').update(arch).digest('hex'),
      blockingIssues: [],
    };
    writeFileSync(c, JSON.stringify(payload, null, 2));
    writeFileSync(a, arch);
    const block = {
      status: 'pending',
      ...payload,
      artifactHash: createHash('sha256').update(readFileSync(m)).digest('hex'),
      signer: null,
      signedAt: null,
    };
    const writeHandoff = (b) =>
      writeFileSync(h, `# h\n\n\`\`\`json\n${JSON.stringify(b, null, 2)}\n\`\`\`\n`);
    writeHandoff(block);
    const { execFileSync } = await import('node:child_process');
    const run = (argv) => {
      try {
        execFileSync(
          process.execPath,
          [new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), ...argv],
          { stdio: 'pipe', cwd: process.cwd() },
        );
        return 0;
      } catch (e) {
        return e.status ?? 1;
      }
    };

    const results = [];
    results.push([
      'baseline pending',
      run(['--canonical', c, '--handoff', h, '--manifest', m, '--architecture', a]) === 0,
    ]);
    // tamper each immutable field → must fail
    for (const k of [
      'scope',
      'artifactVersion',
      'architectureHash',
      'blockingIssues',
      'artifactHash',
    ]) {
      const bad = { ...block, [k]: k === 'blockingIssues' ? ['x'] : String(block[k]) + 'x' };
      writeHandoff(bad);
      results.push([
        `tamper ${k} rejected`,
        run(['--canonical', c, '--handoff', h, '--manifest', m, '--architecture', a]) !== 0,
      ]);
    }
    // only-status/signer/signedAt change on approved → must pass
    writeHandoff({
      ...block,
      status: 'approved',
      signer: 'tester',
      signedAt: '2026-09-17T00:00:00Z',
    });
    results.push([
      'only mutable fields changed → pass',
      run(['--canonical', c, '--handoff', h, '--manifest', m, '--architecture', a]) === 0,
    ]);
    // architecture drift → superseded (exit 2)
    writeHandoff(block);
    writeFileSync(a, 'architecture-v2-changed');
    const drift = run(['--canonical', c, '--handoff', h, '--manifest', m, '--architecture', a]);
    results.push([`architecture drift → exit 2`, drift === 2]);

    const failed = results.filter(([, ok]) => !ok);
    for (const [name, ok] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
    if (failed.length) process.exit(1);
    console.log('self-test: all tamper cases rejected, mutable-only edit accepted');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
} else {
  const canonical = arg('--canonical'),
    handoff = arg('--handoff'),
    manifest = arg('--manifest'),
    architecture = arg('--architecture');
  for (const [v, n] of [
    [canonical, '--canonical'],
    [handoff, '--handoff'],
    [manifest, '--manifest'],
    [architecture, '--architecture'],
  ]) {
    if (!v || !existsSync(v)) {
      console.error(`missing ${n}`);
      process.exit(2);
    }
  }
  verify({ canonical, handoff, manifest, architecture });
}

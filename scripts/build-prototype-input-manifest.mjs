#!/usr/bin/env node
// Stage-03 step 1: build the final v0 input package manifest.
//   --output docs/prototype/v0-input/manifest.json   build (copies inputs into the package)
//   --verify <dir>                                    verify an extracted package against its manifest
// Inputs are frozen stage-1/stage-2 truth only; reference-only/denied assets are blocked.
import {
  readFileSync,
  writeFileSync,
  existsSync,
  statSync,
  mkdirSync,
  copyFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';

const sha256 = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');

// Frozen baselines (Resolution 006; runbook stage-03 line 22 as corrected 2026-09-18).
const BASELINES = {
  memeverseCommit: '3cdb8046380bf1af8ae57a04be5e92c086834567',
  outstakeCommit: '731541109f058e6df1dc042d8fa65b8221e12bcb',
};

const STAGE1 = [
  'DESIGN.md',
  'PRODUCT.md',
  'components/design-system/token-contract.md',
  'components/design-system/component-contract.md',
  'components/design-system/state-matrix.md',
  'components/design-system/motion-and-a11y.md',
  'components/design-system/tokens.css',
  'docs/design/approval-payload.json',
  'docs/design/decision-log.md',
  'docs/design/final-artifacts.sha256',
];
const STAGE2 = [
  'docs/page-briefs/README.md',
  'docs/page-briefs/glossary.md',
  'docs/page-briefs/routes.json',
  'docs/page-briefs/state-catalog.md',
  'docs/page-briefs/state-coverage-matrix.md',
  'docs/page-briefs/brief-template.md',
  'docs/page-briefs/product-intent.md',
  'docs/page-briefs/source-map.md',
  'docs/page-briefs/brief-hashes.txt',
  'docs/page-briefs/fixture-boundary-contract.md',
  'docs/page-briefs/bootstrap-contract.md',
  'docs/page-briefs/freeze-v1.md',
  'docs/page-briefs/freeze-artifacts.sha256',
  'docs/page-briefs/approval-payload.json',
  'scripts/check-architecture-compliance.mjs',
  // 11 route briefs + embedded asset-flows + global surface
  'docs/page-briefs/home.md',
  'docs/page-briefs/bridge.md',
  'docs/page-briefs/memeverse-discovery.md',
  'docs/page-briefs/memeverse-create.md',
  'docs/page-briefs/verse-overview.md',
  'docs/page-briefs/verse-trade.md',
  'docs/page-briefs/verse-yield.md',
  'docs/page-briefs/verse-stake.md',
  'docs/page-briefs/verse-governance.md',
  'docs/page-briefs/portfolio.md',
  'docs/page-briefs/account.md',
  'docs/page-briefs/global-interactions.md',
  'docs/page-briefs/asset-flows.md',
];
const CLOSURE = [
  '.node-version',
  '.prettierrc.json',
  '.prettierignore',
  'pnpm-workspace.yaml',
  'scripts/check-runtime.mjs',
  'docs/architecture/kernel-v3.3-evidence.md',
  'docs/security/csp-origins.json',
];
// 视觉浓度基准（决议 010 锚定实物，仅 r10 两张；旧方向图 D1/D2/D3 为被否/旧态，禁入包）
const VISUAL_ANCHOR = [
  'docs/design/review/v0-revisions/r10-aesthetic-desktop.png',
  'docs/design/review/v0-revisions/r10-aesthetic-mobile.png',
];
// Fixed fixture input list (runbook stage-03 step 1, verbatim).
const FIXTURES = [
  'fixtures/schema.ts',
  'fixtures/README.md',
  'fixtures/index.ts',
  'fixtures/manifest.json',
  'fixtures/data/seed.json',
  'fixtures/data/chains.json',
  'fixtures/data/assets.json',
  'fixtures/data/markets.json',
  'fixtures/data/verses.json',
  'fixtures/data/positions.json',
  'fixtures/data/psm.json',
  'fixtures/data/usr-vaults.json',
  'fixtures/data/bridge-messages.json',
  'fixtures/data/transactions.json',
  'fixtures/data/governance.json',
  'fixtures/data/accounts.json',
  'fixtures/data/notifications.json',
  'fixtures/invariants/amounts.json',
  'fixtures/invariants/lifecycle.json',
  'fixtures/invariants/cross-chain.json',
  'fixtures/invariants/state-scenarios.json',
  'fixtures/scenarios/states.json',
];

function parseSha256File(path) {
  // lines: "<hash>  <path>  <bytes>b" or "<hash>  <path>"
  const map = new Map();
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.trim().match(/^([0-9a-f]{64})\s\s(.+?)(?:\s\s(\d+)b)?$/);
    if (m) map.set(m[2], { sha256: m[1], bytes: m[3] ? Number(m[3]) : undefined });
    else if (line.trim() === '' || line.trim().startsWith('self')) continue;
    else if (line.trim()) map.set(`__unparsed__${line}`, {});
  }
  return map;
}

function guardReferenceMaterial(path) {
  if (path.startsWith('docs/design/references/')) {
    throw new Error(`reference-only asset must not enter the package: ${path}`);
  }
  if (/\.(md|css|html|json|ts)$/.test(path)) {
    const content = readFileSync(path, 'utf8');
    // data URI 直接嵌入资产 → 一律拒绝
    if (content.includes('data:image/')) {
      throw new Error(`banned data-URI asset found in ${path}`);
    }
    // 仅拦截真实嵌入/引用语法（markdown 链接、img src、CSS url()）指向 reference-only 素材；
    // 决议/证据文档中的纯文字来源记录（如捕获归档路径）不构成资产渗入，放行。
    const embedPatterns = [
      /!?\[[^\]]*\]\([^)]*docs\/design\/references/,
      /src=["'][^"']*docs\/design\/references/,
      /url\([^)]*docs\/design\/references/,
    ];
    for (const re of embedPatterns) {
      if (re.test(content)) {
        throw new Error(`banned reference-only embed (${re.source}) found in ${path}`);
      }
    }
  }
}

function build(output) {
  const stage1Map = parseSha256File('docs/design/final-artifacts.sha256');
  const stage2Map = parseSha256File('docs/page-briefs/freeze-artifacts.sha256');
  const fixtureMap = new Map(
    Object.entries(JSON.parse(readFileSync('fixtures/manifest.json', 'utf8')).items),
  );

  const packageDir = dirname(output);
  const entries = [];
  const groups = [
    ['stage-01', STAGE1, stage1Map],
    ['stage-02', STAGE2, stage2Map],
    ['closure', CLOSURE, null],
    ['visual-anchor', VISUAL_ANCHOR, null],
    ['stage-02-fixture', FIXTURES, null],
  ];
  for (const [stage, files, sourceMap] of groups) {
    for (const f of files) {
      if (!existsSync(f)) throw new Error(`missing input: ${f}`);
      guardReferenceMaterial(f);
      const bytes = statSync(f).size;
      const digest = sha256(f);
      let sourceHash = 'not-in-stage-manifest';
      if (stage === 'stage-02-fixture') {
        if (f === 'fixtures/manifest.json') sourceHash = 'self';
        else {
          const rec = fixtureMap.get(f);
          if (!rec) throw new Error(`fixture not listed in fixtures/manifest.json: ${f}`);
          if (rec.sha256 !== digest || rec.bytes !== bytes) {
            throw new Error(`fixture hash/size mismatch vs fixtures/manifest.json: ${f}`);
          }
          sourceHash = rec.sha256;
        }
      } else if (sourceMap) {
        const rec = sourceMap.get(f);
        if (!rec) {
          if (
            f === 'docs/design/final-artifacts.sha256' ||
            f === 'docs/page-briefs/freeze-artifacts.sha256'
          ) {
            // 冻结清单自身不可含自身 hash；锚定=已签 handoff 的 artifactHash（sha256(本文件)）
            sourceHash = 'self:anchored-by-signed-handoff-artifactHash';
          } else if (f.startsWith('components/design-system/')) {
            sourceHash =
              'declared-canonical:docs/design/stage-02-inputs.md#L10-L13 (outside stage-1 freeze trees)';
          } else {
            throw new Error(`input not covered by its stage freeze manifest: ${f}`);
          }
        } else {
          if (rec.sha256 !== digest)
            throw new Error(`input drifted from stage freeze manifest: ${f}`);
          sourceHash = rec.sha256;
        }
      }
      const dest = join(packageDir, f);
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(f, dest);
      entries.push({
        path: f,
        bytes,
        sha256: digest,
        sourceStage: stage,
        sourceHash,
        externalToolUpload: true,
      });
    }
  }

  const packageReadme = join(packageDir, 'README.md');
  if (!existsSync(packageReadme)) {
    throw new Error(
      'package README.md must exist before manifest build (see step-1 package readme)',
    );
  }
  entries.push({
    path: 'README.md',
    bytes: statSync(packageReadme).size,
    sha256: sha256(packageReadme),
    sourceStage: 'stage-03-package',
    sourceHash: 'n/a',
    externalToolUpload: true,
  });

  entries.sort((a, b) => (a.path < b.path ? -1 : 1));
  const manifest = {
    generatedAt: new Date().toISOString(),
    architectureHash: sha256('docs/architecture.md'),
    kernelEvidenceSha256: sha256('docs/architecture/kernel-v3.3-evidence.md'),
    cspPolicySha256: sha256('docs/security/csp-origins.json'),
    ...BASELINES,
    fileCount: entries.length,
    files: entries,
    'docs/prototype/v0-input/manifest.json': { sha256: 'self', externalToolUpload: true },
  };
  writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`v0 input manifest: ${entries.length} files → ${output}`);
}

function verify(dir) {
  const manifestPath = join(dir, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  let fail = 0;
  for (const e of manifest.files) {
    const f = join(dir, e.path);
    if (!existsSync(f)) {
      console.error(`missing in package: ${e.path}`);
      fail++;
      continue;
    }
    const bytes = statSync(f).size;
    const digest = sha256(f);
    if (bytes !== e.bytes || digest !== e.sha256) {
      console.error(
        `hash/size mismatch: ${e.path} (manifest ${e.sha256.slice(0, 8)}…/${e.bytes}b vs ${digest.slice(0, 8)}…/${bytes}b)`,
      );
      fail++;
    }
  }
  // fixture entries must still match the packaged fixtures/manifest.json
  const pkgFixtureManifest = JSON.parse(
    readFileSync(join(dir, 'fixtures/manifest.json'), 'utf8'),
  ).items;
  for (const e of manifest.files) {
    if (e.sourceStage !== 'stage-02-fixture' || e.path === 'fixtures/manifest.json') continue;
    const rec = pkgFixtureManifest[e.path];
    if (!rec || rec.sha256 !== e.sha256) {
      console.error(`fixture cross-check failed: ${e.path}`);
      fail++;
    }
  }
  // closure metadata must match the packaged files themselves
  if (
    manifest.kernelEvidenceSha256 !== sha256(join(dir, 'docs/architecture/kernel-v3.3-evidence.md'))
  ) {
    console.error('kernelEvidenceSha256 mismatch');
    fail++;
  }
  if (manifest.cspPolicySha256 !== sha256(join(dir, 'docs/security/csp-origins.json'))) {
    console.error('cspPolicySha256 mismatch');
    fail++;
  }
  if (fail) {
    console.error(`verify FAILED: ${fail} problem(s)`);
    process.exit(1);
  }
  console.log(
    `verify OK: ${manifest.files.length} files, ${manifest.fileCount} declared, fixtures cross-checked, closure hashes match`,
  );
}

const args = process.argv.slice(2);
const outIdx = args.indexOf('--output');
const verIdx = args.indexOf('--verify');
if (verIdx !== -1) verify(args[verIdx + 1]);
else if (outIdx !== -1) build(args[outIdx + 1]);
else {
  console.error('usage: --output <manifest.json> | --verify <dir>');
  process.exit(2);
}

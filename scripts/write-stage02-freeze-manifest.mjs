#!/usr/bin/env node
// 生成 docs/page-briefs/freeze-artifacts.sha256。
// 清单集：全部 brief、route registry、state catalog/矩阵、product-intent、glossary、
// source-map、bootstrap contract、fixture boundary contract、decision-log、
// fixture manifest、invariants、pnpm-workspace、pnpm-lock hash、OutrunBook 哈希、
// checker scripts。自身条目 hash=self。
// 确定性：排序+固定序列化；重复运行字节一致。
import { readFileSync as rf, writeFileSync as wf, statSync as sf } from 'node:fs';
import { createHash as ch } from 'node:crypto';

const FILES = [
  // brief 与登记文档
  'docs/page-briefs/README.md',
  'docs/page-briefs/routes.json',
  'docs/page-briefs/brief-template.md',
  'docs/page-briefs/state-catalog.md',
  'docs/page-briefs/state-coverage-matrix.md',
  'docs/page-briefs/product-intent.md',
  'docs/page-briefs/glossary.md',
  'docs/page-briefs/source-map.md',
  'docs/page-briefs/bootstrap-contract.md',
  'docs/page-briefs/fixture-boundary-contract.md',
  'docs/page-briefs/pnpm-lock.sha256',
  'docs/page-briefs/outrunbook-hashes.txt',
  // 9 页面/动线/全局面 brief
  'docs/page-briefs/home.md',
  'docs/page-briefs/asset-flows.md',
  'docs/page-briefs/memeverse-discovery.md',
  'docs/page-briefs/memeverse-create.md',
  'docs/page-briefs/verse-overview.md',
  'docs/page-briefs/verse-trade.md',
  'docs/page-briefs/verse-yield.md',
  'docs/page-briefs/verse-governance.md',
  'docs/page-briefs/portfolio.md',
  'docs/page-briefs/global-interactions.md',
  // 产品决策记录（决议 007 所在）
  'docs/design/decision-log.md',
  // fixture 侧
  'fixtures/manifest.json',
  'fixtures/invariants/amounts.json',
  'fixtures/invariants/lifecycle.json',
  'fixtures/invariants/cross-chain.json',
  'fixtures/invariants/state-scenarios.json',
  // 运行时与检查器
  'pnpm-workspace.yaml',
  'scripts/check-fixture-boundary.mjs',
  'scripts/check-architecture-compliance.mjs',
  'scripts/check-handoff-integrity.mjs',
  'scripts/serve-fixture-inspector.mjs',
  'scripts/write-fixture-manifest.mjs',
  'docs/prototype/architecture-compliance.md',
];

const lines = [];
for (const f of FILES.sort()) {
  const digest = ch('sha256').update(rf(f)).digest('hex');
  lines.push(`${digest}  ${f}  ${sf(f).size}b`);
}
lines.push(`self  docs/page-briefs/freeze-artifacts.sha256`);
wf('docs/page-briefs/freeze-artifacts.sha256', lines.join('\n') + '\n');
console.log(`freeze manifest: ${FILES.length} files + self`);

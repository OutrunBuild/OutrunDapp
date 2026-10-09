#!/usr/bin/env node
// check-scenario-boundary.mjs —— 步骤 5 场景协议边界验证（双模式）：
//
// 模式 A（默认）：--rendered <html-file> [more.html...]
//   扫描 production server（OUTRUN_DATA_SOURCE=production）渲染的 HTML：
//   场景切换 DOM（scenario-selector/degrade-banner/degrade-skeleton）不得出现，
//   且 ?scenario=loading 等带参请求的 HTML 不得含降级横幅/骨架（生产不解析不注入）。
//
// 模式 B：--self-test
//   注入含哨兵的假 HTML 验证扫描器能抓到。
//
// 默认构建（非 production env）包含 selector 代码是预期行为——由 server 端
// OUTRUN_DATA_SOURCE 门控渲染，因此不做 chunk 扫描。
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);

const SENTINELS = [
  /scenario-selector/, // 悬浮开关 DOM
  /degrade-banner/, // 降级横幅 DOM
  /degrade-skeleton/, // 骨架 DOM
];

function scanHtml(file) {
  const html = readFileSync(file, 'utf8');
  const hits = [];
  for (const re of SENTINELS) {
    if (re.test(html)) hits.push(re.source);
  }
  return hits;
}

if (args.includes('--self-test')) {
  const fake = '/tmp/scenario-boundary-selftest.html';
  writeFileSync(fake, '<div class="scenario-selector"><div class="degrade-banner">x</div></div>');
  const hits = scanHtml(fake);
  if (hits.length < 2) {
    console.error('self-test FAIL：哨兵未被拦截');
    process.exit(1);
  }
  writeFileSync(
    '/tmp/scenario-boundary-selftest-clean.html',
    '<main><p>clean production html</p></main>',
  );
  const clean = scanHtml('/tmp/scenario-boundary-selftest-clean.html');
  if (clean.length > 0) {
    console.error('self-test FAIL：干净文件误报');
    process.exit(1);
  }
  console.log('scenario boundary self-test OK：哨兵可拦截、干净文件零误报');
  process.exit(0);
}

const files = args.filter((a) => !a.startsWith('--'));
if (files.length === 0) {
  console.error('用法：check-scenario-boundary.mjs --rendered <html...> | --self-test');
  process.exit(2);
}

let violations = 0;
for (const file of files) {
  const hits = scanHtml(file);
  if (hits.length > 0) {
    violations++;
    console.error(` - [scenario-sentinel] ${file}: 场景 DOM 残留（${hits.join(', ')}）`);
  }
}

if (violations > 0) {
  console.error(
    `scenario boundary FAIL：${violations} 个文件含场景切换残留（production 不得渲染）`,
  );
  process.exit(1);
}
console.log(`scenario boundary OK：${files.length} 个 production 渲染 HTML 零场景切换残留`);

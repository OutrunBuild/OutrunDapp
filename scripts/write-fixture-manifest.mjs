#!/usr/bin/env node
// 生成 fixtures/manifest.json（阶段 2 步骤 9/11）：
// 所有 fixture 文件的相对路径+字节数+SHA256；manifest 自身条目 hash 固定 "self"（不递归）。
// 确定性：排序遍历、固定 JSON 序列化（2 空格+尾换行）；重复运行字节一致。
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = 'fixtures';
const manifestPath = `${root}/manifest.json`;

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`],
  );
}

const files = walk(root)
  .filter((f) => f !== manifestPath)
  .sort();
const items = {};
for (const f of files) {
  items[f] = {
    bytes: statSync(f).size,
    sha256: createHash('sha256').update(readFileSync(f)).digest('hex'),
  };
}
const manifest = {
  note: 'fixture 冻结清单；自身条目 hash=self 不递归；重建：node scripts/write-fixture-manifest.mjs（输出确定性字节）',
  items: { ...items, [manifestPath]: { bytes: 0, sha256: 'self' } },
};
const out = JSON.stringify(manifest, null, 2) + '\n';

if (existsSync(manifestPath) && readFileSync(manifestPath, 'utf8') !== out) {
  console.log('manifest regenerated (content changed)');
}
writeFileSync(manifestPath, out);
console.log(`manifest: ${files.length} files + self`);

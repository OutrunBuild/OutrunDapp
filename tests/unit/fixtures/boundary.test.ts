// 边界检查器单测（阶段 2 步骤 10）：三种模式在本仓必须通过；self-test 三杀必须通过
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const run = (args: string[]) => execFileSync(process.argv[0], [join(repo, 'scripts/check-fixture-boundary.mjs'), ...args], { encoding: 'utf8' });

describe('check-fixture-boundary', () => {
  it('--source：本仓无违规（退出 0）', () => {
    expect(run(['--source'])).toContain('fixture boundary OK');
  });
  it('--graph production：生产 import 图不可达 fixtures（退出 0）', () => {
    expect(run(['--graph', 'production'])).toContain('fixture boundary OK');
  });
  it('--bundle：真实产物扫描通过且无 fixture 哨兵（阶段 3 构建已落地）', () => {
    const out = run(['--bundle', '.next']);
    expect(out).toContain('fixture boundary OK');
    expect(out).toContain('bundle 扫描已执行');
  });
  it('--bundle <不存在目录>：明示接口语义', () => {
    const out = run(['--bundle', '.next-nonexistent-probe']);
    expect(out).toContain('目录不存在');
  });
  it('--bundle：dev 缓存（.next/dev）含哨兵不触发假警，生产子目录含哨兵仍拦截', () => {
    // 复现 2026-09-23 假警形态：dev server 无 tree-shake，合法消费方把哨兵留在 .next/dev SSR chunk
    const base = mkdtempSync(join(tmpdir(), 'fx-bundle-'));
    try {
      const fakeNext = join(base, '.next');
      mkdirSync(join(fakeNext, 'dev/server/chunks/ssr'), { recursive: true });
      writeFileSync(
        join(fakeNext, 'dev/server/chunks/ssr/legal-path.js'),
        'export const OUTRUN_FIXTURE_ONLY_v1 = 1;',
      );
      mkdirSync(join(fakeNext, 'static/chunks'), { recursive: true });
      writeFileSync(join(fakeNext, 'static/chunks/app.js'), 'console.log("clean");');
      expect(run(['--bundle', fakeNext])).toContain('fixture boundary OK');
      // 正向对照：同一目录生产子目录出现哨兵必须仍以非零退出拦截
      writeFileSync(
        join(fakeNext, 'static/chunks/leak.js'),
        'export const OUTRUN_FIXTURE_ONLY_v1 = 1;',
      );
      expect(() => run(['--bundle', fakeNext])).toThrow();
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
  it('--self-test：直接导入/re-export/动态 resolver 三类注入全部以非零退出被拦截并指出文件行号', () => {
    const out = run(['--self-test']);
    expect(out).toContain('direct: 已拦截');
    expect(out).toContain('reexport: 已拦截');
    expect(out).toContain('dynamic: 已拦截');
    expect(out).toContain('临时副本已清理');
  });
});

// 边界检查器单测（阶段 2 步骤 10）：三种模式在本仓必须通过；self-test 六杀必须通过
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { cpSync, existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
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
  // 真实产物扫描依赖本地 .next 构建产物；CI runner 无构建（ci.yml 生产构建按 §12 合规轮延后）
  it.skipIf(!existsSync(join(repo, '.next')))(
    '--bundle：真实产物扫描通过且无 fixture 哨兵（阶段 3 构建已落地）',
    () => {
      const out = run(['--bundle', '.next']);
      expect(out).toContain('fixture boundary OK');
      expect(out).toContain('bundle 扫描已执行');
    },
  );
  it('--bundle <不存在目录>：明示接口语义，汇总行如实标注未执行', () => {
    const out = run(['--bundle', '.next-nonexistent-probe']);
    expect(out).toContain('目录不存在');
    expect(out).toContain('bundle 扫描未执行');
    expect(out).not.toContain('bundle 扫描已执行');
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
  it('--source：@/ 别名桥消费方与别名直连 fixtures 必须被拦截（2026-10-08 别名盲区回归）', () => {
    // 修复前：'@/' 别名原样透传，桥消费方判定按解析后路径全等比较——别名形态静默逃逸
    const base = mkdtempSync(join(tmpdir(), 'fx-alias-'));
    try {
      cpSync(join(repo, 'scripts'), join(base, 'scripts'), { recursive: true });
      cpSync(join(repo, 'fixtures'), join(base, 'fixtures'), { recursive: true });
      mkdirSync(join(base, 'components/design-system'), { recursive: true });
      mkdirSync(join(base, 'lib/data'), { recursive: true });
      writeFileSync(join(base, 'lib/data/fixture-repository.ts'), `export const bridge = 1;\n`);
      const killOutput = () => {
        try {
          run(['--source', '--root', base]);
          return '';
        } catch (e) {
          return `${String((e as { stdout?: string }).stdout ?? '')}${String((e as { stderr?: string }).stderr ?? '')}`;
        }
      };
      writeFileSync(
        join(base, 'components/design-system/bad.tsx'),
        `import type { Locale } from '@/lib/data/fixture-repository'\n`,
      );
      expect(killOutput()).toContain('[illegal-bridge-consumer]');
      writeFileSync(
        join(base, 'components/design-system/bad.tsx'),
        `import { fixtureData } from '@/fixtures/index'\n`,
      );
      expect(killOutput()).toContain('[direct-fixture-import]');
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
  it('--source：tsconfig 多目标 @/* 形态落 unresolved 注记（兜底不得短路 fail-closed）', () => {
    // 场景须用可解析目标（components/foo.ts 存在）：兜底若未被抑制会把 @/components/foo 解析成
    // 真实文件→exit 0；fail-closed 生效则 @/ 命中 UNSUPPORTED_ALIAS → unresolved 注记
    const base = mkdtempSync(join(tmpdir(), 'fx-atfallback-'));
    try {
      writeFileSync(
        join(base, 'tsconfig.json'),
        JSON.stringify({ compilerOptions: { paths: { '@/*': ['./*', './src/*'] } } }),
      );
      mkdirSync(join(base, 'components'), { recursive: true });
      writeFileSync(join(base, 'components/foo.ts'), `export const foo = 1;\n`);
      mkdirSync(join(base, 'app'), { recursive: true });
      writeFileSync(join(base, 'app/consumer.ts'), `import { foo } from '@/components/foo';\n`);
      let out = '';
      try {
        run(['--source', '--root', base]);
      } catch (e) {
        out = `${String((e as { stdout?: string }).stdout ?? '')}${String((e as { stderr?: string }).stderr ?? '')}`;
      }
      expect(out).toContain('[unresolved-import] app/consumer.ts:1');
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
  it('--source：require 两参形态首字面量捕获为 spec（指向 fixture 必须拦截，与 import() 对称）', () => {
    const base = mkdtempSync(join(tmpdir(), 'fx-req2-'));
    try {
      mkdirSync(join(base, 'fixtures'), { recursive: true });
      writeFileSync(join(base, 'fixtures/index.ts'), `export const fixtureData = 1;\n`);
      mkdirSync(join(base, 'app'), { recursive: true });
      writeFileSync(
        join(base, 'app/consumer.ts'),
        `const m = require('../fixtures/index', { flag: true });\n`,
      );
      let out = '';
      try {
        run(['--source', '--root', base]);
      } catch (e) {
        out = `${String((e as { stdout?: string }).stdout ?? '')}${String((e as { stderr?: string }).stderr ?? '')}`;
      }
      expect(out).toContain('[direct-fixture-import] app/consumer.ts:1');
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
  it('--source：两参 import attributes 形态静态可解析不误拦', () => {
    const base = mkdtempSync(join(tmpdir(), 'fx-importattrs-'));
    try {
      mkdirSync(join(base, 'app'), { recursive: true });
      writeFileSync(join(base, 'app/data.json'), `{"ok":1}\n`);
      writeFileSync(
        join(base, 'app/consumer.ts'),
        `const m = await import('./data.json', { with: { type: 'json' } });\n`,
      );
      expect(run(['--source', '--root', base])).toContain('fixture boundary OK');
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
  it('--source：别名解析采用 tsconfig paths 映射而非硬编码兜底（映射 ≠ 兜底可区分）', () => {
    // @x/* 故意映射进 fixtures/ 并偏离兜底 @/：走 tsconfig 映射则解析出 fixtures 目标并拦下；
    // 兜底路径下 @x/ 非别名 → external 静默放行 → 本断言失败
    const base = mkdtempSync(join(tmpdir(), 'fx-tsmapping-'));
    try {
      writeFileSync(
        join(base, 'tsconfig.json'),
        JSON.stringify({ compilerOptions: { paths: { '@x/*': ['./fixtures/*'] } } }),
      );
      mkdirSync(join(base, 'fixtures'), { recursive: true });
      writeFileSync(join(base, 'fixtures/thing.ts'), `export const t = 1;\n`);
      mkdirSync(join(base, 'app'), { recursive: true });
      writeFileSync(join(base, 'app/consumer.ts'), `import { t } from '@x/thing';\n`);
      let out = '';
      try {
        run(['--source', '--root', base]);
      } catch (e) {
        out = `${String((e as { stdout?: string }).stdout ?? '')}${String((e as { stderr?: string }).stderr ?? '')}`;
      }
      expect(out).toContain('[direct-fixture-import] app/consumer.ts:1');
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
  it('--self-test：直接导入/路径别名/re-export/动态 resolver/引号拼接动态/别名桥消费方六类注入全部以非零退出被拦截并指出文件行号', () => {
    const out = run(['--self-test']);
    expect(out).toContain('direct: 已拦截');
    expect(out).toContain('alias: 已拦截');
    expect(out).toContain('reexport: 已拦截');
    expect(out).toContain('dynamic: 已拦截');
    expect(out).toContain('dynamic-concat: 已拦截');
    expect(out).toContain('alias-bridge: 已拦截');
    expect(out).toContain('临时副本已清理');
  });
});

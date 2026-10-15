// Boundary checker unit tests: all three modes must pass on this repo;
// the six-shot self-test must pass
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { cpSync, existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const run = (args: string[]) => execFileSync(process.execPath, [join(repo, 'scripts/check-fixture-boundary.mjs'), ...args], { encoding: 'utf8' });

describe('check-fixture-boundary', () => {
  it('--source: no violations in this repo (exit 0)', () => {
    expect(run(['--source'])).toContain('fixture boundary OK');
  });
  it('--graph onchain: the onchain import graph cannot reach fixtures (exit 0)', () => {
    expect(run(['--graph', 'onchain'])).toContain('fixture boundary OK');
  });
  // Real bundle scanning depends on the local .next build output; CI runners
  // build nothing (ci.yml defers the production build to the compliance round)
  it.skipIf(!existsSync(join(repo, '.next')))(
    '--bundle: real artifact scan passes with no fixture sentinel (stage 3 build present)',
    () => {
      const out = run(['--bundle', '.next']);
      expect(out).toContain('fixture boundary OK');
      expect(out).toContain('bundle scan executed');
    },
  );
  it('--bundle <missing directory>: states the interface semantics, summary line truthfully marks not-executed', () => {
    const out = run(['--bundle', '.next-nonexistent-probe']);
    expect(out).toContain('directory does not exist');
    expect(out).toContain('bundle scan not executed');
    expect(out).not.toContain('bundle scan executed');
  });
  it('--bundle: a sentinel in the dev cache (.next/dev) does not false-alarm; a sentinel in a production-build subdir is still blocked', () => {
    // False-positive shape: the dev server does no
    // tree-shaking, so legal consumers leave the sentinel in .next/dev SSR chunks
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
      // Positive control: a sentinel in the same directory's production-build
      // subdirectory must still be blocked with a non-zero exit
      writeFileSync(
        join(fakeNext, 'static/chunks/leak.js'),
        'export const OUTRUN_FIXTURE_ONLY_v1 = 1;',
      );
      expect(() => run(['--bundle', fakeNext])).toThrow();
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
  it('--source: @/ alias bridge consumers and alias-direct fixture imports must be intercepted (alias blind-spot regression)', () => {
    // Before the fix: '@/' aliases were passed through verbatim and the
    // bridge-consumer check compared fully-resolved paths for equality —
    // the alias form silently escaped
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
  it('--source: the multi-target @/* tsconfig shape lands an unresolved note (the fallback must not short-circuit fail-closed)', () => {
    // The scenario needs a resolvable target (components/foo.ts exists): if the
    // fallback were not suppressed, @/components/foo would resolve to the real
    // file → exit 0; with fail-closed in effect, @/ hits UNSUPPORTED_ALIAS →
    // unresolved annotation
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
  it('--source: the two-arg require form captures the first literal as a spec (a fixture target must be intercepted, symmetric with import())', () => {
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
  it('--source: the two-arg import attributes form is statically resolvable and not falsely blocked', () => {
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
  it('--source: alias resolution uses the tsconfig paths mapping rather than the hardcoded fallback (mapping distinguishable from fallback)', () => {
    // @x/* is deliberately mapped into fixtures/ and differs from the fallback
    // @/: via the tsconfig mapping it resolves to a fixtures target and gets
    // blocked; on the fallback path @x/ is not an alias → external silently
    // passes → this assertion fails
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
  it('--self-test: all six injected kinds (direct import / path alias / re-export / dynamic resolver / quote-concatenated dynamic / alias bridge consumer) are intercepted with a non-zero exit and file:line reported', () => {
    const out = run(['--self-test']);
    expect(out).toContain('direct: intercepted');
    expect(out).toContain('alias: intercepted');
    expect(out).toContain('reexport: intercepted');
    expect(out).toContain('dynamic: intercepted');
    expect(out).toContain('dynamic-concat: intercepted');
    expect(out).toContain('alias-bridge: intercepted');
    expect(out).toContain('temp copy cleaned up');
  });
});

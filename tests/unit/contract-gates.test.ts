// Contract gate unit tests: the contract-gate checkers wrapped in vitest (same
// standard as the fixture-boundary gate in boundary.test.ts), so a single
// `pnpm test` covers every gate and pre-push/CI reuse this suite. All
// checkers are read-only and exit non-zero on failure.
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const run = (script: string) =>
  execFileSync(process.execPath, [join(repo, 'scripts', script)], { encoding: 'utf8' });
const runIn = (cwd: string, script: string) =>
  execFileSync(process.execPath, [join(repo, 'scripts', script)], { cwd, encoding: 'utf8' });
const failureStderr = (cwd: string, script: string) => {
  try {
    runIn(cwd, script);
    return '';
  } catch (error) {
    const stderr = (error as { stderr?: unknown }).stderr;
    return typeof stderr === 'string' ? stderr : String(stderr ?? error);
  }
};

describe('contract gates (design bare values / contrast / design docs / architecture compliance / CJK font subset / CJK copy literals / copy punctuation / fixture manifest)', () => {
  it('check-design-bare-values: zero bare values in product code', () => {
    expect(run('check-design-bare-values.mjs')).toContain('0 hits');
  });
  it('check-design-contrast: all tokens.css contrast pairs pass', () => {
    expect(run('check-design-contrast.mjs')).toContain('all pairs pass');
  });
  it('check-design-docs: registration docs carry no duplicate rows, overlong lines, or narrative dates', () => {
    // components.md §6 updated by appending a row instead of rewriting the
    // existing one → the registry keeps two versions of the same pattern
    expect(run('check-design-docs.mjs')).toContain('all checks passed');
  });
  it('check-architecture-compliance: architecture compliance OK', () => {
    expect(run('check-architecture-compliance.mjs')).toContain('compliance OK');
  });
  it('check-architecture-compliance: superset and range pins fail the exact-equality version gate', () => {
    // The gate compares pinned versions by equality. A substring regression (matching with
    // `includes` again) would accept `1.62.10` for `1.62.1` while every real pin stays exact,
    // so only a failure-path assertion on the problem line itself can catch it. A bare tmpdir
    // also fails on the missing workspace files, which is why the assertion targets the
    // version-gate message, not the exit code.
    const pkg = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8')) as {
      devDependencies: Record<string, string>;
    };
    const dir = mkdtempSync(join(tmpdir(), 'version-gate-'));
    try {
      for (const pinned of ['1.62.10', '^1.62.1']) {
        writeFileSync(
          join(dir, 'package.json'),
          JSON.stringify({
            ...pkg,
            devDependencies: { ...pkg.devDependencies, '@playwright/test': pinned },
          }),
        );
        expect(failureStderr(dir, 'check-architecture-compliance.mjs')).toContain(
          `the version allowlist: devDependencies.@playwright/test=${pinned} not pinned to 1.62.1`,
        );
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('check-cjk-subset: all site copy characters covered by the font subset', () => {
    // Copy edited without re-running `pnpm build:cjk-font` to re-cut the
    // subset → new Han chars fall back to system fonts → this gate goes red
    expect(run('check-cjk-subset.mjs')).toContain('reconciliation passed');
  });
  it('check-cjk-copy: no hardcoded CJK literals outside the copy dictionary', () => {
    // Component-level hardcoded Chinese is invisible to the font-subset corpus
    // (copy.ts + fixtures) → an uncovered glyph falls back to system fonts with
    // every other gate green → this gate owns the dictionary contract
    expect(run('check-cjk-copy.mjs')).toContain('0 hits');
  });
  it('check-copy-punctuation: no semicolons in user-visible copy', () => {
    // copy-and-i18n.md §2 bans semicolons in en and zh copy; the gate scans the
    // dictionary, showcase labels and fixtures/data so the rule cannot drift back
    // through a new string. The scanned-count floor keeps a broken walk from
    // passing vacuously.
    const output = run('check-copy-punctuation.mjs');
    expect(output).toContain('0 hits');
    const scanned =
      /scanned (\d+) files \/ (\d+) string literals; dictionary (\d+) \/ fixtures (\d+)/.exec(
        output,
      );
    expect(scanned).not.toBeNull();
    // Expected file count comes from the source directory, so a walk that skips a
    // fixture (or stops recursing) fails instead of passing on a frozen snapshot.
    const fixtureFiles =
      readdirSync(join(repo, 'fixtures/data'), { recursive: true }).filter((name) =>
        String(name).endsWith('.json'),
      ).length - 1; // seed.json is the exempt metadata file
    expect(Number(scanned?.[1])).toBe(fixtureFiles + 2);
    expect(Number(scanned?.[3])).toBeGreaterThan(1000);
    expect(Number(scanned?.[4])).toBeGreaterThan(1000);
  });
  it('check-fixture-manifest: fixtures match the frozen sha256 manifest', () => {
    // Fixture edited without re-running `node scripts/write-fixture-manifest.mjs`
    // → listed sha256/bytes drift from disk → this gate goes red
    expect(run('check-fixture-manifest.mjs')).toContain('fixture manifest OK');
  });
  it('check-fixture-manifest: drift, unlisted, and missing entries fail the gate', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fixture-manifest-gate-'));
    const dataDir = join(dir, 'fixtures/data');
    const dataFile = join(dataDir, 'a.json');
    const manifestFile = join(dir, 'fixtures/manifest.json');
    const body = '{"a":1}\n';
    const entry = (content: string) => ({
      bytes: Buffer.byteLength(content),
      sha256: createHash('sha256').update(content).digest('hex'),
    });
    const writeManifest = (items: Record<string, { bytes: number; sha256: string }>) =>
      writeFileSync(
        manifestFile,
        JSON.stringify({
          items: { ...items, 'fixtures/manifest.json': { bytes: 0, sha256: 'self' } },
        }),
      );
    try {
      mkdirSync(dataDir, { recursive: true });
      writeFileSync(dataFile, body);
      writeManifest({ 'fixtures/data/a.json': entry(body) });
      expect(runIn(dir, 'check-fixture-manifest.mjs')).toContain('fixture manifest OK');

      writeFileSync(dataFile, '{"a":2}\n');
      expect(failureStderr(dir, 'check-fixture-manifest.mjs')).toContain('DRIFT');

      writeFileSync(dataFile, body);
      writeFileSync(join(dataDir, 'b.json'), '{}\n');
      expect(failureStderr(dir, 'check-fixture-manifest.mjs')).toContain('UNLISTED');

      rmSync(join(dataDir, 'b.json'));
      writeManifest({
        'fixtures/data/a.json': entry(body),
        'fixtures/data/b.json': entry('{}\n'),
      });
      expect(failureStderr(dir, 'check-fixture-manifest.mjs')).toContain('MISSING');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

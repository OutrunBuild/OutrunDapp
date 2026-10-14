// Contract gate unit tests: the four checkers wrapped in vitest (same
// standard as the fixture-boundary gate in boundary.test.ts), so a single
// `pnpm test` covers every gate and pre-push/CI reuse this suite. All
// checkers are read-only and exit non-zero on failure.
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const run = (script: string) =>
  execFileSync(process.execPath, [join(repo, 'scripts', script)], { encoding: 'utf8' });

describe('contract gates (design bare values / contrast / architecture compliance / CJK font subset)', () => {
  it('check-design-bare-values: zero bare values in product code', () => {
    expect(run('check-design-bare-values.mjs')).toContain('0 hits');
  });
  it('check-design-contrast: all tokens.css contrast pairs pass', () => {
    expect(run('check-design-contrast.mjs')).toContain('all pairs pass');
  });
  it('check-architecture-compliance: architecture compliance OK', () => {
    expect(run('check-architecture-compliance.mjs')).toContain('compliance OK');
  });
  it('check-cjk-subset: all site copy characters covered by the font subset', () => {
    // Copy edited without re-running `pnpm build:cjk-font` to re-cut the
    // subset → new Han chars fall back to system fonts → this gate goes red
    expect(run('check-cjk-subset.mjs')).toContain('reconciliation passed');
  });
});

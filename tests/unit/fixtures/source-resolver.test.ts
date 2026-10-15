// source-resolver unit tests:
// (1) the onchain branch only returns the real repository / structured
//     unavailable; a fixture fallback never appears
// (2) onchain resolver source text must not contain fixture-repository /
//     scenario / OUTRUN_FIXTURE_ONLY_v1
// (3) fixture and onchain are distinct import branches (graph-level
//     difference is proven by the boundary tests)
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveDataSource } from '../../../lib/data/source-resolver';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

describe('onchain source-resolver', () => {
  it('returns structured unavailable and never falls back to fixtures', async () => {
    const repo = resolveDataSource();
    const r = await repo.getAccountState(1, '0xabc');
    expect(r.status).toBe('unavailable');
    if (r.status !== 'unavailable') throw new Error('expected unavailable');
    expect(['undeployed', 'rpc-error', 'not-configured']).toContain(r.reason);
  });
  it('singleton: the same instance is reused within a process', () => {
    expect(resolveDataSource()).toBe(resolveDataSource());
  });
  it('onchain resolver source text contains no fixture-repository/scenario/sentinel tokens', () => {
    for (const f of ['lib/data/source-resolver.ts', 'lib/data/repository.ts']) {
      const src = read(f);
      expect(src.includes('fixture-repository'), f).toBe(false);
      expect(src.includes('OUTRUN_FIXTURE_ONLY_v1'), f).toBe(false);
      expect(src.includes('scenario'), f).toBe(false);
    }
  });
  it('the fixture branch exists and is independent (consumes fixtures; unreachable from the onchain graph -- see boundary.test)', async () => {
    const proto = await import('../../../lib/data/fixture-repository');
    expect(proto.FIXTURE_ONLY_SENTINEL).toBe('OUTRUN_FIXTURE_ONLY_v1');
    expect(proto.fixtureRepository.verses().length).toBeGreaterThan(0);
  });
});

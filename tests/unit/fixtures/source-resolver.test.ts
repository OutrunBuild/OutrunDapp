// source-resolver 单测（阶段 2 步骤 10）：
// ① 生产分支只返回真实 repository / 结构化 unavailable，永不出现 fixture 回退
// ② 生产 resolver 源文本禁含 fixture-repository / scenario / OUTRUN_FIXTURE_ONLY_v1
// ③ fixture 与 production 是不同 import 分支（图级差异由 boundary 测试证明）
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveDataSource } from '../../../lib/data/source-resolver';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

describe('production source-resolver', () => {
  it('返回结构化 unavailable（阶段 2 未接线），永不回退 fixture', async () => {
    const repo = resolveDataSource();
    const r = await repo.getBalances('0xabc', 1);
    expect(r.status).toBe('unavailable');
    if (r.status !== 'unavailable') throw new Error('expected unavailable');
    expect(['undeployed', 'rpc-error', 'not-configured']).toContain(r.reason);
  });
  it('单例：同进程复用同一实例', () => {
    expect(resolveDataSource()).toBe(resolveDataSource());
  });
  it('生产 resolver 源文本不含 prototype/scenario/哨兵', () => {
    for (const f of ['lib/data/source-resolver.ts', 'lib/data/repository.ts']) {
      const src = read(f);
      expect(src.includes('fixture-repository'), f).toBe(false);
      expect(src.includes('OUTRUN_FIXTURE_ONLY_v1'), f).toBe(false);
      expect(src.includes('scenario'), f).toBe(false);
    }
  });
  it('fixture 分支确实存在且独立（消费 fixtures；生产图不可达——见 boundary.test）', async () => {
    const proto = await import('../../../lib/data/fixture-repository');
    expect(proto.FIXTURE_ONLY_SENTINEL).toBe('OUTRUN_FIXTURE_ONLY_v1');
    expect(proto.fixtureRepository.verses().length).toBeGreaterThan(0);
  });
});

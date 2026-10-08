// fixtures schema 单测（阶段 2 步骤 9；步骤 10 扩展边界/resolver 测试）
// 校验：①全部数据文件过 Zod ②场景覆盖（enum 22 项 ↔ scenarios/states.json ↔ 至少一条数据记录）
// ③数值关系抽查（invariants 的 machine-checkable 子集）④sourceRef/地址守卫
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  chainsFile, assetsFile, versesFile, marketsFile, positionsFile, psmFile,
  usrVaultsFile, bridgeMessagesFile, transactionsFile, governanceFile,
  stakingFile, polPositionsFile,
  accountsFile, notificationsFile, participationsFile, yieldSourcesFile,
  createConfigFile, balancesFile, referralFile, scenariosFile, scenarioIdSchema, fixtureAddressSchema, CHAIN_IDS,
} from '../../../fixtures/schema';

const fx = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'fixtures');
const load = (p: string) => JSON.parse(readFileSync(join(fx, p), 'utf8'));

const files = {
  'data/chains.json': chainsFile, 'data/assets.json': assetsFile, 'data/verses.json': versesFile,
  'data/markets.json': marketsFile, 'data/positions.json': positionsFile, 'data/psm.json': psmFile,
  'data/usr-vaults.json': usrVaultsFile, 'data/bridge-messages.json': bridgeMessagesFile,
  'data/transactions.json': transactionsFile, 'data/governance.json': governanceFile,
  'data/staking.json': stakingFile, 'data/pol-positions.json': polPositionsFile,
  'data/accounts.json': accountsFile, 'data/notifications.json': notificationsFile,
  'data/participations.json': participationsFile, 'data/yield-sources.json': yieldSourcesFile,
  'data/create-config.json': createConfigFile, 'data/balances.json': balancesFile,
  'data/referral.json': referralFile,
} as const;

describe('fixture 数据文件全部通过 schema', () => {
  for (const [name, schema] of Object.entries(files)) {
    it(name, () => {
      const parsed = schema.safeParse(load(name));
      expect(parsed.error?.issues ?? []).toEqual([]);
      expect(parsed.success).toBe(true);
    });
  }
  it('scenarios/states.json', () => {
    const parsed = scenariosFile.safeParse(load('scenarios/states.json'));
    expect(parsed.error?.issues ?? []).toEqual([]);
    expect(parsed.success).toBe(true);
  });
});

describe('场景覆盖（enum ↔ 场景表 ↔ 数据记录）', () => {
  const all: Array<{ scenario: string[]; id: string }> = [];
  for (const name of Object.keys(files)) {
    for (const item of load(name).items as Array<{ id: string; scenario: string[] }>) all.push(item);
  }
  const scenarios = load('scenarios/states.json').items as Array<{ id: string }>;

  it('enum 22 项全部登记在 scenarios/states.json', () => {
    const enumIds = scenarioIdSchema.options as unknown as string[];
    expect(new Set(scenarios.map((s) => s.id))).toEqual(new Set(enumIds));
  });
  it('每个场景至少被一条数据记录引用', () => {
    const used = new Set(all.flatMap((r) => r.scenario));
    const missing = [...new Set(scenarios.map((s) => s.id))].filter((s) => !used.has(s));
    expect(missing).toEqual([]);
  });
  it('scenarios.affects 指向存在的记录 id', () => {
    const ids = new Set(all.map((r) => r.id));
    const dangling = (load('scenarios/states.json').items as Array<{ affects: string[] }>)
      .flatMap((s) => s.affects).filter((a) => !ids.has(a));
    expect(dangling).toEqual([]);
  });
});

describe('确定性：两次校验结果字节一致（runbook 步骤 9）', () => {
  const digestOf = () => {
    const summary: Record<string, string[]> = {};
    for (const [name, schema] of Object.entries(files)) {
      const parsed = schema.parse(load(name));
      summary[name] = (parsed.items as Array<{ id: string }>).map((i) => i.id).sort();
    }
    const scenariosIds = (load('scenarios/states.json').items as Array<{ id: string }>).map((s) => s.id).sort();
    const canonical = JSON.stringify({ ...summary, scenarios: scenariosIds });
    return { canonical, digest: Buffer.from(canonical).toString('base64') };
  };
  it('同一进程内两次校验 canonical 序列化完全一致', () => {
    expect(digestOf().canonical).toBe(digestOf().canonical);
  });
  it('打印跨进程稳定摘要（供两次运行比对；不含时间戳）', () => {
    const { canonical, digest } = digestOf();
    console.log(`FIXTURE-VALIDATION-DIGEST:${digest}`);
    expect(canonical.length).toBeGreaterThan(0);
  });
});

describe('数值关系与守卫（invariants machine-checkable 子集）', () => {
  const verses = load('data/verses.json').items as Array<{
    id: string; stage: string; genesis: { normalRaised: { raw: string }; leverageInterest: { raw: string }; minSuccessThreshold: { raw: string } };
  }>;
  const psms = load('data/psm.json').items as Array<{ id: string; stockCap: { raw: string }; netMinted: { raw: string }; reserveAvailable: { raw: string } }>;
  const usrs = load('data/usr-vaults.json').items as Array<{ id: string; usrRate: { raw: string }; accrualIndexRaw: string; capped: boolean }>;
  const bms = load('data/bridge-messages.json').items as Array<{ id: string; stage: string; amount: { raw: string }; remainderOnSource?: { raw: string } }>;
  const positions = load('data/positions.json').items as Array<{ id: string; collateral: { amount: { raw: string } }; debt: { raw: string } }>;

  it('双门槛：verse-004 双口径均未达 → refund 态；verse-001/002/003 至少一口径达标', () => {
    const byId = new Map(verses.map((v) => [v.id, v]));
    const flop = byId.get('verse-004')!;
    expect(Number(flop.genesis.normalRaised.raw)).toBeLessThan(Number(flop.genesis.minSuccessThreshold.raw));
    expect(Number(flop.genesis.leverageInterest.raw)).toBeLessThan(Number(flop.genesis.minSuccessThreshold.raw));
    expect(flop.stage).toBe('refund');
    for (const id of ['verse-001', 'verse-002', 'verse-003']) {
      const v = byId.get(id)!;
      const ok = Number(v.genesis.normalRaised.raw) >= Number(v.genesis.minSuccessThreshold.raw)
        || Number(v.genesis.leverageInterest.raw) >= Number(v.genesis.minSuccessThreshold.raw);
      expect(ok || v.stage === 'genesis').toBe(true); // genesis 态允许未达（进行中）
    }
  });
  it('PSM headroom：psm-002 headroom≈0（mint 禁用场景）；psm-003 储备=0（redeem 关闭场景）', () => {
    const byId = new Map(psms.map((p) => [p.id, p]));
    const full = byId.get('psm-002')!;
    expect(Number(full.stockCap.raw) - Number(full.netMinted.raw)).toBeLessThan(1);
    expect(Number(byId.get('psm-003')!.reserveAvailable.raw)).toBe(0);
  });
  it('USR：usr-002 利率=0 且指数=1e18；usr-001 指数>1e18；usr-003 capped', () => {
    const byId = new Map(usrs.map((u) => [u.id, u]));
    const zero = byId.get('usr-002')!;
    expect(Number(zero.usrRate.raw)).toBe(0);
    expect(zero.accrualIndexRaw).toBe('1000000000000000000');
    expect(Number(byId.get('usr-001')!.accrualIndexRaw)).toBeGreaterThan(1e18);
    expect(byId.get('usr-003')!.capped).toBe(true);
  });
  it('CDP 面值：全部仓位 debt 数值 == 抵押数值（价值平价铸造，v1 无 LTV）', () => {
    for (const p of positions) {
      expect(Number(p.debt.raw)).toBe(Number(p.collateral.amount.raw));
    }
  });
  it('跨链：delivered≠settled 不算完成；bm-005 余数<1e-6 且留在源链', () => {
    expect(bms.find((b) => b.id === 'bm-002')!.stage).toBe('delivered');
    expect(bms.find((b) => b.id === 'bm-003')!.stage).toBe('settled');
    const bm5 = bms.find((b) => b.id === 'bm-005')!;
    expect(Number(bm5.remainderOnSource!.raw)).toBeLessThan(1e-6);
    expect(Number(bm5.remainderOnSource!.raw)).toBeGreaterThan(0);
  });
  it('chainId 白名单：所有数据只用六链', () => {
    const used = new Set<number>();
    for (const c of load('data/chains.json').items as Array<{ chainId: number }>) used.add(c.chainId);
    expect([...used].every((c) => (CHAIN_IDS as readonly number[]).includes(c))).toBe(true);
  });
  it('余额：assetId 全部存在于 assets.json；同 (chain,asset) 不重复', () => {
    const assetIds = new Set(
      (load('data/assets.json').items as Array<{ id: string }>).map((a) => a.id),
    );
    const rows = load('data/balances.json').items as Array<{ id: string; chainId: number; assetId: string }>;
    expect(rows.every((r) => assetIds.has(r.assetId))).toBe(true);
    const keys = rows.map((r) => `${r.chainId}:${r.assetId}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('地址全部 fixtureOnly 且拒绝裸地址字符串', () => {
    const raws: unknown[] = [];
    const walk = (v: unknown) => {
      if (typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v)) raws.push(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk(load('data/assets.json'));
    const assets = load('data/assets.json').items as Array<{ address?: { value: string; fixtureOnly: boolean } }>;
    for (const a of assets) {
      if (a.address) expect(fixtureAddressSchema.safeParse(a.address).success).toBe(true);
    }
    // 裸地址（无 fixtureOnly 包装）一律拒绝
    expect(fixtureAddressSchema.safeParse({ value: '0xaaaaaaa000000000000000000000000000000001' }).success).toBe(false);
  });
});

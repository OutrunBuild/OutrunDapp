// fixtures schema unit tests
// Checks: (1) all data files pass Zod (2) scenario coverage (22 enum entries ↔
// scenarios/states.json ↔ at least one data record)
// (3) numeric-relationship spot checks (machine-checkable subset of invariants)
// (4) sourceRef/address guards
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  chainsFile, assetsFile, versesFile, marketsFile, positionsFile, psmFile,
  usrVaultsFile, bridgeMessagesFile, transactionsFile, governanceFile,
  stakingFile, polPositionsFile,
  accountsFile, notificationsFile, participationsFile, yieldSourcesFile,
  createConfigFile, balancesFile, referralFile, faucetFile, scenariosFile, scenarioIdSchema, fixtureAddressSchema, CHAIN_IDS as FIXTURE_CHAIN_IDS,
} from '../../../fixtures/schema';
import { CHAIN_IDS as CHAIN_IDS_REGISTRY, TESTNET_CHAIN_IDS, MAINNET_CHAIN_IDS } from '../../../lib/web3/chains';

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
  'data/referral.json': referralFile, 'data/faucet.json': faucetFile,
} as const;

describe('all fixture data files pass the schema', () => {
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

describe('scenario coverage (enum ↔ scenario table ↔ data records)', () => {
  const all: Array<{ scenario: string[]; id: string }> = [];
  for (const name of Object.keys(files)) {
    for (const item of load(name).items as Array<{ id: string; scenario: string[] }>) all.push(item);
  }
  const scenarios = load('scenarios/states.json').items as Array<{ id: string }>;

  it('all 22 enum entries are registered in scenarios/states.json', () => {
    const enumIds = scenarioIdSchema.options as unknown as string[];
    expect(new Set(scenarios.map((s) => s.id))).toEqual(new Set(enumIds));
  });
  it('every scenario is referenced by at least one data record', () => {
    const used = new Set(all.flatMap((r) => r.scenario));
    const missing = [...new Set(scenarios.map((s) => s.id))].filter((s) => !used.has(s));
    expect(missing).toEqual([]);
  });
  it('scenarios.affects points at existing record ids', () => {
    const ids = new Set(all.map((r) => r.id));
    const dangling = (load('scenarios/states.json').items as Array<{ affects: string[] }>)
      .flatMap((s) => s.affects).filter((a) => !ids.has(a));
    expect(dangling).toEqual([]);
  });
});

describe('numeric relations and guards (machine-checkable subset of the invariants)', () => {
  const verses = load('data/verses.json').items as Array<{
    id: string; stage: string; genesis: { normalRaised: { raw: string }; leverageInterest: { raw: string }; minSuccessThreshold: { raw: string } };
  }>;
  const psms = load('data/psm.json').items as Array<{ id: string; stockCap: { raw: string }; netMinted: { raw: string }; reserveAvailable: { raw: string } }>;
  const usrs = load('data/usr-vaults.json').items as Array<{ id: string; usrRate: { raw: string }; accrualIndexRaw: string; capped: boolean }>;
  const bms = load('data/bridge-messages.json').items as Array<{ id: string; stage: string; amount: { raw: string }; remainderOnSource?: { raw: string } }>;
  const positions = load('data/positions.json').items as Array<{ id: string; collateral: { amount: { raw: string } }; debt: { raw: string } }>;

  it('dual thresholds: verse-004 unmet on both metrics → refund stage; verse-001/002/003 meet at least one', () => {
    const byId = new Map(verses.map((v) => [v.id, v]));
    const flop = byId.get('verse-004')!;
    expect(Number(flop.genesis.normalRaised.raw)).toBeLessThan(Number(flop.genesis.minSuccessThreshold.raw));
    expect(Number(flop.genesis.leverageInterest.raw)).toBeLessThan(Number(flop.genesis.minSuccessThreshold.raw));
    expect(flop.stage).toBe('refund');
    for (const id of ['verse-001', 'verse-002', 'verse-003']) {
      const v = byId.get(id)!;
      const ok = Number(v.genesis.normalRaised.raw) >= Number(v.genesis.minSuccessThreshold.raw)
        || Number(v.genesis.leverageInterest.raw) >= Number(v.genesis.minSuccessThreshold.raw);
      expect(ok || v.stage === 'genesis').toBe(true); // genesis stage may be unmet (in progress)
    }
  });
  it('PSM headroom: psm-002 headroom≈0 (mint disabled scenario); psm-003 reserve=0 (redeem closed scenario)', () => {
    const byId = new Map(psms.map((p) => [p.id, p]));
    const full = byId.get('psm-002')!;
    expect(Number(full.stockCap.raw) - Number(full.netMinted.raw)).toBeLessThan(1);
    expect(Number(byId.get('psm-003')!.reserveAvailable.raw)).toBe(0);
  });
  it('USR: usr-002 rate=0 and index=1e18; usr-001 index>1e18; usr-003 capped', () => {
    const byId = new Map(usrs.map((u) => [u.id, u]));
    const zero = byId.get('usr-002')!;
    expect(Number(zero.usrRate.raw)).toBe(0);
    expect(zero.accrualIndexRaw).toBe('1000000000000000000');
    expect(Number(byId.get('usr-001')!.accrualIndexRaw)).toBeGreaterThan(1e18);
    expect(byId.get('usr-003')!.capped).toBe(true);
  });
  it('CDP face value: every position debt amount == collateral amount (value-parity minting, no LTV in v1)', () => {
    for (const p of positions) {
      expect(Number(p.debt.raw)).toBe(Number(p.collateral.amount.raw));
    }
  });
  it('cross-chain: delivered≠settled does not count as complete; bm-005 remainder<1e-6 and stays on the source chain', () => {
    expect(bms.find((b) => b.id === 'bm-002')!.stage).toBe('delivered');
    expect(bms.find((b) => b.id === 'bm-003')!.stage).toBe('settled');
    const bm5 = bms.find((b) => b.id === 'bm-005')!;
    expect(Number(bm5.remainderOnSource!.raw)).toBeLessThan(1e-6);
    expect(Number(bm5.remainderOnSource!.raw)).toBeGreaterThan(0);
  });
  it('chainId whitelist: all data uses only the six chains', () => {
    const used = new Set<number>();
    for (const c of load('data/chains.json').items as Array<{ chainId: number }>) used.add(c.chainId);
    expect([...used].every((c) => (FIXTURE_CHAIN_IDS as readonly number[]).includes(c))).toBe(true);
  });
  it('chainId registry consistency: fixture schema, chains.ts, and onchain-source TESTNETS are in sync', () => {
    expect(FIXTURE_CHAIN_IDS).toEqual(CHAIN_IDS_REGISTRY);
    expect(TESTNET_CHAIN_IDS).toEqual(
      (CHAIN_IDS_REGISTRY as readonly number[]).filter((id) => !(MAINNET_CHAIN_IDS as readonly number[]).includes(id)),
    );
  });
  it('balances: every assetId exists in assets.json; no duplicate (chain,asset) pairs', () => {
    const assetIds = new Set(
      (load('data/assets.json').items as Array<{ id: string }>).map((a) => a.id),
    );
    const rows = load('data/balances.json').items as Array<{ id: string; chainId: number; assetId: string }>;
    expect(rows.every((r) => assetIds.has(r.assetId))).toBe(true);
    const keys = rows.map((r) => `${r.chainId}:${r.assetId}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('addresses are all fixtureOnly and bare address strings are rejected', () => {
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
    // Bare addresses (no fixtureOnly wrapper) are rejected outright
    expect(fixtureAddressSchema.safeParse({ value: '0xaaaaaaa000000000000000000000000000000001' }).success).toBe(false);
  });
  it('verse temporal invariants: createdAt < endsAt, unlocked aligns to endsAt+365d, duration in [1,3] days', () => {
    const DAY = 24 * 60 * 60 * 1000;
    const YEAR = 365 * DAY;
    const anchor = Date.parse('2026-09-16T12:00:00Z');
    const verses = load('data/verses.json').items as Array<{
      id: string; stage: string; createdAt: string;
      genesis: { endsAt: string };
      unlock?: { unlockedAtTx: string };
    }>;
    for (const v of verses) {
      const created = Date.parse(v.createdAt);
      const ended = Date.parse(v.genesis.endsAt);
      const durationDays = (ended - created) / DAY;
      expect(durationDays).toBeGreaterThanOrEqual(1);
      expect(durationDays).toBeLessThanOrEqual(3);
      expect(created).toBeLessThan(ended);
      if (v.stage === 'unlocked') {
        expect(v.unlock).toBeDefined();
        const expectedUnlock = new Date(ended + YEAR).toISOString().replace('.000Z', 'Z');
        expect(v.unlock!.unlockedAtTx).toBe(expectedUnlock);
        expect(ended + YEAR).toBeLessThanOrEqual(anchor);
      }
    }
  });
});

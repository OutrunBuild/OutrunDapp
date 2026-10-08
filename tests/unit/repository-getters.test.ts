// 重推导 getter 直接断言（2026-10-08 测试盲区裁决 [C]：24 个 getFixture* 里聚合最重的
// 四个此前零直接断言——join/filter/sum 推导无闸，仅经 e2e 视觉基线间接锁定）。
// 底账值取自 fixtures/data/{participations,referral,assets,chains}.json；数字变更须同步本测试。
import { describe, expect, it } from 'vitest';

import {
  getFixturePortfolioActions,
  getFixtureReferral,
  getFixtureSnapshot,
  getFixtureVaultRows,
  getFixtureParticipationRows,
} from '../../lib/data/fixture-repository';

describe('getFixtureVaultRows：③收益库存单（staking×verse 联结）', () => {
  const rows = getFixtureVaultRows();

  it('只列实际持仓（myShares>0，2026-10-04 减量裁定）且按 verseId 升序', () => {
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.myShares > 0)).toBe(true);
    const ids = rows.map((row) => row.verse.id);
    expect([...ids].sort((a, b) => a.localeCompare(b))).toEqual(ids);
  });

  it('shareSymbol = s+symbol；readyUsd = readyTotal × currentPrice（无样本价=null）', () => {
    const verses = new Map(getFixtureSnapshot().verses.map((verse) => [verse.id, verse]));
    for (const row of rows) {
      expect(row.shareSymbol).toBe(`s${row.verse.symbol}`);
      const price = verses.get(row.verse.id)?.currentPrice ?? null;
      if (price == null) {
        expect(row.readyUsd).toBeNull();
      } else {
        expect(row.readyUsd).toBeCloseTo(row.readyTotal * price, 6);
      }
    }
  });
});

describe('getFixturePortfolioActions：①待办区聚合', () => {
  const actions = getFixturePortfolioActions();

  it('排序：有限时窗者按剩余时间升序置顶，无截止者殿后（类别序）', () => {
    expect(actions.length).toBeGreaterThan(0);
    const deadlines = actions.flatMap((action) =>
      action.remainingMs != null ? [action.remainingMs] : [],
    );
    expect([...deadlines].sort((a, b) => a - b)).toEqual(deadlines);
    const firstOpen = actions.findIndex((action) => action.remainingMs == null);
    if (firstOpen >= 0) {
      expect(actions.slice(firstOpen).every((action) => action.remainingMs == null)).toBe(true);
    }
  });

  it('refund 卡：金额=该 verse 参与合计（UAsset 本位），无截止', () => {
    const refunds = actions.filter((action) => action.kind === 'refund');
    expect(refunds.map((action) => action.verse?.id).sort()).toEqual([
      'verse-004',
      'verse-015',
      'verse-035',
    ]);
    const byId = new Map(refunds.map((action) => [action.verse?.id ?? '', action.amount]));
    // part-002..004：15000 normal + 45000 leverage + 8000 preorder
    expect(byId.get('verse-004')).toBe(68_000);
    expect(byId.get('verse-015')).toBe(95_000); // part-005
    // part-006/007：60000 normal + 12000 leverage
    expect(byId.get('verse-035')).toBe(72_000);
    expect(refunds.every((action) => action.deadline == null && action.remainingMs == null)).toBe(
      true,
    );
  });

  it('vault-ready 聚合卡：count=有成熟赎回的 verse 数、amountUsd=readyUsd 合计', () => {
    const ready = getFixtureVaultRows().filter((row) => row.readyTotal > 0);
    expect(ready.length).toBeGreaterThan(0);
    const card = actions.find((action) => action.kind === 'vault-ready');
    expect(card?.count).toBe(ready.length);
    if (ready.some((row) => row.readyUsd == null)) {
      expect(card?.amountUsd).toBeNull();
    } else {
      expect(card?.amountUsd).toBeCloseTo(
        ready.reduce((sum, row) => sum + (row.readyUsd ?? 0), 0),
        6,
      );
    }
  });
});

describe('getFixtureParticipationRows：④参与凭证行（生命周期分组）', () => {
  const rows = getFixtureParticipationRows();

  it('分组序=创世中→锁定中→已解锁；refund 由①待办承接不进凭证行', () => {
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((row) => row.verse.stage === 'refund')).toBe(false);
    const order: Record<string, number> = { genesis: 0, locked: 1, unlocked: 2 };
    const stages = rows.map((row) => order[row.verse.stage]);
    expect([...stages].sort((a, b) => a - b)).toEqual(stages);
  });

  it('genesis 行按 kind 分列：MOON=12000 全 normal 且 stake 路径（part-001）', () => {
    const moon = rows.find((row) => row.verse.id === 'verse-001');
    expect(moon?.genesis).toEqual({
      total: 12_000,
      normal: 12_000,
      leverage: 0,
      preorder: 0,
      stakeRoute: true,
    });
    expect(moon?.holdings).toBeNull();
  });

  it('refund 态 verse 的参与不进凭证行（FLOP/RRAD/SWHL 缺席）', () => {
    expect(rows.find((row) => row.verse.id === 'verse-004')).toBeUndefined();
    expect(rows.find((row) => row.verse.id === 'verse-015')).toBeUndefined();
    expect(rows.find((row) => row.verse.id === 'verse-035')).toBeUndefined();
  });
});

describe('getFixtureReferral：返佣视图（referral.json × assets/chains 元数据联结）', () => {
  const view = getFixtureReferral();

  it('头部字段：code / rate 换算 / friendsCount', () => {
    expect(view?.referralCode).toBe('R7K4M9');
    expect(view?.ratePercent).toBe(10); // 1000 bps ÷ 100
    expect(view?.friendsCount).toBe(28);
  });

  it('earned 首行联结：UUSD × Ethereum(1)，usd=amount×usdSample(1)', () => {
    expect(view?.earned[0]).toMatchObject({
      assetId: 'asset-002',
      symbol: 'UUSD',
      chainId: 1,
      chainName: 'Ethereum',
      amount: 1062.3,
      usd: 1062.3,
    });
  });

  it('totalEarnedUsd / pendingUsd = Σ amount×usdSample（跨链逐币求和）', () => {
    // earned：1062.30×1 + 0.0562×3050.42 + 0.0189×612.8；pending：34.56×1 + 0.0142×3050.42 + 0.24×612.8
    expect(view?.totalEarnedUsd).toBeCloseTo(1245.315524, 6);
    expect(view?.pendingUsd).toBeCloseTo(224.947964, 6);
  });

  it('transactions 保序联结：首笔 rebate=UUSD 14.72（usd 同价）', () => {
    const tx = view?.transactions[0];
    expect(tx?.chainName).toBe('Ethereum');
    expect(tx?.rebate).toMatchObject({ symbol: 'UUSD', amount: 14.72, usd: 14.72 });
    expect(tx?.at).toBe('2026-09-30T09:12:00Z');
  });
});

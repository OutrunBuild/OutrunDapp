// Direct assertions on re-derived getters: of the 24 get* getters, this
// covers the four heaviest aggregations, whose join/filter/sum derivations
// would otherwise only be locked indirectly via e2e visual baselines.
// Ledger values come from fixtures/data/{participations,referral,assets,chains}.json;
// number changes must update this test in sync.
import { describe, expect, it } from 'vitest';

import {
  getPortfolioActions,
  getReferral,
  getSnapshot,
  getVaultRows,
  getParticipationRows,
} from '../../lib/data/fixture-repository';

describe('getVaultRows: yield inventory (staking x verse join)', () => {
  const rows = getVaultRows();

  it('lists only held positions (myShares>0) in ascending verseId order', () => {
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.myShares > 0)).toBe(true);
    const ids = rows.map((row) => row.verse.id);
    expect([...ids].sort((a, b) => a.localeCompare(b))).toEqual(ids);
  });

  it('shareSymbol = s+symbol; readyUsd = readyTotal x currentPrice (null when no sample price)', () => {
    const verses = new Map(getSnapshot().verses.map((verse) => [verse.id, verse]));
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

describe('getPortfolioActions: todo aggregation', () => {
  const actions = getPortfolioActions();

  it('sorting: deadline-bounded actions first ascending by remaining time, open-ended last', () => {
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

  it('refund card: amount = total participation for the verse (in UAsset), no deadline', () => {
    const refunds = actions.filter((action) => action.kind === 'refund');
    expect(refunds.map((action) => action.verse?.id).sort()).toEqual([
      'verse-004',
      'verse-015',
      'verse-035',
    ]);
    const byId = new Map(refunds.map((action) => [action.verse?.id ?? '', action.amount]));
    // part-002..004: 15000 normal + 45000 leverage + 8000 preorder
    expect(byId.get('verse-004')).toBe(68_000);
    expect(byId.get('verse-015')).toBe(95_000); // part-005
    // part-006/007: 60000 normal + 12000 leverage
    expect(byId.get('verse-035')).toBe(72_000);
    expect(refunds.every((action) => action.deadline == null && action.remainingMs == null)).toBe(
      true,
    );
  });

  it('vault-ready aggregate card: count = verses with matured redemptions, amountUsd = readyUsd sum', () => {
    const ready = getVaultRows().filter((row) => row.readyTotal > 0);
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

describe('getParticipationRows: participation rows (grouped by lifecycle)', () => {
  const rows = getParticipationRows();

  it('group order genesis -> locked -> unlocked; refunds handled by the todo aggregation, never in rows', () => {
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((row) => row.verse.stage === 'refund')).toBe(false);
    const order: Record<string, number> = { genesis: 0, locked: 1, unlocked: 2 };
    const stages = rows.map((row) => order[row.verse.stage]);
    expect([...stages].sort((a, b) => a - b)).toEqual(stages);
  });

  it('genesis rows split by kind: MOON = 12000 all normal on stake path (part-001)', () => {
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

  it('participations in refund-stage verses excluded from rows (FLOP/RRAD/SWHL absent)', () => {
    expect(rows.find((row) => row.verse.id === 'verse-004')).toBeUndefined();
    expect(rows.find((row) => row.verse.id === 'verse-015')).toBeUndefined();
    expect(rows.find((row) => row.verse.id === 'verse-035')).toBeUndefined();
  });
});

describe('getReferral: rebate view (referral.json x assets/chains metadata join)', () => {
  const view = getReferral();

  it('header fields: code / rate conversion / friendsCount', () => {
    expect(view?.referralCode).toBe('R7K4M9');
    expect(view?.ratePercent).toBe(10); // 1000 bps ÷ 100
    expect(view?.friendsCount).toBe(28);
  });

  it('earned first row join: UUSD on Ethereum(1), usd = amount x usdPrice(1)', () => {
    expect(view?.earned[0]).toMatchObject({
      assetId: 'asset-002',
      symbol: 'UUSD',
      chainId: 1,
      chainName: 'Ethereum',
      amount: 1062.3,
      usd: 1062.3,
    });
  });

  it('totalEarnedUsd / pendingUsd = sum of amount x usdPrice (across chains and tokens)', () => {
    // earned: 1062.30×1 + 0.0562×3050.42 + 0.0189×612.8; pending: 34.56×1 + 0.0142×3050.42 + 0.24×612.8
    expect(view?.totalEarnedUsd).toBeCloseTo(1245.315524, 6);
    expect(view?.pendingUsd).toBeCloseTo(224.947964, 6);
  });

  it('transactions preserve order: first rebate = UUSD 14.72 (usd at same price)', () => {
    const tx = view?.transactions[0];
    expect(tx?.chainName).toBe('Ethereum');
    expect(tx?.rebate).toMatchObject({ symbol: 'UUSD', amount: 14.72, usd: 14.72 });
    expect(tx?.at).toBe('2026-09-30T09:12:00Z');
  });
});

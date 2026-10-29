// ReferralPage view-layer null-slot guards (onchain degradation): the adapter emits
// referralCode/ratePercent null on the onchain build; the page must hide the link panel,
// the rate stat cell, the split bar's you/protocol share and the {rate}-bearing step —
// never a fabricated 0% split or an empty-code /ref/ link. user-data-gate.test.ts renders
// this page only with fixture data (code/rate always present), so these branches had no pin.
import { createElement, type ReactNode } from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import { Writable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';

// Same as user-data-gate.test: the three header widgets depend on App Router /
// wallet context; stub them out to finish SSR render in a node environment
vi.mock('@/components/global/chain-selector-dialog', () => ({
  ChainSelectorDialog: () => createElement('div', { 'data-testid': 'chain-stub' }),
}));
vi.mock('@/components/global/wallet-control', () => ({
  WalletControl: () => createElement('div', { 'data-testid': 'wallet-stub' }),
}));
vi.mock('@/components/global/locale-menu', () => ({
  LocaleMenu: () => createElement('div', { 'data-testid': 'locale-stub' }),
}));

// Connected: the link panel and stats cluster sit inside UserDataGate — the null-slot
// guards only become observable with the gate open
let mockConnected = false;
vi.mock('@/components/global/use-account-center', () => ({
  useAccountCenter: () => ({ connected: mockConnected }),
}));

// Controllable onchain-empty referral: ratePercent null (snapshot read failed) vs 0
// (owner-legal configuration) — the two states the view must never conflate
const referralState = vi.hoisted(() => ({ ratePercent: null as number | null }));
vi.mock('@/lib/data/fixture-repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/data/fixture-repository')>();
  return {
    ...actual,
    getReferral: async () => ({
      owner: '',
      referralCode: null,
      ratePercent: referralState.ratePercent,
      totalEarnedUsd: 0,
      pendingUsd: 0,
      friendsCount: 0,
      earned: [],
      pending: [],
      transactions: [],
      friends: [],
    }),
    getDisplayAccount: async () => ({ address: null }),
  };
});

import { ReferralPage } from '../../components/referral/referral-page';

// Same streaming render as user-data-gate.test: the page tree embeds async children
// (OutrunShell), so legacy renderToString throws on suspension
function renderAsync(node: ReactNode): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let html = '';
    const sink = new Writable({
      write(chunk, _enc, cb) {
        html += chunk;
        cb();
      },
    });
    const { pipe } = renderToPipeableStream(node, {
      onAllReady() {
        pipe(sink);
        sink.end(() => resolve(html));
      },
      onError(e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    });
  });
}

describe('referral view-layer null-slot guards (onchain degradation)', () => {
  it('unknown rate: hides link panel, rate cell, you/protocol share and the {rate} step', async () => {
    mockConnected = true;
    referralState.ratePercent = null;
    const html = await renderAsync(await ReferralPage({ locale: 'en', host: 'localhost:3000' }));
    // empty code → the whole link panel stays out (never an empty-code /ref/ link)
    expect(html).not.toContain('ref-link');
    // unknown rate → no "Rebate Rate" cell
    expect(html).not.toContain('Rebate Rate');
    // split degrades to the fixed LP share only — no fabricated you/protocol segments
    expect(html).toContain('aria-label="LP 65%"');
    expect(html).not.toContain('ref-split__seg--protocol');
    expect(html).not.toContain('ref-split__seg--you');
    expect(html).not.toContain('ref-split__dot--protocol');
    expect(html).not.toContain('ref-split__dot--you');
    // the rate-bearing step drops; numbering stays contiguous (01, 02)
    expect(html).not.toContain('You earn');
    expect(html).toContain('>02<');
    expect(html).not.toContain('>03<');
    // the mechanism intro itself stays
    expect(html).toContain('ref-how');
    expect(html).toContain('ref-split');
    mockConnected = false;
  });

  it('owner-legal 0% renders honestly, never conflated with the null slot', async () => {
    mockConnected = true;
    referralState.ratePercent = 0;
    const html = await renderAsync(await ReferralPage({ locale: 'en', host: 'localhost:3000' }));
    expect(html).toContain('Rebate Rate');
    expect(html).toContain('You earn 0%');
    expect(html).toContain('aria-label="LP 65% · Protocol 35% · You 0%"');
    // the code has no on-chain source at any rate — the panel stays hidden
    expect(html).not.toContain('ref-link');
    mockConnected = false;
  });
});

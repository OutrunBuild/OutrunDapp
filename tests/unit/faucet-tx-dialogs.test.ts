// @vitest-environment jsdom
// Faucet write-feedback pair (2026-10-26 用户裁定): execution progress lives in its own
// button-less dialog — never a strip appended to the action dialog — and confirmed yields
// to the success dialog, the last one. The success dialog is the site-generic
// TxSuccessDialog (participation-genesis receipt anatomy). These suites pin both halves.
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

import type { Faucet, Locale } from '../../lib/data/fixture-repository';
import { FaucetSwapDialog } from '../../components/faucet/faucet-swap-dialog';
import { TxProgressDialog } from '../../components/global/tx-progress-dialog';
import { TxSuccessDialog } from '../../components/global/tx-success-dialog';

// Controlled write-flow state shared by the use-psm-swap mock.
const psmState = vi.hoisted(() => ({
  tx: {
    active: false,
    display: 'idle' as string,
    reviewing: false,
    running: false,
    context: { txHash: null, review: null },
    reset: () => undefined,
  },
}));

vi.mock('@/components/global/use-psm-swap', () => ({
  usePsmSwap: () => ({
    center: {
      source: 'harness',
      connected: false,
      address: null,
      chainId: null,
      chainSupported: false,
      connectAction: () => undefined,
    },
    connected: false,
    toggle: () => undefined,
    tx: psmState.tx,
    executionReady: false,
    start: async () => undefined,
    resolving: false,
    resolveFailed: false,
    walletUnsupported: false,
    executionFailed: false,
  }),
}));

vi.mock('@/components/global/use-account-center', () => ({
  useAccountCenter: () => ({
    source: 'harness',
    connected: false,
    address: null,
    chainId: null,
    connectAction: () => undefined,
  }),
}));

vi.mock('@/components/global/use-tx-center', () => ({
  useTxCenter: () => psmState.tx,
  useClearOnConfirmed: () => undefined,
}));

vi.mock('@/lib/web3/active-provider', () => ({
  getActiveEip1193Provider: () => null,
  useActiveEip1193Provider: () => null,
}));

const SWAP: Faucet['swap'] = {
  uAssetSymbol: 'UUSD',
  reserveSymbol: 'USDC',
  feeIn: 0.001,
  feeOut: 0.002,
  feeInWad: null,
  feeOutWad: null,
  headroom: 900_000,
  myUAsset: 50,
  myReserve: 120,
};

function renderSwap() {
  return render(createElement(FaucetSwapDialog, { locale: 'en' as Locale, swap: SWAP }));
}

afterEach(() => {
  cleanup();
  psmState.tx.active = false;
  psmState.tx.display = 'idle';
});

describe('TxProgressDialog', () => {
  it('renders the three-step strip with no body button', () => {
    render(
      createElement(TxProgressDialog, {
        locale: 'en',
        title: 'Claim',
        state: 'signing',
        open: true,
        onDismiss: () => undefined,
      }),
    );
    expect(screen.getByText('Waiting for signature')).toBeTruthy();
    expect(screen.getByText('Confirming on-chain')).toBeTruthy();
    // The progress dialog never carries a Done/Close CTA; the shell ✕ stays the only
    // dismissal.
    expect(document.querySelector('.tx-progress-body button')).toBeNull();
  });
});

describe('TxSuccessDialog (site-generic receipt)', () => {
  it('renders the participation receipt anatomy: check plate, two-tone title, rows, hash link, close CTA', () => {
    render(
      createElement(TxSuccessDialog, {
        locale: 'en',
        title: 'Claim successful',
        lead: 'Claim ',
        accent: 'Success',
        rows: [
          { label: 'USDC', value: '1,000 USDC' },
          { label: 'UUSD', value: '999 UUSD' },
        ],
        txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        txChainId: 97,
        open: true,
        onOpenChange: () => undefined,
      }),
    );
    expect(screen.getByText('Claim successful')).toBeTruthy();
    expect(screen.getByText('Success')).toBeTruthy();
    expect(document.querySelectorAll('.tx-success__row')).toHaveLength(2);
    expect(screen.getByText('1,000 USDC')).toBeTruthy();
    // Explorer receipt link for a resolvable chain.
    const hashLink = document.querySelector<HTMLAnchorElement>('.tx-success__hash');
    expect(hashLink?.href).toContain('/tx/0x123456');
    // The close CTA sits in the receipt body (the shell ✕ carries the same label).
    expect(document.querySelector('.tx-success button')?.textContent).toBe('Close');
  });
});

describe('FaucetSwapDialog feedback wiring', () => {
  it('shows the strip in its own dialog while the action dialog body stays closed', () => {
    psmState.tx.active = true;
    psmState.tx.display = 'signing';
    renderSwap();
    expect(screen.getByText('Waiting for signature')).toBeTruthy();
    // The action dialog never opened, so the strip is not appended to its body.
    expect(screen.queryByText('You receive')).toBeNull();
  });

  it('confirmed yields the progress dialog to the success dialog', async () => {
    psmState.tx.active = true;
    psmState.tx.display = 'confirming';
    const view = renderSwap();
    expect(screen.getByText('Confirming on-chain')).toBeTruthy();
    psmState.tx.display = 'confirmed';
    view.rerender(createElement(FaucetSwapDialog, { locale: 'en' as Locale, swap: SWAP }));
    await waitFor(() => expect(screen.getByText('Swap complete')).toBeTruthy());
    // The success receipt replaced the strip (the mocked reset is a no-op, so the
    // `!successOpen` guard is what closed the progress dialog).
    expect(screen.queryByText('Confirmed')).toBeNull();
  });
});

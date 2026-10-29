// @vitest-environment jsdom
// Symbol occupancy wiring: the debounced probe effect and the submit-time fail-closed gate. The
// pure-function seams are pinned in create-symbol-occupancy.test.ts; this file pins the branches
// those seams feed — including the one the high-risk tier rests on: buildAndStart must neither
// price nor send a registration whose symbol the hub reports as taken.
import { createElement } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { CreateForm } from '../../components/create/create-form';
import type { Asset, ChainInfo, CreateConfig, Locale } from '../../lib/data/fixture-repository';

// BSC Testnet is the only deployment carrying a MemeverseRegistrationCenter, so the governance
// chain resolves to its own testnet twin and the real client chain config stays usable (no ENV
// dependence, no mocked chain registry).
const GOV_CHAIN_ID = 97;

const probeState = vi.hoisted(() => ({
  readSymbolAvailable: vi.fn(async (_symbol: string) => null as boolean | null),
  // bigint | null: the submit-time re-quote leg feeds totalFee == null fail-closed, so tests
  // must be able to stage a null quote without fighting the mock's type.
  quoteRegistrationFanOut: vi.fn(async (): Promise<bigint | null> => 1n),
  executeSession: vi.fn(),
}));

// Mutable wallet shape so the confirm-gate variants below can arm/disarm the review card;
// defaults match the armed happy path the older tests were written against.
const centerState = vi.hoisted(() => ({
  source: 'real' as 'real' | 'harness',
  connected: true,
  chainId: 97,
  chainSupported: true,
}));

// The wrong-chain gate test renders SwitchChainCta, whose click dials the provider switch;
// the hoisted fn lets the test assert the swap call instead of only the button's presence.
const providerState = vi.hoisted(() => ({
  switchProviderChain: vi.fn(async () => 'switched' as const),
}));

vi.mock('../../components/global/execution-reads', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../components/global/execution-reads')>();
  return {
    ...actual,
    readSymbolAvailable: (
      _reader: unknown,
      _center: unknown,
      symbol: string,
    ): Promise<boolean | null> => probeState.readSymbolAvailable(symbol),
    quoteRegistrationFanOut: (): Promise<bigint | null> => probeState.quoteRegistrationFanOut(),
  };
});

vi.mock('../../components/global/use-account-center', () => ({
  useAccountCenter: () => ({
    source: centerState.source,
    connected: centerState.connected,
    address: '0x1111111111111111111111111111111111111111',
    chainId: centerState.chainId,
    chainSupported: centerState.chainSupported,
    connectAction: () => undefined,
    switchChainAction: () => undefined,
  }),
}));

vi.mock('@/components/global/use-tx-center', () => ({
  useTxCenter: () => ({
    display: 'idle',
    running: false,
    reviewing: false,
    active: false,
    context: { txHash: null, review: null },
    reset: () => undefined,
    executeSession: probeState.executeSession,
  }),
}));

// The hub reads ride the wallet provider, so a bare transport is enough here — the reader seam is
// mocked above and never reaches the network.
vi.mock('@/lib/web3/active-provider', () => ({
  getActiveEip1193Provider: () => ({ request: async () => undefined }),
  useActiveEip1193Provider: () => ({ request: async () => undefined }),
  switchProviderChain: providerState.switchProviderChain,
}));

const ASSETS: Asset[] = [{ id: 'ueth', sourceRef: 'test', symbol: 'UETH' }];
const CHAINS: ChainInfo[] = [
  {
    chainId: GOV_CHAIN_ID,
    name: 'BNB Smart Chain Testnet',
    env: 'testnet',
    nativeSymbol: 'BNB',
    sourceRef: 'test',
  },
];
const CONFIG: CreateConfig = {
  minDurationDays: 1,
  maxDurationDays: 3,
  lockupDays: 365,
  sourceRef: 'test',
};

function renderForm() {
  return render(
    createElement(CreateForm, {
      locale: 'en' as Locale,
      assets: ASSETS,
      chains: CHAINS,
      walletChains: CHAINS,
      config: CONFIG,
      occupiedSymbols: [],
    }),
  );
}

/** A complete, valid registration shape — everything the submit gate reads except the symbol. */
function fillForm(container: HTMLElement, symbol: string) {
  fireEvent.change(container.querySelector('#create-logo') as HTMLInputElement, {
    target: {
      files: [new File([new Uint8Array([1, 2, 3])], 'logo.png', { type: 'image/png' })],
    },
  });
  fireEvent.change(screen.getByPlaceholderText('Enter token name…'), {
    target: { value: 'Moon Verse' },
  });
  fireEvent.change(screen.getByPlaceholderText('Enter token symbol'), {
    target: { value: symbol },
  });
  fireEvent.change(container.querySelector('#create-duration') as HTMLInputElement, {
    target: { value: '2' },
  });
  fireEvent.change(screen.getByPlaceholderText('What is this community about…'), {
    target: { value: 'A memeverse' },
  });
}

beforeAll(() => {
  // jsdom ships neither; the logo picker creates an object URL on every accepted file.
  URL.createObjectURL = vi.fn(() => 'blob:test-logo');
  URL.revokeObjectURL = vi.fn();
});

beforeEach(() => {
  centerState.source = 'real';
  centerState.connected = true;
  centerState.chainId = GOV_CHAIN_ID;
  centerState.chainSupported = true;
  providerState.switchProviderChain.mockClear();
  probeState.readSymbolAvailable.mockReset();
  probeState.readSymbolAvailable.mockResolvedValue(null);
  probeState.quoteRegistrationFanOut.mockClear();
  probeState.executeSession.mockClear();
});

afterEach(cleanup);

describe('symbol occupancy probe (debounced inline hint)', () => {
  it('reports an occupied symbol inline once the probe answers false', async () => {
    probeState.readSymbolAvailable.mockResolvedValue(false);
    renderForm();

    fireEvent.change(screen.getByPlaceholderText('Enter token symbol'), {
      target: { value: 'MOON' },
    });

    await waitFor(() =>
      expect(screen.getByText('Symbol is temporarily taken. Please try again later.')).toBeTruthy(),
    );
    // The probe is per-candidate: it must be asked about the symbol actually being typed.
    expect(probeState.readSymbolAvailable).toHaveBeenCalledWith('MOON');
  });

  it('stays silent while the probe is unresolved', async () => {
    probeState.readSymbolAvailable.mockResolvedValue(null);
    renderForm();

    fireEvent.change(screen.getByPlaceholderText('Enter token symbol'), {
      target: { value: 'MOON' },
    });
    await waitFor(() => expect(probeState.readSymbolAvailable).toHaveBeenCalledWith('MOON'));

    expect(screen.queryByText('Symbol is temporarily taken. Please try again later.')).toBeNull();
  });

  // previewRegistration mirrors registration's InvalidLength gate (.sol:115) and answers false for
  // an empty symbol — the byte-limit error owns that state, not the occupancy hint.
  it('never probes outside the contract length window', async () => {
    probeState.readSymbolAvailable.mockResolvedValue(false);
    const { container } = renderForm();
    fireEvent.change(screen.getByPlaceholderText('Enter token symbol'), {
      target: { value: 'M' },
    });
    await waitFor(() => expect(probeState.readSymbolAvailable).toHaveBeenCalledWith('M'));
    probeState.readSymbolAvailable.mockClear();

    fireEvent.change(screen.getByPlaceholderText('Enter token symbol'), { target: { value: '' } });
    await new Promise((resolve) => setTimeout(resolve, 600));

    expect(probeState.readSymbolAvailable).not.toHaveBeenCalled();
    expect(container.querySelector('#create-symbol')).toBeTruthy();
  });

  // Same guard, over-long end of the window: >31 bytes is InvalidLength territory that the
  // byte-limit error owns — the probe must not spend an RPC the derivation will discard.
  it('never probes an over-long symbol either', async () => {
    probeState.readSymbolAvailable.mockResolvedValue(false);
    const { container } = renderForm();
    fireEvent.change(screen.getByPlaceholderText('Enter token symbol'), {
      target: { value: 'M' },
    });
    await waitFor(() => expect(probeState.readSymbolAvailable).toHaveBeenCalledWith('M'));
    probeState.readSymbolAvailable.mockClear();

    fireEvent.change(screen.getByPlaceholderText('Enter token symbol'), {
      target: { value: 'M'.repeat(32) },
    });
    await new Promise((resolve) => setTimeout(resolve, 600));

    expect(probeState.readSymbolAvailable).not.toHaveBeenCalled();
    expect(container.querySelector('#create-symbol')).toBeTruthy();
  });

  // Per-candidate freshness: the moment the symbol moves, the previous candidate's verdict must
  // stop gating — a stale "taken" would pin the hint to an input the user already left.
  it('drops a stale verdict once the symbol moves and re-probes the new candidate', async () => {
    let resolveNext: (value: boolean | null) => void = () => undefined;
    probeState.readSymbolAvailable.mockImplementation((symbol: string) => {
      if (symbol === 'MOON') return Promise.resolve(false);
      return new Promise<boolean | null>((resolve) => {
        resolveNext = resolve;
      });
    });
    renderForm();

    fireEvent.change(screen.getByPlaceholderText('Enter token symbol'), {
      target: { value: 'MOON' },
    });
    await waitFor(() =>
      expect(screen.getByText('Symbol is temporarily taken. Please try again later.')).toBeTruthy(),
    );

    fireEvent.change(screen.getByPlaceholderText('Enter token symbol'), {
      target: { value: 'NOON' },
    });
    await waitFor(() => expect(probeState.readSymbolAvailable).toHaveBeenCalledWith('NOON'));
    // NOON's probe is still pending, so the hint must be gone: MOON's verdict is stale.
    expect(screen.queryByText('Symbol is temporarily taken. Please try again later.')).toBeNull();

    // Only the fresh NOON verdict may bring the hint back.
    resolveNext(false);
    await waitFor(() =>
      expect(screen.getByText('Symbol is temporarily taken. Please try again later.')).toBeTruthy(),
    );
  });
});

describe('submit-time re-probe (fail-closed gate)', () => {
  it('prices and sends nothing when the re-probe answers false', async () => {
    probeState.readSymbolAvailable.mockResolvedValueOnce(null); // debounced hint: unresolved
    probeState.readSymbolAvailable.mockResolvedValue(false); // submit-time re-probe: taken
    const { container } = renderForm();

    fillForm(container, 'MOON');
    // Let the debounced probe land first, so the submit read is unambiguously the second call.
    await waitFor(() => expect(probeState.readSymbolAvailable).toHaveBeenCalledWith('MOON'));

    fireEvent.click(screen.getByRole('button', { name: 'Launch' }));
    await screen.findByText('Confirm Your Registration');
    // The debounced fee-card quote already ran while typing; clear it so the assertion below can
    // only be satisfied by the submit-time re-quote inside buildAndStart.
    probeState.quoteRegistrationFanOut.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    // The review card names the deterministic cause: an occupied block shows the symbolTaken
    // copy, not the generic transient-failure degrade copy.
    await waitFor(() =>
      expect(screen.getByText('Symbol is temporarily taken. Please try again later.')).toBeTruthy(),
    );
    // The gate sits before the quote, so an occupied symbol is never priced...
    expect(probeState.quoteRegistrationFanOut).not.toHaveBeenCalled();
    // ...and never funds or broadcasts a transaction.
    expect(probeState.executeSession).not.toHaveBeenCalled();
  });

  it('proceeds to the quote when the re-probe answers true', async () => {
    probeState.readSymbolAvailable.mockResolvedValue(true);
    const { container } = renderForm();

    fillForm(container, 'MOON');
    await waitFor(() => expect(probeState.readSymbolAvailable).toHaveBeenCalledWith('MOON'));

    fireEvent.click(screen.getByRole('button', { name: 'Launch' }));
    await screen.findByText('Confirm Your Registration');
    probeState.quoteRegistrationFanOut.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(probeState.quoteRegistrationFanOut).toHaveBeenCalled());
    expect(screen.queryByText(/the request failed/i)).toBeNull();
  });

  it('lets an unreadable re-probe pass through to the quote', async () => {
    probeState.readSymbolAvailable.mockResolvedValueOnce(null); // debounced hint: unresolved
    probeState.readSymbolAvailable.mockResolvedValueOnce(null); // submit-time re-probe: unreadable
    const { container } = renderForm();

    fillForm(container, 'MOON');
    await waitFor(() => expect(probeState.readSymbolAvailable).toHaveBeenCalledWith('MOON'));

    fireEvent.click(screen.getByRole('button', { name: 'Launch' }));
    await screen.findByText('Confirm Your Registration');
    probeState.quoteRegistrationFanOut.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    // The gate only blocks a definite `false`: null is an unresolved verdict, and tightening the
    // check to `!== true` would strand creation on every RPC hiccup. Wait out the full submit
    // chain (executeSession is buildAndStart's last call) before asserting error-absence, so a
    // post-quote throw cannot dodge the snapshot check through a render race.
    await waitFor(() => expect(probeState.quoteRegistrationFanOut).toHaveBeenCalled());
    await waitFor(() => expect(probeState.executeSession).toHaveBeenCalled());
    expect(screen.queryByText(/the request failed/i)).toBeNull();
  });

  it('keeps the generic failure copy when the re-quote answers null', async () => {
    probeState.readSymbolAvailable.mockResolvedValue(true); // submit-time re-probe: free
    const { container } = renderForm();

    fillForm(container, 'MOON');
    await waitFor(() => expect(probeState.readSymbolAvailable).toHaveBeenCalledWith('MOON'));

    fireEvent.click(screen.getByRole('button', { name: 'Launch' }));
    await screen.findByText('Confirm Your Registration');
    // The debounced fee-card quote already ran while typing; clear it so the null below can only
    // reach buildAndStart's submit-time re-quote.
    probeState.quoteRegistrationFanOut.mockClear();
    probeState.quoteRegistrationFanOut.mockResolvedValueOnce(null);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(screen.getByText(/the request failed/i)).toBeTruthy());
    expect(probeState.executeSession).not.toHaveBeenCalled();
  });
});

describe('review re-entry (stale resolve verdict hygiene)', () => {
  // The review card renders resolveFailed unconditionally, so re-entering review must show only
  // the current round's verdict: a stale 'occupied' from an earlier Confirm would name a symbol
  // the hub no longer reports as taken. handleSubmit is the only entry into reviewing, so the
  // clear must happen there (create-form.tsx, setResolveFailed(null) before setReviewing(true)).
  it('clears the occupied slot when the form re-enters review after a failed submit', async () => {
    probeState.readSymbolAvailable.mockResolvedValueOnce(null); // debounced hint: unresolved
    probeState.readSymbolAvailable.mockResolvedValue(false); // submit-time re-probe: taken
    const { container } = renderForm();

    fillForm(container, 'MOON');
    // Let the debounced probe land unresolved first, or its verdict would block the launch gate.
    await waitFor(() => expect(probeState.readSymbolAvailable).toHaveBeenCalledWith('MOON'));

    fireEvent.click(screen.getByRole('button', { name: 'Launch' }));
    await screen.findByText('Confirm Your Registration');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() =>
      expect(screen.getByText('Symbol is temporarily taken. Please try again later.')).toBeTruthy(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Revise' }));
    // The occupied fail path also writes the probe verdict for the unchanged symbol, so
    // relaunching as-is would be blocked by the submit gate — retype a fresh candidate and let
    // its free verdict land before relaunching.
    probeState.readSymbolAvailable.mockResolvedValue(true);
    fireEvent.change(screen.getByPlaceholderText('Enter token symbol'), {
      target: { value: 'NOON' },
    });
    await waitFor(() => expect(probeState.readSymbolAvailable).toHaveBeenCalledWith('NOON'));
    await waitFor(() =>
      expect(screen.queryByText('Symbol is temporarily taken. Please try again later.')).toBeNull(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Launch' }));
    await screen.findByText('Confirm Your Registration');
    // Before the next Confirm runs, nothing on the review card may name the previous round's
    // occupied verdict.
    expect(screen.queryByText('Symbol is temporarily taken. Please try again later.')).toBeNull();
  });
});

describe('review confirm gate (disabled state mirrors the handler guard)', () => {
  it('keeps both buttons with Confirm disabled for a harness wallet (prototype baseline)', async () => {
    centerState.source = 'harness';
    const { container } = renderForm();

    fillForm(container, 'MOON');
    fireEvent.click(screen.getByRole('button', { name: 'Launch' }));
    await screen.findByText('Confirm Your Registration');

    expect((screen.getByRole('button', { name: 'Confirm' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('swaps Confirm for the in-place switch CTA when a real wallet is parked off the gov exec chain', async () => {
    centerState.chainId = 1;
    const { container } = renderForm();

    fillForm(container, 'MOON');
    fireEvent.click(screen.getByRole('button', { name: 'Launch' }));
    await screen.findByText('Confirm Your Registration');

    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to BNB Smart Chain Testnet' }));
    await waitFor(() =>
      expect(providerState.switchProviderChain).toHaveBeenCalledWith(GOV_CHAIN_ID),
    );
  });

  it('arms Confirm once the real wallet sits on the gov exec chain', async () => {
    const { container } = renderForm();

    fillForm(container, 'MOON');
    fireEvent.click(screen.getByRole('button', { name: 'Launch' }));
    await screen.findByText('Confirm Your Registration');

    expect((screen.getByRole('button', { name: 'Confirm' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
});

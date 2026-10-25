// @vitest-environment jsdom
// Lifecycle regression: a custom (possibly invalid) gas selection must not survive into
// the next review window — otherwise every new window opens with Confirm pre-blocked.
import { act, render, waitFor } from '@testing-library/react';
import { createElement, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Hex } from 'viem';

import {
  isCustomGasValid,
  useGasQuote,
  type GasQuote,
} from '../../../components/global/use-gas-quote';

vi.mock('@privy-io/react-auth', () => ({
  useWallets: () => ({
    wallets: [{ address: '0x1111111111111111111111111111111111111111', walletClientType: 'privy' }],
  }),
}));

vi.mock('../../../lib/web3/active-provider', () => ({
  useActiveEip1193Provider: () => ({
    request: async ({ method }: { method: string }) => {
      if (method === 'eth_gasPrice') return '0x5f5e100';
      if (method === 'eth_maxPriorityFeePerGas') return '0x5f5e100';
      if (method === 'eth_getBlockByNumber') return { baseFeePerGas: '0x0' };
      throw new Error(`unexpected ${method}`);
    },
  }),
}));

vi.mock('../../../lib/web3/viem-type4-adapter', () => ({
  resolveType4GasLimit: async () => 400_000n,
}));

vi.mock('../../../lib/web3/native-price', () => ({
  readNativeUsdPrice: async () => null,
}));

const EOA = '0x1111111111111111111111111111111111111111' as Hex;
const KERNEL = '0xd6CEDDe84be40893d153Be9d467CD6aD37875b28' as Hex;

function Harness({ onQuote }: { onQuote: (q: GasQuote) => void }) {
  const [active, setActive] = useState(true);
  const quote = useGasQuote({
    locale: 'en',
    chainId: 97,
    eoa: EOA,
    kernel: KERNEL,
    data: '0x1234' as Hex,
    active,
    resetToken: active,
    onResolved: () => {},
  });
  onQuote(quote);
  return createElement('button', { type: 'button', onClick: () => setActive((v) => !v) }, 'toggle');
}

describe('isCustomGasValid', () => {
  it('requires a positive total that covers the next base fee', () => {
    expect(isCustomGasValid({ base: 0n, tip: 100n, nextBase: 0n })).toBe(true); // BSC, base 0
    expect(isCustomGasValid({ base: 0n, tip: 0n, nextBase: 0n })).toBe(false);
    expect(isCustomGasValid({ base: 10n, tip: 5n, nextBase: 20n })).toBe(false); // under base fee
    expect(isCustomGasValid({ base: 20n, tip: 5n, nextBase: 20n })).toBe(true);
    expect(isCustomGasValid({ base: null, tip: 5n, nextBase: 20n })).toBe(false);
  });
});

describe('useGasQuote window lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resets a custom selection to the average preset when a new window opens', async () => {
    let quote: GasQuote | null = null;
    const { getByText, unmount } = render(
      createElement(Harness, {
        onQuote: (q: GasQuote) => {
          quote = q;
        },
      }),
    );

    await waitFor(() => expect(quote?.ready).toBe(true));

    // Invalid custom price (empty priority) — the state a user can leave behind.
    act(() => quote!.toggleCustom());
    act(() => quote!.setBase('0.1'));
    act(() => quote!.setTip(''));
    await waitFor(() => expect(quote!.mode).toBe('custom'));
    expect(quote!.invalid).toBe(true);

    // Close the window (active=false), then open a fresh one.
    act(() => getByText('toggle').click());
    act(() => getByText('toggle').click());

    await waitFor(() => expect(quote!.mode).toBe('market'));
    expect(quote!.invalid).toBe(false);

    // The polling interval reads `document`; unmounting clears it before the jsdom
    // environment tears down (otherwise it can fire with no window and surface as an
    // unhandled error).
    unmount();
  });
});

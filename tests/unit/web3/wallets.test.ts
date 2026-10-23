// Wallet list ordering/dedup contract tests (stage 6 step 2, architecture.md §7):
// EIP-6963 discovered group first, then WalletConnect, then embedded create/recover;
// dedup by provider UUID/RDNS; a generic "Injected Wallet" row disappears once a specific
// wallet is discovered.
import { describe, expect, it } from 'vitest';

import { orderWalletOptions, type DiscoveredWallet } from '../../../lib/web3/wallets';

const metamask: DiscoveredWallet = {
  uuid: 'uuid-mm',
  name: 'MetaMask',
  icon: 'data:image/png;base64,mm',
  rdns: 'io.metamask',
};
const okx: DiscoveredWallet = {
  uuid: 'uuid-okx',
  name: 'OKX Wallet',
  icon: 'data:image/png;base64,okx',
  rdns: 'com.okex.wallet',
};
const injected: DiscoveredWallet = {
  uuid: 'uuid-injected',
  name: 'Injected Wallet',
  icon: 'data:image/png;base64,in',
  rdns: 'injected',
};

describe('orderWalletOptions', () => {
  it('orders discovered → walletconnect → embedded', () => {
    expect(
      orderWalletOptions({
        discovered: [okx, metamask],
        walletConnectAvailable: true,
        embeddedAvailable: true,
      }),
    ).toEqual([
      { kind: 'discovered', ...okx },
      { kind: 'discovered', ...metamask },
      { kind: 'walletconnect' },
      { kind: 'embedded' },
    ]);
  });

  it('dedupes by UUID and by RDNS', () => {
    const entries = orderWalletOptions({
      discovered: [metamask, { ...metamask, name: 'MetaMask copy' }, { ...okx, uuid: '' }],
      walletConnectAvailable: false,
      embeddedAvailable: false,
    });
    expect(entries).toHaveLength(2);
  });

  it('drops the generic Injected row once a specific wallet is discovered', () => {
    const entries = orderWalletOptions({
      discovered: [injected, metamask],
      walletConnectAvailable: false,
      embeddedAvailable: true,
    });
    expect(entries).toEqual([{ kind: 'discovered', ...metamask }, { kind: 'embedded' }]);
  });

  it('keeps the generic row only when nothing specific was discovered', () => {
    expect(
      orderWalletOptions({
        discovered: [injected],
        walletConnectAvailable: false,
        embeddedAvailable: false,
      }),
    ).toEqual([{ kind: 'discovered', ...injected }]);
  });

  it('omits unavailable groups', () => {
    expect(
      orderWalletOptions({
        discovered: [],
        walletConnectAvailable: false,
        embeddedAvailable: true,
      }),
    ).toEqual([{ kind: 'embedded' }]);
  });
});

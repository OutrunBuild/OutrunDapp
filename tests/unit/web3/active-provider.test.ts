// Privy + wagmi assembly contract tests (stage 6 step 2):
// - app id resolves only from NEXT_PUBLIC_PRIVY_APP_ID (blank counts as missing)
// - the six wagmi chains are exactly the §5 chain set
// - transports carry no URLs: without an active wallet provider every chain fails closed;
//   with one, calls delegate to it (server keys never enter the client path)
import { describe, expect, it } from 'vitest';

import {
  buildChainTransports,
  buildPrivyConfig,
  buildWagmiConfig,
  getActiveEip1193Provider,
  getPrivyAppId,
  isWeb3Configured,
  setActiveEip1193Provider,
  WALLET_CHAINS,
} from '../../../lib/web3/active-provider';

describe('getPrivyAppId', () => {
  it('returns null when missing or blank', () => {
    expect(getPrivyAppId({})).toBeNull();
    expect(getPrivyAppId({ NEXT_PUBLIC_PRIVY_APP_ID: '   ' })).toBeNull();
  });

  it('trims and returns the configured id; secret-adjacent values are never read', () => {
    expect(getPrivyAppId({ NEXT_PUBLIC_PRIVY_APP_ID: '  test-app-id  ' })).toBe('test-app-id');
    expect(isWeb3Configured({})).toBe(false);
    expect(isWeb3Configured({ NEXT_PUBLIC_PRIVY_APP_ID: 'test-app-id' })).toBe(true);
  });
});

describe('buildWagmiConfig', () => {
  it('covers exactly the three §26 testnets (mainnets stay undeployed)', () => {
    expect(WALLET_CHAINS.map((chain) => chain.id)).toEqual([421614, 84532, 97]);
    const config = buildWagmiConfig();
    expect(config.chains.map((chain) => chain.id)).toEqual([421614, 84532, 97]);
  });

  it('fails closed on every chain without an active provider', async () => {
    setActiveEip1193Provider(null);
    const transports = buildChainTransports();
    for (const chain of WALLET_CHAINS) {
      const provider = await transports[chain.id]({ chain });
      await expect(provider.request({ method: 'eth_chainId' })).rejects.toThrow(
        'outrun: no active wallet provider',
      );
    }
  });

  it('delegates to the registered provider once one is active', async () => {
    setActiveEip1193Provider({
      request: async ({ method }) => (method === 'eth_chainId' ? '0x66eee' : null),
    });
    expect(getActiveEip1193Provider()).not.toBeNull();
    const transports = buildChainTransports();
    const provider = await transports[421614]({ chain: WALLET_CHAINS[0] });
    expect(await provider.request({ method: 'eth_chainId' })).toBe('0x66eee');
    setActiveEip1193Provider(null);
  });

  it('keeps class-prototype request methods bound (Privy embedded provider reads this)', async () => {
    // Privy embedded providers implement request() on the prototype and read
    // this.address/this.chainId inside it; a bare method reference loses this and
    // every wallet RPC throws TypeError (Faucet claimable probes all land false).
    class EmbeddedLike {
      address = '0xabc';
      async request({ method }: { method: string }): Promise<unknown> {
        if (method === 'eth_accounts') return [this.address];
        return null;
      }
    }
    const raw = new EmbeddedLike();
    // Sanity: extracting the reference (the viem custom({request}) pattern) breaks it.
    const naked = raw.request;
    await expect(
      (naked as (args: { method: string }) => Promise<unknown>)({ method: 'eth_accounts' }),
    ).rejects.toThrow();
    setActiveEip1193Provider(raw);
    const stored = getActiveEip1193Provider();
    // Consumers extract the reference exactly like viem custom({request}) does —
    // the stored wrapper must survive that.
    const extracted = stored?.request;
    expect(await extracted?.({ method: 'eth_accounts' })).toEqual(['0xabc']);
    setActiveEip1193Provider(null);
  });
});

describe('buildPrivyConfig', () => {
  it('mints embedded EOAs for users without a wallet and styles no modal', () => {
    const config = buildPrivyConfig();
    expect(config.loginMethods).toEqual(['google', 'twitter', 'wallet']);
    expect(config.embeddedWallets?.ethereum?.createOnLogin).toBe('users-without-wallets');
    expect('appearance' in config).toBe(false);
  });
});

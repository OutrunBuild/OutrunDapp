'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider as PrivyWagmiProvider } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';

import { buildPrivyConfig, buildWagmiConfig, getPrivyAppId } from '@/lib/web3/active-provider';
import { InjectedSessionRestore } from './injected-session-restore';
import { LoginSessionRestore } from './login-session-restore';

let cachedConfig: ReturnType<typeof buildWagmiConfig> | null = null;

function getConfig(): ReturnType<typeof buildWagmiConfig> {
  if (!cachedConfig) cachedConfig = buildWagmiConfig();
  return cachedConfig;
}

/**
 * Site-wide wallet providers (architecture.md §6/§7). Renders no DOM of its own.
 * The wagmi provider always mounts (disconnected reads stay safe); Privy mounts only with
 * NEXT_PUBLIC_PRIVY_APP_ID — without it (fixture mode, e2e, unprovisioned previews) every
 * wallet hook keeps seeing Disconnected.
 * reconnectOnMount restores a previously authorized session only — it never opens a
 * popup, requests accounts, or signs (CONNECTION_TRIGGER_POLICY).
 */
export function Web3Providers({ children }: { children: ReactNode }) {
  const appId = getPrivyAppId();
  const config = useMemo(getConfig, []);
  // wagmi hooks (account/chain reads) require a query client on every build, including
  // fixture/e2e builds where no wallet is ever connected.
  const [queryClient] = useState(() => new QueryClient());
  const wagmi = (
    <WagmiProvider config={config} reconnectOnMount={false}>
      {children}
    </WagmiProvider>
  );
  if (!appId) {
    return <QueryClientProvider client={queryClient}>{wagmi}</QueryClientProvider>;
  }
  return (
    <QueryClientProvider client={queryClient}>
      <PrivyProvider appId={appId} config={buildPrivyConfig()}>
        <PrivyWagmiProvider config={config} reconnectOnMount>
          <LoginSessionRestore />
          <InjectedSessionRestore />
          {children}
        </PrivyWagmiProvider>
      </PrivyProvider>
    </QueryClientProvider>
  );
}

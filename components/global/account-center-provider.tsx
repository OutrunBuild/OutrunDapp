'use client';

import { type ReactNode } from 'react';

import { AccountCenterContext, useAccountCenterImpl } from './use-account-center';

/**
 * Hosts the one AccountCenter instance for the whole shell: the 7s restore budget, the
 * account-cookie effect and the provider-registry registration run once per tree instead
 * of once per consuming dialog (wallet dual-track, lib/web3/README.md).
 */
export function AccountCenterProvider({ children }: { children: ReactNode }) {
  const account = useAccountCenterImpl();
  return <AccountCenterContext.Provider value={account}>{children}</AccountCenterContext.Provider>;
}

'use client'

import type { ReactNode } from 'react'

import { useAccountCenter } from './use-account-center'

/**
 * User-data gate: when there is no user participation (account center disconnected —
 * the only "participation" signal), the subtree is not rendered — the yield
 * portfolio/referral pages hide their data cards wholesale instead of showing zeros;
 * mechanism-introduction content (e.g. how referral works) is not governed by this
 * gate; pages keep it outside on their own.
 * Isomorphic with PortfolioZoneTabs/ReferralHistory: RSC-rendered panels come in via
 * children, and this component only toggles visibility; the SSR and first-client-frame
 * snapshots are always disconnected, so there is no hydration flicker.
 */
export function UserDataGate({ children }: { children: ReactNode }) {
  const { connected } = useAccountCenter()
  if (!connected) return null
  return <>{children}</>
}

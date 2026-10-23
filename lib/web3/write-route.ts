// Wallet routing for one write intent (pure, unit-tested).
// Embedded (Privy) → Kernel type-4 session; external → EIP-5792 legs when the spec
// carries them; direct → plain EOA write; anything else → unsupported (never a fake
// cancellation). 'unknown' (Privy has not listed the active address yet) keeps the
// pre-refactor embedded default: a slow wallet list must not misroute a Privy session.
export type WalletKind = 'embedded' | 'external' | 'unknown';

export type WriteRoute = 'direct' | 'session' | 'calls' | 'unsupported';

export type RoutableSpec = {
  direct?: unknown;
  calls?: readonly unknown[];
};

export function routeWrite(spec: RoutableSpec, walletKind: WalletKind): WriteRoute {
  if (spec.direct) return 'direct';
  if (walletKind === 'external') {
    return spec.calls && spec.calls.length > 0 ? 'calls' : 'unsupported';
  }
  return 'session';
}

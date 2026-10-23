// Login identity resolution (Login dialog refactor): maps the Privy user + the active
// wagmi address to the top-bar display rule — Google name (else email), X @username
// (else name), MetaMask (or unknown) falls back to the address (formatted by the caller).
// Last-used provider preference is a localStorage best-effort badge, never auth state.

// Structural OAuth user shape (mirrors the Privy User fields we read; avoids importing
// the Privy type into lib so unit tests stay dependency-free).
export type OAuthUser = {
  google?: { name: string | null; email: string } | null;
  twitter?: { username: string | null; name: string | null } | null;
} | null;

export type LoginProvider = 'google' | 'x' | 'metamask';

export type LoginIdentity = { provider: LoginProvider; name: string | null };

const LAST_LOGIN_KEY = 'outrun:last-login';

export function readLastLogin(): LoginProvider | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(LAST_LOGIN_KEY);
    return raw === 'google' || raw === 'x' || raw === 'metamask' ? raw : null;
  } catch {
    return null;
  }
}

export function rememberLastLogin(provider: LoginProvider): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(LAST_LOGIN_KEY, provider);
  } catch {
    // Private mode: the badge preference is best-effort, never auth state.
  }
}

/** Clear the last-used provider badge on intentional disconnect.
 * Display-layer hygiene only: the badge is a best-effort label preference, never
 * auth state. What actually exits the social path after logout is the emptied
 * address (resolver returns null without one) plus the dialog/session-restore
 * guards blocking re-link — the resolver still prefers a live user object when
 * the badge is absent, so clearing the badge alone never blocks anything. */
export function forgetLastLogin(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(LAST_LOGIN_KEY);
  } catch {
    // Private mode: nothing persisted, nothing to clear.
  }
}

export function resolveLoginIdentity(
  user: OAuthUser,
  address: string | null,
  lastLogin?: LoginProvider | null,
): LoginIdentity | null {
  if (!address) return null;
  // Last successful provider wins: a stored OAuth session plus an active MetaMask
  // connection must display the address, not the stale social name.
  if (lastLogin === 'google' && user?.google) {
    return { provider: 'google', name: user.google.name ?? user.google.email };
  }
  if (lastLogin === 'x' && user?.twitter) {
    return {
      provider: 'x',
      name: user.twitter.username ? `@${user.twitter.username}` : user.twitter.name,
    };
  }
  if (lastLogin === 'metamask') return { provider: 'metamask', name: null };
  if (user?.google) return { provider: 'google', name: user.google.name ?? user.google.email };
  if (user?.twitter) {
    return {
      provider: 'x',
      name: user.twitter.username ? `@${user.twitter.username}` : user.twitter.name,
    };
  }
  return { provider: 'metamask', name: null };
}

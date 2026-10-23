// First-party marker for an injected (MetaMask) wallet link that must survive refresh.
//
// Why not `wagmi.store`: the Privy wagmi wrapper builds its config with `ssr: true`,
// and @wagmi/core's createConfig ends with `store.setState(getInitialState())` right
// after creating the persisted store. zustand/persist rewrites storage on every
// setState with no hydration guard, so that call overwrites the persisted
// connections with an empty map at config-creation time — before any effect can read
// them and before wagmi's own reconnect can rehydrate. Persisted wagmi connections
// are therefore unusable across loads; a first-party marker is the only durable
// signal. Privy (Google/X) does not need this: its session lives in Privy's storage.
const KEY = 'outrun:wallet-link';

export type WalletLink = 'metamask';

function isWalletLink(value: string | null): value is WalletLink {
  return value === 'metamask';
}

export function readWalletLink(): WalletLink | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return isWalletLink(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function rememberWalletLink(link: WalletLink): void {
  try {
    window.localStorage.setItem(KEY, link);
  } catch {
    // Private mode: the link cannot be restored after refresh; current page still works.
  }
}

/** Clear on intentional disconnect: the next load must not silently re-attach. */
export function forgetWalletLink(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing persisted, nothing to clear.
  }
}

// Wallet discovery list: EIP-6963 announcements ordered and deduplicated per
// architecture.md §7 (discovered group → WalletConnect → embedded create/recover).
// Pure list shaping; the live EIP-6963 subscription lives in the component layer.
export type DiscoveredWallet = {
  /** EIP-6963 provider UUID (primary dedup key). */
  uuid: string;
  name: string;
  icon: `data:image/${string}` | string;
  /** EIP-6963 reverse-DNS id, e.g. "io.metamask" (secondary dedup key). */
  rdns: string;
};

export type WalletListEntry =
  ({ kind: 'discovered' } & DiscoveredWallet) | { kind: 'walletconnect' } | { kind: 'embedded' };

function isGenericInjected(wallet: DiscoveredWallet): boolean {
  return (
    wallet.name.trim().toLowerCase() === 'injected wallet' ||
    wallet.rdns.toLowerCase().includes('injected')
  );
}

function isSpecificWallet(wallet: DiscoveredWallet): boolean {
  return !isGenericInjected(wallet) && wallet.rdns.includes('.');
}

/**
 * Order and dedupe wallet options (§7):
 * 1. EIP-6963 discovered wallets in announcement order (MetaMask/OKX/Coinbase arrive as
 *    concrete announcements, not as a generic row);
 * 2. WalletConnect (when available);
 * 3. create-or-recover Privy embedded wallet (when available).
 * Dedup is by provider UUID, falling back to RDNS. Once at least one specific wallet is
 * discovered, a generic "Injected Wallet" row is dropped.
 */
export function orderWalletOptions(input: {
  discovered: readonly DiscoveredWallet[];
  walletConnectAvailable: boolean;
  embeddedAvailable: boolean;
}): WalletListEntry[] {
  const seen = new Set<string>();
  const unique: DiscoveredWallet[] = [];
  for (const wallet of input.discovered) {
    const key = wallet.uuid || wallet.rdns;
    if (
      !key ||
      seen.has(`uuid:${wallet.uuid}`) ||
      (wallet.rdns && seen.has(`rdns:${wallet.rdns}`))
    ) {
      continue;
    }
    seen.add(`uuid:${wallet.uuid}`);
    if (wallet.rdns) seen.add(`rdns:${wallet.rdns}`);
    unique.push(wallet);
  }
  const hasSpecific = unique.some(isSpecificWallet);
  const entries: WalletListEntry[] = unique
    .filter((wallet) => !(hasSpecific && isGenericInjected(wallet)))
    .map((wallet) => ({ kind: 'discovered', ...wallet }) as WalletListEntry);
  if (input.walletConnectAvailable) entries.push({ kind: 'walletconnect' });
  if (input.embeddedAvailable) entries.push({ kind: 'embedded' });
  return entries;
}

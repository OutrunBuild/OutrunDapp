// Account nine-state machine (architecture.md §6.2) + capability detection (§6.5).
// Pure transitions and classifiers: no React, no Privy, no wagmi. The provider wiring
// (active-provider.ts) and the client shell (components/global/web3-providers.tsx) drive this
// machine; unit tests pin every transition, so a wallet/hook regression cannot silently
// widen or narrow the state set.
export const ACCOUNT_STATES = [
  'Disconnected',
  'Connected EOA',
  'Authorization requested',
  'Authorization signed',
  'Delegation pending',
  'Kernel delegated',
  'Unsupported delegation',
  'Delegation replacement pending',
  'Delegation revoked',
] as const;

export type AccountState = (typeof ACCOUNT_STATES)[number];

export type AccountEvent =
  | { type: 'connect' }
  | { type: 'disconnect' }
  | { type: 'request-authorization' }
  | { type: 'authorization-signed' }
  | { type: 'authorization-submitted' }
  | { type: 'reject-authorization' }
  | { type: 'delegation-observed'; supported: boolean }
  | { type: 'request-replacement' }
  | { type: 'replacement-observed'; supported: boolean }
  | { type: 'revocation-observed' }
  | { type: 'chain-changed' };

/**
 * Total transition function: an event that is meaningless in the current state leaves the
 * state unchanged (never throws, never invents a tenth state).
 * - reject-authorization returns to Connected EOA (B4: refusal is not an error, the form
 *   keeps its draft; the account simply never left plain-EOA standing).
 * - chain-changed drops delegation standing back to Connected EOA: delegation is
 *   chain-specific (§6.3), so a new chain must be re-evaluated from eth_getCode.
 * - disconnect wins from every state.
 */
export function advanceAccount(state: AccountState, event: AccountEvent): AccountState {
  if (event.type === 'disconnect') return 'Disconnected';
  switch (state) {
    case 'Disconnected':
      return event.type === 'connect' ? 'Connected EOA' : state;
    case 'Connected EOA':
      if (event.type === 'request-authorization') return 'Authorization requested';
      if (event.type === 'delegation-observed') {
        return event.supported ? 'Kernel delegated' : 'Unsupported delegation';
      }
      return state;
    case 'Authorization requested':
      if (event.type === 'authorization-signed') return 'Authorization signed';
      // B4 refusal (of the authorization signature itself) keeps plain-EOA standing.
      if (event.type === 'reject-authorization') return 'Connected EOA';
      return state;
    case 'Authorization signed':
      if (event.type === 'authorization-submitted') return 'Delegation pending';
      if (event.type === 'delegation-observed') {
        return event.supported ? 'Kernel delegated' : 'Unsupported delegation';
      }
      return state;
    case 'Delegation pending':
      if (event.type === 'delegation-observed') {
        return event.supported ? 'Kernel delegated' : 'Unsupported delegation';
      }
      return state;
    case 'Kernel delegated':
      if (event.type === 'request-replacement') return 'Delegation replacement pending';
      if (event.type === 'revocation-observed') return 'Delegation revoked';
      if (event.type === 'chain-changed') return 'Connected EOA';
      return state;
    case 'Unsupported delegation':
      if (event.type === 'request-replacement') return 'Delegation replacement pending';
      if (event.type === 'chain-changed') return 'Connected EOA';
      return state;
    case 'Delegation replacement pending':
      if (event.type === 'replacement-observed') {
        return event.supported ? 'Kernel delegated' : 'Unsupported delegation';
      }
      return state;
    case 'Delegation revoked':
      // Re-enabling from a revoked standing restarts the authorization flow.
      if (event.type === 'request-authorization') return 'Authorization requested';
      if (event.type === 'chain-changed') return 'Connected EOA';
      return state;
  }
}

// EIP-7702 delegation code prefix; the delegated address occupies the trailing 20 bytes.
const DELEGATION_PREFIX = '0xef0100';

/** Extract the implementation address from 0xef0100… delegation code; null when absent. */
export function parseDelegationAddress(code: string | null | undefined): string | null {
  if (!code || code === '0x') return null;
  const lower = code.toLowerCase();
  if (!lower.startsWith(DELEGATION_PREFIX)) return null;
  const hex = lower.slice(2);
  // 2 prefix bytes + 20 address bytes = 46 hex chars; longer codes still carry the address last.
  if (hex.length < 46) return null;
  return `0x${hex.slice(-40)}`;
}

/** Capability detection, architecture.md §6.5 evaluation order (1→4, first match wins). */
export type CodeCapability =
  'plain-eoa' | 'kernel-delegated' | 'unsupported-delegation' | 'other-contract';

export function detectCodeCapability(
  code: string | null | undefined,
  manifestImplementation: string,
): CodeCapability {
  if (!code || code === '0x') return 'plain-eoa';
  const implementation = parseDelegationAddress(code);
  if (implementation !== null) {
    return implementation.toLowerCase() === manifestImplementation.toLowerCase()
      ? 'kernel-delegated'
      : 'unsupported-delegation';
  }
  return 'other-contract';
}

/** Per wallet brand/version: can it sign an EIP-7702 authorization and send a Type-4? */
export type ProviderCapability = {
  canSignAuthorization: boolean;
  canSendType4: boolean;
};

export type WriteCapability =
  | 'ready'
  | 'needs-delegation'
  | 'needs-replacement'
  | 'blocked-readonly'
  | 'blocked-other-contract';

export type WriteCapabilityResolution = {
  capability: WriteCapability;
  /** True when the UI must keep read access and show a wallet-upgrade prompt (§6.2/§16). */
  upgradeHint: boolean;
};

/**
 * Combine code standing with provider ability. A provider that cannot sign or send keeps
 * read access plus an upgrade prompt — it never hard-blocks into a dead end (§16); the
 * Privy embedded EOA remains the user's explicit alternative account entry.
 */
export function resolveWriteCapability(
  code: CodeCapability,
  provider: ProviderCapability,
): WriteCapabilityResolution {
  if (!provider.canSignAuthorization || !provider.canSendType4) {
    return { capability: 'blocked-readonly', upgradeHint: true };
  }
  switch (code) {
    case 'kernel-delegated':
      return { capability: 'ready', upgradeHint: false };
    case 'plain-eoa':
      return { capability: 'needs-delegation', upgradeHint: false };
    case 'unsupported-delegation':
      return { capability: 'needs-replacement', upgradeHint: false };
    case 'other-contract':
      // Never inferred compatible: Memeverse Swap stays disabled (§6.5 branch 4).
      return { capability: 'blocked-other-contract', upgradeHint: false };
  }
}

/**
 * Connection trigger policy (§7): connecting must originate from a user action. Page load
 * may only restore a previously authorized session — never open a popup, request accounts,
 * or sign. The providers shell encodes this (reconnectOnMount restores the stored session
 * only); this constant is the unit-testable anchor of that rule.
 */
export const CONNECTION_TRIGGER_POLICY = {
  userActionOnly: true,
  restoreSessionOnly: true,
  noAutoPopup: true,
  noAutoSign: true,
} as const;

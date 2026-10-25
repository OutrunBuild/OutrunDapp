// Direct transaction preparation pipeline (architecture.md §6.3).
// Fixed order: read pending nonce N + chainId → Kernel execute batch callData (built by the
// caller) → chain-specific authorization at nonce N+1 with executor 'self' (skipped when
// already delegated) → to=EOA self-execution → simulate on the EOA address with the identical
// fields → broadcast byte-identical fields. Undelegated accounts send a Type-4 carrying the
// authorizationList; already-delegated accounts send a plain type-2 with no authorizationList
// at all — EIP-7702 requires at least one authorization in a type-4, so an empty list is an
// invalid construct that every pool rejects (verified on Arbitrum/Base Sepolia 2026-10-20).
// Simulation failure blocks sending (§14); Router methods are never simulated standalone.
// Chain ports are injected (§11.1 interface mocks); viem adapters land with the suites.
import type { Hex } from 'viem';

import { detectCodeCapability } from './account';
import { decodeNestedRevert, type DecodedRevert } from './kernel';

export type SignedAuthorization = {
  chainId: number;
  address: Hex;
  nonce: number;
  r: Hex;
  s: Hex;
  v?: bigint;
  yParity?: number;
};

export type AuthorizationRequest = {
  contractAddress: Hex;
  chainId: number;
  nonce: number;
  executor: 'self';
};

/** Chain-specific authorization; chainId=0 (universal authorization) is forbidden. */
export function buildAuthorizationRequest(input: {
  kernel: Hex;
  chainId: number;
  authNonce: number;
}): AuthorizationRequest {
  if (!Number.isInteger(input.chainId) || input.chainId <= 0) {
    throw new Error('outrun: chain-specific authorization required (chainId=0 forbidden)');
  }
  return {
    contractAddress: input.kernel,
    chainId: input.chainId,
    nonce: input.authNonce,
    executor: 'self',
  };
}

/** Frozen preparation scope: any drift across these nine forces a full re-prepare (§6.3). */
export type PrepareScope = {
  chainId: number;
  nonce: number;
  authorization: SignedAuthorization | null;
  quoteId: string;
  minOutput: string;
  slippageBps: number;
  deadline: number;
  callData: Hex;
  manifestVersion: string;
  accountCode: Hex;
};

function sameAuthorization(a: SignedAuthorization | null, b: SignedAuthorization | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.chainId === b.chainId &&
    a.nonce === b.nonce &&
    a.address.toLowerCase() === b.address.toLowerCase() &&
    a.r.toLowerCase() === b.r.toLowerCase() &&
    a.s.toLowerCase() === b.s.toLowerCase()
  );
}

export function needsReprepare(prev: PrepareScope, next: PrepareScope): boolean {
  return (
    prev.chainId !== next.chainId ||
    prev.nonce !== next.nonce ||
    !sameAuthorization(prev.authorization, next.authorization) ||
    prev.quoteId !== next.quoteId ||
    prev.minOutput !== next.minOutput ||
    prev.slippageBps !== next.slippageBps ||
    prev.deadline !== next.deadline ||
    prev.callData.toLowerCase() !== next.callData.toLowerCase() ||
    prev.manifestVersion !== next.manifestVersion ||
    prev.accountCode.toLowerCase() !== next.accountCode.toLowerCase()
  );
}

export type UnsignedType4 = {
  to: Hex;
  eoa: Hex;
  chainId: number;
  nonce: number;
  value: bigint;
  data: Hex;
  /** Present (non-empty) = Type-4 carrying delegations; absent = plain type-2 self-execution. */
  authorizationList?: SignedAuthorization[];
  /** Caller-resolved gas limit (in-app gas control); absent = estimate at send time. */
  gasLimit?: bigint;
  /** Caller-chosen EIP-1559 fees (in-app gas control). */
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
};

/** Every unsigned field must match between simulation and broadcast — no drift allowed. */
export function assertByteIdentical(prepared: UnsignedType4, toSend: UnsignedType4): void {
  const fields: (keyof UnsignedType4)[] = [
    'to',
    'eoa',
    'chainId',
    'nonce',
    'value',
    'data',
    'gasLimit',
    'maxFeePerGas',
    'maxPriorityFeePerGas',
  ];
  for (const field of fields) {
    const a = prepared[field];
    const b = toSend[field];
    const equal =
      typeof a === 'bigint' || typeof a === 'number'
        ? a === b
        : String(a).toLowerCase() === String(b).toLowerCase();
    if (!equal) {
      throw new Error(`outrun: Type-4 field drift blocks broadcast (${field})`);
    }
  }
  if (
    (prepared.authorizationList ?? []).length !== (toSend.authorizationList ?? []).length ||
    (prepared.authorizationList ?? []).some(
      (auth, i) => !sameAuthorization(auth, (toSend.authorizationList ?? [])[i]),
    )
  ) {
    throw new Error('outrun: Type-4 field drift blocks broadcast (authorizationList)');
  }
}

export type Type4Ports = {
  getPendingNonce(eoa: Hex): Promise<number>;
  getChainId(): Promise<number>;
  getCode(eoa: Hex): Promise<Hex>;
  signAuthorization(req: AuthorizationRequest, walletAddress: Hex): Promise<SignedAuthorization>;
  simulateType4(tx: UnsignedType4): Promise<{ ok: true } | { ok: false; revertData?: Hex }>;
  /**
   * Broadcast the prepared fields. The wallet signs internally, so byte-identity is
   * enforced on the way in: the sent fields must equal the simulated preparation.
   */
  sendType4(tx: UnsignedType4): Promise<Hex>;
};

export type PrepareInput = {
  eoa: Hex;
  kernel: Hex;
  expectedChainId: number;
  /** Kernel execute batch callData for approval? → begin → Router → end. */
  batchCallData: Hex;
  value?: bigint;
  quoteId: string;
  minOutput: string;
  slippageBps: number;
  deadline: number;
  manifestVersion: string;
  /** Native balance vs estimated total cost: the §6.4 gate, checked before any signing. */
  nativeBalance: bigint;
  estimatedCost: bigint;
  /** User-adjusted gas (in-app gas control): carried onto the prepared tx unchanged. */
  gasLimit?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
};

export type PrepareResult =
  | { prepared: UnsignedType4 & { scope: PrepareScope } }
  | {
      blocked:
        'chain-mismatch' | 'chain-id-zero' | 'insufficient-native-balance' | 'simulation-failed';
      revert?: DecodedRevert;
    };

export async function prepareType4(ports: Type4Ports, input: PrepareInput): Promise<PrepareResult> {
  const [nonce, chainId, code] = await Promise.all([
    ports.getPendingNonce(input.eoa),
    ports.getChainId(),
    ports.getCode(input.eoa),
  ]);
  if (chainId === 0) return { blocked: 'chain-id-zero' };
  if (chainId !== input.expectedChainId) return { blocked: 'chain-mismatch' };
  if (input.nativeBalance < input.estimatedCost) return { blocked: 'insufficient-native-balance' };

  const delegated = detectCodeCapability(code, input.kernel) === 'kernel-delegated';
  const authorization = delegated
    ? null
    : await ports.signAuthorization(
        buildAuthorizationRequest({ kernel: input.kernel, chainId, authNonce: nonce + 1 }),
        input.eoa,
      );

  const tx: UnsignedType4 = {
    // Self-execution: the recipient is always the user's own EOA (§6.3). Undelegated
    // accounts carry the delegation as a Type-4; delegated accounts omit the list and
    // ride a plain type-2 (empty lists are invalid per EIP-7702, see file header).
    to: input.eoa,
    eoa: input.eoa,
    chainId,
    nonce,
    value: input.value ?? 0n,
    data: input.batchCallData,
    ...(authorization ? { authorizationList: [authorization] } : {}),
    ...(input.gasLimit != null ? { gasLimit: input.gasLimit } : {}),
    ...(input.maxFeePerGas != null ? { maxFeePerGas: input.maxFeePerGas } : {}),
    ...(input.maxPriorityFeePerGas != null
      ? { maxPriorityFeePerGas: input.maxPriorityFeePerGas }
      : {}),
  };
  const simulation = await ports.simulateType4(tx);
  if (!simulation.ok) {
    return { blocked: 'simulation-failed', revert: decodeNestedRevert(simulation.revertData) };
  }
  return {
    prepared: {
      ...tx,
      scope: {
        chainId,
        nonce,
        authorization,
        quoteId: input.quoteId,
        minOutput: input.minOutput,
        slippageBps: input.slippageBps,
        deadline: input.deadline,
        callData: input.batchCallData,
        manifestVersion: input.manifestVersion,
        accountCode: code,
      },
    },
  };
}

/** Broadcast only when the send fields equal the simulated preparation. */
export async function sendPrepared(ports: Type4Ports, prepared: UnsignedType4): Promise<Hex> {
  assertByteIdentical(prepared, {
    ...prepared,
    ...(prepared.authorizationList ? { authorizationList: [...prepared.authorizationList] } : {}),
  });
  return ports.sendType4(prepared);
}

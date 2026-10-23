// EIP-5792 wallet_sendCalls batch runner (PSM + faucet use; architecture.md §6.x).
// PSM mint/redeem are direct contract calls — no begin/endAccountSession legs (those
// guard the Router path only, see OutrunPSMUpgradeable.sol mint/redeem and
// MemeverseUniswapHookUpgradeable.beginAccountSession). The calls land in the wallet
// through wallet_sendCalls; 7702-capable wallets (MetaMask smart account etc.) upgrade
// internally instead of asking the dapp to sign an authorization.
import type { Chain, Hex } from 'viem';

import type { BatchExecution } from './kernel';

export type Eip5792Call = {
  to: Hex;
  data?: Hex;
  value?: bigint;
};

export type Eip5792RequestFn = (args: { method: string; params?: unknown }) => Promise<unknown>;

/**
 * wallet_sendCalls params, version 2.0.0 (viem sendCalls default), with atomicity
 * required: the PSM batch carries approve + mint, and a non-atomic wallet could land
 * the approval while the mint reverts. Callers only reach here after the
 * `wallet_getCapabilities` atomic probe returned supported/ready.
 */
export function sendCallsParams(input: {
  from: Hex;
  chain: Chain;
  calls: readonly Eip5792Call[];
}): [
  {
    atomicRequired: true;
    calls: { to: Hex; data?: Hex; value?: `0x${string}` }[];
    chainId: `0x${string}`;
    from: Hex;
    version: '2.0.0';
  },
] {
  return [
    {
      atomicRequired: true,
      calls: input.calls.map((call) => ({
        to: call.to,
        ...(call.data !== undefined ? { data: call.data } : {}),
        ...(call.value !== undefined && call.value !== 0n
          ? { value: toQuantityHex(call.value) }
          : {}),
      })),
      chainId: toQuantityHex(BigInt(input.chain.id)),
      from: input.from,
      version: '2.0.0',
    },
  ];
}

function toQuantityHex(value: bigint): `0x${string}` {
  return `0x${value.toString(16)}` as `0x${string}`;
}

/** BatchExecution → wallet_sendCalls call (value 0n stays omitted: params carry no `value`). */
export function executionToCall(execution: BatchExecution): Eip5792Call {
  return {
    to: execution.target,
    data: execution.callData,
    ...(execution.value !== 0n ? { value: execution.value } : {}),
  };
}

export type CallsStatus = 'pending' | 'success' | 'failure';

export type CallsReceipt = {
  transactionHash?: Hex;
  /** '0x1' success / '0x0' reverted; absent on some wallets. */
  status?: Hex;
};

export type CallsStatusResult = {
  status: CallsStatus;
  statusCode?: number | string;
  receipts?: CallsReceipt[];
};

export type CallsPollResult = CallsStatusResult | { status: 'timeout' };

export type CallsPollOptions = {
  intervalMs?: number;
  deadlineMs?: number;
};

/**
 * wallet_getCapabilities atomic probe: true when the chain entry reports atomic
 * supported or ready. Missing method / missing chain entry / anything else → false.
 * Pass the raw wallet response (no normalization): the chain-keyed envelope (wagmi
 * `data[chainId].atomic.status`) and the flat envelope ({ atomic: { status } }, used
 * by wallets that return capabilities for the active chain only) are both accepted,
 * and both decimal and 0x chain-id keys are tried.
 *
 * params[0] is the address (EIP-5792): an empty params array hands wallets an
 * undefined where a string is required, and strict wallets answer -32602.
 */
export async function supportsAtomicCalls(
  request: Eip5792RequestFn,
  chainId: number,
  address: Hex,
): Promise<boolean> {
  let response: unknown;
  try {
    response = await request({ method: 'wallet_getCapabilities', params: [address] });
  } catch {
    return false;
  }
  if (typeof response !== 'object' || response === null) return false;
  const record = response as Record<string, unknown>;
  // Flat envelope (some wallets answer for the active chain only): { atomic: … }.
  // Chain-keyed envelope (wagmi-style): { [chainId]: { atomic: … } }, decimal or 0x key,
  // with the spec's "0x0" all-chains entry as the last fallback.
  const entry =
    'atomic' in record
      ? record
      : (record[String(chainId)] ?? record[`0x${chainId.toString(16)}`] ?? record['0x0']);
  if (typeof entry !== 'object' || entry === null) return false;
  const atomic = (entry as Record<string, unknown>).atomic;
  if (typeof atomic !== 'object' || atomic === null) return false;
  const status = (atomic as Record<string, unknown>).status;
  return status === 'supported' || status === 'ready';
}

/** Extract the batch id from a wallet_sendCalls response (string or { id }). */
export function sendCallsId(response: unknown): string | null {
  if (typeof response === 'string' && response.length > 0) return response;
  if (typeof response === 'object' && response !== null) {
    const id = (response as Record<string, unknown>).id;
    if (typeof id === 'string' && id.length > 0) return id;
  }
  return null;
}

/**
 * Parse a wallet_getCallsStatus response. EIP-5792 status is numeric:
 * 100s pending, 200s confirmed, 400/500/600 failure (viem normalizes the same way;
 * it also accepts the legacy 'CONFIRMED'/'PENDING' labels). Receipt statuses are
 * preserved so callers can reject a mixed/partial batch.
 */
export function parseCallsStatus(response: unknown): CallsStatusResult {
  if (typeof response !== 'object' || response === null) return { status: 'pending' };
  const record = response as Record<string, unknown>;
  const code = typeof record.statusCode === 'number' ? record.statusCode : record.status;
  const receipts = Array.isArray(record.receipts)
    ? (record.receipts as Array<Record<string, unknown>>).map((receipt) => ({
        ...(typeof receipt.transactionHash === 'string'
          ? { transactionHash: receipt.transactionHash as Hex }
          : {}),
        ...(typeof receipt.status === 'string' && receipt.status.startsWith('0x')
          ? { status: receipt.status as Hex }
          : {}),
      }))
    : undefined;
  const base = { ...(receipts !== undefined ? { receipts } : {}) };

  if (typeof code === 'number') {
    if (code >= 200 && code < 300) return { status: 'success', statusCode: code, ...base };
    if (code >= 300) return { status: 'failure', statusCode: code, ...base };
    return { status: 'pending', statusCode: code, ...base };
  }
  if (code === 'success' || code === 'CONFIRMED') {
    return { status: 'success', statusCode: code, ...base };
  }
  if (code === 'failure') return { status: 'failure', statusCode: code, ...base };
  return {
    status: 'pending',
    ...(code !== undefined ? { statusCode: String(code) } : {}),
    ...base,
  };
}

/**
 * Poll wallet_getCallsStatus until terminal or the deadline. The params shape is the
 * spec's `[batchId]` (a string, not an object). Transient RPC failures keep polling;
 * an unknown-bundle error (5730) fails fast; a deadline hit returns 'timeout' and the
 * caller must not report it as success or cancellation.
 */
export async function pollCallsStatus(
  request: Eip5792RequestFn,
  batchId: string,
  options: CallsPollOptions = {},
): Promise<CallsPollResult> {
  const intervalMs = options.intervalMs ?? 1500;
  const deadlineMs = options.deadlineMs ?? 120_000;
  const deadline = Date.now() + deadlineMs;
  for (;;) {
    let response: unknown;
    try {
      response = await request({ method: 'wallet_getCallsStatus', params: [batchId] });
    } catch (error) {
      if (isUnknownBundle(error)) return { status: 'failure', statusCode: 5730 };
      if (Date.now() >= deadline) return { status: 'timeout' };
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      continue;
    }
    const parsed = parseCallsStatus(response);
    if (parsed.status !== 'pending') return parsed;
    if (Date.now() >= deadline) return { status: 'timeout' };
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

/** EIP-5792 5730: the wallet does not know this bundle id. */
function isUnknownBundle(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  if ((error as { code?: unknown }).code === 5730) return true;
  return /unknown bundle|bundle id/i.test(String((error as { message?: unknown }).message ?? ''));
}

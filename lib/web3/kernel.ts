// Kernel V3.3 session-batch encoder (architecture.md §6.3).
// The only encodable mode is the default atomic batch: CALLTYPE_BATCH (0x01) +
// EXECTYPE_DEFAULT (0x00), ERC-7579 packed as callType | execType | unused(4) |
// modeSelector(4) | modePayload(22). Any other mode (including TRY_EXEC) is rejected by
// assertDefaultExecMode — it can never be produced, only fail.
import { decodeErrorResult, encodeAbiParameters, encodeFunctionData, type Hex } from 'viem';

import { faucetAbi, kernelAbi } from './abis';

export const CALLTYPE_BATCH = '0x01';
export const EXECTYPE_DEFAULT = '0x00';

/** Default ERC-7579 execution mode: 0x01 0x00 followed by 30 zero bytes. */
export const EXEC_MODE_DEFAULT =
  '0x0100000000000000000000000000000000000000000000000000000000000000' as Hex;

export function assertDefaultExecMode(mode: Hex): void {
  if (mode.toLowerCase() !== EXEC_MODE_DEFAULT.toLowerCase()) {
    throw new Error('outrun: only the default atomic batch mode is encodable (no TRY_EXEC)');
  }
}

export type BatchExecution = {
  target: Hex;
  value: bigint;
  callData: Hex;
};

/** Encode Execution(address target, uint256 value, bytes callData)[] batch payload. */
export function encodeBatchExecutions(calls: readonly BatchExecution[]): Hex {
  return encodeAbiParameters(
    [
      {
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'callData', type: 'bytes' },
        ],
      },
    ],
    [
      calls.map((call) => ({
        target: call.target,
        value: call.value,
        callData: call.callData,
      })),
    ],
  );
}

/** Encode Kernel execute(ExecMode, bytes) for the fixed session order (§6.3). */
export function encodeKernelExecute(calls: readonly BatchExecution[]): Hex {
  return encodeFunctionData({
    abi: kernelAbi,
    functionName: 'execute',
    args: [EXEC_MODE_DEFAULT, encodeBatchExecutions(calls)],
  });
}

export type SessionBatchParts = {
  /** Optional token / Permit2 approvals, first when present (singular kept for callers). */
  approval?: BatchExecution;
  /** Multiple approvals (e.g. two-sided liquidity): ordered before begin, after `approval`. */
  approvals?: BatchExecution[];
  beginAccountSession: BatchExecution;
  /** Exactly one Router action per batch. */
  routerAction: BatchExecution;
  endAccountSession: BatchExecution;
};

/** Assemble the fixed call order: approvals? → begin → Router → end. */
export function buildSessionBatch(parts: SessionBatchParts): BatchExecution[] {
  return [
    ...(parts.approval ? [parts.approval] : []),
    ...(parts.approvals ?? []),
    parts.beginAccountSession,
    parts.routerAction,
    parts.endAccountSession,
  ];
}

const STANDARD_REVERT_ABI = [
  { type: 'error', name: 'Error', inputs: [{ name: 'message', type: 'string' }] },
  { type: 'error', name: 'Panic', inputs: [{ name: 'code', type: 'uint256' }] },
] as const;

export type RevertKind =
  'batch-reverted' | 'kernel-error' | 'error-string' | 'panic' | 'claim-too-soon' | 'unknown';

export type DecodedRevert = {
  /** Machine-readable class for the transaction error model (UI copy maps it per locale). */
  kind: RevertKind;
};

/**
 * Decode nested revert data to the transaction error model. Anything unrecognized degrades
 * to 'unknown' — the UI renders one short line with no interpolated values (2026-10-04).
 * Faucet direct writes surface ClaimTooSoon so the faucet panel can name the 24h cooldown
 * instead of falling back to the generic unknown line.
 */
export function decodeNestedRevert(data: Hex | null | undefined): DecodedRevert {
  if (!data || data === '0x' || data.length < 10) {
    return { kind: 'unknown' };
  }
  try {
    const decoded = decodeErrorResult({ abi: kernelAbi, data });
    if (decoded.errorName === 'ExecutionReverted') {
      return { kind: 'batch-reverted' };
    }
    // viem also matches the standard Error/Panic selectors against a custom ABI.
    if (decoded.errorName === 'Error') {
      return { kind: 'error-string' };
    }
    if (decoded.errorName === 'Panic') {
      return { kind: 'panic' };
    }
    return { kind: 'kernel-error' };
  } catch {
    try {
      const decoded = decodeErrorResult({ abi: STANDARD_REVERT_ABI, data });
      if (decoded.errorName === 'Error') {
        return { kind: 'error-string' };
      }
      // viem matches unknown custom errors against Panic(uint256) when the selector
      // collides structurally — check the faucet ABI before accepting the panic label.
      const faucetDecoded = (() => {
        try {
          return decodeErrorResult({ abi: faucetAbi, data });
        } catch {
          return null;
        }
      })();
      if (faucetDecoded?.errorName === 'ClaimTooSoon') {
        return { kind: 'claim-too-soon' };
      }
      return { kind: 'panic' };
    } catch {
      // Faucet direct-write path: ClaimTooSoon is the only user-facing custom error there.
      try {
        const decoded = decodeErrorResult({ abi: faucetAbi, data });
        if (decoded.errorName === 'ClaimTooSoon') {
          return { kind: 'claim-too-soon' };
        }
      } catch {
        // fall through to unknown below
      }
      return { kind: 'unknown' };
    }
  }
}

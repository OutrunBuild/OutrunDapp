// Kernel encoder contract tests (stage 6 step 3, architecture.md §6.3):
// - only the default atomic batch mode is encodable (TRY_EXEC-class modes fail)
// - execute(bytes32,bytes) encoding round-trips through the frozen Kernel ABI
// - session order is approval? → begin → Router → end
// - nested reverts decode to single-line headlines without interpolated values
import { describe, expect, it } from 'vitest';
import { decodeFunctionData, encodeErrorResult, type Hex } from 'viem';

import { faucetAbi, kernelAbi } from '../../../lib/web3/abis';
import {
  assertDefaultExecMode,
  buildSessionBatch,
  CALLTYPE_BATCH,
  decodeNestedRevert,
  encodeBatchExecutions,
  encodeKernelExecute,
  EXEC_MODE_DEFAULT,
  EXECTYPE_DEFAULT,
  type BatchExecution,
} from '../../../lib/web3/kernel';

const TARGET = '0x2222222222222222222222222222222222222222' as Hex;
const calls: BatchExecution[] = [
  { target: TARGET, value: 0n, callData: '0x1234' },
  { target: TARGET, value: 100n, callData: '0x' },
];

describe('execution mode', () => {
  it('pins CALLTYPE_BATCH / EXECTYPE_DEFAULT and the packed default mode', () => {
    expect(CALLTYPE_BATCH).toBe('0x01');
    expect(EXECTYPE_DEFAULT).toBe('0x00');
    expect(EXEC_MODE_DEFAULT).toHaveLength(66);
    expect(EXEC_MODE_DEFAULT.startsWith('0x0100')).toBe(true);
    expect(() => assertDefaultExecMode(EXEC_MODE_DEFAULT)).not.toThrow();
  });

  it('rejects any non-default mode (TRY_EXEC can never be produced)', () => {
    expect(() =>
      assertDefaultExecMode(
        '0x0200000000000000000000000000000000000000000000000000000000000000' as Hex,
      ),
    ).toThrow('no TRY_EXEC');
    expect(() =>
      assertDefaultExecMode(
        '0x0100000000000000000000000000000000000000000000000000000000000001' as Hex,
      ),
    ).toThrow('no TRY_EXEC');
  });
});

describe('execute encoding', () => {
  it('snapshots the batch encoding bytes', () => {
    expect(encodeBatchExecutions(calls)).toMatchSnapshot();
  });

  it('round-trips execute(bytes32,bytes) through the frozen Kernel ABI', () => {
    const data = encodeKernelExecute(calls);
    const decoded = decodeFunctionData({ abi: kernelAbi, data });
    expect(decoded.functionName).toBe('execute');
    expect(decoded.args?.[0]).toBe(EXEC_MODE_DEFAULT);
    expect(decoded.args?.[1]).toBe(encodeBatchExecutions(calls));
  });
});

describe('buildSessionBatch', () => {
  const begin = { target: TARGET, value: 0n, callData: '0x01' } as BatchExecution;
  const router = { target: TARGET, value: 0n, callData: '0x02' } as BatchExecution;
  const end = { target: TARGET, value: 0n, callData: '0x03' } as BatchExecution;

  it('orders approval? → begin → Router → end', () => {
    const approval = { target: TARGET, value: 0n, callData: '0x00' } as BatchExecution;
    expect(
      buildSessionBatch({
        approval,
        beginAccountSession: begin,
        routerAction: router,
        endAccountSession: end,
      }),
    ).toEqual([approval, begin, router, end]);
    expect(
      buildSessionBatch({
        beginAccountSession: begin,
        routerAction: router,
        endAccountSession: end,
      }),
    ).toEqual([begin, router, end]);
  });

  it('orders multiple approvals before begin (two-sided liquidity)', () => {
    const first = { target: TARGET, value: 0n, callData: '0x00' } as BatchExecution;
    const second = { target: TARGET, value: 0n, callData: '0x01' } as BatchExecution;
    expect(
      buildSessionBatch({
        approval: first,
        approvals: [second],
        beginAccountSession: begin,
        routerAction: router,
        endAccountSession: end,
      }),
    ).toEqual([first, second, begin, router, end]);
  });

  it('omits the guards entirely when begin/end are absent (non-swap paths)', () => {
    expect(
      buildSessionBatch({
        approval: { target: TARGET, value: 0n, callData: '0x00' } as BatchExecution,
        routerAction: router,
      }),
    ).toEqual([{ target: TARGET, value: 0n, callData: '0x00' }, router]);
  });
});

describe('decodeNestedRevert', () => {
  it('maps ExecutionReverted to the batch class', () => {
    const data = encodeErrorResult({ abi: kernelAbi, errorName: 'ExecutionReverted', args: [] });
    expect(decodeNestedRevert(data)).toEqual({ kind: 'batch-reverted' });
  });

  it('maps Error(string) and Panic to their classes', () => {
    const reason = encodeErrorResult({
      abi: [{ type: 'error', name: 'Error', inputs: [{ name: 'message', type: 'string' }] }],
      errorName: 'Error',
      args: ['amount exceeds balance'],
    });
    expect(decodeNestedRevert(reason)).toEqual({ kind: 'error-string' });
    const panic = encodeErrorResult({
      abi: [{ type: 'error', name: 'Panic', inputs: [{ name: 'code', type: 'uint256' }] }],
      errorName: 'Panic',
      args: [1n],
    });
    expect(decodeNestedRevert(panic)).toEqual({ kind: 'panic' });
  });

  it('maps Faucet ClaimTooSoon to the claim-too-soon class', () => {
    const data = encodeErrorResult({ abi: faucetAbi, errorName: 'ClaimTooSoon' });
    expect(decodeNestedRevert(data)).toEqual({ kind: 'claim-too-soon' });
  });

  it('degrades unknown data to unknown', () => {
    expect(decodeNestedRevert('0x12345678')).toEqual({ kind: 'unknown' });
    expect(decodeNestedRevert(null)).toEqual({ kind: 'unknown' });
  });
});

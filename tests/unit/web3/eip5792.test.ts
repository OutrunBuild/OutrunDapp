// EIP-5792 batch param/probe contract tests (wallet_sendCalls upgrade path for
// external wallets; architecture.md §6.x): param shape matches the wallet_sendCalls
// v2 envelope, the atomic probe reads the chain entry (or 0x0 all-chains entry), the
// status parser follows the spec's numeric codes, and polling uses params [batchId].
import { describe, expect, it, vi } from 'vitest';
import type { Hex } from 'viem';
import { baseSepolia } from 'viem/chains';

import {
  executionToCall,
  parseCallsStatus,
  pollCallsStatus,
  sendCallsId,
  sendCallsParams,
  supportsAtomicCalls,
} from '../../../lib/web3/eip5792';

const from = '0xBec9209dFe21f896852cd1495478D2830C4aB' as Hex;
const to = '0x1111111111111111111111111111111111111111' as Hex;

describe('sendCallsParams', () => {
  it('builds the wallet_sendCalls v2 envelope with quantity hex chain id', () => {
    const [params] = sendCallsParams({
      from,
      chain: baseSepolia,
      calls: [{ to, data: '0xdeadbeef' as Hex }],
    });
    expect(params.version).toBe('2.0.0');
    expect(params.atomicRequired).toBe(true);
    expect(params.chainId).toBe(`0x${baseSepolia.id.toString(16)}`);
    expect(params.from).toBe(from);
    expect(params.calls).toEqual([{ to, data: '0xdeadbeef' }]);
    // viem omits capabilities when nothing is requested; an empty object is a
    // different (and wallet-rejected) value.
    expect('capabilities' in params).toBe(false);
  });

  it('omits value when zero and quantifies nonzero value', () => {
    const [params] = sendCallsParams({
      from,
      chain: baseSepolia,
      calls: [
        { to, data: '0x01' as Hex, value: 0n },
        { to, data: '0x02' as Hex, value: 69420n },
      ],
    });
    expect(params.calls[0]).toEqual({ to, data: '0x01' });
    expect(params.calls[1]).toEqual({ to, data: '0x02', value: '0x10f2c' });
  });
});

describe('executionToCall', () => {
  it('drops the zero-value leg, keeps callData as data', () => {
    expect(executionToCall({ target: to, value: 0n, callData: '0xabc' as Hex })).toEqual({
      to,
      data: '0xabc',
    });
  });

  it('carries a nonzero value through', () => {
    expect(executionToCall({ target: to, value: 10n, callData: '0xabc' as Hex })).toEqual({
      to,
      data: '0xabc',
      value: 10n,
    });
  });
});

describe('supportsAtomicCalls', () => {
  it('accepts supported and ready', async () => {
    for (const status of ['supported', 'ready']) {
      const request = vi.fn().mockResolvedValue({ [baseSepolia.id]: { atomic: { status } } });
      expect(await supportsAtomicCalls(request, baseSepolia.id, from)).toBe(true);
      expect(request).toHaveBeenCalledWith({
        method: 'wallet_getCapabilities',
        params: [from],
      });
    }
  });

  it('accepts the flat envelope and the 0x chain-id key', async () => {
    expect(
      await supportsAtomicCalls(
        vi.fn().mockResolvedValue({ atomic: { status: 'supported' } }),
        baseSepolia.id,
        from,
      ),
    ).toBe(true);
    expect(
      await supportsAtomicCalls(
        vi.fn().mockResolvedValue({
          [`0x${baseSepolia.id.toString(16)}`]: { atomic: { status: 'ready' } },
        }),
        baseSepolia.id,
        from,
      ),
    ).toBe(true);
  });

  it('accepts the 0x0 all-chains entry as a fallback', async () => {
    expect(
      await supportsAtomicCalls(
        vi.fn().mockResolvedValue({ '0x0': { atomic: { status: 'supported' } } }),
        baseSepolia.id,
        from,
      ),
    ).toBe(true);
  });

  it('rejects unsupported, missing entries, and method failure', async () => {
    expect(
      await supportsAtomicCalls(
        vi.fn().mockResolvedValue({ [baseSepolia.id]: { atomic: { status: 'unsupported' } } }),
        baseSepolia.id,
        from,
      ),
    ).toBe(false);
    expect(await supportsAtomicCalls(vi.fn().mockResolvedValue({}), baseSepolia.id, from)).toBe(
      false,
    );
    expect(
      await supportsAtomicCalls(
        vi.fn().mockRejectedValue(new Error('Method not found')),
        baseSepolia.id,
        from,
      ),
    ).toBe(false);
  });
});

describe('sendCallsId', () => {
  it('accepts a bare string or an { id } envelope', () => {
    expect(sendCallsId('0xbatch')).toBe('0xbatch');
    expect(sendCallsId({ id: '0xbatch' })).toBe('0xbatch');
  });

  it('rejects empty and malformed responses', () => {
    expect(sendCallsId('')).toBeNull();
    expect(sendCallsId({})).toBeNull();
    expect(sendCallsId(null)).toBeNull();
  });
});

describe('parseCallsStatus', () => {
  it('maps the spec numeric codes (100/200/400/500/600)', () => {
    expect(parseCallsStatus({ status: 100 }).status).toBe('pending');
    expect(parseCallsStatus({ status: 200 }).status).toBe('success');
    expect(parseCallsStatus({ status: 400 }).status).toBe('failure');
    expect(parseCallsStatus({ status: 500 }).status).toBe('failure');
    expect(parseCallsStatus({ status: 600 }).status).toBe('failure');
  });

  it('prefers statusCode and keeps legacy string labels', () => {
    expect(parseCallsStatus({ statusCode: 200 }).status).toBe('success');
    expect(parseCallsStatus({ status: 'CONFIRMED' }).status).toBe('success');
    expect(parseCallsStatus({ status: 'PENDING' }).status).toBe('pending');
    expect(parseCallsStatus({ status: 'success' }).status).toBe('success');
    expect(parseCallsStatus({ status: 'failure' }).status).toBe('failure');
  });

  it('preserves receipt hashes and status so partial failures stay visible', () => {
    const parsed = parseCallsStatus({
      status: 200,
      receipts: [
        { transactionHash: '0xaaa', status: '0x1' },
        { transactionHash: '0xbbb', status: '0x0' },
      ],
    });
    expect(parsed.receipts).toEqual([
      { transactionHash: '0xaaa', status: '0x1' },
      { transactionHash: '0xbbb', status: '0x0' },
    ]);
  });

  it('treats unknown and malformed responses as pending', () => {
    expect(parseCallsStatus({ status: 'weird' }).status).toBe('pending');
    expect(parseCallsStatus(null).status).toBe('pending');
    expect(parseCallsStatus({}).status).toBe('pending');
  });
});

describe('pollCallsStatus', () => {
  it('sends params [batchId] and stops on the first terminal status', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ status: 100 })
      .mockResolvedValueOnce({
        status: 200,
        receipts: [{ transactionHash: '0xhash', status: '0x1' }],
      });
    const result = await pollCallsStatus(request, '0xbatch', { intervalMs: 0 });
    expect(result.status).toBe('success');
    expect(request).toHaveBeenCalledWith({
      method: 'wallet_getCallsStatus',
      params: ['0xbatch'],
    });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('fails fast on an unknown bundle id (5730)', async () => {
    const request = vi.fn().mockRejectedValue({ code: 5730 });
    expect(await pollCallsStatus(request, '0xbatch', { intervalMs: 0 })).toEqual({
      status: 'failure',
      statusCode: 5730,
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('returns timeout when the deadline passes while still pending', async () => {
    const request = vi.fn().mockResolvedValue({ status: 100 });
    const result = await pollCallsStatus(request, '0xbatch', {
      intervalMs: 1,
      deadlineMs: 5,
    });
    expect(result.status).toBe('timeout');
  });
});

// viem adapter for the RpcPort seam: public client (fallback transport + multicall batch) behind
// the narrow read-side interface the repository consumes. All reverts surface as thrown errors on
// call/multicall (the repository maps them to rpc-error); probe() converts them to structured
// probe results instead.
import type { PublicClient } from 'viem';
import { ContractFunctionExecutionError } from 'viem';
import type { ContractCallSpec, ProbeResult, ReceiptView, RpcPort } from './rpc-port';

const asAddress = (a: string) => a as `0x${string}`;

/** Multicall chunk bound: keeps each batched eth_call bounded (§9.1 bounded multicall) */
const MULTICALL_CHUNK = 50;

export function createViemRpcPort(client: PublicClient): RpcPort {
  const toArgs = (spec: ContractCallSpec) =>
    'args' in spec && spec.args ? { args: spec.args as unknown[] } : {};
  const readOne = async (spec: ContractCallSpec) =>
    client.readContract({
      address: asAddress(spec.address),
      abi: spec.abi,
      functionName: spec.functionName,
      ...toArgs(spec),
      ...(spec.account ? { account: asAddress(spec.account) } : {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

  return {
    call: readOne,
    async multicall(specs) {
      const out: unknown[] = [];
      for (let i = 0; i < specs.length; i += MULTICALL_CHUNK) {
        const chunk = specs.slice(i, i + MULTICALL_CHUNK);
        const res = await client.multicall({
          contracts: chunk.map(
            (spec) =>
              ({
                address: asAddress(spec.address),
                abi: spec.abi,
                functionName: spec.functionName,
                ...toArgs(spec),
                ...(spec.account ? { account: asAddress(spec.account) } : {}),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              }) as any,
          ),
          allowFailure: false,
        });
        out.push(...res);
      }
      return out;
    },
    async probe(spec) {
      try {
        const data = await readOne(spec);
        return { ok: true, data };
      } catch (e) {
        if (e instanceof ContractFunctionExecutionError) {
          const revert = (e as { revert?: { errorName?: string; args?: unknown[] } }).revert;
          const name = revert?.errorName ?? revert?.args?.[0];
          return { ok: false, reason: String(name ?? e.shortMessage ?? e.message) };
        }
        return { ok: false, reason: e instanceof Error ? e.message : String(e) };
      }
    },
    getBalance: (address) => client.getBalance({ address: asAddress(address) }),
    getCode: async (address) => (await client.getCode({ address: asAddress(address) })) ?? '0x',
    getTransactionCount: async (address) =>
      Number(await client.getTransactionCount({ address: asAddress(address) })),
    getBlockNumber: async () => Number(await client.getBlockNumber()),
    async getTransactionReceipt(hash) {
      const r = await client.getTransactionReceipt({ hash: asAddress(hash) });
      const view: ReceiptView = {
        status: r.status === 'success' ? 'success' : 'reverted',
        blockNumber: Number(r.blockNumber),
        gasUsed: r.gasUsed,
        from: r.from,
        to: r.to ?? null,
      };
      return view;
    },
  };
}

// ProbeResult re-export keeps the type colocated with its producer for consumers importing both
export type { ProbeResult };

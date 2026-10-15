// Narrow read-side RPC surface the data repository depends on. This is the interface-level mock
// point (architecture.md §11.1): unit tests stub this port, never the domain mapping rules on top
// of it. viem's PublicClient is adapted to it in viem-rpc-port.ts.
import type { Abi } from 'viem';

export type ContractCallSpec = {
  address: string;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  /** from-address for eth_call (needed by functions that read msg.sender, e.g. claimablePreorderMemecoin) */
  account?: string;
};

export type ReceiptView = {
  status: 'success' | 'reverted';
  blockNumber: number;
  gasUsed: bigint;
  from: string;
  to: string | null;
};

export type ProbeResult = { ok: true; data: unknown } | { ok: false; reason: string };

export interface RpcPort {
  /** Single eth_call contract read */
  call(spec: ContractCallSpec): Promise<unknown>;
  /** Bounded multicall: one batched eth_call per chunk (order-preserving) */
  multicall(specs: readonly ContractCallSpec[]): Promise<unknown[]>;
  /** eth_call probe of a state-mutating entry: ok=true means the call would succeed at head state */
  probe(spec: ContractCallSpec): Promise<ProbeResult>;
  getBalance(address: string): Promise<bigint>;
  /** eth_getCode: '0x' for a plain EOA, 0xef0100… for an EIP-7702 delegation */
  getCode(address: string): Promise<string>;
  getTransactionCount(address: string): Promise<number>;
  getBlockNumber(): Promise<number>;
  getTransactionReceipt(hash: string): Promise<ReceiptView | null>;
}

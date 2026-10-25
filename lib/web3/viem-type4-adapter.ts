// viem adapters for the Type-4 ports (architecture.md §6.3/§11.1).
// - Reads and the wallet-backed client run on the active wallet's EIP-1193 provider
//   (no RPC URLs or keys on the client path).
// - Simulation is a raw eth_call carrying the identical authorizationList (viem 2.55.10
//   types CallParameters without it, so the params object is built by hand — never let a
//   formatter silently drop the list).
// - Broadcast is the 7702 direct-send shape: build the type-4 locally, sign its raw hash
//   via eth_sign (Privy's eth_sendTransaction/eth_signTransaction pipelines drop the
//   authorizationList — 2026-10-25, SDK 3.38–3.51), broadcast via eth_sendRawTransaction.
import {
  createPublicClient,
  createWalletClient,
  custom,
  keccak256,
  numberToHex,
  serializeTransaction,
  type Chain,
  type Hex,
} from 'viem';

import { type SignedAuthorization, type Type4Ports, type UnsignedType4 } from './type4-pipeline';

export type Eip1193RequestFn = (args: { method: string; params?: unknown }) => Promise<unknown>;

export type AuthorizationSigner = (
  req: { contractAddress: Hex; chainId: number; nonce: number; executor: 'self' },
  walletAddress: Hex,
) => Promise<SignedAuthorization>;

type RpcAuthorization = {
  chainId: Hex;
  address: Hex;
  nonce: Hex;
  yParity: Hex;
  r: Hex;
  s: Hex;
};

function toYParity(auth: SignedAuthorization): number {
  if (typeof auth.yParity === 'number') return auth.yParity;
  return auth.v === 28n ? 1 : 0;
}

export function toRpcAuthorization(auth: SignedAuthorization): RpcAuthorization {
  return {
    chainId: numberToHex(auth.chainId),
    address: auth.address,
    nonce: numberToHex(auth.nonce),
    yParity: numberToHex(toYParity(auth)),
    // Signers return r/s as fixed-width zero-padded 32-byte hex (Privy's 7702 hook does);
    // JSON-RPC hex quantities must be canonical (no leading zeros) or geth-family nodes
    // reject the whole request with -32602. viem's send path trims internally, the raw
    // eth_call params built here do not — canonicalize through BigInt.
    r: numberToHex(BigInt(auth.r)),
    s: numberToHex(BigInt(auth.s)),
  };
}

/** Pull the deepest hex revert payload out of a call failure (viem nests it in cause). */
export function extractRevertData(error: unknown): Hex | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current !== null && typeof current === 'object'; depth += 1) {
    const data = (current as { data?: unknown }).data;
    if (typeof data === 'string' && /^0x[0-9a-fA-F]*$/.test(data) && data.length >= 10) {
      return data as Hex;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

/** RPC method missing / not exposed by this provider (mirrors tx-executor's classifier). */
function isMethodUnavailable(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  if (code === -32601 || code === -32604) return true;
  const message = String((error as { message?: unknown }).message ?? '');
  return /not supported|not implemented|method not found|does not exist|not available|unsupported/i.test(
    message,
  );
}

/**
 * Gas limit for a self-executed type-4 batch, shared by the send path and the in-app gas
 * preview so both quote the same number. eth_estimateGas ignores the authorizationList (a
 * codeless EOA returns intrinsic-only gas and the pool then rejects the tx below the true
 * intrinsic floor — observed 2026-10-25: 43,548 < 51,392). With a kernel address the EOA's
 * code is overridden to the 7702 designator so the estimate executes the real delegated
 * batch; nodes that reject overrides keep the ceiling. The intrinsic floor always covers
 * the per-authorization cost (EIP-7702: 25,000 gas per entry).
 */
export async function resolveType4GasLimit(input: {
  provider: { request: Eip1193RequestFn };
  chain: Chain;
  eoa: Hex;
  to: Hex;
  data: Hex;
  value?: bigint;
  nonce?: number;
  kernel?: Hex;
  authorizationCount?: number;
}): Promise<bigint> {
  const publicClient = createPublicClient({
    chain: input.chain,
    transport: custom({ request: input.provider.request }),
  });
  const base = {
    account: input.eoa,
    to: input.to,
    data: input.data,
    value: input.value ?? 0n,
    ...(input.nonce != null ? { nonce: input.nonce } : {}),
  };
  let estimate = 1_500_000n;
  try {
    estimate = input.kernel
      ? await publicClient.estimateGas({
          ...base,
          stateOverride: [
            { address: input.eoa, code: ('0xef0100' + input.kernel.slice(2)) as Hex },
          ],
        })
      : await publicClient.estimateGas(base);
  } catch {
    // keep the ceiling (limit-only: unused gas is refunded)
  }
  const count = BigInt(input.authorizationCount ?? 0);
  const floor = 21_000n + 25_000n * count + 16n * BigInt((input.data.length - 2) / 2) + 20_000n;
  const buffered = (estimate * 125n) / 100n;
  return buffered > floor ? buffered : floor;
}

export function buildType4Ports(input: {
  provider: { request: Eip1193RequestFn };
  chain: Chain;
  signAuthorization: AuthorizationSigner;
}): Type4Ports {
  const transport = custom({ request: input.provider.request });
  const publicClient = createPublicClient({ chain: input.chain, transport });
  const walletClient = createWalletClient({ chain: input.chain, transport });

  return {
    getPendingNonce: (eoa: Hex) =>
      publicClient.getTransactionCount({ address: eoa, blockTag: 'pending' }),
    getChainId: () => publicClient.getChainId(),
    getCode: async (eoa: Hex) => (await publicClient.getCode({ address: eoa })) ?? '0x',
    signAuthorization: (req, walletAddress) => input.signAuthorization(req, walletAddress),
    simulateType4: async (tx: UnsignedType4) => {
      // The authorizationList goes out if and only if it is non-empty: already-delegated
      // accounts simulate (and send) with no list at all — an empty list is invalid per
      // EIP-7702 and rejected by pools and eth_call alike.
      const list = tx.authorizationList;
      const params =
        list && list.length > 0
          ? {
              from: tx.eoa,
              to: tx.to,
              data: tx.data,
              value: numberToHex(tx.value),
              authorizationList: list.map(toRpcAuthorization),
            }
          : { from: tx.eoa, to: tx.to, data: tx.data, value: numberToHex(tx.value) };
      try {
        await input.provider.request({ method: 'eth_call', params: [params, 'latest'] });
        return { ok: true as const };
      } catch (error) {
        return { ok: false as const, revertData: extractRevertData(error) };
      }
    },
    sendType4: async (tx: UnsignedType4) => {
      const list = tx.authorizationList?.length ? tx.authorizationList : undefined;
      const gasLimit =
        tx.gasLimit ??
        (await resolveType4GasLimit({
          provider: input.provider,
          chain: input.chain,
          eoa: tx.eoa,
          to: tx.to,
          data: tx.data,
          value: tx.value,
          nonce: tx.nonce,
          ...(list ? { kernel: list[0]!.address, authorizationCount: list.length } : {}),
        }));
      // The in-app gas control supplies both fees; only a caller without them pays for
      // the extra market-price read.
      const needsMarketPrice = tx.maxFeePerGas == null || tx.maxPriorityFeePerGas == null;
      const marketPrice = needsMarketPrice ? await publicClient.getGasPrice() : 0n;
      const maxFeePerGas = tx.maxFeePerGas ?? marketPrice * 2n;
      const maxPriorityFeePerGas = tx.maxPriorityFeePerGas ?? marketPrice;
      const base = {
        chainId: tx.chainId,
        to: tx.to,
        data: tx.data,
        value: tx.value,
        nonce: tx.nonce,
        gas: gasLimit,
        maxFeePerGas,
        maxPriorityFeePerGas,
      };
      const request = list
        ? {
            ...base,
            type: 'eip7702' as const,
            // viem's serializer requires an explicit yParity on every authorization.
            authorizationList: list.map((a) => ({ ...a, yParity: toYParity(a) })),
          }
        : { ...base, type: 'eip1559' as const };
      let signature: Hex;
      try {
        // 7702 direct-send: sign the raw transaction hash (keccak of the 0x04-prefixed
        // unsigned serialization, no EIP-191 wrapper) and broadcast ourselves — see the
        // file header for why the wallet-owned send cannot carry the authorizationList.
        // secp256k1_sign is Privy's own raw-signing primitive (their toViemAccount's
        // sign() uses exactly this); eth_sign is not exposed on embedded providers.
        signature = (await input.provider.request({
          method: 'secp256k1_sign',
          params: [keccak256(serializeTransaction(request))],
        })) as Hex;
      } catch (error) {
        // Wallets that own the full type-4 lifecycle keep their own send; on Privy a
        // fallback broadcasts the authorization-less type-2 no-op, so make the detour
        // visible instead of silent (observed on-chain 2026-10-25).
        if (isMethodUnavailable(error)) {
          if (process.env.NODE_ENV !== 'production') {
            console.error('[tx] raw-hash signing unavailable, falling back to wallet send', error);
          }
          return walletClient.sendTransaction({
            account: tx.eoa,
            chain: input.chain,
            to: tx.to,
            data: tx.data,
            value: tx.value,
            nonce: tx.nonce,
            // Absent list serializes as a plain type-2 (the delegated-account form).
            ...(list ? { authorizationList: list } : {}),
          });
        }
        throw error;
      }
      if (typeof signature !== 'string' || signature.length !== 132) {
        throw new Error('outrun: eth_sign returned a malformed signature');
      }
      const v = BigInt('0x' + signature.slice(130));
      const yParity = v === 28n || v === 1n ? 1 : 0;
      const signed = serializeTransaction(request, {
        r: signature.slice(2, 66) as Hex,
        s: signature.slice(66, 130) as Hex,
        v: 27n + BigInt(yParity),
        yParity,
      });
      return (await input.provider.request({
        method: 'eth_sendRawTransaction',
        params: [signed],
      })) as Hex;
    },
  };
}

// viem adapters for the Type-4 ports (architecture.md §6.3/§11.1).
// - Reads and the wallet-backed client run on the active wallet's EIP-1193 provider
//   (no RPC URLs or keys on the client path).
// - Simulation is a raw eth_call carrying the identical authorizationList (viem 2.55.10
//   types CallParameters without it, so the params object is built by hand — never let a
//   formatter silently drop the list).
// - Broadcast is walletClient.sendTransaction over the request union (EIP-7702 variant).
import {
  createPublicClient,
  createWalletClient,
  custom,
  numberToHex,
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
    r: auth.r,
    s: auth.s,
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
      try {
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
        await input.provider.request({ method: 'eth_call', params: [params, 'latest'] });
        return { ok: true as const };
      } catch (error) {
        return { ok: false as const, revertData: extractRevertData(error) };
      }
    },
    sendType4: (tx: UnsignedType4) =>
      walletClient.sendTransaction({
        account: tx.eoa,
        chain: input.chain,
        to: tx.to,
        data: tx.data,
        value: tx.value,
        nonce: tx.nonce,
        // Absent list serializes as a plain type-2 (the delegated-account form).
        ...(tx.authorizationList?.length ? { authorizationList: tx.authorizationList } : {}),
      }),
  };
}

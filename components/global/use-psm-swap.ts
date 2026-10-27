'use client';

import { useEffect, useState } from 'react';
import { createPublicClient, custom, formatUnits, type Hex } from 'viem';

import type { Locale } from '@/lib/data/fixture-repository';
import { psmAbi } from '@/lib/web3/abis';
import { getClientChainConfig } from '@/lib/web3/chains';
import { getActiveEip1193Provider } from '@/lib/web3/active-provider';
import { encodeKernelExecute } from '@/lib/web3/kernel';
import { toBaseUnits } from '@/lib/web3/base-units';
import {
  approvalCall,
  psmMintCall,
  psmRedeemCall,
} from '@/lib/web3/session-actions';

import {
  readAllowances,
  readErc20Meta,
  type ContractReader,
} from './execution-reads';
import { useAccountCenter } from './use-account-center';
import { useTxCenter } from './use-tx-center';

/**
 * Shared PSM face-value swap flow (Faucet Get-UUSD dialog + Portfolio Convert dialog).
 * Static reads (PSM pair addresses, token decimals) are pre-read once per account/chain
 * and cached; the click path only probes the mutable allowance and fires the wallet.
 * The review object is a state-machine anchor only: no estimateGas/balance read happens on
 * the click path (a rendered fee row comes from useGasQuote inside the review dialogs).
 * The two dialogs keep their own copy and layout; only the pipeline is shared.
 */
export function usePsmSwap(locale: Locale, uAssetSymbol: string) {
  const center = useAccountCenter();
  const { connected, connectAction: toggle } = center;
  const tx = useTxCenter();
  const [resolving, setResolving] = useState(false);
  const [resolveFailed, setResolveFailed] = useState(false);
  // Wallet refused/failed the EIP-7702 authorization before any popup: a capability gap
  // (e.g. MetaMask without 7702 signing), not a user decline.
  const [walletUnsupported, setWalletUnsupported] = useState(false);
  /** The wallet accepted the flow but the execution failed (revert, RPC, gas). */
  const [executionFailed, setExecutionFailed] = useState(false);
  const [pairCache, setPairCache] = useState<{
    chainId: number;
    address: string;
    reserveToken: Hex;
    uAsset: Hex;
    reserveDecimals: number;
    uAssetDecimals: number;
    /** Last probed allowance per pay token (stale-ok: only skips a probe when it already covers). */
    allowance: Partial<Record<Hex, bigint>>;
  } | null>(null);

  const executionReady =
    center.source === 'real' &&
    connected &&
    center.chainSupported &&
    center.chainId != null &&
    center.address != null;

  // A wallet/chain switch may bring a 7702-capable account; clear the stale capability
  // failure so the CTA is not left permanently disabled.
  useEffect(() => {
    setWalletUnsupported(false);
  }, [center.address, center.chainId]);

  // Pre-read static PSM data once the account/chain is known (async-* waterfall rule:
  // independent reads in one Promise.all, started before the click so the click path
  // needs only the mutable allowance probe).
  useEffect(() => {
    if (center.source !== 'real' || !connected || center.chainId == null || center.address == null) {
      setPairCache(null);
      return;
    }
    const provider = getActiveEip1193Provider();
    const chainId = center.chainId;
    const eoa = center.address;
    const resolved = getClientChainConfig(chainId);
    if (!provider || resolved.status !== 'ok' || resolved.config.contracts.status !== 'deployed')
      return;
    const psm = resolved.config.contracts.addresses[`OutrunPSM.${uAssetSymbol}`] as
      | Hex
      | undefined;
    if (!psm) return;
    let cancelled = false;
    const client = createPublicClient({
      chain: resolved.config.viemChain,
      transport: custom({ request: provider.request }),
    });
    const reader: ContractReader = {
      read: (readParams) => client.readContract(readParams) as Promise<unknown>,
    };
    void (async () => {
      try {
        const [reserveToken, uAsset] = (await Promise.all([
          reader.read({ address: psm, abi: psmAbi, functionName: 'reserveToken' }),
          reader.read({ address: psm, abi: psmAbi, functionName: 'uAsset' }),
        ])) as [Hex, Hex];
        const [{ decimals: reserveDecimals }, { decimals: uAssetDecimals }] = await Promise.all([
          readErc20Meta(reader, reserveToken),
          readErc20Meta(reader, uAsset),
        ]);
        // Warm the mutable allowance for both directions in the same tick. The click reuses
        // it when it already covers and re-probes silently in the background — the popup
        // never waits for this read.
        const [reserveAllowance, uAssetAllowance] = await Promise.all([
          readAllowances(reader, eoa as Hex, [{ token: reserveToken, spender: psm }])
            .then(([value]) => value)
            .catch(() => null),
          readAllowances(reader, eoa as Hex, [{ token: uAsset, spender: psm }])
            .then(([value]) => value)
            .catch(() => null),
        ]);
        if (!cancelled) {
          const allowance: Partial<Record<Hex, bigint>> = {};
          if (reserveAllowance != null) allowance[reserveToken] = reserveAllowance;
          if (uAssetAllowance != null) allowance[uAsset] = uAssetAllowance;
          setPairCache({
            chainId,
            address: eoa,
            reserveToken,
            uAsset,
            reserveDecimals,
            uAssetDecimals,
            allowance,
          });
        }
      } catch {
        if (!cancelled) setPairCache(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [center.source, connected, center.chainId, center.address, uAssetSymbol]);

  async function start(
    mode: 'mint' | 'redeem',
    amount: string,
    labels: { paySymbol: string; outSymbol: string; feeText: string },
    options?: { skipReview?: boolean },
  ): Promise<void> {
    if (!executionReady || resolving) return;
    const provider = getActiveEip1193Provider();
    const eoa = center.address as Hex | null;
    const chainId = center.chainId;
    if (!provider || !eoa || chainId == null) return;
    const resolved = getClientChainConfig(chainId);
    if (resolved.status !== 'ok' || resolved.config.contracts.status !== 'deployed') return;
    const contracts = resolved.config.contracts.addresses;
    const psm = contracts[`OutrunPSM.${uAssetSymbol}`] as Hex | undefined;
    const kernel = resolved.config.kernel7702Implementation as Hex;
    if (!psm) {
      setResolveFailed(true);
      return;
    }
    setResolving(true);
    setResolveFailed(false);
    setWalletUnsupported(false);
    setExecutionFailed(false);
    try {
      // Static pair data comes from the pre-read cache; only the mutable allowance is
      // probed on the click path. A missing cache (pre-read still in flight) falls back
      // to the same reads inline so the click never dead-ends.
      let reserveToken: Hex;
      let uAsset: Hex;
      let payDecimals: number;
      if (
        pairCache != null &&
        pairCache.chainId === chainId &&
        pairCache.address.toLowerCase() === eoa.toLowerCase()
      ) {
        reserveToken = pairCache.reserveToken;
        uAsset = pairCache.uAsset;
        payDecimals = mode === 'mint' ? pairCache.reserveDecimals : pairCache.uAssetDecimals;
      } else {
        const warmClient = createPublicClient({
          chain: resolved.config.viemChain,
          transport: custom({ request: provider.request }),
        });
        const warmReader: ContractReader = {
          read: (readParams) => warmClient.readContract(readParams) as Promise<unknown>,
        };
        const [warmReserve, warmUAsset] = (await Promise.all([
          warmReader.read({ address: psm, abi: psmAbi, functionName: 'reserveToken' }),
          warmReader.read({ address: psm, abi: psmAbi, functionName: 'uAsset' }),
        ])) as [Hex, Hex];
        reserveToken = warmReserve;
        uAsset = warmUAsset;
        payDecimals = (
          await readErc20Meta(warmReader, (mode === 'mint' ? reserveToken : uAsset) as Hex)
        ).decimals;
      }
      const client = createPublicClient({
        chain: resolved.config.viemChain,
        transport: custom({ request: provider.request }),
      });
      const reader: ContractReader = {
        read: (readParams) => client.readContract(readParams) as Promise<unknown>,
      };
      const payToken = (mode === 'mint' ? reserveToken : uAsset) as Hex;
      const amountIn = toBaseUnits(amount, payDecimals);
      if (amountIn === 0n) throw new Error('typed amount below one base unit');
      // Allowance: reuse the warmed value when it already covers, otherwise probe once.
      // Either way refresh silently in the background so the next click is warmer —
      // the popup never waits for this read.
      const cachedAllowance =
        pairCache != null &&
        pairCache.chainId === chainId &&
        pairCache.address.toLowerCase() === eoa.toLowerCase()
          ? pairCache.allowance[payToken]
          : undefined;
      let allowance: bigint;
      if (cachedAllowance != null && cachedAllowance >= amountIn) {
        allowance = cachedAllowance;
        const refreshReader: ContractReader = {
          read: (readParams) => client.readContract(readParams) as Promise<unknown>,
        };
        void readAllowances(refreshReader, eoa, [{ token: payToken, spender: psm }])
          .then(([fresh]) =>
            setPairCache((prev) =>
              prev == null ? prev : { ...prev, allowance: { ...prev.allowance, [payToken]: fresh! } },
            ),
          )
          .catch(() => undefined);
      } else {
        [allowance] = await readAllowances(reader, eoa, [{ token: payToken, spender: psm }]);
        const fresh = allowance;
        setPairCache((prev) =>
          prev == null ? prev : { ...prev, allowance: { ...prev.allowance, [payToken]: fresh } },
        );
      }
      const approval =
        allowance < amountIn
          ? approvalCall(payToken, psm, amountIn)
          : undefined;
      const action =
        mode === 'mint' ? psmMintCall(psm, eoa, amountIn) : psmRedeemCall(psm, eoa, amountIn);
      const calls = approval ? [approval, action] : [action];
      // PSM mint/redeem are direct contract calls: the Kernel batch carries the approval
      // and the action only. The Hook session guards are swap-only (hook beforeSwap reads
      // activePrincipal; PSM never routes through a hook pool) — wrapping PSM in
      // begin/end adds a revert surface (beginAccountSession rejects callers without code)
      // for no protection. External wallets already send these same legs via 5792.
      const batch = encodeKernelExecute(calls);
      if (options?.skipReview) {
        // §29 review-less path: the host dialog already lists the deal facts, so the wallet
        // popup is the only confirmation. The review object is a state-machine anchor only —
        // no estimateGas/balance read happens on any click path (see use-gas-quote).
        const outcome = await tx.executeSession({
          review: {
            chainId,
            account: eoa,
            targetContract: psm,
            functionName: mode === 'mint' ? 'mint' : 'redeem',
            inputs: `${formatUnits(amountIn, payDecimals)} ${labels.paySymbol}`,
            minOutput: '—',
            fee: labels.feeText,
            gasPayer: eoa,
            authorizationChange: approval
              ? `${formatUnits(amountIn, payDecimals)} ${labels.paySymbol}`
              : '—',
            estimatedGas: '—',
            nativeBalance: '—',
          },
          kernel,
          expectedChainId: chainId,
          batchCallData: batch,
          quoteId: `psm:${uAssetSymbol}:${mode}:${amountIn}`,
          minOutput: '—',
          slippageBps: 0,
          deadline: Math.floor(Date.now() / 1000) + 3600,
          manifestVersion: resolved.config.contracts.abiVersion,
          crossChain: false,
          // 5792 legs for external wallets (embedded wallets use batchCallData instead).
          calls,
        });
        if (outcome === 'unsupported') setWalletUnsupported(true);
        else if (outcome === 'failed') setExecutionFailed(true);
        return;
      }
      // Review path keeps the full deal facts: quote + gas estimate feed the panel.
      const outToken = (mode === 'mint' ? uAsset : reserveToken) as Hex;
      const [{ decimals: outDecimals }] = await Promise.all([readErc20Meta(reader, outToken)]);
      const quoted = (await reader.read({
        address: psm,
        abi: psmAbi,
        functionName: mode === 'mint' ? 'quoteMint' : 'quoteRedeem',
        args: [amountIn],
      })) as bigint;
      void tx.executeSession({
        review: {
          chainId,
          account: eoa,
          targetContract: psm,
          functionName: mode === 'mint' ? 'mint' : 'redeem',
          inputs: `${formatUnits(amountIn, payDecimals)} ${labels.paySymbol}`,
          minOutput: `${formatUnits(quoted, outDecimals)} ${labels.outSymbol}`,
          fee: labels.feeText,
          gasPayer: eoa,
          authorizationChange: approval
            ? `${formatUnits(amountIn, payDecimals)} ${labels.paySymbol}`
            : '—',
          estimatedGas: '—',
          nativeBalance: '—',
        },
        kernel,
        expectedChainId: chainId,
        batchCallData: batch,
        quoteId: `psm:${uAssetSymbol}:${mode}:${amountIn}`,
        minOutput: quoted.toString(),
        slippageBps: 0,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        manifestVersion: resolved.config.contracts.abiVersion,
        crossChain: false,
        // 5792 legs for external wallets (embedded wallets use batchCallData instead).
        calls,
      });
    } catch {
      setResolveFailed(true);
    } finally {
      setResolving(false);
    }
  }

  return {
    center,
    connected,
    toggle,
    tx,
    executionReady,
    start,
    resolving,
    resolveFailed,
    walletUnsupported,
    executionFailed,
  };
}

'use client'

/**
 * Get UUSD dialog (UUSD is obtainable only via PSM, and yield-bearing assets go straight through
 * stakeForGenesis without touching UUSD): two-way PSM face-value swap (Get = USDC→UUSD mint /
 * Back = UUSD→USDC redeem), mechanism facts (face value 1:1, tin/tout fees, mint bounded
 * by stockCap headroom, no slippage/deadline params → no settings gear). Primitives reuse
 * global/action-dialogs; CTA semantics = when connected, the action button is
 * gated only by input (no faked settlement) — same as ConvertDialog; in-flight progress = the
 * shared three-step strip. Balance display:
 * the SSR payload carries accountless values only — the connected wallet reads its own
 * PSM-pair balances through its provider when the dialog opens. Signed-out
 * gate: on onchain builds the yellow trigger keeps its look
 * but opens the login selector instead of the dialog; the harness (e2e/fixture)
 * path opens the dialog as before so baselines stay meaningful.
 */
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPublicClient, custom, formatUnits, type Hex } from 'viem'
import { formatBaseUnits, formatWadPercent, toBaseUnits } from '@/lib/web3/base-units'
import { psmMintQuote, psmRedeemQuote } from '@/lib/web3/contract-formulas'

import type { Faucet, Locale } from '@/lib/data/fixture-repository'
import { erc20ReadAbi, psmAbi } from '@/lib/web3/abis'
import { getClientChainConfig } from '@/lib/web3/chains'
import { getActiveEip1193Provider } from '@/lib/web3/active-provider'

import { ActionDialogShell, AmountField, DetailRows, DialogCta } from '../global/action-dialogs'
import { getCopy } from '../global/copy'
import { readErc20Meta, type ContractReader } from '../global/execution-reads'
import { useAccountCenter } from '../global/use-account-center'
import { usePsmSwap } from '../global/use-psm-swap'
import { useClearOnConfirmed } from '../global/use-tx-center'
import { TxStatus } from '../global/tx-status'
import { formatAmount, formatPercent } from '../global/signal-ui'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import { FieldError } from '@/components/ui/field'

export function FaucetSwapDialog({ locale, swap }: { locale: Locale; swap: Faucet['swap'] }) {
  const copy = getCopy(locale).faucet
  const psm = usePsmSwap(locale, swap.uAssetSymbol)
  const {
    connected,
    toggle,
    tx,
    executionReady,
    resolving,
    resolveFailed,
    walletUnsupported,
    executionFailed,
  } = psm
  const [mode, setMode] = useState<'get' | 'back'>('get')
  const [amount, setAmount] = useState('')
  // Each mode pays a different token, so a carried-over amount would be read against the
  // other side's balance and fee; switching direction clears the field.
  const switchMode = (next: 'get' | 'back') => {
    if (next === mode) return
    setMode(next)
    setAmount('')
  }
  const [open, setOpen] = useState(false)
  // Closing discards the transaction center state: a batch left Confirming… (poll deadline)
  // must not keep the CTA disabled the next time the dialog opens.
  useEffect(() => {
    if (!open) tx.reset()
  }, [open, tx.reset])
  useClearOnConfirmed(tx.display, () => setAmount(''))
  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0
  const fee = mode === 'get' ? swap.feeIn : swap.feeOut
  const paySymbol = mode === 'get' ? swap.reserveSymbol : swap.uAssetSymbol
  const outSymbol = mode === 'get' ? swap.uAssetSymbol : swap.reserveSymbol

  const center = useAccountCenter()
  const lockTrigger = center.source === 'real' && !connected
  const liveBalances = center.source === 'real' && connected

  // Connected balances are read client-side through the wallet provider when the dialog opens
  // (personal values never ride the SSR path — the server carries accountless
  // values only). In flight / failed → null → AmountField '--' (null-不渲染); disconnected → the
  // server-passed value (fixture sample in fixture mode, 0 in onchain mode).
  const [balances, setBalances] = useState<{ uAsset: number; reserve: number } | null>(null)
  // Token decimals resolved with the balances read: the exact receive quote needs them.
  const [tokenDecimals, setTokenDecimals] = useState<{ uAsset: number; reserve: number } | null>(
    null,
  )
  // Exact quote when the chain wads + decimals landed (Get = mint, Back = redeem); the
  // fixture sample keeps the ratio math so recorded baselines stay byte-identical.
  const feeWad = mode === 'get' ? swap.feeInWad : swap.feeOutWad
  const payDecimals = tokenDecimals == null ? null : mode === 'get' ? tokenDecimals.reserve : tokenDecimals.uAsset
  const outDecimals = tokenDecimals == null ? null : mode === 'get' ? tokenDecimals.uAsset : tokenDecimals.reserve
  const exactReceive: string | null = (() => {
    if (!valid || feeWad == null || payDecimals == null) return null
    const inputBase = toBaseUnits(amount, payDecimals)
    const wad = BigInt(feeWad)
    if (mode === 'get') {
      // The PSM mints 18-dec uAsset: payout in the uAsset's own base units.
      return formatBaseUnits(psmMintQuote(inputBase, payDecimals, wad).amountOut, 18, locale)
    }
    if (outDecimals == null) return null
    const payout = psmRedeemQuote(inputBase, outDecimals, wad).amountOut
    return formatBaseUnits(payout, outDecimals, locale)
  })()
  const feePercentText =
    feeWad != null
      ? formatWadPercent(BigInt(feeWad), locale)
      : fee != null
        ? formatPercent(fee * 100, locale)
        : null

  // Confirmed swap re-read key: bumped only on a confirmed write, so only the post-trade
  // refresh re-runs the balances effect — never a full reset, never on every render.
  const [settledTick, setSettledTick] = useState(0)
  const prevDisplayRef = useRef<string | null>(null)
  useEffect(() => {
    if (tx.display === 'confirmed' && prevDisplayRef.current !== 'confirmed') {
      setSettledTick((tick) => tick + 1)
    }
    prevDisplayRef.current = tx.display
  }, [tx.display])
  useEffect(() => {
    if (!open || !liveBalances || center.chainId == null || center.address == null) return
    const provider = getActiveEip1193Provider()
    const eoa = center.address as Hex
    const resolved = getClientChainConfig(center.chainId)
    if (!provider || resolved.status !== 'ok' || resolved.config.contracts.status !== 'deployed') return
    const psmAddr = resolved.config.contracts.addresses[`OutrunPSM.${swap.uAssetSymbol}`] as Hex | undefined
    if (!psmAddr) return
    let cancelled = false
    const client = createPublicClient({
      chain: resolved.config.viemChain,
      transport: custom({ request: provider.request }),
    })
    const reader: ContractReader = {
      read: (readParams) => client.readContract(readParams) as Promise<unknown>,
    }
    const readBalance = async (token: Hex) => {
      const [raw, { decimals }] = await Promise.all([
        reader.read({ address: token, abi: erc20ReadAbi, functionName: 'balanceOf', args: [eoa] }),
        readErc20Meta(reader, token),
      ])
      return { value: Number(formatUnits(BigInt(String(raw)), decimals)), decimals }
    }
    void (async () => {
      try {
        const [uAsset, reserve] = (await Promise.all([
          reader.read({ address: psmAddr, abi: psmAbi, functionName: 'uAsset' }),
          reader.read({ address: psmAddr, abi: psmAbi, functionName: 'reserveToken' }),
        ])) as [Hex, Hex]
        const [myUAsset, myReserve] = await Promise.all([readBalance(uAsset), readBalance(reserve)])
        if (!cancelled) {
          setBalances({ uAsset: myUAsset.value, reserve: myReserve.value })
          setTokenDecimals({ uAsset: myUAsset.decimals, reserve: myReserve.decimals })
        }
      } catch {
        // silent degrade: AmountField keeps '--'
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, liveBalances, center.chainId, center.address, swap.uAssetSymbol, settledTick])

  const fallbackBalance = mode === 'get' ? swap.myReserve : swap.myUAsset
  const balance = !liveBalances
    ? fallbackBalance
    : balances == null
      ? null
      : mode === 'get'
        ? balances.reserve
        : balances.uAsset

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {lockTrigger ? (
        <Button className="ax-ghost-cta" size="sm" onClick={toggle}>
          {copy.swapCta}
        </Button>
      ) : (
        <DialogTrigger data-slot="button" render={<Button className="ax-ghost-cta" size="sm" />}>
          {copy.swapCta}
        </DialogTrigger>
      )}
      <ActionDialogShell title={copy.swapTitle} closeLabel={getCopy(locale).common.close}>
        <div className="pf-dialog__chips" role="group">
          <button type="button" data-selected={mode === 'get' || undefined} onClick={() => switchMode('get')}>
            {copy.modeGet}
          </button>
          <button type="button" data-selected={mode === 'back' || undefined} onClick={() => switchMode('back')}>
            {copy.modeBack}
          </button>
        </div>
        <AmountField
          locale={locale}
          label={copy.amount}
          balance={balance}
          balanceLabel={copy.balance}
          maxLabel={copy.max}
          value={amount}
          onValue={setAmount}
          tokenSymbol={paySymbol}
          ariaLabel={`${copy.amount} (${paySymbol})`}
        />
        <DetailRows
          rows={[
            [
              copy.rate,
              <span key="rate" data-numeric>
                {mode === 'get'
                  ? `1 ${swap.reserveSymbol} = 1 ${swap.uAssetSymbol}`
                  : `1 ${swap.uAssetSymbol} = 1 ${swap.reserveSymbol}`}
              </span>,
            ],
            [
              copy.fee,
              feePercentText == null ? (
                '--'
              ) : (
                <span key="fee" data-numeric>
                  {feePercentText}%
                </span>
              ),
            ],
            [
              copy.youReceive,
              valid && fee != null ? (
                <span key="receive" data-numeric>
                  {exactReceive ?? formatAmount(parsed * (1 - fee), locale)} {outSymbol}
                </span>
              ) : (
                '--'
              ),
            ],
            // Mint headroom constrains only the Get (mint) direction (PSM stockCap; same
            // semantics as ConvertDialog)
            ...(mode === 'get'
              ? ([
                  [
                    copy.headroom,
                    swap.headroom == null ? (
                      '--'
                    ) : (
                      <span key="headroom" data-numeric>
                        {formatAmount(swap.headroom, locale)} {swap.uAssetSymbol}
                      </span>
                    ),
                  ],
                ] as Array<[string, ReactNode]>)
              : []),
          ]}
        />
        <DialogCta
          locale={locale}
          connected={connected}
          onConnect={toggle}
          onAction={() =>
            void psm.start(
              mode === 'get' ? 'mint' : 'redeem',
              amount,
              {
                paySymbol,
                outSymbol,
                feeText: fee != null ? `${formatPercent(fee * 100, locale)}%` : '—',
              },
              // No review panel (§29): the dialog's four detail rows already carry the deal
              // facts, so the wallet popup is the only confirmation.
              { skipReview: true },
            )
          }
          label={mode === 'get' ? copy.ctaGet : copy.ctaBack}
          disabled={
            !valid ||
            !executionReady ||
            resolving ||
            tx.running ||
            tx.display === 'confirming' ||
            walletUnsupported
          }
        />
        {walletUnsupported ? (
          <FieldError>{getCopy(locale).wallet.account.callsUnsupported}</FieldError>
        ) : null}
        {executionFailed ? (
          <FieldError>{getCopy(locale).wallet.errors.txFailed}</FieldError>
        ) : null}
        {resolveFailed ? <FieldError>{getCopy(locale).common.degrade.errorBody}</FieldError> : null}
        {/* Progress = the shared three-step strip, same slot as every other action dialog.
            Embedded-wallet signing is silent, so the wallet popup cannot be the only
            feedback. */}
        {tx.active && !tx.reviewing ? <TxStatus locale={locale} state={tx.display} /> : null}
      </ActionDialogShell>
    </Dialog>
  )
}

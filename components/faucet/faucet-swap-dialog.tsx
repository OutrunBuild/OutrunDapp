'use client'

/**
 * Get UUSD dialog (UUSD is obtainable only via PSM, and yield-bearing assets go straight through
 * stakeForGenesis without touching UUSD): two-way PSM face-value swap (Get = USDC→UUSD mint /
 * Back = UUSD→USDC redeem), mechanism facts (face value 1:1, tin/tout fees, mint bounded
 * by stockCap headroom, no slippage/deadline params → no settings gear). Primitives reuse
 * global/action-dialogs; CTA semantics = when connected, the action button is
 * gated only by input (no faked settlement) — same as ConvertDialog; in-flight feedback =
 * the faucet progress/success dialog pair (faucet-tx-dialogs), never a strip in this
 * dialog. Balance display:
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
import { evaluateAmountBalance, typedAmountPositive } from '../global/amount-input'
import { TxProgressDialog } from '../global/tx-progress-dialog'
import { TxSuccessDialog } from '../global/tx-success-dialog'
import { useTxSuccessGate } from '../global/use-tx-success'
import { getCopy } from '../global/copy'
import { readErc20Meta, type ContractReader } from '../global/execution-reads'
import { useAccountCenter } from '../global/use-account-center'
import { usePsmSwap } from '../global/use-psm-swap'
import { useClearOnConfirmed } from '../global/use-tx-center'
import { formatAmount, formatPercent } from '../global/signal-ui'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import { FieldError } from '@/components/ui/field'

export function FaucetSwapDialog({ locale, swap }: { locale: Locale; swap: Faucet['swap'] }) {
  const copy = getCopy(locale).faucet
  // Unresolved uAsset (address outside the deployment tables): symbol slots render empty and
  // the PSM hook misses its key — every swap action fails closed, no borrowed symbol
  const uAssetLabel = swap.uAssetSymbol ?? ''
  const psm = usePsmSwap(locale, uAssetLabel)
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
  // Success-dialog echo captured at click time: the amount input is cleared on confirm, so
  // the receipt cannot re-derive the legs from live state.
  const [deal, setDeal] = useState<{
    pay: string
    paySymbol: string
    receive: string
    outSymbol: string
  } | null>(null)
  const { successOpen, setSuccessOpen, receipt } = useTxSuccessGate(tx)
  // Closing discards the transaction center state: a batch left Confirming… (poll deadline)
  // must not keep the CTA disabled the next time the dialog opens.
  useEffect(() => {
    if (!open) tx.reset()
  }, [open, tx.reset])
  useClearOnConfirmed(tx.display, () => setAmount(''))
  const parsed = Number(amount)
  const fee = mode === 'get' ? swap.feeIn : swap.feeOut
  const paySymbol = mode === 'get' ? swap.reserveSymbol : uAssetLabel
  const outSymbol = mode === 'get' ? uAssetLabel : swap.reserveSymbol

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
  // Exact wallet balances (raw base units + decimals): the gate/Max/balance display reads
  // these — the float `balances` above stays only for legacy display fallbacks.
  const [exactBalances, setExactBalances] = useState<{
    uAsset: { base: bigint; decimals: number }
    reserve: { base: bigint; decimals: number }
  } | null>(null)
  // Execution-chain mint headroom (stockCap−netUAssetMinted): the SSR `swap.headroom`
  // belongs to the faucet config chain, so a mint executed on another wallet chain must
  // gate on that chain's own PSM — never on the config chain's number.
  const [chainHeadroom, setChainHeadroom] = useState<bigint | null>(null)
  // Exact quote when the chain wads + decimals landed (Get = mint, Back = redeem); the
  // fixture sample keeps the ratio math so recorded baselines stay byte-identical.
  const feeWad = mode === 'get' ? swap.feeInWad : swap.feeOutWad
  const payDecimals = tokenDecimals == null ? null : mode === 'get' ? tokenDecimals.reserve : tokenDecimals.uAsset
  const outDecimals = tokenDecimals == null ? null : mode === 'get' ? tokenDecimals.uAsset : tokenDecimals.reserve
  // Sub-unit typed amounts (they parse to 0n base units of the paying token) fail valid and
  // can no longer arm the CTA — the verse trade dialogs' shared predicate; with the exact
  // probe unlanded the float half decides and execution re-checks against fresh decimals.
  const valid = typedAmountPositive(amount, payDecimals ? { decimals: payDecimals } : null)
  // Net uAsset output of the Get (mint) quote in 18-dec base units: the chain's stockCap
  // check compares THIS fee-net output, never the typed reserve amount. Shared with the
  // receive row so the cap gate and the displayed quote cannot diverge.
  const mintOutBase =
    mode === 'get' && valid && feeWad != null && payDecimals != null
      ? psmMintQuote(toBaseUnits(amount, payDecimals), payDecimals, BigInt(feeWad)).amountOut
      : null
  const exactReceive: string | null = (() => {
    if (mode === 'get') {
      // The PSM mints 18-dec uAsset: payout in the uAsset's own base units.
      return mintOutBase == null ? null : formatBaseUnits(mintOutBase, 18, locale)
    }
    if (!valid || feeWad == null || payDecimals == null || outDecimals == null) return null
    const payout = psmRedeemQuote(toBaseUnits(amount, payDecimals), outDecimals, BigInt(feeWad)).amountOut
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
  // Scope key of the landed balances/decimals reads (compared at the balances effect entry).
  const balanceScopeRef = useRef<string | null>(null)
  useEffect(() => {
    if (tx.display === 'confirmed' && prevDisplayRef.current !== 'confirmed') {
      setSettledTick((tick) => tick + 1)
    }
    prevDisplayRef.current = tx.display
  }, [tx.display])
  useEffect(() => {
    // A chain/account switch invalidates the previous chain's headroom before the read
    // lands: the cap gate must never act on another chain's number.
    setChainHeadroom(null)
    // Balances/decimals are chain+account scoped the same way: a switch drops the previous
    // scope's landed values so the balance gate fails closed (balanceUnknown) instead of
    // judging on another chain/account's numbers until the fresh read lands. The
    // settledTick re-read keeps its landed values — same scope.
    const balanceScope =
      center.chainId == null || center.address == null
        ? null
        : `${center.chainId}:${center.address}`
    if (balanceScopeRef.current !== balanceScope) {
      balanceScopeRef.current = balanceScope
      setBalances(null)
      setTokenDecimals(null)
      setExactBalances(null)
    }
    if (!open || !liveBalances || center.chainId == null || center.address == null) return
    const provider = getActiveEip1193Provider()
    const eoa = center.address as Hex
    const resolved = getClientChainConfig(center.chainId)
    if (!provider || resolved.status !== 'ok' || resolved.config.contracts.status !== 'deployed') return
    const psmAddr = resolved.config.contracts.addresses[`OutrunPSM.${uAssetLabel}`] as Hex | undefined
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
      const base = BigInt(String(raw))
      return { value: Number(formatUnits(base, decimals)), base, decimals }
    }
    void (async () => {
      try {
        const [uAsset, reserve] = (await Promise.all([
          reader.read({ address: psmAddr, abi: psmAbi, functionName: 'uAsset' }),
          reader.read({ address: psmAddr, abi: psmAbi, functionName: 'reserveToken' }),
        ])) as [Hex, Hex]
        // Execution-chain headroom runs parallel with the balances; a failed read leaves the
        // cap gate silent (null 不门控) instead of borrowing the config chain's SSR value.
        const headroom = Promise.all([
          reader.read({ address: psmAddr, abi: psmAbi, functionName: 'stockCap' }),
          reader.read({ address: psmAddr, abi: psmAbi, functionName: 'netUAssetMinted' }),
        ])
          .then(([stockCap, netMinted]) => {
            const stock = BigInt(String(stockCap))
            const minted = BigInt(String(netMinted))
            return stock > minted ? stock - minted : 0n
          })
          .catch(() => null)
        const [myUAsset, myReserve] = await Promise.all([readBalance(uAsset), readBalance(reserve)])
        if (cancelled) return
        // Balances land before the headroom read settles: a slow cap read must not hold the
        // balance gate hostage (the CTA would stay disabled on an unknown balance).
        setBalances({ uAsset: myUAsset.value, reserve: myReserve.value })
        setTokenDecimals({ uAsset: myUAsset.decimals, reserve: myReserve.decimals })
        setExactBalances({
          uAsset: { base: myUAsset.base, decimals: myUAsset.decimals },
          reserve: { base: myReserve.base, decimals: myReserve.decimals },
        })
        const chainHeadroomValue = await headroom
        if (!cancelled) setChainHeadroom(chainHeadroomValue)
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
  const exactBalance = !liveBalances
    ? null
    : exactBalances == null
      ? null
      : mode === 'get'
        ? exactBalances.reserve
        : exactBalances.uAsset

  // Submit gate: the same shared predicate as AmountField's error row (over-balance) plus
  // the unknown-balance block; the mint direction also refuses an amount whose fee-net
  // output exceeds the execution chain's remaining stockCap headroom.
  const amountGate = evaluateAmountBalance(amount, balance, exactBalance)
  const overMintCap = chainHeadroom != null && mintOutBase != null && mintOutBase > chainHeadroom

  return (
    <>
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
          exactBalance={exactBalance}
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
                  ? `1 ${swap.reserveSymbol} = 1 ${uAssetLabel}`
                  : `1 ${uAssetLabel} = 1 ${swap.reserveSymbol}`}
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
                        {formatAmount(swap.headroom, locale)} {uAssetLabel}
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
          onAction={() => {
            setDeal({
              pay: formatAmount(parsed, locale),
              paySymbol,
              receive:
                exactReceive ??
                (valid ? formatAmount(parsed * (1 - (fee ?? 0)), locale) : amount),
              outSymbol,
            })
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
          }}
          label={mode === 'get' ? copy.ctaGet : copy.ctaBack}
          disabled={
            !valid ||
            amountGate.blocked ||
            overMintCap ||
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
      </ActionDialogShell>
    </Dialog>
    {/* Feedback pair (2026-10-26 用户裁定): progress = its own button-less dialog stacked on
        this one (always second-to-last); confirmed yields to the success dialog, the last
        one. Failure rows stay in this dialog underneath. */}
    <TxProgressDialog
      locale={locale}
      title={copy.swapTitle}
      state={tx.display}
      open={tx.active && !successOpen}
      onDismiss={tx.reset}
    />
    <TxSuccessDialog
      locale={locale}
      title={mode === 'get' ? copy.swapDoneGet : copy.swapDoneBack}
      lead={mode === 'get' ? copy.swapDoneGetLead : copy.swapDoneBackLead}
      accent={copy.swapDoneAccent}
        rows={[
          ...(deal
            ? [
                {
                  label: getCopy(locale).common.txYouPaid,
                  value: deal.pay,
                  symbol: deal.paySymbol,
                },
                {
                  label: getCopy(locale).common.txReceived,
                  value: deal.receive,
                  symbol: deal.outSymbol,
                },
              ]
            : []),
        ]}
      txHash={receipt?.hash}
      txChainId={receipt?.chainId}
      open={successOpen}
      onOpenChange={setSuccessOpen}
    />
    </>
  )
}

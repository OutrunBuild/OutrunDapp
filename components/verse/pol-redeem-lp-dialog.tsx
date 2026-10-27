'use client'

import { useEffect, useId, useRef, useState } from 'react'

import type { Locale, PolPosition, Verse } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { ActionDialogShell } from '../global/action-dialogs'
import { useVerseBalances } from './trade-balances'
import { useAccountCenter } from '../global/use-account-center'
import { useTxCenter, useClearOnConfirmed, type WriteSpec } from '../global/use-tx-center'
import { TxProgressDialog } from '../global/tx-progress-dialog'
import { TxSuccessDialog, type TxSuccessRow } from '../global/tx-success-dialog'
import { useTxSuccessGate } from '../global/use-tx-success'
import { readAllowances } from '../global/execution-reads'
import { getTokenDecimals, getVerseSession } from '../global/write-session'
import { getActiveEip1193Provider } from '@/lib/web3/active-provider'
import {
  approvalCall,
  buildSessionWrite,
  redeemMemecoinLiquidityCall,
} from '@/lib/web3/session-actions'
import { useParams } from 'next/navigation'
import { parseVerseIdParam } from '../global/routes'
import { SwitchChainCta, useVerseExecChain } from '../global/switch-chain-cta'
import { formatUnits, type Hex } from 'viem'
import { toBaseUnits } from '@/lib/web3/base-units'
import { AMOUNT_MAX_CHARS, amountToInputString, sanitizeAmount, trimFractionZeros, typedAmountPositive } from '../global/amount-input'
import { fmtTokenAmountExact } from '../global/amount-format'
import { formatAmount } from '../global/signal-ui'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { FieldError } from '@/components/ui/field'

/**
 * Redeem POL action dialog (the POL asset card's Redeem button).
 * Mechanism: burning POL returns main-pool (memecoin/uAsset)
 * LP tokens 1:1 by main-pool construction
 * (amountInLP=amountInPOL). The unwrap=false direct LP transfer path is not price
 * sensitive → the contract has no slippage/deadline parameters → no settings gear
 * (the unwrap=true split into memecoin+uAsset 6-parameter slippage entry does not belong in
 * this dialog). Gate is unlocked only (locked/unsettled states revert with NotUnlockedStage).
 * The You receive row stays: 1:1 identity, but the input POL and the output LP token are
 * different identities (unlike the Split/Merge dialog, which drops the
 * output area — this is not a restatement of the input); LP display symbol=main-pool pair
 * scope {MEME}/{uAsset} LP (repository main pool pair; consistent with the two pool dialogs'
 * lpSymbol convention — on-chain the ERC20 of every pool statically shares symbol "MLP"/name
 * "Memeverse LP", so pools can only be told apart by the pair scope);
 * opens with empty input; CTA discipline as before:
 * disconnected=Connect Wallet clickable; connected=action button disabled (no faked execution).
 */
export function PolRedeemLpDialog({
  locale,
  verse,
  pol,
}: {
  locale: Locale
  verse: Verse
  pol: PolPosition
}) {
  const copy = getCopy(locale).verseDesk
  const common = getCopy(locale).common
  const center = useAccountCenter()
  const { connected, connectAction: toggle } = center
  const { execChain, wrongChain, switchChain } = useVerseExecChain(verse.governanceChain)
  const tx = useTxCenter()
  const { successOpen, setSuccessOpen, receipt } = useTxSuccessGate(tx)
  // Receipt legs snapshotted at the click (the amount clears on landing).
  const [redeemRows, setRedeemRows] = useState<TxSuccessRow[]>([])
  const params = useParams()
  const rawVerseId = params?.verseId
  const verseId = parseVerseIdParam(rawVerseId)
  // Opens with empty input (amount input defaults to empty 0.00, not prefilled with balance)
  const [amount, setAmount] = useState('')
  const [resolving, setResolving] = useState(false)
  const [resolveFailed, setResolveFailed] = useState(false)
  const balanceErrorId = useId()
  useClearOnConfirmed(tx.display, () => setAmount(''))

  // Wallet-provider POL balance (onchain builds); re-reads when a redeem confirms here.
  const [settleTick, setSettleTick] = useState(0)
  const prevDisplayRef = useRef<string | null>(null)
  useEffect(() => {
    if (tx.display === 'confirmed' && prevDisplayRef.current !== 'confirmed') {
      setSettleTick((tick) => tick + 1)
    }
    prevDisplayRef.current = tx.display
  }, [tx.display])
  const live = useVerseBalances({
    verseId,
    governanceChain: verse.governanceChain,
    refreshKey: settleTick,
  })
  const myPolLive = live?.pol ?? pol.myPol
  // Exact wallet read wins over the float alias whenever the probe landed (float64 can
  // round a real balance upward — a Max prefill re-parsed from it would trip the gate)
  const polExact = live?.exact.pol ?? null

  const polSymbol = `POL-${verse.symbol}`
  // Main-pool LP pair scope (repository main pool pair [verse.symbol, verse.raiseAsset])
  const lpSymbol = `${verse.symbol}/${verse.raiseAsset} LP`
  const clean = (raw: string) => setAmount(sanitizeAmount(raw))

  const parsed = Number(amount)
  const valid = typedAmountPositive(amount, polExact)
  // A null balance (accountless slot) never blocks — the chain enforces real holdings at execution
  const overBalance =
    polExact != null
      ? Number.isFinite(parsed) && toBaseUnits(amount, polExact.decimals) > polExact.base
      : myPolLive != null && parsed > myPolLive
  // 1:1 identity by main-pool construction (amountInLP=amountInPOL), no sample/slot branch
  const lpOut = valid ? parsed : null
  // POL burn by the launcher proxy spends the holder's allowance (MemePol.burn third-party
  // path), so the approval leg rides along when allowance is short.
  const executionReady =
    center.source === 'real' &&
    connected &&
    center.chainSupported &&
    !wrongChain &&
    center.chainId != null &&
    center.address != null &&
    verseId != null

  async function startRedeemReview(): Promise<void> {
    if (!executionReady || !valid || overBalance || resolving) return
    setRedeemRows([
      {
        label: common.txYouRedeemed,
        value: formatAmount(Number(amount), locale),
        symbol: polSymbol,
      },
      {
        label: common.txReceived,
        value: lpOut != null ? formatAmount(lpOut, locale) : '—',
        symbol: 'LP',
      },
    ])
    const provider = getActiveEip1193Provider()
    const eoa = center.address as Hex | null
    const chainId = center.chainId
    if (!provider || !eoa || chainId == null || verseId == null) return
    setResolving(true)
    setResolveFailed(false)
    try {
      // 静态半命中页面预热缓存（0 往返），点击链路只剩一轮并行 allowance 读
      // One executable chain: a provider answering another chain is refused (VerseChainError),
      // never silently read — these dialogs' figures are loaded for this chain only.
      const session = await getVerseSession({
        provider,
        chains: [chainId],
        eoa,
        verseId: BigInt(verseId),
      })
      const launcher = session.contracts.MemeverseLauncher as Hex
      const decimals = await getTokenDecimals(session.reader, chainId, session.verse.pol)
      const amountBase = toBaseUnits(amount, decimals)
      if (amountBase === 0n) throw new Error('typed amount below one base unit')
      const [allowance] = await readAllowances(session.reader, eoa, [
        { token: session.verse.pol, spender: launcher },
      ])
      const approval =
        allowance < amountBase
          ? approvalCall(session.verse.pol, launcher, amountBase)
          : undefined
      const action = redeemMemecoinLiquidityCall(launcher, { verseId: BigInt(verseId), amountInPOL: amountBase })
      const { calls, calldata: batch } = buildSessionWrite({ hook: session.hook, action, approval })
      const spec: WriteSpec = {
        review: {
          chainId,
          account: eoa,
          targetContract: launcher,
          functionName: 'redeemMemecoinLiquidity',
          inputs: `${formatUnits(amountBase, decimals)} ${polSymbol}`,
          minOutput: `${formatUnits(amountBase, decimals)} ${lpSymbol}`,
          fee: '—',
          gasPayer: eoa,
          authorizationChange: approval
              ? `${formatUnits(amountBase, decimals)} ${polSymbol}`
              : '—',
          estimatedGas: '—',
          nativeBalance: '—',
        },
        kernel: session.kernel,
        expectedChainId: chainId,
        batchCallData: batch,
        calls,
        quoteId: `redeem-lp:${verseId}:${amountBase}`,
        minOutput: amountBase.toString(),
        slippageBps: 0,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        manifestVersion: session.manifestVersion,
        crossChain: false,
        writeScope: { kind: 'verse', chainId, verseId },
      }
      void tx.executeSession(spec)
    } catch {
      setResolveFailed(true)
    } finally {
      setResolving(false)
    }
  }

  return (
    <>
      <Dialog>
      {/* data-slot pinned back to button: same as PolMintDialog — the theme bridge matches skins on [data-slot='button'] */}
      <DialogTrigger data-slot="button" render={<Button variant="outline" size="sm" />}>
        {copy.redeemPol}
      </DialogTrigger>
      <ActionDialogShell title={copy.redeemPolDialogTitle} closeLabel={common.close}>

          <div className="swap-panel__field">
            <div className="swap-panel__field-head">
              <span>POL</span>
              <span className="swap-panel__balance">
                {copy.balance}:{' '}
                {polExact != null ? (
                  <span data-numeric>{fmtTokenAmountExact(polExact.base, polExact.decimals, locale)}</span>
                ) : myPolLive != null ? (
                  <span data-numeric>{formatAmount(myPolLive, locale)}</span>
                ) : (
                  '--'
                )}
                <button
                  type="button"
                  className="swap-panel__max"
                  disabled={polExact != null ? polExact.base === 0n : myPolLive == null || myPolLive <= 0}
                  onClick={() =>
                    clean(
                      polExact != null
                        ? trimFractionZeros(formatUnits(polExact.base, polExact.decimals))
                        : amountToInputString(myPolLive ?? 0),
                    )
                  }
                >
                  {copy.max}
                </button>
              </span>
            </div>
            <div className="swap-panel__field-row">
              <Input
                className="numeric-input"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                maxLength={AMOUNT_MAX_CHARS}
                onChange={(event) => clean(event.target.value)}
                aria-label={`${copy.redeemPol} ${polSymbol}`}
                aria-invalid={overBalance || undefined}
                aria-describedby={overBalance ? balanceErrorId : undefined}
              />
              <div className="swap-panel__token">
                <strong>{polSymbol}</strong>
              </div>
            </div>
            {overBalance ? (
              <FieldError id={balanceErrorId}>{common.insufficientBalance}</FieldError>
            ) : null}
          </div>

          <dl className="swap-panel__details">
            <div>
              <dt>{copy.youReceive}</dt>
              <dd data-numeric>
                {lpOut != null ? formatAmount(lpOut, locale) : '0.00'} {lpSymbol}
              </dd>
            </div>
          </dl>

          {connected ? (
            wrongChain ? (
              <SwitchChainCta
                locale={locale}
                execChain={execChain}
                chainName={verse.governanceChainName}
                onSwitch={switchChain}
                className="swap-panel__cta"
              />
            ) : (
              <Button
                className="swap-panel__cta"
                disabled={!valid || overBalance || !executionReady || resolving || tx.running}
                onClick={() => void startRedeemReview()}
              >
                {copy.redeemPol}
              </Button>
            )
          ) : (
            <Button className="swap-panel__cta" onClick={toggle}>
              {copy.swapCta}
            </Button>
          )}
          {resolveFailed ? <FieldError>{common.degrade.errorBody}</FieldError> : null}
      </ActionDialogShell>
      </Dialog>
      {/* Feedback pair (2026-10-26 弹窗序列纪律): progress = its own button-less dialog
          (second-to-last), confirmed yields to the generic receipt dialog (last). */}
      <TxProgressDialog
        locale={locale}
        title={copy.redeemPolDialogTitle}
        state={tx.display}
        open={tx.active && !successOpen}
        onDismiss={tx.reset}
      />
      <TxSuccessDialog
        locale={locale}
        title={copy.redeemPolDoneTitle}
        lead={copy.redeemPolDoneLead}
        accent={copy.redeemPolDoneAccent}
        rows={redeemRows}
        txHash={receipt?.hash}
        txChainId={receipt?.chainId}
        open={successOpen}
        onOpenChange={setSuccessOpen}
      />
    </>
  )
}

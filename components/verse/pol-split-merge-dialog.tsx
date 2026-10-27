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
import {
  readAllowances,
  type ContractReader,
} from '../global/execution-reads'
import { getTokenDecimals, getVerseSession } from '../global/write-session'
import { splitterAbi } from '@/lib/web3/abis'
import { getActiveEip1193Provider } from '@/lib/web3/active-provider'
import {
  approvalCall,
  buildSessionWrite,
  mergeCall,
  splitCall,
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
 * Split/Merge POL action dialog (the PT/YT card action bar's Split/Merge buttons each open
 * this dialog;
 * no Rate row and no output area — 1:1 identity, output is
 * a restatement of the input, redundant).
 * Mechanism: Split=1 POL → 1 PT + 1 YT, Merge=burn equal PT and YT for
 * the same amount of POL — strictly 1:1, the contract has no slippage/no deadline
 * parameters → no settings gear;
 * gate is locked only (unlock/settled reverts with AlreadyUnlocked; after unlock this dialog
 * is not rendered — the bar switches to Redeem PT/YT);
 * CTA discipline same as the Mint dialog: disconnected=Connect Wallet clickable to toggle mock
 * connection, connected=action button disabled
 * (no faked on-chain execution, no disclaimers).
 * No valuation row (the split input ≈$ conversion is omitted; PT/YT have no
 * independent price samples to begin with).
 * Max disabled at zero: amountToInputString(0)
 * returns an empty string and clicking has no visible effect = dead-button look — when the
 * fillable amount is ≤0 Max goes disabled
 * (merge dual boxes=maxMerge=min(PT,YT), split=POL balance); a 0 balance is an honest disabled state.
 */
export function PolSplitMergeDialog({
  locale,
  verse,
  pol,
  mode,
}: {
  locale: Locale
  verse: Verse
  pol: PolPosition
  mode: 'split' | 'merge'
}) {
  const copy = getCopy(locale).verseDesk
  const common = getCopy(locale).common
  const center = useAccountCenter()
  const { connected, connectAction: toggle } = center
  const { execChain, wrongChain, switchChain } = useVerseExecChain(verse.governanceChain)
  const tx = useTxCenter()
  const { successOpen, setSuccessOpen, receipt } = useTxSuccessGate(tx)
  // Receipt leg snapshotted at the click (the amount clears on landing); split and merge
  // are both 1:1:1 identities of the same amount.
  const [splitMergeRows, setSplitMergeRows] = useState<TxSuccessRow[]>([])
  const params = useParams()
  const rawVerseId = params?.verseId
  const verseId = parseVerseIdParam(rawVerseId)
  // merge's two sides are always equal (the contract burns the same amount on both sides) → a single state drives both input boxes
  const [amount, setAmount] = useState('')
  const [resolving, setResolving] = useState(false)
  const [resolveFailed, setResolveFailed] = useState(false)
  const balanceErrorId = useId()
  useClearOnConfirmed(tx.display, () => setAmount(''))

  // Wallet-provider POL/PT/YT balances (onchain builds); re-reads when a split/merge confirms.
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
  const myPtLive = live?.pt ?? pol.myPt
  const myYtLive = live?.yt ?? pol.myYt
  // Exact wallet reads win over the float aliases whenever the probe landed (float64 can
  // round a real balance upward — a Max prefill re-parsed from it would trip the gate);
  // absent PT/YT legs read as the zero exact balance (same fail-closed as the float 0)
  const polExact = live?.exact.pol ?? null
  const ptExact = live?.exact.pt ?? null
  const ytExact = live?.exact.yt ?? null

  // merge Max fill: the shared amount must fit both holdings — pick the smaller leg entirely
  // in bigint (normalize to the coarser decimals, never through float) and fill its exact
  // string; ''=both zero (disabled Max), null=a leg's exact read missing (float sample
  // fallback fills instead)
  const mergeMaxFill = (() => {
    if (ptExact == null || ytExact == null) return null
    const d = Math.max(ptExact.decimals, ytExact.decimals)
    const scaledPt = ptExact.base * 10n ** BigInt(d - ptExact.decimals)
    const scaledYt = ytExact.base * 10n ** BigInt(d - ytExact.decimals)
    const smaller = scaledPt <= scaledYt ? ptExact : ytExact
    return smaller.base === 0n ? '' : trimFractionZeros(formatUnits(smaller.base, smaller.decimals))
  })()

  const polSymbol = `POL-${verse.symbol}`
  const ptSymbol = `PT-${verse.symbol}`
  const ytSymbol = `YT-${verse.symbol}`
  // A null balance (accountless slot) never blocks — the chain enforces real holdings at execution
  const maxMerge =
    myPtLive != null && myYtLive != null ? Math.min(myPtLive, myYtLive) : null
  const clean = (raw: string) => setAmount(sanitizeAmount(raw))
  // merge's two inputs share one amount → the error row mounts in a single place after the YT
  // box, both inputs carry the same aria
  const parsed = Number(amount)
  const valid = typedAmountPositive(amount, mode === 'split' ? polExact : (ptExact ?? ytExact))
  // merge gates each leg in its own decimals (1:1 identity: the amount must fit both the PT
  // and the YT holding); split gates the POL holding — exact when the probe landed
  const overBalance =
    mode === 'split'
      ? polExact != null
        ? Number.isFinite(parsed) && toBaseUnits(amount, polExact.decimals) > polExact.base
        : myPolLive != null && parsed > myPolLive
      : (ptExact != null &&
          Number.isFinite(parsed) &&
          toBaseUnits(amount, ptExact.decimals) > ptExact.base) ||
        (ytExact != null &&
          Number.isFinite(parsed) &&
          toBaseUnits(amount, ytExact.decimals) > ytExact.base) ||
        (ptExact == null &&
          ytExact == null &&
          maxMerge != null &&
          parsed > maxMerge)
  const executionReady =
    center.source === 'real' &&
    connected &&
    center.chainSupported &&
    !wrongChain &&
    center.chainId != null &&
    center.address != null &&
    verseId != null

  async function startSplitMergeReview(): Promise<void> {
    if (!executionReady || !valid || overBalance || resolving) return
    setSplitMergeRows([
      {
        label: mode === 'split' ? common.txYouSplit : common.txYouSupplied,
        value: formatAmount(parsed, locale),
        symbol: mode === 'split' ? polSymbol : `${ptSymbol} + ${ytSymbol}`,
      },
      {
        label: common.txReceived,
        value: formatAmount(parsed, locale),
        symbol: mode === 'split' ? `${ptSymbol} + ${ytSymbol}` : polSymbol,
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
      const splitter = session.contracts.POLSplitter as Hex
      const reader: ContractReader = session.reader
      // Merge pulls PT+YT (resolved via splitter views); split pulls POL.
      const [pt, yt] =
        mode === 'merge'
          ? ((await Promise.all([
              reader.read({ address: splitter, abi: splitterAbi, functionName: 'getPT', args: [BigInt(verseId)] }),
              reader.read({ address: splitter, abi: splitterAbi, functionName: 'getYT', args: [BigInt(verseId)] }),
            ])) as [Hex, Hex])
          : [null, null]
      const pullTokens = mode === 'split' ? [session.verse.pol] : [pt as Hex, yt as Hex]
      const decimalsList = await Promise.all(
        pullTokens.map((token) => getTokenDecimals(reader, chainId, token)),
      )
      // 1:1 identity: one display amount, each pull token parsed in its own decimals.
      const amounts = pullTokens.map((_, index) => toBaseUnits(amount, decimalsList[index] ?? 18))
      if (amounts.some((value) => value === 0n)) throw new Error('typed amount below one base unit')
      const allowances = await readAllowances(
        reader,
        eoa,
        pullTokens.map((token) => ({ token, spender: splitter })),
      )
      const approvals = pullTokens.flatMap((token, index) => {
        const want = amounts[index] as bigint
        return (allowances[index] as bigint) < want
          ? [approvalCall(token, splitter, want)]
          : []
      })
      const action =
        mode === 'split'
          ? splitCall(splitter, BigInt(verseId), amounts[0] as bigint)
          // Sibling PT/YT share decimals in practice; the single merge amount rides the PT leg.
          : mergeCall(splitter, BigInt(verseId), amounts[0] as bigint)
      const { calls, calldata: batch } = buildSessionWrite({ hook: session.hook, approvals, action })
      const inputSymbol = mode === 'split' ? polSymbol : `${ptSymbol} + ${ytSymbol}`
      const spec: WriteSpec = {
        review: {
          chainId,
          account: eoa,
          targetContract: splitter,
          functionName: mode,
          inputs: `${formatUnits(amounts[0] as bigint, decimalsList[0] ?? 18)} ${inputSymbol}`,
          minOutput: `${formatUnits(amounts[0] as bigint, decimalsList[0] ?? 18)} ${mode === 'split' ? `${ptSymbol} + ${ytSymbol}` : polSymbol}`,
          fee: '—',
          gasPayer: eoa,
          authorizationChange:
            approvals.length > 0
              ? `${amount} ${inputSymbol}`
              : '—',
          estimatedGas: '—',
          nativeBalance: '—',
        },
        kernel: session.kernel,
        expectedChainId: chainId,
        batchCallData: batch,
        calls,
        quoteId: `${mode}:${verseId}:${amount}`,
        minOutput: amount,
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
        {mode === 'split' ? copy.splitPol : copy.mergePol}
      </DialogTrigger>
      <ActionDialogShell
        title={mode === 'split' ? copy.splitDialogTitle : copy.mergeDialogTitle}
        closeLabel={common.close}
      >

          {mode === 'split' ? (
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
                    disabled={
                      polExact != null ? polExact.base === 0n : myPolLive == null || myPolLive <= 0
                    }
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
                  aria-label={`${copy.splitDialogTitle} ${polSymbol}`}
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
          ) : (
            <>
              <div className="swap-panel__field">
                <div className="swap-panel__field-head">
                  <span>PT</span>
                  <span className="swap-panel__balance">
                    {copy.balance}:{' '}
                    {ptExact != null ? (
                      <span data-numeric>{fmtTokenAmountExact(ptExact.base, ptExact.decimals, locale)}</span>
                    ) : myPtLive != null ? (
                      <span data-numeric>{formatAmount(myPtLive, locale)}</span>
                    ) : (
                      '--'
                    )}
                    <button
                      type="button"
                      className="swap-panel__max"
                      disabled={
                        mergeMaxFill != null
                          ? mergeMaxFill === ''
                          : maxMerge == null || maxMerge <= 0
                      }
                      onClick={() =>
                        clean(mergeMaxFill ?? amountToInputString(maxMerge ?? 0))
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
                    aria-label={`${copy.mergeDialogTitle} ${ptSymbol}`}
                    aria-invalid={overBalance || undefined}
                    aria-describedby={overBalance ? balanceErrorId : undefined}
                  />
                  <div className="swap-panel__token">
                    <strong>{ptSymbol}</strong>
                  </div>
                </div>
              </div>
              <div className="swap-panel__field">
                <div className="swap-panel__field-head">
                  <span>YT</span>
                  <span className="swap-panel__balance">
                    {copy.balance}:{' '}
                    {ytExact != null ? (
                      <span data-numeric>{fmtTokenAmountExact(ytExact.base, ytExact.decimals, locale)}</span>
                    ) : myYtLive != null ? (
                      <span data-numeric>{formatAmount(myYtLive, locale)}</span>
                    ) : (
                      '--'
                    )}
                    <button
                      type="button"
                      className="swap-panel__max"
                      disabled={
                        mergeMaxFill != null
                          ? mergeMaxFill === ''
                          : maxMerge == null || maxMerge <= 0
                      }
                      onClick={() =>
                        clean(mergeMaxFill ?? amountToInputString(maxMerge ?? 0))
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
                    aria-label={`${copy.mergeDialogTitle} ${ytSymbol}`}
                    aria-invalid={overBalance || undefined}
                    aria-describedby={overBalance ? balanceErrorId : undefined}
                  />
                  <div className="swap-panel__token">
                    <strong>{ytSymbol}</strong>
                  </div>
                </div>
                {overBalance ? (
                  <FieldError id={balanceErrorId}>{common.insufficientBalance}</FieldError>
                ) : null}
              </div>
            </>
          )}

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
                onClick={() => void startSplitMergeReview()}
              >
                {mode === 'split' ? copy.splitPol : copy.mergePol}
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
        title={mode === 'split' ? copy.splitDialogTitle : copy.mergeDialogTitle}
        state={tx.display}
        open={tx.active && !successOpen}
        onDismiss={tx.reset}
      />
      <TxSuccessDialog
        locale={locale}
        title={mode === 'split' ? copy.splitDoneTitle : copy.mergeDoneTitle}
        lead={mode === 'split' ? copy.splitDoneLead : copy.mergeDoneLead}
        accent={copy.splitMergeDoneAccent}
        rows={splitMergeRows}
        txHash={receipt?.hash}
        txChainId={receipt?.chainId}
        open={successOpen}
        onOpenChange={setSuccessOpen}
      />
    </>
  )
}

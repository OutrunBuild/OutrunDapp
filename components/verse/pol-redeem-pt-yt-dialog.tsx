'use client'

import { useId, useState } from 'react'
import { X } from 'lucide-react'

import type { Locale, PolPosition, Verse } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { useAccountCenter } from '../global/use-account-center'
import { useTxCenter, useClearOnConfirmed, type WriteSpec } from '../global/use-tx-center'
import { TxStatus } from '../global/tx-status'
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
  redeemPtCall,
  redeemYtCall,
} from '@/lib/web3/session-actions'
import { useParams } from 'next/navigation'
import { parseVerseIdParam } from '../global/routes'
import { SwitchChainCta, useVerseExecChain } from '../global/switch-chain-cta'
import { formatUnits, parseUnits, type Hex } from 'viem'
import { AMOUNT_MAX_CHARS, amountToInputString, sanitizeAmount } from '../global/amount-input'
import { formatAmount } from '../global/signal-ui'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { FieldError } from '@/components/ui/field'

/**
 * Redeem PT/YT action dialog (in the unlocked state the PT/YT card's action bar shows the
 * two Redeem buttons; each triggers this dialog).
 * Mechanism: redeemPT=burn PT and redeem uAsset at the fixed ratio registered once at genesis
 * lock (ratio=mainPoolUAssetUsed/mainPoolPOLRawAmount,
 * i.e. the fixture uAssetPerPol scope, not 1:1); redeemYT=burn YT to claim the settlement's
 * remaining pool pro rata
 * (uAsset+memecoin, two tokens; per-unit rate=pool×share/circulating YT).
 * Gate is unlocked only (unlockFromLocked settles automatically;
 * the locked state does not render the redeem buttons, the bar keeps Flash Swap/Split/Merge).
 * The contract has no
 * slippage/deadline → no settings gear;
 * output is not a 1:1 identity (unlike the Split/Merge dialog, whose output is a 1:1 identity
 * and needs no output area) → dual boxes:
 * input box (label=burnLabel) + separate Receive box (same dual-box language as swap: read-only
 * `output` + token chip) — PT=single box (uAsset chip), YT=dual boxes (memecoin main leg box +
 * uAsset box, same order as the well readout); no separate You receive detail row (would
 * duplicate info); rate missing sample → Receive box degrades to placeholder 0.00.
 * CTA discipline same as Split/Merge: disconnected=Connect Wallet clickable; connected=action
 * button disabled (no faked execution).
 * Max disabled at zero (same as the Split/Merge dialog): when the burn
 * token balance is ≤0 Max is disabled — amountToInputString(0) filling an empty string reads
 * as a dead button.
 */
export function PolRedeemPtYtDialog({
  locale,
  verse,
  pol,
  mode,
  price,
  uAssetUsd,
}: {
  locale: Locale
  verse: Verse
  pol: PolPosition
  mode: 'pt' | 'yt'
  /** Main-pool price (trade.tokenStats.price): for converting the YT memecoin leg to USD; null=USD row not rendered */
  price: number | null
  /** uAsset USD price (assets usdPrice): for each leg's USD row; null=USD row not rendered */
  uAssetUsd: number | null
}) {
  const copy = getCopy(locale).verseDesk
  const common = getCopy(locale).common
  const center = useAccountCenter()
  const { connected, connectAction: toggle } = center
  const { execChain, wrongChain, switchChain } = useVerseExecChain(verse.governanceChain)
  const tx = useTxCenter()
  const params = useParams()
  const rawVerseId = params?.verseId
  const verseId = parseVerseIdParam(rawVerseId)
  // Opens with empty input (amount input defaults to empty 0.00, not prefilled with balance);
  // recalculates as usual after clearing/changing the number
  const [amount, setAmount] = useState('')
  const [resolving, setResolving] = useState(false)
  const [resolveFailed, setResolveFailed] = useState(false)
  const receiveLabelId = useId()
  const balanceErrorId = useId()
  useClearOnConfirmed(tx.display, () => setAmount(''))

  const ptSymbol = `PT-${verse.symbol}`
  const ytSymbol = `YT-${verse.symbol}`
  const clean = (raw: string) => setAmount(sanitizeAmount(raw))

  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0
  const ptOut = valid ? parsed * pol.uAssetPerPol : null
  const ytUAssetOut = valid && pol.ytRedeemUAssetPerUnit != null ? parsed * pol.ytRedeemUAssetPerUnit : null
  const ytMemeOut = valid && pol.ytRedeemMemecoinPerUnit != null ? parsed * pol.ytRedeemMemecoinPerUnit : null
  // USD echo: an ≈$ row under each Receive box, converted
  // from the same source as the card well readout —
  // uAsset leg×uAssetUsd, memecoin leg×main-pool price×uAssetUsd; missing sample → not rendered
  const ptUsd = ptOut != null && uAssetUsd != null ? ptOut * uAssetUsd : null
  const ytUAssetUsd = ytUAssetOut != null && uAssetUsd != null ? ytUAssetOut * uAssetUsd : null
  const ytMemeUsd =
    ytMemeOut != null && price != null && uAssetUsd != null ? ytMemeOut * price * uAssetUsd : null

  const balance = mode === 'pt' ? pol.myPt : pol.myYt
  const tokenSymbol = mode === 'pt' ? ptSymbol : ytSymbol
  const overBalance = parsed > balance
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
      const burnToken = (await reader.read({
        address: splitter,
        abi: splitterAbi,
        functionName: mode === 'pt' ? 'getPT' : 'getYT',
        args: [BigInt(verseId)],
      })) as Hex
      const decimals = await getTokenDecimals(reader, chainId, burnToken)
      const amountBase = parseUnits(amount, decimals)
      const [allowance] = await readAllowances(reader, eoa, [{ token: burnToken, spender: splitter }])
      const approval =
        allowance < amountBase
          ? approvalCall(burnToken, splitter, amountBase)
          : undefined
      const action =
        mode === 'pt'
          ? redeemPtCall(splitter, { verseId: BigInt(verseId), ptAmount: amountBase, to: eoa })
          : redeemYtCall(splitter, { verseId: BigInt(verseId), ytAmount: amountBase, to: eoa })
      const { calls, calldata: batch } = buildSessionWrite({ hook: session.hook, action, approval })
      const spec: WriteSpec = {
        review: {
          chainId,
          account: eoa,
          targetContract: splitter,
          functionName: mode === 'pt' ? 'redeemPT' : 'redeemYT',
          inputs: `${formatUnits(amountBase, decimals)} ${tokenSymbol}`,
          minOutput: mode === 'pt' && ptOut != null ? `${ptOut} ${verse.raiseAsset}` : '—',
          fee: '—',
          gasPayer: eoa,
          authorizationChange: approval
              ? `${formatUnits(amountBase, decimals)} ${tokenSymbol}`
              : '—',
          estimatedGas: '—',
          nativeBalance: '—',
        },
        kernel: session.kernel,
        expectedChainId: chainId,
        batchCallData: batch,
        calls,
        quoteId: `redeem-${mode}:${verseId}:${amountBase}`,
        minOutput: mode === 'pt' && ptOut != null ? String(ptOut) : '—',
        slippageBps: 0,
        deadline: Math.floor(Date.now() / 1000) + 3600,
        manifestVersion: session.manifestVersion,
        crossChain: false,
      }
      void tx.executeSession(spec)
    } catch {
      setResolveFailed(true)
    } finally {
      setResolving(false)
    }
  }

  return (
    <Dialog>
      {/* data-slot pinned back to button: same as PolMintDialog — the theme bridge matches skins on [data-slot='button'] */}
      <DialogTrigger data-slot="button" render={<Button variant="outline" size="sm" />}>
        {mode === 'pt' ? copy.redeemPt : copy.redeemYt}
      </DialogTrigger>
      <DialogContent className="pol-mint-pop">
        <div className="pol-mint ax-glow-card">
          <header className="pol-mint__head">
            <DialogTitle className="pol-mint__title">
              {mode === 'pt' ? copy.redeemPt : copy.redeemYt}
            </DialogTitle>
            <div className="pol-mint__controls">
              <DialogClose
                render={
                  <button type="button" className="pol-mint__close" aria-label={common.close} />
                }
              >
                <X aria-hidden="true" size={16} />
              </DialogClose>
            </div>
          </header>

          <div className="swap-panel__field">
            <div className="swap-panel__field-head">
              <span>{copy.burnLabel}</span>
              <span className="swap-panel__balance">
                {copy.balance}: <span data-numeric>{formatAmount(balance, locale)}</span>
                <button type="button" className="swap-panel__max" disabled={balance <= 0} onClick={() => clean(amountToInputString(balance))}>
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
                aria-label={`${mode === 'pt' ? copy.redeemPt : copy.redeemYt} ${tokenSymbol}`}
                aria-invalid={overBalance || undefined}
                aria-describedby={overBalance ? balanceErrorId : undefined}
              />
              <div className="swap-panel__token">
                <strong>{tokenSymbol}</strong>
              </div>
            </div>
            {overBalance ? (
              <FieldError id={balanceErrorId}>{common.insufficientBalance}</FieldError>
            ) : null}
          </div>

          {/* Receive box (same style as the input box,
              read-only output + token chip):
              PT=single leg; YT=both legs merged into one box (memecoin main leg first, same
              order as the well readout, hairline between rows) —
              a single Receive label covers both legs, no duplicate label and no empty label row */}
          {mode === 'pt' ? (
            <div className="swap-panel__field" role="group" aria-labelledby={receiveLabelId}>
              <div className="swap-panel__field-head">
                <span id={receiveLabelId}>{copy.receiveLabel}</span>
              </div>
              <div className="swap-panel__field-row">
                <output
                  className="swap-panel__output numeric-input"
                  data-numeric
                  aria-label={`${copy.receiveLabel} ${verse.raiseAsset}`}
                >
                  {ptOut != null ? formatAmount(ptOut, locale) : '0.00'}
                </output>
                <div className="swap-panel__token">
                  <strong>{verse.raiseAsset}</strong>
                </div>
              </div>
              {ptUsd != null ? (
                <span className="swap-panel__field-usd">≈ ${formatAmount(ptUsd, locale)}</span>
              ) : null}
            </div>
          ) : (
            <div className="swap-panel__field" role="group" aria-labelledby={receiveLabelId}>
              <div className="swap-panel__field-head">
                <span id={receiveLabelId}>{copy.receiveLabel}</span>
              </div>
              <div className="swap-panel__field-row">
                <output
                  className="swap-panel__output numeric-input"
                  data-numeric
                  aria-label={`${copy.receiveLabel} ${verse.symbol}`}
                >
                  {ytMemeOut != null ? formatAmount(ytMemeOut, locale) : '0.00'}
                </output>
                <div className="swap-panel__token">
                  <strong>{verse.symbol}</strong>
                </div>
              </div>
              {ytMemeUsd != null ? (
                <span className="swap-panel__field-usd">≈ ${ytMemeUsd}</span>
              ) : null}
              <div className="swap-panel__field-row">
                <output
                  className="swap-panel__output numeric-input"
                  data-numeric
                  aria-label={`${copy.receiveLabel} ${verse.raiseAsset}`}
                >
                  {ytUAssetOut != null ? formatAmount(ytUAssetOut, locale) : '0.00'}
                </output>
                <div className="swap-panel__token">
                  <strong>{verse.raiseAsset}</strong>
                </div>
              </div>
              {ytUAssetUsd != null ? (
                <span className="swap-panel__field-usd">≈ ${formatAmount(ytUAssetUsd, locale)}</span>
              ) : null}
            </div>
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
                onClick={() => void startRedeemReview()}
              >
                {mode === 'pt' ? copy.redeemPt : copy.redeemYt}
              </Button>
            )
          ) : (
            <Button className="swap-panel__cta" onClick={toggle}>
              {copy.swapCta}
            </Button>
          )}
          {resolveFailed ? <FieldError>{common.degrade.errorBody}</FieldError> : null}
          
          {tx.active && !tx.reviewing ? <TxStatus locale={locale} state={tx.display} /> : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

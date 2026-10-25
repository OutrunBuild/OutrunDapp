'use client'

import { useId, useState } from 'react'
import { ArrowDown, ArrowLeftRight } from 'lucide-react'

import type { Locale, PolPosition, VerseTrade } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { useAccountCenter } from '../global/use-account-center'
import { ActionDialogShell, DialogCta } from '../global/action-dialogs'
import { useTxCenter, useClearOnConfirmed, type WriteSpec } from '../global/use-tx-center'
import { TxStatus } from '../global/tx-status'
import {
  readAllowances,
  resolvePoolTokens,
} from '../global/execution-reads'
import { getTokenDecimals, getVerseSession } from '../global/write-session'
import { swapRouterAbi } from '@/lib/web3/abis'
import { getActiveEip1193Provider } from '@/lib/web3/active-provider'
import {
  approvalCall,
  buildSessionWrite,
  removeLiquidityCall,
} from '@/lib/web3/session-actions'
import { useParams } from 'next/navigation'
import { formatUnits, parseUnits, type Hex } from 'viem'
import { SwapSettings } from '../global/swap-settings'
import { formatAmount } from '../global/signal-ui'
import { AMOUNT_MAX_CHARS, amountToInputString, sanitizeAmount } from '../global/amount-input'
import { fmtTokenAmount, fmtUsd } from '../global/amount-format'
import { getSlippageIssue, slippageToNumber } from '../global/slippage-input'
import { parseVerseIdParam } from '../global/routes'
import { useVerseExecChain } from '../global/switch-chain-cta'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

/**
 * Remove Liquidity dialog (the pool card's Remove button).
 * Mechanism: all four pools unified=router removeLiquidity — burn LP tokens
 * (uint128 liquidity), withdraw both sides at the pool ratio, amount0Min/amount1Min + deadline;
 * the two-sided min is the slippage protection → settings gear kept,
 * same as the Add dialog.
 * Output derivation=reverse of Add: quote = burnLP ÷ lpPerQuote, base = quote ÷ ratio;
 * the two PT pools' ratio=anchor-rate derivation sample (see the ptAnchorRatio note below).
 * LP balance=pol-positions myLp four-pool sample;
 * same discipline as Add: the quote is a linear-derivation sample; CTA disconnected=
 * Connect Wallet clickable to toggle connection,
 * connected=Remove disabled, no faked on-chain execution.
 */
export function PoolRemoveLiquidityDialog({
  locale,
  pool,
  pol,
  price,
  uAssetUsd,
  governanceChain,
  governanceChainName,
}: {
  locale: Locale
  /** Pool card row data (pool identifier + both sides' symbols) */
  pool: VerseTrade['pools'][number]
  /** POL/PT position sample (source of LP balance/ratios); null=slot state (balance '--') */
  pol: PolPosition | null
  /** Main-pool price: 1 memecoin = price uAsset (used only for main-pool linkage); null=no sample */
  price: number | null
  /** uAsset USD sample price; null=hide the USD conversion row */
  uAssetUsd: number | null
  /** Verse governance chain + display name (execution-chain gate; SwitchChainCta target) */
  governanceChain: number
  governanceChainName: string
}) {
  const copy = getCopy(locale).verseDesk
  const common = getCopy(locale).common
  const center = useAccountCenter()
  const { connected, connectAction: toggle } = center
  const { execChain, wrongChain, switchChain } = useVerseExecChain(governanceChain)
  const tx = useTxCenter()
  const params = useParams()
  const rawVerseId = params?.verseId
  const verseId = parseVerseIdParam(rawVerseId)
  const [lpAmount, setLpAmount] = useState('')
  const [resolving, setResolving] = useState(false)
  const [resolveFailed, setResolveFailed] = useState(false)
  const receiveLabelId = useId()
  const lpBalanceErrorId = useId()
  // The settings-layer controlled value is stored as a string and shown verbatim
  // (keep the trailing dot instead of swallowing it, inline error for non-whole minutes),
  // numeric derivation goes through slippageToNumber
  const [slippageText, setSlippageText] = useState('0.5')
  const [deadlineText, setDeadlineText] = useState('10')
  const [rateInverted, setRateInverted] = useState(false)
  useClearOnConfirmed(tx.display, () => setLpAmount(''))

  const lpBalance = pol == null ? null : pol.myLp[pool.pool]
  // Max fill value (null/≤0 → empty); computed upfront to avoid losing narrowing inside the closure
  const maxLp = amountToInputString(lpBalance ?? 0)
  // POL/uAsset pool market price sample (for the POL-denominated side's ≈$ conversion)
  const polPrice = pol?.marketPricePerPol ?? null
  const lpSymbol = `${pool.baseSymbol}/${pool.quoteSymbol} LP`
  // Pool ratio 1 base = ratio quote. The two PT pools use anchor-rate derived samples
  // (no '--'/slots): 1 PT = uAssetPerPol uAsset (fixed redemption rate); the PT/POL pool then
  // converts via the POL/uAsset market price: 1 PT = uAssetPerPol÷marketPricePerPol POL
  const ptAnchorRatio =
    pol != null && pol.marketPricePerPol > 0
      ? pool.pool === 'pt-uasset'
        ? pol.uAssetPerPol
        : pol.uAssetPerPol / pol.marketPricePerPol
      : null
  const ratio =
    pool.pool === 'main' ? price : pool.pool === 'pol-uasset' ? polPrice : ptAnchorRatio

  const lpVal = Number(lpAmount)
  const valid = Number.isFinite(lpVal) && lpVal > 0
  const lpOver = lpBalance != null && lpVal > lpBalance
  const executionReady =
    center.source === 'real' &&
    connected &&
    center.chainSupported &&
    !wrongChain &&
    center.chainId != null &&
    center.address != null &&
    verseId != null

  async function startRemoveReview(): Promise<void> {
    if (!executionReady || !valid || lpOver || slippageIssue != null || resolving) return
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
      const router = session.contracts.MemeverseSwapRouter as Hex
      const reader = session.reader
      const { base, quote } = await resolvePoolTokens(reader, session, pool.pool, BigInt(verseId))
      const lpToken = (await reader.read({
        address: router,
        abi: swapRouterAbi,
        functionName: 'lpToken',
        args: [base, quote],
      })) as Hex
      const [lpDecimals, baseDecimals, quoteDecimals] = await Promise.all([
        getTokenDecimals(reader, chainId, lpToken),
        getTokenDecimals(reader, chainId, base),
        getTokenDecimals(reader, chainId, quote),
      ])
      const liquidity = parseUnits(lpAmount, lpDecimals)
      const slippageBps = Math.round(slippage * 100)
      // mins derive from the display minQuote/minBase (fall back to zero when slotted).
      const minQuoteBase =
        minQuote != null ? parseUnits(String(minQuote), quoteDecimals) : 0n
      const minBaseBase = minBase != null ? parseUnits(String(minBase), baseDecimals) : 0n
      const sorted = base.toLowerCase() < quote.toLowerCase()
      const currency0 = (sorted ? base : quote) as Hex
      const currency1 = (sorted ? quote : base) as Hex
      const [allowance] = await readAllowances(reader, eoa, [{ token: lpToken, spender: router }])
      const approval =
        allowance < liquidity
          ? approvalCall(lpToken, router, liquidity)
          : undefined
      const action = removeLiquidityCall(router, {
        currency0,
        currency1,
        liquidity,
        amount0Min: (sorted ? minBaseBase : minQuoteBase) as bigint,
        amount1Min: (sorted ? minQuoteBase : minBaseBase) as bigint,
        to: eoa,
        deadline: BigInt(Math.floor(Date.now() / 1000) + (Number(deadlineText) || 10) * 60),
      })
      const { calls, calldata: batch } = buildSessionWrite({ hook: session.hook, approval, action })
      const spec: WriteSpec = {
        review: {
          chainId,
          account: eoa,
          targetContract: router,
          functionName: 'removeLiquidity',
          inputs: `${formatUnits(liquidity, lpDecimals)} ${lpSymbol}`,
          minOutput: '—',
          fee: '—',
          gasPayer: eoa,
          authorizationChange: approval
              ? `${formatUnits(liquidity, lpDecimals)} ${lpSymbol}`
              : '—',
          estimatedGas: '—',
          nativeBalance: '—',
        },
        kernel: session.kernel,
        expectedChainId: chainId,
        batchCallData: batch,
        calls,
        quoteId: `remliq:${verseId}:${pool.pool}:${liquidity}`,
        minOutput: '—',
        slippageBps,
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
  // Withdrawal derivation=reverse of minting: quote = LP ÷ lpPerQuote; base then converted at
  // the ratio (missing-sample side falls to the slot)
  const quoteOut =
    valid && pool.lpPerQuote != null && pool.lpPerQuote > 0 ? lpVal / pool.lpPerQuote : null
  const baseOut = quoteOut != null && ratio != null && ratio > 0 ? quoteOut / ratio : null
  // Slippage validation (see getSlippageIssue/slippageToNumber in global/slippage-input):
  // while out of bounds, protected-value derivation falls back to the '--' slot
  const slippage = slippageToNumber(slippageText)
  const slippageIssue = getSlippageIssue(slippage)
  const minQuote =
    quoteOut != null && slippageIssue == null ? quoteOut * (1 - slippage / 100) : null
  const minBase =
    baseOut != null && slippageIssue == null ? baseOut * (1 - slippage / 100) : null

  // display formatting goes through global/amount-format (fmtUsd/fmtTokenAmount) — raw float
  // products carry precision noise;
  // ≈$ conversion prices (in uAsset): base side main pool/POL pool have market price samples,
  // PT side=anchor rate uAssetPerPol;
  // quote side uAsset=1, PT/POL pool=polPrice
  const baseUsdPrice =
    pool.pool === 'main' ? price : pool.pool === 'pol-uasset' ? polPrice : pol?.uAssetPerPol ?? null
  const quoteUsdPrice = pool.pool === 'pt-pol' ? polPrice : 1
  const baseUsd =
    uAssetUsd == null || !valid || baseOut == null || baseUsdPrice == null || baseUsdPrice <= 0
      ? null
      : fmtUsd(baseOut * baseUsdPrice * uAssetUsd, locale)
  const quoteUsd =
    uAssetUsd == null || !valid || quoteOut == null || quoteUsdPrice == null || quoteUsdPrice <= 0
      ? null
      : fmtUsd(quoteOut * quoteUsdPrice * uAssetUsd, locale)

  return (
    <Dialog>
      {/* data-slot pinned back to button: same as PolMintDialog — the theme bridge matches skins
          on [data-slot='button'];
          .pool-card [data-slot='button'] pool card row styling keeps matching */}
      <DialogTrigger data-slot="button" render={<Button variant="outline" size="sm" />}>
        {copy.removeLiquidity}
      </DialogTrigger>
      <ActionDialogShell
        title={copy.removeLiquidityDialogTitle}
        closeLabel={common.close}
        toolbar={
          <SwapSettings
            locale={locale}
            settingsLabel={copy.removeLiquiditySettingsTitle}
            slippageTip={copy.removeLiquiditySlippageTip}
            slippageValue={slippageText}
            onSlippageValue={setSlippageText}
            deadline={{
              tip: copy.removeLiquidityDeadlineTip,
              value: deadlineText,
              onValue: setDeadlineText,
            }}
          />
        }
      >

          <span className="pol-mint__label">{copy.removeBurn}</span>
          <div className="swap-panel__field">
            <div className="swap-panel__field-head">
              <span>{lpSymbol}</span>
              <span className="swap-panel__balance">
                {copy.balance}:{' '}
                {lpBalance == null ? (
                  '--'
                ) : (
                  <span data-numeric>{formatAmount(lpBalance, locale)}</span>
                )}
                <button
                  type="button"
                  className="swap-panel__max"
                  disabled={maxLp === ''}
                  onClick={() => setLpAmount(maxLp)}
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
                value={lpAmount}
                maxLength={AMOUNT_MAX_CHARS}
                onChange={(event) => setLpAmount(sanitizeAmount(event.target.value))}
                aria-label={`${copy.removeLiquidityDialogTitle} ${lpSymbol}`}
                aria-invalid={lpOver || undefined}
                aria-describedby={lpOver ? lpBalanceErrorId : undefined}
              />
              <div className="swap-panel__token">
                <strong>{lpSymbol}</strong>
              </div>
            </div>
            {lpOver ? (
              <FieldError id={lpBalanceErrorId}>{common.insufficientBalance}</FieldError>
            ) : null}
          </div>

          <span className="pol-mint__arrow" aria-hidden="true">
            <ArrowDown size={16} />
          </span>

          {/* Output box: base/quote both legs merged into one box, a single "You receive" label
              covers both legs;
              the hairline between rows comes from the ~ sibling selector */}
          <div className="swap-panel__field" role="group" aria-labelledby={receiveLabelId}>
            <div className="swap-panel__field-head">
              <span id={receiveLabelId}>{copy.mintYouReceive}</span>
            </div>
            <div className="swap-panel__field-row">
              <output
                className="swap-panel__output numeric-input"
                data-numeric
                aria-label={`${copy.mintYouReceive} ${pool.baseSymbol}`}
              >
                {baseOut != null ? fmtTokenAmount(baseOut, locale) : '0.00'}
              </output>
              <div className="swap-panel__token">
                <strong>{pool.baseSymbol}</strong>
              </div>
            </div>
            {baseUsd != null ? <span className="swap-panel__field-usd">≈ ${baseUsd}</span> : null}
            <div className="swap-panel__field-row">
              <output
                className="swap-panel__output numeric-input"
                data-numeric
                aria-label={`${copy.mintYouReceive} ${pool.quoteSymbol}`}
              >
                {quoteOut != null ? fmtTokenAmount(quoteOut, locale) : '0.00'}
              </output>
              <div className="swap-panel__token">
                <strong>{pool.quoteSymbol}</strong>
              </div>
            </div>
            {quoteUsd != null ? <span className="swap-panel__field-usd">≈ ${quoteUsd}</span> : null}
          </div>

          {valid ? (
            <dl className="swap-panel__details">
              <div>
                <dt>{copy.swapRate}</dt>
                <dd className="swap-panel__rate">
                  <span data-numeric>
                    {ratio != null && ratio > 0
                      ? rateInverted
                        ? `1 ${pool.quoteSymbol} ≈ ${fmtTokenAmount(1 / ratio, locale)} ${pool.baseSymbol}`
                        : `1 ${pool.baseSymbol} ≈ ${fmtTokenAmount(ratio, locale)} ${pool.quoteSymbol}`
                      : '--'}
                  </span>
                  <button
                    type="button"
                    className="swap-panel__rate-flip"
                    onClick={() => setRateInverted((v) => !v)}
                    disabled={!(ratio != null && ratio > 0)}
                    aria-label={copy.swapRateFlip}
                  >
                    <ArrowLeftRight aria-hidden="true" size={12} />
                  </button>
                </dd>
              </div>
              <div>
                <dt>{copy.minReceived}</dt>
                <dd data-numeric>
                  {minBase != null || minQuote != null
                    ? [
                        minBase != null ? `${fmtTokenAmount(minBase, locale)} ${pool.baseSymbol}` : null,
                        minQuote != null ? `${fmtTokenAmount(minQuote, locale)} ${pool.quoteSymbol}` : null,
                      ]
                        .filter(Boolean)
                        .join(' + ')
                    : '--'}
                </dd>
              </div>
              <div>
                <dt>{copy.maxSlippage}</dt>
                <dd data-numeric>{slippageIssue == null ? `${slippage}%` : '--'}</dd>
              </div>
            </dl>
          ) : null}
          <DialogCta
            locale={locale}
            connected={connected}
            onConnect={toggle}
            onAction={() => void startRemoveReview()}
            label={copy.removeLiquidity}
            connectLabel={copy.swapCta}
            disabled={!valid || lpOver || slippageIssue != null || !executionReady || resolving || tx.running}
            switchChainTo={
              wrongChain
                ? { execChain, chainName: governanceChainName, onSwitch: switchChain }
                : undefined
            }
          />
          {resolveFailed ? <FieldError>{common.degrade.errorBody}</FieldError> : null}
          
          {tx.active && !tx.reviewing ? <TxStatus locale={locale} state={tx.display} /> : null}
      </ActionDialogShell>
    </Dialog>
  )
}

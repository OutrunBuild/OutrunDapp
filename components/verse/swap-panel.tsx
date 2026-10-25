'use client'

import { useId, useState } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeftRight, ArrowUpDown } from 'lucide-react'
import { formatUnits, parseUnits, type Hex } from 'viem'

import type {
  Locale,
  PolPosition,
} from '@/lib/data/fixture-repository'
import { getClientChainConfig } from '@/lib/web3/chains'
import { getActiveEip1193Provider } from '@/lib/web3/active-provider'
import {
  approvalCall,
  buildSessionWrite,
  limitForDirection,
  swapExactInputCall,
  type PoolKey,
} from '@/lib/web3/session-actions'

import { getCopy } from '../global/copy'
import { useAccountCenter } from '../global/use-account-center'
import { useTxCenter, useClearOnConfirmed, type WriteSpec } from '../global/use-tx-center'
import { TxStatus } from '../global/tx-status'
import {
  readAllowances,
  readPoolKey,
  readSwapQuote,
} from '../global/execution-reads'
import { getTokenDecimals, getVerseSession } from '../global/write-session'
import { formatAmount } from '../global/signal-ui'
import { AMOUNT_MAX_CHARS, amountToInputString, sanitizeAmount } from '../global/amount-input'
import { parseVerseIdParam } from '../global/routes'
import { useVerseExecChain } from '../global/switch-chain-cta'
import { fmtTokenAmount, fmtUsd } from '../global/amount-format'
import { getSlippageIssue, slippageToNumber } from '../global/slippage-input'
import { SwapSettings } from '../global/swap-settings'
import { DialogCta } from '../global/action-dialogs'
import { SwapTokenSelectDialog, type SwapTokenOption } from './swap-token-select-dialog'
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

/** Meme-side candidate token ids (categories, not standalone symbols: derived from the POL-/PT-
 * prefixes; YT stays off the card — Flash Swap is a single POL↔YT channel tool, living in the
 * Tokenization page's YT-well dedicated dialog PolFlashSwapDialog) */
type MemeTokenId = 'meme' | 'pol' | 'pt'

/**
 * Standard Swap panel: the top-right settings button holds slippage/deadline;
 * the details rows keep only reference price/price impact/min received/route; no static explainer copy.
 * CTA wired to the account center (the connect-wallet button is clickable):
 * disconnected=Connect Wallet clickable, sharing the switch with the header's WalletControl;
 * connected + onchain + uAsset↔memecoin pair = review → Type-4 session swap;
 * otherwise the action stays disabled (no faked on-chain execution).
 * The input/output side tokens open a select dialog: stable side=
 * uAsset + its PSM-paired reserves
 * (par 1:1), Meme side=memecoin/POL/PT; the quote converts linearly via both sides' reference
 * prices for the chosen pair —
 * meme=main-pool price, POL=POL/uAsset pool price, PT=PT/POL pool price×POL price.
 * YT stays off the card: Flash Swap is a single POL↔YT channel
 * tool (both buy and sell specify the YT amount), living in the Tokenization page's YT-well
 * dedicated dialog PolFlashSwapDialog.
 */
export function SwapPanel({
  locale,
  memecoinSymbol,
  memecoinName,
  uAssetSymbol,
  price,
  uAssetUsd,
  memecoinBalance,
  uAssetBalance,
  reserves,
  reserveBalance,
  pol,
  governanceChain,
  governanceChainName,
}: {
  locale: Locale
  /** The verse's memecoin ticker */
  memecoinSymbol: string
  /** Token full name (verse.name fixture) — secondary text of the select dialog row */
  memecoinName: string
  uAssetSymbol: string
  /** Main-pool price: 1 Memecoin = price uAsset (derived from the fixture candle close) */
  price: number
  /** uAsset USD sample price (fixture; null=hide the USD conversion row) */
  uAssetUsd: number | null
  /** Sample account memecoin/uAsset balance (pol-positions fixture; null=slot --, same source as the Mint POL dialog) */
  memecoinBalance: number | null
  uAssetBalance: number | null
  /** Reserves payable for par direct swap (PSM pairs read from fixture — the getParticipationOptions export; name=the token's own name, falls back to symbol when missing) */
  reserves: { symbol: string; name?: string }[]
  /** Reserve wallet balance sample (pol-positions myReserve; null=slot '--') */
  reserveBalance: number | null
  /** POL/PT pool price and balance sample (pol-positions fixture; null=quote/balance slot state) */
  pol: PolPosition | null
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
  const [resolving, setResolving] = useState(false)
  const [resolveFailed, setResolveFailed] = useState(false)
  const [direction, setDirection] = useState<'stable-to-meme' | 'meme-to-stable'>('stable-to-meme')
  const buyLabelId = useId()
  const [stableId, setStableId] = useState(uAssetSymbol)
  const [memeId, setMemeId] = useState<MemeTokenId>('meme')
  // Opens with empty input (amount input defaults to empty 0.00, not prefilled with balance);
  // flip/token change preserves input
  const [amount, setAmount] = useState('')
  // The settings-layer controlled value is stored as a string and shown verbatim
  // (keep the trailing dot instead of swallowing it, inline error for non-whole minutes),
  // numeric derivation goes through slippageToNumber
  const [slippageText, setSlippageText] = useState('0.5')
  const [deadlineText, setDeadlineText] = useState('10')
  const [rateInverted, setRateInverted] = useState(false)
  useClearOnConfirmed(tx.display, () => setAmount(''))

  // Stable-side candidates: raise uAsset + PSM-paired reserves (PSM par 1:1; reserve balance fixture missing → slot)
  const stableOptions: SwapTokenOption[] = [
    {
      id: uAssetSymbol,
      symbol: uAssetSymbol,
      name: copy.mintSideUasset,
      balance: uAssetBalance,
    },
    ...reserves.map((reserve) => ({
      id: reserve.symbol,
      symbol: reserve.symbol,
      name: reserve.name ?? reserve.symbol,
      balance: reserveBalance,
    })),
  ]
  // uAsset price per 1 token: reserves=par 1; POL=POL/uAsset pool price (fixture sample);
  // PT=PT/POL pool price×POL pool price
  // (YT not on this card; its implied price lives in pol-flash-swap-dialog)
  const polSymbol = `POL-${memecoinSymbol}`
  const ptSymbol = `PT-${memecoinSymbol}`
  const polPrice = pol ? pol.marketPricePerPol : null
  const memeOptions: SwapTokenOption[] = [
    {
      id: 'meme',
      symbol: memecoinSymbol,
      name: memecoinName,
      balance: memecoinBalance,
    },
    {
      id: 'pol',
      symbol: polSymbol,
      name: copy.polTag,
      balance: pol?.myPol ?? null,
    },
    {
      id: 'pt',
      symbol: ptSymbol,
      name: copy.ptFullName,
      balance: pol?.myPt ?? null,
    },
  ]
  const priceInUAsset = new Map<string, number | null>([
    [uAssetSymbol, 1],
    ...reserves.map((reserve) => [reserve.symbol, 1] as const),
    ['meme', price > 0 ? price : null],
    ['pol', polPrice],
    ['pt', pol != null && polPrice != null ? polPrice * pol.ptPricePerPol : null],
  ])

  const stableSide = stableOptions.find((token) => token.id === stableId) ?? stableOptions[0]
  const memeSide = memeOptions.find((token) => token.id === memeId) ?? memeOptions[0]
  const sellToken = direction === 'stable-to-meme' ? stableSide : memeSide
  const buyToken = direction === 'stable-to-meme' ? memeSide : stableSide
  const sellBalance = sellToken.balance
  const buyBalance = buyToken.balance
  // Simulated quote: linear conversion via both sides' reference prices for the chosen pair
  // (reserve leg=PSM par 1:1; slippage/dynamic fee defer to on-chain execution reads)
  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0
  const overBalance = sellBalance != null && Number.isFinite(parsed) && parsed > sellBalance
  const sellPrice = priceInUAsset.get(sellToken.id) ?? null
  const buyPrice = priceInUAsset.get(buyToken.id) ?? null
  const pairRate =
    sellPrice != null && buyPrice != null && buyPrice > 0 ? sellPrice / buyPrice : null
  const quote = valid && pairRate != null ? parsed * pairRate : null
  // While slippage is out of bounds, no (1−s/100) derivation (s>100 yields negative tokens);
  // min received/max slippage rows fall back to slots
  const slippage = slippageToNumber(slippageText)
  const slippageIssue = getSlippageIssue(slippage)
  const minReceived = quote != null && slippageIssue == null ? quote * (1 - slippage / 100) : null
  // Onchain execution (uAsset↔memecoin exact-input only; reserves/POL/PT legs resolve no
  // addresses and stay disabled). Everything resolves through the wallet provider: verse
  // registry → pool key → quote (trader = execution EOA, §M2 trader contract) → approval →
  // session batch. No page prop threading: verseId comes from the route.
  const verseIdValid = verseId != null
  const executionReady =
    center.source === 'real' &&
    connected &&
    center.chainSupported &&
    !wrongChain &&
    center.chainId != null &&
    center.address != null &&
    verseIdValid &&
    stableSide.id === uAssetSymbol &&
    memeSide.id === 'meme'

  async function startSwapReview(): Promise<void> {
    if (!executionReady || !valid || slippageIssue != null || resolving) return
    const provider = getActiveEip1193Provider()
    const eoa = center.address as Hex | null
    const chainId = center.chainId
    if (!provider || !eoa || chainId == null) return
    const resolved = getClientChainConfig(chainId)
    if (resolved.status !== 'ok' || resolved.config.contracts.status !== 'deployed') return
    const contracts = resolved.config.contracts.addresses
    const router = contracts.MemeverseSwapRouter as Hex
    const hook = contracts.MemeverseUniswapHook as Hex
    const kernel = resolved.config.kernel7702Implementation as Hex
    setResolving(true)
    setResolveFailed(false)
    try {
      // 静态半命中页面预热缓存（0 往返）：池键是部署常量、精度按 chain+token 缓存，
      // 点击链路只剩报价与 allowance 两读，且两者并行。
      // One executable chain: a provider answering another chain is refused (VerseChainError),
      // never silently read — these dialogs' figures are loaded for this chain only.
      const session = await getVerseSession({
        provider,
        chains: [chainId],
        eoa,
        verseId: BigInt(verseId),
      })
      const { reader } = session
      const tokenIn = (direction === 'stable-to-meme' ? session.verse.uAsset : session.verse.memecoin) as Hex
      const tokenOut = (direction === 'stable-to-meme' ? session.verse.memecoin : session.verse.uAsset) as Hex
      const key: PoolKey = await readPoolKey(reader, router, tokenIn, tokenOut)
      const zeroForOne = tokenIn.toLowerCase() === key.currency0.toLowerCase()
      const [decimalsIn, decimalsOut] = await Promise.all([
        getTokenDecimals(reader, chainId, tokenIn),
        getTokenDecimals(reader, chainId, tokenOut),
      ])
      const amountIn = parseUnits(amount, decimalsIn)
      const [swapQuote, [allowance]] = await Promise.all([
        readSwapQuote(
          reader,
          router,
          key,
          { zeroForOne, amountSpecified: -amountIn, sqrtPriceLimitX96: limitForDirection(zeroForOne) },
          eoa,
        ),
        readAllowances(reader, eoa, [{ token: tokenIn, spender: router }]),
      ])
      const slippageBps = Math.round(slippage * 100)
      const minOut =
        (swapQuote.estimatedUserOutputAmount * BigInt(10000 - slippageBps)) / 10000n
      const deadlineSecs = BigInt(Math.floor(Date.now() / 1000) + (Number(deadlineText) || 10) * 60)
      const approval =
        allowance < amountIn
          ? approvalCall(tokenIn, router, amountIn)
          : undefined
      const action = swapExactInputCall(router, {
        key,
        zeroForOne,
        amountIn,
        amountOutMinimum: minOut,
        recipient: eoa,
        deadline: deadlineSecs,
      })
      const { calls, calldata: batch } = buildSessionWrite({ hook, action, approval, swapSession: true })
      const spec: WriteSpec = {
        review: {
          chainId,
          account: eoa,
          targetContract: router,
          functionName: 'swap',
          inputs: `${formatUnits(amountIn, decimalsIn)} ${sellToken.symbol}`,
          minOutput: `${formatUnits(minOut, decimalsOut)} ${buyToken.symbol}`,
          fee: `${swapQuote.feeBps} bps`,
          gasPayer: eoa,
          authorizationChange: approval
              ? `${formatUnits(amountIn, decimalsIn)} ${sellToken.symbol}`
              : '—',
          // 审阅面板不渲染 gas 字段，点击链路不预估
          estimatedGas: '—',
          nativeBalance: '—',
        },
        kernel,
        expectedChainId: chainId,
        batchCallData: batch,
        calls,
        quoteId: `${verseId}:${tokenIn}:${tokenOut}:${amountIn}`,
        minOutput: minOut.toString(),
        slippageBps,
        deadline: Number(deadlineSecs),
        manifestVersion: resolved.config.contracts.abiVersion,
        crossChain: false,
      }
      void tx.executeSession(spec)
    } catch {
      setResolveFailed(true)
    } finally {
      setResolving(false)
    }
  }

  // USD conversion: each side's uAsset price × uAssetUsd (reserves borrow the PSM
  // par-equivalent uAsset price);
  // display formatting goes through global/amount-format (fmtUsd/fmtTokenAmount) — raw float
  // products carry precision noise
  const sellUsd =
    uAssetUsd == null || !valid || sellPrice == null
      ? null
      : fmtUsd(parsed * sellPrice * uAssetUsd, locale)
  const buyUsd =
    uAssetUsd == null || quote == null || buyPrice == null
      ? null
      : fmtUsd(quote * buyPrice * uAssetUsd, locale)
  // Route row wording: reserve leg prefixed PSM; meme side by pool (YT moved off the card — see the component header note)
  const routeLegs: string[] = []
  if (stableSide.id !== uAssetSymbol) routeLegs.push(copy.routeLegPsm)
  if (memeId === 'pol') routeLegs.push(copy.routePoolPol)
  else if (memeId === 'pt') routeLegs.push(copy.routePoolPt)
  else routeLegs.push(copy.routePoolMain)
  // Reference price row: 1 Meme side ≈ N stable side (reversible; either side's price missing → '--' slot)
  const memePriceInUAsset = priceInUAsset.get(memeSide.id) ?? null
  const stablePriceInUAsset = priceInUAsset.get(stableSide.id) ?? null
  const rateReady =
    memePriceInUAsset != null &&
    stablePriceInUAsset != null &&
    memePriceInUAsset > 0 &&
    stablePriceInUAsset > 0

  return (
    <section className="swap-panel ax-glow-card" aria-labelledby="swap-title">
      <div className="swap-panel__head">
        <h2 id="swap-title">{copy.swapTitle}</h2>
        {/* Industry convention: ghost icon gear + popover settings layer (the sole
            implementation=SwapSettings; Esc/outside-click close and focus
            return to the trigger are built into Popover) */}
        <SwapSettings
          locale={locale}
          settingsLabel={copy.settingsTitle}
          slippageTip={copy.slippageTip}
          slippageValue={slippageText}
          onSlippageValue={setSlippageText}
          deadline={{ tip: copy.deadlineTip, value: deadlineText, onValue: setDeadlineText }}
        />
      </div>
      <div className="swap-panel__field">
        <div className="swap-panel__field-head">
          <span>{copy.swapSell}</span>
          <span className="swap-panel__balance">
            {copy.balance}:{' '}
            {sellBalance != null ? (
              <span data-numeric>{formatAmount(sellBalance, locale)}</span>
            ) : (
              '--'
            )}
            <button
              type="button"
              className="swap-panel__max"
              disabled={sellBalance == null}
              onClick={() => setAmount(sellBalance != null ? amountToInputString(sellBalance) : '')}
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
            onChange={(event) => setAmount(sanitizeAmount(event.target.value))}
            aria-label={`${copy.swapSell} ${sellToken.symbol}`}
            aria-invalid={overBalance || undefined}
            aria-describedby={overBalance ? 'swap-balance-error' : undefined}
          />
          <SwapTokenSelectDialog
            locale={locale}
            selectedId={sellToken.id}
            options={direction === 'stable-to-meme' ? stableOptions : memeOptions}
            onSelect={(id) => {
              if (direction === 'stable-to-meme') setStableId(id)
              else setMemeId(id as MemeTokenId)
            }}
          />
        </div>
        {overBalance ? (
          <FieldError id="swap-balance-error">{common.insufficientBalance}</FieldError>
        ) : null}
        {sellUsd != null ? <span className="swap-panel__field-usd">≈ ${sellUsd}</span> : null}
      </div>
      <button
        type="button"
        className="swap-panel__flip"
        onClick={() => setDirection(direction === 'stable-to-meme' ? 'meme-to-stable' : 'stable-to-meme')}
        aria-label={`${sellToken.symbol} ⇄ ${buyToken.symbol}`}
      >
        <ArrowUpDown aria-hidden="true" size={18} />
      </button>
      <div className="swap-panel__field" role="group" aria-labelledby={buyLabelId}>
        <div className="swap-panel__field-head">
          <span id={buyLabelId}>{copy.swapBuy}</span>
          <span>
            {copy.balance}:{' '}
            {buyBalance != null ? <span data-numeric>{formatAmount(buyBalance, locale)}</span> : '--'}
          </span>
        </div>
        <div className="swap-panel__field-row">
          <output
            className="swap-panel__output numeric-input"
            data-numeric
            aria-label={`${copy.swapBuy} ${buyToken.symbol}`}
          >
            {quote != null ? fmtTokenAmount(quote, locale) : '0.00'}
          </output>
          <SwapTokenSelectDialog
            locale={locale}
            selectedId={buyToken.id}
            options={direction === 'stable-to-meme' ? memeOptions : stableOptions}
            onSelect={(id) => {
              if (direction === 'stable-to-meme') setMemeId(id as MemeTokenId)
              else setStableId(id)
            }}
          />
        </div>
        {buyUsd != null ? <span className="swap-panel__field-usd">≈ ${buyUsd}</span> : null}
      </div>
      <dl className="swap-panel__details">
        <div>
          <dt>{copy.swapRate}</dt>
          <dd className="swap-panel__rate">
            <span data-numeric>
              {memePriceInUAsset != null && stablePriceInUAsset != null && rateReady
                ? rateInverted
                  ? `1 ${stableSide.symbol} ≈ ${fmtTokenAmount(stablePriceInUAsset / memePriceInUAsset, locale)} ${memeSide.symbol}`
                  : `1 ${memeSide.symbol} ≈ ${fmtTokenAmount(memePriceInUAsset / stablePriceInUAsset, locale)} ${stableSide.symbol}`
                : '--'}
            </span>
            <button
              type="button"
              className="swap-panel__rate-flip"
              onClick={() => setRateInverted((v) => !v)}
              disabled={!rateReady}
              aria-label={copy.swapRateFlip}
            >
              <ArrowLeftRight aria-hidden="true" size={12} />
            </button>
          </dd>
        </div>
        <div>
          <dt>{copy.priceImpact}</dt>
          <dd>{valid ? <span data-numeric>≤ 0.5%</span> : '--'}</dd>
        </div>
        <div>
          <dt>{copy.minReceived}</dt>
          <dd data-numeric>{minReceived != null ? `${fmtTokenAmount(minReceived, locale)} ${buyToken.symbol}` : '--'}</dd>
        </div>
        <div>
          <dt>{copy.maxSlippage}</dt>
          <dd data-numeric>{slippageIssue == null ? `${slippage}%` : '--'}</dd>
        </div>
        <div>
          <dt>{copy.route}</dt>
          <dd>{routeLegs.join(' → ')}</dd>
        </div>
      </dl>
      <DialogCta
        locale={locale}
        connected={connected}
        onConnect={toggle}
        onAction={() => void startSwapReview()}
        label={copy.swapAction}
        disabled={!valid || overBalance || slippageIssue != null || !executionReady || resolving || tx.running}
        title={copy.swapActionNote}
        connectLabel={copy.swapCta}
        switchChainTo={
          wrongChain
            ? { execChain, chainName: governanceChainName, onSwitch: switchChain }
            : undefined
        }
      />
      {resolveFailed ? (
        <FieldError>{common.degrade.errorBody}</FieldError>
      ) : null}
      
      {tx.active && !tx.reviewing ? <TxStatus locale={locale} state={tx.display} /> : null}
    </section>
  )
}

'use client'

import { useId, useState } from 'react'
import { ArrowLeftRight, ArrowUpDown } from 'lucide-react'

import type {
  Locale,
  FixturePolPosition,
} from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { useMockWallet } from '../global/mock-wallet'
import { formatAmount } from '../global/signal-ui'
import { AMOUNT_MAX_CHARS, amountToInputString, sanitizeAmount } from '../global/amount-input'
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
 * CTA wired to mock connection (the connect-wallet button is clickable):
 * disconnected=Connect Wallet clickable, sharing the switch with the header's WalletControl;
 * connected=Swap action disabled (no faked on-chain execution).
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
  /** Reserves payable for par direct swap (PSM pairs read from fixture — the getFixtureParticipationOptions export; name=the token's own name, falls back to symbol when missing) */
  reserves: { symbol: string; name?: string }[]
  /** Reserve wallet balance sample (pol-positions myReserve; null=slot '--') */
  reserveBalance: number | null
  /** POL/PT pool price and balance sample (pol-positions fixture; null=quote/balance slot state) */
  pol: FixturePolPosition | null
}) {
  const copy = getCopy(locale).verseDesk
  const common = getCopy(locale).common
  const { connected, toggle } = useMockWallet()
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
        label={copy.swapAction}
        title={copy.swapActionNote}
        connectLabel={copy.swapCta}
      />
    </section>
  )
}

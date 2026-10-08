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

/** Meme 侧候选代币 id（品类而非独立 symbol：POL-/PT- 前缀派生；YT 不入卡——Flash Swap 是
 * POL↔YT 单通道工具，2026-09-27 方案 B 移入 Tokenization 页 YT 井专属弹窗） */
type MemeTokenId = 'meme' | 'pol' | 'pt'

/**
 * 标准 Swap 窗口（2026-09-23 用户修订：右上角设置按钮收滑点/截止；详情行只留
 * 参考价/价格影响/最低到账/路径；静态说明文案删除——demo 同构）。
 * CTA 接模拟连接（2026-09-24 用户裁定：连接钱包可点）：未连接=Connect Wallet 可点、
 * 与头部 WalletControl 共享开关；已连接=Swap 动作禁用（原型不伪造链上成交）。
 * 2026-09-27 输入/输出侧代币可点开选择弹窗（用户裁定）：稳定侧=uAsset+其 PSM 配对储备
 * （面值 1:1 平价），Meme 侧=memecoin/POL/PT；报价按所选对两侧参考价线性换算——
 * meme=主池价、POL=POL/uAsset 池价、PT=PT/POL 池价×POL 价。
 * YT 不入卡（2026-09-27 方案 B 用户裁定）：Flash Swap 是 POL↔YT 单通道工具（买卖均指定
 * YT 数量），移入 Tokenization 页 YT 井专属弹窗（pol-flash-swap-dialog.tsx）。
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
  /** 主池价：1 Memecoin = price uAsset（fixture 蜡烛收盘推导） */
  memecoinSymbol: string
  /** 代币全名（verse.name fixture）——选择弹窗行次级文本 */
  memecoinName: string
  uAssetSymbol: string
  price: number
  /** uAsset 美元样本价（fixture；null=隐藏美元换算行） */
  uAssetUsd: number | null
  /** 样本账户 memecoin/uAsset 余额（pol-positions fixture；null=槽位 --，与 Mint POL 弹窗同源） */
  memecoinBalance: number | null
  uAssetBalance: number | null
  /** 面值直兑可付储备（PSM 配对读 fixture——getFixtureParticipationOptions 出口；name=代币本名，缺失回退 symbol） */
  reserves: { symbol: string; name?: string }[]
  /** 储备钱包余额样本（pol-positions myReserve；null=槽位 '--'） */
  reserveBalance: number | null
  /** POL/PT 池价与余额样本（pol-positions fixture；null=报价/余额槽位态） */
  pol: FixturePolPosition | null
}) {
  const copy = getCopy(locale).verseDesk
  const common = getCopy(locale).common
  const { connected, toggle } = useMockWallet()
  const [direction, setDirection] = useState<'stable-to-meme' | 'meme-to-stable'>('stable-to-meme')
  const buyLabelId = useId()
  const [stableId, setStableId] = useState(uAssetSymbol)
  const [memeId, setMemeId] = useState<MemeTokenId>('meme')
  // 打开为空输入（2026-10-08 用户裁定：金额输入默认空 0.00，废除 2026-09-28
  // 打开预填余额口径）；翻转/换币保留输入
  const [amount, setAmount] = useState('')
  // 设置层受控值存 string 原样展示（§25 拍板 A：留点不吞、非整分钟就地报错），
  // 数值推导经 slippageToNumber（2026-10-08 P1-1 修）
  const [slippageText, setSlippageText] = useState('0.5')
  const [deadlineText, setDeadlineText] = useState('10')
  const [rateInverted, setRateInverted] = useState(false)

  // 稳定侧候选：募集 uAsset + PSM 配对储备（OutStake PSM 面值 1:1；储备余额 fixture 缺→槽位）
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
  // 每 1 代币的 uAsset 计价：储备=面值平价 1；POL=POL/uAsset 池价（fixture 样本）；
  // PT=PT/POL 池价×POL 池价；YT=隐含价 (1−PT/POL 池价)×POL 池价——yt-flash-swap.md
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
  // 原型报价：按所选对两侧参考价线性换算（储备腿=PSM 面值 1:1；滑点/动态费以执行读链为准）
  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0
  const overBalance = sellBalance != null && Number.isFinite(parsed) && parsed > sellBalance
  const sellPrice = priceInUAsset.get(sellToken.id) ?? null
  const buyPrice = priceInUAsset.get(buyToken.id) ?? null
  const pairRate =
    sellPrice != null && buyPrice != null && buyPrice > 0 ? sellPrice / buyPrice : null
  const quote = valid && pairRate != null ? parsed * pairRate : null
  // 滑点越界期间不做 (1−s/100) 推导（s>100 得负数代币），最少收到/最大滑点行退槽位
  const slippage = slippageToNumber(slippageText)
  const slippageIssue = getSlippageIssue(slippage)
  const minReceived = quote != null && slippageIssue == null ? quote * (1 - slippage / 100) : null
  // 美元换算：两侧各自按 uAsset 计价 × uAssetUsd（储备借 PSM 平价等值 uAsset 价）；
  // fmtUsd/fmtTokenAmount 及大数分层口径=global/amount-format
  const sellUsd =
    uAssetUsd == null || !valid || sellPrice == null
      ? null
      : fmtUsd(parsed * sellPrice * uAssetUsd, locale)
  const buyUsd =
    uAssetUsd == null || quote == null || buyPrice == null
      ? null
      : fmtUsd(quote * buyPrice * uAssetUsd, locale)
  // 路径行组词：储备腿前缀 PSM；meme 侧按池（YT 已移出卡——见组件头注）
  const routeLegs: string[] = []
  if (stableSide.id !== uAssetSymbol) routeLegs.push(copy.routeLegPsm)
  if (memeId === 'pol') routeLegs.push(copy.routePoolPol)
  else if (memeId === 'pt') routeLegs.push(copy.routePoolPt)
  else routeLegs.push(copy.routePoolMain)
  // 参考价行：1 Meme 侧 ≈ N 稳定侧（可反转；两侧任一价缺→'--' 槽位）
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
        {/* 行业惯例：幽灵图标齿轮 + 弹出式设置层（demo 参照；唯一实现=
            components/global/swap-settings.tsx，Esc/外点关闭、焦点回触发器由 Popover 内置） */}
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

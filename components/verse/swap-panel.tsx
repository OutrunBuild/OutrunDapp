'use client'

import { useState } from 'react'
import { ArrowLeftRight, ArrowUpDown, Info, Settings2 } from 'lucide-react'

import type {
  Locale,
  FixturePolPosition,
} from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { useMockWallet } from '../global/mock-wallet'
import { formatAmount } from '../global/signal-ui'
import { SwapTokenSelectDialog, type SwapTokenOption } from './swap-token-select-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** 滑点/截止默认与预设档（R-06：常态默认 0.5%；demo 参照档位 0.1/0.5/1.0 与 10/20/30 分钟）；
 * pol-mint-dialog 复用同档（mintPOLToken 双侧 min + deadline 同族参数） */
export const SLIPPAGE_PRESETS = [0.1, 0.5, 1] as const
export const DEADLINE_PRESETS = [10, 20, 30] as const

/** 大数边界（demo 参照页输入 180 位数字撑破 Swap 卡的教训，2026-09-23）：
 * 金额输入 40 字符上限（float64 有效数字 ~17 位，40 已冗余）；派生值分层降级——
 * ≥1e15 Intl 紧凑记法（`39,226T`/`39,226万亿`；注意 compact 在超大值不省略，
 * 会退化为全量数字+单位后缀）、≥1e21 科学记法（`4.3585E40`），全展开长串与
 * toFixed 科学计数法禁止进卡面；CSS 截断省略兜底见 globals.css */
export const AMOUNT_MAX_CHARS = 40
export const COMPACT_AMOUNT_THRESHOLD = 1e15
export const SCIENTIFIC_AMOUNT_THRESHOLD = 1e21

/** 设置项标签旁的解释气泡（复用 create 页 ⊙ 提示语言） */
function SettingsTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger className="create-info" aria-label={text}>
        <Info aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  )
}

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
  const { connected, toggle } = useMockWallet()
  const [direction, setDirection] = useState<'stable-to-meme' | 'meme-to-stable'>('stable-to-meme')
  const [stableId, setStableId] = useState(uAssetSymbol)
  const [memeId, setMemeId] = useState<MemeTokenId>('meme')
  // 打开即预填默认卖出侧（uAsset）全部余额（§21/Flash Swap 同规——空输入 0.00/'--' 观感差，
  // 2026-09-28 用户裁定造数看原型效果）；余额缺失不预填，翻转/换币保留输入
  const [amount, setAmount] = useState(uAssetBalance != null ? String(uAssetBalance) : '')
  const [slippage, setSlippage] = useState<number>(0.5)
  const [deadlineMin, setDeadlineMin] = useState<number>(10)
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
  const sellPrice = priceInUAsset.get(sellToken.id) ?? null
  const buyPrice = priceInUAsset.get(buyToken.id) ?? null
  const pairRate =
    sellPrice != null && buyPrice != null && buyPrice > 0 ? sellPrice / buyPrice : null
  const quote = valid && pairRate != null ? parsed * pairRate : null
  const minReceived = quote != null ? quote * (1 - slippage / 100) : null
  // 美元换算：两侧各自按 uAsset 计价 × uAssetUsd（储备借 PSM 平价等值 uAsset 价）
  const localeTag = locale === 'zh' ? 'zh-CN' : 'en-US'
  // 大数分层：≥1e21 科学记法（compact 超大值不省略，会退化成全量数字+单位后缀）、
  // ≥1e15 紧凑记法、常态走 normal 格式
  const fmtTiered = (value: number, compactDigits: number, normal: (v: number) => string) => {
    const abs = Math.abs(value)
    if (abs >= SCIENTIFIC_AMOUNT_THRESHOLD)
      return value.toLocaleString(localeTag, { notation: 'scientific', maximumFractionDigits: compactDigits })
    if (abs >= COMPACT_AMOUNT_THRESHOLD)
      return value.toLocaleString(localeTag, { notation: 'compact', maximumFractionDigits: compactDigits })
    return normal(value)
  }
  const fmtUsd = (value: number) =>
    fmtTiered(value, 2, (v) => v.toLocaleString(localeTag, { maximumFractionDigits: 2 }))
  // 到账展示：常态 toFixed(6)（裸 toFixed 对 ≥1e21 会吐 `2.74e+109` 科学计数法长串）
  const fmtTokenAmount = (value: number) => fmtTiered(value, 4, (v) => v.toFixed(6))
  const sellUsd =
    uAssetUsd == null || !valid || sellPrice == null
      ? null
      : fmtUsd(parsed * sellPrice * uAssetUsd)
  const buyUsd =
    uAssetUsd == null || quote == null || buyPrice == null
      ? null
      : fmtUsd(quote * buyPrice * uAssetUsd)
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
        {/* 行业惯例：幽灵图标齿轮 + 弹出式设置层（demo 参照；Esc/外点关闭、焦点回触发器由 Popover 内置） */}
        <Popover>
          <PopoverTrigger
            className="swap-panel__settings-toggle"
            aria-label={copy.settingsTitle}
            render={
              <button type="button">
                <Settings2 aria-hidden="true" />
              </button>
            }
          />
          <PopoverContent className="swap-settings" side="bottom" align="end">
            <div className="swap-settings__row">
              <span className="swap-settings__label">
                {copy.slippageTolerance}
                <SettingsTip text={copy.slippageTip} />
              </span>
              <div className="swap-settings__options">
                {SLIPPAGE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    data-selected={slippage === preset}
                    onClick={() => setSlippage(preset)}
                  >
                    {preset}%
                  </button>
                ))}
                <span className="swap-settings__unit">
                  <Input
                    className="swap-settings__custom numeric-input"
                    inputMode="decimal"
                    aria-label={`${copy.slippageTolerance} %`}
                    value={slippage}
                    onChange={(event) => {
                      const next = Number(event.target.value.replace(/[^\d.]/g, ''))
                      setSlippage(Number.isFinite(next) && next >= 0 ? next : 0)
                    }}
                  />
                  <b aria-hidden="true">%</b>
                </span>
              </div>
            </div>
            <div className="swap-settings__row">
              <span className="swap-settings__label">
                {copy.transactionDeadline}
                <SettingsTip text={copy.deadlineTip} />
              </span>
              <div className="swap-settings__options">
                {DEADLINE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    data-selected={deadlineMin === preset}
                    onClick={() => setDeadlineMin(preset)}
                  >
                    {preset}
                  </button>
                ))}
                <span className="swap-settings__unit">
                  <Input
                    className="swap-settings__custom numeric-input"
                    inputMode="numeric"
                    aria-label={`${copy.transactionDeadline} min`}
                    value={deadlineMin}
                    onChange={(event) => {
                      const next = Number(event.target.value.replace(/[^\d]/g, ''))
                      setDeadlineMin(Number.isFinite(next) && next > 0 ? next : 1)
                    }}
                  />
                  <b aria-hidden="true">min</b>
                </span>
              </div>
            </div>
          </PopoverContent>
        </Popover>
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
              onClick={() => setAmount(sellBalance != null ? String(sellBalance) : '')}
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
            onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ''))}
            aria-label={`${copy.swapSell} ${sellToken.symbol}`}
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
      <div className="swap-panel__field">
        <div className="swap-panel__field-head">
          <span>{copy.swapBuy}</span>
          <span>
            {copy.balance}:{' '}
            {buyBalance != null ? <span data-numeric>{formatAmount(buyBalance, locale)}</span> : '--'}
          </span>
        </div>
        <div className="swap-panel__field-row">
          <output className="swap-panel__output numeric-input" data-numeric>
            {quote != null ? fmtTokenAmount(quote) : '0.00'}
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
                  ? `1 ${stableSide.symbol} ≈ ${(stablePriceInUAsset / memePriceInUAsset).toFixed(6)} ${memeSide.symbol}`
                  : `1 ${memeSide.symbol} ≈ ${(memePriceInUAsset / stablePriceInUAsset).toFixed(6)} ${stableSide.symbol}`
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
          <dd data-numeric>{minReceived != null ? `${fmtTokenAmount(minReceived)} ${buyToken.symbol}` : '--'}</dd>
        </div>
        <div>
          <dt>{copy.maxSlippage}</dt>
          <dd data-numeric>{slippage}%</dd>
        </div>
        <div>
          <dt>{copy.route}</dt>
          <dd>{routeLegs.join(' → ')}</dd>
        </div>
      </dl>
      {connected ? (
        <Button className="swap-panel__cta" disabled title={copy.swapActionNote}>
          {copy.swapAction}
        </Button>
      ) : (
        <Button className="swap-panel__cta" onClick={toggle}>
          {copy.swapCta}
        </Button>
      )}
    </section>
  )
}

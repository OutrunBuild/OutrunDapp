'use client'

import { useState } from 'react'
import { ArrowLeftRight, ArrowUpDown, Info, Settings2 } from 'lucide-react'

import type { Locale } from '@/lib/data/prototype-repository'

import { getCopy } from './copy'
import { useMockWallet } from './mock-wallet'
import { formatAmount } from './signal-ui'
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
      <TooltipTrigger render={<span className="create-info" aria-label={text} />}>
        <Info aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  )
}

/**
 * 标准 Swap 窗口（2026-09-23 用户修订：右上角设置按钮收滑点/截止；详情行只留
 * 参考价/价格影响/最低到账/路径；静态说明文案删除——demo 同构）。
 * CTA 接模拟连接（2026-09-24 用户裁定：连接钱包可点）：未连接=Connect Wallet 可点、
 * 与头部 WalletControl 共享开关；已连接=Swap 动作禁用（原型不伪造链上成交）。
 */
export function SwapPanel({
  locale,
  memecoinSymbol,
  uAssetSymbol,
  price,
  uAssetUsd,
  memecoinBalance,
  uAssetBalance,
}: {
  locale: Locale
  /** 主池价：1 Memecoin = price uAsset（fixture 蜡烛收盘推导） */
  memecoinSymbol: string
  uAssetSymbol: string
  price: number
  /** uAsset 美元样本价（fixture；null=隐藏美元换算行） */
  uAssetUsd: number | null
  /** 样本账户 memecoin/uAsset 余额（pol-positions fixture；null=槽位 --，与 Mint POL 弹窗同源） */
  memecoinBalance: number | null
  uAssetBalance: number | null
}) {
  const copy = getCopy(locale).verseDesk
  const { connected, toggle } = useMockWallet()
  const [direction, setDirection] = useState<'meme-to-uasset' | 'uasset-to-meme'>('uasset-to-meme')
  const [amount, setAmount] = useState('')
  const [slippage, setSlippage] = useState<number>(0.5)
  const [deadlineMin, setDeadlineMin] = useState<number>(10)
  const [rateInverted, setRateInverted] = useState(false)

  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0
  // 原型报价：按主池参考价线性换算（滑点/动态费以执行读链为准）
  const quote =
    direction === 'uasset-to-meme' ? (valid ? parsed / price : null) : valid ? parsed * price : null
  const minReceived = quote != null ? quote * (1 - slippage / 100) : null
  const sellSymbol = direction === 'uasset-to-meme' ? uAssetSymbol : memecoinSymbol
  const buySymbol = direction === 'uasset-to-meme' ? memecoinSymbol : uAssetSymbol
  // 余额随方向换侧（与 Mint POL 弹窗同源 fixture）；Max 只挂卖出侧
  const sellBalance = direction === 'uasset-to-meme' ? uAssetBalance : memecoinBalance
  const buyBalance = direction === 'uasset-to-meme' ? memecoinBalance : uAssetBalance
  // 美元换算：输入/输出各自按其计价侧 × uAssetUsd（MEME 侧先折 uAsset）
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
    uAssetUsd == null || !valid
      ? null
      : direction === 'uasset-to-meme'
        ? fmtUsd(parsed * uAssetUsd)
        : fmtUsd(parsed * price * uAssetUsd)
  const buyUsd =
    uAssetUsd == null || quote == null
      ? null
      : direction === 'uasset-to-meme'
        ? fmtUsd(quote * price * uAssetUsd)
        : fmtUsd(quote * uAssetUsd)

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
            aria-label={`${copy.swapSell} ${sellSymbol}`}
          />
          <div className="swap-panel__token">
            <strong>{sellSymbol}</strong>
          </div>
        </div>
        {sellUsd != null ? <span className="swap-panel__field-usd">≈ ${sellUsd}</span> : null}
      </div>
      <button
        type="button"
        className="swap-panel__flip"
        onClick={() => setDirection(direction === 'uasset-to-meme' ? 'meme-to-uasset' : 'uasset-to-meme')}
        aria-label={`${sellSymbol} ⇄ ${buySymbol}`}
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
          <div className="swap-panel__token">
            <strong>{buySymbol}</strong>
          </div>
        </div>
        {buyUsd != null ? <span className="swap-panel__field-usd">≈ ${buyUsd}</span> : null}
      </div>
      <dl className="swap-panel__details">
        <div>
          <dt>{copy.swapRate}</dt>
          <dd className="swap-panel__rate">
            <span data-numeric>
              {price > 0
                ? rateInverted
                  ? `1 ${uAssetSymbol} ≈ ${(1 / price).toFixed(6)} ${memecoinSymbol}`
                  : `1 ${memecoinSymbol} ≈ ${price.toFixed(6)} ${uAssetSymbol}`
                : '--'}
            </span>
            <button
              type="button"
              className="swap-panel__rate-flip"
              onClick={() => setRateInverted((v) => !v)}
              disabled={!(price > 0)}
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
          <dd data-numeric>{minReceived != null ? `${fmtTokenAmount(minReceived)} ${buySymbol}` : '--'}</dd>
        </div>
        <div>
          <dt>{copy.maxSlippage}</dt>
          <dd data-numeric>{slippage}%</dd>
        </div>
        <div>
          <dt>{copy.route}</dt>
          <dd>{copy.routeValue}</dd>
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

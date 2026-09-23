'use client'

import { useState } from 'react'
import { ArrowUpDown, Info, Settings2 } from 'lucide-react'

import type { Locale } from '@/lib/data/prototype-repository'

import { getCopy } from './copy'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** 滑点/截止默认与预设档（R-06：常态默认 0.5%；demo 参照档位 0.1/0.5/1.0 与 10/20/30 分钟） */
const SLIPPAGE_PRESETS = [0.1, 0.5, 1] as const
const DEADLINE_PRESETS = [10, 20, 30] as const

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
 * 原型只演示 ViewModel：CTA=连接钱包禁用，不伪造链上成功。
 */
export function SwapPanel({
  locale,
  memecoinSymbol,
  uAssetSymbol,
  price,
  uAssetUsd,
}: {
  locale: Locale
  /** 主池价：1 Memecoin = price uAsset（fixture 蜡烛收盘推导） */
  memecoinSymbol: string
  uAssetSymbol: string
  price: number
  /** uAsset 美元样本价（fixture；null=隐藏美元换算行） */
  uAssetUsd: number | null
}) {
  const copy = getCopy(locale).verseDesk
  const [direction, setDirection] = useState<'meme-to-uasset' | 'uasset-to-meme'>('uasset-to-meme')
  const [amount, setAmount] = useState('')
  const [slippage, setSlippage] = useState<number>(0.5)
  const [deadlineMin, setDeadlineMin] = useState<number>(10)

  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0
  // 原型报价：按主池参考价线性换算（滑点/动态费以执行读链为准）
  const quote =
    direction === 'uasset-to-meme' ? (valid ? parsed / price : null) : valid ? parsed * price : null
  const minReceived = quote != null ? quote * (1 - slippage / 100) : null
  const sellSymbol = direction === 'uasset-to-meme' ? uAssetSymbol : memecoinSymbol
  const buySymbol = direction === 'uasset-to-meme' ? memecoinSymbol : uAssetSymbol
  // 美元换算：输入/输出各自按其计价侧 × uAssetUsd（MEME 侧先折 uAsset）
  const fmtUsd = (value: number) => value.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', { maximumFractionDigits: 2 })
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
            {copy.balance}: --
            <button type="button" className="swap-panel__max" disabled>
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
            {copy.balance}: --
          </span>
        </div>
        <div className="swap-panel__field-row">
          <output className="swap-panel__output numeric-input" data-numeric>
            {quote != null ? quote.toFixed(6) : '0.00'}
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
          <dd data-numeric>
            1 {memecoinSymbol} ≈ {price.toFixed(6)} {uAssetSymbol}
          </dd>
        </div>
        <div>
          <dt>{copy.priceImpact}</dt>
          <dd>{valid ? <span data-numeric>≤ 0.5%</span> : '--'}</dd>
        </div>
        <div>
          <dt>{copy.minReceived}</dt>
          <dd data-numeric>{minReceived != null ? `${minReceived.toFixed(6)} ${buySymbol}` : '--'}</dd>
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
      <Button className="swap-panel__cta" disabled title={copy.swapCta}>
        {copy.swapCta}
      </Button>
    </section>
  )
}

'use client'

import { useState } from 'react'
import { ArrowDownUp } from 'lucide-react'

import type { Locale } from '@/lib/data/prototype-repository'

import { getCopy } from './copy'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/** 原型滑点默认（R-06：常态 0.5%；开池/保护期预填更高——本样本 verse 均为常态） */
const SLIPPAGE_DEFAULT = 0.005

/**
 * 标准 Swap 窗口（Q&A 口径：方向切换 Memecoin↔uAsset、双向金额、Half/Max、参考价、
 * 报价≠保证成交、费率读链槽位；原型只演示 ViewModel，CTA=连接钱包，不伪造链上成功）。
 */
export function SwapPanel({
  locale,
  memecoinSymbol,
  uAssetSymbol,
  price,
}: {
  locale: Locale
  /** 主池价：1 Memecoin = price uAsset（fixture 蜡烛收盘推导） */
  memecoinSymbol: string
  uAssetSymbol: string
  price: number
}) {
  const copy = getCopy(locale).verseDesk
  const [direction, setDirection] = useState<'meme-to-uasset' | 'uasset-to-meme'>('uasset-to-meme')
  const [amount, setAmount] = useState('')

  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0
  // 原型报价：按主池参考价线性换算（滑点/动态费以执行读链为准——D4/D5 槽位口径）
  const quote =
    direction === 'uasset-to-meme'
      ? valid
        ? parsed / price
        : null
      : valid
        ? parsed * price
        : null
  const minReceived =
    quote != null ? quote * (1 - SLIPPAGE_DEFAULT) : null
  const sellSymbol = direction === 'uasset-to-meme' ? uAssetSymbol : memecoinSymbol
  const buySymbol = direction === 'uasset-to-meme' ? memecoinSymbol : uAssetSymbol

  return (
    <section className="swap-panel ax-glow-card" aria-labelledby="swap-title">
      <h2 id="swap-title">{copy.swapTitle}</h2>
      <div className="swap-panel__field">
        <div className="swap-panel__field-head">
          <span>{copy.swapSell}</span>
          <span>{copy.balance}: --</span>
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
            <div className="swap-panel__quick">
              <button type="button" disabled>{copy.half}</button>
              <button type="button" disabled>{copy.max}</button>
            </div>
          </div>
        </div>
      </div>
      <button
        type="button"
        className="swap-panel__flip"
        onClick={() => setDirection(direction === 'uasset-to-meme' ? 'meme-to-uasset' : 'uasset-to-meme')}
        aria-label={`${sellSymbol} ⇄ ${buySymbol}`}
      >
        <ArrowDownUp aria-hidden="true" />
      </button>
      <div className="swap-panel__field">
        <div className="swap-panel__field-head">
          <span>{copy.swapBuy}</span>
          <span>{copy.balance}: --</span>
        </div>
        <div className="swap-panel__field-row">
          <output className="swap-panel__output numeric-input" data-numeric>
            {quote != null ? quote.toFixed(6) : '0.00'}
          </output>
          <div className="swap-panel__token">
            <strong>{buySymbol}</strong>
          </div>
        </div>
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
          <dd data-numeric>0.5%</dd>
        </div>
        <div>
          <dt>{copy.route}</dt>
          <dd>{copy.routeValue}</dd>
        </div>
        <div>
          <dt>{copy.deadline}</dt>
          <dd>{copy.deadlineValue}</dd>
        </div>
      </dl>
      <p className="swap-panel__note">{valid ? copy.swapRateNote : copy.swapDetailsHint}</p>
      <p className="swap-panel__note">{copy.swapFeeNote}</p>
      <Button className="swap-panel__cta" disabled title={copy.swapCta}>
        {copy.swapCta}
      </Button>
    </section>
  )
}

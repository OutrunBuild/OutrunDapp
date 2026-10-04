'use client'

import { useId, useState } from 'react'
import { ArrowDown, ArrowLeftRight, Info, Settings2, X } from 'lucide-react'

import type { Locale, FixturePolPosition, FixtureVerse } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { useMockWallet } from '../global/mock-wallet'
import { DEADLINE_PRESETS, SLIPPAGE_PRESETS, isWholeMinutes } from './swap-panel'
import { formatAmount } from '../global/signal-ui'
import { AMOUNT_MAX_CHARS, amountToInputString, sanitizeAmount } from '../global/amount-input'
import { fmtTokenAmount, fmtUsd } from '../global/amount-format'
import { getSlippageIssue, slippageErrorCopyKey } from '../global/slippage-input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

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

/**
 * Mint POL 弹窗（2026-09-24：参照 demo 双币供给弹窗的功能结构，视觉按本站品牌适配）。
 * 机制：uAsset + memecoin 按主池配比供给，按实际加池量 1:1 铸 POL（IMemeverseLiquidityImpl.sol:31
 * mintPOLToken 签名含双侧 desired/min + deadline；pt-yt-splitter.md:251 POL:主池 LP=1:1）。
 * 原型报价：配比与输出为线性推导样本（price=主池蜡烛收盘、uAssetPerPol=fixture）；
 * 示意/链上读值/原型未接线类元文案一律不进 UI——内部开发原型，无需提示（2026-09-24 用户裁定）；
 * CTA 不伪造链上成交（未连接=Connect Wallet 可点切换模拟连接，已连接=Mint 禁用）。
 */
export function PolMintDialog({
  locale,
  verse,
  pol,
  price,
  uAssetUsd,
}: {
  locale: Locale
  verse: FixtureVerse
  pol: FixturePolPosition
  /** 主池价：1 memecoin = price uAsset（fixture 蜡烛收盘推导）；null=无样本 */
  price: number | null
  /** uAsset 美元样本价；null=隐藏美元换算行 */
  uAssetUsd: number | null
}) {
  const copy = getCopy(locale).verseDesk
  const common = getCopy(locale).common
  const { connected, toggle } = useMockWallet()
  const [memeAmount, setMemeAmount] = useState('')
  const receiveLabelId = useId()
  const slippageErrorId = useId()
  const deadlineErrorId = useId()
  const [uAmount, setUAmount] = useState('')
  const [slippage, setSlippage] = useState<number>(0.5)
  const [deadlineMin, setDeadlineMin] = useState<number>(10)
  const [rateInverted, setRateInverted] = useState(false)

  const polSymbol = `POL-${verse.symbol}`
  const memeVal = Number(memeAmount)
  const uVal = Number(uAmount)
  const valid = Number.isFinite(memeVal) && memeVal > 0 && Number.isFinite(uVal) && uVal > 0
  // POL 输出 = uAsset 侧 ÷ 每 POL 的 uAsset 侧（线性推导样本，以链上读值为准）
  const polOut = valid && pol.uAssetPerPol > 0 ? uVal / pol.uAssetPerPol : null
  // 滑点校验=§25 口径（slippage-input.ts）：越界期间保护值推导退 '--' 槽位
  const slippageIssue = getSlippageIssue(slippage)
  const deadlineValid = isWholeMinutes(deadlineMin)
  const minPol = polOut != null && slippageIssue == null ? polOut * (1 - slippage / 100) : null

  // 双侧联动：主池全范围两侧等值（OutrunBook pol-splitter.md），另一侧按 price 配比补算
  const onMemeInput = (raw: string) => {
    setMemeAmount(raw)
    const value = Number(raw)
    setUAmount(price != null && price > 0 && value > 0 ? amountToInputString(value * price) : '')
  }
  const onUInput = (raw: string) => {
    setUAmount(raw)
    const value = Number(raw)
    setMemeAmount(price != null && price > 0 && value > 0 ? amountToInputString(value / price) : '')
  }

  // 大数分层口径=global/amount-format（fmtUsd/fmtTokenAmount）
  const memeUsd =
    uAssetUsd == null || !valid || price == null || price <= 0
      ? null
      : fmtUsd(memeVal * price * uAssetUsd, locale)
  const uUsd = uAssetUsd == null || !valid ? null : fmtUsd(uVal * uAssetUsd, locale)

  return (
    <Dialog>
      {/* data-slot 钉回 button：base-ui Trigger 的 render 合并会覆写渲染元素的 data-slot，
          而主题桥（标签区「青色控制台」等皮肤）按 [data-slot='button'] 匹配——不钉回则与
          同排 Redeem/Split 钮皮肤不一致（2026-09-24） */}
      <DialogTrigger data-slot="button" render={<Button variant="outline" size="sm" />}>
        {copy.mintPol}
      </DialogTrigger>
      <DialogContent className="pol-mint-pop">
        <div className="pol-mint ax-glow-card">
          <header className="pol-mint__head">
            <DialogTitle className="pol-mint__title">{copy.mintDialogTitle}</DialogTitle>
            <div className="pol-mint__controls">
              <Popover>
                <PopoverTrigger
                  className="swap-panel__settings-toggle"
                  aria-label={copy.mintSettingsTitle}
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
                      <SettingsTip text={copy.mintSlippageTip} />
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
                          aria-invalid={slippageIssue != null || undefined}
                          aria-describedby={slippageIssue != null ? slippageErrorId : undefined}
                          value={slippage}
                          onChange={(event) => {
                            const next = Number(sanitizeAmount(event.target.value))
                            setSlippage(Number.isFinite(next) && next >= 0 ? next : 0)
                          }}
                        />
                        <b aria-hidden="true">%</b>
                      </span>
                    </div>
                    {slippageIssue != null ? (
                      <FieldError id={slippageErrorId}>
                        {copy[slippageErrorCopyKey(slippageIssue)]}
                      </FieldError>
                    ) : null}
                  </div>
                  <div className="swap-settings__row">
                    <span className="swap-settings__label">
                      {copy.transactionDeadline}
                      <SettingsTip text={copy.mintDeadlineTip} />
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
                          aria-invalid={!deadlineValid || undefined}
                          aria-describedby={!deadlineValid ? deadlineErrorId : undefined}
                          value={deadlineMin}
                          onChange={(event) => {
                            const next = Number(sanitizeAmount(event.target.value))
                            setDeadlineMin(Number.isFinite(next) && next > 0 ? next : 1)
                          }}
                        />
                        <b aria-hidden="true">min</b>
                      </span>
                    </div>
                    {!deadlineValid ? (
                      <FieldError id={deadlineErrorId}>{copy.deadlineWholeMinutes}</FieldError>
                    ) : null}
                  </div>
                </PopoverContent>
              </Popover>
              <DialogClose
                render={
                  <button type="button" className="pol-mint__close" aria-label={common.close} />
                }
              >
                <X aria-hidden="true" size={16} />
              </DialogClose>
            </div>
          </header>

          <span className="pol-mint__label">{copy.mintSupply}</span>
          <div className="swap-panel__field">
            <div className="swap-panel__field-head">
              <span>{copy.mintSideMeme}</span>
              <span className="swap-panel__balance">
                {copy.balance}: <span data-numeric>{formatAmount(pol.myMemecoin, locale)}</span>
                <button type="button" className="swap-panel__max" onClick={() => onMemeInput(amountToInputString(pol.myMemecoin))}>
                  {copy.max}
                </button>
              </span>
            </div>
            <div className="swap-panel__field-row">
              <Input
                className="numeric-input"
                inputMode="decimal"
                placeholder="0.00"
                value={memeAmount}
                maxLength={AMOUNT_MAX_CHARS}
                onChange={(event) => onMemeInput(sanitizeAmount(event.target.value))}
                aria-label={`${copy.mintSupply} ${verse.symbol}`}
              />
              <div className="swap-panel__token">
                <strong>{verse.symbol}</strong>
              </div>
            </div>
            {memeUsd != null ? <span className="swap-panel__field-usd">≈ ${memeUsd}</span> : null}
          </div>
          <div className="swap-panel__field">
            <div className="swap-panel__field-head">
              <span>{copy.mintSideUasset}</span>
              <span className="swap-panel__balance">
                {copy.balance}: <span data-numeric>{formatAmount(pol.myUAsset, locale)}</span>
                <button type="button" className="swap-panel__max" onClick={() => onUInput(amountToInputString(pol.myUAsset))}>
                  {copy.max}
                </button>
              </span>
            </div>
            <div className="swap-panel__field-row">
              <Input
                className="numeric-input"
                inputMode="decimal"
                placeholder="0.00"
                value={uAmount}
                maxLength={AMOUNT_MAX_CHARS}
                onChange={(event) => onUInput(sanitizeAmount(event.target.value))}
                aria-label={`${copy.mintSupply} ${verse.raiseAsset}`}
              />
              <div className="swap-panel__token">
                <strong>{verse.raiseAsset}</strong>
              </div>
            </div>
            {uUsd != null ? <span className="swap-panel__field-usd">≈ ${uUsd}</span> : null}
          </div>

          <span className="pol-mint__arrow" aria-hidden="true">
            <ArrowDown size={16} />
          </span>

          <div className="swap-panel__field" role="group" aria-labelledby={receiveLabelId}>
            <div className="swap-panel__field-head">
              <span id={receiveLabelId}>{copy.mintYouReceive}</span>
              <span>
                {copy.balance}: <span data-numeric>{formatAmount(pol.myPol, locale)}</span> {polSymbol}
              </span>
            </div>
            <div className="swap-panel__field-row">
              <output
                className="swap-panel__output numeric-input"
                data-numeric
                aria-label={`${copy.mintYouReceive} ${polSymbol}`}
              >
                {polOut != null ? fmtTokenAmount(polOut, locale) : '0.00'}
              </output>
              <div className="swap-panel__token">
                <strong>{polSymbol}</strong>
              </div>
            </div>
          </div>

          {valid ? (
            <dl className="swap-panel__details">
              <div>
                <dt>{copy.swapRate}</dt>
                <dd className="swap-panel__rate">
                  <span data-numeric>
                    {price != null && price > 0
                      ? rateInverted
                        ? `1 ${verse.raiseAsset} ≈ ${fmtTokenAmount(1 / price, locale)} ${verse.symbol}`
                        : `1 ${verse.symbol} ≈ ${fmtTokenAmount(price, locale)} ${verse.raiseAsset}`
                      : '--'}
                  </span>
                  <button
                    type="button"
                    className="swap-panel__rate-flip"
                    onClick={() => setRateInverted((v) => !v)}
                    disabled={!(price != null && price > 0)}
                    aria-label={copy.swapRateFlip}
                  >
                    <ArrowLeftRight aria-hidden="true" size={12} />
                  </button>
                </dd>
              </div>
              <div>
                <dt>{copy.minReceived}</dt>
                <dd data-numeric>
                  {minPol != null ? `${fmtTokenAmount(minPol, locale)} ${polSymbol}` : '--'}
                </dd>
              </div>
              <div>
                <dt>{copy.maxSlippage}</dt>
                <dd data-numeric>{slippageIssue == null ? `${slippage}%` : '--'}</dd>
              </div>
            </dl>
          ) : null}
          {connected ? (
            <Button className="swap-panel__cta" disabled>
              {copy.mintPol}
            </Button>
          ) : (
            <Button className="swap-panel__cta" onClick={toggle}>
              {copy.swapCta}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

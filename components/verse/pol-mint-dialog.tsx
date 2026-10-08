'use client'

import { useId, useState } from 'react'
import { ArrowDown, ArrowLeftRight } from 'lucide-react'

import type { Locale, FixturePolPosition, FixtureVerse } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { useMockWallet } from '../global/mock-wallet'
import { ActionDialogShell, DialogCta } from '../global/action-dialogs'
import { SwapSettings } from '../global/swap-settings'
import { formatAmount } from '../global/signal-ui'
import { AMOUNT_MAX_CHARS, amountToInputString, sanitizeAmount } from '../global/amount-input'
import { fmtTokenAmount, fmtUsd } from '../global/amount-format'
import { getSlippageIssue, slippageToNumber } from '../global/slippage-input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

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
  const memeBalanceErrorId = useId()
  const uBalanceErrorId = useId()
  const [uAmount, setUAmount] = useState('')
  // 设置层受控值存 string 原样展示（§25 拍板 A：留点不吞、非整分钟就地报错），
  // 数值推导经 slippageToNumber（2026-10-08 P1-1 修）
  const [slippageText, setSlippageText] = useState('0.5')
  const [deadlineText, setDeadlineText] = useState('10')
  const [rateInverted, setRateInverted] = useState(false)

  const polSymbol = `POL-${verse.symbol}`
  const memeVal = Number(memeAmount)
  const uVal = Number(uAmount)
  const valid = Number.isFinite(memeVal) && memeVal > 0 && Number.isFinite(uVal) && uVal > 0
  const memeOver = memeVal > pol.myMemecoin
  const uOver = uVal > pol.myUAsset
  // POL 输出 = uAsset 侧 ÷ 每 POL 的 uAsset 侧（线性推导样本，生产读链上值）
  const polOut = valid && pol.uAssetPerPol > 0 ? uVal / pol.uAssetPerPol : null
  // 滑点校验=§25 口径（slippage-input.ts）：越界期间保护值推导退 '--' 槽位
  const slippage = slippageToNumber(slippageText)
  const slippageIssue = getSlippageIssue(slippage)
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
      <ActionDialogShell
        title={copy.mintDialogTitle}
        closeLabel={common.close}
        toolbar={
          <SwapSettings
            locale={locale}
            settingsLabel={copy.mintSettingsTitle}
            slippageTip={copy.mintSlippageTip}
            slippageValue={slippageText}
            onSlippageValue={setSlippageText}
            deadline={{ tip: copy.mintDeadlineTip, value: deadlineText, onValue: setDeadlineText }}
          />
        }
      >

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
                aria-invalid={memeOver || undefined}
                aria-describedby={memeOver ? memeBalanceErrorId : undefined}
              />
              <div className="swap-panel__token">
                <strong>{verse.symbol}</strong>
              </div>
            </div>
            {memeOver ? (
              <FieldError id={memeBalanceErrorId}>{common.insufficientBalance}</FieldError>
            ) : null}
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
                aria-invalid={uOver || undefined}
                aria-describedby={uOver ? uBalanceErrorId : undefined}
              />
              <div className="swap-panel__token">
                <strong>{verse.raiseAsset}</strong>
              </div>
            </div>
            {uOver ? (
              <FieldError id={uBalanceErrorId}>{common.insufficientBalance}</FieldError>
            ) : null}
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
          <DialogCta
            locale={locale}
            connected={connected}
            onConnect={toggle}
            label={copy.mintPol}
            connectLabel={copy.swapCta}
          />
      </ActionDialogShell>
    </Dialog>
  )
}

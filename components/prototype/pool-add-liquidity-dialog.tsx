'use client'

import { useState } from 'react'
import { ArrowDown, ArrowLeftRight, Info, Settings2, X } from 'lucide-react'

import type { Locale, PrototypePolPosition, PrototypeVerseTrade } from '@/lib/data/prototype-repository'

import { getCopy } from './copy'
import { useMockWallet } from './mock-wallet'
import {
  AMOUNT_MAX_CHARS,
  COMPACT_AMOUNT_THRESHOLD,
  DEADLINE_PRESETS,
  SCIENTIFIC_AMOUNT_THRESHOLD,
  SLIPPAGE_PRESETS,
} from './swap-panel'
import { formatAmount } from './signal-ui'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
 * Add Liquidity 弹窗（2026-09-27 用户裁定：Liquidity 池卡 Add 钮改弹窗；
 * 功能结构同 Mint POL 弹窗，视觉复用 .pol-mint-* 壳）。机制（真源）：
 * 四池统一=router addLiquidity：双侧按池配比供给、铸 LP 代币给 to
 * （IMemeverseSwapRouter.sol，双侧 desired/min + deadline）——LP 铸得量 = quote 侧 ×
 * lpPerQuote（markets fixture 铸得率样本，totalSupply/R_quote v2 式口径；缺样本池才显
 * 「以链上读值为准」槽位；2026-09-27 用户裁定：造样本出数，不留空槽）。
 * （2026-09-27 用户裁定：Add Liquidity 收 LP 而非 POL——主池按加池量 1:1 铸 POL 的
 * mintPOLToken 入口归 Tokenization 标签 Mint 弹窗（PolMintDialog），两入口机制分立。）
 * 配比联动：主池=主池价（tokenStats.price）、POL/uAsset=fixture marketPricePerPol 样本、
 * PT 两池=锚定汇率推导样本（见下 ptAnchorRatio 注，2026-09-27 用户裁定造样本出数）。
 * 原型纪律同 Mint：报价为线性推导样本；CTA 未连接=Connect Wallet 可点切换模拟连接、
 * 已连接=Add Liquidity 禁用，不伪造链上成交。
 */
export function PoolAddLiquidityDialog({
  locale,
  pool,
  pol,
  price,
  uAssetUsd,
}: {
  locale: Locale
  /** 池卡行数据（pool 标识 + 双侧符号） */
  pool: PrototypeVerseTrade['pools'][number]
  /** POL/PT 持仓样本（余额/配比来源）；null=槽位态（余额 '--'） */
  pol: PrototypePolPosition | null
  /** 主池价：1 memecoin = price uAsset（仅主池联动用）；null=无样本 */
  price: number | null
  /** uAsset 美元样本价；null=隐藏美元换算行 */
  uAssetUsd: number | null
}) {
  const copy = getCopy(locale).verseDesk
  const common = getCopy(locale).common
  const { connected, toggle } = useMockWallet()
  const [baseAmount, setBaseAmount] = useState('')
  const [quoteAmount, setQuoteAmount] = useState('')
  const [slippage, setSlippage] = useState<number>(0.5)
  const [deadlineMin, setDeadlineMin] = useState<number>(10)
  const [rateInverted, setRateInverted] = useState(false)

  // 供给侧余额：主池=memecoin/uAsset，POL/uAsset=POL/uAsset，PT 池=PT/+（uAsset 或 POL）
  const baseBalance =
    pol == null
      ? null
      : pool.pool === 'main'
        ? pol.myMemecoin
        : pool.pool === 'pol-uasset'
          ? pol.myPol
          : pol.myPt
  const quoteBalance = pol == null ? null : pool.pool === 'pt-pol' ? pol.myPol : pol.myUAsset
  // POL/uAsset 池市场价样本（POL 侧 ≈$ 换算与 PT/POL 池 quote 侧共用）
  const polPrice = pol?.marketPricePerPol ?? null
  // LP 名 = 池卡同款交易对口径 + LP 后缀（v4 仓位制无 ERC20 LP 命名真源，
  // 展示层命名同行业惯例；四池各得专名）
  const lpSymbol = `${pool.baseSymbol}/${pool.quoteSymbol} LP`
  // 1 base = ratio quote。PT 两池=锚定汇率推导样本（2026-09-27 用户裁定造样本出数，
  // 不再不联动/'--'）：1 PT = uAssetPerPol uAsset（MemeverseLiquidityImpl.sol:239 固定兑付）；
  // PT/POL 池再按 POL/uAsset 市场价折算 1 PT = uAssetPerPol÷marketPricePerPol POL
  const ptAnchorRatio =
    pol != null && pol.marketPricePerPol > 0
      ? pool.pool === 'pt-uasset'
        ? pol.uAssetPerPol
        : pol.uAssetPerPol / pol.marketPricePerPol
      : null
  const ratio =
    pool.pool === 'main' ? price : pool.pool === 'pol-uasset' ? polPrice : ptAnchorRatio
  const baseVal = Number(baseAmount)
  const quoteVal = Number(quoteAmount)
  const valid = Number.isFinite(baseVal) && baseVal > 0 && Number.isFinite(quoteVal) && quoteVal > 0
  // LP 铸得 = quote 侧 × lpPerQuote（铸得率 fixture 样本，线性推导、以链上读值为准）
  const lpOut = valid && pool.lpPerQuote != null && pool.lpPerQuote > 0 ? quoteVal * pool.lpPerQuote : null
  const minLp = lpOut != null ? lpOut * (1 - slippage / 100) : null

  // 双侧联动：有配比样本的池按 ratio 补算另一侧（同 PolMintDialog，清空同步清另一侧）；
  // ratio 缺失（pol 记录缺失的 PT 池）→ 两侧独立输入互不干扰
  const fmtDerived = (value: number) => (Number.isFinite(value) && value > 0 ? String(Number(value.toFixed(6))) : '')
  const onBaseInput = (raw: string) => {
    setBaseAmount(raw)
    if (ratio == null || ratio <= 0) return
    const value = Number(raw)
    setQuoteAmount(value > 0 ? fmtDerived(value * ratio) : '')
  }
  const onQuoteInput = (raw: string) => {
    setQuoteAmount(raw)
    if (ratio == null || ratio <= 0) return
    const value = Number(raw)
    setBaseAmount(value > 0 ? fmtDerived(value / ratio) : '')
  }

  // 大数分层展示：同 swap-panel 口径（≥1e15 紧凑 / ≥1e21 科学记法）
  const localeTag = locale === 'zh' ? 'zh-CN' : 'en-US'
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
  const fmtTokenAmount = (value: number) => fmtTiered(value, 4, (v) => v.toFixed(6))
  // ≈$ 换算价（uAsset 计）：base 侧主池/POL 池有市场价样本、PT 侧=锚定汇率 uAssetPerPol；
  // quote 侧 uAsset=1、PT/POL 池=polPrice
  const baseUsdPrice =
    pool.pool === 'main' ? price : pool.pool === 'pol-uasset' ? polPrice : pol?.uAssetPerPol ?? null
  const quoteUsdPrice = pool.pool === 'pt-pol' ? polPrice : 1
  const baseUsd =
    uAssetUsd == null || !valid || baseUsdPrice == null || baseUsdPrice <= 0
      ? null
      : fmtUsd(baseVal * baseUsdPrice * uAssetUsd)
  const quoteUsd =
    uAssetUsd == null || !valid || quoteUsdPrice == null || quoteUsdPrice <= 0
      ? null
      : fmtUsd(quoteVal * quoteUsdPrice * uAssetUsd)

  return (
    <Dialog>
      {/* data-slot 钉回 button：同 PolMintDialog——主题桥按 [data-slot='button'] 匹配皮肤；
          .pool-card [data-slot='button'] 池卡行样式继续命中 */}
      <DialogTrigger data-slot="button" render={<Button variant="outline" size="sm" />}>
        {/* 2026-09-27 用户裁定：池卡钮短文案 Add（弹窗标题/CTA 仍全称） */}
        {copy.addLiquidityShort}
      </DialogTrigger>
      <DialogContent className="pol-mint-pop">
        <div className="pol-mint ax-glow-card">
          <header className="pol-mint__head">
            <DialogTitle className="pol-mint__title">{copy.addLiquidityDialogTitle}</DialogTitle>
            <div className="pol-mint__controls">
              <Popover>
                <PopoverTrigger
                  className="swap-panel__settings-toggle"
                  aria-label={copy.addLiquiditySettingsTitle}
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
                      <SettingsTip text={copy.addLiquiditySlippageTip} />
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
                      <SettingsTip text={copy.addLiquidityDeadlineTip} />
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
                            const next = Number(event.target.value.replace(/[^\d.]/g, ''))
                            setDeadlineMin(Number.isFinite(next) && next > 0 ? next : 1)
                          }}
                        />
                        <b aria-hidden="true">min</b>
                      </span>
                    </div>
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
              <span>{pool.baseSymbol}</span>
              <span className="swap-panel__balance">
                {copy.balance}:{' '}
                {baseBalance == null ? (
                  '--'
                ) : (
                  <span data-numeric>{formatAmount(baseBalance, locale)}</span>
                )}
                <button
                  type="button"
                  className="swap-panel__max"
                  disabled={baseBalance == null || baseBalance <= 0}
                  onClick={() => onBaseInput(fmtDerived(baseBalance ?? 0))}
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
                value={baseAmount}
                maxLength={AMOUNT_MAX_CHARS}
                onChange={(event) => onBaseInput(event.target.value.replace(/[^\d.]/g, ''))}
                aria-label={`${copy.addLiquidityDialogTitle} ${pool.baseSymbol}`}
              />
              <div className="swap-panel__token">
                <strong>{pool.baseSymbol}</strong>
              </div>
            </div>
            {baseUsd != null ? <span className="swap-panel__field-usd">≈ ${baseUsd}</span> : null}
          </div>
          <div className="swap-panel__field">
            <div className="swap-panel__field-head">
              <span>{pool.quoteSymbol}</span>
              <span className="swap-panel__balance">
                {copy.balance}:{' '}
                {quoteBalance == null ? (
                  '--'
                ) : (
                  <span data-numeric>{formatAmount(quoteBalance, locale)}</span>
                )}
                <button
                  type="button"
                  className="swap-panel__max"
                  disabled={quoteBalance == null || quoteBalance <= 0}
                  onClick={() => onQuoteInput(fmtDerived(quoteBalance ?? 0))}
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
                value={quoteAmount}
                maxLength={AMOUNT_MAX_CHARS}
                onChange={(event) => onQuoteInput(event.target.value.replace(/[^\d.]/g, ''))}
                aria-label={`${copy.addLiquidityDialogTitle} ${pool.quoteSymbol}`}
              />
              <div className="swap-panel__token">
                <strong>{pool.quoteSymbol}</strong>
              </div>
            </div>
            {quoteUsd != null ? <span className="swap-panel__field-usd">≈ ${quoteUsd}</span> : null}
          </div>

          <span className="pol-mint__arrow" aria-hidden="true">
            <ArrowDown size={16} />
          </span>

          <div className="swap-panel__field">
            <div className="swap-panel__field-head">
              <span>{copy.mintYouReceive}</span>
            </div>
            <div className="swap-panel__field-row">
              <output className="swap-panel__output numeric-input" data-numeric>
                {lpOut != null ? (
                  fmtTokenAmount(lpOut)
                ) : valid ? (
                  <span className="ax-slot">{copy.onChainSlot}</span>
                ) : (
                  '0.00'
                )}
              </output>
              <div className="swap-panel__token">
                <strong>{lpSymbol}</strong>
              </div>
            </div>
          </div>

          {valid ? (
            <dl className="swap-panel__details">
              <div>
                <dt>{copy.swapRate}</dt>
                <dd className="swap-panel__rate">
                  <span data-numeric>
                    {ratio != null && ratio > 0
                      ? rateInverted
                        ? `1 ${pool.quoteSymbol} ≈ ${(1 / ratio).toFixed(6)} ${pool.baseSymbol}`
                        : `1 ${pool.baseSymbol} ≈ ${ratio.toFixed(6)} ${pool.quoteSymbol}`
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
                  {minLp != null ? `${fmtTokenAmount(minLp)} ${lpSymbol}` : '--'}
                </dd>
              </div>
              <div>
                <dt>{copy.maxSlippage}</dt>
                <dd data-numeric>{slippage}%</dd>
              </div>
            </dl>
          ) : null}
          {connected ? (
            <Button className="swap-panel__cta" disabled>
              {copy.addLiquidity}
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

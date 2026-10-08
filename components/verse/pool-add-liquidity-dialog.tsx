'use client'

import { useId, useState } from 'react'
import { ArrowDown, ArrowLeftRight } from 'lucide-react'

import type { Locale, FixturePolPosition, FixtureVerseTrade } from '@/lib/data/fixture-repository'

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
 * Add Liquidity 弹窗（2026-09-27 用户裁定：Liquidity 池卡 Add 钮改弹窗；
 * 功能结构同 Mint POL 弹窗，视觉复用 .pol-mint-* 壳）。机制（真源）：
 * 四池统一=router addLiquidity：双侧按池配比供给、铸 LP 代币给 to
 * （IMemeverseSwapRouter.sol，双侧 desired/min + deadline）——LP 铸得量 = quote 侧 ×
 * lpPerQuote（markets fixture 铸得率样本，totalSupply/R_quote v2 式口径；缺样本池该输出
 * 随空值 0.00——「以链上读值为准」槽位 2026-10-05 用户裁定全站废止；2026-09-27 用户
 * 裁定：造样本出数，不留空槽）。
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
  pool: FixtureVerseTrade['pools'][number]
  /** POL/PT 持仓样本（余额/配比来源）；null=槽位态（余额 '--'） */
  pol: FixturePolPosition | null
  /** 主池价：1 memecoin = price uAsset（仅主池联动用）；null=无样本 */
  price: number | null
  /** uAsset 美元样本价；null=隐藏美元换算行 */
  uAssetUsd: number | null
}) {
  const copy = getCopy(locale).verseDesk
  const common = getCopy(locale).common
  const { connected, toggle } = useMockWallet()
  const [baseAmount, setBaseAmount] = useState('')
  const receiveLabelId = useId()
  const baseBalanceErrorId = useId()
  const quoteBalanceErrorId = useId()
  const [quoteAmount, setQuoteAmount] = useState('')
  // 设置层受控值存 string 原样展示（§25 拍板 A：留点不吞、非整分钟就地报错），
  // 数值推导经 slippageToNumber（2026-10-08 P1-1 修）
  const [slippageText, setSlippageText] = useState('0.5')
  const [deadlineText, setDeadlineText] = useState('10')
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
  const baseOver = baseBalance != null && baseVal > baseBalance
  const quoteOver = quoteBalance != null && quoteVal > quoteBalance
  // LP 铸得 = quote 侧 × lpPerQuote（铸得率 fixture 样本，线性推导、生产读链上值）
  const lpOut = valid && pool.lpPerQuote != null && pool.lpPerQuote > 0 ? quoteVal * pool.lpPerQuote : null
  // 滑点校验=§25 口径（slippage-input.ts）：越界期间保护值推导退 '--' 槽位
  const slippage = slippageToNumber(slippageText)
  const slippageIssue = getSlippageIssue(slippage)
  const minLp = lpOut != null && slippageIssue == null ? lpOut * (1 - slippage / 100) : null

  // 双侧联动：有配比样本的池按 ratio 补算另一侧（同 PolMintDialog，清空同步清另一侧）；
  // ratio 缺失（pol 记录缺失的 PT 池）→ 两侧独立输入互不干扰
  const onBaseInput = (raw: string) => {
    setBaseAmount(raw)
    if (ratio == null || ratio <= 0) return
    const value = Number(raw)
    setQuoteAmount(value > 0 ? amountToInputString(value * ratio) : '')
  }
  const onQuoteInput = (raw: string) => {
    setQuoteAmount(raw)
    if (ratio == null || ratio <= 0) return
    const value = Number(raw)
    setBaseAmount(value > 0 ? amountToInputString(value / ratio) : '')
  }

  // 大数分层口径=global/amount-format（fmtUsd/fmtTokenAmount）
  // ≈$ 换算价（uAsset 计）：base 侧主池/POL 池有市场价样本、PT 侧=锚定汇率 uAssetPerPol；
  // quote 侧 uAsset=1、PT/POL 池=polPrice
  const baseUsdPrice =
    pool.pool === 'main' ? price : pool.pool === 'pol-uasset' ? polPrice : pol?.uAssetPerPol ?? null
  const quoteUsdPrice = pool.pool === 'pt-pol' ? polPrice : 1
  const baseUsd =
    uAssetUsd == null || !valid || baseUsdPrice == null || baseUsdPrice <= 0
      ? null
      : fmtUsd(baseVal * baseUsdPrice * uAssetUsd, locale)
  const quoteUsd =
    uAssetUsd == null || !valid || quoteUsdPrice == null || quoteUsdPrice <= 0
      ? null
      : fmtUsd(quoteVal * quoteUsdPrice * uAssetUsd, locale)

  return (
    <Dialog>
      {/* data-slot 钉回 button：同 PolMintDialog——主题桥按 [data-slot='button'] 匹配皮肤；
          .pool-card [data-slot='button'] 池卡行样式继续命中 */}
      <DialogTrigger data-slot="button" render={<Button variant="outline" size="sm" />}>
        {/* 2026-09-27 用户裁定：池卡钮短文案 Add（弹窗标题/CTA 仍全称） */}
        {copy.addLiquidityShort}
      </DialogTrigger>
      <ActionDialogShell
        title={copy.addLiquidityDialogTitle}
        closeLabel={common.close}
        toolbar={
          <SwapSettings
            locale={locale}
            settingsLabel={copy.addLiquiditySettingsTitle}
            slippageTip={copy.addLiquiditySlippageTip}
            slippageValue={slippageText}
            onSlippageValue={setSlippageText}
            deadline={{
              tip: copy.addLiquidityDeadlineTip,
              value: deadlineText,
              onValue: setDeadlineText,
            }}
          />
        }
      >

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
                  onClick={() => onBaseInput(amountToInputString(baseBalance ?? 0))}
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
                onChange={(event) => onBaseInput(sanitizeAmount(event.target.value))}
                aria-label={`${copy.addLiquidityDialogTitle} ${pool.baseSymbol}`}
                aria-invalid={baseOver || undefined}
                aria-describedby={baseOver ? baseBalanceErrorId : undefined}
              />
              <div className="swap-panel__token">
                <strong>{pool.baseSymbol}</strong>
              </div>
            </div>
            {baseOver ? (
              <FieldError id={baseBalanceErrorId}>{common.insufficientBalance}</FieldError>
            ) : null}
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
                  onClick={() => onQuoteInput(amountToInputString(quoteBalance ?? 0))}
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
                onChange={(event) => onQuoteInput(sanitizeAmount(event.target.value))}
                aria-label={`${copy.addLiquidityDialogTitle} ${pool.quoteSymbol}`}
                aria-invalid={quoteOver || undefined}
                aria-describedby={quoteOver ? quoteBalanceErrorId : undefined}
              />
              <div className="swap-panel__token">
                <strong>{pool.quoteSymbol}</strong>
              </div>
            </div>
            {quoteOver ? (
              <FieldError id={quoteBalanceErrorId}>{common.insufficientBalance}</FieldError>
            ) : null}
            {quoteUsd != null ? <span className="swap-panel__field-usd">≈ ${quoteUsd}</span> : null}
          </div>

          <span className="pol-mint__arrow" aria-hidden="true">
            <ArrowDown size={16} />
          </span>

          <div className="swap-panel__field" role="group" aria-labelledby={receiveLabelId}>
            <div className="swap-panel__field-head">
              <span id={receiveLabelId}>{copy.mintYouReceive}</span>
            </div>
            <div className="swap-panel__field-row">
              <output
                className="swap-panel__output numeric-input"
                data-numeric
                aria-label={`${copy.mintYouReceive} ${lpSymbol}`}
              >
                {lpOut != null ? fmtTokenAmount(lpOut, locale) : '0.00'}
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
                        ? `1 ${pool.quoteSymbol} ≈ ${fmtTokenAmount(1 / ratio, locale)} ${pool.baseSymbol}`
                        : `1 ${pool.baseSymbol} ≈ ${fmtTokenAmount(ratio, locale)} ${pool.quoteSymbol}`
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
                  {minLp != null ? `${fmtTokenAmount(minLp, locale)} ${lpSymbol}` : '--'}
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
            label={copy.addLiquidity}
            connectLabel={copy.swapCta}
          />
      </ActionDialogShell>
    </Dialog>
  )
}

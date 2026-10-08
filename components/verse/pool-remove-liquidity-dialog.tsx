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
 * Remove Liquidity 弹窗（2026-09-27 用户裁定：池卡新增 Remove 钮）。
 * 机制（真源）：四池统一=router removeLiquidity——burn LP 代币（uint128 liquidity）
 * 按池配比双侧取回、amount0Min/amount1Min + deadline（IMemeverseSwapRouter.sol:292-300
 * "LP liquidity to burn"；双侧 min 即滑点保护 → 保留设置齿轮，同 §22 Add 弹窗）。
 * 输出推导=Add 反向：quote = burnLP ÷ lpPerQuote、base = quote ÷ ratio；
 * PT 两池配比=锚定汇率推导样本（见下 ptAnchorRatio 注，2026-09-27 用户裁定造样本出数）。
 * LP 余额=pol-positions myLp 四池样本（gen-pol-my-lp.mjs 生成）；
 * 原型纪律同 Add：报价为线性推导样本；CTA 未连接=Connect Wallet 可点切换模拟连接、
 * 已连接=Remove 禁用，不伪造链上成交。
 */
export function PoolRemoveLiquidityDialog({
  locale,
  pool,
  pol,
  price,
  uAssetUsd,
}: {
  locale: Locale
  /** 池卡行数据（pool 标识 + 双侧符号） */
  pool: FixtureVerseTrade['pools'][number]
  /** POL/PT 持仓样本（LP 余额/配比来源）；null=槽位态（余额 '--'） */
  pol: FixturePolPosition | null
  /** 主池价：1 memecoin = price uAsset（仅主池联动用）；null=无样本 */
  price: number | null
  /** uAsset 美元样本价；null=隐藏美元换算行 */
  uAssetUsd: number | null
}) {
  const copy = getCopy(locale).verseDesk
  const common = getCopy(locale).common
  const { connected, toggle } = useMockWallet()
  const [lpAmount, setLpAmount] = useState('')
  const receiveLabelId = useId()
  const lpBalanceErrorId = useId()
  // 设置层受控值存 string 原样展示（§25 拍板 A：留点不吞、非整分钟就地报错），
  // 数值推导经 slippageToNumber（2026-10-08 P1-1 修）
  const [slippageText, setSlippageText] = useState('0.5')
  const [deadlineText, setDeadlineText] = useState('10')
  const [rateInverted, setRateInverted] = useState(false)

  const lpBalance = pol == null ? null : pol.myLp[pool.pool]
  // Max 填入值（null/≤0 → 空）；提前算好避免闭包内丢窄化
  const maxLp = amountToInputString(lpBalance ?? 0)
  // POL/uAsset 池市场价样本（POL 计价侧 ≈$ 换算用）
  const polPrice = pol?.marketPricePerPol ?? null
  const lpSymbol = `${pool.baseSymbol}/${pool.quoteSymbol} LP`
  // 池配比 1 base = ratio quote。PT 两池=锚定汇率推导样本（2026-09-27 用户裁定
  // 造样本出数，不留 '--'/槽位）：1 PT = uAssetPerPol uAsset（MemeverseLiquidityImpl.sol:239
  // 固定兑付）；PT/POL 池再按 POL/uAsset 市场价折算 1 PT = uAssetPerPol÷marketPricePerPol POL
  const ptAnchorRatio =
    pol != null && pol.marketPricePerPol > 0
      ? pool.pool === 'pt-uasset'
        ? pol.uAssetPerPol
        : pol.uAssetPerPol / pol.marketPricePerPol
      : null
  const ratio =
    pool.pool === 'main' ? price : pool.pool === 'pol-uasset' ? polPrice : ptAnchorRatio

  const lpVal = Number(lpAmount)
  const valid = Number.isFinite(lpVal) && lpVal > 0
  const lpOver = lpBalance != null && lpVal > lpBalance
  // 取回推导=铸得反向：quote = LP ÷ lpPerQuote；base 再按配比折算（缺样本侧走槽位）
  const quoteOut =
    valid && pool.lpPerQuote != null && pool.lpPerQuote > 0 ? lpVal / pool.lpPerQuote : null
  const baseOut = quoteOut != null && ratio != null && ratio > 0 ? quoteOut / ratio : null
  // 滑点校验=§25 口径（slippage-input.ts）：越界期间保护值推导退 '--' 槽位
  const slippage = slippageToNumber(slippageText)
  const slippageIssue = getSlippageIssue(slippage)
  const minQuote =
    quoteOut != null && slippageIssue == null ? quoteOut * (1 - slippage / 100) : null
  const minBase =
    baseOut != null && slippageIssue == null ? baseOut * (1 - slippage / 100) : null

  // 大数分层口径=global/amount-format（fmtUsd/fmtTokenAmount）
  // ≈$ 换算价（uAsset 计）：base 侧主池/POL 池有市场价样本、PT 侧=锚定汇率 uAssetPerPol；
  // quote 侧 uAsset=1、PT/POL 池=polPrice
  const baseUsdPrice =
    pool.pool === 'main' ? price : pool.pool === 'pol-uasset' ? polPrice : pol?.uAssetPerPol ?? null
  const quoteUsdPrice = pool.pool === 'pt-pol' ? polPrice : 1
  const baseUsd =
    uAssetUsd == null || !valid || baseOut == null || baseUsdPrice == null || baseUsdPrice <= 0
      ? null
      : fmtUsd(baseOut * baseUsdPrice * uAssetUsd, locale)
  const quoteUsd =
    uAssetUsd == null || !valid || quoteOut == null || quoteUsdPrice == null || quoteUsdPrice <= 0
      ? null
      : fmtUsd(quoteOut * quoteUsdPrice * uAssetUsd, locale)

  return (
    <Dialog>
      {/* data-slot 钉回 button：同 PolMintDialog——主题桥按 [data-slot='button'] 匹配皮肤；
          .pool-card [data-slot='button'] 池卡行样式继续命中 */}
      <DialogTrigger data-slot="button" render={<Button variant="outline" size="sm" />}>
        {copy.removeLiquidity}
      </DialogTrigger>
      <ActionDialogShell
        title={copy.removeLiquidityDialogTitle}
        closeLabel={common.close}
        toolbar={
          <SwapSettings
            locale={locale}
            settingsLabel={copy.removeLiquiditySettingsTitle}
            slippageTip={copy.removeLiquiditySlippageTip}
            slippageValue={slippageText}
            onSlippageValue={setSlippageText}
            deadline={{
              tip: copy.removeLiquidityDeadlineTip,
              value: deadlineText,
              onValue: setDeadlineText,
            }}
          />
        }
      >

          <span className="pol-mint__label">{copy.removeBurn}</span>
          <div className="swap-panel__field">
            <div className="swap-panel__field-head">
              <span>{lpSymbol}</span>
              <span className="swap-panel__balance">
                {copy.balance}:{' '}
                {lpBalance == null ? (
                  '--'
                ) : (
                  <span data-numeric>{formatAmount(lpBalance, locale)}</span>
                )}
                <button
                  type="button"
                  className="swap-panel__max"
                  disabled={maxLp === ''}
                  onClick={() => setLpAmount(maxLp)}
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
                value={lpAmount}
                maxLength={AMOUNT_MAX_CHARS}
                onChange={(event) => setLpAmount(sanitizeAmount(event.target.value))}
                aria-label={`${copy.removeLiquidityDialogTitle} ${lpSymbol}`}
                aria-invalid={lpOver || undefined}
                aria-describedby={lpOver ? lpBalanceErrorId : undefined}
              />
              <div className="swap-panel__token">
                <strong>{lpSymbol}</strong>
              </div>
            </div>
            {lpOver ? (
              <FieldError id={lpBalanceErrorId}>{common.insufficientBalance}</FieldError>
            ) : null}
          </div>

          <span className="pol-mint__arrow" aria-hidden="true">
            <ArrowDown size={16} />
          </span>

          {/* 输出框：base/quote 两腿合一个框、单「预计获得」标签管两腿（§21 2026-09-27 参照图
              裁定模式，2026-10-03 对齐；行间 hairline 由 ~ 兄弟选择器提供） */}
          <div className="swap-panel__field" role="group" aria-labelledby={receiveLabelId}>
            <div className="swap-panel__field-head">
              <span id={receiveLabelId}>{copy.mintYouReceive}</span>
            </div>
            <div className="swap-panel__field-row">
              <output
                className="swap-panel__output numeric-input"
                data-numeric
                aria-label={`${copy.mintYouReceive} ${pool.baseSymbol}`}
              >
                {baseOut != null ? fmtTokenAmount(baseOut, locale) : '0.00'}
              </output>
              <div className="swap-panel__token">
                <strong>{pool.baseSymbol}</strong>
              </div>
            </div>
            {baseUsd != null ? <span className="swap-panel__field-usd">≈ ${baseUsd}</span> : null}
            <div className="swap-panel__field-row">
              <output
                className="swap-panel__output numeric-input"
                data-numeric
                aria-label={`${copy.mintYouReceive} ${pool.quoteSymbol}`}
              >
                {quoteOut != null ? fmtTokenAmount(quoteOut, locale) : '0.00'}
              </output>
              <div className="swap-panel__token">
                <strong>{pool.quoteSymbol}</strong>
              </div>
            </div>
            {quoteUsd != null ? <span className="swap-panel__field-usd">≈ ${quoteUsd}</span> : null}
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
                  {minBase != null || minQuote != null
                    ? [
                        minBase != null ? `${fmtTokenAmount(minBase, locale)} ${pool.baseSymbol}` : null,
                        minQuote != null ? `${fmtTokenAmount(minQuote, locale)} ${pool.quoteSymbol}` : null,
                      ]
                        .filter(Boolean)
                        .join(' + ')
                    : '--'}
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
            label={copy.removeLiquidity}
            connectLabel={copy.swapCta}
          />
      </ActionDialogShell>
    </Dialog>
  )
}

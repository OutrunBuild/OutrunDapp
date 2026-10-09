'use client'

import { useId, useState } from 'react'

import type {
  FixturePolPosition,
  FixtureVerse,
  Locale,
} from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { useMockWallet } from '../global/mock-wallet'
import { formatAmount } from '../global/signal-ui'
import { ActionDialogShell, AmountField, DetailRows, DialogCta } from '../global/action-dialogs'
import { slippageToNumber, getSlippageIssue } from '../global/slippage-input'
import { SwapSettings } from '../global/swap-settings'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'

/** 保护窗卡 Exit 上下文（portfolio-page 按 protection 行预取；缺行=卡片回落跳 verse 页） */
export type ProtectionExitContext = {
  verse: FixtureVerse
  pol: FixturePolPosition
  /** 主池价（uAsset per memecoin，candles 末收盘口径）；null=memecoin 腿随空值 0.00 */
  price: number | null
  /** uAsset 美元样本（assets usdSample）；null=美元回声行不渲染 */
  uAssetUsd: number | null
}

/**
 * 保护窗 Exit 弹窗（2026-10-09：待办区保护窗卡 Exit 钮由跳 verse 页改页内弹窗）。
 * 机制=redeemMemecoinLiquidity 两 overload（MemeverseLiquidityImpl.sol:851/870）：
 * LP 模式=unwrap=false，POL 1:1 换主池 LP 直转（非价格敏感、合约无滑点参数→无齿轮，
 * 同 PolRedeemLpDialog 口径）；拆币模式=unwrap=true，LP 现场拆 memecoin+uAsset，
 * 6 参强制 minOut×2+deadline（3 参 unwrap 直接 SlippageProtectionRequired——:852-854；
 * OutrunBook lifecycle.md:103）→ 齿轮（SwapSettings）+ Min received/Max slippage 行
 * （pool-remove-liquidity-dialog 先例）。输出腿序=memecoin 主腿在前（井读数同序）。
 * 腿估算：uAsset=量×uAssetPerPol；memecoin=量×uAssetPerPol÷主池价（池价比
 * pro-rata 推导）；≈$ 回声同 PolRedeemPtYtDialog 换算源，样本缺→行不渲染。
 * CTA 纪律同 ActionDialogShell 族：未连接=Connect 可点、已连接=动作钮禁用
 * （不伪造成交）；金额默认空（2026-10-08 裁定），余额不足短句由 AmountField 兜。
 */
export function ProtectionExitDialog({
  locale,
  context,
  triggerLabel,
}: {
  locale: Locale
  context: ProtectionExitContext
  triggerLabel: string
}) {
  const action = getCopy(locale).portfolio.action
  const assetsCopy = getCopy(locale).portfolio.assets
  const common = getCopy(locale).common
  const { connected, toggle } = useMockWallet()
  const { verse, pol, price, uAssetUsd } = context

  const [mode, setMode] = useState<'lp' | 'split'>('lp')
  // 打开为空输入（2026-10-08 用户裁定：金额输入默认空 0.00）
  const [amount, setAmount] = useState('')
  const [slippageText, setSlippageText] = useState('0.5')
  const [deadlineText, setDeadlineText] = useState('10')
  const receiveLabelId = useId()

  const polSymbol = `POL-${verse.symbol}`
  // 主池 LP 对口径（同 PolRedeemLpDialog：{MEME}/{uAsset} LP）
  const lpSymbol = `${verse.symbol}/${verse.raiseAsset} LP`
  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0

  // LP 模式：1:1 主池构造恒等（MemeverseLiquidityImpl.sol:888），无槽位分支
  const lpOut = valid ? parsed : null
  // 拆币模式：uAsset 腿=uAssetPerPol；memecoin 腿=按主池价比推导（样本缺→0.00 槽）
  const uOut = valid ? parsed * pol.uAssetPerPol : null
  const mOut =
    valid && price != null && price > 0 ? (parsed * pol.uAssetPerPol) / price : null

  const slippage = slippageToNumber(slippageText)
  const slippageIssue = getSlippageIssue(slippage)
  const minU = uOut != null && slippageIssue == null ? uOut * (1 - slippage / 100) : null
  const minM = mOut != null && slippageIssue == null ? mOut * (1 - slippage / 100) : null

  // ≈$ 回声（PolRedeemPtYtDialog:77-80 同源：uAsset 腿×uAssetUsd、memecoin 腿×价×uAssetUsd）
  const uUsd = uOut != null && uAssetUsd != null ? uOut * uAssetUsd : null
  const mUsd =
    mOut != null && price != null && uAssetUsd != null ? mOut * price * uAssetUsd : null

  return (
    <Dialog>
      {/* data-slot 钉回 button：主题桥按 [data-slot='button'] 匹配皮肤；卡底 CTA 同款式 */}
      <DialogTrigger data-slot="button" render={<Button variant="outline" />}>
        {triggerLabel}
      </DialogTrigger>
      <ActionDialogShell
        title={action.exitTitle}
        closeLabel={common.close}
        toolbar={
          mode === 'split' ? (
            <SwapSettings
              locale={locale}
              settingsLabel={action.exitSettingsTitle}
              slippageTip={action.exitSlippageTip}
              slippageValue={slippageText}
              onSlippageValue={setSlippageText}
              deadline={{
                tip: action.exitDeadlineTip,
                value: deadlineText,
                onValue: setDeadlineText,
              }}
            />
          ) : undefined
        }
      >
        <div className="pf-dialog__chips" role="group" aria-label={action.exitTitle}>
          <button
            type="button"
            data-selected={mode === 'lp' || undefined}
            onClick={() => setMode('lp')}
          >
            {action.exitModeLp}
          </button>
          <button
            type="button"
            data-selected={mode === 'split' || undefined}
            onClick={() => setMode('split')}
          >
            {action.exitModeSplit.replace('{m}', verse.symbol).replace('{u}', verse.raiseAsset)}
          </button>
        </div>

        <AmountField
          locale={locale}
          label={polSymbol}
          balance={pol.myPol}
          balanceLabel={assetsCopy.balance}
          maxLabel={assetsCopy.max}
          value={amount}
          onValue={setAmount}
          tokenSymbol={polSymbol}
          ariaLabel={`${action.exitTitle} ${polSymbol}`}
        />

        {/* Receive 框：LP=单腿；拆币=双腿合一个框（memecoin 主腿在前，行间 hairline
            由 ~ 兄弟选择器提供——pool-remove-liquidity 同款） */}
        {mode === 'lp' ? (
          <div className="swap-panel__field" role="group" aria-labelledby={receiveLabelId}>
            <div className="swap-panel__field-head">
              <span id={receiveLabelId}>{action.exitReceive}</span>
            </div>
            <div className="swap-panel__field-row">
              <output
                className="swap-panel__output numeric-input"
                data-numeric
                aria-label={`${action.exitReceive} ${lpSymbol}`}
              >
                {lpOut != null ? formatAmount(lpOut, locale) : '0.00'}
              </output>
              <div className="swap-panel__token">
                <strong>{lpSymbol}</strong>
              </div>
            </div>
          </div>
        ) : (
          <div className="swap-panel__field" role="group" aria-labelledby={receiveLabelId}>
            <div className="swap-panel__field-head">
              <span id={receiveLabelId}>{action.exitReceive}</span>
            </div>
            <div className="swap-panel__field-row">
              <output
                className="swap-panel__output numeric-input"
                data-numeric
                aria-label={`${action.exitReceive} ${verse.symbol}`}
              >
                {mOut != null ? formatAmount(mOut, locale) : '0.00'}
              </output>
              <div className="swap-panel__token">
                <strong>{verse.symbol}</strong>
              </div>
            </div>
            {mUsd != null ? (
              <span className="swap-panel__field-usd">≈ ${formatAmount(mUsd, locale)}</span>
            ) : null}
            <div className="swap-panel__field-row">
              <output
                className="swap-panel__output numeric-input"
                data-numeric
                aria-label={`${action.exitReceive} ${verse.raiseAsset}`}
              >
                {uOut != null ? formatAmount(uOut, locale) : '0.00'}
              </output>
              <div className="swap-panel__token">
                <strong>{verse.raiseAsset}</strong>
              </div>
            </div>
            {uUsd != null ? (
              <span className="swap-panel__field-usd">≈ ${formatAmount(uUsd, locale)}</span>
            ) : null}
          </div>
        )}

        {/* minOut×2+deadline 合约强制（SlippageProtectionRequired）→ 拆币模式明细行
            （pool-remove-liquidity 同款：Min received 双腿 ' + ' 连接、Max slippage） */}
        {mode === 'split' && valid ? (
          <DetailRows
            rows={[
              [
                action.exitMinReceived,
                <span key="min" data-numeric>
                  {minM != null || minU != null
                    ? [
                        minM != null ? `${formatAmount(minM, locale)} ${verse.symbol}` : null,
                        minU != null ? `${formatAmount(minU, locale)} ${verse.raiseAsset}` : null,
                      ]
                        .filter(Boolean)
                        .join(' + ')
                    : '--'}
                </span>,
              ],
              [
                action.exitMaxSlippage,
                <span key="slip" data-numeric>
                  {slippageIssue == null ? `${slippage}%` : '--'}
                </span>,
              ],
            ]}
          />
        ) : null}

        <DialogCta locale={locale} connected={connected} onConnect={toggle} label={action.exitCta} />
      </ActionDialogShell>
    </Dialog>
  )
}

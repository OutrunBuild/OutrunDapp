'use client'

import { useId, useState } from 'react'
import { ArrowDown, ArrowLeftRight } from 'lucide-react'

import type { Locale, FixturePolPosition, FixtureVerse } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { useMockWallet } from '../global/mock-wallet'
import { ActionDialogShell, DialogCta } from '../global/action-dialogs'
import { SettingsTip, SwapSettings } from '../global/swap-settings'
import { formatAmount, formatPercent } from '../global/signal-ui'
import { AMOUNT_MAX_CHARS, amountToInputString, sanitizeAmount } from '../global/amount-input'
import { fmtTokenAmount, fmtUsd } from '../global/amount-format'
import { getSlippageIssue, slippageToNumber } from '../global/slippage-input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

/**
 * Flash Swap 操作弹窗（2026-09-27 方案 B：YT 移出 Swap 卡，进 Tokenization 页 YT 井）。
 * 机制（yt-flash-swap.md）：POL↔YT 单通道，复用 PT/POL 池流动性；买卖均「指定 YT 数量」——
 * 买=到手 y YT、支付 y−R（R=y PT 的池内变现，上限=Max paid）、卖=收到 y−Q（下限=Min received）。
 * 对手侧展示=uAsset 而非 POL（2026-09-28 用户裁定：理解成本更低）——前端按 POL/uAsset 池价
 * 折算组合，链上仍经 Flash Swap 以 POL 成交。
 * 线性参考价：1 YT ≈ (1−PT/POL 池价)×POL/uAsset 池价（隐含价，1 POL=1 PT+1 YT）；费率=PT/POL 池动态费单次。
 * UI 同构：上块=YT 驱动输入（买卖共用不翻转），下块=uAsset 派生只读；模式条只改标签与保护行方向。
 * 闸门仅 locked（井底门控；解锁后 split/merge 关闭、Flash Swap 随之不可用，转结算赎回）。
 * 设置齿轮只留滑点（合约无 deadline 参数；可选限价+到期属高级项原型不做——同 Split/Merge 裁定口径）。
 * 打开为空输入（2026-10-08 用户裁定：金额输入默认空 0.00，废除 2026-09-28
 * 打开预填余额口径）；清空/改数后照常重算，模式切换保留输入。
 * CTA 纪律同 Mint 弹窗：未连接=Connect Wallet 可点切换模拟连接、已连接=操作钮禁用（不伪造成交）。
 */
export function PolFlashSwapDialog({
  locale,
  verse,
  pol,
  uAssetUsd,
}: {
  locale: Locale
  verse: FixtureVerse
  pol: FixturePolPosition
  /** uAsset 美元样本价；null=隐藏美元换算行 */
  uAssetUsd: number | null
}) {
  const copy = getCopy(locale).verseDesk
  const common = getCopy(locale).common
  const { connected, toggle } = useMockWallet()
  const [mode, setMode] = useState<'buy' | 'sell'>('buy')
  const legLabelId = useId()
  const balanceErrorId = useId()
  // 打开为空输入（2026-10-08 用户裁定：金额输入默认空 0.00）
  const [amount, setAmount] = useState('')
  // 设置层受控值存 string 原样展示（§25 拍板 A：留点不吞；数值推导经
  // slippageToNumber，2026-10-08 P1-1 修）
  const [slippageText, setSlippageText] = useState('0.5')
  const [rateInverted, setRateInverted] = useState(false)

  const ytSymbol = `YT-${verse.symbol}`
  const clean = (raw: string) => setAmount(sanitizeAmount(raw))

  // uAsset 计价隐含价（2026-09-28 用户裁定：对手侧直接用 uAsset，理解成本更低——内部两步：
  // 1 POL=1 PT+1 YT → 1 YT ≈ 1 POL−PT 池市价（yt-flash-swap.md），再按 POL/uAsset 池价折 uAsset；
  // 链上仍经 Flash Swap 以 POL 成交，前端组合 POL/uAsset 池腿）
  const ytPerUAsset = (1 - pol.ptPricePerPol) * pol.marketPricePerPol
  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0 && ytPerUAsset > 0
  // 买卖同为线性参考价：支付/收到 uAsset = YT 数量 × 隐含价（执行价由池状态决定，见杠杆警示）
  const uAssetLeg = valid ? parsed * ytPerUAsset : null
  // 余额不足：卖=超 YT 持仓；买=派生支付腿超 uAsset 余额（下块只读，错误归驱动输入框）
  const overBalance =
    mode === 'sell' ? parsed > pol.myYt : uAssetLeg != null && uAssetLeg > pol.myUAsset
  // 滑点校验=§25 口径（slippage-input.ts）：越界期间保护值推导退 '--' 槽位
  const slippage = slippageToNumber(slippageText)
  const slippageIssue = getSlippageIssue(slippage)
  const protectedLeg =
    uAssetLeg != null && slippageIssue == null
      ? uAssetLeg * (mode === 'buy' ? 1 + slippage / 100 : 1 - slippage / 100)
      : null
  // 大数分层口径=global/amount-format（fmtUsd/fmtTokenAmount；裸乘积有 float64 尾噪必须过层）；
  // 费率行=用户手续费率样本（相对支付额，fixture 直读不做推导——2026-09-28 用户裁定：
  // 假数据不算精确值；谱系与过高回滚口径见 flashFeeNote ⊙ 与 fixture 注释）
  // ≈$：两侧同为 uAsset 计价 × uAssetUsd
  const uAssetUsdText =
    uAssetUsd == null || uAssetLeg == null ? null : fmtUsd(uAssetLeg * uAssetUsd, locale)
  const ytUsd =
    uAssetUsd == null || !valid ? null : fmtUsd(parsed * ytPerUAsset * uAssetUsd, locale)

  return (
    <Dialog>
      <DialogTrigger data-slot="button" render={<Button variant="outline" size="sm" />}>
        {copy.flashSwap}
      </DialogTrigger>
      <ActionDialogShell
        title={copy.flashSwap}
        closeLabel={common.close}
        toolbar={
          /* 只留滑点：合约无 deadline；可选限价+到期不做（见组件头注） */
          <SwapSettings
            locale={locale}
            settingsLabel={copy.flashSettingsTitle}
            slippageTip={copy.slippageTip}
            slippageValue={slippageText}
            onSlippageValue={setSlippageText}
          />
        }
      >

          {/* 模式条：vault 操作卡同款 tab 风 ToggleGroup（买=exact-out 支付上限、卖=到账下限） */}
          <ToggleGroup
            className="vault-actions__bar"
            value={[mode]}
            onValueChange={(value) => {
              const next = value[0] as 'buy' | 'sell' | undefined
              if (!next) return
              setMode(next)
            }}
          >
            <ToggleGroupItem value="buy">{copy.flashBuy}</ToggleGroupItem>
            <ToggleGroupItem value="sell">{copy.flashSell}</ToggleGroupItem>
          </ToggleGroup>

          {/* 上块=YT 驱动输入：买卖共用（真源：两向均指定 YT 数量），Sell 挂 Max、Buy 无 */}
          <div className="swap-panel__field">
            <div className="swap-panel__field-head">
              <span>YT</span>
              <span className="swap-panel__balance">
                {copy.balance}: <span data-numeric>{formatAmount(pol.myYt, locale)}</span>
                {mode === 'sell' ? (
                  <button
                    type="button"
                    className="swap-panel__max"
                    onClick={() => clean(amountToInputString(pol.myYt))}
                  >
                    {copy.max}
                  </button>
                ) : null}
              </span>
            </div>
            <div className="swap-panel__field-row">
              <Input
                className="numeric-input"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                maxLength={AMOUNT_MAX_CHARS}
                onChange={(event) => clean(event.target.value)}
                aria-label={`${copy.flashSwap} ${ytSymbol}`}
                aria-invalid={overBalance || undefined}
                aria-describedby={overBalance ? balanceErrorId : undefined}
              />
              <div className="swap-panel__token">
                <strong>{ytSymbol}</strong>
              </div>
            </div>
            {overBalance ? (
              <FieldError id={balanceErrorId}>{common.insufficientBalance}</FieldError>
            ) : null}
            {ytUsd != null ? <span className="swap-panel__field-usd">≈ ${ytUsd}</span> : null}
          </div>

          <span className="pol-mint__arrow" aria-hidden="true">
            <ArrowDown size={16} />
          </span>

          {/* 下块=uAsset 派生只读（对手侧=uAsset——用户裁定 2026-09-28；内部经 POL/uAsset 池折算）：
              Buy=You pay（上限见 Max paid 行）、Sell=You receive（下限见 Min received） */}
          <div className="swap-panel__field" role="group" aria-labelledby={legLabelId}>
            <div className="swap-panel__field-head">
              <span id={legLabelId}>{mode === 'buy' ? copy.flashYouPay : copy.youReceive}</span>
              <span className="swap-panel__balance">
                {copy.balance}: <span data-numeric>{formatAmount(pol.myUAsset, locale)}</span>
              </span>
            </div>
            <div className="swap-panel__field-row">
              <output
                className="swap-panel__output numeric-input"
                data-numeric
                aria-label={`${mode === 'buy' ? copy.flashYouPay : copy.youReceive} ${verse.raiseAsset}`}
              >
                {uAssetLeg != null ? fmtTokenAmount(uAssetLeg, locale) : '0.00'}
              </output>
              <div className="swap-panel__token">
                <strong>{verse.raiseAsset}</strong>
              </div>
            </div>
            {uAssetUsdText != null ? (
              <span className="swap-panel__field-usd">≈ ${uAssetUsdText}</span>
            ) : null}
          </div>

          <dl className="swap-panel__details">
            <div>
              <dt>
                {copy.swapRate}
                <SettingsTip text={copy.flashRateTip} />
              </dt>
              <dd className="swap-panel__rate">
                <span data-numeric>
                  {ytPerUAsset > 0
                    ? rateInverted
                      ? `1 ${verse.raiseAsset} ≈ ${fmtTokenAmount(1 / ytPerUAsset, locale)} ${ytSymbol}`
                      : `1 ${ytSymbol} ≈ ${fmtTokenAmount(ytPerUAsset, locale)} ${verse.raiseAsset}`
                    : '--'}
                </span>
                <button
                  type="button"
                  className="swap-panel__rate-flip"
                  onClick={() => setRateInverted((v) => !v)}
                  disabled={!(ytPerUAsset > 0)}
                  aria-label={copy.swapRateFlip}
                >
                  <ArrowLeftRight aria-hidden="true" size={12} />
                </button>
              </dd>
            </div>
            <div>
              <dt>{mode === 'buy' ? copy.maxPaid : copy.minReceived}</dt>
              <dd data-numeric>
                {protectedLeg != null ? `${fmtTokenAmount(protectedLeg, locale)} ${verse.raiseAsset}` : '--'}
              </dd>
            </div>
            <div>
              <dt>
                {copy.flashFeeLabel}
                <SettingsTip text={copy.flashFeeNote} />
              </dt>
              <dd data-numeric>
                {formatPercent(pol.flashUserFeeRate * 100, locale)}%
              </dd>
            </div>
          </dl>

          <DialogCta
            locale={locale}
            connected={connected}
            onConnect={toggle}
            label={mode === 'buy' ? copy.flashBuy : copy.flashSell}
            connectLabel={copy.swapCta}
          />
      </ActionDialogShell>
    </Dialog>
  )
}

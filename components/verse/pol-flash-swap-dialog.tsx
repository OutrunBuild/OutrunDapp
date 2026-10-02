'use client'

import { useState } from 'react'
import { ArrowDown, ArrowLeftRight, Info, Settings2, X } from 'lucide-react'

import type { Locale, FixturePolPosition, FixtureVerse } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { useMockWallet } from '../global/mock-wallet'
import {
  AMOUNT_MAX_CHARS,
  COMPACT_AMOUNT_THRESHOLD,
  SCIENTIFIC_AMOUNT_THRESHOLD,
  SLIPPAGE_PRESETS,
} from './swap-panel'
import { formatAmount } from '../global/signal-ui'
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

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
 * Flash Swap 操作弹窗（2026-09-27 方案 B：YT 移出 Swap 卡，进 Tokenization 页 YT 井）。
 * 机制（yt-flash-swap.md）：POL↔YT 单通道，复用 PT/POL 池流动性；买卖均「指定 YT 数量」——
 * 买=到手 y YT、支付 y−R（R=y PT 的池内变现，上限=Max paid）、卖=收到 y−Q（下限=Min received）。
 * 对手侧展示=uAsset 而非 POL（2026-09-28 用户裁定：理解成本更低）——前端按 POL/uAsset 池价
 * 折算组合，链上仍经 Flash Swap 以 POL 成交。
 * 线性参考价：1 YT ≈ (1−PT/POL 池价)×POL/uAsset 池价（隐含价，1 POL=1 PT+1 YT）；费率=PT/POL 池动态费单次。
 * UI 同构：上块=YT 驱动输入（买卖共用不翻转），下块=uAsset 派生只读；模式条只改标签与保护行方向。
 * 闸门仅 locked（井底门控；解锁后 split/merge 关闭、Flash Swap 随之不可用，转结算赎回）。
 * 设置齿轮只留滑点（合约无 deadline 参数；可选限价+到期属高级项原型不做——同 Split/Merge 裁定口径）。
 * 打开即预填全部 YT 余额（§21 Redeem 先例：空输入 0.00 观感差——2026-09-28 用户裁定 Buy 模式
 * 同样预填看原型效果，示范量=当前持有额）；清空/改数后照常重算，模式切换保留输入。
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
  // 打开即预填全部 YT 余额（两模式同规——空输入 0.00/-- 观感差，2026-09-28 用户裁定）
  const [amount, setAmount] = useState(String(pol.myYt))
  const [slippage, setSlippage] = useState<number>(0.5)
  const [rateInverted, setRateInverted] = useState(false)

  const ytSymbol = `YT-${verse.symbol}`
  const clean = (raw: string) => setAmount(raw.replace(/[^\d.]/g, ''))

  // uAsset 计价隐含价（2026-09-28 用户裁定：对手侧直接用 uAsset，理解成本更低——内部两步：
  // 1 POL=1 PT+1 YT → 1 YT ≈ 1 POL−PT 池市价（yt-flash-swap.md），再按 POL/uAsset 池价折 uAsset；
  // 链上仍经 Flash Swap 以 POL 成交，前端组合 POL/uAsset 池腿）
  const ytPerUAsset = (1 - pol.ptPricePerPol) * pol.marketPricePerPol
  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0 && ytPerUAsset > 0
  // 买卖同为线性参考价：支付/收到 uAsset = YT 数量 × 隐含价（执行价由池状态决定，见杠杆警示）
  const uAssetLeg = valid ? parsed * ytPerUAsset : null
  const protectedLeg =
    uAssetLeg != null
      ? uAssetLeg * (mode === 'buy' ? 1 + slippage / 100 : 1 - slippage / 100)
      : null
  // 大数分层展示：同 swap-panel 口径（≥1e15 紧凑 / ≥1e21 科学记法；裸乘积有 float64 尾噪必须过层）
  const localeTag = locale === 'zh' ? 'zh-CN' : 'en-US'
  const fmtUsd = (value: number) =>
    Math.abs(value) >= SCIENTIFIC_AMOUNT_THRESHOLD
      ? value.toLocaleString(localeTag, { notation: 'scientific', maximumFractionDigits: 2 })
      : Math.abs(value) >= COMPACT_AMOUNT_THRESHOLD
        ? value.toLocaleString(localeTag, { notation: 'compact', maximumFractionDigits: 2 })
        : value.toLocaleString(localeTag, { maximumFractionDigits: 2 })
  // 费率行=用户手续费率样本（相对支付额，fixture 直读不做推导——2026-09-28 用户裁定：
  // 假数据不算精确值；谱系与过高回滚口径见 flashFeeNote ⊙ 与 fixture 注释）
  // ≈$：两侧同为 uAsset 计价 × uAssetUsd
  const uAssetUsdText =
    uAssetUsd == null || uAssetLeg == null ? null : fmtUsd(uAssetLeg * uAssetUsd)
  const ytUsd =
    uAssetUsd == null || !valid ? null : fmtUsd(parsed * ytPerUAsset * uAssetUsd)

  return (
    <Dialog>
      <DialogTrigger data-slot="button" render={<Button variant="outline" size="sm" />}>
        {copy.flashSwap}
      </DialogTrigger>
      <DialogContent className="pol-mint-pop">
        <div className="pol-mint ax-glow-card">
          <header className="pol-mint__head">
            <DialogTitle className="pol-mint__title">{copy.flashSwap}</DialogTitle>
            <div className="pol-mint__controls">
              <Popover>
                <PopoverTrigger
                  className="swap-panel__settings-toggle"
                  aria-label={copy.flashSettingsTitle}
                  render={
                    <button type="button">
                      <Settings2 aria-hidden="true" />
                    </button>
                  }
                />
                <PopoverContent className="swap-settings" side="bottom" align="end">
                  {/* 只留滑点：合约无 deadline；可选限价+到期不做（见组件头注） */}
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

          {/* 模式条：vault 操作卡同款 tab 风 ToggleGroup（买=exact-out 支付上限、卖=到账下限） */}
          <ToggleGroup
            className="vault-actions__bar"
            value={[mode]}
            onValueChange={(value) => {
              const next = value[0] as 'buy' | 'sell' | undefined
              if (!next) return
              setMode(next)
              // Sell 空输入预填全部余额（§21 先例）；Buy 无本金锚不预填
              if (next === 'sell' && amount === '') setAmount(String(pol.myYt))
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
                    onClick={() => clean(String(pol.myYt))}
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
              />
              <div className="swap-panel__token">
                <strong>{ytSymbol}</strong>
              </div>
            </div>
            {ytUsd != null ? <span className="swap-panel__field-usd">≈ ${ytUsd}</span> : null}
          </div>

          <span className="pol-mint__arrow" aria-hidden="true">
            <ArrowDown size={16} />
          </span>

          {/* 下块=uAsset 派生只读（对手侧=uAsset——用户裁定 2026-09-28；内部经 POL/uAsset 池折算）：
              Buy=You pay（上限见 Max paid 行）、Sell=You receive（下限见 Min received） */}
          <div className="swap-panel__field">
            <div className="swap-panel__field-head">
              <span>{mode === 'buy' ? copy.flashYouPay : copy.youReceive}</span>
              <span className="swap-panel__balance">
                {copy.balance}: <span data-numeric>{formatAmount(pol.myUAsset, locale)}</span>
              </span>
            </div>
            <div className="swap-panel__field-row">
              <output className="swap-panel__output numeric-input" data-numeric>
                {uAssetLeg != null ? uAssetLeg.toFixed(6) : '0.00'}
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
                      ? `1 ${verse.raiseAsset} ≈ ${(1 / ytPerUAsset).toFixed(6)} ${ytSymbol}`
                      : `1 ${ytSymbol} ≈ ${ytPerUAsset.toFixed(6)} ${verse.raiseAsset}`
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
                {protectedLeg != null ? `${protectedLeg.toFixed(6)} ${verse.raiseAsset}` : '--'}
              </dd>
            </div>
            <div>
              <dt>
                {copy.flashFeeLabel}
                <SettingsTip text={copy.flashFeeNote} />
              </dt>
              <dd data-numeric>
                {(pol.flashUserFeeRate * 100).toLocaleString(localeTag, { maximumFractionDigits: 2 })}%
              </dd>
            </div>
          </dl>

          {connected ? (
            <Button className="swap-panel__cta" disabled>
              {mode === 'buy' ? copy.flashBuy : copy.flashSell}
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

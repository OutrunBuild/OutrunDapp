'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

import type { Locale, FixturePolPosition, FixtureVerse } from '@/lib/data/fixture-repository'

import { getCopy } from '../global/copy'
import { useMockWallet } from '../global/mock-wallet'
import { formatAmount } from '../global/signal-ui'
import { AMOUNT_MAX_CHARS, amountToInputString, sanitizeAmount } from '../global/amount-input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { FieldError } from '@/components/ui/field'

/**
 * Redeem POL 操作弹窗（2026-09-27：POL 资产卡 Redeem 钮由恒禁用改弹窗）。
 * 机制：销毁 POL 按主池构造 1:1 换回主池（memecoin/uAsset）LP 代币
 * （MemeverseLiquidityImpl.sol:861/888 amountInLP=amountInPOL——:841 注释
 * "1:1 LP amount equals the burned POL amount by main-pool construction"；
 * IMemeverseLiquidityImpl.sol:64）。unwrap=false LP 直转路径非价格敏感
 * （:850-852）→ 合约无滑点/deadline 参数 → 不设设置齿轮（unwrap=true 拆成
 * memecoin+uAsset 两币的 6 参滑点入口不进本窗）。闸门仅 unlocked
 * （:857/884 NotUnlockedStage；OutrunBook lifecycle.md:18/97 From Unlocked）。
 * You receive 行保留：1:1 恒等但输入 POL、输出 LP 代币身份不同（与 Split/Merge
 * 弹窗删输出区的裁定不冲突——非输入复述）；LP 显示符号=主池对口径
 * {MEME}/{uAsset} LP（repository main 池 pair；与池两弹窗 lpSymbol 惯例一致——
 * 链上 ERC20 全池静态同名 symbol "MLP"/name "Memeverse LP"（SwapFacet.sol:313），
 * 按池区分只能靠对口径）；打开即预填全部余额
 * （同 PolRedeemPtYtDialog 2026-09-27 裁定）；CTA 纪律同前：
 * 未连接=Connect Wallet 可点、已连接=操作钮禁用（不伪造成交）。
 */
export function PolRedeemLpDialog({
  locale,
  verse,
  pol,
}: {
  locale: Locale
  verse: FixtureVerse
  pol: FixturePolPosition
}) {
  const copy = getCopy(locale).verseDesk
  const common = getCopy(locale).common
  const { connected, toggle } = useMockWallet()
  const [amount, setAmount] = useState(amountToInputString(pol.myPol))

  const polSymbol = `POL-${verse.symbol}`
  // 主池 LP 对口径（repository main 池 pair [verse.symbol, verse.raiseAsset]）
  const lpSymbol = `${verse.symbol}/${verse.raiseAsset} LP`
  const clean = (raw: string) => setAmount(sanitizeAmount(raw))

  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0
  const overBalance = parsed > pol.myPol
  // 1:1 主池构造恒等（MemeverseLiquidityImpl.sol:861），无样本/槽位分支
  const lpOut = valid ? parsed : null

  return (
    <Dialog>
      {/* data-slot 钉回 button：同 PolMintDialog——主题桥按 [data-slot='button'] 匹配皮肤 */}
      <DialogTrigger data-slot="button" render={<Button variant="outline" size="sm" />}>
        {copy.redeemPol}
      </DialogTrigger>
      <DialogContent className="pol-mint-pop">
        <div className="pol-mint ax-glow-card">
          <header className="pol-mint__head">
            <DialogTitle className="pol-mint__title">{copy.redeemPolDialogTitle}</DialogTitle>
            <div className="pol-mint__controls">
              <DialogClose
                render={
                  <button type="button" className="pol-mint__close" aria-label={common.close} />
                }
              >
                <X aria-hidden="true" size={16} />
              </DialogClose>
            </div>
          </header>

          <div className="swap-panel__field">
            <div className="swap-panel__field-head">
              <span>POL</span>
              <span className="swap-panel__balance">
                {copy.balance}: <span data-numeric>{formatAmount(pol.myPol, locale)}</span>
                <button type="button" className="swap-panel__max" onClick={() => clean(amountToInputString(pol.myPol))}>
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
                maxLength={AMOUNT_MAX_CHARS}
                onChange={(event) => clean(event.target.value)}
                aria-label={`${copy.redeemPol} ${polSymbol}`}
                aria-invalid={overBalance || undefined}
                aria-describedby={overBalance ? 'redeem-lp-balance-error' : undefined}
              />
              <div className="swap-panel__token">
                <strong>{polSymbol}</strong>
              </div>
            </div>
            {overBalance ? (
              <FieldError id="redeem-lp-balance-error">{common.insufficientBalance}</FieldError>
            ) : null}
          </div>

          <dl className="swap-panel__details">
            <div>
              <dt>{copy.youReceive}</dt>
              <dd data-numeric>
                {lpOut != null ? formatAmount(lpOut, locale) : '0.00'} {lpSymbol}
              </dd>
            </div>
          </dl>

          {connected ? (
            <Button className="swap-panel__cta" disabled>
              {copy.redeemPol}
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

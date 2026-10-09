'use client'

import { useId, useState } from 'react'
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
 * Split/Merge POL 操作弹窗（2026-09-26 用户裁定：换向器两钮从恒禁用改可点弹窗；
 * 同日第二轮裁定：Rate 行与输出区删——1:1 恒等，输出=输入的复述，冗余）。
 * 机制：Split=1 POL → 1 PT + 1 YT（IPOLSplitter.sol:102）、Merge=等额销毁 PT 与 YT
 * 换回同额 POL（:104）——严格 1:1，合约无滑点/无 deadline 参数 → 不设设置齿轮；
 * 闸门仅 locked（unlock/settled 后 AlreadyUnlocked——unlocked 态按钮保持禁用不弹窗）；
 * CTA 纪律同 Mint 弹窗：未连接=Connect Wallet 可点切换模拟连接、已连接=操作钮禁用
 * （原型不伪造链上成交，无任何提示文案）。
 * 无估值行（2026-09-26 用户裁定删 split 输入 ≈$ 换算；PT/YT 本就无独立价样本）。
 * Max 零值禁用（2026-10-09 用户裁定「Max 按钮是坏的」）：amountToInputString(0)
 * 返回空串、点击无任何可见效果=死按钮观感——可填额 ≤0 时 Max 转入 disabled
 * （merge 双框=maxMerge=min(PT,YT)、split=POL 余额），余额 0 是诚实禁用态。
 */
export function PolSplitMergeDialog({
  locale,
  verse,
  pol,
  mode,
}: {
  locale: Locale
  verse: FixtureVerse
  pol: FixturePolPosition
  mode: 'split' | 'merge'
}) {
  const copy = getCopy(locale).verseDesk
  const common = getCopy(locale).common
  const { connected, toggle } = useMockWallet()
  // merge 两侧恒等额（合约同一 amount 两侧 burn）→ 单状态驱动双输入框
  const [amount, setAmount] = useState('')
  const balanceErrorId = useId()

  const polSymbol = `POL-${verse.symbol}`
  const ptSymbol = `PT-${verse.symbol}`
  const ytSymbol = `YT-${verse.symbol}`
  const maxMerge = Math.min(pol.myPt, pol.myYt)
  const clean = (raw: string) => setAmount(sanitizeAmount(raw))
  // merge 双输入共享同一 amount → 错误行只挂 YT 框后一处，两输入同标 aria
  const parsed = Number(amount)
  const overBalance = mode === 'split' ? parsed > pol.myPol : parsed > maxMerge

  return (
    <Dialog>
      {/* data-slot 钉回 button：同 PolMintDialog——主题桥按 [data-slot='button'] 匹配皮肤 */}
      <DialogTrigger data-slot="button" render={<Button variant="outline" size="sm" />}>
        {mode === 'split' ? copy.splitPol : copy.mergePol}
      </DialogTrigger>
      <DialogContent className="pol-mint-pop">
        <div className="pol-mint ax-glow-card">
          <header className="pol-mint__head">
            <DialogTitle className="pol-mint__title">
              {mode === 'split' ? copy.splitDialogTitle : copy.mergeDialogTitle}
            </DialogTitle>
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

          {mode === 'split' ? (
            <div className="swap-panel__field">
              <div className="swap-panel__field-head">
                <span>POL</span>
                <span className="swap-panel__balance">
                  {copy.balance}: <span data-numeric>{formatAmount(pol.myPol, locale)}</span>
                  <button type="button" className="swap-panel__max" disabled={pol.myPol <= 0} onClick={() => clean(amountToInputString(pol.myPol))}>
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
                  aria-label={`${copy.splitDialogTitle} ${polSymbol}`}
                  aria-invalid={overBalance || undefined}
                  aria-describedby={overBalance ? balanceErrorId : undefined}
                />
                <div className="swap-panel__token">
                  <strong>{polSymbol}</strong>
                </div>
              </div>
              {overBalance ? (
                <FieldError id={balanceErrorId}>{common.insufficientBalance}</FieldError>
              ) : null}
            </div>
          ) : (
            <>
              <div className="swap-panel__field">
                <div className="swap-panel__field-head">
                  <span>PT</span>
                  <span className="swap-panel__balance">
                    {copy.balance}: <span data-numeric>{formatAmount(pol.myPt, locale)}</span>
                    <button type="button" className="swap-panel__max" disabled={maxMerge <= 0} onClick={() => clean(amountToInputString(maxMerge))}>
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
                    aria-label={`${copy.mergeDialogTitle} ${ptSymbol}`}
                    aria-invalid={overBalance || undefined}
                    aria-describedby={overBalance ? balanceErrorId : undefined}
                  />
                  <div className="swap-panel__token">
                    <strong>{ptSymbol}</strong>
                  </div>
                </div>
              </div>
              <div className="swap-panel__field">
                <div className="swap-panel__field-head">
                  <span>YT</span>
                  <span className="swap-panel__balance">
                    {copy.balance}: <span data-numeric>{formatAmount(pol.myYt, locale)}</span>
                    <button type="button" className="swap-panel__max" disabled={maxMerge <= 0} onClick={() => clean(amountToInputString(maxMerge))}>
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
                    aria-label={`${copy.mergeDialogTitle} ${ytSymbol}`}
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
              </div>
            </>
          )}

          {connected ? (
            <Button className="swap-panel__cta" disabled>
              {mode === 'split' ? copy.splitPol : copy.mergePol}
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

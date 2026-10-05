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
 * Redeem PT/YT 操作弹窗（2026-09-27：unlocked 态换向器改赎回行，两钮触发本窗）。
 * 机制：redeemPT=销毁 PT 按创世锁仓时一次性登记的固定比率兑回 uAsset
 * （POLSplitterUpgradeable.sol:365→_ptToUAsset:470，比率=mainPoolUAssetUsed/mainPoolPOLRawAmount
 * ——MemeverseLiquidityImpl.sol:239，即 fixture uAssetPerPol 口径，非 1:1，2026-09-25 用户裁定）；
 * redeemYT=销毁 YT 按份额领结算剩余池（uAsset+memecoin 两币，:387，每份率=池×份额/流通 YT）。
 * 闸门仅 unlocked（unlockFromLocked 自动 settle——MemeverseSettlementImpl.sol:536-537；
 * locked 态不渲染赎回行，换向器仍在）。合约无滑点/deadline → 不设设置齿轮；
 * 输出非 1:1 恒等（与 Split/Merge 弹窗删输出区的裁定不冲突）→ 2026-09-27 第三轮参照图
 * 裁定改双框：输入框（label=burnLabel）+ Receive 独立框（同 swap 双框语言：只读
 * `output`+代币章）——PT=单框（uAsset 章）、YT=双框（memecoin 主腿框+uAsset 框，
 * 与井读数同序），You receive 明细行随之删除（信息不重复）；rate 缺样本→框内 ax-slot。
 * CTA 纪律同 Split/Merge：未连接=Connect Wallet 可点、已连接=操作钮禁用（不伪造成交）。
 */
export function PolRedeemPtYtDialog({
  locale,
  verse,
  pol,
  mode,
  price,
  uAssetUsd,
}: {
  locale: Locale
  verse: FixtureVerse
  pol: FixturePolPosition
  mode: 'pt' | 'yt'
  /** 主池价（trade.tokenStats.price）：YT memecoin 腿折美元用；null=美元行不渲染 */
  price: number | null
  /** uAsset 美元样本（assets usdSample）：各腿美元行用；null=美元行不渲染 */
  uAssetUsd: number | null
}) {
  const copy = getCopy(locale).verseDesk
  const common = getCopy(locale).common
  const { connected, toggle } = useMockWallet()
  // 打开即预填全部余额（2026-09-27 用户裁定：空输入 You receive 摆 0.00 观感差，
  // 打开就用样本余额示全额兑付预估；用户清空/改数后照常重算）
  const [amount, setAmount] = useState(mode === 'pt' ? amountToInputString(pol.myPt) : amountToInputString(pol.myYt))
  const receiveLabelId = useId()

  const ptSymbol = `PT-${verse.symbol}`
  const ytSymbol = `YT-${verse.symbol}`
  const clean = (raw: string) => setAmount(sanitizeAmount(raw))

  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0
  const ptOut = valid ? parsed * pol.uAssetPerPol : null
  const ytUAssetOut = valid && pol.ytRedeemUAssetPerUnit != null ? parsed * pol.ytRedeemUAssetPerUnit : null
  const ytMemeOut = valid && pol.ytRedeemMemecoinPerUnit != null ? parsed * pol.ytRedeemMemecoinPerUnit : null
  // 美元回声（2026-09-27 用户裁定补：每 Receive 框下 ≈$ 行，与卡片井读数同源换算——
  // uAsset 腿×uAssetUsd、memecoin 腿×主池价×uAssetUsd；样本缺→不渲染）
  const ptUsd = ptOut != null && uAssetUsd != null ? ptOut * uAssetUsd : null
  const ytUAssetUsd = ytUAssetOut != null && uAssetUsd != null ? ytUAssetOut * uAssetUsd : null
  const ytMemeUsd =
    ytMemeOut != null && price != null && uAssetUsd != null ? ytMemeOut * price * uAssetUsd : null

  const balance = mode === 'pt' ? pol.myPt : pol.myYt
  const tokenSymbol = mode === 'pt' ? ptSymbol : ytSymbol
  const overBalance = parsed > balance

  return (
    <Dialog>
      {/* data-slot 钉回 button：同 PolMintDialog——主题桥按 [data-slot='button'] 匹配皮肤 */}
      <DialogTrigger data-slot="button" render={<Button variant="outline" size="sm" />}>
        {mode === 'pt' ? copy.redeemPt : copy.redeemYt}
      </DialogTrigger>
      <DialogContent className="pol-mint-pop">
        <div className="pol-mint ax-glow-card">
          <header className="pol-mint__head">
            <DialogTitle className="pol-mint__title">
              {mode === 'pt' ? copy.redeemPt : copy.redeemYt}
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

          <div className="swap-panel__field">
            <div className="swap-panel__field-head">
              <span>{copy.burnLabel}</span>
              <span className="swap-panel__balance">
                {copy.balance}: <span data-numeric>{formatAmount(balance, locale)}</span>
                <button type="button" className="swap-panel__max" onClick={() => clean(amountToInputString(balance))}>
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
                aria-label={`${mode === 'pt' ? copy.redeemPt : copy.redeemYt} ${tokenSymbol}`}
                aria-invalid={overBalance || undefined}
                aria-describedby={overBalance ? 'redeem-py-balance-error' : undefined}
              />
              <div className="swap-panel__token">
                <strong>{tokenSymbol}</strong>
              </div>
            </div>
            {overBalance ? (
              <FieldError id="redeem-py-balance-error">{common.insufficientBalance}</FieldError>
            ) : null}
          </div>

          {/* Receive 收账框（2026-09-27 参照图裁定：同输入框款式、只读 output+代币章）：
              PT=单腿；YT=双腿合一个框（memecoin 主腿在前与井读数同序，行间 hairline）——
              单 Receive 标签管两腿，不重复标也不留空标签行 */}
          {mode === 'pt' ? (
            <div className="swap-panel__field" role="group" aria-labelledby={receiveLabelId}>
              <div className="swap-panel__field-head">
                <span id={receiveLabelId}>{copy.receiveLabel}</span>
              </div>
              <div className="swap-panel__field-row">
                <output
                  className="swap-panel__output numeric-input"
                  data-numeric
                  aria-label={`${copy.receiveLabel} ${verse.raiseAsset}`}
                >
                  {ptOut != null ? formatAmount(ptOut, locale) : '0.00'}
                </output>
                <div className="swap-panel__token">
                  <strong>{verse.raiseAsset}</strong>
                </div>
              </div>
              {ptUsd != null ? (
                <span className="swap-panel__field-usd">≈ ${formatAmount(ptUsd, locale)}</span>
              ) : null}
            </div>
          ) : (
            <div className="swap-panel__field" role="group" aria-labelledby={receiveLabelId}>
              <div className="swap-panel__field-head">
                <span id={receiveLabelId}>{copy.receiveLabel}</span>
              </div>
              <div className="swap-panel__field-row">
                <output
                  className="swap-panel__output numeric-input"
                  data-numeric
                  aria-label={`${copy.receiveLabel} ${verse.symbol}`}
                >
                  {pol.ytRedeemMemecoinPerUnit == null ? (
                    <span className="ax-slot">{copy.onChainSlot}</span>
                  ) : ytMemeOut != null ? (
                    formatAmount(ytMemeOut, locale)
                  ) : (
                    '0.00'
                  )}
                </output>
                <div className="swap-panel__token">
                  <strong>{verse.symbol}</strong>
                </div>
              </div>
              {ytMemeUsd != null ? (
                <span className="swap-panel__field-usd">≈ ${formatAmount(ytMemeUsd, locale)}</span>
              ) : null}
              <div className="swap-panel__field-row">
                <output
                  className="swap-panel__output numeric-input"
                  data-numeric
                  aria-label={`${copy.receiveLabel} ${verse.raiseAsset}`}
                >
                  {pol.ytRedeemUAssetPerUnit == null ? (
                    <span className="ax-slot">{copy.onChainSlot}</span>
                  ) : ytUAssetOut != null ? (
                    formatAmount(ytUAssetOut, locale)
                  ) : (
                    '0.00'
                  )}
                </output>
                <div className="swap-panel__token">
                  <strong>{verse.raiseAsset}</strong>
                </div>
              </div>
              {ytUAssetUsd != null ? (
                <span className="swap-panel__field-usd">≈ ${formatAmount(ytUAssetUsd, locale)}</span>
              ) : null}
            </div>
          )}

          {connected ? (
            <Button className="swap-panel__cta" disabled>
              {mode === 'pt' ? copy.redeemPt : copy.redeemYt}
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

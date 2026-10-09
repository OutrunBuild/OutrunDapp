'use client'

/**
 * Get UUSD 弹窗（2026-10-09 口径终值回归 PSM——用户核对合约后修正：UUSD 只能经 PSM
 * 获得，生息资产直接走 stakeForGenesis 不经 UUSD）：PSM 面值兑换双向（Get=USDC→UUSD
 * mint / Back=UUSD→USDC redeem），机制 source-map S8（面值 1:1、tin/tout 费率、mint
 * 受 stockCap headroom、无滑点/deadline 参数→不设设置齿轮）。原语复用
 * global/action-dialogs；CTA 口径=未连接 Connect 可点切换模拟连接、已连接动作钮仅随
 * 输入门控（无 onClick，不伪造成交）——ConvertDialog 同款。
 */
import { useState } from 'react'
import type { ReactNode } from 'react'

import type { FixtureFaucet, Locale } from '@/lib/data/fixture-repository'

import { ActionDialogShell, AmountField, DetailRows, DialogCta } from '../global/action-dialogs'
import { getCopy } from '../global/copy'
import { useMockWallet } from '../global/mock-wallet'
import { formatAmount, formatPercent } from '../global/signal-ui'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'

export function FaucetSwapDialog({ locale, swap }: { locale: Locale; swap: FixtureFaucet['swap'] }) {
  const copy = getCopy(locale).faucet
  const { connected, toggle } = useMockWallet()
  const [mode, setMode] = useState<'get' | 'back'>('get')
  const [amount, setAmount] = useState('')
  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0
  const fee = mode === 'get' ? swap.feeIn : swap.feeOut
  const balance = mode === 'get' ? swap.myReserve : swap.myUAsset
  const paySymbol = mode === 'get' ? swap.reserveSymbol : swap.uAssetSymbol
  const outSymbol = mode === 'get' ? swap.uAssetSymbol : swap.reserveSymbol

  return (
    <Dialog>
      <DialogTrigger data-slot="button" render={<Button className="ax-ghost-cta" size="sm" />}>
        {copy.swapCta}
      </DialogTrigger>
      <ActionDialogShell title={copy.swapTitle} closeLabel={getCopy(locale).common.close}>
        <div className="pf-dialog__chips" role="group">
          <button type="button" data-selected={mode === 'get' || undefined} onClick={() => setMode('get')}>
            {copy.modeGet}
          </button>
          <button type="button" data-selected={mode === 'back' || undefined} onClick={() => setMode('back')}>
            {copy.modeBack}
          </button>
        </div>
        <AmountField
          locale={locale}
          label={copy.amount}
          balance={balance}
          balanceLabel={copy.balance}
          maxLabel={copy.max}
          value={amount}
          onValue={setAmount}
          tokenSymbol={paySymbol}
          ariaLabel={`${copy.amount} (${paySymbol})`}
        />
        <DetailRows
          rows={[
            [
              copy.rate,
              <span key="rate" data-numeric>
                {mode === 'get'
                  ? `1 ${swap.reserveSymbol} = 1 ${swap.uAssetSymbol}`
                  : `1 ${swap.uAssetSymbol} = 1 ${swap.reserveSymbol}`}
              </span>,
            ],
            [
              copy.fee,
              fee == null ? (
                '--'
              ) : (
                <span key="fee" data-numeric>
                  {formatPercent(fee * 100, locale)}%
                </span>
              ),
            ],
            [
              copy.youReceive,
              valid && fee != null ? (
                <span key="receive" data-numeric>
                  {formatAmount(parsed * (1 - fee), locale)} {outSymbol}
                </span>
              ) : (
                '--'
              ),
            ],
            // 铸造额度余量只约束 Get（mint）方向（PSM stockCap，ConvertDialog 同口径）
            ...(mode === 'get'
              ? ([
                  [
                    copy.headroom,
                    swap.headroom == null ? (
                      '--'
                    ) : (
                      <span key="headroom" data-numeric>
                        {formatAmount(swap.headroom, locale)} {swap.uAssetSymbol}
                      </span>
                    ),
                  ],
                ] as Array<[string, ReactNode]>)
              : []),
          ]}
        />
        <DialogCta
          locale={locale}
          connected={connected}
          onConnect={toggle}
          label={mode === 'get' ? copy.ctaGet : copy.ctaBack}
          disabled={!valid}
        />
      </ActionDialogShell>
    </Dialog>
  )
}

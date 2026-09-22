'use client'

import { useState } from 'react'

import type { Locale } from '@/lib/data/prototype-repository'

import { getCopy } from './copy'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

type VaultMode = 'stake' | 'redeem' | 'withdraw'

/**
 * Yield Vault 操作区（Q8：demo 原词 Stake/Redeem/Withdraw + 待赎回/可提取状态列表；
 * Q9：委托内嵌存入表单，默认自己）。原型只演示 ViewModel：CTA 禁用、不伪造链上成功。
 */
export function VaultActions({
  locale,
  symbol,
  shareSymbol,
  assetsPerShare,
  claimableTotal,
  delegatee,
}: {
  locale: Locale
  symbol: string
  /** 份额符号 = s + Memecoin 符号 */
  shareSymbol: string
  assetsPerShare: number
  claimableTotal: number
  delegatee: string
}) {
  const copy = getCopy(locale).verseDesk
  const [mode, setMode] = useState<VaultMode>('stake')
  const [amount, setAmount] = useState('')
  const [delegateSelf, setDelegateSelf] = useState(true)

  const parsed = Number(amount)
  const valid = Number.isFinite(parsed) && parsed > 0
  const stakeOut = valid ? parsed / assetsPerShare : null
  const redeemOut = valid ? parsed * assetsPerShare : null

  return (
    <div className="vault-actions">
      <ToggleGroup
        className="vault-actions__bar"
        value={[mode]}
        onValueChange={(value) => {
          if (value[0]) setMode(value[0] as VaultMode)
        }}
      >
        <ToggleGroupItem value="stake">{copy.stakeTab}</ToggleGroupItem>
        <ToggleGroupItem value="redeem">{copy.redeemTab}</ToggleGroupItem>
        <ToggleGroupItem value="withdraw">{copy.withdrawTab}</ToggleGroupItem>
      </ToggleGroup>

      {mode === 'stake' ? (
        <div className="vault-actions__form">
          <div className="vault-actions__field">
            <div className="vault-actions__field-head">
              <span>{copy.amount}</span>
              <span>{copy.balance}: --</span>
            </div>
            <div className="vault-actions__row">
              <Input
                className="numeric-input"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ''))}
                aria-label={`${copy.amount} (${symbol})`}
              />
              <strong className="vault-actions__token">{symbol}</strong>
            </div>
          </div>
          <div className="vault-actions__field">
            <span>{copy.delegateTo}</span>
            <div className="vault-actions__delegate">
              <button
                type="button"
                className="vault-actions__delegate-option"
                data-selected={delegateSelf}
                onClick={() => setDelegateSelf(true)}
              >
                {copy.delegateSelf}
              </button>
              <button
                type="button"
                className="vault-actions__delegate-option"
                data-selected={!delegateSelf}
                onClick={() => setDelegateSelf(false)}
              >
                {copy.delegateCustom}
              </button>
            </div>
            <p className="panel-note">{copy.delegateNote}</p>
          </div>
          <div className="vault-actions__preview" data-numeric>
            <span>{copy.youReceive}</span>
            <span>{stakeOut != null ? `${stakeOut.toFixed(6)} ${shareSymbol}` : `0.00 ${shareSymbol}`}</span>
          </div>
          <Button disabled title={copy.onChainSlot}>
            {copy.stakeCta.replace('{symbol}', symbol)}
          </Button>
        </div>
      ) : null}

      {mode === 'redeem' ? (
        <div className="vault-actions__form">
          <div className="vault-actions__field">
            <div className="vault-actions__field-head">
              <span>{copy.amount}</span>
              <span>
                {copy.balance}: -- {shareSymbol}
              </span>
            </div>
            <div className="vault-actions__row">
              <Input
                className="numeric-input"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ''))}
                aria-label={`${copy.amount} (${shareSymbol})`}
              />
              <strong className="vault-actions__token">{shareSymbol}</strong>
            </div>
          </div>
          <div className="vault-actions__preview" data-numeric>
            <span>{copy.youReceiveAfter24h}</span>
            <span>{redeemOut != null ? `${redeemOut.toFixed(6)} ${symbol}` : `0.00 ${symbol}`}</span>
          </div>
          <p className="panel-note">{copy.redeemNote}</p>
          <Button disabled title={copy.onChainSlot}>
            {copy.redeemCta.replace('{share}', shareSymbol)}
          </Button>
        </div>
      ) : null}

      {mode === 'withdraw' ? (
        <div className="vault-actions__form">
          <div className="vault-actions__preview" data-numeric>
            <span>{copy.totalAvailable}</span>
            <span>
              {claimableTotal.toFixed(2)} {symbol}
            </span>
          </div>
          <p className="panel-note">{copy.withdrawNote}</p>
          <Button disabled title={copy.onChainSlot}>
            {copy.withdrawAll.replace('{symbol}', symbol)}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

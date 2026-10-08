'use client'

/**
 * 交易弹窗共用原语（2026-10-08 由 portfolio-dialogs.tsx 上提共享，五弹窗复制粘贴
 * 收敛 P0-2）：ActionDialogShell（.pol-mint 卡壳）/ AmountField（.swap-panel__field
 * 族金额字段）/ DetailRows（明细行组）/ DialogCta（未连接=Connect 可点、已连接=
 * 动作钮禁用——原型 ViewModel 不伪造链上成交）。CSS 语言全复用 verse 页既有
 * class（components.md「Mint POL 弹窗」行），React 层唯一实现居本文件；消费方=
 * portfolio 弹窗族 + verse 交易弹窗族（mint/加池/移除池/flash-swap）。
 */
import { useId } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import type { Locale } from '@/lib/data/fixture-repository'

import { getCopy } from './copy'
import { formatAmount } from './signal-ui'
import { AMOUNT_MAX_CHARS, amountToInputString, sanitizeAmount } from './amount-input'
import { Button } from '@/components/ui/button'
import { DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

/** 弹窗壳：标题 + 工具位（可选，✕ 左侧——设置齿轮等）+ 内容（复用 .pol-mint 卡签名） */
export function ActionDialogShell({
  title,
  closeLabel,
  toolbar,
  children,
}: {
  title: string
  closeLabel: string
  toolbar?: ReactNode
  children: React.ReactNode
}) {
  return (
    <DialogContent className="pol-mint-pop">
      <div className="pol-mint ax-glow-card">
        <header className="pol-mint__head">
          <DialogTitle className="pol-mint__title">{title}</DialogTitle>
          <div className="pol-mint__controls">
            {toolbar}
            <DialogClose render={<button type="button" className="pol-mint__close" aria-label={closeLabel} />}>
              <X aria-hidden="true" size={16} />
            </DialogClose>
          </div>
        </header>
        {children}
      </div>
    </DialogContent>
  )
}

/** 金额字段（.swap-panel__field 族）：标签 + 余额/Max + 输入 + 右侧代币符号 */
export function AmountField({
  locale,
  label,
  balance,
  balanceLabel,
  maxLabel,
  value,
  onValue,
  tokenSymbol,
  ariaLabel,
}: {
  locale: Locale
  label: string
  balance: number | null
  balanceLabel: string
  maxLabel: string
  value: string
  onValue: (next: string) => void
  tokenSymbol: string
  ariaLabel: string
}) {
  const errorId = useId()
  // 余额不足：balance 已知且输入>余额（2026-10-04 用户裁定文案一行短句、不带数值）
  const parsed = Number(value)
  const overBalance = balance != null && Number.isFinite(parsed) && parsed > balance
  return (
    <div className="swap-panel__field">
      <div className="swap-panel__field-head">
        <span>{label}</span>
        <span className="swap-panel__balance">
          {/* 代币符号已在输入框右侧展示，余额行不重复（2026-10-04 用户裁定） */}
          {`${balanceLabel}: ${balance == null ? '--' : formatAmount(balance, locale)}`}
          {balance != null && balance > 0 ? (
            <button
              type="button"
              className="swap-panel__max"
              onClick={() => onValue(amountToInputString(balance))}
            >
              {maxLabel}
            </button>
          ) : null}
        </span>
      </div>
      <div className="swap-panel__field-row">
        <Input
          className="numeric-input"
          inputMode="decimal"
          placeholder="0.00"
          value={value}
          maxLength={AMOUNT_MAX_CHARS}
          aria-label={ariaLabel}
          aria-invalid={overBalance || undefined}
          aria-describedby={overBalance ? errorId : undefined}
          onChange={(event) => onValue(sanitizeAmount(event.target.value))}
        />
        <div className="swap-panel__token">
          <strong>{tokenSymbol}</strong>
        </div>
      </div>
      {overBalance ? (
        <FieldError id={errorId}>{getCopy(locale).common.insufficientBalance}</FieldError>
      ) : null}
    </div>
  )
}

/** 详情行组（.swap-panel__details） */
export function DetailRows({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="swap-panel__details">
      {rows.map(([term, data]) => (
        <div key={term}>
          <dt>{term}</dt>
          <dd>{data}</dd>
        </div>
      ))}
    </dl>
  )
}

/** 主 CTA：未连接=Connect（可点）；已连接=动作钮（默认禁用——不伪造成交；disabled
 * 传条件谓词做门控，如 PSM Convert 的余额/额度谓词；title 挂已连接禁用态悬浮说明） */
export function DialogCta({
  locale,
  connected,
  onConnect,
  label,
  disabled = true,
  title,
  connectLabel,
}: {
  locale: Locale
  connected: boolean
  onConnect: () => void
  label: string
  /** 已连接动作钮的禁用谓词（缺省=恒禁用，原型口径） */
  disabled?: boolean
  /** 已连接动作钮的 title（悬浮说明，如 swap 卡「原型不发送交易」注） */
  title?: string
  /** 未连接钮文案覆写（缺省=common.connect；verse 交易语境用 verseDesk.swapCta） */
  connectLabel?: string
}) {
  return connected ? (
    <Button className="swap-panel__cta" disabled={disabled} title={title}>
      {label}
    </Button>
  ) : (
    <Button className="swap-panel__cta" onClick={onConnect}>
      {connectLabel ?? getCopy(locale).common.connect}
    </Button>
  )
}

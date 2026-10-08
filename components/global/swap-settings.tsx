'use client'

/**
 * Swap 设置层（滑点/截止齿轮 Popover）——swap 卡与 verse 交易弹窗族（Mint POL/
 * 加池/移除池/Flash Swap）共用的唯一实现。2026-10-08 由五处逐份复制收敛（同位置
 * 先例=fmtUsd/sanitizeAmount 收敛，component-contract §1）；行为契约=§17/§22/
 * §24/§25/§26。受控口径（§25 拍板 A 的机制落地）：value 存 string 原样展示——
 * 键入中间态（尾点/空串）不经 Number() 落盘，旧 number 状态会把 0.25 静默吞成 25、
 * 非整分钟就地报错不可达；数值推导在消费方经 slippageToNumber/deadlineToNumber。
 * error id 内走 useId（池弹窗每卡一实例防相撞，§22 口径）。
 */
import { useId } from 'react'
import { Info, Settings2 } from 'lucide-react'

import type { Locale } from '@/lib/data/fixture-repository'

import { getCopy } from './copy'
import { sanitizeAmount } from './amount-input'
import {
  DEADLINE_PRESETS,
  SLIPPAGE_PRESETS,
  deadlineToNumber,
  getSlippageIssue,
  isWholeMinutes,
  slippageErrorCopyKey,
  slippageToNumber,
} from './slippage-input'
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** 设置项/明细行标签旁的解释气泡（复用 create 页 ⊙ 提示语言；明细行语境同样可用） */
export function SettingsTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger className="create-info" aria-label={text}>
        <Info aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  )
}

/** 齿轮设置层（受控组件）：slippage/deadline 值均为展示原样 string、预设点击回写
 * String(preset)；deadline 组省略=不渲染截止行（合约无 deadline 参数的场景，如
 * Flash Swap——可选限价+到期不做，同其组件头注口径） */
export function SwapSettings({
  locale,
  settingsLabel,
  slippageTip,
  slippageValue,
  onSlippageValue,
  deadline,
}: {
  locale: Locale
  /** 齿轮 aria-label（各语境定名：swap 卡/Mint/加池/移除池…） */
  settingsLabel: string
  slippageTip: string
  slippageValue: string
  onSlippageValue: (next: string) => void
  deadline?: {
    tip: string
    value: string
    onValue: (next: string) => void
  }
}) {
  const copy = getCopy(locale).verseDesk
  const slippageErrorId = useId()
  const deadlineErrorId = useId()
  const slippageIssue = getSlippageIssue(slippageToNumber(slippageValue))
  const deadlineValid = deadline != null ? isWholeMinutes(deadlineToNumber(deadline.value)) : true

  return (
    <Popover>
      <PopoverTrigger
        className="swap-panel__settings-toggle"
        aria-label={settingsLabel}
        render={
          <button type="button">
            <Settings2 aria-hidden="true" />
          </button>
        }
      />
      <PopoverContent className="swap-settings" side="bottom" align="end">
        <div className="swap-settings__row">
          <span className="swap-settings__label">
            {copy.slippageTolerance}
            <SettingsTip text={slippageTip} />
          </span>
          <div className="swap-settings__options">
            {SLIPPAGE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                data-selected={slippageToNumber(slippageValue) === preset}
                onClick={() => onSlippageValue(String(preset))}
              >
                {preset}%
              </button>
            ))}
            <span className="swap-settings__unit">
              <Input
                className="swap-settings__custom numeric-input"
                inputMode="decimal"
                aria-label={`${copy.slippageTolerance} %`}
                aria-invalid={slippageIssue != null || undefined}
                aria-describedby={slippageIssue != null ? slippageErrorId : undefined}
                value={slippageValue}
                onChange={(event) => onSlippageValue(sanitizeAmount(event.target.value))}
              />
              <b aria-hidden="true">%</b>
            </span>
          </div>
          {slippageIssue != null ? (
            <FieldError id={slippageErrorId}>
              {copy[slippageErrorCopyKey(slippageIssue)]}
            </FieldError>
          ) : null}
        </div>
        {deadline != null ? (
          <div className="swap-settings__row">
            <span className="swap-settings__label">
              {copy.transactionDeadline}
              <SettingsTip text={deadline.tip} />
            </span>
            <div className="swap-settings__options">
              {DEADLINE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  data-selected={deadlineToNumber(deadline.value) === preset}
                  onClick={() => deadline.onValue(String(preset))}
                >
                  {preset}
                </button>
              ))}
              <span className="swap-settings__unit">
                <Input
                  className="swap-settings__custom numeric-input"
                  inputMode="numeric"
                  aria-label={`${copy.transactionDeadline} min`}
                  aria-invalid={!deadlineValid || undefined}
                  aria-describedby={!deadlineValid ? deadlineErrorId : undefined}
                  value={deadline.value}
                  onChange={(event) => deadline.onValue(sanitizeAmount(event.target.value))}
                />
                <b aria-hidden="true">min</b>
              </span>
            </div>
            {!deadlineValid ? (
              <FieldError id={deadlineErrorId}>{copy.deadlineWholeMinutes}</FieldError>
            ) : null}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

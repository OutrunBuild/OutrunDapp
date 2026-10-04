/**
 * 滑点设置项校验（swap-panel 设置层；component-contract.md §25）：
 * 行业惯例接受域 0.01%–50%——下界挡零容忍（0 时任何价格微动都回退）、
 * 上界挡推导值转负（minReceived = quote×(1−s/100)，s>100 得负数代币）。
 * 越界不静默夹紧：返回类别由组件层映射 FieldError 就地报错，推导行退 '--' 槽位。
 */
export const SLIPPAGE_MIN = 0.01
export const SLIPPAGE_MAX = 50

export type SlippageIssue = 'below-min' | 'above-max'

export function getSlippageIssue(value: number): SlippageIssue | null {
  if (!Number.isFinite(value) || value < SLIPPAGE_MIN) return 'below-min'
  if (value > SLIPPAGE_MAX) return 'above-max'
  return null
}

/** 越界类别 → copy.verseDesk 文案键（类别-文案映射的唯一实现点，随本模块单测） */
export function slippageErrorCopyKey(issue: SlippageIssue): 'slippageTooLow' | 'slippageTooHigh' {
  return issue === 'below-min' ? 'slippageTooLow' : 'slippageTooHigh'
}

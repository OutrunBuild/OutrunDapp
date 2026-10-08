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

/** 滑点/截止预设档（R-06：常态默认 0.5%；demo 参照档位 0.1/0.5/1.0 与 10/20/30 分钟）。
 * 2026-10-08 由 swap-panel.tsx 迁入（组件文件不再充当共享常量模块）；消费方=
 * 共享设置层 components/global/swap-settings.tsx */
export const SLIPPAGE_PRESETS = [0.1, 0.5, 1] as const
export const DEADLINE_PRESETS = [10, 20, 30] as const

/** 交易截止时间整分钟校验（2026-10-03 拍板 A：全站整分钟数，自定义输入保留小数点
 * 以便就地报错——不再剥点把 1.5 静默变 15；空/0 仍回退 1 分钟）；
 * 2026-10-08 由 swap-panel.tsx 迁入，§17/§22/§24 弹窗同构设置层复用 */
export function isWholeMinutes(value: number) {
  return Number.isInteger(value) && value > 0
}

/** §25 设置层受控口径（2026-10-08 P1-1 修）：受控 state 存 string 原样展示——尾点/
 * 空串等键入中间态不经 Number() 落盘（number 状态会吞点：0. 敲成后 0、0.25 静默
 * 变 25），数值只在推导处经此转数。空/非法回退沿用既有行为：滑点→0（零容忍报错）、
 * 截止→1 分钟 */
export function slippageToNumber(value: string) {
  const next = Number(value)
  return Number.isFinite(next) && next >= 0 ? next : 0
}

export function deadlineToNumber(value: string) {
  const next = Number(value)
  return Number.isFinite(next) && next > 0 ? next : 1
}

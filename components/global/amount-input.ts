/**
 * 金额输入清洗（component-contract.md §1 AmountInput 键盘行口径的唯一实现）：
 * 白名单 [0-9.] 之外全剥，且多个小数点折叠为首个点（「1.2.3」→「1.23」），
 * 保证下游 Number() 不会拿到 NaN 静默变 0.00。2026-10-03 评审裁决由
 * participation-panel 的就地实现提升为共享，统一全部金额输入口径；
 * 滑点/deadline 设置项已迁移 §25 设置层校验口径（2026-10-03 拍板：deadline 整分钟数，
 * 输入留点走 sanitizeAmount 以便非整分钟就地报错——swap-panel isWholeMinutes，不再剥点静默改写）。
 */
export function sanitizeAmount(value: string) {
  const cleaned = value.replace(/[^\d.]/g, '')
  const [whole, ...fraction] = cleaned.split('.')
  return fraction.length ? `${whole}.${fraction.join('')}` : whole
}

/** 金额输入 40 字符上限（§1 大数边界：float64 有效数字 ~17 位已覆盖，
 * 2026-09-23 demo 参照页 180 位数字溢出教训） */
export const AMOUNT_MAX_CHARS = 40

/** 余额预填/Max 填充口径：6 位精度十进制整串（裸 String() 对 <1e-6 的值吐科学
 * 计数法，如 '1e-7' 经清洗会被错切成 '17'）；0/非有限值返回空串。
 * 池/铸造弹窗的 fmtDerived 就地实现 2026-10-03 提升共享 */
export function amountToInputString(value: number) {
  return Number.isFinite(value) && value > 0 ? String(Number(value.toFixed(6))) : ''
}

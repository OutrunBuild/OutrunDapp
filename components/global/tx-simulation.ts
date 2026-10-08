'use client'

import { useEffect, useRef, useState } from 'react'

import type { TxState } from './tx-status'

/**
 * 交易签名模拟驱动（component-contract §8，state-matrix T4→T5→T6）：T4 等待签名
 * ≈1.6s → T5 上链确认 ≈1.2s → T6 已确认；原型无钱包，由前端定时推进，卸载清挂起
 * 定时器。2026-10-08 由 create-form/participation-panel 两处逐份内联复制收敛
 * （同 fmtUsd/swap-settings 收敛先例）；T6 展示差异留在调用方（注册流=onConfirmed
 * 自动弹窗、参与流=内联回声块——§8 用户裁定 2026-10-01）。
 */
export function useTxSimulation(onConfirmed?: () => void) {
  const [txState, setTxState] = useState<TxState>('idle')
  const txTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => txTimers.current.forEach(clearTimeout), [])
  // 抵达 T6 时回调取最新渲染闭包（定时器捕获首帧回调会读到过期值）
  const onConfirmedRef = useRef(onConfirmed)
  onConfirmedRef.current = onConfirmed

  function beginSigning() {
    setTxState('signing')
    txTimers.current.push(setTimeout(() => setTxState('confirming'), 1600))
    txTimers.current.push(
      setTimeout(() => {
        setTxState('confirmed')
        onConfirmedRef.current?.()
      }, 2800),
    )
  }

  /** 返回修改等场景回 idle */
  function resetTx() {
    setTxState('idle')
  }

  return { txState, beginSigning, resetTx }
}

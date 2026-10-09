'use client';

import { useEffect, useRef, useState } from 'react';

// architecture §7 统一交易状态序列（原型裁剪见 FLOW_STATE_GROUPS）
export const FLOW_STATES = [
  'preparing',
  'preflighting',
  'awaiting-authorization',
  'simulating',
  'awaiting-signature',
  'submitted',
  'confirming',
  'confirmed',
  'reverted',
  'replaced',
  'cancelled',
] as const;

export type FlowState = (typeof FLOW_STATES)[number];

/** 原型展示分组（TxStatus 三段条）：signing=T4 等签名+之前准备段、confirming=T5、confirmed=T6 */
export type FlowDisplayGroup =
  'idle' | 'signing' | 'confirming' | 'confirmed' | 'reverted' | 'cancelled';

export type FlowOutcome = 'confirmed' | 'reverted' | 'user-rejected';

/** 各状态的展示分组映射（消费方 TxStatus 按 group 高亮三段条） */
export function displayGroupOf(state: FlowState): FlowDisplayGroup {
  if (state === 'confirmed') return 'confirmed';
  if (state === 'reverted') return 'reverted';
  if (state === 'cancelled') return 'cancelled';
  if (state === 'submitted' || state === 'confirming') return 'confirming';
  return 'signing';
}

/** 非终态集合（终态=confirmed/reverted/cancelled） */
function isTerminal(state: FlowState): boolean {
  return state === 'confirmed' || state === 'reverted' || state === 'cancelled';
}

/** 原型演示的推进节奏（ms）：真实钱包接入后由事件驱动替换 */
const STAGE_MS: Partial<Record<FlowState, number>> = {
  preparing: 500,
  preflighting: 500,
  'awaiting-authorization': 600,
  simulating: 600,
  'awaiting-signature': 700,
  submitted: 500,
  confirming: 900,
};

/**
 * 统一流程状态机（步骤 6；architecture §7 序列的原型驱动）。
 * 原型无钱包：begin() 后按 STAGE_MS 定时推进；outcome 决定终态
 * （confirmed=成功 / reverted=链上回退 / user-rejected=拒签）。
 * 纯函数核心 advance(state, outcome) 导出供单测；卸载清挂起定时器。
 */
export function advance(state: FlowState, outcome: FlowOutcome): FlowState | null {
  if (isTerminal(state)) return null;
  // 拒签只发生在等待签名阶段
  if (outcome === 'user-rejected') {
    return state === 'awaiting-signature' ? 'cancelled' : null;
  }
  // 回退最早发生在提交后（签名前 reverted 无意义——尚未上链，照常推进）
  if (outcome === 'reverted' && state === 'submitted') return 'reverted';
  return nextProgress(state);
}

function nextProgress(state: FlowState): FlowState {
  const i = FLOW_STATES.indexOf(state);
  return i >= 0 && i + 1 < FLOW_STATES.length ? FLOW_STATES[i + 1] : 'confirmed';
}

export function useFlowMachine(outcome: FlowOutcome = 'confirmed') {
  const [state, setState] = useState<FlowState | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const outcomeRef = useRef(outcome);
  outcomeRef.current = outcome;

  function begin() {
    timers.current.forEach(clearTimeout);
    let current: FlowState = 'preparing';
    setState(current);
    while (!isTerminal(current)) {
      const stage: FlowState = current;
      timers.current.push(
        setTimeout(() => {
          const next = advance(stage, outcomeRef.current);
          if (next) {
            current = next;
            setState(next);
          }
        }, STAGE_MS[stage] ?? 400),
      );
      current = nextProgress(current);
    }
  }

  function reset() {
    timers.current.forEach(clearTimeout);
    setState(null);
  }

  return { state, display: state ? displayGroupOf(state) : 'idle', begin, reset };
}
